import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/gemini_theme.dart';

class WaveformPill extends StatefulWidget {
  final VoidCallback onStop;

  const WaveformPill({super.key, required this.onStop});

  @override
  State<WaveformPill> createState() => _WaveformPillState();
}

class _WaveformPillState extends State<WaveformPill>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: GeminiColors.surfaceContainer,
        borderRadius: GeminiRadii.pill,
        border: Border.all(
          color: GeminiColors.primary.withOpacity(0.4),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: GeminiColors.primary.withOpacity(0.12),
            blurRadius: 16,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: GeminiColors.primary.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.mic_rounded,
              color: GeminiColors.primary,
              size: 18,
            ),
          ),
          const SizedBox(width: 12),
          // Animated Waveform Bars
          Expanded(
            child: Row(
              children: [
                AnimatedBuilder(
                  animation: _animController,
                  builder: (context, child) {
                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: List.generate(6, (index) {
                        final phase = index * 0.35;
                        final factor = (math.sin((_animController.value * 2 * math.pi) + phase) + 1) / 2;
                        final barHeight = 8.0 + (factor * 18.0);

                        return Container(
                          margin: const EdgeInsets.symmetric(horizontal: 2.2),
                          width: 3.5,
                          height: barHeight,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(3),
                            gradient: const LinearGradient(
                              colors: [
                                GeminiColors.primary,
                                GeminiColors.lavenderMid,
                                GeminiColors.purpleProgress,
                              ],
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                          ),
                        );
                      }),
                    );
                  },
                ),
                const SizedBox(width: 12),
                const Flexible(
                  child: Text(
                    'Listening...',
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: GeminiColors.textBody,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: () {
                HapticFeedback.lightImpact();
                widget.onStop();
              },
              borderRadius: BorderRadius.circular(20),
              splashColor: GeminiColors.emergencyDanger.withOpacity(0.3),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: GeminiColors.emergencyDanger.withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.stop_rounded,
                  color: GeminiColors.emergencyDanger,
                  size: 22,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
