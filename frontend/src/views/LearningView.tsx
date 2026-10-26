// src/views/LearningView.tsx — Dynamic Coding Challenge Learning System for Nilesh
import { useState, useRef, useCallback } from 'react';
import { streamLearning } from '../api/client';
import type { LearningTopic, Difficulty } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Topic definitions ────────────────────────────────────────────────────────

const TOPICS: Array<{ id: LearningTopic; label: string; icon: string; color: string }> = [
  { id: 'python',          label: 'Python',       icon: '🐍', color: '#3b82f6' },
  { id: 'javascript',      label: 'JavaScript',   icon: '⚡', color: '#f59e0b' },
  { id: 'java',            label: 'Java',          icon: '☕', color: '#ef4444' },
  { id: 'c',               label: 'C',             icon: '🔧', color: '#6b7280' },
  { id: 'cpp',             label: 'C++',           icon: '⚙️', color: '#8b5cf6' },
  { id: 'dsa',             label: 'DSA',           icon: '🌲', color: '#10b981' },
  { id: 'react',           label: 'React',         icon: '⚛️', color: '#06b6d4' },
  { id: 'nodejs',          label: 'Node.js',       icon: '🟢', color: '#22c55e' },
  { id: 'mern',            label: 'MERN Stack',    icon: '🏗️', color: '#f97316' },
  { id: 'machine-learning',label: 'ML',            icon: '🤖', color: '#a855f7' },
  { id: 'data-science',    label: 'Data Science',  icon: '📊', color: '#0ea5e9' },
  { id: 'sql',             label: 'SQL',           icon: '🗄️', color: '#14b8a6' },
  { id: 'mongodb',         label: 'MongoDB',       icon: '🍃', color: '#16a34a' },
  { id: 'html-css',        label: 'HTML/CSS',      icon: '🎨', color: '#ec4899' },
];

const DIFFICULTIES: Array<{ id: Difficulty; label: string; desc: string; color: string; bg: string }> = [
  { id: 'medium',   label: '🟡 Medium',   desc: '15–30 min · clear concepts',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { id: 'hard',     label: '🟠 Hard',     desc: '30–60 min · multi-concept',   color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  { id: 'advanced', label: '🔴 Advanced', desc: '1–2 hours · competitive lvl', color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
];

export default function LearningView() {
  const [selectedTopic,      setSelectedTopic]      = useState<LearningTopic>('python');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [challenge,          setChallenge]           = useState<string>('');
  const [isLoading,          setIsLoading]           = useState(false);
  const [showHints,          setShowHints]           = useState(false);
  const [showSolution,       setShowSolution]        = useState(false);
  const [history,            setHistory]             = useState<Array<{ topic: LearningTopic; difficulty: Difficulty; preview: string; content: string }>>([]);
  const abortRef = useRef<AbortController | null>(null);

  const generateChallenge = useCallback(async () => {
    if (isLoading) {
      abortRef.current?.abort();
      return;
    }

    abortRef.current = new AbortController();
    setChallenge('');
    setIsLoading(true);
    setShowHints(false);
    setShowSolution(false);
    let full = '';

    await streamLearning({
      topic:      selectedTopic,
      difficulty: selectedDifficulty,
      onChunk: (chunk) => {
        full += chunk;
        setChallenge(full);
      },
      onDone: () => {
        setIsLoading(false);
        // Save to local history (last 8)
        if (full.trim()) {
          const preview = full.match(/## 🎯 Problem Title\s*\n([^\n]+)/)?.[1]?.trim() || 'Challenge';
          setHistory(prev => [
            { topic: selectedTopic, difficulty: selectedDifficulty, preview, content: full },
            ...prev.slice(0, 7),
          ]);
        }
      },
      onError: (err) => {
        setChallenge(`\n\n> ⚠️ Error: ${err}\n\nMake sure your Gemini API key is configured in Settings.`);
        setIsLoading(false);
      },
      signal: abortRef.current.signal,
    });
  }, [selectedTopic, selectedDifficulty, isLoading]);

  const restoreHistory = (item: typeof history[0]) => {
    setSelectedTopic(item.topic);
    setSelectedDifficulty(item.difficulty);
    setChallenge(item.content);
    setShowHints(false);
    setShowSolution(false);
  };

  // Determine if challenge has certain sections
  const hasHints    = challenge.includes('## 💡 Hints');
  const hasSolution = challenge.includes('## ✅ Solution');

  // Render: mask hints and solution sections based on toggle
  const visibleChallenge = (() => {
    if (!challenge) return '';
    let text = challenge;

    if (!showSolution && hasSolution) {
      text = text.replace(
        /(## ✅ Solution[\s\S]*?)(?=## 🧠|## ⏱️|## 🧪|## ⚠️|## 🚀|$)/,
        '## ✅ Solution\n\n> 🔒 _Solution hidden — try solving it first!_\n\n'
      );
    }
    if (!showHints && hasHints) {
      text = text.replace(
        /(## 💡 Hints[\s\S]*?)(?=## ✅|## 🧠|## ⏱️|## 🧪|## ⚠️|## 🚀|$)/,
        '## 💡 Hints\n\n> 🔒 _Hints hidden — click "Show Hints" when you\'re stuck!_\n\n'
      );
    }
    return text;
  })();

  const activeTopic = TOPICS.find(t => t.id === selectedTopic)!;

  return (
    <div className="learning-view">
      {/* ── Left Panel ── */}
      <div className="learning-sidebar">
        <div className="learning-sidebar-inner">
          <div className="learning-section-title">📚 Topic</div>
          <div className="topic-grid">
            {TOPICS.map(t => (
              <button
                key={t.id}
                className={`topic-chip ${selectedTopic === t.id ? 'active' : ''}`}
                style={selectedTopic === t.id ? { borderColor: t.color, background: `${t.color}18`, color: t.color } : {}}
                onClick={() => setSelectedTopic(t.id)}
                title={t.label}
              >
                <span className="topic-chip-icon">{t.icon}</span>
                <span className="topic-chip-label">{t.label}</span>
              </button>
            ))}
          </div>

          <div className="learning-section-title" style={{ marginTop: 20 }}>🎯 Difficulty</div>
          <div className="difficulty-list">
            {DIFFICULTIES.map(d => (
              <button
                key={d.id}
                className={`difficulty-btn ${selectedDifficulty === d.id ? 'active' : ''}`}
                style={selectedDifficulty === d.id ? { borderColor: d.color, background: d.bg } : {}}
                onClick={() => setSelectedDifficulty(d.id)}
              >
                <span className="diff-label" style={selectedDifficulty === d.id ? { color: d.color } : {}}>{d.label}</span>
                <span className="diff-desc">{d.desc}</span>
              </button>
            ))}
          </div>

          <button
            className={`generate-btn ${isLoading ? 'loading' : ''}`}
            onClick={generateChallenge}
            style={isLoading ? {} : { background: `linear-gradient(135deg, ${activeTopic.color}, ${activeTopic.color}cc)` }}
          >
            {isLoading ? (
              <>
                <span className="spin">◌</span> Stop
              </>
            ) : (
              <>⚡ Generate Challenge</>
            )}
          </button>

          {/* Challenge controls (once loaded) */}
          {challenge && !isLoading && (
            <div className="challenge-controls">
              {hasHints && (
                <button
                  className={`ctrl-btn ${showHints ? 'active-green' : ''}`}
                  onClick={() => setShowHints(h => !h)}
                >
                  {showHints ? '🙈 Hide Hints' : '💡 Show Hints'}
                </button>
              )}
              {hasSolution && (
                <button
                  className={`ctrl-btn ${showSolution ? 'active-blue' : ''}`}
                  onClick={() => setShowSolution(s => !s)}
                >
                  {showSolution ? '🙈 Hide Solution' : '✅ Reveal Solution'}
                </button>
              )}
              <button
                className="ctrl-btn"
                onClick={generateChallenge}
              >
                🔄 New Challenge
              </button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <div className="learning-section-title" style={{ marginTop: 20 }}>🕐 History</div>
              <div className="history-list">
                {history.map((item, idx) => {
                  const t = TOPICS.find(x => x.id === item.topic);
                  return (
                    <button key={idx} className="history-item" onClick={() => restoreHistory(item)}>
                      <span>{t?.icon ?? '📝'}</span>
                      <div className="history-item-text">
                        <div className="history-title">{item.preview}</div>
                        <div className="history-meta">{t?.label} · {item.difficulty}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Right Panel: Challenge Content ── */}
      <div className="learning-main">
        {!challenge ? (
          <div className="learning-empty">
            <div className="learning-empty-icon">🎓</div>
            <h2>Ready to learn, {activeTopic.icon} {activeTopic.label}?</h2>
            <p>Pick a difficulty and generate a coding challenge.<br />
              Hints are hidden by default — try solving it first!</p>
            <button
              className="generate-btn"
              style={{ maxWidth: 260, margin: '0 auto', background: `linear-gradient(135deg, ${activeTopic.color}, ${activeTopic.color}cc)` }}
              onClick={generateChallenge}
            >
              ⚡ Generate First Challenge
            </button>
            <div className="learning-tips">
              <div className="tip-card">💡 <strong>Hints:</strong> Reveal when you're stuck — 3 levels of help available</div>
              <div className="tip-card">✅ <strong>Solution:</strong> Compare after you've tried it yourself</div>
              <div className="tip-card">⏱️ <strong>Complexity:</strong> Learn Big-O for every solution</div>
              <div className="tip-card">🧪 <strong>Test Cases:</strong> Validate your solution against edge cases</div>
            </div>
          </div>
        ) : (
          <div className="challenge-content">
            <div className="challenge-header">
              <div className="challenge-meta">
                <span className="topic-badge" style={{ background: `${activeTopic.color}20`, color: activeTopic.color }}>
                  {activeTopic.icon} {activeTopic.label}
                </span>
                <span className={`diff-badge diff-${selectedDifficulty}`}>
                  {DIFFICULTIES.find(d => d.id === selectedDifficulty)?.label}
                </span>
                {isLoading && <span className="streaming-badge">⚡ Generating…</span>}
              </div>
            </div>
            <div className="challenge-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {visibleChallenge}
              </ReactMarkdown>
              {isLoading && <span className="typing-cursor" />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
