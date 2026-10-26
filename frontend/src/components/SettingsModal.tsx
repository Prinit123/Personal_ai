// src/components/SettingsModal.tsx — Comprehensive Hybrid AI, Ollama Speed & Temporary Memory Control Panel
import { useState, useEffect } from 'react';
import {
  X, Check, AlertCircle, RefreshCw, Key, ExternalLink, Zap,
  Eye, EyeOff, Cpu, Database, Server, Trash2, RotateCcw,
  Info, Clock
} from 'lucide-react';
import {
  api,
  getMemories,
  deleteMemory,
  clearAllMemories,
  getCacheStats,
  clearResponseCache,
} from '../api/client';
import type { AppSettings, SystemStatus, TemporaryMemoryItem, CacheStats } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function SettingsModal({ onClose, onSaved }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'provider' | 'speed' | 'memory'>('provider');

  // Provider & Model State
  const [provider, setProvider] = useState('auto');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [onlineEnabled, setOnlineEnabled] = useState(true);

  // Speed & Ollama Settings
  const [smartRouting, setSmartRouting] = useState(true);
  const [keepAlive, setKeepAlive] = useState('5m');
  const [numPredict, setNumPredict] = useState('512');
  const [numCtx, setNumCtx] = useState('2048');
  const [maxHistory, setMaxHistory] = useState('6');

  // Memory & Cache State
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryTtlDays, setMemoryTtlDays] = useState('7');
  const [memoriesList, setMemoriesList] = useState<TemporaryMemoryItem[]>([]);
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [cacheStats, setCacheStats] = useState<CacheStats>({ count: 0, totalHits: 0 });

  // Action status
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; elapsedMs?: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const s = await api.get<AppSettings>('/api/settings');
      if (s.ai_provider) setProvider(s.ai_provider);
      if (s.ai_model) setModel(s.ai_model);
      if (s.online_enabled !== undefined) setOnlineEnabled(s.online_enabled === 'true');
      if (s.local_smart_routing !== undefined) setSmartRouting(s.local_smart_routing === 'true');
      if (s.ollama_keep_alive) setKeepAlive(s.ollama_keep_alive);
      if (s.ollama_num_predict) setNumPredict(s.ollama_num_predict);
      if (s.ollama_num_ctx) setNumCtx(s.ollama_num_ctx);
      if (s.max_local_history) setMaxHistory(s.max_local_history);
      if (s.memory_enabled !== undefined) setMemoryEnabled(s.memory_enabled === 'true');
      if (s.memory_ttl_days) setMemoryTtlDays(s.memory_ttl_days);
      if (s.cache_enabled !== undefined) setCacheEnabled(s.cache_enabled === 'true');

      const st = await api.get<SystemStatus>('/api/status');
      setSystemStatus(st);

      // Load active memories & cache stats
      const memRes = await getMemories().catch(() => null);
      if (memRes?.memories) setMemoriesList(memRes.memories);

      const cStats = await getCacheStats().catch(() => null);
      if (cStats) setCacheStats(cStats);
    } catch { /* ignore */ }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ ok: boolean; message: string; elapsedMs?: number }>('/api/settings/test-provider', {
        provider,
        model,
        apiKey: apiKey.trim() || undefined,
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message || 'Test request failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save all settings in a single batch
      await api.post('/api/settings', {
        settings: {
          ai_provider: provider,
          ai_model: model,
          online_enabled: onlineEnabled ? 'true' : 'false',
          local_smart_routing: smartRouting ? 'true' : 'false',
          ollama_keep_alive: keepAlive,
          ollama_num_predict: numPredict,
          ollama_num_ctx: numCtx,
          max_local_history: maxHistory,
          memory_enabled: memoryEnabled ? 'true' : 'false',
          memory_ttl_days: memoryTtlDays,
          cache_enabled: cacheEnabled ? 'true' : 'false',
        },
      });

      // 2. Save API key if provided
      if (apiKey.trim()) {
        await api.post('/api/settings/save-key', {
          apiKey: apiKey.trim(),
          provider: provider === 'auto' ? 'gemini' : provider,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onSaved();
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await deleteMemory(id);
      setMemoriesList(prev => prev.filter(m => m.id !== id));
      setActionNotice('Memory item removed');
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      alert(`Could not delete memory: ${err.message}`);
    }
  };

  const handleClearAllMemories = async () => {
    if (!window.confirm('Are you sure you want to delete all temporary memories? This cannot be undone.')) return;
    try {
      const res = await clearAllMemories();
      setMemoriesList([]);
      setActionNotice(res.message);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      alert(`Could not clear memories: ${err.message}`);
    }
  };

  const handleClearCache = async () => {
    try {
      const res = await clearResponseCache();
      setCacheStats({ count: 0, totalHits: 0 });
      setActionNotice(res.message);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (err: any) {
      alert(`Could not clear cache: ${err.message}`);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog settings-modal" style={{ maxWidth: 680, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="badge-icon">
              <Key size={18} color="var(--accent-light)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Nilesh AI Control Panel</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Hybrid Provider, Ollama Low-RAM Optimization & Temporary Memory
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 20px', background: 'var(--bg-secondary)', gap: 8 }}>
          <button
            onClick={() => setActiveTab('provider')}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'provider' ? 'var(--accent-light)' : 'var(--text-muted)',
              borderBottom: activeTab === 'provider' ? '2px solid var(--accent-light)' : '2px solid transparent',
              fontWeight: activeTab === 'provider' ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Server size={14} /> AI Engine & Provider
          </button>
          <button
            onClick={() => setActiveTab('speed')}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'speed' ? 'var(--accent-light)' : 'var(--text-muted)',
              borderBottom: activeTab === 'speed' ? '2px solid var(--accent-light)' : '2px solid transparent',
              fontWeight: activeTab === 'speed' ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Cpu size={14} /> Ollama Speed & RAM
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            style={{
              padding: '10px 14px',
              border: 'none',
              background: 'transparent',
              color: activeTab === 'memory' ? 'var(--accent-light)' : 'var(--text-muted)',
              borderBottom: activeTab === 'memory' ? '2px solid var(--accent-light)' : '2px solid transparent',
              fontWeight: activeTab === 'memory' ? 600 : 400,
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Database size={14} /> Memory & Cache
          </button>
        </div>

        {/* Body Content */}
        <div className="modal-body settings-modal-body" style={{ overflowY: 'auto', flex: 1, padding: 20 }}>
          {actionNotice && (
            <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-light)', padding: '6px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12, color: 'var(--accent-light)' }}>
              {actionNotice}
            </div>
          )}

          {/* TAB 1: AI Provider & Engine */}
          {activeTab === 'provider' && (
            <>
              {/* Provider Selection Cards */}
              <div className="settings-field">
                <label className="field-label">Select Operational Mode</label>
                <div className="provider-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {/* Auto Mode */}
                  <div
                    className={`provider-card ${provider === 'auto' ? 'selected' : ''}`}
                    onClick={() => {
                      setProvider('auto');
                      setModel('auto');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Auto Hybrid</span>
                      <span className="badge badge-purple">Smart</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Uses Gemini when online & configured; seamlessly stays offline with local Ollama when disconnected.
                    </p>
                  </div>

                  {/* Gemini Online */}
                  <div
                    className={`provider-card ${provider === 'gemini' ? 'selected' : ''}`}
                    onClick={() => {
                      setProvider('gemini');
                      if (!model.startsWith('gemini')) setModel('gemini-3.8-flash');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Google Gemini</span>
                      <span className="badge badge-green">Online</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Ultra-fast reasoning, live search & full MERN scaffolding via official Gemini API.
                    </p>
                  </div>

                  {/* Ollama Local */}
                  <div
                    className={`provider-card ${provider === 'ollama' ? 'selected' : ''}`}
                    onClick={() => {
                      setProvider('ollama');
                      if (model.startsWith('gemini')) setModel('qwen2.5-coder:1.5b');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>Local Ollama</span>
                      <span className="badge badge-blue">Offline</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                      Runs 100% locally on your computer. Zero cloud dependency & total privacy.
                    </p>
                  </div>
                </div>
              </div>

              {/* Online Access Permission Switch */}
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>Permit Online Internet Access</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    When disabled, Nilesh will strictly run offline models and make zero network requests.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={onlineEnabled}
                  onChange={(e) => setOnlineEnabled(e.target.checked)}
                  style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-light)' }}
                />
              </div>

              {/* Model selection */}
              <div className="settings-field">
                <label className="field-label">Model Selection</label>
                {provider === 'auto' ? (
                  <select className="select-input" value={model} onChange={e => setModel(e.target.value)}>
                    <option value="auto">Automatic (Gemini-3.8-flash online / Qwen-2.5-coder local)</option>
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Primary candidate)</option>
                    <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b (Primary candidate)</option>
                  </select>
                ) : provider === 'gemini' ? (
                  <select className="select-input" value={model} onChange={e => setModel(e.target.value)}>
                    <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended — Fast & Low Latency)</option>
                    <option value="gemini-3.8-pro">gemini-3.8-pro (Complex Architecture & Reasoning)</option>
                    <option value="gemini-3.5-flash">gemini-3.5-flash (Standard fallback)</option>
                  </select>
                ) : (
                  <select className="select-input" value={model} onChange={e => setModel(e.target.value)}>
                    <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b (Ultra-Fast • Low RAM • Best for 8GB RAM)</option>
                    <option value="qwen2.5-coder:3b">qwen2.5-coder:3b (High Precision Coding • Recommended)</option>
                  </select>
                )}
              </div>

              {/* API Key (if online or auto) */}
              {provider !== 'ollama' && (
                <div className="settings-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="field-label" style={{ margin: 0 }}>
                      Google Gemini API Key
                    </label>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-btn"
                    >
                      <span>Get Free Gemini Key</span>
                      <ExternalLink size={11} />
                    </a>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <input
                      type={showKey ? 'text' : 'password'}
                      className="text-input"
                      style={{ paddingRight: 40 }}
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={
                        systemStatus?.gemini === 'configured'
                          ? '•••••••••••••••••••••••••••••••• (Configured in backend .env)'
                          : 'Paste your API key here (AIzaSy...)'
                      }
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 26, height: 26 }}
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Keys are stored securely in backend <code>.env</code> on your USB drive and never exposed in browser bundles.
                  </p>
                </div>
              )}

              {/* Diagnostic Box */}
              <div className="test-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Connection Diagnostic</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Test live connectivity for {provider.toUpperCase()}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={handleTest}
                    disabled={isTesting}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {isTesting ? (
                      <>
                        <RefreshCw size={12} className="spin" /> Testing…
                      </>
                    ) : (
                      <>
                        <Zap size={12} /> Test Connection
                      </>
                    )}
                  </button>
                </div>

                {testResult && (
                  <div
                    className="test-result-box"
                    style={{
                      marginTop: 10,
                      background: testResult.ok ? 'var(--emerald-dim)' : 'var(--red-dim)',
                      borderColor: testResult.ok ? 'var(--emerald)' : 'var(--red)',
                    }}
                  >
                    {testResult.ok ? <Check size={16} color="var(--emerald)" /> : <AlertCircle size={16} color="var(--red)" />}
                    <div style={{ fontSize: 12, flex: 1 }}>
                      <strong>{testResult.ok ? 'Verified:' : 'Failed:'}</strong> {testResult.message}
                      {testResult.elapsedMs && (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>({testResult.elapsedMs}ms)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: Ollama Speed & RAM */}
          {activeTab === 'speed' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Smart Routing Toggle */}
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Local Model Smart Routing</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Automatically uses <strong>1.5B</strong> for greetings & routine questions, and upgrades to <strong>3B</strong> for complex MERN code & architecture.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={smartRouting}
                    onChange={(e) => setSmartRouting(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-light)' }}
                  />
                </div>
              </div>

              {/* Model Warmth / Keep Alive */}
              <div className="settings-field">
                <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Clock size={13} /> Model Memory Warmth (keep_alive)
                </label>
                <select className="select-input" value={keepAlive} onChange={(e) => setKeepAlive(e.target.value)}>
                  <option value="5m">5 Minutes (Recommended for 8GB RAM • Prevents repeated 50s cold load)</option>
                  <option value="10m">10 Minutes (Keep warm during coding sessions)</option>
                  <option value="30m">30 Minutes (Fastest responses, holds model in RAM)</option>
                  <option value="0">0 (Unload immediately after each reply • Saves RAM)</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Keeping the model warm avoids spending 50 seconds reloading from disk on every message.
                </span>
              </div>

              {/* Response Length Limit (num_predict) */}
              <div className="settings-field">
                <label className="field-label">Max Generation Limit (num_predict)</label>
                <select className="select-input" value={numPredict} onChange={(e) => setNumPredict(e.target.value)}>
                  <option value="256">256 tokens (Ultra-fast short answers)</option>
                  <option value="512">512 tokens (Balanced default for routine questions)</option>
                  <option value="1024">1024 tokens (Standard code files)</option>
                  <option value="2048">2048 tokens (Long full-stack code generation)</option>
                </select>
              </div>

              {/* Context Window (num_ctx) */}
              <div className="settings-field">
                <label className="field-label">Context Window Size (num_ctx)</label>
                <select className="select-input" value={numCtx} onChange={(e) => setNumCtx(e.target.value)}>
                  <option value="2048">2048 tokens (Recommended • Fits comfortably in 8GB RAM)</option>
                  <option value="4096">4096 tokens (Extended context • Uses ~600MB additional RAM)</option>
                </select>
              </div>

              {/* Conversation History Pruning */}
              <div className="settings-field">
                <label className="field-label">Max Recent Messages Sent to Model</label>
                <select className="select-input" value={maxHistory} onChange={(e) => setMaxHistory(e.target.value)}>
                  <option value="4">Last 4 messages (Fastest CPU processing)</option>
                  <option value="6">Last 6 messages (Recommended balance)</option>
                  <option value="10">Last 10 messages (Longer conversation continuity)</option>
                </select>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Limits CPU processing overhead during long conversations on integrated graphics.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: Temporary Memory & Cache */}
          {activeTab === 'memory' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Disclaimer Notice Banner */}
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.25)', padding: '10px 14px', borderRadius: 8, display: 'flex', gap: 10 }}>
                <Info size={16} color="var(--accent-light)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: 11, color: '#e2e8f0', lineHeight: 1.4 }}>
                  <strong>How Nilesh Memory Works:</strong> Temporary memory and response caching are stored locally in your SQLite database. They speed up recurring questions and maintain continuity, but do <strong>NOT</strong> fine-tune or modify the underlying language model weights.
                </div>
              </div>

              {/* Temporary Personal Memory Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Temporary Personal Memory</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Remembers your preferences and recurring task context. Auto-expires after duration.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={memoryEnabled}
                    onChange={(e) => setMemoryEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-light)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <span style={{ fontSize: 12 }}>Auto-Expiration TTL:</span>
                  <select
                    className="select-input"
                    value={memoryTtlDays}
                    onChange={(e) => setMemoryTtlDays(e.target.value)}
                    style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">7 Days (Default)</option>
                    <option value="14">14 Days</option>
                    <option value="30">30 Days</option>
                  </select>
                </div>

                {/* Memories List */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Active Stored Memories ({memoriesList.length})
                    </span>
                    {memoriesList.length > 0 && (
                      <button
                        className="btn-ghost"
                        onClick={handleClearAllMemories}
                        style={{ fontSize: 11, color: 'var(--red)', padding: '2px 6px' }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {memoriesList.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', padding: '6px 0' }}>
                      No memories stored yet. Nilesh will remember preferences you mention in conversation.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {memoriesList.map((m) => (
                        <div
                          key={m.id}
                          style={{
                            background: 'var(--bg-input)',
                            padding: '6px 10px',
                            borderRadius: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>
                            <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{m.key}: </span>
                            <span style={{ color: 'var(--text-primary)' }}>{m.value}</span>
                          </div>
                          <button
                            className="btn-icon-subtle"
                            onClick={() => handleDeleteMemory(m.id)}
                            title="Delete memory item"
                            style={{ padding: 3, flexShrink: 0 }}
                          >
                            <Trash2 size={12} color="var(--red)" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Repeated-Question Cache Section */}
              <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Repeated-Question Cache</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Serves instant answers (&lt;1ms) for previously answered routine questions.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={cacheEnabled}
                    onChange={(e) => setCacheEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--accent-light)' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
                  <div style={{ fontSize: 12 }}>
                    <strong>{cacheStats.count}</strong> cached answers • <strong>{cacheStats.totalHits}</strong> instant cache hits
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearCache}
                    disabled={cacheStats.count === 0}
                    style={{ fontSize: 11, padding: '4px 8px' }}
                  >
                    <RotateCcw size={11} /> Clear Cache
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '12px 20px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {saveSuccess ? (
              <>
                <Check size={14} /> Saved & Applied!
              </>
            ) : isSaving ? (
              <>Saving…</>
            ) : (
              <>Save Preferences</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
