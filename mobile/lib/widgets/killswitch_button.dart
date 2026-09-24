import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/actions_provider.dart';
import '../theme/gemini_theme.dart';

class KillswitchButton extends StatefulWidget {
  final VoidCallback? onTriggered;

  const KillswitchButton({super.key, this.onTriggered});

  @override
  State<KillswitchButton> createState() => _KillswitchButtonState();
}

class _KillswitchButtonState extends State<KillswitchButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    return AnimatedScale(
      scale: _isPressed ? 0.92 : 1.0,
      duration: const Duration(milliseconds: 100),
      curve: Curves.easeInOut,
      child: Material(
        key: const Key('killswitch_btn'),
        color: Colors.transparent,
        child: InkWell(
          onTapDown: (_) => setState(() => _isPressed = true),
          onTapUp: (_) => setState(() => _isPressed = false),
          onTapCancel: () => setState(() => _isPressed = false),
          onTap: () {
            HapticFeedback.lightImpact();
            _confirmKillswitch(context);
          },
          borderRadius: BorderRadius.circular(16),
          splashColor: GeminiColors.emergencyDanger.withOpacity(0.2),
          highlightColor: GeminiColors.emergencyDanger.withOpacity(0.1),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: GeminiColors.elevatedCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: GeminiColors.emergencyDanger.withOpacity(0.4),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: GeminiColors.emergencyDanger.withOpacity(0.12),
                  blurRadius: 8,
                  spreadRadius: 0,
                ),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.lock_rounded,
                  size: 13,
                  color: GeminiColors.emergencyDanger,
                ),
                SizedBox(width: 5),
                Text(
                  'Lock',
                  style: TextStyle(
                    color: GeminiColors.emergencyDanger,
                    fontWeight: FontWeight.w600,
                    fontSize: 11,
                    letterSpacing: 0.1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _confirmKillswitch(BuildContext context) {
    if (widget.onTriggered != null) {
      widget.onTriggered!();
      return;
    }

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: GeminiColors.surfaceContainer,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(28),
          side: const BorderSide(color: GeminiColors.border, width: 1),
        ),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: GeminiColors.emergencyDanger, size: 22),
            SizedBox(width: 8),
            Text(
              'Emergency Killswitch',
              style: TextStyle(
                color: GeminiColors.emergencyDanger,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: const Text(
          'This will immediately lock your Windows desktop and revoke this mobile session. Proceed?',
          style: TextStyle(color: GeminiColors.textBody, fontSize: 14, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.of(ctx).pop();
            },
            child: const Text(
              'Cancel',
              style: TextStyle(color: GeminiColors.textSecondary, fontWeight: FontWeight.w500),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              HapticFeedback.lightImpact();
              Navigator.of(ctx).pop();
              try {
                context.read<ActionsProvider>().triggerEmergencyKillswitch();
              } catch (_) {}
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: GeminiColors.emergencyDanger,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 0,
            ),
            child: const Text(
              'Lock Workstation Now',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
