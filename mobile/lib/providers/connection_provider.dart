import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/device_session.dart';
import '../services/auth_service.dart';
import '../services/hmac_service.dart';
import '../services/socket_service.dart';

enum ConnectionStatus {
  unpaired,
  scanning,
  pairing,
  connecting,
  connected,
  reconnecting,
  revoked,
  error
}

class ConnectionProvider extends ChangeNotifier {
  final AuthService _authService;
  final HmacService _hmacService;
  final SocketService _socketService;
  final http.Client _httpClient;

  ConnectionStatus _status = ConnectionStatus.unpaired;
  DeviceSession? _session;
  String? _errorMessage;
  int _latencyMs = 0;
  String _activeTransport = 'LAN';

  StreamSubscription? _socketSub;
  StreamSubscription? _connectionSub;

  ConnectionProvider({
    required AuthService authService,
    required HmacService hmacService,
    required SocketService socketService,
    http.Client? httpClient,
  })  : _authService = authService,
        _hmacService = hmacService,
        _socketService = socketService,
        _httpClient = httpClient ?? http.Client() {
    _init();
  }

  ConnectionStatus get status => _status;
  DeviceSession? get session => _session;
  String? get errorMessage => _errorMessage;
  int get latencyMs => _latencyMs;
  String get activeTransport => _activeTransport;
  bool get isConnected => _status == ConnectionStatus.connected;

  Future<void> _init() async {
    final cached = await _authService.loadSession();
    if (cached != null) {
      _session = cached;
      _status = ConnectionStatus.connecting;
      notifyListeners();
      await connectWithSession(cached);
    } else {
      _status = ConnectionStatus.unpaired;
      notifyListeners();
    }

    _connectionSub = _socketService.connectionStateStream.listen((connected) {
      if (connected) {
        _status = ConnectionStatus.connected;
      } else if (_status == ConnectionStatus.connected) {
        _status = ConnectionStatus.reconnecting;
      }
      notifyListeners();
    });

    _socketSub = _socketService.eventStream.listen(_handleServerEvent);
  }

  void _handleServerEvent(Map<String, dynamic> packet) {
    final event = packet['event'] as String?;
    if (event == 'device:revoked' || event == 'pairing:revoked') {
      handleRemoteRevocation();
    }
  }

  Future<bool> pairWithQr(String qrJson) async {
    _status = ConnectionStatus.pairing;
    _errorMessage = null;
    notifyListeners();

    try {
      final payload = jsonDecode(qrJson) as Map<String, dynamic>;
      final lanIps = (payload['lanIps'] as List<dynamic>?)?.cast<String>() ?? ['127.0.0.1'];
      final port = payload['port'] as int? ?? 42000;
      final nonce = payload['nonce'] as String;
      final pin = payload['pin'] as String?;
      final tunnelUrl = payload['tunnelUrl'] as String?;
      final hostName = payload['hostName'] as String? ?? 'Host PC';

      // Send pairing request to primary LAN IP
      final targetIp = lanIps.first;
      final pairUrl = Uri.parse('http://$targetIp:$port/api/pair');

      final body = jsonEncode({
        'nonce': nonce,
        if (pin != null) 'pin': pin,
        'deviceId': 'android_${DateTime.now().millisecondsSinceEpoch}',
        'deviceName': 'Google Pixel Companion',
        'platform': 'android',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });

      final response = await _httpClient
          .post(pairUrl, headers: {'Content-Type': 'application/json'}, body: body)
          .timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final resData = jsonDecode(response.body) as Map<String, dynamic>;
        final newSession = DeviceSession(
          sessionToken: resData['sessionToken'] as String,
          hmacSecret: resData['hmacSecret'] as String,
          hostName: resData['hostName'] as String? ?? hostName,
          lanIp: targetIp,
          port: port,
          tunnelUrl: tunnelUrl,
          safetyMode: resData['safetyMode'] as String? ?? 'tiered',
          serverTime: resData['serverTime'] as int? ?? DateTime.now().millisecondsSinceEpoch,
          pairedAt: DateTime.now(),
          lastConnected: DateTime.now(),
          deviceId: 'android_companion',
          deviceName: 'Android Device',
        );

        await _authService.saveSession(newSession);
        _session = newSession;
        _status = ConnectionStatus.connecting;
        notifyListeners();

        await connectWithSession(newSession);
        return true;
      } else if (response.statusCode == 403) {
        _errorMessage = 'Desktop already paired to another phone (Lockout).';
        _status = ConnectionStatus.unpaired;
        notifyListeners();
        return false;
      } else {
        _errorMessage = 'Pairing rejected: ${response.statusCode}';
        _status = ConnectionStatus.unpaired;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'Failed to connect to desktop LAN IP: $e';
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    }
  }

  Future<void> connectWithSession(DeviceSession session) async {
    try {
      _activeTransport = 'LAN';
      await _socketService.connect(url: session.wsUrl);
      _status = ConnectionStatus.connected;
    } catch (_) {
      try {
        _activeTransport = 'mDNS';
        await _socketService.connect(url: session.fallbackWsUrl);
        _status = ConnectionStatus.connected;
      } catch (_) {
        if (session.tunnelWsUrl != null) {
          _activeTransport = 'Tunnel';
          await _socketService.connect(url: session.tunnelWsUrl!);
          _status = ConnectionStatus.connected;
        } else {
          _status = ConnectionStatus.error;
          _errorMessage = 'Could not reach desktop over LAN, mDNS, or Tunnel.';
        }
      }
    }
    notifyListeners();
  }

  Future<void> disconnect({bool userInitiated = true}) async {
    if (_session != null && userInitiated) {
      try {
        final headers = _hmacService.buildAuthHeaders(
          method: 'POST',
          path: '/api/device/disconnect',
          sessionToken: _session!.sessionToken,
          hmacSecret: _session!.hmacSecret,
        );
        await _httpClient.post(
          Uri.parse('${_session!.httpBaseUrl}/api/device/disconnect'),
          headers: headers,
        ).timeout(const Duration(seconds: 2));
      } catch (_) {}
    }

    await _socketService.disconnect();
    await _authService.clearSession();
    _session = null;
    _status = ConnectionStatus.unpaired;
    notifyListeners();
  }

  void handleRemoteRevocation() async {
    await _socketService.disconnect(code: 4003, reason: 'Device Access Revoked');
    await _authService.clearSession();
    _session = null;
    _status = ConnectionStatus.revoked;
    _errorMessage = 'Session revoked by Desktop Hub.';
    notifyListeners();
  }

  @override
  void dispose() {
    _socketSub?.cancel();
    _connectionSub?.cancel();
    _httpClient.close();
    super.dispose();
  }
}
