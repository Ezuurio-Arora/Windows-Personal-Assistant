import React, { useState, useEffect, useRef } from 'react';
import {
  Menu,
  Sparkles,
  User,
  Copy,
  Check,
  Terminal,
  Cpu,
  Camera,
  Search,
  Zap,
  Shield,
  Rocket,
  Volume2,
  Layers,
  Clipboard,
  ArrowDown
} from 'lucide-react';
import { AgentStepCard } from './AgentStepCard';
import { ApprovalCard } from './ApprovalCard';
import { MarkdownContent } from './MarkdownContent';
import { AgentProgressBar } from './AgentProgressBar';

export function ChatCanvas({
  messages,
  activeSession,
  onToggleSidebar,
  onResolveApproval,
  pendingApprovals,
  onSendPrompt,
  safetyMode,
  onToggleSafetyMode,
  persona,
  onSelectPersona,
  isGenerating,
  progressData,
  elapsedTime
}) {
  const scrollRef = useRef(null);
  const isUserScrolledUpRef = useRef(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState(null);

  const handleCopyMessage = async (text, msgId) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 2000);
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  // Monitor user scrolling to detect if they intentionally scrolled up to read earlier content
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If the user has scrolled more than 70px away from the bottom, they want to read earlier messages
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isUp = distanceFromBottom > 70;
    isUserScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      if (smooth) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      } else {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      isUserScrolledUpRef.current = false;
      setShowScrollBottom(false);
    }
  };

  // Only auto-scroll down if the user is ALREADY at or near the bottom!
  // If the user scrolled up, respect their intent and never glitch or jerk their view.
  useEffect(() => {
    if (!isUserScrolledUpRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingApprovals, isGenerating, progressData]);

  // When a brand new message is added from the user, immediately snap to bottom
  const prevCountRef = useRef(messages?.length || 0);
  useEffect(() => {
    const currentCount = messages?.length || 0;
    if (currentCount > prevCountRef.current) {
      const last = messages?.[messages.length - 1];
      if (last?.role === 'user') {
        scrollToBottom(false);
      }
    }
    prevCountRef.current = currentCount;
  }, [messages]);

  const isEmpty = !messages || messages.length === 0;

  const isAutonomous = safetyMode === 'yolo';

  const suggestionPrompts = [
    {
      title: 'System Health',
      subtitle: 'Inspect CPU, RAM & Disks',
      icon: <Cpu className="w-4 h-4 text-gemini-sparkle1" />,
      prompt: 'Check my Windows hardware stats: CPU load, RAM usage, and available disk space.'
    },
    {
      title: 'Capture Desktop',
      subtitle: 'Take a screenshot of PC screen',
      icon: <Camera className="w-4 h-4 text-pink-400" />,
      prompt: 'Take a live desktop screenshot and show me what is currently on my screen.'
    },
    {
      title: 'Top Running Processes',
      subtitle: 'List memory & CPU hogs',
      icon: <Layers className="w-4 h-4 text-orange-400" />,
      prompt: 'List the top 10 running processes on Windows sorted by memory usage.'
    },
    {
      title: 'Launch App / Script',
      subtitle: 'Open Calculator or Notepad',
      icon: <Rocket className="w-4 h-4 text-indigo-400" />,
      prompt: 'Launch the Windows Calculator application for me.'
    },
    {
      title: 'Search Files',
      subtitle: 'Find files on my computer',
      icon: <Search className="w-4 h-4 text-emerald-400" />,
      prompt: 'Search for recently modified files in my user directory.'
    },
    {
      title: 'Speak Aloud (TTS)',
      subtitle: 'Voice audio through PC speakers',
      icon: <Volume2 className="w-4 h-4 text-purple-400" />,
      prompt: 'Speak aloud through my PC speakers: "Personal Assistant is online and fully authorized."'
    }
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-gemini-bg relative">
      {/* Top Bar Header */}
      <header className="h-14 px-4 border-b border-gemini-elevated/40 flex items-center justify-between shrink-0 bg-gemini-bg/80 backdrop-blur-md z-10">
        <div className="flex items-center space-x-3 overflow-hidden">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-2 truncate">
            <h2 className="font-semibold text-sm text-gemini-text truncate max-w-xs sm:max-w-md">
              {activeSession?.title || 'Personal Assistant'}
            </h2>
          </div>
        </div>

        {/* Right controls: Permission Mode Toggle & Persona */}
        <div className="flex items-center space-x-2 shrink-0">
          {/* Persona selector */}
          <select
            value={persona || 'general'}
            onChange={(e) => onSelectPersona && onSelectPersona(e.target.value)}
            className="hidden sm:block text-xs bg-gemini-surface border border-gemini-elevated text-gemini-muted rounded-xl px-2.5 py-1.5 focus:outline-none hover:border-gemini-border"
          >
            <option value="general">Persona: General Assistant</option>
            <option value="coder">Persona: Dev Copilot</option>
            <option value="admin">Persona: SysAdmin</option>
            <option value="researcher">Persona: Web Researcher</option>
          </select>

          {/* Autonomous / Full Permission Toggle */}
          <button
            type="button"
            onClick={onToggleSafetyMode}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              isAutonomous
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
            }`}
            title={
              isAutonomous
                ? 'Autonomous Mode (Full Permission Granted - No Prompts)'
                : 'Interactive Mode (Asks approval before sensitive commands)'
            }
          >
            {isAutonomous ? (
              <>
                <Zap className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
                <span className="hidden sm:inline">Autonomous (Full Perms)</span>
              </>
            ) : (
              <>
                <Shield className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Interactive Mode</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Messages Scroll View */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scroll-smooth"
      >
        {isEmpty ? (
          /* Gemini Welcome Experience */
          <div className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[88%] mx-auto h-full flex flex-col justify-center py-8">
            <div className="mb-6 text-center sm:text-left">
              <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight mb-2">
                <span className="gemini-gradient-text">Hello,</span>
              </h1>
              <p className="text-2xl sm:text-3xl font-medium text-gemini-muted">
                How can I assist your PC today?
              </p>
            </div>

            {/* Suggestions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {suggestionPrompts.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSendPrompt(s.prompt)}
                  className="p-3.5 rounded-2xl bg-gemini-surface hover:bg-gemini-elevated border border-gemini-elevated hover:border-gemini-border text-left transition-all duration-200 group gemini-card-shadow"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-sm text-gemini-text group-hover:text-gemini-blue transition-colors">
                      {s.title}
                    </span>
                    <div className="p-1.5 rounded-lg bg-gemini-bg border border-gemini-elevated">
                      {s.icon}
                    </div>
                  </div>
                  <p className="text-xs text-gemini-muted">{s.subtitle}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message Stream */
          <div className="w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[88%] mx-auto space-y-6 px-1 sm:px-2 md:px-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start space-x-3.5 ${
                    isUser ? 'justify-end' : 'justify-start w-full'
                  }`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-full bg-gemini-surface border border-gemini-elevated flex items-center justify-center shrink-0 mt-1 shadow-sm">
                      <img src="/gemini-spark.svg" alt="Gemini" className="w-5 h-5" />
                    </div>
                  )}

                  <div className={isUser ? 'max-w-[85%] sm:max-w-[75%] order-1' : 'flex-1 min-w-0 order-2'}>
                    {/* User bubble */}
                    {isUser ? (
                      <div className="group relative inline-block">
                        <div className="px-4 py-2.5 rounded-3xl bg-gemini-elevated text-gemini-text text-sm sm:text-base leading-relaxed break-words gemini-pill-shadow inline-block select-text cursor-text">
                          {msg.content}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.content, msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-3 right-2 p-1.5 rounded-full bg-gemini-surface border border-gemini-elevated text-gemini-muted hover:text-gemini-text shadow-sm"
                          title="Copy prompt"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    ) : (
                      /* Assistant response container */
                      <div className="text-gemini-text text-sm sm:text-base leading-relaxed space-y-3 select-text cursor-text group relative">
                        {/* Agent Steps / Tool Runs */}
                        {msg.steps && msg.steps.length > 0 && (
                          <div className="space-y-1 my-2">
                            {msg.steps.map((step) => (
                              <AgentStepCard key={step.id} step={step} />
                            ))}
                          </div>
                        )}

                        {/* Interactive Approvals for this message */}
                        {pendingApprovals && pendingApprovals[msg.id] && (
                          <ApprovalCard
                            approval={pendingApprovals[msg.id]}
                            onResolve={onResolveApproval}
                          />
                        )}

                        {/* Content text */}
                        {msg.content ? (
                          <>
                            <MarkdownContent content={msg.content} isError={msg.isError} />
                            <div className="flex items-center space-x-2 pt-1">
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-gemini-surface hover:bg-gemini-elevated border border-gemini-elevated text-xs text-gemini-muted hover:text-gemini-text transition-all shadow-sm"
                                title="Copy response text"
                              >
                                {copiedMsgId === msg.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400 text-xs">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span className="text-xs">Copy text</span>
                                  </>
                                )}
                              </button>
                            </div>
                            {isGenerating && msg.id === messages[messages.length - 1]?.id && (
                              <div className="pt-2">
                                <AgentProgressBar
                                  isGenerating={isGenerating}
                                  progressData={progressData}
                                  elapsedTime={elapsedTime}
                                />
                              </div>
                            )}
                          </>
                        ) : isGenerating ? (
                          <AgentProgressBar
                            isGenerating={isGenerating}
                            progressData={progressData}
                            elapsedTime={elapsedTime}
                          />
                        ) : (
                          <div className="text-xs text-amber-400/90 py-2.5 px-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                            ⚠️ No response received from model provider. Please ensure your runner (LM Studio on port 1234 or Ollama on port 11434) is started, or enter an API key in Settings.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Immediate loader if assistant message not yet created in session */}
            {isGenerating && (!messages.length || messages[messages.length - 1]?.role === 'user') && (
              <div className="flex items-start space-x-3.5 justify-start">
                <div className="w-8 h-8 rounded-full bg-gemini-surface border border-gemini-elevated flex items-center justify-center shrink-0 mt-1 shadow-sm">
                  <img src="/gemini-spark.svg" alt="Gemini" className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 order-2 w-full">
                  <AgentProgressBar
                    isGenerating={isGenerating}
                    progressData={progressData}
                    elapsedTime={elapsedTime}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Floating Scroll to Latest Button when User is Scrolled Up */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-4 right-6 z-30 flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1E1F20] border border-[#3C4043] text-xs font-medium text-[#E3E3E3] hover:bg-[#282A2C] hover:border-[#7DACF8] shadow-2xl transition-all"
          title="Scroll to latest messages"
        >
          <ArrowDown className="w-3.5 h-3.5 text-[#7DACF8]" />
          <span>Scroll to latest</span>
        </button>
      )}
    </div>
  );
}
