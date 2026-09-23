import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/chat_message.dart';
import '../providers/chat_provider.dart';
import '../theme/gemini_theme.dart';
import '../widgets/gemini_gradient_bar.dart';
import '../widgets/waveform_pill.dart';

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  @override
  void dispose() {
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final chat = context.watch<ChatProvider>();

    WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

    return Scaffold(
      backgroundColor: GeminiColors.canvas,
      body: Column(
        children: [
          // Subagent progress indicator when streaming or reasoning
          if (chat.isStreaming && chat.subagentLabel != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              color: GeminiColors.surfaceContainer,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.bolt, color: GeminiColors.purpleProgress, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          chat.subagentLabel!,
                          style: const TextStyle(
                            color: GeminiColors.textPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Text(
                        '${(chat.subagentProgress * 100).toInt()}%',
                        style: const TextStyle(
                          color: GeminiColors.purpleProgress,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  GeminiGradientBar(value: chat.subagentProgress, height: 2),
                ],
              ),
            ),

          // Message list
          Expanded(
            child: chat.messages.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: chat.messages.length,
                    itemBuilder: (context, index) {
                      final msg = chat.messages[index];
                      return _buildMessageBubble(context, msg, chat);
                    },
                  ),
          ),

          // Voice dictation waveform or pill input bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: chat.isListening
                ? WaveformPill(onStop: () => chat.stopListening(submit: true))
                : _buildFloatingInputBar(context, chat),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: GeminiColors.surfaceContainer,
              shape: BoxShape.circle,
              border: Border.all(color: GeminiColors.border),
            ),
            child: const Icon(Icons.auto_awesome, color: GeminiColors.primary, size: 36),
          ),
          const SizedBox(height: 16),
          const Text(
            'Personal Assistant',
            style: TextStyle(
              color: GeminiColors.textPrimary,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Ask questions, run system actions, or control your PC.',
            style: TextStyle(color: GeminiColors.textMuted, fontSize: 13),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(BuildContext context, ChatMessage msg, ChatProvider chat) {
    final isUser = msg.role == MessageRole.user;
    final isSystem = msg.role == MessageRole.system;

    if (isSystem) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: GeminiColors.surfaceContainer,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: GeminiColors.warning.withOpacity(0.5)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: GeminiColors.warning, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    msg.content,
                    style: const TextStyle(color: GeminiColors.textPrimary, fontSize: 13),
                  ),
                ),
              ],
            ),
            if (msg.stage == SubagentStage.approvalRequired && msg.approvalData != null) ...[
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  TextButton(
                    onPressed: () {
                      final id = msg.approvalData?['id'] as String? ?? '';
                      chat.sendApprovalResponse(id, false);
                    },
                    child: const Text('Deny', style: TextStyle(color: GeminiColors.emergencyDanger)),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: () {
                      final id = msg.approvalData?['id'] as String? ?? '';
                      chat.sendApprovalResponse(id, true);
                    },
                    style: ElevatedButton.styleFrom(backgroundColor: GeminiColors.success),
                    child: const Text('Approve', style: TextStyle(color: GeminiColors.canvas)),
                  ),
                ],
              ),
            ],
          ],
        ),
      );
    }

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isUser ? GeminiColors.elevatedCard : GeminiColors.surfaceContainer,
          borderRadius: isUser ? GeminiRadii.userChatBubble : GeminiRadii.assistantChatBubble,
          border: Border.all(color: GeminiColors.border, width: 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              msg.content,
              style: const TextStyle(
                color: GeminiColors.textPrimary,
                fontSize: 15,
                height: 1.45,
              ),
            ),
            if (!isUser) ...[
              const SizedBox(height: 4),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    iconSize: 16,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: Icon(
                      chat.currentlySpeakingId == msg.id
                          ? Icons.volume_up
                          : Icons.volume_mute_outlined,
                      color: GeminiColors.textMuted,
                    ),
                    onPressed: () => chat.toggleReadAloud(msg),
                  ),
                  const SizedBox(width: 8),
                  if (msg.isStreaming)
                    const Text(
                      'streaming...',
                      style: TextStyle(color: GeminiColors.primary, fontSize: 11),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildFloatingInputBar(BuildContext context, ChatProvider chat) {
    return Container(
      decoration: BoxDecoration(
        color: GeminiColors.surfaceContainer,
        borderRadius: GeminiRadii.pill,
        border: Border.all(color: GeminiColors.border, width: 1),
      ),
      child: Row(
        children: [
          const SizedBox(width: 16),
          Expanded(
            child: TextField(
              controller: _textController,
              style: const TextStyle(color: GeminiColors.textPrimary, fontSize: 14),
              decoration: const InputDecoration(
                hintText: 'Ask Gemini or command PC...',
                hintStyle: TextStyle(color: GeminiColors.textMuted),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(vertical: 12),
              ),
              onSubmitted: (val) {
                if (val.trim().isNotEmpty) {
                  chat.sendMessage(val.trim());
                  _textController.clear();
                }
              },
            ),
          ),
          IconButton(
            icon: const Icon(Icons.mic, color: GeminiColors.primary, size: 22),
            onPressed: () => chat.startListening(),
          ),
          IconButton(
            icon: const Icon(Icons.send_rounded, color: GeminiColors.primary, size: 22),
            onPressed: () {
              final text = _textController.text.trim();
              if (text.isNotEmpty) {
                chat.sendMessage(text);
                _textController.clear();
              }
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }
}
