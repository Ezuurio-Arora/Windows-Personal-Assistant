import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

class AppVersionInfo {
  final String version;
  final int versionCode;
  final String apkUrl;
  final String? releaseNotes;
  final int? fileSize;

  const AppVersionInfo({
    required this.version,
    required this.versionCode,
    required this.apkUrl,
    this.releaseNotes,
    this.fileSize,
  });

  factory AppVersionInfo.fromJson(Map<String, dynamic> json) {
    final rawVersionCode = json['versionCode'] ?? json['buildNumber'];
    final parsedVersionCode = rawVersionCode is int
        ? rawVersionCode
        : (rawVersionCode != null ? int.tryParse(rawVersionCode.toString()) ?? 1 : 1);

    return AppVersionInfo(
      version: (json['version'] ?? json['versionName']) as String? ?? '1.0.0',
      versionCode: parsedVersionCode,
      apkUrl: (json['apkUrl'] ?? json['downloadUrl'] ?? json['url']) as String? ?? '',
      releaseNotes: (json['releaseNotes'] ?? json['changelog'] ?? json['description']) as String?,
      fileSize: json['fileSize'] as int?,
    );
  }

  Map<String, dynamic> toJson() => {
        'version': version,
        'versionCode': versionCode,
        'apkUrl': apkUrl,
        if (releaseNotes != null) 'releaseNotes': releaseNotes,
        if (fileSize != null) 'fileSize': fileSize,
      };

  AppVersionInfo copyWith({
    String? version,
    int? versionCode,
    String? apkUrl,
    String? releaseNotes,
    int? fileSize,
  }) {
    return AppVersionInfo(
      version: version ?? this.version,
      versionCode: versionCode ?? this.versionCode,
      apkUrl: apkUrl ?? this.apkUrl,
      releaseNotes: releaseNotes ?? this.releaseNotes,
      fileSize: fileSize ?? this.fileSize,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AppVersionInfo &&
          runtimeType == other.runtimeType &&
          version == other.version &&
          versionCode == other.versionCode &&
          apkUrl == other.apkUrl;

  @override
  int get hashCode => version.hashCode ^ versionCode.hashCode ^ apkUrl.hashCode;

  @override
  String toString() =>
      'AppVersionInfo(version: $version, versionCode: $versionCode, apkUrl: $apkUrl)';
}

class UpdateService {
  final http.Client _httpClient;
  final MethodChannel _methodChannel;

  static const String channelName = 'com.personalassistant.mobile/updater';

  UpdateService({
    http.Client? httpClient,
    MethodChannel? methodChannel,
  })  : _httpClient = httpClient ?? http.Client(),
        _methodChannel = methodChannel ?? const MethodChannel(channelName);

  Future<int> getInstalledVersionCode() async {
    try {
      final res = await _methodChannel.invokeMethod<Map>('getAppVersion');
      if (res != null && res['versionCode'] != null) {
        return (res['versionCode'] as num).toInt();
      }
    } catch (_) {}
    return 2;
  }

  Future<AppVersionInfo?> checkForUpdate(
    String hostUrl,
    int currentVersionCode,
  ) async {
    String cleanHost = hostUrl.trim();
    if (cleanHost.isEmpty) return null;
    if (!cleanHost.startsWith('http://') && !cleanHost.startsWith('https://')) {
      cleanHost = 'http://$cleanHost';
    }
    if (cleanHost.endsWith('/')) {
      cleanHost = cleanHost.substring(0, cleanHost.length - 1);
    }

    final uri = Uri.parse('$cleanHost/api/app/version');
    final response = await _httpClient.get(uri).timeout(const Duration(seconds: 5));

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final info = AppVersionInfo.fromJson(data);

      String apkUrl = info.apkUrl;
      if (!apkUrl.startsWith('http://') && !apkUrl.startsWith('https://')) {
        if (!apkUrl.startsWith('/')) {
          apkUrl = '/$apkUrl';
        }
        apkUrl = '$cleanHost$apkUrl';
      }

      final resolvedInfo = info.copyWith(apkUrl: apkUrl);
      if (resolvedInfo.versionCode > currentVersionCode) {
        return resolvedInfo;
      }
    }
    return null;
  }

  Future<File> downloadAndInstallUpdate(
    String apkUrl,
    void Function(double progress) onProgress,
  ) async {
    final uri = Uri.parse(apkUrl);
    final request = http.Request('GET', uri);
    final response = await _httpClient.send(request);

    if (response.statusCode != 200) {
      throw Exception('Failed to download update: HTTP ${response.statusCode}');
    }

    final contentLength = response.contentLength ?? 0;
    final tempDir = Directory.systemTemp;
    final file = File('${tempDir.path}/update_personal_assistant.apk');
    if (await file.exists()) {
      try {
        await file.delete();
      } catch (_) {}
    }

    final sink = file.openWrite();
    int received = 0;

    try {
      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (contentLength > 0) {
          final progress = (received / contentLength).clamp(0.0, 1.0);
          onProgress(progress);
        } else {
          onProgress(-1.0);
        }
      }
    } finally {
      await sink.flush();
      await sink.close();
    }

    onProgress(1.0);

    try {
      await _methodChannel.invokeMethod('installApk', {'filePath': file.path});
    } on MissingPluginException {
      // In tests/desktop environment without Android native engine, handle gracefully
    }

    return file;
  }
}
