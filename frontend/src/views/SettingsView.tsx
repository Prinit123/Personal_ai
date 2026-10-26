import { useState, useEffect } from 'react';
import {
  RefreshCw, ShieldCheck, Check, AlertCircle, Info, Zap
} from 'lucide-react';
import { api } from '../api/client';
import type { AppSettings, SystemStatus } from '../types';

interface SettingsViewProps {
  onSettingsUpdated: () => void;
}

export default function SettingsView({ onSettingsUpdated }: SettingsViewProps) {
  const [settings,    setSettings]    = useState<AppSettings | null>(null);
  const [status,      setStatus]      = useState<SystemStatus | null>(null);
  const [savedOk,     setSavedOk]     = useState(false);
  const [testResult,  setTestResult]  = useState<{ provider: string; ok: boolean; message: string; elapsedMs: number } | null>(null);
  const [testing,     setTesting]     = useState(false);

  useEffect(() => {
    loadSettings();
    loadStatus();
  }, []);

  async function loadSettings() {
    try {
      const data = await api.get<AppSettings>('/api/settings');
      setSettings(data);
    } catch {}
  }

  async function loadStatus() {
    try {
      const data = await api.get<SystemStatus>('/api/status');
      setStatus(data);
    } catch {}
  }

  async function saveSetting(key: string, value: string) {
    if (!settings) return;
    setSettings(prev => prev ? ({ ...prev, [key]: value }) : null);
    try {
      await api.post('/api/settings', { key, value });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2000);
      onSettingsUpdated();
    } catch (err: any) {
      alert(`Error saving setting: ${err.message}`);
    }
  }

  async function handleTestProvider(provider: string, model: string) {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post<{ provider: string; ok: boolean; message: string; elapsedMs: number }>(
        '/api/settings/test-provider',
        { provider, model }
      );
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        provider,
        ok: false,
        message: err.message,
        elapsedMs: 0,
      });
    }
    setTesting(false);
  }

  if (!settings) {
    return (
      <div className="empty-state">
        <div className="typing-dots"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading settings…</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">⚙️ Settings & Configuration</div>
          <div className="page-subtitle">Configure AI models, API keys, explanations, and system parameters</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedOk && (
            <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Check size={11} /> Saved
            </span>
          )}
          <button className="btn btn-secondary" onClick={() => { loadSettings(); loadStatus(); }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        <div className="settings-container">

          {/* 1. AI Provider Selection */}
          <div className="settings-section">
            <div className="settings-section-header">🧠 AI Provider & Intelligence Engine</div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Default AI Provider</div>
                <div className="settings-row-desc">
                  Choose between local offline models (Ollama) or high-speed online models (Gemini).
                </div>
              </div>
              <select
                className="input"
                style={{ width: 170 }}
                value={settings.ai_provider}
                onChange={e => saveSetting('ai_provider', e.target.value)}
              >
                <option value="ollama">Ollama (Local Offline)</option>
                <option value="gemini">Google Gemini (Online)</option>
                <option value="auto">Auto (Online with Local Fallback)</option>
              </select>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Default AI Model</div>
                <div className="settings-row-desc">
                  Recommended for 8GB RAM: <strong>qwen2.5-coder:3b</strong> (smooth & fast on integrated graphics).
                </div>
              </div>
              <select
                className="input"
                style={{ width: 200 }}
                value={settings.ai_model}
                onChange={e => saveSetting('ai_model', e.target.value)}
              >
                <optgroup label="Local Models (Ollama - Offline)">
                  <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b (Ultra-Fast • Low RAM)</option>
                  <option value="qwen2.5-coder:3b">qwen2.5-coder:3b (Recommended Coding • Precision)</option>
                </optgroup>
                <optgroup label="Online Models (Google Gemini)">
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Recommended — Ultra-Fast & High Intelligence)</option>
                  <option value="gemini-3.8-pro">gemini-3.8-pro (Deep Coding & Architecture)</option>
                </optgroup>
              </select>
            </div>

            {/* Smart Local Routing */}
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Smart Local Model Routing</div>
                <div className="settings-row-desc">
                  Auto-routes greetings & simple questions to 1.5B (fast) and complex code tasks to 3B.
                </div>
              </div>
              <button
                className={`toggle ${settings.local_smart_routing !== 'false' ? 'on' : ''}`}
                onClick={() => saveSetting('local_smart_routing', settings.local_smart_routing === 'false' ? 'true' : 'false')}
              />
            </div>

            {/* Ollama Keep-Alive Warmth */}
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Ollama Model Warmth (keep_alive)</div>
                <div className="settings-row-desc">
                  Keeps the model loaded in RAM to prevent repeated 50-second cold start delays.
                </div>
              </div>
              <select
                className="input"
                style={{ width: 170 }}
                value={settings.ollama_keep_alive || '5m'}
                onChange={e => saveSetting('ollama_keep_alive', e.target.value)}
              >
                <option value="5m">5 Minutes (Default)</option>
                <option value="10m">10 Minutes</option>
                <option value="30m">30 Minutes</option>
                <option value="0">0 (Unload immediately)</option>
              </select>
            </div>

            {/* Temporary Memory & Cache Section */}
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Temporary Personal Memory</div>
                <div className="settings-row-desc">
                  Retains temporary task preferences in local SQLite cache. Auto-purged after expiration.
                </div>
              </div>
              <button
                className={`toggle ${settings.memory_enabled !== 'false' ? 'on' : ''}`}
                onClick={() => saveSetting('memory_enabled', settings.memory_enabled === 'false' ? 'true' : 'false')}
              />
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Repeated-Question Cache</div>
                <div className="settings-row-desc">
                  Returns instant answers (&lt;1ms) for repeated safe questions without re-running models.
                </div>
              </div>
              <button
                className={`toggle ${settings.cache_enabled !== 'false' ? 'on' : ''}`}
                onClick={() => saveSetting('cache_enabled', settings.cache_enabled === 'false' ? 'true' : 'false')}
              />
            </div>

            {/* Test Connection Button */}
            <div className="settings-row" style={{ background: 'var(--bg-input)' }}>
              <div>
                <div className="settings-row-label">Test Connection</div>
                <div className="settings-row-desc">
                  Send a lightweight diagnostic ping to the configured provider.
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => handleTestProvider(settings.ai_provider, settings.ai_model)}
                disabled={testing}
              >
                {testing ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Testing…</> : <><Zap size={13} /> Test Provider</>}
              </button>
            </div>

            {testResult && (
              <div style={{
                padding: '12px 18px',
                background: testResult.ok ? 'var(--emerald-dim)' : 'var(--red-dim)',
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {testResult.ok ? <Check size={15} color="var(--emerald)" /> : <AlertCircle size={15} color="var(--red)" />}
                <div>
                  <strong>{testResult.provider.toUpperCase()}:</strong> {testResult.message}
                  {testResult.ok && <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>({testResult.elapsedMs}ms)</span>}
                </div>
              </div>
            )}
          </div>

          {/* 2. Web Search & Live Research */}
          <div className="settings-section">
            <div className="settings-section-header">🌐 Web Search & Fresh Information</div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Web Search Enabled</div>
                <div className="settings-row-desc">
                  Allow Nilesh to search the internet when responding to real-time questions.
                </div>
              </div>
              <button
                className={`toggle ${settings.web_search_enabled === 'true' ? 'on' : ''}`}
                onClick={() => saveSetting('web_search_enabled', settings.web_search_enabled === 'true' ? 'false' : 'true')}
              />
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Search Provider</div>
                <div className="settings-row-desc">
                  Brave Search API (with automatic DuckDuckGo fallback).
                </div>
              </div>
              <select
                className="input"
                style={{ width: 170 }}
                value={settings.search_provider}
                onChange={e => saveSetting('search_provider', e.target.value)}
              >
                <option value="brave">Brave Search API</option>
                <option value="duckduckgo">DuckDuckGo (Fallback)</option>
              </select>
            </div>
          </div>

          {/* 3. Programming & Teaching Preferences */}
          <div className="settings-section">
            <div className="settings-section-header">🎓 Programming & Explanation Style</div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Explanation Level</div>
                <div className="settings-row-desc">
                  Tailors how Nilesh explains code, concepts, and technical solutions.
                </div>
              </div>
              <select
                className="input"
                style={{ width: 170 }}
                value={settings.explanation_level}
                onChange={e => saveSetting('explanation_level', e.target.value)}
              >
                <option value="beginner">Beginner (Step-by-step with analogies)</option>
                <option value="intermediate">Intermediate (Clear rationale & best practices)</option>
                <option value="expert">Expert (Concise, technical, minimal prose)</option>
              </select>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">User Interface Theme</div>
                <div className="settings-row-desc">
                  Modern dark mode with high contrast and eye comfort.
                </div>
              </div>
              <select
                className="input"
                style={{ width: 120 }}
                value={settings.theme}
                onChange={e => saveSetting('theme', e.target.value)}
              >
                <option value="dark">Dark</option>
                <option value="light" disabled>Light (Coming soon)</option>
              </select>
            </div>
          </div>

          {/* 4. Portability & Storage Diagnostics */}
          <div className="settings-section">
            <div className="settings-section-header">💾 USB Portability & Storage</div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Persistence Database</div>
                <div className="settings-row-desc">
                  Portable SQLite database storing chats, projects, settings, and knowledge.
                </div>
              </div>
              <code style={{ fontSize: 11, background: '#0d1117', padding: '4px 8px', borderRadius: 4 }}>
                e:\MyPersonalAI\data\nilesh.db
              </code>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Generated Projects Root</div>
                <div className="settings-row-desc">
                  All websites created by Website Builder are saved here.
                </div>
              </div>
              <code style={{ fontSize: 11, background: '#0d1117', padding: '4px 8px', borderRadius: 4 }}>
                e:\MyPersonalAI\projects
              </code>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-row-label">Portability Status</div>
                <div className="settings-row-desc">
                  Relative paths used throughout. Safe to plug into any compatible Windows PC.
                </div>
              </div>
              <span className="badge badge-green">
                <ShieldCheck size={11} /> Fully Portable
              </span>
            </div>

            {status && (
              <div className="settings-row">
                <div>
                  <div className="settings-row-label">Backend Diagnostics</div>
                  <div className="settings-row-desc">
                    Uptime: {Math.floor(status.uptime / 60)} minutes | Ollama: {status.ollama} | Gemini: {status.gemini}
                  </div>
                </div>
                <span className="badge badge-blue">
                  {status.ollamaModels?.length || 0} local models detected
                </span>
              </div>
            )}
          </div>

          {/* 5. API Keys Configuration Info */}
          <div className="card" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Info size={16} color="var(--accent-light)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <strong>API Keys Configuration:</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                  To set up your Google Gemini API key or Brave Search key, open or edit the root file:
                  <br />
                  <code style={{ color: 'var(--accent-light)' }}>e:\MyPersonalAI\.env</code>
                  <br />
                  Add:
                  <br />
                  <code>GEMINI_API_KEY=your_key_here</code>
                  <br />
                  <code>BRAVE_SEARCH_API_KEY=your_key_here</code>
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
