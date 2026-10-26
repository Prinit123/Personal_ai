// src/views/DashboardView.tsx — Welcome dashboard with status and quick access
import { useEffect, useState } from 'react';
import {
  MessageSquare, Wrench, FolderOpen, Globe,
  TrendingUp, Clock, Zap
} from 'lucide-react';
import { api } from '../api/client';
import type { AppView, SystemStatus, Project, Conversation } from '../types';

interface DashboardViewProps {
  onViewChange: (view: AppView) => void;
  onNewChat:    () => void;
}

const TILES = [
  { view: 'speak' as AppView,            label: 'Speak with Nilesh',    icon: '🎙️', desc: 'Live hands-free voice room',               color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
  { view: 'correct-english' as AppView,  label: 'Correct My English',   icon: '✍️', desc: 'Grammar inspection & 6 style variations',  color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  { view: 'write-message' as AppView,    label: 'Write a Message',      icon: '✉️', desc: 'Ready-to-send messages by recipient',       color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  { view: 'english-practice' as AppView, label: 'English Practice',     icon: '🗣️', desc: 'Spoken interview and teacher roleplays',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { view: 'special-wishes' as AppView,   label: 'Special Wishes',       icon: '🎂', desc: 'Birthdays, festivals, and congratulations', color: '#ec4899', bg: 'rgba(236,72,153,0.1)' },
  { view: 'translate' as AppView,        label: 'Translate Languages',  icon: '🌐', desc: 'English, Hindi, and Gujarati translations',  color: '#06b6d4', bg: 'rgba(6,182,212,0.1)'  },
  { view: 'chat' as AppView,             label: 'Chat with Nilesh',     icon: '💬', desc: 'Ask anything — code, data, daily tasks',   color: '#4f6ef7', bg: 'rgba(79,110,247,0.1)' },
  { view: 'learning' as AppView,         label: 'Coding & ML Learning', icon: '🎓', desc: 'Python, ML, NumPy, Pandas challenges',     color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
  { view: 'builder' as AppView,          label: 'Website Builder',      icon: '🏗️', desc: 'Build MERN websites from prompts',          color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  { view: 'saved-templates' as AppView,  label: 'Saved Templates',      icon: '🔖', desc: 'Private offline reusable message library', color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  { view: 'research' as AppView,         label: 'Web Research',        icon: '🔍', desc: 'Search and summarize the web',              color: '#0284c7', bg: 'rgba(2,132,199,0.1)'  },
  { view: 'settings' as AppView,         label: 'Settings',            icon: '⚙️', desc: 'Configure AI provider & voice options',    color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
];

export default function DashboardView({ onViewChange, onNewChat }: DashboardViewProps) {
  const [status,    setStatus]    = useState<SystemStatus | null>(null);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [convs,     setConvs]     = useState<Conversation[]>([]);

  useEffect(() => {
    api.get<SystemStatus>('/api/status').then(setStatus).catch(() => {});
    api.get<Project[]>('/api/projects').then(setProjects).catch(() => {});
    api.get<Conversation[]>('/api/conversations').then(setConvs).catch(() => {});
  }, []);

  const statusBadge = (val: string | undefined) => {
    if (!val) return null;
    const ok = val === 'online' || val === 'configured';
    return (
      <span className={`badge ${ok ? 'badge-green' : 'badge-red'}`}>
        <span className={`status-dot ${ok ? 'ok' : 'error'}`} style={{ width: 5, height: 5 }} />
        {val}
      </span>
    );
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000)   return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  return (
    <div className="overflow-y-auto flex-1" style={{ padding: '24px' }}>
      {/* Welcome */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, rgba(79,110,247,0.15), rgba(123,150,255,0.05))',
        borderColor: 'rgba(79,110,247,0.3)',
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 48 }}>🤖</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
              Welcome back! I'm <span style={{ color: 'var(--accent-light)' }}>Nilesh</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Your personal AI assistant for daily tasks, coding, research, and building MERN websites.
            </p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={onNewChat}>
                <MessageSquare size={14} /> Start Chat
              </button>
              <button className="btn btn-secondary" onClick={() => onViewChange('learning')}>
                <TrendingUp size={14} /> Learning
              </button>
              <button className="btn btn-secondary" onClick={() => onViewChange('builder')}>
                <Wrench size={14} /> Build a Website
              </button>
              <button className="btn btn-secondary" onClick={() => onViewChange('research')}>
                <Globe size={14} /> Web Research
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick access tiles */}
      <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
        Quick Access
      </h2>
      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        {TILES.map(tile => (
          <button
            key={tile.view}
            className="dashboard-tile"
            onClick={() => onViewChange(tile.view)}
          >
            <div className="tile-icon" style={{ background: tile.bg, color: tile.color }}>
              {tile.icon}
            </div>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{tile.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{tile.desc}</div>
          </button>
        ))}
      </div>

      {/* System status + recent activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* System Status */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={14} color="var(--accent-light)" /> System Status
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Backend</span>
              {statusBadge(status ? 'online' : undefined) ?? <span className="badge badge-gray">checking…</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Internet</span>
              {statusBadge(status?.internet) ?? <span className="badge badge-gray">—</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Ollama</span>
              {statusBadge(status?.ollama) ?? <span className="badge badge-gray">—</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gemini API</span>
              {status ? (status.gemini === 'configured'
                ? <span className="badge badge-green">configured</span>
                : <span className="badge badge-red">not set</span>
              ) : <span className="badge badge-gray">—</span>}
            </div>
          </div>
          {status?.gemini !== 'configured' && (
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--amber)', lineHeight: 1.5 }}>
              ⚠️ Add GEMINI_API_KEY to .env for online AI
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <TrendingUp size={14} color="var(--emerald)" /> Recent Projects ({projects.length})
          </div>
          {projects.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              No projects yet.<br />
              <button className="btn btn-secondary" style={{ marginTop: 8, padding: '4px 10px', fontSize: 11 }}
                onClick={() => onViewChange('builder')}>
                Build your first site →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {projects.slice(0, 4).map(p => (
                <button key={p.id} className="nav-item" onClick={() => onViewChange('projects')}
                  style={{ padding: '6px 8px' }}>
                  <FolderOpen size={12} />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 12 }}>{p.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(p.updatedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Chats */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Clock size={14} color="var(--amber)" /> Recent Chats ({convs.length})
          </div>
          {convs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
              No conversations yet.<br />
              <button className="btn btn-secondary" style={{ marginTop: 8, padding: '4px 10px', fontSize: 11 }}
                onClick={onNewChat}>
                Start chatting →
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {convs.slice(0, 4).map(c => (
                <button key={c.id} className="nav-item" onClick={() => onViewChange('chat')}
                  style={{ padding: '6px 8px' }}>
                  <MessageSquare size={12} />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{timeAgo(c.updated_at)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      <div className="card">
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 13 }}>🎯 What Nilesh can do for you</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {[
            ['💬', 'Daily Questions', 'Ask anything in plain English'],
            ['🐛', 'Debug Code', 'Explain and fix errors in C, Python, Java, JS'],
            ['🎓', 'Learning', 'Medium/Hard coding challenges with hints & solutions'],
            ['🏗️', 'Build MERN Sites', 'Full React + Express + MongoDB apps'],
            ['📖', 'Learn Programming', 'Step-by-step beginner to advanced'],
            ['🔍', 'Web Research', 'Search, cite, and summarize the web'],
            ['📝', 'Write Documents', 'Emails, reports, summaries, and notes'],
            ['📚', 'Knowledge Base', 'Import your own documents for RAG'],
            ['📊', 'Data Science', 'NumPy, pandas, Matplotlib, Scikit-learn'],
            ['⚡', 'Fast & Private', 'Run locally with Ollama or online with Gemini'],
          ].map(([icon, title, desc]) => (
            <div key={String(title)} style={{
              display: 'flex', gap: 10, padding: '10px 12px',
              background: 'var(--bg-hover)', borderRadius: 8, alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
