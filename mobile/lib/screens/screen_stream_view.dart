import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/screen_stream_provider.dart';
import '../theme/gemini_theme.dart';

class ScreenStreamView extends StatefulWidget {
  const ScreenStreamView({super.key});

  @override
  State<ScreenStreamView> createState() => _ScreenStreamViewState();
}

class _ScreenStreamViewState extends State<ScreenStreamView> {
  final TransformationController _transformController = TransformationController();

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final streamProvider = context.watch<ScreenStreamProvider>();

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      body: Column(
        children: [
          // Stream Control Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: GeminiColors.surfaceContainer,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    ElevatedButton.icon(
                      onPressed: () => streamProvider.toggleStream(),
                      icon: Icon(
                        streamProvider.isStreaming ? Icons.stop : Icons.play_arrow,
                        size: 18,
                        color: streamProvider.isStreaming
                            ? Colors.white
                            : GeminiColors.canvas,
                      ),
                      label: Text(
                        streamProvider.isStreaming ? 'Halt Stream' : 'Live Desktop',
                        style: TextStyle(
                          color: streamProvider.isStreaming
                              ? Colors.white
                              : GeminiColors.canvas,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: streamProvider.isStreaming
                            ? GeminiColors.emergencyDanger
                            : GeminiColors.primary,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                    ),
                    const SizedBox(width: 12),
                    if (streamProvider.isStreaming) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: GeminiColors.elevatedCard,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: GeminiColors.border),
                        ),
                        child: Text(
                          '${streamProvider.fps} FPS',
                          style: const TextStyle(
                            color: GeminiColors.success,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                IconButton(
                  icon: Icon(
                    streamProvider.isFullscreen ? Icons.fullscreen_exit : Icons.fullscreen,
                    color: GeminiColors.textPrimary,
                  ),
                  onPressed: () => streamProvider.toggleFullscreen(),
                ),
              ],
            ),
          ),

          // Stream Viewport / InteractiveViewer
          Expanded(
            child: Center(
              child: !streamProvider.isStreaming
                  ? _buildIdlePlaceholder(streamProvider)
                  : streamProvider.currentFrameBytes == null
                      ? const Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            CircularProgressIndicator(color: GeminiColors.primary),
                            SizedBox(height: 16),
                            Text(
                              'Establishing low-latency stream...',
                              style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
                            ),
                          ],
                        )
                      : InteractiveViewer(
                          transformationController: _transformController,
                          minScale: 1.0,
                          maxScale: 4.0,
                          panEnabled: true,
                          scaleEnabled: true,
                          child: Image.memory(
                            streamProvider.currentFrameBytes!,
                            gaplessPlayback: true,
                            fit: BoxFit.contain,
                          ),
                        ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIdlePlaceholder(ScreenStreamProvider streamProvider) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: GeminiColors.surfaceContainer,
            shape: BoxShape.circle,
            border: Border.all(color: GeminiColors.border),
          ),
          child: const Icon(
            Icons.desktop_windows_outlined,
            color: GeminiColors.primary,
            size: 48,
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'On-Demand Desktop Stream',
          style: TextStyle(
            color: GeminiColors.textPrimary,
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 40),
          child: Text(
            'Screen capture runs strictly on-demand to conserve battery and LAN bandwidth. Pinch to zoom up to 4.0x.',
            style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
            textAlign: TextAlign.center,
          ),
        ),
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: () => streamProvider.startStream(),
          icon: const Icon(Icons.videocam, color: GeminiColors.canvas, size: 18),
          label: const Text(
            'Start Screen Stream',
            style: TextStyle(color: GeminiColors.canvas, fontWeight: FontWeight.bold),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: GeminiColors.primary,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          ),
        ),
      ],
    );
  }
}

/// Alias for stream_screen.dart
class StreamScreen extends StatelessWidget {
  const StreamScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const ScreenStreamView();
  }
}
