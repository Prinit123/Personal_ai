// src/views/ProjectsView.tsx — Manage all generated projects
import { useState, useEffect } from 'react';
import { Plus, FolderOpen, Trash2, ExternalLink, RefreshCw, Clock } from 'lucide-react';
import { api } from '../api/client';
import type { Project, AppView } from '../types';

interface ProjectsViewProps {
  onProjectSelect:  (p: Project) => void;
  onViewChange:     (view: AppView) => void;
  activeProject:    Project | null;
}

export default function ProjectsView({ onProjectSelect, onViewChange, activeProject }: ProjectsViewProps) {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [creating,  setCreating]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadProjects(); }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const list = await api.get<Project[]>('/api/projects');
      setProjects(list);
    } catch { /* backend offline */ }
    setLoading(false);
  }

  async function createProject() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const project = await api.post<Project>('/api/projects', {
        name: newName.trim(),
        description: newDesc.trim() || 'Created with Nilesh',
      });
      setProjects(prev => [project, ...prev]);
      onProjectSelect(project);
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
    } catch (err: any) {
      alert('Failed to create project: ' + err.message);
    }
    setCreating(false);
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete project "${id}"? This will remove all generated files.`)) return;
    try {
      await api.delete(`/api/projects/${id}`);
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  }

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📁 My Projects</div>
          <div className="page-subtitle">{projects.length} generated project{projects.length !== 1 ? 's' : ''} in workspace</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={loadProjects}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Project
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">➕ Create New Project</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Project Name *</label>
                <input
                  className="input"
                  placeholder="my-awesome-app"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') createProject(); }}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Description (optional)</label>
                <input
                  className="input"
                  placeholder="What are you building?"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={createProject} disabled={creating || !newName.trim()}>
                  {creating ? 'Creating…' : 'Create Project'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                💡 Tip: Use the Website Builder to auto-generate a full MERN project from a prompt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Project grid */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="empty-state">
            <div className="typing-dots"><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading projects…</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📁</div>
            <div className="empty-state-title">No projects yet</div>
            <div className="empty-state-desc">
              Create a project manually or use the <strong>Website Builder</strong> to generate a complete MERN app from a prompt.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => onViewChange('builder')}>
                🏗️ Website Builder
              </button>
              <button className="btn btn-secondary" onClick={() => setShowCreate(true)}>
                <Plus size={13} /> Empty Project
              </button>
            </div>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map(project => (
              <div
                key={project.id}
                className={`project-card ${activeProject?.id === project.id ? 'active' : ''}`}
                onClick={() => { onProjectSelect(project); onViewChange('files'); }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 28 }}>📦</div>
                  <button
                    className="btn-icon"
                    style={{ color: 'var(--red)' }}
                    onClick={e => deleteProject(project.id, e)}
                    title="Delete project"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{project.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                  {project.description || 'No description'}
                </div>

                {project.generatedFiles && (
                  <div className="badge badge-blue" style={{ marginBottom: 8 }}>
                    📄 {project.generatedFiles} files generated
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span className="badge badge-gray">MERN</span>
                  <span className={`badge ${project.status === 'running' ? 'badge-green' : 'badge-gray'}`}>
                    {project.status}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
                  <Clock size={10} /> {timeAgo(project.updatedAt)}
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    onClick={e => { e.stopPropagation(); onProjectSelect(project); onViewChange('files'); }}
                  >
                    <FolderOpen size={12} /> Open
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 12, padding: '6px 10px' }}
                    onClick={e => { e.stopPropagation(); onProjectSelect(project); onViewChange('builder'); }}
                    title="Edit in Builder"
                  >
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
