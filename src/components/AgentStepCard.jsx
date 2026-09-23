import React, { useState } from 'react';
import {
  Sparkles,
  Terminal,
  FileText,
  Activity,
  Camera,
  MousePointer,
  Globe,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Rocket,
  Layers,
  Clipboard,
  Bell,
  Volume2,
  Wifi
} from 'lucide-react';

export function AgentStepCard({ step }) {
  const [expanded, setExpanded] = useState(false);

  const getToolIcon = (tool) => {
    switch (tool) {
      case 'run_command':
        return <Terminal className="w-4 h-4 text-gemini-blue" />;
      case 'launch_app':
        return <Rocket className="w-4 h-4 text-indigo-400" />;
      case 'list_processes':
      case 'kill_process':
      case 'get_listening_ports':
        return <Layers className="w-4 h-4 text-orange-400" />;
      case 'get_clipboard':
      case 'set_clipboard':
        return <Clipboard className="w-4 h-4 text-cyan-400" />;
      case 'show_notification':
        return <Bell className="w-4 h-4 text-yellow-400" />;
      case 'speak_text':
        return <Volume2 className="w-4 h-4 text-purple-400" />;
      case 'ping_host':
      case 'get_network_config':
        return <Wifi className="w-4 h-4 text-emerald-400" />;
      case 'search_files':
      case 'read_file':
      case 'write_file':
      case 'list_directory':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'get_system_metrics':
      case 'set_volume':
      case 'power_action':
      case 'get_active_window':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'capture_screen':
        return <Camera className="w-4 h-4 text-pink-400" />;
      case 'mouse_click':
      case 'type_text':
        return <MousePointer className="w-4 h-4 text-fuchsia-400" />;
      case 'search_web':
      case 'fetch_web_content':
        return <Globe className="w-4 h-4 text-sky-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-gemini-sparkle1" />;
    }
  };

  const formatToolTitle = (tool, input) => {
    switch (tool) {
      case 'run_command':
        return `PowerShell: ${input?.command ? (input.command.length > 40 ? input.command.substring(0, 40) + '...' : input.command) : 'execute'}`;
      case 'launch_app':
        return `Launch App: "${input?.appOrPath || ''}"`;
      case 'list_processes':
        return `List Windows Processes`;
      case 'kill_process':
        return `Terminate Process: ${input?.processIdOrName || ''}`;
      case 'get_listening_ports':
        return `Inspect Network Ports`;
      case 'get_clipboard':
        return `Read Windows Clipboard`;
      case 'set_clipboard':
        return `Copy Text to Clipboard`;
      case 'show_notification':
        return `Toast Notification: "${input?.title || ''}"`;
      case 'speak_text':
        return `Speak via TTS: "${input?.text ? (input.text.length > 30 ? input.text.substring(0, 30) + '...' : input.text) : ''}"`;
      case 'ping_host':
        return `Ping: ${input?.host || '8.8.8.8'}`;
      case 'get_network_config':
        return `Network Adapter Config`;
      case 'search_files':
        return `Search files: "${input?.pattern || '*'}"`;
      case 'read_file':
        return `Read file: ${input?.filePath?.split(/[\\/]/).pop() || ''}`;
      case 'write_file':
        return `Write file: ${input?.filePath?.split(/[\\/]/).pop() || ''}`;
      case 'list_directory':
        return `List directory: ${input?.dirPath || 'current'}`;
      case 'get_system_metrics':
        return `Inspect Windows hardware metrics`;
      case 'set_volume':
        return `Adjust volume: ${input?.level}`;
      case 'power_action':
        return `Power action: ${input?.action}`;
      case 'capture_screen':
        return `Capture desktop screen`;
      case 'mouse_click':
        return `Mouse click (${input?.button || 'left'})`;
      case 'type_text':
        return `Simulate typing`;
      case 'search_web':
        return `Web search: "${input?.query || ''}"`;
      default:
        return tool || 'Agent Action';
    }
  };

  const isCompleted = step.status === 'completed';
  const isFailed = step.status === 'failed';
  const isRejected = step.status === 'rejected';
  const isRunning = step.status === 'running' || step.status === 'awaiting_approval';

  return (
    <div className="my-2 rounded-xl bg-gemini-surface border border-gemini-elevated/70 overflow-hidden text-sm transition-all duration-200 hover:border-gemini-border">
      {/* Step Header Chip */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-gemini-hover/30 transition-colors"
      >
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="p-1 rounded-md bg-gemini-bg/60 flex items-center justify-center">
            {getToolIcon(step.tool)}
          </div>
          <span className="font-medium text-xs text-gemini-text truncate">
            {formatToolTitle(step.tool, step.input)}
          </span>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {isRunning && (
            <div className="flex items-center space-x-1.5 text-xs text-gemini-sparkle1">
              <span className="w-2 h-2 rounded-full bg-gemini-sparkle1 animate-ping" />
              <span>Running</span>
            </div>
          )}
          {isCompleted && (
            <div className="flex items-center space-x-1 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Done</span>
            </div>
          )}
          {isRejected && (
            <div className="flex items-center space-x-1 text-xs text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Rejected</span>
            </div>
          )}
          {isFailed && (
            <div className="flex items-center space-x-1 text-xs text-rose-400">
              <XCircle className="w-3.5 h-3.5" />
              <span>Error</span>
            </div>
          )}
          <span className="text-gemini-muted">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </span>
        </div>
      </button>

      {/* Expanded Accordion Body */}
      {expanded && (
        <div className="px-4 py-3 bg-gemini-bg/50 border-t border-gemini-elevated/50 font-mono text-xs text-gemini-text/90 space-y-2.5">
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <span className="text-gemini-muted font-sans font-semibold block mb-1">Input Parameters:</span>
              <pre className="p-2 rounded bg-gemini-bg border border-gemini-elevated overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}

          {step.output && (
            <div>
              <span className="text-gemini-muted font-sans font-semibold block mb-1">Execution Output:</span>
              <pre className="p-2 rounded bg-gemini-bg border border-gemini-elevated overflow-x-auto max-h-48 whitespace-pre-wrap">
                {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}

          {/* Desktop Screenshot Preview */}
          {step.snapshot && (
            <div>
              <span className="text-gemini-muted font-sans font-semibold block mb-1">Captured Screen Preview:</span>
              <div className="rounded-lg overflow-hidden border border-gemini-border shadow-lg">
                <img src={step.snapshot} alt="Desktop Preview" className="w-full h-auto object-contain" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
