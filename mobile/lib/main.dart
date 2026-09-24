import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'theme/gemini_theme.dart';
import 'services/auth_service.dart';
import 'services/hmac_service.dart';
import 'services/socket_service.dart';
import 'services/notification_service.dart';
import 'services/update_service.dart';
import 'providers/connection_provider.dart';
import 'providers/chat_provider.dart';
import 'providers/actions_provider.dart';
import 'providers/screen_stream_provider.dart';
import 'providers/update_provider.dart';
import 'screens/main_shell.dart';
import 'screens/scan_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final authService = SecureAuthService();
  final hmacService = CryptoHmacService();
  final socketService = WebSocketChannelService(hmacService: hmacService);
  final notificationService = LocalNotificationService();
  await notificationService.initialize();
  final updateService = UpdateService();

  runApp(
    PersonalAssistantApp(
      authService: authService,
      hmacService: hmacService,
      socketService: socketService,
      notificationService: notificationService,
      updateService: updateService,
    ),
  );
}

class PersonalAssistantApp extends StatelessWidget {
  final AuthService authService;
  final HmacService hmacService;
  final SocketService socketService;
  final NotificationService? notificationService;
  final UpdateService? updateService;
  final UpdateProvider? updateProvider;

  const PersonalAssistantApp({
    super.key,
    required this.authService,
    required this.hmacService,
    required this.socketService,
    this.notificationService,
    this.updateService,
    this.updateProvider,
  });

  @override
  Widget build(BuildContext context) {
    final notif = notificationService ?? LocalNotificationService();
    final updater = updateService ?? UpdateService();

    return MultiProvider(
      providers: [
        Provider<AuthService>.value(value: authService),
        Provider<HmacService>.value(value: hmacService),
        Provider<SocketService>.value(value: socketService),
        Provider<NotificationService>.value(value: notif),
        Provider<UpdateService>.value(value: updater),
        ChangeNotifierProvider<ConnectionProvider>(
          create: (_) => ConnectionProvider(
            authService: authService,
            hmacService: hmacService,
            socketService: socketService,
          ),
        ),
        ChangeNotifierProvider<UpdateProvider>(
          create: (_) => updateProvider ?? UpdateProvider(updateService: updater),
        ),
        ChangeNotifierProxyProvider<ConnectionProvider, ChatProvider>(
          create: (ctx) => ChatProvider(
            socketService: socketService,
            connectionProvider: ctx.read<ConnectionProvider>(),
            notificationService: notif,
          ),
          update: (ctx, conn, previous) => previous ?? ChatProvider(
            socketService: socketService,
            connectionProvider: conn,
            notificationService: notif,
          ),
        ),
        ChangeNotifierProxyProvider<ConnectionProvider, ActionsProvider>(
          create: (ctx) => ActionsProvider(
            socketService: socketService,
            connectionProvider: ctx.read<ConnectionProvider>(),
            hmacService: hmacService,
          ),
          update: (ctx, conn, previous) => previous ?? ActionsProvider(
            socketService: socketService,
            connectionProvider: conn,
            hmacService: hmacService,
          ),
        ),
        ChangeNotifierProxyProvider<ConnectionProvider, ScreenStreamProvider>(
          create: (ctx) => ScreenStreamProvider(
            socketService: socketService,
            connectionProvider: ctx.read<ConnectionProvider>(),
          ),
          update: (ctx, conn, previous) => previous ?? ScreenStreamProvider(
            socketService: socketService,
            connectionProvider: conn,
          ),
        ),
      ],
      child: MaterialApp(
        title: 'Personal Assistant',
        debugShowCheckedModeBanner: false,
        theme: GeminiTheme.darkTheme,
        home: const AppRootGate(),
      ),
    );
  }
}

class AppRootGate extends StatefulWidget {
  const AppRootGate({super.key});

  @override
  State<AppRootGate> createState() => _AppRootGateState();
}

class _AppRootGateState extends State<AppRootGate> {
  bool _biometricPassed = false;
  bool _checkedBiometrics = false;

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
  }

  Future<void> _checkBiometrics() async {
    final auth = context.read<AuthService>();
    final hasSession = await auth.hasValidSession();
    final isLockEnabled = await auth.isBiometricLockEnabled();
    if (hasSession && isLockEnabled) {
      final passed = await auth.authenticateWithBiometrics(
        reason: 'Unlock Personal Assistant PC Companion',
      );
      if (mounted) {
        setState(() {
          _biometricPassed = passed;
          _checkedBiometrics = true;
        });
      }
    } else {
      if (mounted) {
        setState(() {
          _biometricPassed = true;
          _checkedBiometrics = true;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_checkedBiometrics) {
      return const Scaffold(
        backgroundColor: GeminiColors.canvas,
        body: Center(
          child: CircularProgressIndicator(color: GeminiColors.primary),
        ),
      );
    }

    if (!_biometricPassed) {
      return Scaffold(
        backgroundColor: GeminiColors.canvas,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.lock, color: GeminiColors.emergencyDanger, size: 64),
              const SizedBox(height: 16),
              const Text(
                'Biometric Authentication Required',
                style: TextStyle(color: GeminiColors.textPrimary, fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Authenticate with fingerprint or PIN to access PC control.',
                style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _checkBiometrics,
                icon: const Icon(Icons.fingerprint, color: GeminiColors.canvas),
                label: const Text('Unlock', style: TextStyle(color: GeminiColors.canvas)),
                style: ElevatedButton.styleFrom(backgroundColor: GeminiColors.primary),
              ),
            ],
          ),
        ),
      );
    }

    final conn = context.watch<ConnectionProvider>();
    if (conn.status == ConnectionStatus.unpaired || conn.status == ConnectionStatus.revoked) {
      return const MainShell(chatScreen: ScanScreen());
    }

    return const MainShell();
  }
}
