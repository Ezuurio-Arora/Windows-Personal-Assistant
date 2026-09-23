import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:personal_assistant/screens/main_shell.dart';
import 'package:personal_assistant/screens/chat_screen.dart';
import 'package:personal_assistant/screens/actions_screen.dart';
import 'package:personal_assistant/screens/screen_stream_view.dart';
import 'package:personal_assistant/screens/settings_screen.dart';
import 'package:personal_assistant/widgets/killswitch_button.dart';
import 'package:personal_assistant/widgets/gemini_gradient_bar.dart';
import 'package:personal_assistant/providers/connection_provider.dart';
import 'package:personal_assistant/providers/actions_provider.dart';
import 'package:personal_assistant/providers/chat_provider.dart';
import 'package:personal_assistant/providers/screen_stream_provider.dart';
import 'package:personal_assistant/services/auth_service.dart';
import 'package:personal_assistant/services/hmac_service.dart';
import 'package:personal_assistant/services/socket_service.dart';
import 'package:personal_assistant/models/device_session.dart';
import 'package:personal_assistant/theme/gemini_theme.dart';

class MockAuthService implements AuthService {
  @override
  Future<bool> authenticateWithBiometrics({String reason = ''}) async => true;
  @override
  Future<bool> canCheckBiometrics() async => true;
  @override
  Future<void> clearSession() async {}
  @override
  Future<bool> hasValidSession() async => true;
  @override
  Future<DeviceSession?> loadSession() async => null;
  @override
  Future<void> saveSession(DeviceSession session) async {}
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
  String generateNonce() => 'test_nonce_123';
  @override
  int getCurrentTimestamp() => 1774351000000;
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

  @override
  Stream<Uint8List> get binaryStream => _binController.stream;
  @override
  Stream<bool> get connectionStateStream => _connController.stream;
  @override
  Stream<Map<String, dynamic>> get eventStream => _eventController.stream;
  @override
  bool get isConnected => true;
  @override
  Future<void> connect({required String url}) async {}
  @override
  Future<void> disconnect({int code = 1000, String reason = ''}) async {}
  @override
  void dispose() {}
  @override
  void sendEvent(String event, dynamic data, {required String sessionToken, required String hmacSecret}) {}
  @override
  void sendRaw(String rawMessage) {}
}

void main() {
  testWidgets('MainShell renders persistent top bar, killswitch, and handles bottom navigation',
      (WidgetTester tester) async {
    final mockAuth = MockAuthService();
    final mockHmac = MockHmacService();
    final mockSocket = MockSocketService();

    final connProvider = ConnectionProvider(
      authService: mockAuth,
      hmacService: mockHmac,
      socketService: mockSocket,
    );

    final chatProvider = ChatProvider(
      socketService: mockSocket,
      connectionProvider: connProvider,
    );

    final actionsProvider = ActionsProvider(
      socketService: mockSocket,
      connectionProvider: connProvider,
      hmacService: mockHmac,
    );

    final streamProvider = ScreenStreamProvider(
      socketService: mockSocket,
      connectionProvider: connProvider,
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
          ChangeNotifierProvider<ChatProvider>.value(value: chatProvider),
          ChangeNotifierProvider<ActionsProvider>.value(value: actionsProvider),
          ChangeNotifierProvider<ScreenStreamProvider>.value(value: streamProvider),
        ],
        child: MaterialApp(
          theme: GeminiTheme.darkTheme,
          home: const MainShell(),
        ),
      ),
    );

    // 1. Verify Top App Bar elements
    expect(find.descendant(of: find.byType(AppBar), matching: find.text('Personal Assistant')), findsOneWidget);
    expect(find.descendant(of: find.byType(AppBar), matching: find.byIcon(Icons.auto_awesome)), findsOneWidget);
    expect(find.byType(KillswitchButton), findsOneWidget);
    expect(find.byType(GeminiGradientBar), findsOneWidget);

    // 2. Verify Initial Screen is ChatScreen
    expect(find.byType(ChatScreen), findsOneWidget);

    // 3. Verify Bottom Navigation Items
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Actions'), findsOneWidget);
    expect(find.text('Screen'), findsOneWidget);
    expect(find.text('Settings'), findsOneWidget);

    // 4. Switch to Actions Screen
    await tester.tap(find.text('Actions'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(ActionsScreen), findsOneWidget);

    // 5. Switch to Screen (Live Screen View)
    await tester.tap(find.text('Screen'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(ScreenStreamView), findsOneWidget);

    // 6. Switch to Settings Screen
    await tester.tap(find.text('Settings'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(SettingsScreen), findsOneWidget);

    // 7. Switch back to Chat
    await tester.tap(find.text('Chat'));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.byType(ChatScreen), findsOneWidget);

    // 8. Test Killswitch Dialog
    await tester.tap(find.byKey(const Key('killswitch_btn')));
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Emergency Killswitch'), findsOneWidget);
    expect(find.text('Lock Workstation Now'), findsOneWidget);
  });
}
