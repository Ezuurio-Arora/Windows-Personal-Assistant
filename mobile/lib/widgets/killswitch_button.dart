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
          splashColor: GeminiColors.primary.withOpacity(0.2),
          highlightColor: GeminiColors.primary.withOpacity(0.1),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: GeminiColors.elevatedCard,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: GeminiColors.border,
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.2),
                  blurRadius: 6,
                  spreadRadius: 0,
                ),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.lock_outline_rounded,
                  size: 13,
                  color: GeminiColors.textHeading,
                ),
                SizedBox(width: 5),
                Text(
                  'Lock PC',
                  style: TextStyle(
                    color: GeminiColors.textHeading,
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
            Icon(Icons.lock_outline_rounded, color: GeminiColors.primary, size: 22),
            SizedBox(width: 8),
            Text(
              'Lock Workstation?',
              style: TextStyle(
                color: GeminiColors.textHeading,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Lock Workstation? This will immediately lock your Windows desktop. Your mobile connection will remain paired.',
              style: TextStyle(color: GeminiColors.textBody, fontSize: 14, height: 1.4),
            ),
            const SizedBox(height: 12),
            Text(
              'Need to emergency unpair? Go to Settings → Unpair Device.',
              style: TextStyle(color: GeminiColors.textSecondary.withOpacity(0.85), fontSize: 12, height: 1.3),
            ),
          ],
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
              if (widget.onTriggered != null) {
                widget.onTriggered!();
              } else {
                try {
                  context.read<ActionsProvider>().lockPc();
                } catch (_) {}
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: GeminiColors.primary,
              foregroundColor: GeminiColors.canvas,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              elevation: 0,
            ),
            child: const Text(
              'Lock PC',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
