import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'hmac_service.dart';

abstract class SocketService {
  Stream<Map<String, dynamic>> get eventStream;
  Stream<Uint8List> get binaryStream;
  Stream<bool> get connectionStateStream;
  bool get isConnected;

  Future<void> connect({required String url});
  Future<void> disconnect({int code = 1000, String reason = 'Normal Closure'});
  void sendEvent(
    String event,
    dynamic data, {
    required String sessionToken,
    required String hmacSecret,
  });
  void sendRaw(String rawMessage);
  void dispose();
}

class WebSocketChannelService implements SocketService {
  final HmacService _hmacService;
  WebSocketChannel? _channel;
  StreamSubscription? _subscription;

  final StreamController<Map<String, dynamic>> _eventController =
      StreamController<Map<String, dynamic>>.broadcast();
  final StreamController<Uint8List> _binaryController =
      StreamController<Uint8List>.broadcast();
  final StreamController<bool> _connectionStateController =
      StreamController<bool>.broadcast();

  bool _isConnected = false;
  Timer? _heartbeatTimer;

  WebSocketChannelService({HmacService? hmacService})
      : _hmacService = hmacService ?? CryptoHmacService();

  @override
  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;

  @override
  Stream<Uint8List> get binaryStream => _binaryController.stream;

  @override
  Stream<bool> get connectionStateStream => _connectionStateController.stream;

  @override
  bool get isConnected => _isConnected;

  @override
  Future<void> connect({required String url}) async {
    await disconnect();

    try {
      final uri = Uri.parse(url);
      _channel = WebSocketChannel.connect(uri);
      await _channel!.ready;

      _isConnected = true;
      _connectionStateController.add(true);
      _startHeartbeat();

      _subscription = _channel!.stream.listen(
        (message) {
          if (message is Uint8List) {
            _binaryController.add(message);
          } else if (message is List<int>) {
            _binaryController.add(Uint8List.fromList(message));
          } else if (message is String) {
            try {
              final parsed = jsonDecode(message) as Map<String, dynamic>;
              _eventController.add(parsed);
            } catch (_) {
              // Non-JSON frame dropped
            }
          }
        },
        onError: (error) {
          _handleDisconnection();
        },
        onDone: () {
          _handleDisconnection();
        },
      );
    } catch (e) {
      _handleDisconnection();
      rethrow;
    }
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_isConnected && _channel != null) {
        try {
          _channel!.sink.add(jsonEncode({
            'type': 'ping',
            'timestamp': DateTime.now().millisecondsSinceEpoch
          }));
        } catch (_) {}
      }
    });
  }

  void _handleDisconnection() {
    _isConnected = false;
    _heartbeatTimer?.cancel();
    _connectionStateController.add(false);
  }

  @override
  Future<void> disconnect({int code = 1000, String reason = 'Normal Closure'}) async {
    _heartbeatTimer?.cancel();
    await _subscription?.cancel();
    _subscription = null;
    try {
      await _channel?.sink.close(code, reason);
    } catch (_) {}
    _channel = null;
    _isConnected = false;
    _connectionStateController.add(false);
  }

  @override
  void sendEvent(
    String event,
    dynamic data, {
    required String sessionToken,
    required String hmacSecret,
  }) {
    if (!_isConnected || _channel == null) return;

    final envelope = _hmacService.buildWebSocketEnvelope(
      event: event,
      data: data,
      sessionToken: sessionToken,
      hmacSecret: hmacSecret,
    );

    _channel!.sink.add(jsonEncode(envelope));
  }

  @override
  void sendRaw(String rawMessage) {
    if (!_isConnected || _channel == null) return;
    _channel!.sink.add(rawMessage);
  }

  @override
  void dispose() {
    disconnect();
    _eventController.close();
    _binaryController.close();
    _connectionStateController.close();
  }
}
