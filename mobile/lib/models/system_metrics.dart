class CpuMetrics {
  final double loadPercent;
  final int cores;
  final String model;

  const CpuMetrics({
    required this.loadPercent,
    required this.cores,
    required this.model,
  });

  factory CpuMetrics.fromJson(Map<String, dynamic> json) {
    return CpuMetrics(
      loadPercent: (json['loadPercent'] as num?)?.toDouble() ?? 0.0,
      cores: json['cores'] as int? ?? 1,
      model: json['model'] as String? ?? 'Processor',
    );
  }

  Map<String, dynamic> toJson() => {
    'loadPercent': loadPercent,
    'cores': cores,
    'model': model,
  };
}

class MemoryMetrics {
  final double totalGB;
  final double usedGB;
  final double freeGB;
  final double usedPercent;

  const MemoryMetrics({
    required this.totalGB,
    required this.usedGB,
    required this.freeGB,
    required this.usedPercent,
  });

  factory MemoryMetrics.fromJson(Map<String, dynamic> json) {
    return MemoryMetrics(
      totalGB: (json['totalGB'] as num?)?.toDouble() ?? 0.0,
      usedGB: (json['usedGB'] as num?)?.toDouble() ?? 0.0,
      freeGB: (json['freeGB'] as num?)?.toDouble() ?? 0.0,
      usedPercent: (json['usedPercent'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'totalGB': totalGB,
    'usedGB': usedGB,
    'freeGB': freeGB,
    'usedPercent': usedPercent,
  };
}

class GpuMetrics {
  final String name;
  final double loadPercent;
  final double vramUsedGB;
  final double vramTotalGB;

  const GpuMetrics({
    required this.name,
    required this.loadPercent,
    required this.vramUsedGB,
    required this.vramTotalGB,
  });

  factory GpuMetrics.fromJson(Map<String, dynamic> json) {
    return GpuMetrics(
      name: json['name'] as String? ?? 'GPU',
      loadPercent: (json['loadPercent'] as num?)?.toDouble() ?? 0.0,
      vramUsedGB: (json['vramUsedGB'] as num?)?.toDouble() ?? 0.0,
      vramTotalGB: (json['vramTotalGB'] as num?)?.toDouble() ?? 0.0,
    );
  }

  Map<String, dynamic> toJson() => {
    'name': name,
    'loadPercent': loadPercent,
    'vramUsedGB': vramUsedGB,
    'vramTotalGB': vramTotalGB,
  };
}

class BatteryMetrics {
  final bool hasBattery;
  final int? percent;
  final String status;

  const BatteryMetrics({
    required this.hasBattery,
    this.percent,
    required this.status,
  });

  factory BatteryMetrics.fromJson(Map<String, dynamic> json) {
    return BatteryMetrics(
      hasBattery: json['hasBattery'] as bool? ?? false,
      percent: json['percent'] as int?,
      status: json['status'] as String? ?? 'AC / Desktop',
    );
  }

  Map<String, dynamic> toJson() => {
    'hasBattery': hasBattery,
    'percent': percent,
    'status': status,
  };
}

class SystemMetrics {
  final String hostName;
  final CpuMetrics cpu;
  final MemoryMetrics memory;
  final GpuMetrics gpu;
  final BatteryMetrics battery;
  final double uptimeHours;
  final DateTime timestamp;

  const SystemMetrics({
    required this.hostName,
    required this.cpu,
    required this.memory,
    required this.gpu,
    required this.battery,
    required this.uptimeHours,
    required this.timestamp,
  });

  factory SystemMetrics.initial() {
    return SystemMetrics(
      hostName: 'Connecting...',
      cpu: const CpuMetrics(loadPercent: 0, cores: 1, model: 'Probing...'),
      memory: const MemoryMetrics(totalGB: 0, usedGB: 0, freeGB: 0, usedPercent: 0),
      gpu: const GpuMetrics(name: 'Probing...', loadPercent: 0, vramUsedGB: 0, vramTotalGB: 0),
      battery: const BatteryMetrics(hasBattery: false, percent: null, status: 'AC / Desktop'),
      uptimeHours: 0,
      timestamp: DateTime.now(),
    );
  }

  factory SystemMetrics.fromJson(Map<String, dynamic> json) {
    return SystemMetrics(
      hostName: json['hostName'] as String? ?? 'HOST-PC',
      cpu: json['cpu'] != null
          ? CpuMetrics.fromJson(json['cpu'] as Map<String, dynamic>)
          : const CpuMetrics(loadPercent: 0, cores: 1, model: 'CPU'),
      memory: json['memory'] != null
          ? MemoryMetrics.fromJson(json['memory'] as Map<String, dynamic>)
          : const MemoryMetrics(totalGB: 0, usedGB: 0, freeGB: 0, usedPercent: 0),
      gpu: json['gpu'] != null
          ? GpuMetrics.fromJson(json['gpu'] as Map<String, dynamic>)
          : const GpuMetrics(name: 'GPU', loadPercent: 0, vramUsedGB: 0, vramTotalGB: 0),
      battery: json['battery'] != null
          ? BatteryMetrics.fromJson(json['battery'] as Map<String, dynamic>)
          : const BatteryMetrics(hasBattery: false, percent: null, status: 'AC / Desktop'),
      uptimeHours: (json['uptimeHours'] as num?)?.toDouble() ?? 0.0,
      timestamp: json['timestamp'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['timestamp'] as int)
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toJson() => {
    'hostName': hostName,
    'cpu': cpu.toJson(),
    'memory': memory.toJson(),
    'gpu': gpu.toJson(),
    'battery': battery.toJson(),
    'uptimeHours': uptimeHours,
    'timestamp': timestamp.millisecondsSinceEpoch,
  };

  String get formattedUptime {
    final hours = uptimeHours.floor();
    final minutes = ((uptimeHours - hours) * 60).round();
    return '${hours}h ${minutes}m';
  }

  String get formattedCpuUsage => '${cpu.loadPercent.toStringAsFixed(1)}%';
  String get formattedMemoryUsage => '${memory.usedGB.toStringAsFixed(1)} / ${memory.totalGB.toStringAsFixed(1)} GB';
  String get formattedGpuUsage => '${gpu.loadPercent.toStringAsFixed(1)}%';
}
