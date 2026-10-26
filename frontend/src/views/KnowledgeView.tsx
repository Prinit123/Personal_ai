// src/views/KnowledgeView.tsx — Knowledge base / document import
import { useState, useEffect } from 'react';
import { Plus, Link, Trash2, BookOpen, RefreshCw, Save } from 'lucide-react';
import { api } from '../api/client';
import type { KnowledgeSource } from '../types';

export default function KnowledgeView() {
  const [sources,  setSources]  = useState<KnowledgeSource[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [adding,   setAdding]   = useState<'note'|'url'|null>(null);
  const [form,     setForm]     = useState({ name: '', url: '', content: '', tags: '' });
  const [saving,   setSaving]   = useState(false);

  useEffect(() => { loadSources(); }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const list = await api.get<KnowledgeSource[]>('/api/knowledge');
      setSources(list);
    } catch {}
    setLoading(false);
  }

  async function addSource() {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim() || 'Untitled',
        type: adding,
        tags: form.tags,
      };
      if (adding === 'url')  { payload.url     = form.url; }
      if (adding === 'note') { payload.content  = form.content; }

      const created = await api.post<KnowledgeSource>('/api/knowledge', payload);
      setSources(prev => [created, ...prev]);
      setAdding(null);
      setForm({ name: '', url: '', content: '', tags: '' });
    } catch (err: any) {
      alert('Failed to add: ' + err.message);
    }
    setSaving(false);
  }

  async function deleteSource(id: string) {
    if (!confirm('Remove this knowledge source?')) return;
    await api.delete(`/api/knowledge/${id}`);
    setSources(prev => prev.filter(s => s.id !== id));
  }

  const typeIcon = (type: string) => type === 'url' ? '🔗' : type === 'file' ? '📄' : '📝';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📚 Knowledge Base</div>
          <div className="page-subtitle">Import URLs, files, and notes for AI-powered retrieval</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={loadSources}><RefreshCw size={13} /></button>
          <button className="btn btn-secondary" onClick={() => setAdding('url')}><Link size={13} /> Add URL</button>
          <button className="btn btn-primary" onClick={() => setAdding('note')}><Plus size={13} /> Add Note</button>
        </div>
      </div>

      {/* Add form */}
      {adding && (
        <div className="modal-overlay" onClick={() => setAdding(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">{adding === 'url' ? '🔗 Add URL' : '📝 Add Note'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Name / Title</label>
                <input className="input" placeholder="Source name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>

              {adding === 'url' ? (
                <div className="input-group">
                  <label className="input-label">URL *</label>
                  <input className="input" placeholder="https://..." type="url" value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
                </div>
              ) : (
                <div className="input-group">
                  <label className="input-label">Content *</label>
                  <textarea className="input" style={{ minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
                    placeholder="Paste text, notes, or documentation…"
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
                </div>
              )}

              <div className="input-group">
                <label className="input-label">Tags (comma-separated)</label>
                <input className="input" placeholder="react, hooks, frontend" value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setAdding(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={addSource} disabled={saving}>
                  {saving ? 'Saving…' : <><Save size={13} /> Save</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sources list */}
      <div className="overflow-y-auto flex-1" style={{ padding: 20 }}>
        {loading ? (
          <div className="empty-state">
            <div className="typing-dots"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
          </div>
        ) : sources.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><BookOpen size={40} opacity={0.3} /></div>
            <div className="empty-state-title">Empty Knowledge Base</div>
            <div className="empty-state-desc">
              Add URLs, paste notes, or import documents. Nilesh will use them when answering your questions.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setAdding('url')}><Link size={13} /> Add URL</button>
              <button className="btn btn-primary" onClick={() => setAdding('note')}><Plus size={13} /> Add Note</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {sources.map(s => (
              <div key={s.id} className="card">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 20 }}>{typeIcon(s.type)}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                      <span className={`badge badge-gray`} style={{ fontSize: 10, marginTop: 2 }}>{s.type}</span>
                    </div>
                  </div>
                  <button className="btn-icon" style={{ color: 'var(--red)' }} onClick={() => deleteSource(s.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>

                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--accent-light)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 6 }}>
                    {s.url}
                  </a>
                )}
                {s.content && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 6 }}>
                    {s.content.slice(0, 120)}…
                  </div>
                )}
                {s.tags && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {s.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                      <span key={t} className="badge badge-blue" style={{ fontSize: 10 }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8 }}>
                  Added {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
