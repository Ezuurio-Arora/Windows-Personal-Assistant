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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: GeminiColors.elevatedCard,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: GeminiColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: GeminiColors.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Icon(icon, color: GeminiColors.primary, size: 18),
            ],
          ),
          Text(
            value,
            style: const TextStyle(
              color: GeminiColors.textHeading,
              fontSize: 20,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.3,
            ),
          ),
          Text(
            subtitle,
            style: const TextStyle(
              color: GeminiColors.textSecondary,
              fontSize: 11,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
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
