import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/connection_provider.dart';
import '../providers/actions_provider.dart';
import '../providers/screen_stream_provider.dart';
import '../theme/gemini_theme.dart';
import '../widgets/gemini_gradient_bar.dart';
import '../widgets/killswitch_button.dart';
import 'chat_screen.dart';
import 'actions_screen.dart';
import 'screen_stream_view.dart';
import 'settings_screen.dart';

class MainShell extends StatefulWidget {
  final Widget? chatScreen;
  final Widget? actionsScreen;
  final Widget? streamScreen;
  final Widget? settingsScreen;
  final VoidCallback? onEmergencyKillswitch;
  final VoidCallback? onStreamTabDeactivated;
  final bool? isConnected;
  final String? hostName;

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
  });

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> with WidgetsBindingObserver {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // Auto-halt stream on background/paused
      _haltStream();
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
    if (_currentIndex == 2 && index != 2) {
      // Deactivating Screen tab
      _haltStream();
    }
    setState(() => _currentIndex = index);
  }

  @override
  Widget build(BuildContext context) {
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

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      appBar: AppBar(
        backgroundColor: GeminiColors.surfaceContainer,
        elevation: 0,
        titleSpacing: 16,
        title: Row(
          children: [
            const Icon(Icons.auto_awesome, color: GeminiColors.primary, size: 22),
            const SizedBox(width: 8),
            const Text(
              'Personal Assistant',
              style: TextStyle(
                color: GeminiColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 10),
            _buildConnectionBadge(effectiveConnected, effectiveHostName, conn?.activeTransport ?? 'LAN'),
          ],
        ),
        actions: [
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
        decoration: const BoxDecoration(
          color: GeminiColors.surfaceContainer,
          border: Border(
            top: BorderSide(color: GeminiColors.border, width: 1),
          ),
        ),
        child: NavigationBar(
          selectedIndex: _currentIndex,
          onDestinationSelected: _onNavigationTabTapped,
          backgroundColor: GeminiColors.surfaceContainer,
          indicatorColor: const Color(0x287DACF8), // Subtle #7DACF8 pill highlight
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.chat_bubble_outline),
              selectedIcon: Icon(Icons.chat_bubble, color: GeminiColors.primary),
              label: 'Chat',
            ),
            NavigationDestination(
              icon: Icon(Icons.tune_outlined),
              selectedIcon: Icon(Icons.tune, color: GeminiColors.primary),
              label: 'Actions',
            ),
            NavigationDestination(
              icon: Icon(Icons.desktop_windows_outlined),
              selectedIcon: Icon(Icons.desktop_windows, color: GeminiColors.primary),
              label: 'Screen',
            ),
            NavigationDestination(
              icon: Icon(Icons.settings_outlined),
              selectedIcon: Icon(Icons.settings, color: GeminiColors.primary),
              label: 'Settings',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildConnectionBadge(bool connected, String hostName, String transport) {
    final dotColor = connected ? GeminiColors.success : GeminiColors.emergencyDanger;
    final label = connected ? '$hostName • $transport' : hostName;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: GeminiColors.elevatedCard,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: GeminiColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: const TextStyle(color: GeminiColors.textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
