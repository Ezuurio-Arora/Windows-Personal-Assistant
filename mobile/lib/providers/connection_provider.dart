import 'dart:async';
import 'dart:convert';
import 'dart:io';
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
  String _targetHostIp = '192.168.10.139';

  StreamSubscription? _socketSub;
  StreamSubscription? _connectionSub;
  Timer? _reconnectTimer;
  bool _isConnecting = false;

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
  AuthService get authService => _authService;
  String get targetHostIp => _session?.lanIp ?? _targetHostIp;

  void setTargetHostIp(String ip) {
    final clean = ip.trim();
    if (clean.isNotEmpty && clean != _targetHostIp) {
      _targetHostIp = clean;
      notifyListeners();
    }
  }

  Future<void> _init() async {
    final cached = await _authService.loadSession();
    if (cached != null) {
      _session = cached;
      _targetHostIp = cached.lanIp;
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
        _errorMessage = null;
        _stopReconnectLoop();
      } else if (_session != null) {
        _status = ConnectionStatus.reconnecting;
        _startReconnectLoop();
      } else {
        _status = ConnectionStatus.unpaired;
      }
      notifyListeners();
    });

    _socketSub = _socketService.eventStream.listen(_handleServerEvent);
  }

  void _startReconnectLoop() {
    if (_reconnectTimer != null && _reconnectTimer!.isActive) return;
    _reconnectTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (_session != null && !isConnected) {
        _status = ConnectionStatus.reconnecting;
        notifyListeners();
        _attemptReconnect();
      } else {
        _stopReconnectLoop();
      }
    });
  }

  void _stopReconnectLoop() {
    _reconnectTimer?.cancel();
    _reconnectTimer = null;
  }

  Future<void> _attemptReconnect() async {
    if (_session == null || isConnected || _isConnecting) return;
    await connectWithSession(_session!);
  }

  Future<void> retryConnection() async {
    if (_session == null || _isConnecting) return;
    _status = ConnectionStatus.reconnecting;
    notifyListeners();
    await connectWithSession(_session!);
  }

  void _handleServerEvent(Map<String, dynamic> packet) {
    final event = packet['event'] as String?;
    if (event == 'device:revoked' || event == 'pairing:revoked') {
      handleRemoteRevocation();
    }
  }

  Future<bool> pairWithQr(String rawData) async {
    _status = ConnectionStatus.pairing;
    _errorMessage = null;
    notifyListeners();

    try {
      final parsed = _parseQrPayload(rawData);
      if (parsed == null) {
        _errorMessage = 'Invalid QR format. Could not decode pairing payload.';
        _status = ConnectionStatus.unpaired;
        notifyListeners();
        return false;
      }

      if ((parsed.nonce == null || parsed.nonce!.isEmpty) &&
          (parsed.pin == null || parsed.pin!.isEmpty)) {
        _errorMessage = 'Invalid QR code: missing security nonce and PIN.';
        _status = ConnectionStatus.unpaired;
        notifyListeners();
        return false;
      }

      final body = jsonEncode({
        if (parsed.nonce != null && parsed.nonce!.isNotEmpty) 'nonce': parsed.nonce,
        if (parsed.pin != null && parsed.pin!.isNotEmpty) 'pin': parsed.pin,
        'deviceId': 'android_${DateTime.now().millisecondsSinceEpoch}',
        'deviceName': 'Android Companion',
        'platform': 'android',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });

      http.Response? response;
      String? connectedIp;

      for (final ip in parsed.lanIps) {
        try {
          final pairUrl = Uri.parse('http://$ip:${parsed.port}/api/pair');
          final resp = await _httpClient
              .post(pairUrl, headers: {'Content-Type': 'application/json'}, body: body)
              .timeout(const Duration(seconds: 4));
          response = resp;
          connectedIp = ip;
          if (resp.statusCode == 200 || resp.statusCode == 403 || resp.statusCode == 401) {
            break;
          }
        } catch (_) {
          // Continue to next LAN IP
        }
      }

      // If LAN unreachable and tunnelUrl is present, fallback to tunnel
      if ((response == null || (response.statusCode != 200 && response.statusCode != 403 && response.statusCode != 401)) &&
          parsed.tunnelUrl != null &&
          parsed.tunnelUrl!.isNotEmpty) {
        try {
          final tunnelPairUrl = Uri.parse('${parsed.tunnelUrl}/api/pair');
          final resp = await _httpClient
              .post(tunnelPairUrl, headers: {'Content-Type': 'application/json'}, body: body)
              .timeout(const Duration(seconds: 5));
          response = resp;
          connectedIp = parsed.lanIps.isNotEmpty ? parsed.lanIps.first : '127.0.0.1';
        } catch (_) {}
      }

      if (response == null) {
        _errorMessage = 'Failed to connect to desktop at ${parsed.lanIps.join(", ")}:${parsed.port}';
        _status = ConnectionStatus.unpaired;
        notifyListeners();
        return false;
      }

      return await _handlePairingResponse(
        response: response,
        hostIp: connectedIp ?? (parsed.lanIps.isNotEmpty ? parsed.lanIps.first : '192.168.10.139'),
        port: parsed.port,
        hostName: parsed.hostName,
        tunnelUrl: parsed.tunnelUrl,
      );
    } catch (e) {
      _errorMessage = 'QR pairing error: $e';
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    }
  }

  Future<bool> pairWithPin(String pin, {String? targetIp}) async {
    final cleanPin = pin.trim().replaceAll(' ', '');
    if (cleanPin.length != 6 || int.tryParse(cleanPin) == null) {
      _errorMessage = 'PIN must be exactly 6 numeric digits.';
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    }

    _status = ConnectionStatus.pairing;
    _errorMessage = null;
    notifyListeners();

    try {
      final candidateIps = await _discoverCandidateIps(targetIp: targetIp);
      final body = jsonEncode({
        'pin': cleanPin,
        'deviceId': 'android_${DateTime.now().millisecondsSinceEpoch}',
        'deviceName': 'Android Companion',
        'platform': 'android',
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });

      http.Response? response;
      String? connectedIp;

      for (final ip in candidateIps) {
        try {
          final pairUrl = Uri.parse('http://$ip:42000/api/pair');
          final resp = await _httpClient
              .post(pairUrl, headers: {'Content-Type': 'application/json'}, body: body)
              .timeout(const Duration(seconds: 3));
          response = resp;
          connectedIp = ip;
          if (resp.statusCode == 200 || resp.statusCode == 403 || resp.statusCode == 401) {
            break;
          }
        } catch (_) {
          // Probe next candidate IP
        }
      }

      if (response == null) {
        _errorMessage =
            'Could not reach desktop hub at candidate IPs (${candidateIps.join(", ")}). Please verify host IP.';
        _status = ConnectionStatus.unpaired;
        notifyListeners();
        return false;
      }

      return await _handlePairingResponse(
        response: response,
        hostIp: connectedIp ?? '192.168.10.139',
        port: 42000,
        hostName: 'Host PC',
        tunnelUrl: null,
      );
    } catch (e) {
      _errorMessage = 'PIN pairing error: $e';
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    }
  }

  Future<List<String>> _discoverCandidateIps({String? targetIp}) async {
    final List<String> candidates = [];

    void addIp(String? ip) {
      if (ip != null) {
        final trimmed = ip.trim();
        if (trimmed.isNotEmpty && !candidates.contains(trimmed)) {
          candidates.add(trimmed);
        }
      }
    }

    if (targetIp != null && targetIp.trim().isNotEmpty) {
      addIp(targetIp);
      return candidates;
    }

    // 1) Previously stored LAN IP or known host IP (192.168.10.139)
    if (_session?.lanIp != null && _session!.lanIp.isNotEmpty) {
      addIp(_session!.lanIp);
    }
    if (_targetHostIp.isNotEmpty) {
      addIp(_targetHostIp);
    }
    const knownHostIp = '192.168.10.139';
    addIp(knownHostIp);

    // 2) Auto-probe local subnet (192.168.10.x or default gateway)
    try {
      final interfaces = await NetworkInterface.list(
        includeLoopback: false,
        type: InternetAddressType.IPv4,
      );
      for (final iface in interfaces) {
        for (final addr in iface.addresses) {
          final ipStr = addr.address;
          final parts = ipStr.split('.');
          if (parts.length == 4) {
            final subnet = '${parts[0]}.${parts[1]}.${parts[2]}';
            addIp('$subnet.1');   // Default router / gateway
            addIp('$subnet.139'); // Known desktop host offset
            addIp('$subnet.100'); // Standard DHCP host range
          }
        }
      }
    } catch (_) {}

    // Fallbacks
    if (candidates.isEmpty) {
      addIp('192.168.10.139');
      addIp('127.0.0.1');
    }

    return candidates;
  }

  Future<bool> _handlePairingResponse({
    required http.Response response,
    required String hostIp,
    required int port,
    required String hostName,
    String? tunnelUrl,
  }) async {
    if (response.statusCode == 200) {
      final resData = jsonDecode(response.body) as Map<String, dynamic>;
      final newSession = DeviceSession(
        sessionToken: resData['sessionToken'] as String,
        hmacSecret: resData['hmacSecret'] as String,
        hostName: resData['hostName'] as String? ?? hostName,
        lanIp: hostIp,
        port: port,
        tunnelUrl: tunnelUrl ?? resData['tunnelUrl'] as String?,
        safetyMode: resData['safetyMode'] as String? ?? 'tiered',
        serverTime: resData['serverTime'] as int? ?? DateTime.now().millisecondsSinceEpoch,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
        deviceId: 'android_companion',
        deviceName: 'Android Companion',
      );

      await _authService.saveSession(newSession);
      _session = newSession;
      _targetHostIp = hostIp;
      _status = ConnectionStatus.connecting;
      notifyListeners();

      await connectWithSession(newSession);
      return true;
    } else if (response.statusCode == 403) {
      String msg = 'Desktop already paired to another phone (Lockout).';
      try {
        final resData = jsonDecode(response.body) as Map<String, dynamic>;
        if (resData['message'] != null) {
          msg = resData['message'] as String;
        }
      } catch (_) {}
      _errorMessage = msg;
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    } else if (response.statusCode == 401) {
      String msg = 'Invalid or expired 6-digit PIN. Check desktop display.';
      try {
        final resData = jsonDecode(response.body) as Map<String, dynamic>;
        if (resData['message'] != null) {
          msg = resData['message'] as String;
        }
      } catch (_) {}
      _errorMessage = msg;
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    } else {
      String msg = 'Pairing rejected (HTTP ${response.statusCode})';
      try {
        final resData = jsonDecode(response.body) as Map<String, dynamic>;
        if (resData['message'] != null) {
          msg = resData['message'] as String;
        }
      } catch (_) {}
      _errorMessage = msg;
      _status = ConnectionStatus.unpaired;
      notifyListeners();
      return false;
    }
  }

  _QrPayload? _parseQrPayload(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return null;

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        final payload = jsonDecode(trimmed) as Map<String, dynamic>;
        List<String> lanIps = [];
        if (payload['lanIps'] is List) {
          lanIps = (payload['lanIps'] as List)
              .map((e) => e.toString().trim())
              .where((e) => e.isNotEmpty)
              .toList();
        } else if (payload['ip'] != null) {
          lanIps = [payload['ip'].toString().trim()];
        }
        if (lanIps.isEmpty) {
          lanIps = [_targetHostIp, '192.168.10.139', '127.0.0.1'];
        }

        final port = payload['port'] is int
            ? payload['port'] as int
            : int.tryParse(payload['port']?.toString() ?? '') ?? 42000;
        final nonce = payload['nonce']?.toString();
        final pin = payload['pin']?.toString();
        final tunnelUrl = payload['tunnelUrl']?.toString() ?? payload['tunnel']?.toString();
        final hostName = payload['hostName']?.toString() ?? payload['host']?.toString() ?? 'Host PC';

        return _QrPayload(
          lanIps: lanIps,
          port: port,
          nonce: nonce,
          pin: pin,
          tunnelUrl: (tunnelUrl != null && tunnelUrl.isNotEmpty) ? tunnelUrl : null,
          hostName: hostName,
        );
      } catch (_) {
        return null;
      }
    }

    try {
      final uri = Uri.parse(trimmed);
      final qp = uri.queryParameters;

      List<String> lanIps = [];
      if (qp['ip'] != null && qp['ip']!.trim().isNotEmpty) {
        lanIps = qp['ip']!
            .split(',')
            .map((e) => e.trim())
            .where((e) => e.isNotEmpty)
            .toList();
      } else if (uri.host.isNotEmpty && uri.host != 'pair') {
        lanIps = [uri.host.trim()];
      }
      if (lanIps.isEmpty) {
        lanIps = [_targetHostIp, '192.168.10.139', '127.0.0.1'];
      }

      int port = 42000;
      if (qp['port'] != null && int.tryParse(qp['port']!) != null) {
        port = int.parse(qp['port']!);
      } else if (uri.hasPort && uri.port > 0) {
        port = uri.port;
      }

      final nonce = qp['nonce'] ?? qp['token'];
      final pin = qp['pin'];
      final tunnelUrl = qp['tunnel'] ?? qp['tunnelUrl'];
      final hostName = qp['host'] ?? qp['hostName'] ?? (uri.host.isNotEmpty && uri.host != 'pair' ? uri.host : 'Host PC');

      return _QrPayload(
        lanIps: lanIps,
        port: port,
        nonce: nonce,
        pin: pin,
        tunnelUrl: (tunnelUrl != null && tunnelUrl.isNotEmpty) ? tunnelUrl : null,
        hostName: hostName,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> connectWithSession(DeviceSession session) async {
    if (_isConnecting) return;
    _isConnecting = true;
    _session = session;

    try {
      _activeTransport = 'LAN';
      await _socketService.connect(url: session.wsUrl);
      _status = ConnectionStatus.connected;
      _errorMessage = null;
      _stopReconnectLoop();
    } catch (_) {
      try {
        _activeTransport = 'mDNS';
        await _socketService.connect(url: session.fallbackWsUrl);
        _status = ConnectionStatus.connected;
        _errorMessage = null;
        _stopReconnectLoop();
      } catch (_) {
        if (session.tunnelWsUrl != null && session.tunnelWsUrl!.isNotEmpty) {
          try {
            _activeTransport = 'Tunnel';
            await _socketService.connect(url: session.tunnelWsUrl!);
            _status = ConnectionStatus.connected;
            _errorMessage = null;
            _stopReconnectLoop();
          } catch (_) {
            _status = ConnectionStatus.reconnecting;
            _errorMessage = 'Could not reach desktop over LAN, mDNS, or Tunnel.';
            _startReconnectLoop();
          }
        } else {
          _status = ConnectionStatus.reconnecting;
          _errorMessage = 'Could not reach desktop over LAN, mDNS, or Tunnel.';
          _startReconnectLoop();
        }
      }
    } finally {
      _isConnecting = false;
      notifyListeners();
    }
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

    if (userInitiated) {
      _stopReconnectLoop();
      await _authService.clearSession();
      _session = null;
      _status = ConnectionStatus.unpaired;
    } else {
      _status = ConnectionStatus.reconnecting;
      _startReconnectLoop();
    }
    notifyListeners();
  }

  void handleRemoteRevocation() async {
    _stopReconnectLoop();
    await _socketService.disconnect(code: 4003, reason: 'Device Access Revoked');
    await _authService.clearSession();
    _session = null;
    _status = ConnectionStatus.revoked;
    _errorMessage = 'Session revoked by Desktop Hub.';
    notifyListeners();
  }

  @override
  void dispose() {
    _stopReconnectLoop();
    _socketSub?.cancel();
    _connectionSub?.cancel();
    _httpClient.close();
    super.dispose();
  }
}

class _QrPayload {
  final List<String> lanIps;
  final int port;
  final String? nonce;
  final String? pin;
  final String? tunnelUrl;
  final String hostName;

  _QrPayload({
    required this.lanIps,
    required this.port,
    this.nonce,
    this.pin,
    this.tunnelUrl,
    required this.hostName,
  });
}

