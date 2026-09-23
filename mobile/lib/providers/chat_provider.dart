import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../models/chat_message.dart';
import '../services/socket_service.dart';
import 'connection_provider.dart';

class ChatProvider extends ChangeNotifier {
  final SocketService _socketService;
  final ConnectionProvider _connectionProvider;
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

  StreamSubscription? _eventSubscription;

  ChatProvider({
    required SocketService socketService,
    required ConnectionProvider connectionProvider,
    FlutterTts? tts,
    stt.SpeechToText? speech,
  })  : _socketService = socketService,
        _connectionProvider = connectionProvider,
        _tts = tts ?? FlutterTts(),
        _speech = speech ?? stt.SpeechToText() {
    _initTts();
    _eventSubscription = _socketService.eventStream.listen(_onSocketEvent);
  }

  List<ChatMessage> get messages => List.unmodifiable(_messages);
  bool get isStreaming => _isStreaming;
  double get subagentProgress => _subagentProgress;
  String? get subagentLabel => _subagentLabel;
  String? get activeTool => _activeTool;
  bool get isListening => _isListening;
  String get sttBuffer => _sttBuffer;
  String? get currentlySpeakingId => _currentlySpeakingId;

  void _initTts() {
    _tts.setCompletionHandler(() {
      _currentlySpeakingId = null;
      notifyListeners();
    });
    _tts.setErrorHandler((_) {
      _currentlySpeakingId = null;
      notifyListeners();
    });
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
      case 'step:completed':
        _handleStepCompleted(data);
        break;
      case 'approval:required':
        _handleApprovalRequired(data);
        break;
    }
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
    }
    notifyListeners();
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
    _eventSubscription?.cancel();
    _tts.stop();
    super.dispose();
  }
}
