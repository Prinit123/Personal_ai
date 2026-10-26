// src/components/Sidebar.tsx — Nilesh — Full Navigation Sidebar
import { useState, useEffect } from 'react';
import {
  Plus, MessageSquare, Trash2, Settings, Sun, Moon,
  Sparkles, ChevronLeft, Key, LayoutDashboard, GraduationCap,
  FolderOpen, Wrench, FileText, Globe, BookOpen, HardDrive,
  Mic, CheckCheck, Send, Gift, Languages, MessageSquareQuote, BookmarkCheck
} from 'lucide-react';
import { api } from '../api/client';
import type { AppView, Conversation, SystemStatus } from '../types';

interface SidebarProps {
  activeView:      AppView;
  activeConvId:    string | null;
  onViewChange:    (view: AppView) => void;
  onSelectConv:    (id: string) => void;
  onNewChat:       () => void;
  onOpenSettings:  () => void;
  systemStatus:    SystemStatus | null;
  theme:           string;
  onToggleTheme:   () => void;
  isOpen:          boolean;
  onToggleOpen:    () => void;
}

// ─── Grouped Navigation items ─────────────────────────────────────────────────

const COMM_ITEMS: Array<{ view: AppView; label: string; icon: React.ReactNode; badge?: string; hint?: string }> = [
  { view: 'speak',            label: 'Speak with Nilesh',    icon: <Mic size={15} />,                 badge: 'Voice', hint: 'Hands-free voice conversation' },
  { view: 'correct-english',  label: 'Correct My English',   icon: <CheckCheck size={15} />,          hint: 'Grammar & sentence improver' },
  { view: 'write-message',    label: 'Write a Message',      icon: <Send size={15} />,                hint: 'Auto message writer by recipient' },
  { view: 'special-wishes',   label: 'Wishes & Greetings',   icon: <Gift size={15} />,                hint: 'Birthday, festival & congrats' },
  { view: 'teacher-messages', label: 'Teacher & Student',    icon: <GraduationCap size={15} />,       hint: 'Class, fees, leave & notices' },
  { view: 'translate',        label: 'Translate Languages',  icon: <Languages size={15} />,           hint: 'English, Hindi & Gujarati' },
  { view: 'english-practice', label: 'English Practice',     icon: <MessageSquareQuote size={15} />,  hint: 'Interactive speaking roleplays' },
  { view: 'saved-templates',  label: 'Saved Templates',      icon: <BookmarkCheck size={15} />,       hint: 'Your saved message library' },
];

const CODE_ITEMS: Array<{ view: AppView; label: string; icon: React.ReactNode; badge?: string; hint?: string }> = [
  { view: 'chat',            label: 'AI Coding Chat',        icon: <MessageSquare size={15} />,   hint: 'Ask coding & ML questions' },
  { view: 'project-manager', label: 'Project & File Manager', icon: <HardDrive size={15} />,      badge: 'Downloads', hint: 'Project scanner, auto-saving & Downloads manager' },
  { view: 'builder',         label: 'Website Builder',       icon: <Wrench size={15} />,          hint: 'MERN app generator' },
  { view: 'learning',        label: 'Code Challenges',       icon: <Sparkles size={15} />,        hint: 'Coding exercises' },
  { view: 'projects',        label: 'Projects',              icon: <FolderOpen size={15} />,      hint: 'Generated projects' },
  { view: 'files',           label: 'Files',                 icon: <FileText size={15} />,        hint: 'Workspace explorer' },
  { view: 'research',        label: 'Research',              icon: <Globe size={15} />,           hint: 'Web search + AI' },
  { view: 'knowledge',       label: 'Knowledge Base',        icon: <BookOpen size={15} />,        hint: 'Document notes & RAG' },
  { view: 'dashboard',       label: 'Dashboard',             icon: <LayoutDashboard size={15} />, hint: 'System overview' },
];

export default function Sidebar({
  activeView, activeConvId, onViewChange, onSelectConv, onNewChat,
  onOpenSettings, systemStatus, theme, onToggleTheme, isOpen, onToggleOpen,
}: SidebarProps) {
  const [conversations,  setConversations]  = useState<Conversation[]>([]);
  const [showConvHistory, setShowConvHistory] = useState(false);

  const loadConversations = async () => {
    try {
      const list = await api.get<Conversation[]>('/api/conversations');
      setConversations(list || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { loadConversations(); }, [activeConvId]);

  const handleDeleteConv = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await api.delete(`/api/conversations/${id}`);
      setConversations(prev => prev.filter(c => c.id !== id));
      if (activeConvId === id) onNewChat();
    } catch { /* ignore */ }
  };

  const isGeminiReady   = systemStatus?.gemini === 'configured';
  const isOllamaOnline  = systemStatus?.ollama === 'online';
  const isConnected     = systemStatus?.activeProvider === 'gemini' ? isGeminiReady
    : systemStatus?.activeProvider === 'ollama' ? isOllamaOnline
    : isGeminiReady || isOllamaOnline;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && <div className="sidebar-backdrop" onClick={onToggleOpen} />}

      <aside className={`chat-sidebar ${isOpen ? 'open' : 'closed'}`}>
        {/* ── Branding ── */}
        <div className="sidebar-header">
          <div className="brand-group">
            <div className="brand-icon">
              <Sparkles size={17} color="white" />
            </div>
            <div className="brand-text">
              <div className="brand-title">Nilesh AI</div>
              <div className="brand-subtitle">Teacher & Assistant</div>
            </div>
          </div>
          <button className="btn-icon sidebar-collapse-btn" onClick={onToggleOpen} title="Collapse sidebar">
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* ── Quick Speak / New Chat action ── */}
        <div className="new-chat-wrapper" style={{ display: 'flex', gap: 6 }}>
          <button className="new-chat-btn" onClick={onNewChat} style={{ flex: 1 }}>
            <Plus size={15} />
            <span>New Chat</span>
          </button>
          <button
            className="new-chat-btn"
            onClick={() => onViewChange('speak')}
            title="Open Voice Room"
            style={{
              width: 38,
              padding: 0,
              background: activeView === 'speak' ? 'var(--emerald)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              justifyContent: 'center',
            }}
          >
            <Mic size={15} color="white" />
          </button>
        </div>

        {/* ── Scrollable Navigation ── */}
        <div className="sidebar-scrollable-content" style={{ overflowY: 'auto', flex: 1, paddingBottom: 16 }}>
          {/* Communication & Voice Section */}
          <div className="nav-section">
            <div className="conv-list-header">Communication & Voice</div>
            {COMM_ITEMS.map(item => (
              <button
                key={item.view}
                className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                onClick={() => onViewChange(item.view)}
                title={item.hint}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="nav-badge" style={{ background: 'var(--emerald-dim)', color: 'var(--emerald)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* AI, Coding & Projects Section */}
          <div className="nav-section" style={{ marginTop: 12 }}>
            <div className="conv-list-header">Coding & AI Learning</div>
            {CODE_ITEMS.map(item => (
              <button
                key={item.view}
                className={`nav-item ${activeView === item.view ? 'active' : ''}`}
                onClick={() => onViewChange(item.view)}
                title={item.hint}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.badge && (
                  <span className="nav-badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: 'var(--accent-light)', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat History (collapsible) ── */}
        <div className="conv-list-container">
          <button
            className="conv-list-header conv-toggle"
            onClick={() => setShowConvHistory(h => !h)}
          >
            Recent Chats
            <span style={{ marginLeft: 'auto', fontSize: 10 }}>{showConvHistory ? '▲' : '▼'}</span>
          </button>

          {showConvHistory && (
            <>
              {conversations.length === 0 ? (
                <div className="conv-empty">
                  <span>No chats yet</span>
                </div>
              ) : (
                conversations.slice(0, 20).map(conv => {
                  const isActive = conv.id === activeConvId;
                  return (
                    <div
                      key={conv.id}
                      className={`conv-item ${isActive ? 'active' : ''}`}
                      onClick={() => onSelectConv(conv.id)}
                    >
                      <MessageSquare size={12} className="conv-icon" />
                      <span className="conv-title" title={conv.title}>
                        {conv.title || 'Untitled Chat'}
                      </span>
                      <button
                        className="conv-delete-btn"
                        onClick={(e) => handleDeleteConv(e, conv.id)}
                        title="Delete"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sidebar-footer">
          {/* Connection status pill */}
          <div
            className={`status-pill ${isConnected ? 'online' : 'warning'}`}
            onClick={onOpenSettings}
            title={isConnected ? 'AI Provider Connected' : 'Configure API Key'}
          >
            <div className="status-dot" />
            <div className="status-text">
              {isConnected ? (
                <>
                  <span className="status-label">Ready: </span>
                  <span className="status-value">{systemStatus?.activeModel?.replace('gemini-', 'g-') || 'Gemini'}</span>
                </>
              ) : (
                <>
                  <Key size={11} style={{ display: 'inline', marginRight: 3 }} />
                  <span className="status-label">Setup API Key</span>
                </>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="footer-actions">
            <button className="footer-btn" onClick={() => onViewChange('settings')} title="Settings">
              <Settings size={14} />
              <span>Settings</span>
            </button>
            <button className="footer-btn" onClick={onToggleTheme} title="Toggle theme">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Collapsed toggle button */}
      {!isOpen && (
        <button
          className="sidebar-open-btn"
          onClick={onToggleOpen}
          title="Open sidebar"
        >
          <Sparkles size={14} />
        </button>
      )}
    </>
  );
}
