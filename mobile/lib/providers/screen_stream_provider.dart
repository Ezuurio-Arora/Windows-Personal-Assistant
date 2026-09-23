import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import '../services/socket_service.dart';
import 'connection_provider.dart';

class ScreenStreamProvider extends ChangeNotifier {
  final SocketService _socketService;
  final ConnectionProvider _connectionProvider;

  bool _isStreaming = false;
  Uint8List? _currentFrameBytes;
  int _fps = 0;
  int _latencyMs = 0;
  bool _isFullscreen = false;
  double _zoomScale = 1.0;

  StreamSubscription? _binarySub;
  int _frameCount = 0;
  Timer? _fpsTimer;

  ScreenStreamProvider({
    required SocketService socketService,
    required ConnectionProvider connectionProvider,
  })  : _socketService = socketService,
        _connectionProvider = connectionProvider;

  bool get isStreaming => _isStreaming;
  Uint8List? get currentFrameBytes => _currentFrameBytes;
  int get fps => _fps;
  int get latencyMs => _latencyMs;
  bool get isFullscreen => _isFullscreen;
  double get zoomScale => _zoomScale;

  void startStream() {
    if (_isStreaming) return;
    final session = _connectionProvider.session;
    if (session == null || !_connectionProvider.isConnected) return;

    _isStreaming = true;
    _frameCount = 0;
    notifyListeners();

    _socketService.sendEvent(
      'stream:start',
      {'fps': 10, 'quality': 60, 'maxWidth': 1024},
      sessionToken: session.sessionToken,
      hmacSecret: session.hmacSecret,
    );

    _binarySub = _socketService.binaryStream.listen((frameBytes) {
      _currentFrameBytes = frameBytes;
      _frameCount++;
      notifyListeners();
    });

    _fpsTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _fps = _frameCount;
      _frameCount = 0;
      notifyListeners();
    });
  }

  void stopStream() {
    if (!_isStreaming) return;
    _isStreaming = false;
    _binarySub?.cancel();
    _fpsTimer?.cancel();
    _fps = 0;
    _currentFrameBytes = null;
    notifyListeners();

    final session = _connectionProvider.session;
    if (session != null && _connectionProvider.isConnected) {
      _socketService.sendEvent(
        'stream:stop',
        {},
        sessionToken: session.sessionToken,
        hmacSecret: session.hmacSecret,
      );
    }
  }

  void toggleStream() {
    if (_isStreaming) {
      stopStream();
    } else {
      startStream();
    }
  }

  void toggleFullscreen() {
    _isFullscreen = !_isFullscreen;
    notifyListeners();
  }

  void setZoom(double scale) {
    _zoomScale = scale.clamp(1.0, 4.0);
    notifyListeners();
  }

  /// Auto-halts streaming on mobile lifecycle pause (prevents battery/bandwidth drain)
  void onAppPaused() {
    if (_isStreaming) {
      stopStream();
    }
  }

  @override
  void dispose() {
    stopStream();
    super.dispose();
  }
}
