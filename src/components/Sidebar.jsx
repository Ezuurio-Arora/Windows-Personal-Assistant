import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  MessageSquare,
  Plus,
  Trash2,
  Smartphone,
  Settings,
  Globe,
  Wifi,
  ChevronLeft,
  Menu,
  Pin,
  PinOff,
  Edit3,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  X
} from 'lucide-react';

function groupSessionsByDate(sessions) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const sevenDaysAgo = today - 7 * 86400000;

  const groups = {
    pinned: [],
    today: [],
    yesterday: [],
    previous7Days: [],
    older: []
  };

  for (const session of sessions) {
    if (session.isPinned) {
      groups.pinned.push(session);
      continue;
    }

    const sessionDate = new Date(session.updatedAt || session.createdAt || Date.now()).getTime();
    if (sessionDate >= today) {
      groups.today.push(session);
    } else if (sessionDate >= yesterday) {
      groups.yesterday.push(session);
    } else if (sessionDate >= sevenDaysAgo) {
      groups.previous7Days.push(session);
    } else {
      groups.older.push(session);
    }
  }

  return groups;
}

export function Sidebar({
  isOpen,
  onToggleMobile,
  isCollapsed,
  onToggleCollapse,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onTogglePinSession,
  onRenameSession,
  onOpenPairing,
  onOpenSettings,
  tunnelUrl,
  activeProvider
}) {
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const menuRef = useRef(null);
  const editInputRef = useRef(null);

  // Close 3-dots dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when starting rename
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const handleStartRename = (session, e) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title || 'Conversation');
    setMenuOpenId(null);
  };

  const handleSaveRename = (sessionId) => {
    if (editTitle.trim()) {
      onRenameSession(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDownRename = (e, sessionId) => {
    if (e.key === 'Enter') {
      handleSaveRename(sessionId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const grouped = groupSessionsByDate(sessions);

  const renderSessionItem = (session) => {
    const isActive = session.id === activeSessionId;
    const isMenuOpen = menuOpenId === session.id;
    const isEditing = editingId === session.id;

    if (isCollapsed) {
      return (
        <button
          key={session.id}
          type="button"
          onClick={() => onSelectSession(session.id)}
          className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center transition-all ${
            isActive
              ? 'bg-[#004A77] text-[#7DACF8] ring-1 ring-[#7DACF8]/50 shadow-sm'
              : 'text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover'
          }`}
          title={session.title || 'Untitled Chat'}
        >
          {session.isPinned ? (
            <Pin className={`w-4 h-4 ${isActive ? 'text-[#7DACF8] fill-[#7DACF8]/30' : 'text-gemini-blue fill-gemini-blue/20'}`} />
          ) : (
            <MessageSquare className={`w-4 h-4 ${isActive ? 'text-[#7DACF8]' : ''}`} />
          )}
        </button>
      );
    }

    return (
      <div
        key={session.id}
        className={`group relative flex items-center justify-between px-3 py-2 rounded-full text-xs font-medium cursor-pointer transition-all duration-150 ${
          isActive
            ? 'bg-[#004A77] text-[#7DACF8] font-semibold shadow-sm'
            : 'text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover/70'
        }`}
        onClick={() => onSelectSession(session.id)}
      >
        <div className="flex items-center space-x-2.5 overflow-hidden flex-1 min-w-0 pr-1">
          {session.isPinned ? (
            <Pin className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#7DACF8] fill-[#7DACF8]/40' : 'text-gemini-blue fill-gemini-blue/30'}`} />
          ) : (
            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[#7DACF8]' : 'text-gemini-muted'}`} />
          )}

          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => handleKeyDownRename(e, session.id)}
              onBlur={() => handleSaveRename(session.id)}
              onClick={(e) => e.stopPropagation()}
              className="bg-gemini-surface text-gemini-text text-xs px-2 py-0.5 rounded border border-gemini-blue/50 focus:outline-none w-full"
            />
          ) : (
            <span className={`truncate ${isActive ? 'text-[#7DACF8] font-semibold' : 'text-gemini-text'}`}>{session.title || 'Untitled Chat'}</span>
          )}
        </div>

        {/* 3-dots actions trigger */}
        {!isEditing && (
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : session.id);
              }}
              className={`p-1 rounded-full transition-opacity ${
                isMenuOpen
                  ? 'opacity-100 bg-gemini-surface text-gemini-text'
                  : isActive
                  ? 'opacity-0 group-hover:opacity-100 text-[#7DACF8] hover:text-white hover:bg-[#003B60]'
                  : 'opacity-0 group-hover:opacity-100 text-gemini-muted hover:text-gemini-text hover:bg-gemini-surface'
              }`}
              title="Chat options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                className="absolute right-2 top-8 z-50 w-36 py-1 bg-gemini-surface rounded-xl border border-gemini-border shadow-xl backdrop-blur-lg animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Pin / Unpin */}
                <button
                  type="button"
                  onClick={() => {
                    onTogglePinSession(session.id, !session.isPinned);
                    setMenuOpenId(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-xs text-gemini-text hover:bg-gemini-hover transition-colors"
                >
                  {session.isPinned ? (
                    <>
                      <PinOff className="w-3.5 h-3.5 text-gemini-muted" />
                      <span>Unpin</span>
                    </>
                  ) : (
                    <>
                      <Pin className="w-3.5 h-3.5 text-gemini-blue" />
                      <span>Pin to top</span>
                    </>
                  )}
                </button>

                {/* Rename */}
                <button
                  type="button"
                  onClick={(e) => handleStartRename(session, e)}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-xs text-gemini-text hover:bg-gemini-hover transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-gemini-muted" />
                  <span>Rename</span>
                </button>

                <div className="h-px bg-gemini-border/50 my-1" />

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => {
                    onDeleteSession(session.id);
                    setMenuOpenId(null);
                  }}
                  className="w-full flex items-center space-x-2 px-3 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onToggleMobile}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 bg-gemini-surface flex flex-col border-r border-gemini-elevated/80 transition-all duration-300 ease-in-out select-none ${
          isOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-[68px]' : 'md:w-[280px]'}`}
      >
        {/* Top Header / Brand / Toggle */}
        <div className="h-14 px-3.5 flex items-center justify-between border-b border-gemini-elevated/40 shrink-0">
          <div className="flex items-center space-x-3 overflow-hidden">
            {/* Desktop Collapse Toggle */}
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden md:flex p-1.5 rounded-lg text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors"
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>

            {/* Logo & Title */}
            {(!isCollapsed || isOpen) && (
              <div className="flex items-center space-x-2.5 overflow-hidden">
                <img src="/gemini-spark.svg" alt="Gemini Spark" className="w-6 h-6 shrink-0" />
                <span className="font-semibold text-sm text-gemini-text tracking-tight truncate">
                  Personal Assistant
                </span>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onToggleMobile}
            className="p-1.5 rounded-lg text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors md:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3 shrink-0">
          {isCollapsed ? (
            <button
              type="button"
              onClick={onNewSession}
              className="w-10 h-10 mx-auto rounded-full flex items-center justify-center bg-gemini-elevated hover:bg-gemini-hover text-gemini-sparkle1 border border-gemini-border/50 shadow-sm transition-all duration-200"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onNewSession}
              className="w-full flex items-center space-x-3 py-2.5 px-4 rounded-full bg-gemini-elevated hover:bg-gemini-hover text-gemini-text font-medium text-xs transition-all duration-200 border border-gemini-border/40 shadow-sm group"
            >
              <Plus className="w-4 h-4 text-gemini-sparkle1 group-hover:rotate-90 transition-transform duration-200" />
              <span>New Chat</span>
            </button>
          )}
        </div>

        {/* Sessions History List */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-4 custom-scrollbar">
          {/* Pinned Section */}
          {grouped.pinned.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gemini-blue flex items-center space-x-1.5">
                  <Pin className="w-3 h-3 fill-gemini-blue/30 text-gemini-blue" />
                  <span>Pinned Chats</span>
                </div>
              )}
              {grouped.pinned.map(renderSessionItem)}
            </div>
          )}

          {/* Today */}
          {grouped.today.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gemini-muted">
                  Today
                </div>
              )}
              {grouped.today.map(renderSessionItem)}
            </div>
          )}

          {/* Yesterday */}
          {grouped.yesterday.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gemini-muted">
                  Yesterday
                </div>
              )}
              {grouped.yesterday.map(renderSessionItem)}
            </div>
          )}

          {/* Previous 7 Days */}
          {grouped.previous7Days.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gemini-muted">
                  Previous 7 days
                </div>
              )}
              {grouped.previous7Days.map(renderSessionItem)}
            </div>
          )}

          {/* Older */}
          {grouped.older.length > 0 && (
            <div className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gemini-muted">
                  Older
                </div>
              )}
              {grouped.older.map(renderSessionItem)}
            </div>
          )}
        </div>

        {/* Footer / Mobile Pairing & Settings */}
        <div className="p-2.5 border-t border-gemini-elevated/60 space-y-1.5 shrink-0">
          {/* Pair Mobile Button */}
          {isCollapsed ? (
            <button
              type="button"
              onClick={onOpenPairing}
              className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-gemini-sparkle1 hover:bg-gemini-hover transition-colors"
              title="Pair Android Companion"
            >
              <Smartphone className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPairing}
              className="w-full flex items-center justify-between p-2 rounded-xl bg-gemini-bg/60 hover:bg-gemini-elevated border border-gemini-elevated/70 transition-colors text-xs text-gemini-text"
            >
              <div className="flex items-center space-x-2 truncate">
                <Smartphone className="w-4 h-4 text-gemini-sparkle1 shrink-0" />
                <div className="text-left truncate">
                  <span className="font-semibold block text-[11px]">Android Companion</span>
                  <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
                    <Wifi className="w-2.5 h-2.5" />
                    <span>Parental-Safe LAN</span>
                  </span>
                </div>
              </div>
            </button>
          )}

          {/* Settings Button */}
          {isCollapsed ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-10 h-10 mx-auto rounded-full flex items-center justify-center text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center space-x-2.5 p-2 rounded-xl text-gemini-muted hover:text-gemini-text hover:bg-gemini-hover transition-colors text-xs font-medium"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <div className="text-left truncate">
                <span className="block truncate text-[11px]">Settings</span>
                <span className="text-[10px] text-gemini-muted/80 capitalize font-mono block truncate">
                  {activeProvider || 'Local Model'}
                </span>
              </div>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
