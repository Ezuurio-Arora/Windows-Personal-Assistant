import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/connection_provider.dart';
import '../providers/actions_provider.dart';
import '../theme/gemini_theme.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

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
              color: GeminiColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),

          // Pairing status card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: GeminiColors.surfaceContainer,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: GeminiColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Paired Host PC',
                      style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: conn.isConnected
                            ? GeminiColors.success.withOpacity(0.15)
                            : GeminiColors.emergencyDanger.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        conn.isConnected ? 'CONNECTED' : 'DISCONNECTED',
                        style: TextStyle(
                          color: conn.isConnected
                              ? GeminiColors.success
                              : GeminiColors.emergencyDanger,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  session?.hostName ?? 'No paired host',
                  style: const TextStyle(
                    color: GeminiColors.textPrimary,
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                const Divider(color: GeminiColors.border),
                const SizedBox(height: 8),
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
              color: GeminiColors.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            decoration: BoxDecoration(
              color: GeminiColors.surfaceContainer,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: GeminiColors.border),
            ),
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.fingerprint, color: GeminiColors.primary),
                  title: const Text(
                    'Biometric App Lock',
                    style: TextStyle(color: GeminiColors.textPrimary, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Require fingerprint or device PIN on launch/resume',
                    style: TextStyle(color: GeminiColors.textMuted, fontSize: 12),
                  ),
                  trailing: Switch(
                    value: true,
                    onChanged: (val) {},
                    activeColor: GeminiColors.primary,
                  ),
                ),
                const Divider(color: GeminiColors.border, height: 1),
                ListTile(
                  leading: const Icon(Icons.lock_clock, color: GeminiColors.primary),
                  title: const Text(
                    'HMAC Mutual Authentication',
                    style: TextStyle(color: GeminiColors.textPrimary, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'SHA-256 frame-level envelope with 60s replay window',
                    style: TextStyle(color: GeminiColors.textMuted, fontSize: 12),
                  ),
                  trailing: const Icon(Icons.check_circle, color: GeminiColors.success, size: 20),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Action Buttons: Disconnect / Unpair & Emergency Killswitch
          ElevatedButton.icon(
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  backgroundColor: GeminiColors.surfaceContainer,
                  title: const Text('Unpair Device', style: TextStyle(color: GeminiColors.textPrimary)),
                  content: const Text(
                    'Unpairing will revoke your session token and restore the dynamic QR code on the desktop Hub.',
                    style: TextStyle(color: GeminiColors.textMuted),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(false),
                      child: const Text('Cancel', style: TextStyle(color: GeminiColors.textMuted)),
                    ),
                    ElevatedButton(
                      onPressed: () => Navigator.of(ctx).pop(true),
                      style: ElevatedButton.styleFrom(backgroundColor: GeminiColors.emergencyDanger),
                      child: const Text('Unpair & Disconnect', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );

              if (confirm == true) {
                await conn.disconnect(userInitiated: true);
              }
            },
            icon: const Icon(Icons.link_off, color: GeminiColors.emergencyDanger),
            label: const Text(
              'Unpair & Disconnect from PC',
              style: TextStyle(color: GeminiColors.emergencyDanger, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: GeminiColors.elevatedCard,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: GeminiColors.border),
              ),
              elevation: 0,
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            onPressed: () => context.read<ActionsProvider>().triggerEmergencyKillswitch(),
            icon: const Icon(Icons.lock, color: Colors.white),
            label: const Text(
              'Lock PC & Sever Session (Emergency)',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: GeminiColors.emergencyDanger,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 0,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: GeminiColors.textMuted, fontSize: 13)),
          Text(
            value,
            style: const TextStyle(
              color: GeminiColors.textPrimary,
              fontWeight: FontWeight.w500,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}
