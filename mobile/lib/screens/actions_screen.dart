import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/actions_provider.dart';
import '../theme/gemini_theme.dart';
import '../widgets/metric_tile.dart';

class ActionsScreen extends StatelessWidget {
  const ActionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = context.watch<ActionsProvider>();
    final metrics = actions.metrics;

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      body: RefreshIndicator(
        onRefresh: () async {
          actions.refreshMetrics();
          actions.refreshWindows();
        },
        color: GeminiColors.primary,
        backgroundColor: GeminiColors.surfaceContainer,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            // Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Hardware Telemetry',
                  style: TextStyle(
                    color: GeminiColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.refresh, color: GeminiColors.primary, size: 20),
                  onPressed: () {
                    actions.refreshMetrics();
                    actions.refreshWindows();
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),

            // Telemetry Grid
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.35,
              children: [
                MetricTile(
                  title: 'CPU Usage',
                  value: metrics.formattedCpuUsage,
                  subtitle: '${metrics.cpu.cores} Cores • ${metrics.cpu.model}',
                  icon: Icons.memory,
                  progressPercent: metrics.cpu.loadPercent,
                ),
                MetricTile(
                  title: 'Memory (RAM)',
                  value: metrics.formattedMemoryUsage,
                  subtitle: '${metrics.memory.usedPercent.toStringAsFixed(0)}% Utilized',
                  icon: Icons.storage,
                  progressPercent: metrics.memory.usedPercent,
                ),
                MetricTile(
                  title: 'GPU',
                  value: metrics.formattedGpuUsage,
                  subtitle: metrics.gpu.name,
                  icon: Icons.videogame_asset,
                  progressPercent: metrics.gpu.loadPercent,
                ),
                MetricTile(
                  title: 'Battery / Power',
                  value: metrics.battery.hasBattery
                      ? '${metrics.battery.percent ?? 0}%'
                      : 'AC Power',
                  subtitle: metrics.battery.status,
                  icon: metrics.battery.hasBattery ? Icons.battery_full : Icons.power,
                  progressPercent: (metrics.battery.percent ?? 100).toDouble(),
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Master Volume Control
            const Text(
              'Master Audio Volume',
              style: TextStyle(
                color: GeminiColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: GeminiColors.surfaceContainer,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: GeminiColors.border),
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(
                      actions.isMuted ? Icons.volume_off : Icons.volume_up,
                      color: actions.isMuted ? GeminiColors.emergencyDanger : GeminiColors.primary,
                    ),
                    onPressed: () => actions.toggleMute(),
                  ),
                  Expanded(
                    child: SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        activeTrackColor: GeminiColors.primary,
                        inactiveTrackColor: GeminiColors.border,
                        thumbColor: GeminiColors.primary,
                      ),
                      child: Slider(
                        value: actions.volumeLevel.toDouble(),
                        min: 0,
                        max: 100,
                        onChanged: (val) => actions.setVolume(val.toInt()),
                      ),
                    ),
                  ),
                  Text(
                    actions.isMuted ? 'Muted' : '${actions.volumeLevel}%',
                    style: const TextStyle(
                      color: GeminiColors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Timers & Alarms
            const Text(
              'Instant Timers',
              style: TextStyle(
                color: GeminiColors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildTimerChip(context, actions, 5 * 60, '5 min'),
                const SizedBox(width: 8),
                _buildTimerChip(context, actions, 15 * 60, '15 min'),
                const SizedBox(width: 8),
                _buildTimerChip(context, actions, 30 * 60, '30 min'),
                const SizedBox(width: 8),
                _buildTimerChip(context, actions, 60 * 60, '1 hr'),
              ],
            ),
            const SizedBox(height: 24),

            // Open Windows Switcher
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Desktop Window Switcher',
                  style: TextStyle(
                    color: GeminiColors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                TextButton(
                  onPressed: () => actions.refreshWindows(),
                  child: const Text('Refresh', style: TextStyle(color: GeminiColors.primary)),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (actions.windows.isEmpty)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: GeminiColors.surfaceContainer,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: GeminiColors.border),
                ),
                child: const Center(
                  child: Text(
                    'No open windows reported. Tap Refresh.',
                    style: TextStyle(color: GeminiColors.textMuted),
                  ),
                ),
              )
            else
              ...actions.windows.map(
                (w) => Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: w.isActive ? GeminiColors.elevatedCard : GeminiColors.surfaceContainer,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: w.isActive ? GeminiColors.primary : GeminiColors.border,
                      width: w.isActive ? 1.5 : 1,
                    ),
                  ),
                  child: ListTile(
                    dense: true,
                    leading: Icon(
                      Icons.desktop_windows,
                      color: w.isActive ? GeminiColors.primary : GeminiColors.textMuted,
                      size: 20,
                    ),
                    title: Text(
                      w.title,
                      style: const TextStyle(
                        color: GeminiColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: Text(
                      '${w.process} • PID ${w.pid}',
                      style: const TextStyle(color: GeminiColors.textMuted, fontSize: 11),
                    ),
                    trailing: ElevatedButton(
                      onPressed: () => actions.focusWindow(w.hwnd),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: w.isActive ? GeminiColors.primary : GeminiColors.elevatedCard,
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        minimumSize: Size.zero,
                        elevation: 0,
                      ),
                      child: Text(
                        w.isActive ? 'Active' : 'Focus',
                        style: TextStyle(
                          color: w.isActive ? GeminiColors.canvas : GeminiColors.textPrimary,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimerChip(
    BuildContext context,
    ActionsProvider actions,
    int seconds,
    String label,
  ) {
    return Expanded(
      child: OutlinedButton(
        onPressed: () {
          actions.startTimer(seconds, label);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Started timer: $label'),
              backgroundColor: GeminiColors.surfaceContainer,
              duration: const Duration(seconds: 2),
            ),
          );
        },
        style: OutlinedButton.styleFrom(
          side: const BorderSide(color: GeminiColors.border),
          padding: const EdgeInsets.symmetric(vertical: 10),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
        child: Text(
          label,
          style: const TextStyle(color: GeminiColors.textPrimary, fontSize: 12),
        ),
      ),
    );
  }
}
