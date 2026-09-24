import 'package:flutter/foundation.dart';
import '../services/update_service.dart';

class UpdateProvider extends ChangeNotifier {
  final UpdateService _updateService;
  final int currentVersionCode;

  bool _isChecking = false;
  bool _isUpdateAvailable = false;
  double _downloadProgress = 0.0;
  bool _isDownloading = false;
  String? _errorMessage;
  AppVersionInfo? _latestVersion;

  UpdateProvider({
    UpdateService? updateService,
    this.currentVersionCode = 1,
  }) : _updateService = updateService ?? UpdateService();

  bool get isChecking => _isChecking;
  bool get isUpdateAvailable => _isUpdateAvailable;
  double get downloadProgress => _downloadProgress;
  bool get isDownloading => _isDownloading;
  String? get errorMessage => _errorMessage;
  AppVersionInfo? get latestVersion => _latestVersion;
  UpdateService get updateService => _updateService;

  Future<void> checkUpdateFromHost(String hostIp, int port) async {
    final cleanIp = hostIp.trim();
    if (cleanIp.isEmpty) return;

    _isChecking = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final hostUrl = '$cleanIp:$port';
      final info = await _updateService.checkForUpdate(hostUrl, currentVersionCode);
      if (info != null) {
        _latestVersion = info;
        _isUpdateAvailable = true;
        _errorMessage = null;
      } else {
        _isUpdateAvailable = false;
        _errorMessage = null;
      }
    } catch (e) {
      _errorMessage = e.toString();
      _isUpdateAvailable = false;
    } finally {
      _isChecking = false;
      notifyListeners();
    }
  }

  Future<void> startUpdate() async {
    if (_latestVersion == null || _isDownloading) return;

    _isDownloading = true;
    _downloadProgress = 0.0;
    _errorMessage = null;
    notifyListeners();

    try {
      await _updateService.downloadAndInstallUpdate(
        _latestVersion!.apkUrl,
        (progress) {
          _downloadProgress = progress;
          notifyListeners();
        },
      );
      _isDownloading = false;
      notifyListeners();
    } catch (e) {
      _isDownloading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  void setUpdateAvailable(AppVersionInfo info) {
    _latestVersion = info;
    _isUpdateAvailable = true;
    _errorMessage = null;
    notifyListeners();
  }

  void reset() {
    _isChecking = false;
    _isUpdateAvailable = false;
    _downloadProgress = 0.0;
    _isDownloading = false;
    _errorMessage = null;
    _latestVersion = null;
    notifyListeners();
  }
}
