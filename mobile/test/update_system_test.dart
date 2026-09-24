import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import 'package:personal_assistant/models/device_session.dart';
import 'package:personal_assistant/providers/connection_provider.dart';
import 'package:personal_assistant/providers/actions_provider.dart';
import 'package:personal_assistant/providers/chat_provider.dart';
import 'package:personal_assistant/providers/screen_stream_provider.dart';
import 'package:personal_assistant/providers/update_provider.dart';
import 'package:personal_assistant/services/auth_service.dart';
import 'package:personal_assistant/services/hmac_service.dart';
import 'package:personal_assistant/services/socket_service.dart';
import 'package:personal_assistant/services/update_service.dart';
import 'package:personal_assistant/screens/main_shell.dart';
import 'package:personal_assistant/screens/settings_screen.dart';
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

class MockHttpHandler extends http.BaseClient {
  final Future<http.StreamedResponse> Function(http.BaseRequest request) handler;

  MockHttpHandler(this.handler);

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) => handler(request);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppVersionInfo Model Tests', () {
    test('parses from standard JSON correctly', () {
      final json = {
        'version': '1.1.0',
        'versionCode': 2,
        'apkUrl': 'http://192.168.10.139:42000/api/app/download',
        'releaseNotes': 'New features and UI improvements',
        'fileSize': 15000000,
      };

      final info = AppVersionInfo.fromJson(json);
      expect(info.version, '1.1.0');
      expect(info.versionCode, 2);
      expect(info.apkUrl, 'http://192.168.10.139:42000/api/app/download');
      expect(info.releaseNotes, 'New features and UI improvements');
      expect(info.fileSize, 15000000);
      expect(info.toJson()['version'], '1.1.0');
    });

    test('parses fallback JSON keys gracefully', () {
      final json = {
        'versionName': '1.2.0',
        'buildNumber': '3',
        'downloadUrl': '/api/app/update.apk',
        'changelog': 'Bug fixes',
      };

      final info = AppVersionInfo.fromJson(json);
      expect(info.version, '1.2.0');
      expect(info.versionCode, 3);
      expect(info.apkUrl, '/api/app/update.apk');
      expect(info.releaseNotes, 'Bug fixes');
    });

    test('copyWith creates modified copy', () {
      const original = AppVersionInfo(
        version: '1.0.0',
        versionCode: 1,
        apkUrl: 'http://test.com/app.apk',
      );

      final modified = original.copyWith(version: '1.1.0', versionCode: 2);
      expect(modified.version, '1.1.0');
      expect(modified.versionCode, 2);
      expect(modified.apkUrl, 'http://test.com/app.apk');
    });
  });

  group('UpdateService Tests', () {
    test('checkForUpdate returns AppVersionInfo when newer versionCode available', () async {
      final mockClient = MockHttpHandler((req) async {
        if (req.url.path == '/api/app/version') {
          final body = jsonEncode({
            'version': '1.1.0',
            'versionCode': 2,
            'apkUrl': '/api/app/personal_assistant.apk',
            'releaseNotes': 'Desktop Hub companion update',
          });
          return http.StreamedResponse(
            Stream.value(utf8.encode(body)),
            200,
            headers: {'content-type': 'application/json'},
          );
        }
        return http.StreamedResponse(Stream.value([]), 404);
      });

      final service = UpdateService(httpClient: mockClient);
      final update = await service.checkForUpdate('192.168.10.139:42000', 1);

      expect(update, isNotNull);
      expect(update!.version, '1.1.0');
      expect(update.versionCode, 2);
      // Verify relative URL was resolved against host
      expect(update.apkUrl, 'http://192.168.10.139:42000/api/app/personal_assistant.apk');
      expect(update.releaseNotes, 'Desktop Hub companion update');
    });

    test('checkForUpdate returns null when version is not newer', () async {
      final mockClient = MockHttpHandler((req) async {
        final body = jsonEncode({
          'version': '1.0.0',
          'versionCode': 1,
          'apkUrl': 'http://192.168.10.139:42000/api/app/download',
        });
        return http.StreamedResponse(Stream.value(utf8.encode(body)), 200);
      });

      final service = UpdateService(httpClient: mockClient);
      final update = await service.checkForUpdate('192.168.10.139:42000', 1);

      expect(update, isNull);
    });

    test('downloadAndInstallUpdate streams file and invokes MethodChannel', () async {
      final fileBytes = List<int>.generate(1024, (i) => i % 256);
      final mockClient = MockHttpHandler((req) async {
        return http.StreamedResponse(
          Stream.value(fileBytes),
          200,
          contentLength: fileBytes.length,
        );
      });

      String? invokedMethod;
      dynamic invokedArguments;

      const channel = MethodChannel(UpdateService.channelName);
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (MethodCall call) async {
        invokedMethod = call.method;
        invokedArguments = call.arguments;
        return true;
      });

      final service = UpdateService(httpClient: mockClient);
      final List<double> progressReports = [];

      final downloadedFile = await service.downloadAndInstallUpdate(
        'http://192.168.10.139:42000/api/app/download',
        (progress) => progressReports.add(progress),
      );

      expect(await downloadedFile.exists(), isTrue);
      expect(await downloadedFile.length(), equals(1024));
      expect(progressReports, contains(1.0));
      expect(invokedMethod, equals('installApk'));
      expect(invokedArguments, isA<Map>());
      expect(invokedArguments['filePath'], contains('update_personal_assistant.apk'));
    });
  });

  group('UpdateProvider Tests', () {
    test('checkUpdateFromHost updates state when update is available', () async {
      final mockClient = MockHttpHandler((req) async {
        final body = jsonEncode({
          'version': '1.1.0',
          'versionCode': 2,
          'apkUrl': 'http://192.168.10.139:42000/api/app/download',
          'releaseNotes': 'New update ready',
        });
        return http.StreamedResponse(Stream.value(utf8.encode(body)), 200);
      });

      final service = UpdateService(httpClient: mockClient);
      final provider = UpdateProvider(updateService: service, currentVersionCode: 1);

      expect(provider.isUpdateAvailable, isFalse);
      expect(provider.latestVersion, isNull);

      await provider.checkUpdateFromHost('192.168.10.139', 42000);

      expect(provider.isUpdateAvailable, isTrue);
      expect(provider.latestVersion?.version, '1.1.0');
      expect(provider.errorMessage, isNull);
    });

    test('startUpdate sets downloading state and notifies progress', () async {
      final fileBytes = List<int>.generate(500, (i) => i % 256);
      final mockClient = MockHttpHandler((req) async {
        return http.StreamedResponse(
          Stream.value(fileBytes),
          200,
          contentLength: fileBytes.length,
        );
      });

      final service = UpdateService(httpClient: mockClient);
      final provider = UpdateProvider(updateService: service, currentVersionCode: 1);

      provider.setUpdateAvailable(
        const AppVersionInfo(
          version: '1.1.0',
          versionCode: 2,
          apkUrl: 'http://192.168.10.139:42000/api/app/download',
        ),
      );

      final future = provider.startUpdate();
      await future;

      expect(provider.isDownloading, isFalse);
      expect(provider.downloadProgress, 1.0);
    });
  });

  group('MainShell Update Banner UI Integration Tests', () {
    late MockAuthService authService;
    late MockHmacService hmacService;
    late MockSocketService socketService;
    late ConnectionProvider connProvider;
    late ChatProvider chatProvider;
    late ActionsProvider actionsProvider;
    late ScreenStreamProvider streamProvider;
    late UpdateProvider updateProvider;

    setUp(() {
      authService = MockAuthService();
      hmacService = MockHmacService();
      socketService = MockSocketService();

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
      updateProvider = UpdateProvider();
    });

    testWidgets('Displays Google Gemini AMOLED update banner when connected and update available',
        (WidgetTester tester) async {
      updateProvider.setUpdateAvailable(
        const AppVersionInfo(
          version: '1.1.0',
          versionCode: 2,
          apkUrl: 'http://192.168.10.139:42000/api/app/download',
          releaseNotes: 'Performance boost and bug fixes',
        ),
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: chatProvider),
            ChangeNotifierProvider<ActionsProvider>.value(value: actionsProvider),
            ChangeNotifierProvider<ScreenStreamProvider>.value(value: streamProvider),
            ChangeNotifierProvider<UpdateProvider>.value(value: updateProvider),
          ],
          child: MaterialApp(
            theme: GeminiTheme.darkTheme,
            home: const MainShell(isConnected: true, hostName: 'Desktop Hub'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Check for sleek update pill banner
      expect(find.byKey(const Key('update_banner_pill')), findsOneWidget);
      expect(find.text('✨ Update v1.1.0 available from Desktop Hub'), findsOneWidget);
      expect(find.text('Install'), findsOneWidget);
    });

    testWidgets('Does not display update banner when offline or no update available',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
            ChangeNotifierProvider<ChatProvider>.value(value: chatProvider),
            ChangeNotifierProvider<ActionsProvider>.value(value: actionsProvider),
            ChangeNotifierProvider<ScreenStreamProvider>.value(value: streamProvider),
            ChangeNotifierProvider<UpdateProvider>.value(value: updateProvider),
          ],
          child: MaterialApp(
            theme: GeminiTheme.darkTheme,
            home: const MainShell(isConnected: false),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('update_banner_pill')), findsNothing);
    });
  });

  group('SettingsScreen Auto-Update Tile Tests', () {
    late MockAuthService authService;
    late MockHmacService hmacService;
    late MockSocketService socketService;
    late ConnectionProvider connProvider;
    late UpdateProvider updateProvider;

    setUp(() {
      authService = MockAuthService();
      hmacService = MockHmacService();
      socketService = MockSocketService();

      connProvider = ConnectionProvider(
        authService: authService,
        hmacService: hmacService,
        socketService: socketService,
      );
      updateProvider = UpdateProvider();
    });

    testWidgets('Renders Auto-Update from Desktop tile and handles Check for Updates tap',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
            ChangeNotifierProvider<UpdateProvider>.value(value: updateProvider),
          ],
          child: MaterialApp(
            theme: GeminiTheme.darkTheme,
            home: SettingsScreen(authService: authService),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify section heading and tile
      expect(find.text('Software Updates'), findsOneWidget);
      expect(find.text('Auto-Update from Desktop'), findsOneWidget);
      expect(find.text('Current version: 1.0.0 (Up to date)'), findsOneWidget);

      final checkBtn = find.byKey(const Key('check_updates_btn'));
      expect(checkBtn, findsOneWidget);

      // Tap Check for Updates
      await tester.tap(checkBtn);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    });

    testWidgets('Renders Install button and release notes when update available in Settings',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      updateProvider.setUpdateAvailable(
        const AppVersionInfo(
          version: '1.2.0',
          versionCode: 3,
          apkUrl: 'http://192.168.10.139:42000/api/app/download',
          releaseNotes: 'Exciting new voice synth engine.',
        ),
      );

      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<ConnectionProvider>.value(value: connProvider),
            ChangeNotifierProvider<UpdateProvider>.value(value: updateProvider),
          ],
          child: MaterialApp(
            theme: GeminiTheme.darkTheme,
            home: SettingsScreen(authService: authService),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('✨ Update v1.2.0 available from Desktop Hub'), findsOneWidget);
      expect(find.text('Exciting new voice synth engine.'), findsOneWidget);
      expect(find.byKey(const Key('install_update_settings_btn')), findsOneWidget);
    });
  });
}
