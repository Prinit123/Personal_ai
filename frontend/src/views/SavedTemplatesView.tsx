// src/views/SavedTemplatesView.tsx — Reusable Message Library & Saved Templates
import { useState, useEffect } from 'react';
import {
  Bookmark, Search, Copy, Check, Trash2, Plus, Volume2,
  Folder, RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis } from '../hooks/useVoiceInput';
import type { SavedTemplate } from '../types';

export default function SavedTemplatesView() {
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New template modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Messages');
  const [newRecipient, setNewRecipient] = useState('');
  const [newTone, setNewTone] = useState('');
  const [newContent, setNewContent] = useState('');

  const { speak } = useSpeechSynthesis();

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<SavedTemplate[]>('/api/comm/templates');
      setTemplates(data || []);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.delete(`/api/comm/templates/${id}`);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      alert('Please provide a title and content.');
      return;
    }
    try {
      const created = await api.post<SavedTemplate>('/api/comm/templates', {
        title: newTitle.trim(),
        category: newCategory,
        recipient: newRecipient.trim() || undefined,
        tone: newTone.trim() || undefined,
        content: newContent.trim()
      });
      setTemplates(prev => [created, ...prev]);
      setShowAddModal(false);
      setNewTitle('');
      setNewContent('');
      setNewRecipient('');
      setNewTone('');
    } catch (err: any) {
      alert(`Error creating template: ${err.message}`);
    }
  };

  const categories = ['All', ...Array.from(new Set(templates.map(t => t.category).filter(Boolean)))];

  const filteredTemplates = templates.filter(t => {
    const matchesCategory = activeCategory === 'All' || t.category === activeCategory;
    const q = searchQuery.toLowerCase();
    const matchesQuery = !searchQuery ||
      t.title.toLowerCase().includes(q) ||
      t.content.toLowerCase().includes(q) ||
      (t.recipient && t.recipient.toLowerCase().includes(q));
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="view-container" style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ maxWidth: 940, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
              <Bookmark size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
                Saved Templates & Messages
              </h1>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                Your private offline library of favorite messages, wishes, and notices saved on your device.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              onClick={loadTemplates}
              style={{ fontSize: 13, padding: '7px 12px', gap: 6 }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddModal(true)}
              style={{ fontSize: 13, padding: '7px 14px', gap: 6 }}
            >
              <Plus size={15} />
              <span>New Template</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Search & Category Filter */}
        <div className="dashboard-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search templates by title, recipient, or text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  paddingLeft: 36,
                  paddingRight: 12,
                  fontSize: 13,
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: activeCategory === cat ? 600 : 400,
                    border: activeCategory === cat ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: activeCategory === cat ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    color: activeCategory === cat ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Templates List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <span className="spin" style={{ fontSize: 24, display: 'inline-block', marginBottom: 10 }}>◌</span>
            <div>Loading your saved templates...</div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="dashboard-card" style={{ padding: 48, textAlign: 'center' }}>
            <Folder size={36} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>No Templates Found</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 16px' }}>
              {searchQuery ? 'No templates matched your search query.' : 'Save messages from Write a Message, Birthday Wishes, or Teacher Messages to access them quickly here!'}
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ margin: '0 auto' }}>
              Create Your First Template
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14 }}>
            {filteredTemplates.map(item => (
              <div
                key={item.id}
                className="dashboard-card"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                  border: '1px solid var(--border)',
                  position: 'relative'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                      {item.title}
                    </h3>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 99,
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--primary)'
                    }}>
                      {item.category}
                    </span>
                  </div>

                  {(item.recipient || item.tone) && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, display: 'flex', gap: 8 }}>
                      {item.recipient && <span>To: <strong>{item.recipient}</strong></span>}
                      {item.tone && <span>Tone: <strong>{item.tone}</strong></span>}
                    </div>
                  )}

                  <div style={{
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: 'var(--text-secondary)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 140,
                    overflowY: 'auto',
                    background: 'var(--bg-input)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    {item.content}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <button
                    className="btn-icon-subtle"
                    onClick={() => speak(item.content, 'en-US')}
                    title="Listen aloud"
                    style={{ padding: 6 }}
                  >
                    <Volume2 size={15} />
                  </button>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleCopy(item.content, item.id)}
                      style={{ fontSize: 11, padding: '4px 10px', gap: 4 }}
                    >
                      {copiedId === item.id ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                      <span>{copiedId === item.id ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      className="btn-icon-subtle"
                      onClick={() => handleDelete(item.id)}
                      title="Delete template"
                      style={{ padding: 6, color: 'var(--error)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Template Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div className="dashboard-card" style={{ maxWidth: 520, width: '100%', padding: 24, boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px' }}>Add New Saved Template</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Title:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Leave note to Sir"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0 12px',
                    fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Category:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 10px',
                      fontSize: 13,
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="Messages">Messages</option>
                    <option value="Special Wishes">Special Wishes</option>
                    <option value="Education & Teaching">Education & Teaching</option>
                    <option value="Professional">Professional</option>
                    <option value="General">General</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                    Recipient (Optional):
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Student, Sir"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    style={{
                      width: '100%',
                      height: 38,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0 12px',
                      fontSize: 13
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                  Message Content:
                </label>
                <textarea
                  rows={4}
                  placeholder="Enter message template text here..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    fontSize: 13
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleCreate}>
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
