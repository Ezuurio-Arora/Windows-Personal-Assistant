import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:personal_assistant/screens/settings_screen.dart';
import 'package:personal_assistant/screens/main_shell.dart';
import 'package:personal_assistant/screens/chat_screen.dart';
import 'package:personal_assistant/services/auth_service.dart';
import 'package:personal_assistant/services/hmac_service.dart';
import 'package:personal_assistant/services/socket_service.dart';
import 'package:personal_assistant/providers/connection_provider.dart';
import 'package:personal_assistant/providers/chat_provider.dart';
import 'package:personal_assistant/providers/actions_provider.dart';
import 'package:personal_assistant/providers/screen_stream_provider.dart';
import 'package:personal_assistant/theme/gemini_theme.dart';
import 'package:personal_assistant/models/device_session.dart';

class TestAuthService implements AuthService {
  bool biometricEnabled = true;
  bool shouldAuthPass = true;
  String? lastAuthReason;
  int authCallCount = 0;

  @override
  Future<bool> authenticateWithBiometrics({String reason = ''}) async {
    authCallCount++;
    lastAuthReason = reason;
    return shouldAuthPass;
  }

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

  @override
  Future<bool> isBiometricLockEnabled() async => biometricEnabled;

  @override
  Future<void> setBiometricLockEnabled(bool enabled) async {
    biometricEnabled = enabled;
  }
}

class TestHmacService implements HmacService {
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
  int getCurrentTimestamp() => 123456789;
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

class TestSocketService implements SocketService {
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
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;
  late TestAuthService authService;
  late TestHmacService hmacService;
  late TestSocketService socketService;
  late ConnectionProvider connProvider;
  late ChatProvider chatProvider;
  late ActionsProvider actionsProvider;
  late ScreenStreamProvider streamProvider;

  setUp(() {
    authService = TestAuthService();
    hmacService = TestHmacService();
    socketService = TestSocketService();

    connProvider = ConnectionProvider(
      authService: authService,
      hmacService: hmacService,
      socketService: socketService,
    );
    chatProvider = ChatProvider(
      socketService: socketService,
      connectionProvider: connProvider,
    );
    actionsProvider = ActionsProvider(
      socketService: socketService,
      connectionProvider: connProvider,
      hmacService: hmacService,
    );
    streamProvider = ScreenStreamProvider(
      socketService: socketService,
      connectionProvider: connProvider,
    );
  });

  tearDown(() {
    chatProvider.dispose();
  });

  Widget buildTestableWidget(Widget child) {
    return MultiProvider(
      providers: [
        Provider<AuthService>.value(value: authService),
        ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
        ChangeNotifierProvider<ChatProvider>.value(value: chatProvider),
        ChangeNotifierProvider<ActionsProvider>.value(value: actionsProvider),
        ChangeNotifierProvider<ScreenStreamProvider>.value(value: streamProvider),
      ],
      child: MaterialApp(
        theme: GeminiTheme.darkTheme,
        home: child,
      ),
    );
  }

  Future<void> simulateBackgroundAndResume(WidgetTester tester) async {
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(milliseconds: 100));

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.hidden);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
  }

  group('Biometric App Lock Flow & Persistence Tests', () {
    testWidgets('SettingsScreen loads enabled biometric lock and toggles OFF when authenticated',
        (tester) async {
      authService.biometricEnabled = true;
      authService.shouldAuthPass = true;

      await tester.pumpWidget(buildTestableWidget(SettingsScreen(authService: authService)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final switchFinder = find.byKey(const Key('biometric_lock_switch'));
      await tester.ensureVisible(switchFinder);
      expect(switchFinder, findsOneWidget);

      Switch switchWidget = tester.widget(switchFinder);
      expect(switchWidget.value, isTrue);

      // Toggle OFF
      await tester.tap(switchFinder);
      await tester.pumpAndSettle();

      expect(authService.authCallCount, equals(1));
      expect(authService.lastAuthReason, contains('confirm identity before disabling'));
      expect(authService.biometricEnabled, isFalse);

      switchWidget = tester.widget(switchFinder);
      expect(switchWidget.value, isFalse);
    });

    testWidgets('SettingsScreen keeps biometric lock ON if auth fails when toggling OFF',
        (tester) async {
      authService.biometricEnabled = true;
      authService.shouldAuthPass = false; // Auth fails

      await tester.pumpWidget(buildTestableWidget(SettingsScreen(authService: authService)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final switchFinder = find.byKey(const Key('biometric_lock_switch'));
      await tester.ensureVisible(switchFinder);
      await tester.tap(switchFinder);
      await tester.pumpAndSettle();

      expect(authService.authCallCount, equals(1));
      expect(authService.biometricEnabled, isTrue); // Stays ON

      final updatedWidget = tester.widget<Switch>(switchFinder);
      expect(updatedWidget.value, isTrue);
    });

    testWidgets('SettingsScreen toggles ON when authenticated', (tester) async {
      authService.biometricEnabled = false;
      authService.shouldAuthPass = true;

      await tester.pumpWidget(buildTestableWidget(SettingsScreen(authService: authService)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      final switchFinder = find.byKey(const Key('biometric_lock_switch'));
      await tester.ensureVisible(switchFinder);
      Switch switchWidget = tester.widget(switchFinder);
      expect(switchWidget.value, isFalse);

      // Toggle ON
      await tester.tap(switchFinder);
      await tester.pumpAndSettle();

      expect(authService.authCallCount, equals(1));
      expect(authService.lastAuthReason, contains('enable biometric app lock'));
      expect(authService.biometricEnabled, isTrue);

      switchWidget = tester.widget(switchFinder);
      expect(switchWidget.value, isTrue);
    });

    testWidgets('MainShell locks and prompts biometrics when resuming from background if lock enabled',
        (tester) async {
      authService.biometricEnabled = true;
      authService.shouldAuthPass = false; // Simulates user needing to tap unlock

      await tester.pumpWidget(buildTestableWidget(MainShell(authService: authService)));
      await tester.pump(const Duration(milliseconds: 300));

      // Initially chat screen is shown
      expect(find.byType(ChatScreen), findsOneWidget);

      // Simulate app backgrounded and resumed
      await simulateBackgroundAndResume(tester);

      // App content is hidden, lock screen is displayed
      expect(find.text('Personal Assistant Locked'), findsOneWidget);
      expect(find.byKey(const Key('biometric_resume_unlock_btn')), findsOneWidget);

      // User unlocks with successful biometrics
      authService.shouldAuthPass = true;
      await tester.tap(find.byKey(const Key('biometric_resume_unlock_btn')));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));

      // App is unlocked, ChatScreen restored
      expect(find.text('Personal Assistant Locked'), findsNothing);
      expect(find.byType(ChatScreen), findsOneWidget);
    });

    testWidgets('MainShell does not lock on resume if biometric app lock is disabled',
        (tester) async {
      authService.biometricEnabled = false;

      await tester.pumpWidget(buildTestableWidget(MainShell(authService: authService)));
      await tester.pump(const Duration(milliseconds: 300));

      // Simulate background and resume
      await simulateBackgroundAndResume(tester);

      expect(find.text('Personal Assistant Locked'), findsNothing);
      expect(find.byType(ChatScreen), findsOneWidget);
    });
  });
}
