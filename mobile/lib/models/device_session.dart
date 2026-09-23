class DeviceSession {
  final String sessionToken;
  final String hmacSecret;
  final String hostName;
  final String lanIp;
  final int port;
  final String? tunnelUrl;
  final String safetyMode;
  final int serverTime;
  final DateTime pairedAt;
  final DateTime lastConnected;
  final String deviceId;
  final String deviceName;

  const DeviceSession({
    required this.sessionToken,
    required this.hmacSecret,
    required this.hostName,
    required this.lanIp,
    required this.port,
    this.tunnelUrl,
    required this.safetyMode,
    required this.serverTime,
    required this.pairedAt,
    required this.lastConnected,
    required this.deviceId,
    required this.deviceName,
  });

  String get hostIp => lanIp;
  String get httpBaseUrl => 'http://$lanIp:$port';
  String get wsUrl => 'ws://$lanIp:$port/ws';
  String get fallbackWsUrl => 'ws://personal-assistant.local:$port/ws';
  String? get tunnelWsUrl {
    if (tunnelUrl == null || tunnelUrl!.isEmpty) return null;
    return tunnelUrl!
            .replaceFirst('https://', 'wss://')
            .replaceFirst('http://', 'ws://') +
        '/ws';
  }

  factory DeviceSession.fromJson(Map<String, dynamic> json) {
    return DeviceSession(
      sessionToken: json['sessionToken'] as String? ?? '',
      hmacSecret: json['hmacSecret'] as String? ?? '',
      hostName: json['hostName'] as String? ?? 'Host PC',
      lanIp: (json['lanIp'] ?? json['hostIp']) as String? ?? '127.0.0.1',
      port: json['port'] as int? ?? 42000,
      tunnelUrl: json['tunnelUrl'] as String?,
      safetyMode: json['safetyMode'] as String? ?? 'tiered',
      serverTime: json['serverTime'] as int? ?? 0,
      pairedAt: json['pairedAt'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['pairedAt'] as int)
          : DateTime.now(),
      lastConnected: json['lastConnected'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['lastConnected'] as int)
          : DateTime.now(),
      deviceId: json['deviceId'] as String? ?? 'android_device',
      deviceName: json['deviceName'] as String? ?? 'Android Companion',
    );
  }

  Map<String, dynamic> toJson() => {
        'sessionToken': sessionToken,
        'hmacSecret': hmacSecret,
        'hostName': hostName,
        'lanIp': lanIp,
        'port': port,
        'tunnelUrl': tunnelUrl,
        'safetyMode': safetyMode,
        'serverTime': serverTime,
        'pairedAt': pairedAt.millisecondsSinceEpoch,
        'lastConnected': lastConnected.millisecondsSinceEpoch,
        'deviceId': deviceId,
        'deviceName': deviceName,
      };

  DeviceSession copyWith({
    String? sessionToken,
    String? hmacSecret,
    String? hostName,
    String? lanIp,
    int? port,
    String? tunnelUrl,
    String? safetyMode,
    int? serverTime,
    DateTime? pairedAt,
    DateTime? lastConnected,
    String? deviceId,
    String? deviceName,
  }) {
    return DeviceSession(
      sessionToken: sessionToken ?? this.sessionToken,
      hmacSecret: hmacSecret ?? this.hmacSecret,
      hostName: hostName ?? this.hostName,
      lanIp: lanIp ?? this.lanIp,
      port: port ?? this.port,
      tunnelUrl: tunnelUrl ?? this.tunnelUrl,
      safetyMode: safetyMode ?? this.safetyMode,
      serverTime: serverTime ?? this.serverTime,
      pairedAt: pairedAt ?? this.pairedAt,
      lastConnected: lastConnected ?? this.lastConnected,
      deviceId: deviceId ?? this.deviceId,
      deviceName: deviceName ?? this.deviceName,
    );
  }
}
