import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../providers/connection_provider.dart';
import '../providers/chat_provider.dart';
import '../providers/screen_stream_provider.dart';
import '../services/auth_service.dart';
import '../theme/gemini_theme.dart';
import '../widgets/gemini_gradient_bar.dart';
import '../widgets/killswitch_button.dart';
import 'chat_screen.dart';
import 'actions_screen.dart';
import 'screen_stream_view.dart';
import 'settings_screen.dart';
import 'scan_screen.dart';

class MainShell extends StatefulWidget {
  final Widget? chatScreen;
  final Widget? actionsScreen;
  final Widget? streamScreen;
  final Widget? settingsScreen;
  final VoidCallback? onEmergencyKillswitch;
  final VoidCallback? onStreamTabDeactivated;
  final bool? isConnected;
  final String? hostName;
  final AuthService? authService;

  const MainShell({
    super.key,
    this.chatScreen,
    this.actionsScreen,
    this.streamScreen,
    this.settingsScreen,
    this.onEmergencyKillswitch,
    this.onStreamTabDeactivated,
    this.isConnected,
    this.hostName,
    this.authService,
  });

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _currentIndex = 0;
  bool _isLocked = false;
  bool _isAuthenticating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      try {
        context.read<ChatProvider>().updateChatScreenActive(_currentIndex == 0);
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  AuthService? _getAuthService() {
    if (widget.authService != null) return widget.authService;
    try {
      return context.read<AuthService>();
    } catch (_) {
      try {
        return context.read<ConnectionProvider>().authService;
      } catch (_) {
        return null;
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // Auto-halt stream on background/paused
      _haltStream();
      try {
        context.read<ChatProvider>().updateAppInBackground(true);
      } catch (_) {}
    } else if (state == AppLifecycleState.resumed) {
      try {
        context.read<ChatProvider>().updateAppInBackground(false);
      } catch (_) {}
      _checkBiometricLockOnResume();
    }
  }

  Future<void> _checkBiometricLockOnResume() async {
    if (_isAuthenticating) return;
    final auth = _getAuthService();
    if (auth == null) return;

    try {
      final isEnabled = await auth.isBiometricLockEnabled();
      if (!isEnabled) return;

      if (mounted) {
        setState(() {
          _isLocked = true;
        });
      }

      await _promptBiometricUnlock();
    } catch (_) {}
  }

  Future<void> _promptBiometricUnlock() async {
    if (_isAuthenticating) return;
    _isAuthenticating = true;
    final auth = _getAuthService();
    if (auth == null) {
      _isAuthenticating = false;
      return;
    }

    try {
      final passed = await auth.authenticateWithBiometrics(
        reason: 'Authenticate to resume Personal Assistant',
      );
      if (mounted) {
        setState(() {
          _isLocked = !passed;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLocked = true;
        });
      }
    } finally {
      _isAuthenticating = false;
    }
  }

  void _haltStream() {
    try {
      context.read<ScreenStreamProvider>().onAppPaused();
    } catch (_) {}
    if (widget.onStreamTabDeactivated != null) {
      widget.onStreamTabDeactivated!();
    }
  }

  void _onNavigationTabTapped(int index) {
    if (_currentIndex == index) return;
    HapticFeedback.selectionClick();
    if (_currentIndex == 2 && index != 2) {
      // Deactivating Screen tab
      _haltStream();
    }
    setState(() => _currentIndex = index);
    try {
      context.read<ChatProvider>().updateChatScreenActive(index == 0);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_isLocked) {
      return Scaffold(
        backgroundColor: GeminiColors.canvas,
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.fingerprint, color: GeminiColors.primary, size: 64),
              const SizedBox(height: 16),
              const Text(
                'Personal Assistant Locked',
                style: TextStyle(
                  color: GeminiColors.textHeading,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Biometric authentication required to access app.',
                style: TextStyle(color: GeminiColors.textSecondary, fontSize: 13),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                key: const Key('biometric_resume_unlock_btn'),
                onPressed: _promptBiometricUnlock,
                icon: const Icon(Icons.lock_open, color: GeminiColors.canvas),
                label: const Text('Unlock', style: TextStyle(color: GeminiColors.canvas, fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(backgroundColor: GeminiColors.primary),
              ),
            ],
          ),
        ),
      );
    }

    ConnectionProvider? conn;
    try {
      conn = context.watch<ConnectionProvider>();
    } catch (_) {}

    final effectiveConnected = widget.isConnected ?? conn?.isConnected ?? false;
    final effectiveHostName = widget.hostName ?? conn?.session?.hostName ?? (effectiveConnected ? 'PC Host' : 'Offline');

    final screens = [
      widget.chatScreen ?? const ChatScreen(),
      widget.actionsScreen ?? const ActionsScreen(),
      widget.streamScreen ?? const StreamScreen(),
      widget.settingsScreen ?? const SettingsScreen(),
    ];

    TextStyle titleStyle;
    try {
      titleStyle = GoogleFonts.inter(
        color: GeminiColors.textHeading,
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
      );
    } catch (_) {
      titleStyle = const TextStyle(
        color: GeminiColors.textHeading,
        fontSize: 16,
        fontWeight: FontWeight.w600,
        letterSpacing: -0.2,
      );
    }

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      appBar: AppBar(
        backgroundColor: GeminiColors.surfaceContainer,
        elevation: 0,
        scrolledUnderElevation: 0,
        titleSpacing: 16,
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                color: GeminiColors.primary.withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.auto_awesome,
                color: GeminiColors.primary,
                size: 18,
              ),
            ),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                'Personal Assistant',
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                softWrap: false,
                style: titleStyle,
              ),
            ),
          ],
        ),
        actions: [
          _buildStatusPill(context, effectiveConnected, effectiveHostName, conn),
          const SizedBox(width: 8),
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: KillswitchButton(onTriggered: widget.onEmergencyKillswitch),
          ),
        ],
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(3),
          child: GeminiGradientBar(value: 1.0, height: 3),
        ),
      ),
      body: IndexedStack(
        index: _currentIndex,
        children: screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: GeminiColors.surfaceContainer,
          border: const Border(
            top: BorderSide(color: GeminiColors.border, width: 1),
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.5),
              blurRadius: 12,
              offset: const Offset(0, -3),
            ),
          ],
        ),
        child: SafeArea(
          top: false,
          child: NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: GeminiColors.surfaceContainer,
              height: 64,
              elevation: 0,
              indicatorColor: GeminiColors.primary.withOpacity(0.16),
              indicatorShape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: GeminiColors.primary.withOpacity(0.25), width: 1),
              ),
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return const TextStyle(
                    color: GeminiColors.primary,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  );
                }
                return const TextStyle(
                  color: GeminiColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w400,
                );
              }),
              iconTheme: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return const IconThemeData(color: GeminiColors.primary, size: 22);
                }
                return const IconThemeData(color: GeminiColors.textSecondary, size: 22);
              }),
            ),
            child: NavigationBar(
              selectedIndex: _currentIndex,
              onDestinationSelected: _onNavigationTabTapped,
              animationDuration: const Duration(milliseconds: 300),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.chat_bubble_outline_rounded),
                  selectedIcon: Icon(Icons.chat_bubble_rounded),
                  label: 'Chat',
                ),
                NavigationDestination(
                  icon: Icon(Icons.tune_rounded),
                  selectedIcon: Icon(Icons.tune_rounded),
                  label: 'Actions',
                ),
                NavigationDestination(
                  icon: Icon(Icons.desktop_windows_outlined),
                  selectedIcon: Icon(Icons.desktop_windows_rounded),
                  label: 'Screen',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  selectedIcon: Icon(Icons.settings_rounded),
                  label: 'Settings',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusPill(
    BuildContext context,
    bool connected,
    String hostName,
    ConnectionProvider? conn,
  ) {
    final dotColor = connected ? GeminiColors.success : GeminiColors.emergencyDanger;
    final statusText = connected ? 'Online' : 'Pair';

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.lightImpact();
          if (!connected) {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ScanScreen()),
            );
          } else {
            ScaffoldMessenger.of(context).hideCurrentSnackBar();
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(
                  'Connected to $hostName via ${conn?.activeTransport ?? "LAN"}',
                  style: const TextStyle(color: GeminiColors.textBody, fontSize: 13),
                ),
                backgroundColor: GeminiColors.surfaceContainer,
                duration: const Duration(seconds: 2),
                behavior: SnackBarBehavior.floating,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: GeminiColors.border),
                ),
              ),
            );
          }
        },
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          decoration: BoxDecoration(
            color: GeminiColors.elevatedCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: connected
                  ? GeminiColors.success.withOpacity(0.35)
                  : GeminiColors.border,
              width: 1,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                  boxShadow: connected
                      ? [
                          BoxShadow(
                            color: GeminiColors.success.withOpacity(0.6),
                            blurRadius: 4,
                            spreadRadius: 1,
                          ),
                        ]
                      : null,
                ),
              ),
              const SizedBox(width: 5),
              Text(
                statusText,
                style: TextStyle(
                  color: connected ? GeminiColors.textBody : GeminiColors.textSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.1,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
