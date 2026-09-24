import 'package:flutter_local_notifications/flutter_local_notifications.dart';

abstract class NotificationService {
  Future<void> initialize();
  Future<void> showAiCompletionNotification({
    required String title,
    required String body,
  });
}

class LocalNotificationService implements NotificationService {
  final FlutterLocalNotificationsPlugin _notificationsPlugin;
  bool _isInitialized = false;

  static const String channelId = 'assistant_notifications';
  static const String channelName = 'Personal Assistant';
  static const String channelDescription = 'Personal Assistant AI completion notifications';

  LocalNotificationService({FlutterLocalNotificationsPlugin? notificationsPlugin})
      : _notificationsPlugin = notificationsPlugin ?? FlutterLocalNotificationsPlugin();

  @override
  Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidSettings);

      await _notificationsPlugin.initialize(initSettings);

      final androidPlugin = _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
      if (androidPlugin != null) {
        const channel = AndroidNotificationChannel(
          channelId,
          channelName,
          description: channelDescription,
          importance: Importance.max,
        );
        await androidPlugin.createNotificationChannel(channel);
        await androidPlugin.requestNotificationsPermission();
      }

      _isInitialized = true;
    } catch (_) {
      // Graceful fallback in environments without platform notification support
      _isInitialized = true;
    }
  }

  @override
  Future<void> showAiCompletionNotification({
    required String title,
    required String body,
  }) async {
    try {
      await initialize();

      const androidDetails = AndroidNotificationDetails(
        channelId,
        channelName,
        channelDescription: channelDescription,
        importance: Importance.max,
        priority: Priority.high,
      );

      const notificationDetails = NotificationDetails(android: androidDetails);

      await _notificationsPlugin.show(
        DateTime.now().millisecondsSinceEpoch ~/ 1000,
        title,
        body,
        notificationDetails,
      );
    } catch (_) {
      // Graceful fallback
    }
  }
}
