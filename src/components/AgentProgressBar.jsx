import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Sparkles,
  Terminal,
  Cpu,
  Layers,
  FileText,
  Clock,
  Zap,
  Activity,
  Bot,
  MousePointer,
  CheckCircle2
} from 'lucide-react';

/**
 * High-precision Google Gemini-style progress bar and live subagent status indicator.
 * Smoothly interpolates progress percentage, tracks live generation timer,
 * and dynamically displays active subagents (GUI, Document, System) in real-time.
 */
export function AgentProgressBar({
  isGenerating,
  progressData,
  elapsedTime: propElapsedTime,
  className = ''
}) {
  const [localElapsed, setLocalElapsed] = useState(0);
  const [smoothPercent, setSmoothPercent] = useState(15);
  const animFrameRef = useRef(null);

  // Live timer ticking every 100ms
  useEffect(() => {
    if (!isGenerating) {
      setLocalElapsed(0);
      setSmoothPercent(0);
      return;
    }

    const start = performance.now();
    const interval = setInterval(() => {
      const seconds = (performance.now() - start) / 1000;
      setLocalElapsed(seconds);
    }, 100);

    return () => clearInterval(interval);
  }, [isGenerating]);

  // Target percentage calculation based on server updates & stages
  const targetPercent = useMemo(() => {
    if (!isGenerating) return 0;
    if (typeof progressData?.percent === 'number') {
      return Math.min(100, Math.max(10, progressData.percent));
    }
    const st = progressData?.stage;
    switch (st) {
      case 'init':
        return 15;
      case 'evaluating':
        return 30;
      case 'subagent_execution':
      case 'tool':
        return 65;
      case 'synthesizing':
      case 'synthesis':
        return 80;
      case 'generating':
        return 90;
      case 'completed':
      case 'done':
        return 100;
      default:
        return 35;
    }
  }, [isGenerating, progressData?.percent, progressData?.stage]);

  // Smooth continuous progress gliding so the progress bar never looks stuck
  useEffect(() => {
    if (!isGenerating) {
      setSmoothPercent(0);
      return;
    }

    let current = smoothPercent;
    const step = () => {
      const target = targetPercent;
      if (current < target) {
        // Fast catch-up
        current += Math.max(0.3, (target - current) * 0.12);
      } else if (current < 96 && (progressData?.stage === 'evaluating' || progressData?.stage === 'generating')) {
        // Gentle creep while model is thinking/generating tokens
        current += 0.04;
      }
      setSmoothPercent(Math.min(99.5, current));
      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isGenerating, targetPercent, progressData?.stage]);

  if (!isGenerating) return null;

  const currentElapsed =
    typeof propElapsedTime === 'number' && propElapsedTime >= 0
      ? propElapsedTime
      : localElapsed;

  const formattedTime = `${currentElapsed.toFixed(1)}s`;

  // Extract stage and label
  const stage = progressData?.stage || 'evaluating';
  const label =
    progressData?.label ||
    (stage === 'init'
      ? 'Initializing AI runner...'
      : stage === 'evaluating'
      ? 'Evaluating prompt with AI model engine...'
      : stage === 'subagent_execution' || stage === 'tool'
      ? `Sub-agent executing: ${progressData?.tool || 'system action'}...`
      : stage === 'synthesizing' || stage === 'synthesis'
      ? 'Synthesizing final answer...'
      : stage === 'generating'
      ? 'Streaming response...'
      : stage === 'completed' || stage === 'done'
      ? 'Complete'
      : 'Processing...');

  const subagentName = progressData?.subagentName || (
    stage === 'subagent_execution'
      ? (progressData?.tool?.includes('mouse') || progressData?.tool?.includes('type') || progressData?.tool?.includes('gui') || progressData?.tool?.includes('window')
          ? 'GUI & Automation Sub-agent'
          : progressData?.tool?.includes('word') || progressData?.tool?.includes('doc') || progressData?.tool?.includes('app')
          ? 'Document & App Sub-agent'
          : 'System & Research Sub-agent')
      : null
  );

  // Dynamic Icon
  const renderIcon = () => {
    if (stage === 'subagent_execution' || stage === 'tool') {
      if (progressData?.tool?.includes('mouse') || progressData?.tool?.includes('cursor')) {
        return <MousePointer className="w-4 h-4 text-[#B87CF8] animate-pulse" />;
      }
      return <Terminal className="w-4 h-4 text-[#B87CF8] animate-pulse" />;
    }
    if (stage === 'synthesizing' || stage === 'synthesis') {
      return <Layers className="w-4 h-4 text-[#A8C7FA]" />;
    }
    if (stage === 'generating') {
      return <FileText className="w-4 h-4 text-[#7DACF8] animate-pulse" />;
    }
    return <Sparkles className="w-4 h-4 text-[#7DACF8] animate-spin" style={{ animationDuration: '4s' }} />;
  };

  const STAGES = [
    { id: 'evaluating', label: 'Evaluate' },
    { id: 'subagent_execution', label: 'Sub-agent' },
    { id: 'synthesizing', label: 'Synthesize' },
    { id: 'generating', label: 'Generate' }
  ];

  const currentStageIndex = (() => {
    switch (stage) {
      case 'init':
      case 'evaluating':
        return 0;
      case 'subagent_execution':
      case 'tool':
        return 1;
      case 'synthesizing':
      case 'synthesis':
        return 2;
      case 'generating':
      case 'completed':
      case 'done':
        return 3;
      default:
        return 0;
    }
  })();

  const displayPercent = Math.round(smoothPercent);

  return (
    <div
      className={`w-full max-w-full rounded-2xl border border-[#282A2C] bg-[#1E1F20] p-3.5 sm:p-4 shadow-xl gemini-card-shadow transition-all duration-300 ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Top Header Row: Stage Icon, Live Label & Elapsed Seconds */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-[#282A2C] border border-[#3C4043]/60 flex items-center justify-center shrink-0 shadow-inner">
            {renderIcon()}
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-2">
              <span className="text-xs sm:text-sm font-medium text-gemini-text truncate block">
                {label}
              </span>
              {subagentName && (
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-[#B87CF8]/15 border border-[#B87CF8]/40 text-[10px] font-semibold text-[#D4B5FC]">
                  {subagentName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Elapsed Timer & Percentage Badge */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#131314] border border-[#282A2C] text-xs font-mono text-[#7DACF8]">
            <Clock className="w-3 h-3 text-[#7DACF8]" />
            <span>Thinking... {formattedTime}</span>
          </div>
          <span className="text-[11px] font-semibold text-[#A8C7FA] min-w-[2.4rem] text-right font-mono">
            {displayPercent}%
          </span>
        </div>
      </div>

      {/* Gemini Animated Glowing Progress Bar Track */}
      <div className="relative w-full h-2.5 rounded-full bg-[#131314] overflow-hidden border border-[#282A2C]/70">
        {/* Animated fill with glowing gradient from #7DACF8 to #B87CF8 */}
        <div
          className="h-full rounded-full transition-all duration-150 ease-out relative overflow-hidden"
          style={{
            width: `${smoothPercent}%`,
            background: 'linear-gradient(90deg, #7DACF8 0%, #9FA8DA 50%, #B87CF8 100%)',
            boxShadow: '0 0 14px rgba(125, 172, 248, 0.7), 0 0 24px rgba(184, 124, 248, 0.5)'
          }}
        >
          {/* Continuous Shimmer Light Ray Effect */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.5) 50%, transparent 100%)',
              animation: 'gemini-shimmer 1.6s infinite linear'
            }}
          />
        </div>
      </div>

      {/* Dynamic Stage Breadcrumb Stepper */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-[#282A2C]/50 px-1">
        {STAGES.map((s, idx) => {
          const isActive = idx === currentStageIndex;
          const isPassed = idx < currentStageIndex;

          return (
            <div
              key={s.id}
              className={`flex items-center space-x-1.5 text-[10px] tracking-wide transition-colors ${
                isActive
                  ? 'text-[#7DACF8] font-semibold'
                  : isPassed
                  ? 'text-gemini-text/80'
                  : 'text-[#8E918F]/50'
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  isActive
                    ? 'bg-[#7DACF8] scale-125 shadow-[0_0_8px_#7DACF8]'
                    : isPassed
                    ? 'bg-[#B87CF8]'
                    : 'bg-[#3C4043]'
                }`}
              />
              <span className="hidden xs:inline sm:inline">{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AgentProgressBar;
