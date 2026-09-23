import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatCanvas } from './components/ChatCanvas';
import { InputBar } from './components/InputBar';
import { PairingModal } from './components/PairingModal';
import { SettingsModal } from './components/SettingsModal';

export function App() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pairingOpen, setPairingOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState(null);
  const [settings, setSettings] = useState({
    activeProvider: 'lmstudio',
    safetyMode: 'yolo', // default to full permissions as requested
    persona: 'general'
  });
  const [pendingApprovals, setPendingApprovals] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressData, setProgressData] = useState(null);
  const [generationStartTime, setGenerationStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const wsRef = useRef(null);

  // Live timer for elapsed generation duration
  useEffect(() => {
    let timer = null;
    if (isGenerating && generationStartTime) {
      timer = setInterval(() => {
        const secs = (Date.now() - generationStartTime) / 1000;
        setElapsedTime(Number(secs.toFixed(1)));
      }, 100);
    } else if (!isGenerating) {
      clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating, generationStartTime]);

  useEffect(() => {
    loadSessions();
    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetch(`/api/sessions/${activeSessionId}`)
        .then((res) => res.json())
        .then((data) => setActiveSession(data))
        .catch((err) => console.error('Error fetching session:', err));
    }
  }, [activeSessionId]);

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      setSessions(data || []);
      if (data && data.length > 0 && !activeSessionId) {
        setActiveSessionId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:42000';
    const wsUrl = `${protocol}//${host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to Hub Server');
    };

    ws.onmessage = (event) => {
      try {
        const { event: ev, data } = JSON.parse(event.data);

        switch (ev) {
          case 'welcome':
            if (data.tunnelUrl) setTunnelUrl(data.tunnelUrl);
            if (data.settings) setSettings((prev) => ({ ...prev, ...data.settings }));
            break;

          case 'tunnel:online':
            if (data.url) setTunnelUrl(data.url);
            break;

          case 'settings:updated':
            setSettings((prev) => ({ ...prev, ...data }));
            break;

          case 'message:created':
            setActiveSession((prev) => {
              if (!prev || prev.id !== data.sessionId) return prev;
              const exists = prev.messages.some((m) => m.id === data.message.id);
              if (exists) return prev;
              return { ...prev, messages: [...prev.messages, data.message] };
            });
            break;

          case 'message:token':
            setActiveSession((prev) => {
              if (!prev || prev.id !== data.sessionId) return prev;
              const msgs = prev.messages.map((m) => {
                if (m.id === data.messageId) {
                  return { ...m, content: data.fullContent };
                }
                return m;
              });
              return { ...prev, messages: msgs };
            });
            break;

          case 'step:started':
            setActiveSession((prev) => {
              if (!prev || prev.id !== data.sessionId) return prev;
              const msgs = prev.messages.map((m) => {
                if (m.id === data.messageId) {
                  const existingSteps = m.steps || [];
                  const stepIndex = existingSteps.findIndex((s) => s.id === data.step.id);
                  const updatedSteps =
                    stepIndex >= 0
                      ? existingSteps.map((s, idx) => (idx === stepIndex ? data.step : s))
                      : [...existingSteps, data.step];
                  return { ...m, steps: updatedSteps };
                }
                return m;
              });
              return { ...prev, messages: msgs };
            });
            break;

          case 'step:completed':
            setActiveSession((prev) => {
              if (!prev || prev.id !== data.sessionId) return prev;
              const msgs = prev.messages.map((m) => {
                if (m.id === data.messageId) {
                  const updatedSteps = (m.steps || []).map((s) =>
                    s.id === data.step.id ? data.step : s
                  );
                  return { ...m, steps: updatedSteps };
                }
                return m;
              });
              return { ...prev, messages: msgs };
            });
            break;

          case 'approval:required':
            setPendingApprovals((prev) => ({
              ...prev,
              [data.messageId]: data.approval
            }));
            break;

          case 'approval:resolved':
            setPendingApprovals((prev) => {
              const next = { ...prev };
              for (const [msgId, appr] of Object.entries(next)) {
                if (appr.approvalId === data.approvalId) {
                  delete next[msgId];
                }
              }
              return next;
            });
            break;

          case 'agent:progress':
            setProgressData((prev) => ({
              ...prev,
              ...data
            }));
            break;

          case 'message:completed':
            setActiveSession((prev) => {
              if (!prev || prev.id !== data.sessionId) return prev;
              const msgs = prev.messages.map((m) => {
                if (m.id === data.messageId) {
                  return {
                    ...m,
                    content: data.content || m.content,
                    steps: data.steps || m.steps
                  };
                }
                return m;
              });
              return { ...prev, messages: msgs };
            });
            setIsGenerating(false);
            setProgressData(null);
            setGenerationStartTime(null);
            break;

          case 'message:error':
            setActiveSession((prev) => {
              if (!prev || prev.id !== data.sessionId) return prev;
              const msgs = prev.messages.map((m) => {
                if (m.id === data.messageId) {
                  return {
                    ...m,
                    content:
                      data.content ||
                      `⚠️ **Unable to connect to model provider**\n\n${data.error || 'Connection refused'}\n\nPlease check your local runner (LM Studio on port 1234, Ollama on port 11434, or AnythingLLM on port 3001) or configure an API key in Settings.`,
                    isError: true
                  };
                }
                return m;
              });
              return { ...prev, messages: msgs };
            });
            setIsGenerating(false);
            setProgressData(null);
            setGenerationStartTime(null);
            break;
        }
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Disconnected, retrying in 3s...');
      setTimeout(connectWebSocket, 3000);
    };
  };

  const handleSendPrompt = (content) => {
    if (!activeSessionId || !wsRef.current) return;
    setIsGenerating(true);
    const now = Date.now();
    setGenerationStartTime(now);
    setElapsedTime(0);
    setProgressData({
      status: 'running',
      stage: 'init',
      percent: 10,
      label: 'Initializing AI runner...'
    });

    wsRef.current.send(
      JSON.stringify({
        event: 'chat:send',
        data: {
          sessionId: activeSessionId,
          content,
          persona: settings.persona
        }
      })
    );
  };

  const handleToggleSafetyMode = async () => {
    const newMode = settings.safetyMode === 'yolo' ? 'tiered' : 'yolo';
    const newSettings = { ...settings, safetyMode: newMode };
    setSettings(newSettings);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safetyMode: newMode })
      });
    } catch (err) {
      console.error('Failed to update safety mode:', err);
    }
  };

  const handleSelectPersona = async (newPersona) => {
    const newSettings = { ...settings, persona: newPersona };
    setSettings(newSettings);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: newPersona })
      });
    } catch (err) {
      console.error('Failed to update persona:', err);
    }
  };

  const handleResolveApproval = async (approvalId, approved) => {
    if (!wsRef.current) return;
    wsRef.current.send(
      JSON.stringify({
        event: 'approval:response',
        data: {
          approvalId,
          approved
        }
      })
    );
  };

  const handleNewSession = async () => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Conversation' })
      });
      const session = await res.json();
      setSessions([session, ...sessions]);
      setActiveSessionId(session.id);
      setActiveSession(session);
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDeleteSession = async (id) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const nextSessions = sessions.filter((s) => s.id !== id);
      setSessions(nextSessions);
      if (activeSessionId === id && nextSessions.length > 0) {
        setActiveSessionId(nextSessions[0].id);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('assistant_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('assistant_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleTogglePinSession = async (id, isPinned) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPinned } : s))
    );
    try {
      await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned })
      });
    } catch (err) {
      console.error('Failed to update pin status:', err);
    }
  };

  const handleRenameSession = async (id, newTitle) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
    );
    if (activeSessionId === id) {
      setActiveSession((prev) => (prev ? { ...prev, title: newTitle } : prev));
    }
    try {
      await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gemini-bg text-gemini-text overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggleMobile={() => setSidebarOpen(!sidebarOpen)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={(id) => {
          setActiveSessionId(id);
          setSidebarOpen(false);
        }}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onTogglePinSession={handleTogglePinSession}
        onRenameSession={handleRenameSession}
        onOpenPairing={() => setPairingOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        tunnelUrl={tunnelUrl}
        activeProvider={settings.activeProvider}
      />

      {/* Main Chat Canvas & Input */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <ChatCanvas
          messages={activeSession?.messages || []}
          activeSession={activeSession}
          onToggleSidebar={() => {
            if (window.innerWidth < 768) {
              setSidebarOpen(!sidebarOpen);
            } else {
              handleToggleCollapse();
            }
          }}
          onResolveApproval={handleResolveApproval}
          pendingApprovals={pendingApprovals}
          onSendPrompt={handleSendPrompt}
          safetyMode={settings.safetyMode}
          onToggleSafetyMode={handleToggleSafetyMode}
          persona={settings.persona}
          onSelectPersona={handleSelectPersona}
          isGenerating={isGenerating}
          progressData={progressData}
          elapsedTime={elapsedTime}
        />

        <InputBar
          onSend={handleSendPrompt}
          disabled={isGenerating}
          activeProvider={settings.activeProvider}
          onOpenModelSelector={() => setSettingsOpen(true)}
        />
      </div>

      {/* Modals */}
      <PairingModal isOpen={pairingOpen} onClose={() => setPairingOpen(false)} />
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(newSettings) => setSettings((prev) => ({ ...prev, ...newSettings }))}
      />
    </div>
  );
}

export default App;
