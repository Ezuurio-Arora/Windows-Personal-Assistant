import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:personal_assistant/models/device_session.dart';
import 'package:personal_assistant/providers/connection_provider.dart';
import 'package:personal_assistant/services/auth_service.dart';
import 'package:personal_assistant/services/hmac_service.dart';
import 'package:personal_assistant/services/socket_service.dart';

class MockAuthService implements AuthService {
  DeviceSession? savedSession;

  @override
  Future<bool> authenticateWithBiometrics({String reason = ''}) async => true;
  @override
  Future<bool> canCheckBiometrics() async => true;
  @override
  Future<void> clearSession() async {
    savedSession = null;
  }
  @override
  Future<bool> hasValidSession() async => savedSession != null;
  @override
  Future<DeviceSession?> loadSession() async => savedSession;
  @override
  Future<void> saveSession(DeviceSession session) async {
    savedSession = session;
  }
  @override
  Future<bool> isBiometricLockEnabled() async => true;
  @override
  Future<void> setBiometricLockEnabled(bool enabled) async {}
}

class MockHmacService implements HmacService {
  @override
  Map<String, String> buildAuthHeaders({
    required String method,
    required String path,
    required String sessionToken,
    required String hmacSecret,
    String body = '',
  }) => {};

  @override
  Map<String, dynamic> buildWebSocketEnvelope({
    required String event,
    required dynamic data,
    required String sessionToken,
    required String hmacSecret,
  }) => {};

  @override
  String generateNonce() => 'test_nonce';
  @override
  int getCurrentTimestamp() => DateTime.now().millisecondsSinceEpoch;
  @override
  String signHttpRequest({
    required String method,
    required String path,
    required int timestamp,
    required String nonce,
    required String body,
    required String secret,
  }) => 'test_sig';
  @override
  bool verifySignature({
    required String signature,
    required String message,
    required String secret,
  }) => true;
}

class MockSocketService implements SocketService {
  final _eventController = StreamController<Map<String, dynamic>>.broadcast();
  final _binController = StreamController<Uint8List>.broadcast();
  final _connController = StreamController<bool>.broadcast();
  bool connected = false;
  bool shouldFailConnect = false;
  int connectCount = 0;

  @override
  Stream<Uint8List> get binaryStream => _binController.stream;
  @override
  Stream<bool> get connectionStateStream => _connController.stream;
  @override
  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;
  @override
  bool get isConnected => connected;
  @override
  Future<void> connect({required String url}) async {
    connectCount++;
    if (shouldFailConnect) {
      throw Exception('Socket connection failed');
    }
    connected = true;
    _connController.add(true);
  }
  @override
  Future<void> disconnect({int code = 1000, String reason = ''}) async {
    connected = false;
    _connController.add(false);
  }
  @override
  void dispose() {}
  @override
  void sendEvent(String event, dynamic data, {required String sessionToken, required String hmacSecret}) {}
  @override
  void sendRaw(String rawMessage) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ConnectionProvider - QR & PIN Pairing Reliability Suite', () {
    late MockAuthService mockAuth;
    late MockHmacService mockHmac;
    late MockSocketService mockSocket;

    setUp(() {
      mockAuth = MockAuthService();
      mockHmac = MockHmacService();
      mockSocket = MockSocketService();
    });

    test('pairWithQr succeeds with JSON payload', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, equals('/api/pair'));
        final reqBody = jsonDecode(request.body) as Map<String, dynamic>;
        expect(reqBody['nonce'], equals('nonce123456'));
        expect(reqBody['pin'], equals('654321'));

        return http.Response(
          jsonEncode({
            'status': 'paired',
            'sessionToken': 'mock_token_123',
            'hmacSecret': 'mock_secret_456',
            'hostName': 'EZAN-PC',
            'serverTime': 1774351000000,
            'safetyMode': 'tiered',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
        httpClient: mockClient,
      );

      const qrJson = '{"lanIps":["192.168.10.139"],"port":42000,"nonce":"nonce123456","pin":"654321","hostName":"EZAN-PC"}';
      final result = await provider.pairWithQr(qrJson);

      expect(result, isTrue);
      expect(provider.status, equals(ConnectionStatus.connected));
      expect(provider.session, isNotNull);
      expect(provider.session?.sessionToken, equals('mock_token_123'));
      expect(provider.session?.lanIp, equals('192.168.10.139'));
    });

    test('pairWithQr succeeds with personal-assistant:// URI format', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.path, equals('/api/pair'));
        final reqBody = jsonDecode(request.body) as Map<String, dynamic>;
        expect(reqBody['nonce'], equals('nonce_compact_uri'));
        expect(reqBody['pin'], equals('123456'));

        return http.Response(
          jsonEncode({
            'status': 'paired',
            'sessionToken': 'token_uri_ok',
            'hmacSecret': 'secret_uri_ok',
            'hostName': 'DESKTOP-URI',
            'serverTime': 1774351000000,
            'safetyMode': 'tiered',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
        httpClient: mockClient,
      );

      const compactUri = 'personal-assistant://pair?v=1&host=DESKTOP-URI&ip=192.168.10.139&port=42000&nonce=nonce_compact_uri&pin=123456&exp=1774352000000';
      final result = await provider.pairWithQr(compactUri);

      expect(result, isTrue);
      expect(provider.status, equals(ConnectionStatus.connected));
      expect(provider.session?.hostName, equals('DESKTOP-URI'));
    });

    test('pairWithQr succeeds with http:// URI format', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.host, equals('192.168.10.139'));
        expect(request.url.port, equals(42000));
        return http.Response(
          jsonEncode({
            'status': 'paired',
            'sessionToken': 'token_http_ok',
            'hmacSecret': 'secret_http_ok',
            'hostName': 'HTTP-HOST',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
        httpClient: mockClient,
      );

      const httpUri = 'http://192.168.10.139:42000?token=http_nonce_999&pin=999888';
      final result = await provider.pairWithQr(httpUri);

      expect(result, isTrue);
      expect(provider.isConnected, isTrue);
    });

    test('pairWithQr does not crash on corrupt/garbage data', () async {
      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      final result1 = await provider.pairWithQr('not-a-valid-qr-payload-at-all');
      expect(result1, isFalse);
      expect(provider.errorMessage, isNotNull);

      final result2 = await provider.pairWithQr('');
      expect(result2, isFalse);

      final result3 = await provider.pairWithQr('{"garbage":true}');
      expect(result3, isFalse);
    });

    test('pairWithPin succeeds with valid 6-digit PIN and default IP', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.host, equals('192.168.10.139'));
        expect(request.url.port, equals(42000));
        final reqBody = jsonDecode(request.body) as Map<String, dynamic>;
        expect(reqBody['pin'], equals('482910'));

        return http.Response(
          jsonEncode({
            'status': 'paired',
            'sessionToken': 'pin_session_token_ok',
            'hmacSecret': 'pin_hmac_secret_ok',
            'hostName': 'MY-WORKSTATION',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
        httpClient: mockClient,
      );

      final result = await provider.pairWithPin('482910');
      expect(result, isTrue);
      expect(provider.status, equals(ConnectionStatus.connected));
      expect(provider.session?.sessionToken, equals('pin_session_token_ok'));
    });

    test('pairWithPin succeeds with explicit targetIp', () async {
      final mockClient = MockClient((request) async {
        expect(request.url.host, equals('192.168.1.50'));
        expect(request.url.port, equals(42000));

        return http.Response(
          jsonEncode({
            'status': 'paired',
            'sessionToken': 'custom_ip_token',
            'hmacSecret': 'custom_ip_secret',
            'hostName': 'CUSTOM-IP-HOST',
          }),
          200,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
        httpClient: mockClient,
      );

      final result = await provider.pairWithPin('123456', targetIp: '192.168.1.50');
      expect(result, isTrue);
      expect(provider.session?.lanIp, equals('192.168.1.50'));
    });

    test('pairWithPin handles single-device lockout (HTTP 403) with descriptive error', () async {
      final mockClient = MockClient((request) async {
        return http.Response(
          jsonEncode({
            'error': 'DEVICE_LOCKED',
            'message': 'Another mobile device (Google Pixel) is already paired. Revoke device first.'
          }),
          403,
          headers: {'content-type': 'application/json'},
        );
      });

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
        httpClient: mockClient,
      );

      final result = await provider.pairWithPin('123456', targetIp: '192.168.10.139');
      expect(result, isFalse);
      expect(provider.status, equals(ConnectionStatus.unpaired));
      expect(provider.errorMessage, contains('Another mobile device'));
    });

    test('pairWithPin validates PIN format before sending request', () async {
      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      expect(await provider.pairWithPin('12345'), isFalse);
      expect(provider.errorMessage, contains('6 numeric digits'));

      expect(await provider.pairWithPin('abcdef'), isFalse);
      expect(provider.errorMessage, contains('6 numeric digits'));

      expect(await provider.pairWithPin(''), isFalse);
      expect(provider.errorMessage, contains('6 numeric digits'));
    });

    test('targetHostIp can be configured and updated', () {
      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      expect(provider.targetHostIp, equals('192.168.10.139'));

      provider.setTargetHostIp('192.168.1.200');
      expect(provider.targetHostIp, equals('192.168.1.200'));
    });

    test('Persistent pairing: connection drop sets status to reconnecting without clearing session', () async {
      final session = DeviceSession(
        sessionToken: 'test_token_123',
        hmacSecret: 'test_secret_456',
        hostName: 'TEST-HOST',
        lanIp: '192.168.10.139',
        port: 42000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
      );
      mockAuth.savedSession = session;

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );
      await Future.delayed(const Duration(milliseconds: 10));

      expect(provider.isConnected, isTrue);
      expect(provider.status, equals(ConnectionStatus.connected));
      expect(provider.session, isNotNull);

      // Simulate network / server drop
      await mockSocket.disconnect();
      await Future.delayed(const Duration(milliseconds: 10));

      expect(provider.isConnected, isFalse);
      expect(provider.status, equals(ConnectionStatus.reconnecting));
      expect(provider.session, isNotNull, reason: 'Session must NOT be cleared on drop');
      expect(mockAuth.savedSession, isNotNull, reason: 'Session must remain stored in authService');

      provider.dispose();
    });

    test('connectWithSession sets reconnecting on failure and retryConnection triggers reconnect', () async {
      final session = DeviceSession(
        sessionToken: 'test_token_fail',
        hmacSecret: 'test_secret_fail',
        hostName: 'FAIL-HOST',
        lanIp: '192.168.10.139',
        port: 42000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
      );
      mockSocket.shouldFailConnect = true;

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      await provider.connectWithSession(session);
      expect(provider.status, equals(ConnectionStatus.reconnecting));
      expect(provider.session, isNotNull);
      expect(provider.errorMessage, contains('Could not reach desktop'));

      // Now server comes back online
      mockSocket.shouldFailConnect = false;
      await provider.retryConnection();

      expect(provider.status, equals(ConnectionStatus.connected));
      expect(provider.isConnected, isTrue);

      provider.dispose();
    });

    test('disconnect(userInitiated: false) does NOT clear session', () async {
      final session = DeviceSession(
        sessionToken: 'token_keep',
        hmacSecret: 'secret_keep',
        hostName: 'KEEP-HOST',
        lanIp: '192.168.10.139',
        port: 42000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
      );
      mockAuth.savedSession = session;

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );
      await Future.delayed(const Duration(milliseconds: 10));

      await provider.disconnect(userInitiated: false);
      expect(provider.session, isNotNull);
      expect(mockAuth.savedSession, isNotNull);
      expect(provider.status, equals(ConnectionStatus.reconnecting));

      provider.dispose();
    });

    test('disconnect(userInitiated: true) clears session and sets unpaired', () async {
      final session = DeviceSession(
        sessionToken: 'token_clear',
        hmacSecret: 'secret_clear',
        hostName: 'CLEAR-HOST',
        lanIp: '192.168.10.139',
        port: 42000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
      );
      mockAuth.savedSession = session;

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );
      await Future.delayed(const Duration(milliseconds: 10));

      await provider.disconnect(userInitiated: true);
      expect(provider.session, isNull);
      expect(mockAuth.savedSession, isNull);
      expect(provider.status, equals(ConnectionStatus.unpaired));

      provider.dispose();
    });

    test('handleRemoteRevocation clears session and sets revoked status', () async {
      final session = DeviceSession(
        sessionToken: 'token_revoke',
        hmacSecret: 'secret_revoke',
        hostName: 'REVOKE-HOST',
        lanIp: '192.168.10.139',
        port: 42000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
      );
      mockAuth.savedSession = session;

      final provider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );
      await Future.delayed(const Duration(milliseconds: 10));

      provider.handleRemoteRevocation();
      await Future.delayed(const Duration(milliseconds: 10));

      expect(provider.session, isNull);
      expect(mockAuth.savedSession, isNull);
      expect(provider.status, equals(ConnectionStatus.revoked));

      provider.dispose();
    });
  });
}
