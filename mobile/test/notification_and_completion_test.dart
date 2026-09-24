import 'dart:async';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:personal_assistant/services/notification_service.dart';
import 'package:personal_assistant/services/auth_service.dart';
import 'package:personal_assistant/services/hmac_service.dart';
import 'package:personal_assistant/services/socket_service.dart';
import 'package:personal_assistant/providers/connection_provider.dart';
import 'package:personal_assistant/providers/chat_provider.dart';
import 'package:personal_assistant/models/device_session.dart';

class MockNotificationService implements NotificationService {
  int showCount = 0;
  String? lastTitle;
  String? lastBody;

  @override
  Future<void> initialize() async {}

  @override
  Future<void> showAiCompletionNotification({
    required String title,
    required String body,
  }) async {
    showCount++;
    lastTitle = title;
    lastBody = body;
  }
}

class FakeAuthService implements AuthService {
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
  @override
  Future<bool> isBiometricLockEnabled() async => true;
  @override
  Future<void> setBiometricLockEnabled(bool enabled) async {}
}

class FakeHmacService implements HmacService {
  @override
  Map<String, String> buildAuthHeaders({required String method, required String path, required String sessionToken, required String hmacSecret, String body = ''}) => {};
  @override
  Map<String, dynamic> buildWebSocketEnvelope({required String event, required dynamic data, required String sessionToken, required String hmacSecret}) => {};
  @override
  String generateNonce() => 'nonce';
  @override
  int getCurrentTimestamp() => 12345;
  @override
  String signHttpRequest({required String method, required String path, required int timestamp, required String nonce, required String body, required String secret}) => 'sig';
  @override
  bool verifySignature({required String signature, required String message, required String secret}) => true;
}

class FakeSocketService implements SocketService {
  final eventController = StreamController<Map<String, dynamic>>.broadcast();
  final binController = StreamController<Uint8List>.broadcast();
  final connController = StreamController<bool>.broadcast();

  @override
  Stream<Uint8List> get binaryStream => binController.stream;
  @override
  Stream<bool> get connectionStateStream => connController.stream;
  @override
  Stream<Map<String, dynamic>> get eventStream => eventController.stream;
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

  late FakeSocketService socketService;
  late MockNotificationService notificationService;
  late ConnectionProvider connectionProvider;
  late ChatProvider chatProvider;

  setUp(() {
    socketService = FakeSocketService();
    notificationService = MockNotificationService();
    connectionProvider = ConnectionProvider(
      authService: FakeAuthService(),
      hmacService: FakeHmacService(),
      socketService: socketService,
    );
    chatProvider = ChatProvider(
      socketService: socketService,
      connectionProvider: connectionProvider,
      notificationService: notificationService,
    );
  });

  tearDown(() {
    chatProvider.dispose();
  });

  group('Background AI Completion Notifications & Haptics', () {
    test('Does NOT show notification when user is actively viewing chat screen in foreground', () async {
      chatProvider.updateAppInBackground(false);
      chatProvider.updateChatScreenActive(true);

      // Assistant streams message
      socketService.eventController.add({
        'event': 'message:token',
        'data': {
          'messageId': 'msg_1',
          'fullContent': 'Task complete! Generated financial summary.',
        },
      });
      await Future.delayed(const Duration(milliseconds: 20));

      // AI generation completes
      socketService.eventController.add({
        'event': 'agent:complete',
        'data': {
          'summary': 'Generated financial summary.',
        },
      });
      await Future.delayed(const Duration(milliseconds: 20));

      expect(notificationService.showCount, equals(0));
    });

    test('Shows notification when app is in background upon agent:complete', () async {
      chatProvider.updateAppInBackground(true); // App in background!
      chatProvider.updateChatScreenActive(true);

      socketService.eventController.add({
        'event': 'message:token',
        'data': {
          'messageId': 'msg_2',
          'fullContent': 'Downloaded all requested files successfully.',
        },
      });
      await Future.delayed(const Duration(milliseconds: 20));

      socketService.eventController.add({
        'event': 'agent:complete',
        'data': {
          'summary': 'Downloaded all requested files successfully.',
        },
      });
      await Future.delayed(const Duration(milliseconds: 20));

      expect(notificationService.showCount, equals(1));
      expect(notificationService.lastTitle, equals('Personal Assistant'));
      expect(notificationService.lastBody, equals('Downloaded all requested files successfully.'));
    });

    test('Shows notification when user is on another screen (e.g. Settings/Screen tab) upon agent:progress completed', () async {
      chatProvider.updateAppInBackground(false);
      chatProvider.updateChatScreenActive(false); // User navigated away from chat!

      socketService.eventController.add({
        'event': 'message:token',
        'data': {
          'messageId': 'msg_3',
          'fullContent': 'Organized desktop windows and closed idle browsers.',
        },
      });
      await Future.delayed(const Duration(milliseconds: 20));

      // Completion via progress event with stage completed
      socketService.eventController.add({
        'event': 'agent:progress',
        'data': {
          'stage': 'completed',
          'percent': 100,
          'label': 'Finished',
        },
      });
      await Future.delayed(const Duration(milliseconds: 20));

      expect(notificationService.showCount, equals(1));
      expect(notificationService.lastTitle, equals('Personal Assistant'));
      expect(notificationService.lastBody, equals('Organized desktop windows and closed idle browsers.'));
    });
  });
}
