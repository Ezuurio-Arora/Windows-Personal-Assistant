import 'package:flutter/material.dart';
import '../theme/gemini_theme.dart';

/// Signature Google Gemini animated horizontal gradient shimmer and subagent progress bar.
/// Uses linear-gradient(90deg, #7DACF8, #9FA8DA, #B87CF8) with smooth micro-animations.
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
    );
    if (widget.showShimmer && (widget.isIndeterminate || widget.value < 1.0)) {
      _shimmerController.repeat();
    }
  }

  @override
  void didUpdateWidget(GeminiGradientBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.showShimmer && (widget.isIndeterminate || widget.value < 1.0)) {
      if (!_shimmerController.isAnimating) {
        _shimmerController.repeat();
      }
    } else {
      if (_shimmerController.isAnimating) {
        _shimmerController.stop();
      }
    }
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

        return Container(
          width: totalWidth,
          height: widget.height,
          decoration: BoxDecoration(
            color: GeminiColors.surfaceContainer,
            boxShadow: [
              BoxShadow(
                color: GeminiColors.primary.withOpacity(0.25),
                blurRadius: 4,
                spreadRadius: 0,
              ),
            ],
          ),
          alignment: Alignment.centerLeft,
          child: widget.isIndeterminate
              ? _buildIndeterminateBar(totalWidth)
              : _buildDeterminateBar(totalWidth),
        );
      },
    );
  }

  Widget _buildDeterminateBar(double totalWidth) {
    final clampedValue = widget.value.clamp(0.0, 1.0);

    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: clampedValue),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOutCubic,
      builder: (context, animatedValue, child) {
        final activeWidth = totalWidth * animatedValue;

        return Stack(
          children: [
            Container(
              width: activeWidth,
              height: widget.height,
              decoration: const BoxDecoration(
                gradient: GeminiColors.geminiGradient,
              ),
            ),
            if (widget.showShimmer && activeWidth > 0 && _shimmerController.isAnimating)
              AnimatedBuilder(
                animation: _shimmerController,
                builder: (context, child) {
                  return Positioned(
                    left: -activeWidth + (2 * activeWidth * _shimmerController.value),
                    top: 0,
                    bottom: 0,
                    width: activeWidth,
                    child: Container(
                      decoration: const BoxDecoration(
                        gradient: GeminiColors.shimmerGradient,
                      ),
                    ),
                  );
                },
              ),
          ],
        );
      },
    );
  }

  Widget _buildIndeterminateBar(double totalWidth) {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        final progress = _shimmerController.value;
        final barWidth = totalWidth * 0.45;
        final left = -barWidth + (totalWidth + barWidth) * progress;

        return Stack(
          children: [
            Positioned(
              left: left,
              top: 0,
              bottom: 0,
              width: barWidth,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(widget.height / 2),
                  gradient: GeminiColors.geminiGradient,
                ),
              ),
            ),
          ],
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
