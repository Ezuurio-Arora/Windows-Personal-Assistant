import 'package:flutter_test/flutter_test.dart';
import 'package:personal_assistant/models/chat_message.dart';
import 'package:personal_assistant/models/system_metrics.dart';
import 'package:personal_assistant/models/window_item.dart';
import 'package:personal_assistant/models/device_session.dart';

void main() {
  group('ChatMessage JSON Serialization & Logic', () {
    test('User message serializes and deserializes correctly', () {
      final msg = ChatMessage.user(id: 'msg_101', content: 'Hello Desktop Hub');
      final json = msg.toJson();

      expect(json['id'], equals('msg_101'));
      expect(json['role'], equals('user'));
      expect(json['content'], equals('Hello Desktop Hub'));

      final parsed = ChatMessage.fromJson(json);
      expect(parsed.id, equals('msg_101'));
      expect(parsed.role, equals(MessageRole.user));
      expect(parsed.content, equals('Hello Desktop Hub'));
      expect(parsed.isStreaming, isFalse);
    });

    test('Assistant message with subagent progress parses correctly', () {
      final json = {
        'id': 'msg_102',
        'role': 'assistant',
        'content': 'Executing task...',
        'timestamp': 1774351000000,
        'isStreaming': true,
        'stage': 'subagent_execution',
        'progressPercent': 0.45,
        'subagentName': 'Vision Sub-agent',
        'activeTool': 'capture_screen',
      };

      final msg = ChatMessage.fromJson(json);
      expect(msg.stage, equals(SubagentStage.subagentExecution));
      expect(msg.progressPercent, equals(0.45));
      expect(msg.subagentName, equals('Vision Sub-agent'));
      expect(msg.activeTool, equals('capture_screen'));
    });
  });

  group('SystemMetrics JSON Serialization & Logic', () {
    test('Parses nested hardware telemetry from server fast_actions', () {
      final json = {
        'hostName': 'EZAN-WORKSTATION',
        'cpu': {'loadPercent': 14.8, 'cores': 16, 'model': 'i7-13700K'},
        'memory': {'totalGB': 32.0, 'usedGB': 14.2, 'freeGB': 17.8, 'usedPercent': 44.4},
        'gpu': {'name': 'RTX 4070', 'loadPercent': 8.0, 'vramUsedGB': 2.1, 'vramTotalGB': 12.0},
        'battery': {'hasBattery': false, 'percent': null, 'status': 'AC / Desktop'},
        'uptimeHours': 48.6,
        'timestamp': 1774351300000,
      };

      final metrics = SystemMetrics.fromJson(json);
      expect(metrics.hostName, equals('EZAN-WORKSTATION'));
      expect(metrics.cpu.loadPercent, equals(14.8));
      expect(metrics.cpu.cores, equals(16));
      expect(metrics.memory.totalGB, equals(32.0));
      expect(metrics.memory.usedPercent, equals(44.4));
      expect(metrics.gpu.name, equals('RTX 4070'));
      expect(metrics.battery.hasBattery, isFalse);
      expect(metrics.battery.percent, isNull);
      expect(metrics.uptimeHours, equals(48.6));
      expect(metrics.formattedCpuUsage, equals('14.8%'));
      expect(metrics.formattedUptime, equals('48h 36m'));

      final serialized = metrics.toJson();
      expect(serialized['hostName'], equals('EZAN-WORKSTATION'));
      expect(serialized['cpu']['cores'], equals(16));
    });
  });

  group('WindowItem & WindowListResponse JSON Serialization', () {
    test('Parses window list and active window focus targets', () {
      final json = {
        'activeWindow': {'title': 'VS Code', 'process': 'Code', 'pid': 8420, 'hwnd': '0x002A041E'},
        'windows': [
          {'title': 'VS Code', 'process': 'Code', 'pid': 8420, 'hwnd': '0x002A041E'},
          {'title': 'Chrome', 'process': 'chrome', 'pid': 4120, 'hwnd': '0x0019053C'},
        ]
      };

      final response = WindowListResponse.fromJson(json);
      expect(response.activeWindow?.title, equals('VS Code'));
      expect(response.windows.length, equals(2));
      expect(response.windows[1].process, equals('chrome'));
      expect(response.windows[1].hwnd, equals('0x0019053C'));
    });
  });

  group('DeviceSession Credentials Serialization & URLs', () {
    test('Serializes session and reconstructs URLs accurately', () {
      final session = DeviceSession(
        sessionToken: 'token_hex_64_characters',
        hmacSecret: 'secret_hex_64_characters',
        hostName: 'EZAN-PC',
        lanIp: '192.168.10.139',
        port: 42000,
        tunnelUrl: 'https://demo.trycloudflare.com',
        safetyMode: 'tiered',
        serverTime: 1774351000000,
        pairedAt: DateTime.now(),
        lastConnected: DateTime.now(),
        deviceId: 'pixel_8',
        deviceName: 'Pixel 8 Pro',
      );

      expect(session.httpBaseUrl, equals('http://192.168.10.139:42000'));
      expect(session.wsUrl, equals('ws://192.168.10.139:42000/ws'));
      expect(session.fallbackWsUrl, equals('ws://personal-assistant.local:42000/ws'));
      expect(session.tunnelWsUrl, equals('wss://demo.trycloudflare.com/ws'));

      final json = session.toJson();
      final reconstructed = DeviceSession.fromJson(json);
      expect(reconstructed.sessionToken, equals('token_hex_64_characters'));
      expect(reconstructed.lanIp, equals('192.168.10.139'));
      expect(reconstructed.hostIp, equals('192.168.10.139'));
    });
  });
}
