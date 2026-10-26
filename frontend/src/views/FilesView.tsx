// src/views/FilesView.tsx — File Explorer & Code Viewer/Editor
import { useState, useEffect } from 'react';
import {
  Folder, FolderOpen, FileText, FileCode, Save, RefreshCw,
  Plus, Edit3, ChevronRight, ChevronDown, Check
} from 'lucide-react';
import { api } from '../api/client';
import type { Project, FileNode, AppView } from '../types';

interface FilesViewProps {
  activeProject:   Project | null;
  onProjectSelect: (p: Project) => void;
  onViewChange:    (v: AppView) => void;
}

export default function FilesView({ activeProject, onProjectSelect, onViewChange }: FilesViewProps) {
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [fileTree,     setFileTree]     = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent,  setFileContent]  = useState<string>('');
  const [isEditing,    setIsEditing]    = useState<boolean>(false);
  const [editContent,  setEditContent]  = useState<string>('');
  const [loading,      setLoading]      = useState<boolean>(false);
  const [saving,       setSaving]       = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [newFileName,  setNewFileName]  = useState<string>('');
  const [showNewFile,  setShowNewFile]  = useState<boolean>(false);
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (activeProject) {
      loadProjectFiles(activeProject.id);
      setSelectedFile(null);
      setFileContent('');
      setIsEditing(false);
    }
  }, [activeProject?.id]);

  async function loadProjects() {
    try {
      const list = await api.get<Project[]>('/api/projects');
      setProjects(list);
      if (!activeProject && list.length > 0) {
        onProjectSelect(list[0]);
      }
    } catch {}
  }

  async function loadProjectFiles(projId: string) {
    setLoading(true);
    try {
      const tree = await api.get<FileNode[]>(`/api/projects/${projId}/files`);
      setFileTree(tree);
      // Auto-expand top directories
      const autoExpand: Record<string, boolean> = {};
      tree.forEach(node => {
        if (node.type === 'directory') autoExpand[node.path] = true;
      });
      setExpandedDirs(autoExpand);
    } catch (err) {
      setFileTree([]);
    }
    setLoading(false);
  }

  async function openFile(relPath: string) {
    if (!activeProject) return;
    setLoading(true);
    try {
      const data = await api.get<{ path: string; content: string }>(
        `/api/projects/${activeProject.id}/file?path=${encodeURIComponent(relPath)}`
      );
      setSelectedFile(relPath);
      setFileContent(data.content);
      setEditContent(data.content);
      setIsEditing(false);
    } catch (err: any) {
      alert(`Could not open file: ${err.message}`);
    }
    setLoading(false);
  }

  async function saveFile() {
    if (!activeProject || !selectedFile) return;
    setSaving(true);
    try {
      await api.post(`/api/projects/${activeProject.id}/file`, {
        path: selectedFile,
        content: editContent,
      });
      setFileContent(editContent);
      setIsEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(`Failed to save: ${err.message}`);
    }
    setSaving(false);
  }

  async function createNewFile() {
    if (!activeProject || !newFileName.trim()) return;
    try {
      await api.post(`/api/projects/${activeProject.id}/file`, {
        path: newFileName.trim(),
        content: '// Created with Nilesh\n',
      });
      setNewFileName('');
      setShowNewFile(false);
      await loadProjectFiles(activeProject.id);
      openFile(newFileName.trim());
    } catch (err: any) {
      alert(`Error creating file: ${err.message}`);
    }
  }

  function toggleDir(dirPath: string) {
    setExpandedDirs(prev => ({ ...prev, [dirPath]: !prev[dirPath] }));
  }

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map(node => {
      const isDir = node.type === 'directory';
      const isExpanded = expandedDirs[node.path];
      const isSelected = selectedFile === node.path;

      if (isDir) {
        return (
          <div key={node.path}>
            <div
              className="file-tree-item"
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              onClick={() => toggleDir(node.path)}
            >
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {isExpanded ? <FolderOpen size={13} color="var(--accent-light)" /> : <Folder size={13} color="var(--accent)" />}
              <span>{node.name}</span>
            </div>
            {isExpanded && node.children && renderTree(node.children, depth + 1)}
          </div>
        );
      }

      return (
        <div
          key={node.path}
          className={`file-tree-item ${isSelected ? 'selected' : ''}`}
          style={{ paddingLeft: `${depth * 14 + 22}px` }}
          onClick={() => openFile(node.path)}
        >
          {node.name.endsWith('.ts') || node.name.endsWith('.tsx') || node.name.endsWith('.js') || node.name.endsWith('.jsx') ? (
            <FileCode size={13} color="var(--accent-light)" />
          ) : (
            <FileText size={13} color="var(--text-muted)" />
          )}
          <span>{node.name}</span>
        </div>
      );
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📄 Workspace Files</div>
          <div className="page-subtitle">
            {activeProject ? `Project: ${activeProject.name}` : 'Select a project to explore its files'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Project selector dropdown */}
          <select
            className="input"
            style={{ width: 'auto', minWidth: 160, padding: '5px 10px', fontSize: 12 }}
            value={activeProject?.id || ''}
            onChange={(e) => {
              const p = projects.find(x => x.id === e.target.value);
              if (p) onProjectSelect(p);
            }}
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          {activeProject && (
            <>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: 12 }}
                onClick={() => onViewChange('builder')}
                title="Open in Website Builder"
              >
                🏗️ Builder
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: 12 }}
                onClick={() => loadProjectFiles(activeProject.id)}
                title="Refresh tree"
              >
                <RefreshCw size={13} />
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setShowNewFile(true)}
              >
                <Plus size={13} /> New File
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main split area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: File Tree */}
        <div style={{
          width: 280,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '10px 14px',
            fontSize: 11,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border)'
          }}>
            Project Explorer
          </div>

          {/* New file input bar */}
          {showNewFile && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)' }}>
              <input
                autoFocus
                className="input"
                style={{ fontSize: 12, padding: '4px 8px' }}
                placeholder="src/components/MyComponent.tsx"
                value={newFileName}
                onChange={e => setNewFileName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createNewFile();
                  if (e.key === 'Escape') setShowNewFile(false);
                }}
              />
              <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '2px 6px' }} onClick={() => setShowNewFile(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={createNewFile}>Create</button>
              </div>
            </div>
          )}

          <div className="file-tree" style={{ padding: '8px 4px' }}>
            {loading && fileTree.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Loading files…
              </div>
            ) : fileTree.length === 0 ? (
              <div style={{ padding: 20, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No files in project.<br />
                Generate using Website Builder or create one above.
              </div>
            ) : (
              renderTree(fileTree)
            )}
          </div>
        </div>

        {/* Right: Code Viewer / Editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0d14', overflow: 'hidden' }}>
          {selectedFile ? (
            <>
              {/* File header bar */}
              <div style={{
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--bg-panel)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileCode size={14} color="var(--accent-light)" />
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 500 }}>
                    {selectedFile}
                  </span>
                  {isEditing && <span className="badge badge-blue">Editing</span>}
                  {savedSuccess && (
                    <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={10} /> Saved
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  {isEditing ? (
                    <>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={() => { setEditContent(fileContent); setIsEditing(false); }}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 12px', fontSize: 12 }}
                        onClick={saveFile}
                        disabled={saving}
                      >
                        <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 12px', fontSize: 12 }}
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit3 size={13} /> Edit File
                    </button>
                  )}
                </div>
              </div>

              {/* Code viewer / editor area */}
              <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
                {isEditing ? (
                  <textarea
                    style={{
                      width: '100%',
                      height: '100%',
                      background: '#0d1117',
                      color: '#e2e8f0',
                      border: 'none',
                      outline: 'none',
                      padding: '16px',
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: 13,
                      lineHeight: 1.6,
                      resize: 'none',
                    }}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    spellCheck={false}
                  />
                ) : (
                  <pre style={{
                    margin: 0,
                    padding: '16px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#e2e8f0',
                  }}>
                    <code>{fileContent}</code>
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-icon">📄</div>
              <div className="empty-state-title">Select a File to View</div>
              <div className="empty-state-desc">
                Browse through the file explorer on the left and select any file to read or edit its code.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
