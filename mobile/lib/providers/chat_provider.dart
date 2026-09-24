import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../models/chat_message.dart';
import '../services/socket_service.dart';
import '../services/notification_service.dart';
import 'connection_provider.dart';

class ChatProvider extends ChangeNotifier with WidgetsBindingObserver {
  final SocketService _socketService;
  final ConnectionProvider _connectionProvider;
  final NotificationService _notificationService;
  final FlutterTts _tts;
  final stt.SpeechToText _speech;

  final List<ChatMessage> _messages = [];
  bool _isStreaming = false;
  String? _activeMessageId;
  double _subagentProgress = 0.0;
  String? _subagentLabel;
  String? _activeTool;
  bool _isListening = false;
  String _sttBuffer = '';
  String? _currentlySpeakingId;

  bool _isInBackground = false;
  bool _isOnChatScreen = true;
  int _lastCompletionTimestamp = 0;

  StreamSubscription? _eventSubscription;

  ChatProvider({
    required SocketService socketService,
    required ConnectionProvider connectionProvider,
    NotificationService? notificationService,
    FlutterTts? tts,
    stt.SpeechToText? speech,
  })  : _socketService = socketService,
        _connectionProvider = connectionProvider,
        _notificationService = notificationService ?? LocalNotificationService(),
        _tts = tts ?? FlutterTts(),
        _speech = speech ?? stt.SpeechToText() {
    _initTts();
    WidgetsBinding.instance.addObserver(this);
    _eventSubscription = _socketService.eventStream.listen(_onSocketEvent);
  }

  NotificationService get notificationService => _notificationService;
  bool get isInBackground => _isInBackground;
  bool get isOnChatScreen => _isOnChatScreen;

  List<ChatMessage> get messages => List.unmodifiable(_messages);
  bool get isStreaming => _isStreaming;
  double get subagentProgress => _subagentProgress;
  String? get subagentLabel => _subagentLabel;
  String? get activeTool => _activeTool;
  bool get isListening => _isListening;
  String get sttBuffer => _sttBuffer;
  String? get currentlySpeakingId => _currentlySpeakingId;

  void updateAppInBackground(bool inBg) {
    _isInBackground = inBg;
  }

  void updateChatScreenActive(bool active) {
    _isOnChatScreen = active;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _isInBackground = (state != AppLifecycleState.resumed);
  }

  void _initTts() {
    try {
      _tts.setCompletionHandler(() {
        _currentlySpeakingId = null;
        notifyListeners();
      });
      _tts.setErrorHandler((_) {
        _currentlySpeakingId = null;
        notifyListeners();
      });
    } catch (_) {}
  }

  void _onSocketEvent(Map<String, dynamic> packet) {
    final event = packet['event'] as String?;
    final data = packet['data'] as Map<String, dynamic>? ?? {};

    switch (event) {
      case 'message:token':
        _handleToken(data);
        break;
      case 'agent:progress':
        _handleProgress(data);
        break;
      case 'agent:complete':
      case 'chat:complete':
      case 'message:complete':
      case 'message:completed':
        _handleAgentComplete(data);
        break;
      case 'step:completed':
        _handleStepCompleted(data);
        break;
      case 'approval:required':
        _handleApprovalRequired(data);
        break;
      case 'message:error':
        _handleMessageError(data);
        break;
    }
  }

  void _handleMessageError(Map<String, dynamic> data) {
    _isStreaming = false;
    final messageId = data['messageId'] as String? ?? _activeMessageId;
    final errorText = data['error'] as String? ?? data['message'] as String? ?? 'An error occurred processing your request.';

    if (messageId != null) {
      final index = _messages.indexWhere((m) => m.id == messageId);
      if (index != -1) {
        final old = _messages[index];
        _messages[index] = old.copyWith(
          content: old.content.isEmpty ? 'Error: $errorText' : '${old.content}\n\n[Error: $errorText]',
          isStreaming: false,
          stage: SubagentStage.completed,
        );
      } else {
        _messages.add(ChatMessage(
          id: messageId,
          role: MessageRole.assistant,
          content: 'Error: $errorText',
          timestamp: DateTime.now(),
          isStreaming: false,
          stage: SubagentStage.completed,
        ));
      }
    } else if (_messages.isNotEmpty && _messages.last.role == MessageRole.assistant) {
      final last = _messages.last;
      _messages[_messages.length - 1] = last.copyWith(
        content: last.content.isEmpty ? 'Error: $errorText' : '${last.content}\n\n[Error: $errorText]',
        isStreaming: false,
        stage: SubagentStage.completed,
      );
    } else {
      _messages.add(ChatMessage(
        id: 'msg_err_${DateTime.now().millisecondsSinceEpoch}',
        role: MessageRole.assistant,
        content: 'Error: $errorText',
        timestamp: DateTime.now(),
        isStreaming: false,
        stage: SubagentStage.completed,
      ));
    }
    notifyListeners();
  }

  void _handleToken(Map<String, dynamic> data) {
    final messageId = data['messageId'] as String?;
    final token = data['token'] as String? ?? '';
    final fullContent = data['fullContent'] as String?;

    if (messageId == null) return;

    final index = _messages.indexWhere((m) => m.id == messageId);
    if (index != -1) {
      final old = _messages[index];
      _messages[index] = old.copyWith(
        content: fullContent ?? (old.content + token),
        isStreaming: true,
      );
    } else {
      _messages.add(ChatMessage(
        id: messageId,
        role: MessageRole.assistant,
        content: fullContent ?? token,
        timestamp: DateTime.now(),
        isStreaming: true,
      ));
    }
    _isStreaming = true;
    _activeMessageId = messageId;
    notifyListeners();
  }

  void _handleProgress(Map<String, dynamic> data) {
    final percent = (data['percent'] as num?)?.toDouble() ?? 0.0;
    _subagentProgress = percent / 100.0;
    _subagentLabel = data['label'] as String? ?? 'Processing...';
    _activeTool = data['tool'] as String?;
    final stageStr = data['stage'] as String?;

    if (_activeMessageId != null) {
      final index = _messages.indexWhere((m) => m.id == _activeMessageId);
      if (index != -1) {
        _messages[index] = _messages[index].copyWith(
          stage: SubagentStage.fromString(stageStr),
          progressPercent: _subagentProgress,
          subagentName: data['subagentName'] as String?,
          activeTool: _activeTool,
        );
      }
    }

    if (stageStr == 'completed') {
      _isStreaming = false;
      _subagentProgress = 1.0;
      _triggerAiCompletion(data);
    }
    notifyListeners();
  }

  void _handleAgentComplete(Map<String, dynamic> data) {
    _isStreaming = false;
    _subagentProgress = 1.0;
    _subagentLabel = 'Completed';
    if (_activeMessageId != null) {
      final index = _messages.indexWhere((m) => m.id == _activeMessageId);
      if (index != -1) {
        _messages[index] = _messages[index].copyWith(
          isStreaming: false,
          progressPercent: 1.0,
          stage: SubagentStage.completed,
        );
      }
    }
    _triggerAiCompletion(data);
    notifyListeners();
  }

  Future<void> _triggerAiCompletion(Map<String, dynamic> data) async {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (now - _lastCompletionTimestamp < 1000) return;
    _lastCompletionTimestamp = now;

    // Trigger celebratory haptic pattern
    try {
      await HapticFeedback.mediumImpact();
    } catch (_) {}

    // Check if app is in background or user is not on the chat screen
    if (_isInBackground || !_isOnChatScreen) {
      final summary = _extractResponseSummary(data);
      await _notificationService.showAiCompletionNotification(
        title: 'Personal Assistant',
        body: summary,
      );
    }
  }

  String _extractResponseSummary(Map<String, dynamic> data) {
    if (data['summary'] is String && (data['summary'] as String).isNotEmpty) {
      return data['summary'] as String;
    }
    if (data['response'] is String && (data['response'] as String).isNotEmpty) {
      return data['response'] as String;
    }
    if (data['message'] is String && (data['message'] as String).isNotEmpty) {
      return data['message'] as String;
    }

    for (int i = _messages.length - 1; i >= 0; i--) {
      final msg = _messages[i];
      if (msg.role == MessageRole.assistant && msg.content.trim().isNotEmpty) {
        String clean = msg.content
            .replaceAll(RegExp(r'```[\s\S]*?```'), '')
            .replaceAll(RegExp(r'[\r\n]+'), ' ')
            .trim();
        if (clean.length > 120) {
          clean = '${clean.substring(0, 117)}...';
        }
        if (clean.isNotEmpty) {
          return clean;
        }
      }
    }

    return 'AI request completed.';
  }

  void _handleStepCompleted(Map<String, dynamic> data) {
    notifyListeners();
  }

  void _handleApprovalRequired(Map<String, dynamic> data) {
    final messageId = data['messageId'] as String? ?? 'appr_${DateTime.now().millisecondsSinceEpoch}';
    final approval = data['approval'] as Map<String, dynamic>?;

    _messages.add(ChatMessage(
      id: messageId,
      role: MessageRole.system,
      content: 'Action requires approval: ${approval?['description'] ?? 'Confirm tool execution'}',
      timestamp: DateTime.now(),
      stage: SubagentStage.approvalRequired,
      approvalData: approval,
    ));
    notifyListeners();
  }

  void sendMessage(String text) {
    if (text.trim().isEmpty) return;

    final session = _connectionProvider.session;
    if (session == null || !_connectionProvider.isConnected) return;

    final userMsg = ChatMessage.user(
      id: 'msg_user_${DateTime.now().millisecondsSinceEpoch}',
      content: text,
    );
    _messages.add(userMsg);
    _isStreaming = true;
    _subagentProgress = 0.0;
    _subagentLabel = 'Evaluating intent...';
    notifyListeners();

    _socketService.sendEvent(
      'chat:send',
      {'content': text, 'sessionId': 'mobile_main'},
      sessionToken: session.sessionToken,
      hmacSecret: session.hmacSecret,
    );
  }

  void sendApprovalResponse(String approvalId, bool approved) {
    final session = _connectionProvider.session;
    if (session == null) return;

    _socketService.sendEvent(
      'approval:response',
      {'approvalId': approvalId, 'approved': approved},
      sessionToken: session.sessionToken,
      hmacSecret: session.hmacSecret,
    );
  }

  Future<void> toggleReadAloud(ChatMessage message) async {
    if (_currentlySpeakingId == message.id) {
      await _tts.stop();
      _currentlySpeakingId = null;
    } else {
      await _tts.stop();
      _currentlySpeakingId = message.id;
      final cleanText = message.content
          .replaceAll(RegExp(r'```[\s\S]*?```'), 'code snippet omitted')
          .replaceAll(RegExp(r'https?:\/\/\S+'), 'link');
      await _tts.speak(cleanText);
    }
    notifyListeners();
  }

  Future<void> startListening() async {
    final available = await _speech.initialize();
    if (available) {
      _isListening = true;
      _sttBuffer = '';
      notifyListeners();
      _speech.listen(
        onResult: (result) {
          _sttBuffer = result.recognizedWords;
          notifyListeners();
        },
      );
    }
  }

  Future<void> stopListening({bool submit = true}) async {
    await _speech.stop();
    _isListening = false;
    final text = _sttBuffer;
    _sttBuffer = '';
    notifyListeners();

    if (submit && text.isNotEmpty) {
      sendMessage(text);
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _eventSubscription?.cancel();
    _tts.stop().catchError((_) {});
    super.dispose();
  }
}
