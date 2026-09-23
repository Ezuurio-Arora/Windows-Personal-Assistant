import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Cpu, Shield, Key, Globe, Check, CheckCircle2, AlertCircle } from 'lucide-react';

export function SettingsModal({ isOpen, onClose, onSave }) {
  const [providers, setProviders] = useState([]);
  const [settings, setSettings] = useState({
    activeProvider: 'lmstudio',
    model: 'default',
    customBaseUrl: '',
    customApiKey: '',
    safetyMode: 'tiered'
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadProviders();
  }, [isOpen]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/providers');
      if (data.providers) {
        setProviders(data.providers);
        const activeP = data.providers.find((p) => p.id === (data.settings?.activeProvider || 'lmstudio'));
        if (activeP && activeP.models && activeP.models.length > 0) {
          if (!data.settings?.model || data.settings?.model === 'default') {
            data.settings.model = activeP.models[0];
          }
        }
      }
      if (data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      const data = await res.json();
      setSaved(true);
      if (onSave) onSave(data);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 800);
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    }
  };

  const currentProvider = providers.find((p) => p.id === settings.activeProvider);
  const availableModels = currentProvider?.models || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-gemini-surface border border-gemini-border shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gemini-elevated">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-gemini-blue/10 text-gemini-blue">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-gemini-text">Model Providers & Settings</h3>
              <p className="text-xs text-gemini-muted">Select local LLM runner or cloud provider</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="py-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Provider Preset Picker */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gemini-muted uppercase tracking-wider">
                Select Model Provider
              </label>
              <button
                type="button"
                onClick={loadProviders}
                disabled={loading}
                className="text-xs text-gemini-blue hover:text-gemini-sparkle1 flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Auto-detect Local Ports</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {providers.map((p) => {
                const isSelected = settings.activeProvider === p.id;
                const isOnline = p.status === 'online';

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSettings({
                        ...settings,
                        activeProvider: p.id,
                        model: p.models?.[0] || 'default'
                      });
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'bg-gemini-elevated border-gemini-blue ring-1 ring-gemini-blue/40'
                        : 'bg-gemini-bg border-gemini-elevated hover:border-gemini-border'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-gemini-text">{p.name}</span>
                      {p.port && (
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isOnline ? 'bg-emerald-400' : 'bg-gemini-muted/40'
                          }`}
                          title={isOnline ? 'Online & Detected' : 'Offline'}
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-gemini-muted font-mono truncate">
                      {p.baseUrl}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection */}
          {availableModels.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gemini-muted uppercase tracking-wider block mb-1.5">
                Loaded Model
              </label>
              <select
                value={settings.model}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full p-2.5 rounded-xl bg-gemini-bg border border-gemini-elevated text-xs text-gemini-text focus:outline-none focus:border-gemini-blue"
              >
                {availableModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Base URL & API Key */}
          <div className="space-y-3 pt-2 border-t border-gemini-elevated">
            <div>
              <label className="text-xs font-medium text-gemini-text block mb-1">
                Custom Base URL (Optional override)
              </label>
              <input
                type="text"
                value={settings.customBaseUrl || ''}
                onChange={(e) => setSettings({ ...settings, customBaseUrl: e.target.value })}
                placeholder="e.g. http://localhost:1234/v1"
                className="w-full p-2.5 rounded-xl bg-gemini-bg border border-gemini-elevated text-xs text-gemini-text focus:outline-none focus:border-gemini-blue font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gemini-text block mb-1">
                API Key (Optional / For OpenAI or Gemini API)
              </label>
              <input
                type="password"
                value={settings.customApiKey || ''}
                onChange={(e) => setSettings({ ...settings, customApiKey: e.target.value })}
                placeholder="sk-..."
                className="w-full p-2.5 rounded-xl bg-gemini-bg border border-gemini-elevated text-xs text-gemini-text focus:outline-none focus:border-gemini-blue font-mono"
              />
            </div>
          </div>

          {/* Safety Execution Mode */}
          <div className="pt-2 border-t border-gemini-elevated">
            <label className="text-xs font-semibold text-gemini-muted uppercase tracking-wider block mb-2">
              Agent Execution Safeguards
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, safetyMode: 'tiered' })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  settings.safetyMode === 'tiered'
                    ? 'bg-gemini-elevated border-gemini-blue'
                    : 'bg-gemini-bg border-gemini-elevated hover:border-gemini-border'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-semibold text-xs text-gemini-text mb-1">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span>Interactive Approval</span>
                </div>
                <p className="text-[11px] text-gemini-muted leading-tight">
                  Require tap-to-confirm for PowerShell, file writes, and GUI actions.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, safetyMode: 'yolo' })}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  settings.safetyMode === 'yolo'
                    ? 'bg-gemini-elevated border-gemini-blue'
                    : 'bg-gemini-bg border-gemini-elevated hover:border-gemini-border'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-semibold text-xs text-gemini-text mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Full Autonomous</span>
                </div>
                <p className="text-[11px] text-gemini-muted leading-tight">
                  Auto-execute all tool calls without pausing for manual approval.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-2.5 pt-4 border-t border-gemini-elevated">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-gemini-blue hover:bg-gemini-blue-dark text-slate-950 font-semibold text-xs shadow-md transition-all flex items-center space-x-1.5"
          >
            {saved ? <Check className="w-4 h-4 stroke-[3]" /> : null}
            <span>{saved ? 'Saved!' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
