import 'package:flutter/material.dart';
import '../theme/gemini_theme.dart';

/// Signature Gemini 2.0 animated horizontal gradient shimmer and subagent progress bar.
/// Uses linear-gradient(90deg, #7DACF8, #9FA8DA, #B87CF8).
class GeminiGradientBar extends StatefulWidget {
  final double value; // 0.0 to 1.0 (1.0 = full width)
  final bool isIndeterminate;
  final double height;
  final bool showShimmer;

  const GeminiGradientBar({
    super.key,
    this.value = 1.0,
    this.isIndeterminate = false,
    this.height = 3.0,
    this.showShimmer = true,
  });

  @override
  State<GeminiGradientBar> createState() => _GeminiGradientBarState();
}

class _GeminiGradientBarState extends State<GeminiGradientBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = constraints.maxWidth;
        final activeWidth = widget.isIndeterminate
            ? totalWidth
            : totalWidth * widget.value.clamp(0.0, 1.0);

        return Container(
          width: totalWidth,
          height: widget.height,
          color: GeminiColors.surfaceContainer,
          alignment: Alignment.centerLeft,
          child: Stack(
            children: [
              // Base Gemini linear gradient: #7DACF8 -> #9FA8DA -> #B87CF8
              Container(
                width: activeWidth,
                height: widget.height,
                decoration: const BoxDecoration(
                  gradient: GeminiColors.geminiGradient,
                ),
              ),
              // Optional Shimmer sweep overlay
              if (widget.showShimmer)
                AnimatedBuilder(
                  animation: _shimmerController,
                  builder: (context, child) {
                    return Positioned(
                      left: -totalWidth + (2 * totalWidth * _shimmerController.value),
                      top: 0,
                      bottom: 0,
                      width: totalWidth,
                      child: Container(
                        decoration: const BoxDecoration(
                          gradient: GeminiColors.shimmerGradient,
                        ),
                      ),
                    );
                  },
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Convenience alias for specs referencing GradientProgressBar
class GradientProgressBar extends StatelessWidget {
  final double value;
  final bool isIndeterminate;
  final double height;

  const GradientProgressBar({
    super.key,
    this.value = 1.0,
    this.isIndeterminate = false,
    this.height = 3.0,
  });

  @override
  Widget build(BuildContext context) {
    return GeminiGradientBar(
      value: value,
      isIndeterminate: isIndeterminate,
      height: height,
    );
  }
}
