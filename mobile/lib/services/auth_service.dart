import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';
import '../models/device_session.dart';

abstract class AuthService {
  Future<bool> canCheckBiometrics();
  Future<bool> authenticateWithBiometrics({String reason = 'Authenticate to access Personal Assistant'});
  Future<DeviceSession?> loadSession();
  Future<void> saveSession(DeviceSession session);
  Future<void> clearSession();
  Future<bool> hasValidSession();
  Future<bool> isBiometricLockEnabled();
  Future<void> setBiometricLockEnabled(bool enabled);
}

class SecureAuthService implements AuthService {
  final LocalAuthentication _localAuth;
  final FlutterSecureStorage _storage;

  static const String _sessionKey = 'personal_assistant_device_session';
  static const String _biometricLockKey = 'biometric_lock_enabled';

  SecureAuthService({
    LocalAuthentication? localAuth,
    FlutterSecureStorage? storage,
  })  : _localAuth = localAuth ?? LocalAuthentication(),
        _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
            );

  @override
  Future<bool> canCheckBiometrics() async {
    try {
      final isSupported = await _localAuth.isDeviceSupported();
      final canCheck = await _localAuth.canCheckBiometrics;
      return isSupported && canCheck;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<bool> authenticateWithBiometrics({
    String reason = 'Authenticate to control your Personal Assistant host PC',
  }) async {
    try {
      final canAuthenticate = await canCheckBiometrics();
      if (!canAuthenticate) return true; // Device has no biometrics configured

      return await _localAuth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false, // Allows device PIN / Pattern fallback
        ),
      );
    } catch (e) {
      return false;
    }
  }

  @override
  Future<DeviceSession?> loadSession() async {
    try {
      final raw = await _storage.read(key: _sessionKey);
      if (raw == null) return null;
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return DeviceSession.fromJson(map);
    } catch (e) {
      return null;
    }
  }

  @override
  Future<void> saveSession(DeviceSession session) async {
    final raw = jsonEncode(session.toJson());
    await _storage.write(key: _sessionKey, value: raw);
  }

  @override
  Future<void> clearSession() async {
    await _storage.delete(key: _sessionKey);
  }

  @override
  Future<bool> hasValidSession() async {
    final session = await loadSession();
    return session != null && session.sessionToken.isNotEmpty;
  }

  @override
  Future<bool> isBiometricLockEnabled() async {
    try {
      final raw = await _storage.read(key: _biometricLockKey);
      if (raw == null) {
        return true; // Default to true
      }
      return raw == 'true';
    } catch (_) {
      return true;
    }
  }

  @override
  Future<void> setBiometricLockEnabled(bool enabled) async {
    await _storage.write(key: _biometricLockKey, value: enabled.toString());
  }
}
