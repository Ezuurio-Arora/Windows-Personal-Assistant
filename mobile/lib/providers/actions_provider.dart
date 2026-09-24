import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/system_metrics.dart';
import '../models/window_item.dart';
import '../services/hmac_service.dart';
import '../services/socket_service.dart';
import 'connection_provider.dart';

class ActionsProvider extends ChangeNotifier {
  final SocketService _socketService;
  final ConnectionProvider _connectionProvider;
  final HmacService _hmacService;
  final http.Client _httpClient;

  SystemMetrics _metrics = SystemMetrics.initial();
  List<WindowItem> _windows = [];
  WindowItem? _activeWindow;
  int _volumeLevel = 50;
  bool _isMuted = false;
  List<Map<String, dynamic>> _timers = [];

  StreamSubscription? _eventSubscription;

  ActionsProvider({
    required SocketService socketService,
    required ConnectionProvider connectionProvider,
    HmacService? hmacService,
    http.Client? httpClient,
  })  : _socketService = socketService,
        _connectionProvider = connectionProvider,
        _hmacService = hmacService ?? CryptoHmacService(),
        _httpClient = httpClient ?? http.Client() {
    _eventSubscription = _socketService.eventStream.listen(_onSocketEvent);
  }

  SystemMetrics get metrics => _metrics;
  List<WindowItem> get windows => List.unmodifiable(_windows);
  WindowItem? get activeWindow => _activeWindow;
  int get volumeLevel => _volumeLevel;
  bool get isMuted => _isMuted;
  List<Map<String, dynamic>> get timers => List.unmodifiable(_timers);

  void _onSocketEvent(Map<String, dynamic> packet) {
    final event = packet['event'] as String?;
    final data = packet['data'] as Map<String, dynamic>? ?? {};

    switch (event) {
      case 'metrics:update':
        _metrics = SystemMetrics.fromJson(data);
        notifyListeners();
        break;
      case 'volume:state':
      case 'volume:update':
        _volumeLevel = (data['level'] as num?)?.toInt() ?? _volumeLevel;
        _isMuted = data['muted'] as bool? ?? _isMuted;
        notifyListeners();
        break;
      case 'windows:list':
      case 'windows:update':
        final parsed = WindowListResponse.fromJson(data);
        _windows = parsed.windows;
        _activeWindow = parsed.activeWindow;
        notifyListeners();
        break;
      case 'timer:state':
      case 'timer:update':
      case 'timer:completed':
      case 'timer:cancelled':
        _handleTimerEvent(data);
        break;
      case 'power:update':
        if (data['battery'] != null && data['battery'] is Map<String, dynamic>) {
          _metrics = SystemMetrics(
            hostName: _metrics.hostName,
            cpu: _metrics.cpu,
            memory: _metrics.memory,
            gpu: _metrics.gpu,
            battery: BatteryMetrics.fromJson(data['battery'] as Map<String, dynamic>),
            uptimeHours: _metrics.uptimeHours,
            timestamp: DateTime.now(),
          );
        }
        notifyListeners();
        break;
    }
  }

  void _handleTimerEvent(Map<String, dynamic> data) {
    final timerId = data['timerId'] as String?;
    if (timerId == null) return;
    _timers.removeWhere((t) => t['timerId'] == timerId);
    if (data['status'] == 'running' || data['status'] == 'paused') {
      _timers.add(data);
    }
    notifyListeners();
  }

  void refreshMetrics() {
    _dispatch('action:metrics', {});
  }

  void setVolume(int level) {
    _volumeLevel = level.clamp(0, 100);
    _isMuted = false;
    notifyListeners(); // Optimistic update
    _dispatch('action:volume', {'action': 'set', 'level': _volumeLevel});
  }

  void toggleMute() {
    _isMuted = !_isMuted;
    notifyListeners(); // Optimistic update
    _dispatch('action:volume', {'action': 'toggle_mute'});
  }

  void startTimer(int seconds, String label) {
    _dispatch('action:timer', {
      'action': 'start',
      'durationSeconds': seconds,
      'label': label,
    });
  }

  void cancelTimer(String timerId) {
    _dispatch('action:timer', {'action': 'cancel', 'timerId': timerId});
  }

  void refreshWindows() {
    _dispatch('action:windows:list', {});
  }

  void focusWindow(String targetOrHwnd) {
    _dispatch('action:windows:focus', {'target': targetOrHwnd});
  }

  Future<void> lockPc() async {
    final session = _connectionProvider.session;
    if (session == null) return;

    // Dual-Path Dispatch: WebSocket frame + concurrent HTTP request for resilience
    _dispatch('action:lock_pc', {'action': 'lock'});

    try {
      final headers = _hmacService.buildAuthHeaders(
        method: 'POST',
        path: '/api/system/lock',
        sessionToken: session.sessionToken,
        hmacSecret: session.hmacSecret,
      );
      await _httpClient.post(
        Uri.parse('${session.httpBaseUrl}/api/system/lock'),
        headers: headers,
      ).timeout(const Duration(seconds: 2));
    } catch (_) {}
  }

  Future<void> triggerEmergencyKillswitch() async {
    final session = _connectionProvider.session;
    if (session == null) return;

    // Dual-Path Dispatch: WebSocket frame + concurrent HTTP request for resilience
    _dispatch('system:killswitch', {
      'action': 'emergency_lock_and_sever',
      'reason': 'user_1tap_killswitch',
      'deviceName': session.deviceName,
    });

    try {
      final headers = _hmacService.buildAuthHeaders(
        method: 'POST',
        path: '/api/system/killswitch',
        sessionToken: session.sessionToken,
        hmacSecret: session.hmacSecret,
      );
      await _httpClient.post(
        Uri.parse('${session.httpBaseUrl}/api/system/killswitch'),
        headers: headers,
      ).timeout(const Duration(milliseconds: 500));
    } catch (_) {}

    await _connectionProvider.disconnect(userInitiated: false);
  }

  void _dispatch(String event, Map<String, dynamic> data) {
    final session = _connectionProvider.session;
    if (session == null || !_connectionProvider.isConnected) return;

    _socketService.sendEvent(
      event,
      data,
      sessionToken: session.sessionToken,
      hmacSecret: session.hmacSecret,
    );
  }

  @override
  void dispose() {
    _eventSubscription?.cancel();
    _httpClient.close();
    super.dispose();
  }
}
