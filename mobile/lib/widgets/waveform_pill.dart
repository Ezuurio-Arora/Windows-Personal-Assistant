import 'package:flutter/material.dart';
import '../theme/gemini_theme.dart';

class WaveformPill extends StatelessWidget {
  final VoidCallback onStop;

  const WaveformPill({super.key, required this.onStop});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: GeminiColors.surfaceContainer,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: GeminiColors.primary.withOpacity(0.5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.mic, color: GeminiColors.primary, size: 20),
          const SizedBox(width: 12),
          const Expanded(
            child: Text(
              'Listening to voice...',
              style: TextStyle(color: GeminiColors.textPrimary, fontSize: 14),
            ),
          ),
          IconButton(
            onPressed: onStop,
            icon: const Icon(Icons.stop_circle, color: GeminiColors.emergencyDanger, size: 24),
          ),
        ],
      ),
    );
  }
}
