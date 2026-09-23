import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/actions_provider.dart';
import '../theme/gemini_theme.dart';

class KillswitchButton extends StatelessWidget {
  final VoidCallback? onTriggered;

  const KillswitchButton({super.key, this.onTriggered});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      key: const Key('killswitch_btn'),
      onPressed: () => _confirmKillswitch(context),
      icon: const Icon(Icons.lock_outline, size: 16, color: GeminiColors.canvas),
      label: const Text(
        'Lock PC',
        style: TextStyle(
          color: GeminiColors.canvas,
          fontWeight: FontWeight.bold,
          fontSize: 12,
        ),
      ),
      style: ElevatedButton.styleFrom(
        backgroundColor: GeminiColors.emergencyDanger,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 0,
      ),
    );
  }

  void _confirmKillswitch(BuildContext context) {
    if (onTriggered != null) {
      onTriggered!();
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: GeminiColors.surfaceContainer,
        title: const Text('Emergency Killswitch', style: TextStyle(color: GeminiColors.emergencyDanger)),
        content: const Text(
          'This will immediately lock your Windows desktop and revoke this mobile session. Proceed?',
          style: TextStyle(color: GeminiColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Cancel', style: TextStyle(color: GeminiColors.textMuted)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              try {
                context.read<ActionsProvider>().triggerEmergencyKillswitch();
              } catch (_) {}
            },
            style: ElevatedButton.styleFrom(backgroundColor: GeminiColors.emergencyDanger),
            child: const Text('Lock Workstation Now', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}
