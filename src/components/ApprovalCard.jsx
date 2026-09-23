import React, { useState } from 'react';
import { ShieldAlert, Check, X, Terminal, FileText, MousePointer, Power } from 'lucide-react';

export function ApprovalCard({ approval, onResolve }) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (approved) => {
    setLoading(true);
    await onResolve(approval.approvalId, approved);
    setLoading(false);
  };

  const getToolIcon = (tool) => {
    switch (tool) {
      case 'run_command':
        return <Terminal className="w-5 h-5 text-amber-400" />;
      case 'write_file':
        return <FileText className="w-5 h-5 text-amber-400" />;
      case 'power_action':
        return <Power className="w-5 h-5 text-rose-400" />;
      default:
        return <MousePointer className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div className="my-3 p-4 rounded-2xl bg-gemini-surface border-2 border-amber-500/40 shadow-xl max-w-lg transition-all">
      <div className="flex items-start space-x-3 mb-3">
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 shrink-0">
          {getToolIcon(approval.toolName)}
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
              Action Approval Required
            </span>
          </div>
          <h4 className="text-sm font-semibold text-gemini-text mt-0.5">
            {approval.toolName === 'run_command'
              ? 'Execute PowerShell / CMD Script'
              : approval.toolName === 'write_file'
              ? 'Modify / Write File on PC'
              : approval.toolName === 'power_action'
              ? 'Change PC Power State'
              : `Execute ${approval.toolName}`}
          </h4>
          <p className="text-xs text-gemini-muted mt-1">{approval.description}</p>
        </div>
      </div>

      {/* Target/Input details */}
      {approval.input && (
        <div className="mb-4 p-3 rounded-xl bg-gemini-bg border border-gemini-elevated font-mono text-xs text-gemini-text/90 overflow-x-auto whitespace-pre-wrap max-h-36">
          {approval.input.command || approval.input.filePath || JSON.stringify(approval.input, null, 2)}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end space-x-3 pt-1">
        <button
          type="button"
          disabled={loading}
          onClick={() => handleAction(false)}
          className="px-4 py-2 rounded-xl bg-gemini-elevated hover:bg-rose-500/20 hover:text-rose-300 text-xs font-medium text-gemini-muted transition-colors flex items-center space-x-1.5"
        >
          <X className="w-3.5 h-3.5" />
          <span>Reject</span>
        </button>

        <button
          type="button"
          disabled={loading}
          onClick={() => handleAction(true)}
          className="px-4 py-2 rounded-xl bg-gemini-blue hover:bg-gemini-blue-dark text-xs font-medium text-slate-950 font-semibold shadow-md transition-all flex items-center space-x-1.5"
        >
          <Check className="w-3.5 h-3.5 stroke-[3]" />
          <span>Approve & Run</span>
        </button>
      </div>
    </div>
  );
}
