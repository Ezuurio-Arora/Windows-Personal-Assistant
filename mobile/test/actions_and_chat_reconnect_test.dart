import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:provider/provider.dart';
import 'package:personal_assistant/models/device_session.dart';
import 'package:personal_assistant/models/chat_message.dart';
import 'package:personal_assistant/models/system_metrics.dart';
import 'package:personal_assistant/models/window_item.dart';
import 'package:personal_assistant/providers/connection_provider.dart';
import 'package:personal_assistant/providers/actions_provider.dart';
import 'package:personal_assistant/providers/chat_provider.dart';
import 'package:personal_assistant/screens/main_shell.dart';
import 'package:personal_assistant/services/auth_service.dart';
import 'package:personal_assistant/services/hmac_service.dart';
import 'package:personal_assistant/services/socket_service.dart';
import 'package:personal_assistant/services/notification_service.dart';
import 'package:personal_assistant/theme/gemini_theme.dart';

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
  Future<bool> isBiometricLockEnabled() async => false;
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
  }) => {
    'x-auth-session': sessionToken,
    'x-auth-signature': 'mock_signature',
  };

  @override
  Map<String, dynamic> buildWebSocketEnvelope({
    required String event,
    required dynamic data,
    required String sessionToken,
    required String hmacSecret,
  }) => {
    'event': event,
    'data': data,
    'sessionToken': sessionToken,
  };

  @override
  String generateNonce() => 'test_nonce';
  @override
  int getCurrentTimestamp() => 12345;
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
  final eventController = StreamController<Map<String, dynamic>>.broadcast();
  final binController = StreamController<Uint8List>.broadcast();
  final connController = StreamController<bool>.broadcast();
  final List<Map<String, dynamic>> sentEvents = [];
  bool connected = true;

  @override
  Stream<Uint8List> get binaryStream => binController.stream;
  @override
  Stream<bool> get connectionStateStream => connController.stream;
  @override
  Stream<Map<String, dynamic>> get eventStream => eventController.stream;
  @override
  bool get isConnected => connected;
  @override
  Future<void> connect({required String url}) async {
    connected = true;
    connController.add(true);
  }
  @override
  Future<void> disconnect({int code = 1000, String reason = ''}) async {
    connected = false;
    connController.add(false);
  }
  @override
  void dispose() {}
  @override
  void sendEvent(String event, dynamic data, {required String sessionToken, required String hmacSecret}) {
    sentEvents.add({'event': event, 'data': data});
  }
  @override
  void sendRaw(String rawMessage) {}
}

class MockNotificationService implements NotificationService {
  @override
  Future<void> initialize() async {}
  @override
  Future<void> showAiCompletionNotification({required String title, required String body}) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ActionsProvider - lockPc and Socket Events', () {
    late MockAuthService mockAuth;
    late MockHmacService mockHmac;
    late MockSocketService mockSocket;
    late ConnectionProvider connProvider;
    late DeviceSession testSession;

    setUp(() {
      mockAuth = MockAuthService();
      mockHmac = MockHmacService();
      mockSocket = MockSocketService();

      testSession = DeviceSession(
        sessionToken: 'token_pc_lock',
        hmacSecret: 'secret_pc_lock',
        hostName: 'EZAN-PC',
        lanIp: '192.168.10.139',
        port: 42000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
      );
      mockAuth.savedSession = testSession;

      connProvider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );
    });

    tearDown(() {
      connProvider.dispose();
    });

    test('lockPc dispatches action:lock_pc via WebSocket and sends HTTP POST to /api/system/lock without disconnecting', () async {
      bool httpEndpointCalled = false;
      final mockHttpClient = MockClient((request) async {
        if (request.url.path == '/api/system/lock' && request.method == 'POST') {
          httpEndpointCalled = true;
          expect(request.headers['x-auth-session'], equals('token_pc_lock'));
          return http.Response(jsonEncode({'success': true, 'action': 'lock'}), 200);
        }
        return http.Response('Not Found', 404);
      });

      final actions = ActionsProvider(
        socketService: mockSocket,
        connectionProvider: connProvider,
        hmacService: mockHmac,
        httpClient: mockHttpClient,
      );

      await Future.delayed(const Duration(milliseconds: 10));
      expect(connProvider.isConnected, isTrue);

      await actions.lockPc();

      // Verify WebSocket frame was sent
      expect(mockSocket.sentEvents.any((e) => e['event'] == 'action:lock_pc' && e['data']['action'] == 'lock'), isTrue);

      // Verify HTTP request was sent
      expect(httpEndpointCalled, isTrue);

      // Verify connection remained paired and connected
      expect(connProvider.isConnected, isTrue);
      expect(connProvider.session, isNotNull);
      expect(mockAuth.savedSession, isNotNull);
    });

    test('supports volume:update event', () async {
      final actions = ActionsProvider(
        socketService: mockSocket,
        connectionProvider: connProvider,
        hmacService: mockHmac,
      );

      mockSocket.eventController.add({
        'event': 'volume:update',
        'data': {'level': 75, 'muted': true},
      });
      await Future.delayed(const Duration(milliseconds: 10));

      expect(actions.volumeLevel, equals(75));
      expect(actions.isMuted, isTrue);
    });

    test('supports windows:update event', () async {
      final actions = ActionsProvider(
        socketService: mockSocket,
        connectionProvider: connProvider,
        hmacService: mockHmac,
      );

      mockSocket.eventController.add({
        'event': 'windows:update',
        'data': {
          'activeWindow': {'title': 'Chrome', 'process': 'chrome', 'pid': 1234, 'hwnd': '0x123'},
          'windows': [
            {'title': 'Chrome', 'process': 'chrome', 'pid': 1234, 'hwnd': '0x123'},
            {'title': 'Notepad', 'process': 'notepad', 'pid': 5678, 'hwnd': '0x456'},
          ],
        },
      });
      await Future.delayed(const Duration(milliseconds: 10));

      expect(actions.activeWindow?.title, equals('Chrome'));
      expect(actions.windows.length, equals(2));
      expect(actions.windows[1].title, equals('Notepad'));
    });

    test('supports timer:update event', () async {
      final actions = ActionsProvider(
        socketService: mockSocket,
        connectionProvider: connProvider,
        hmacService: mockHmac,
      );

      mockSocket.eventController.add({
        'event': 'timer:update',
        'data': {
          'timerId': 'timer_1',
          'status': 'running',
          'durationSeconds': 300,
          'label': 'Tea',
        },
      });
      await Future.delayed(const Duration(milliseconds: 10));

      expect(actions.timers.length, equals(1));
      expect(actions.timers.first['timerId'], equals('timer_1'));
      expect(actions.timers.first['label'], equals('Tea'));
    });

    test('supports power:update event', () async {
      final actions = ActionsProvider(
        socketService: mockSocket,
        connectionProvider: connProvider,
        hmacService: mockHmac,
      );

      bool notified = false;
      actions.addListener(() {
        notified = true;
      });

      mockSocket.eventController.add({
        'event': 'power:update',
        'data': {
          'success': true,
          'action': 'lock',
          'battery': {
            'hasBattery': true,
            'percent': 88,
            'status': 'Discharging',
          },
        },
      });
      await Future.delayed(const Duration(milliseconds: 10));

      expect(notified, isTrue);
      expect(actions.metrics.battery.percent, equals(88));
      expect(actions.metrics.battery.status, equals('Discharging'));
    });
  });

  group('ChatProvider - message:completed and message:error', () {
    late MockAuthService mockAuth;
    late MockHmacService mockHmac;
    late MockSocketService mockSocket;
    late ConnectionProvider connProvider;
    late ChatProvider chatProvider;

    setUp(() {
      mockAuth = MockAuthService();
      mockHmac = MockHmacService();
      mockSocket = MockSocketService();

      connProvider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      chatProvider = ChatProvider(
        socketService: mockSocket,
        connectionProvider: connProvider,
        notificationService: MockNotificationService(),
      );
    });

    tearDown(() {
      chatProvider.dispose();
      connProvider.dispose();
    });

    test('supports message:completed event to complete streaming', () async {
      // Stream a token
      mockSocket.eventController.add({
        'event': 'message:token',
        'data': {'messageId': 'msg_c1', 'token': 'Processing request...'},
      });
      await Future.delayed(const Duration(milliseconds: 10));
      expect(chatProvider.isStreaming, isTrue);

      // Complete via message:completed
      mockSocket.eventController.add({
        'event': 'message:completed',
        'data': {'messageId': 'msg_c1', 'summary': 'Done!'},
      });
      await Future.delayed(const Duration(milliseconds: 10));

      expect(chatProvider.isStreaming, isFalse);
      expect(chatProvider.messages.last.isStreaming, isFalse);
      expect(chatProvider.subagentProgress, equals(1.0));
    });

    test('supports message:error event: updates content, sets isStreaming to false, and notifies', () async {
      // Stream a token
      mockSocket.eventController.add({
        'event': 'message:token',
        'data': {'messageId': 'msg_err1', 'token': 'Executing plan...'},
      });
      await Future.delayed(const Duration(milliseconds: 10));
      expect(chatProvider.isStreaming, isTrue);

      // Encounter error
      mockSocket.eventController.add({
        'event': 'message:error',
        'data': {'messageId': 'msg_err1', 'error': 'Rate limit exceeded on LLM endpoint'},
      });
      await Future.delayed(const Duration(milliseconds: 10));

      expect(chatProvider.isStreaming, isFalse);
      expect(chatProvider.messages.last.content, contains('Rate limit exceeded'));
      expect(chatProvider.messages.last.isStreaming, isFalse);
    });
  });

  group('MainShell Clean AMOLED Edge-to-Edge Design', () {
    testWidgets('Renders MainShell without top AppBar when connected', (tester) async {
      final mockAuth = MockAuthService();
      final mockHmac = MockHmacService();
      final mockSocket = MockSocketService();

      final connProvider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
            ChangeNotifierProvider<ChatProvider>.value(
              value: ChatProvider(socketService: mockSocket, connectionProvider: connProvider),
            ),
            ChangeNotifierProvider<ActionsProvider>.value(
              value: ActionsProvider(socketService: mockSocket, connectionProvider: connProvider),
            ),
          ],
          child: const MaterialApp(
            home: MainShell(
              isConnected: true,
              hostName: 'MY-PC',
              chatScreen: SizedBox(),
              actionsScreen: SizedBox(),
              streamScreen: SizedBox(),
              settingsScreen: SizedBox(),
            ),
          ),
        ),
      );

      expect(find.byType(AppBar), findsNothing);
    });

    testWidgets('Renders MainShell without top AppBar when offline', (tester) async {
      final mockAuth = MockAuthService();
      final mockHmac = MockHmacService();
      final mockSocket = MockSocketService();

      final connProvider = ConnectionProvider(
        authService: mockAuth,
        hmacService: mockHmac,
        socketService: mockSocket,
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
            ChangeNotifierProvider<ChatProvider>.value(
              value: ChatProvider(socketService: mockSocket, connectionProvider: connProvider),
            ),
            ChangeNotifierProvider<ActionsProvider>.value(
              value: ActionsProvider(socketService: mockSocket, connectionProvider: connProvider),
            ),
          ],
          child: const MaterialApp(
            home: MainShell(
              isConnected: false,
              chatScreen: SizedBox(),
              actionsScreen: SizedBox(),
              streamScreen: SizedBox(),
              settingsScreen: SizedBox(),
            ),
          ),
        ),
      );

      expect(find.byType(AppBar), findsNothing);
    });
  });
}
