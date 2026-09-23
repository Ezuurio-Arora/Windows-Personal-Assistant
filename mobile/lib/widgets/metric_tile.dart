import 'package:flutter/material.dart';
import '../theme/gemini_theme.dart';

class MetricTile extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final double progressPercent;

  const MetricTile({
    super.key,
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    this.progressPercent = 0.0,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GeminiColors.elevatedCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: GeminiColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(title, style: const TextStyle(color: GeminiColors.textMuted, fontSize: 12)),
              Icon(icon, color: GeminiColors.primary, size: 18),
            ],
          ),
          Text(
            value,
            style: const TextStyle(
              color: GeminiColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(subtitle, style: const TextStyle(color: GeminiColors.textMuted, fontSize: 11)),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (progressPercent / 100).clamp(0.0, 1.0),
              backgroundColor: GeminiColors.surfaceContainer,
              valueColor: const AlwaysStoppedAnimation<Color>(GeminiColors.purpleProgress),
              minHeight: 4,
            ),
          ),
        ],
      ),
    );
  }
}
