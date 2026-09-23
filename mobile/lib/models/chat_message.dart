enum MessageRole { user, assistant, system }

enum SubagentStage {
  evaluating,
  subagentExecution,
  synthesizing,
  generating,
  completed,
  approvalRequired,
  error;

  static SubagentStage fromString(String? val) {
    switch (val) {
      case 'evaluating':
        return SubagentStage.evaluating;
      case 'subagent_execution':
        return SubagentStage.subagentExecution;
      case 'synthesizing':
        return SubagentStage.synthesizing;
      case 'generating':
        return SubagentStage.generating;
      case 'completed':
        return SubagentStage.completed;
      case 'approval_required':
        return SubagentStage.approvalRequired;
      case 'error':
        return SubagentStage.error;
      default:
        return SubagentStage.evaluating;
    }
  }

  String toWireString() {
    switch (this) {
      case SubagentStage.evaluating:
        return 'evaluating';
      case SubagentStage.subagentExecution:
        return 'subagent_execution';
      case SubagentStage.synthesizing:
        return 'synthesizing';
      case SubagentStage.generating:
        return 'generating';
      case SubagentStage.completed:
        return 'completed';
      case SubagentStage.approvalRequired:
        return 'approval_required';
      case SubagentStage.error:
        return 'error';
    }
  }
}

class ChatMessage {
  final String id;
  final MessageRole role;
  final String content;
  final DateTime timestamp;
  final bool isStreaming;
  final SubagentStage? stage;
  final double? progressPercent;
  final String? subagentName;
  final String? activeTool;
  final Map<String, dynamic>? approvalData;
  final bool isSpeaking;

  const ChatMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.isStreaming = false,
    this.stage,
    this.progressPercent,
    this.subagentName,
    this.activeTool,
    this.approvalData,
    this.isSpeaking = false,
  });

  factory ChatMessage.user({required String id, required String content}) {
    return ChatMessage(
      id: id,
      role: MessageRole.user,
      content: content,
      timestamp: DateTime.now(),
    );
  }

  factory ChatMessage.assistant({
    required String id,
    String content = '',
    bool isStreaming = true,
  }) {
    return ChatMessage(
      id: id,
      role: MessageRole.assistant,
      content: content,
      timestamp: DateTime.now(),
      isStreaming: isStreaming,
    );
  }

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String? ?? 'msg_${DateTime.now().millisecondsSinceEpoch}',
      role: _parseRole(json['role'] as String?),
      content: json['content'] as String? ?? '',
      timestamp: json['timestamp'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['timestamp'] as int)
          : DateTime.now(),
      isStreaming: json['isStreaming'] as bool? ?? false,
      stage: json['stage'] != null
          ? SubagentStage.fromString(json['stage'] as String)
          : null,
      progressPercent: (json['progressPercent'] as num?)?.toDouble(),
      subagentName: json['subagentName'] as String?,
      activeTool: json['activeTool'] as String?,
      approvalData: json['approvalData'] as Map<String, dynamic>?,
      isSpeaking: json['isSpeaking'] as bool? ?? false,
    );
  }

  static MessageRole _parseRole(String? role) {
    switch (role?.toLowerCase()) {
      case 'user':
        return MessageRole.user;
      case 'system':
        return MessageRole.system;
      case 'assistant':
      default:
        return MessageRole.assistant;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'role': role.name,
      'content': content,
      'timestamp': timestamp.millisecondsSinceEpoch,
      'isStreaming': isStreaming,
      if (stage != null) 'stage': stage!.toWireString(),
      if (progressPercent != null) 'progressPercent': progressPercent,
      if (subagentName != null) 'subagentName': subagentName,
      if (activeTool != null) 'activeTool': activeTool,
      if (approvalData != null) 'approvalData': approvalData,
      'isSpeaking': isSpeaking,
    };
  }

  ChatMessage copyWith({
    String? id,
    MessageRole? role,
    String? content,
    DateTime? timestamp,
    bool? isStreaming,
    SubagentStage? stage,
    double? progressPercent,
    String? subagentName,
    String? activeTool,
    Map<String, dynamic>? approvalData,
    bool? isSpeaking,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      role: role ?? this.role,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      isStreaming: isStreaming ?? this.isStreaming,
      stage: stage ?? this.stage,
      progressPercent: progressPercent ?? this.progressPercent,
      subagentName: subagentName ?? this.subagentName,
      activeTool: activeTool ?? this.activeTool,
      approvalData: approvalData ?? this.approvalData,
      isSpeaking: isSpeaking ?? this.isSpeaking,
    );
  }
}
