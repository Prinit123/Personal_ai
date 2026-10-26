import { useState, useEffect, useRef } from 'react';
import { Play, File, CheckCircle, RefreshCw, X, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api, streamBuilder } from '../api/client';
import type { Project, BuilderPlan, AppView } from '../types';

type BuilderMode = 'generate' | 'edit' | 'fix';

interface BuilderViewProps {
  activeProject:   Project | null;
  onProjectSelect: (p: Project) => void;
  onViewChange:    (v: AppView) => void;
}

export default function BuilderView({ activeProject, onProjectSelect, onViewChange }: BuilderViewProps) {
  const [mode,        setMode]        = useState<BuilderMode>('generate');
  const [prompt,      setPrompt]      = useState('');
  const [plan,        setPlan]        = useState<BuilderPlan | null>(null);
  const [output,      setOutput]      = useState('');
  const [createdFiles,setCreatedFiles] = useState<string[]>([]);
  const [phase,       setPhase]       = useState<'idle'|'planning'|'building'|'done'|'error'>('idle');
  const [projects,    setProjects]    = useState<Project[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const list = await api.get<Project[]>('/api/projects');
      setProjects(list);
    } catch {}
  }

  async function handlePlan() {
    if (!prompt.trim()) return;
    setPhase('planning');
    setOutput('');
    setPlan(null);
    setCreatedFiles([]);

    try {
      const res = await api.post<{ plan: BuilderPlan; raw: string }>('/api/builder/plan', {
        prompt,
        projectName: activeProject?.id,
      });
      setPlan(res.plan);
      setPhase('idle');
    } catch (err: any) {
      setOutput(`❌ Planning failed: ${err.message}`);
      setPhase('error');
    }
  }

  async function handleGenerate() {
    if (!activeProject) {
      alert('Please select or create a project first.');
      onViewChange('projects');
      return;
    }

    setPhase('building');
    setOutput('');
    setCreatedFiles([]);
    abortRef.current = new AbortController();

    await streamBuilder({
      prompt,
      plan: plan ?? undefined,
      projectId: activeProject.id,
      onChunk: (text) => setOutput(prev => prev + text),
      onFileCreated: (path) => setCreatedFiles(prev => [...prev, path]),
      onDone: (files) => {
        if (files && files.length > 0) setCreatedFiles(files);
        setPhase('done');
      },
      onError: (err) => {
        setOutput(prev => prev + `\n\n❌ Error: ${err}`);
        setPhase('error');
      },
      signal: abortRef.current.signal,
    });
  }

  const promptExamples = [
    'Create a cafe website with menu, online orders, and admin dashboard',
    'Build a blog platform with user login, posts, comments, and MongoDB',
    'Make a portfolio website with projects, skills, and contact form',
    'Create an e-commerce store with cart, checkout, and product management',
    'Build a task manager app with teams, deadlines, and priority labels',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">🏗️ Website Builder</div>
          <div className="page-subtitle">Generate complete MERN stack websites from your description</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['generate', 'edit', 'fix'] as BuilderMode[]).map(m => (
            <button
              key={m}
              className={`btn ${mode === m ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={() => { setMode(m); if (m === 'edit') loadProjects(); }}
            >
              {m === 'generate' ? '✨ Generate' : m === 'edit' ? '✏️ Edit' : '🔧 Fix'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto flex-1" style={{ padding: 20, display: 'flex', gap: 20 }}>
        {/* Left: Input panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          {/* Project selector */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Active Project</span>
              <div style={{ display: 'flex', gap: 6 }}>
                {projects.length > 0 && (
                  <select
                    className="input"
                    style={{ fontSize: 11, padding: '3px 8px', width: 'auto' }}
                    value={activeProject?.id || ''}
                    onChange={(e) => {
                      const p = projects.find(x => x.id === e.target.value);
                      if (p) onProjectSelect(p);
                    }}
                  >
                    <option value="" disabled>Switch Project</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <button className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}
                  onClick={() => onViewChange('projects')}>
                  {activeProject ? 'Manage' : 'New Project'}
                </button>
              </div>
            </div>
            {activeProject ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{activeProject.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeProject.path}</div>
                </div>
                <span className="badge badge-green" style={{ marginLeft: 'auto' }}>Selected</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                No project selected. Create or select a project to generate files.
                <br />
                <button className="btn btn-primary" style={{ marginTop: 8, fontSize: 12 }}
                  onClick={() => onViewChange('projects')}>
                  <Play size={12} /> Go to Projects
                </button>
              </div>
            )}
          </div>

          {/* Prompt input */}
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>
              {mode === 'generate' ? '✨ Describe your website' : mode === 'edit' ? '✏️ What to change?' : '🔧 Describe the error'}
            </div>
            <textarea
              className="input"
              style={{ minHeight: 100, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
              placeholder={
                mode === 'generate'
                  ? 'e.g. "Create a restaurant website with a menu, online ordering, user login, MongoDB database, and an admin dashboard to manage orders and menu items."'
                  : mode === 'edit'
                  ? 'e.g. "Add a dark mode toggle" or "Make the navbar responsive" or "Add a search feature to the products page"'
                  : 'e.g. "Fix the CORS error in the backend" or "The login form is not submitting"'
              }
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
            />

            {mode === 'generate' && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>💡 Examples:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {promptExamples.map((ex, i) => (
                    <button key={i} className="nav-item" style={{ fontSize: 11, padding: '5px 8px' }}
                      onClick={() => setPrompt(ex)}>
                      <ChevronRight size={10} /> {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {mode === 'generate' && !plan && (
                <button
                  className="btn btn-secondary"
                  onClick={handlePlan}
                  disabled={!prompt.trim() || phase === 'planning'}
                >
                  {phase === 'planning' ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Planning…</> : '📋 Preview Plan'}
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!prompt.trim() || !activeProject || phase === 'building'}
                style={{ flex: 1 }}
              >
                {phase === 'building'
                  ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Building…</>
                  : mode === 'generate' ? '🚀 Generate Project' : mode === 'edit' ? '✏️ Apply Changes' : '🔧 Fix Errors'
                }
              </button>
              {phase === 'building' && (
                <button className="btn btn-danger" onClick={() => abortRef.current?.abort()}>
                  <X size={13} /> Stop
                </button>
              )}
            </div>
          </div>

          {/* Plan preview */}
          {plan && (
            <div className="card" style={{ borderColor: 'rgba(79,110,247,0.3)' }}>
              <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, color: 'var(--accent-light)' }}>
                📋 Implementation Plan
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div><strong style={{ fontSize: 12 }}>Project:</strong> <span style={{ fontSize: 12 }}>{plan.title}</span></div>
                <div><strong style={{ fontSize: 12 }}>Description:</strong> <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{plan.description}</span></div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Pages</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {plan.pages?.map(p => <span key={p} className="badge badge-blue">{p}</span>)}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Features</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {plan.features?.slice(0, 8).map((f, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <CheckCircle size={10} color="var(--emerald)" /> {f}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {plan.requiresAuth && <span className="badge badge-blue">🔐 Auth</span>}
                  {plan.requiresMongoDB && <span className="badge badge-green">🍃 MongoDB</span>}
                  <span className="badge badge-gray">~{plan.estimatedFiles} files</span>
                </div>

                {plan.clarifyingQuestions?.length > 0 && (
                  <div style={{ background: 'var(--bg-hover)', borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--amber)' }}>
                      ❓ Clarifying questions (answer in your prompt if important):
                    </div>
                    {plan.clarifyingQuestions.map((q, i) => (
                      <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 3 }}>
                        {i + 1}. {q}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Output panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Created files */}
          {createdFiles.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--emerald)', marginBottom: 8 }}>
                <CheckCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
                {createdFiles.length} file{createdFiles.length !== 1 ? 's' : ''} created
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
                {createdFiles.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <File size={10} color="var(--emerald)" />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{f}</span>
                  </div>
                ))}
              </div>
              {phase === 'done' && (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--emerald-dim)', borderRadius: 8, fontSize: 12 }}>
                  🎉 <strong>Generation complete!</strong> To run your project:
                  <ol style={{ marginTop: 6, paddingLeft: 16, color: 'var(--text-secondary)' }}>
                    <li>Open a terminal in: <code style={{ fontSize: 11 }}>{activeProject?.path}</code></li>
                    <li>Backend: <code style={{ fontSize: 11 }}>cd backend && npm install && npm start</code></li>
                    <li>Frontend: <code style={{ fontSize: 11 }}>cd frontend && npm install && npm run dev</code></li>
                    <li>Configure <code style={{ fontSize: 11 }}>.env</code> with your MongoDB URI</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* AI output stream */}
          {(output || phase === 'building') && (
            <div className="card" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                {phase === 'building' && (
                  <div className="typing-dots" style={{ display: 'inline-flex', marginRight: 4 }}>
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </div>
                )}
                {phase === 'building' ? 'Generating…' : phase === 'done' ? '✅ Complete' : '❌ Error'}
              </div>
              <div className="overflow-y-auto flex-1 md-body" style={{ fontSize: 12 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {output || '…'}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {phase === 'idle' && !output && (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-icon">🏗️</div>
              <div className="empty-state-title">Ready to Build</div>
              <div className="empty-state-desc">
                Enter your website description on the left and click <strong>Generate Project</strong>.
                <br /><br />
                Nilesh will create a complete React + Express + MongoDB application with all necessary files.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
