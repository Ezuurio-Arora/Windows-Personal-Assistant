import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/connection_provider.dart';
import '../providers/actions_provider.dart';
import '../services/auth_service.dart';
import '../theme/gemini_theme.dart';

class SettingsScreen extends StatefulWidget {
  final AuthService? authService;

  const SettingsScreen({super.key, this.authService});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _biometricLockEnabled = true;
  bool _isAuthenticating = false;

  @override
  void initState() {
    super.initState();
    _loadBiometricLockState();
  }

  AuthService _getAuthService() {
    if (widget.authService != null) return widget.authService!;
    try {
      return context.read<AuthService>();
    } catch (_) {
      return context.read<ConnectionProvider>().authService;
    }
  }

  Future<void> _loadBiometricLockState() async {
    try {
      final auth = _getAuthService();
      final enabled = await auth.isBiometricLockEnabled();
      if (mounted) {
        setState(() {
          _biometricLockEnabled = enabled;
        });
      }
    } catch (_) {}
  }

  Future<void> _handleBiometricToggle(bool value) async {
    if (_isAuthenticating) return;
    _isAuthenticating = true;

    try {
      try {
        HapticFeedback.selectionClick();
      } catch (_) {}
      final auth = _getAuthService();

      if (value) {
        // Toggled ON: authenticate to enable
        final passed = await auth.authenticateWithBiometrics(
          reason: 'Authenticate to enable biometric app lock',
        );
        if (passed) {
          await auth.setBiometricLockEnabled(true);
          if (mounted) {
            setState(() => _biometricLockEnabled = true);
          }
        } else {
          // Cancelled/failed, keep OFF
          if (mounted) {
            setState(() => _biometricLockEnabled = false);
          }
        }
      } else {
        // Toggled OFF: prompt biometrics first to confirm identity before disabling
        final passed = await auth.authenticateWithBiometrics(
          reason: 'Authenticate to confirm identity before disabling biometric lock',
        );
        if (passed) {
          await auth.setBiometricLockEnabled(false);
          if (mounted) {
            setState(() => _biometricLockEnabled = false);
          }
        } else {
          // Cancelled/failed, keep ON
          if (mounted) {
            setState(() => _biometricLockEnabled = true);
          }
        }
      }
    } finally {
      _isAuthenticating = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final conn = context.watch<ConnectionProvider>();
    final session = conn.session;

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Device & Session Information',
            style: TextStyle(
              color: GeminiColors.textHeading,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 12),

          // Pairing status card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: GeminiColors.surfaceContainer,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: GeminiColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.25),
                  blurRadius: 12,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Paired Host PC',
                      style: TextStyle(color: GeminiColors.textSecondary, fontSize: 13),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: conn.isConnected
                            ? GeminiColors.success.withOpacity(0.15)
                            : GeminiColors.emergencyDanger.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: conn.isConnected
                              ? GeminiColors.success.withOpacity(0.3)
                              : GeminiColors.emergencyDanger.withOpacity(0.3),
                        ),
                      ),
                      child: Text(
                        conn.isConnected ? 'CONNECTED' : 'DISCONNECTED',
                        style: TextStyle(
                          color: conn.isConnected
                              ? GeminiColors.success
                              : GeminiColors.emergencyDanger,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  session?.hostName ?? 'No paired host',
                  style: const TextStyle(
                    color: GeminiColors.textHeading,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 14),
                const Divider(color: GeminiColors.border, height: 1),
                const SizedBox(height: 10),
                _buildInfoRow('LAN Host IP', session?.lanIp ?? 'None'),
                _buildInfoRow('Port', '${session?.port ?? 42000}'),
                _buildInfoRow('Active Transport', conn.activeTransport),
                _buildInfoRow('Safety Mode', session?.safetyMode ?? 'tiered'),
                _buildInfoRow('Device ID', session?.deviceId ?? 'Unassigned'),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Security Settings
          const Text(
            'Security & Keystore',
            style: TextStyle(
              color: GeminiColors.textHeading,
              fontSize: 18,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: GeminiColors.surfaceContainer,
              borderRadius: BorderRadius.circular(28),
              border: Border.all(color: GeminiColors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.25),
                  blurRadius: 12,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              children: [
                ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                  leading: const Icon(Icons.fingerprint_rounded, color: GeminiColors.primary),
                  title: const Text(
                    'Biometric App Lock',
                    style: TextStyle(color: GeminiColors.textHeading, fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  subtitle: const Text(
                    'Require fingerprint or device PIN on launch/resume',
                    style: TextStyle(color: GeminiColors.textSecondary, fontSize: 12),
                  ),
                  trailing: Switch(
                    key: const Key('biometric_lock_switch'),
                    value: _biometricLockEnabled,
                    onChanged: _handleBiometricToggle,
                    activeThumbColor: GeminiColors.primary,
                  ),
                ),
                const Divider(color: GeminiColors.border, height: 1),
                const ListTile(
                  contentPadding: EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                  leading: Icon(Icons.lock_clock_rounded, color: GeminiColors.primary),
                  title: Text(
                    'HMAC Mutual Authentication',
                    style: TextStyle(color: GeminiColors.textHeading, fontSize: 14, fontWeight: FontWeight.w500),
                  ),
                  subtitle: Text(
                    'SHA-256 frame-level envelope with 60s replay window',
                    style: TextStyle(color: GeminiColors.textSecondary, fontSize: 12),
                  ),
                  trailing: Icon(Icons.check_circle_rounded, color: GeminiColors.success, size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Action Buttons: Disconnect / Unpair & Emergency Killswitch
          ElevatedButton.icon(
            onPressed: () async {
              HapticFeedback.lightImpact();
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: GeminiColors.surfaceContainer,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(28),
                    side: const BorderSide(color: GeminiColors.border),
                  ),
                  title: const Text('Unpair Device', style: TextStyle(color: GeminiColors.textHeading, fontWeight: FontWeight.bold)),
                  content: const Text(
                    'Unpairing will revoke your session token and restore the dynamic QR code on the desktop Hub.',
                    style: TextStyle(color: GeminiColors.textBody),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        Navigator.of(ctx).pop(false);
                      },
                      child: const Text('Cancel', style: TextStyle(color: GeminiColors.textSecondary)),
                    ),
                    ElevatedButton(
                      onPressed: () {
                        HapticFeedback.lightImpact();
                        Navigator.of(ctx).pop(true);
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: GeminiColors.emergencyDanger,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Unpair & Disconnect', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              );

              if (confirm == true) {
                await conn.disconnect(userInitiated: true);
              }
            },
            icon: const Icon(Icons.link_off_rounded, color: GeminiColors.emergencyDanger),
            label: const Text(
              'Unpair & Disconnect from PC',
              style: TextStyle(color: GeminiColors.emergencyDanger, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: GeminiColors.elevatedCard,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(28),
                side: const BorderSide(color: GeminiColors.border),
              ),
              elevation: 0,
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () {
              HapticFeedback.lightImpact();
              context.read<ActionsProvider>().triggerEmergencyKillswitch();
            },
            icon: const Icon(Icons.lock_rounded, color: Colors.white),
            label: const Text(
              'Lock PC & Sever Session (Emergency)',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: GeminiColors.emergencyDanger,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: GeminiColors.textSecondary, fontSize: 13)),
          Text(
            value,
            style: const TextStyle(
              color: GeminiColors.textHeading,
              fontWeight: FontWeight.w500,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
