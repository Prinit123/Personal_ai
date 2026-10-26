// src/views/ProjectManagerView.tsx — Project Scanner, File Generator & Downloads Manager
import { useState, useEffect } from 'react';
import {
  FolderSearch, HardDrive, FolderOpen, RefreshCw,
  Plus, CheckCircle2, AlertTriangle, ShieldCheck, Copy, Check,
  Terminal, ExternalLink, Archive
} from 'lucide-react';
import { api, openInExplorer } from '../api/client';
import type { FileManagerConfig, ScanResult, FileOperationRecord, AppView } from '../types';

interface ProjectManagerViewProps {
  onViewChange?: (view: AppView) => void;
}

export default function ProjectManagerView({ onViewChange: _onViewChange }: ProjectManagerViewProps) {
  const [config, setConfig] = useState<FileManagerConfig | null>(null);
  const [scanPath, setScanPath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [history, setHistory] = useState<FileOperationRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Quick project creator state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjType, setNewProjType] = useState<'mern' | 'react' | 'python' | 'html'>('mern');
  const [creatingProj, setCreatingProj] = useState(false);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedCommands, setCopiedCommands] = useState(false);

  useEffect(() => {
    loadConfig();
    loadHistory();
  }, []);

  async function loadConfig() {
    try {
      const cfg = await api.get<FileManagerConfig>('/api/file-manager/config');
      setConfig(cfg);
      if (!scanPath && cfg.downloadsDir) {
        setScanPath(cfg.subFolders?.projects || cfg.downloadsDir);
      }
    } catch (err: any) {
      console.warn('Could not load file manager config:', err.message);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const hist = await api.get<FileOperationRecord[]>('/api/file-manager/history');
      setHistory(hist || []);
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleToggleAutoSave() {
    if (!config) return;
    const newVal = !config.autoSaveEnabled;
    try {
      await api.post('/api/file-manager/config', { autoSaveEnabled: newVal });
      setConfig(prev => prev ? { ...prev, autoSaveEnabled: newVal } : null);
      localStorage.setItem('nilesh_auto_save', String(newVal));
    } catch (err: any) {
      alert('Failed to update auto-save setting: ' + err.message);
    }
  }

  async function handleToggleOrgMode(mode: 'organized' | 'direct') {
    if (!config) return;
    try {
      await api.post('/api/file-manager/config', { downloadsOrgMode: mode });
      setConfig(prev => prev ? { ...prev, downloadsOrgMode: mode } : null);
    } catch (err: any) {
      alert('Failed to update organization mode: ' + err.message);
    }
  }

  async function handleScan(pathTarget?: string) {
    const target = pathTarget || scanPath;
    if (!target.trim()) return;

    setScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const res = await api.post<ScanResult>('/api/file-manager/scan', { projectPath: target.trim() });
      setScanResult(res);
      setScanPath(target.trim());
    } catch (err: any) {
      setScanError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function handleCreateProject() {
    if (!newProjName.trim()) return;
    setCreatingProj(true);
    setCreateSuccess(null);

    const name = newProjName.trim().replace(/[\\/:*?"<>|]/g, '-');
    let files: Array<{ path: string; content: string }> = [];

    if (newProjType === 'mern') {
      files = [
        {
          path: 'package.json',
          content: JSON.stringify({
            name,
            version: '1.0.0',
            description: `${name} — Created with Nilesh AI`,
            main: 'server.js',
            scripts: { start: 'node server.js', dev: 'nodemon server.js' },
            dependencies: { express: '^4.19.2', cors: '^2.8.5', dotenv: '^16.4.5', mongoose: '^8.4.1' },
          }, null, 2),
        },
        {
          path: 'server.js',
          content: `// ${name} — Server entry point\nconst express = require('express');\nconst cors = require('cors');\nrequire('dotenv').config();\n\nconst app = express();\nconst PORT = process.env.PORT || 5000;\n\napp.use(cors());\napp.use(express.json());\n\napp.get('/api/health', (req, res) => {\n  res.json({ status: 'ok', project: '${name}', timestamp: new Date().toISOString() });\n});\n\napp.listen(PORT, () => {\n  console.log(\`${name} server running on http://localhost:\${PORT}\`);\n});\n`,
        },
        {
          path: '.env.example',
          content: `PORT=5000\nMONGODB_URI=mongodb://localhost:27017/${name}\n`,
        },
        {
          path: 'README.md',
          content: `# ${name}\n\nGenerated with Nilesh AI.\n\n## Quick Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
        },
      ];
    } else if (newProjType === 'python') {
      files = [
        {
          path: 'main.py',
          content: `# ${name} — Python ML & Data Science Entry Point\nimport sys\n\ndef main():\n    print(f"=== {sys.argv[0]} started ===")\n    print("Hello from Nilesh AI Python project!")\n\nif __name__ == '__main__':\n    main()\n`,
        },
        {
          path: 'requirements.txt',
          content: `numpy>=1.24.0\npandas>=2.0.0\nscikit-learn>=1.3.0\nmatplotlib>=3.7.0\n`,
        },
        {
          path: 'README.md',
          content: `# ${name}\n\nGenerated with Nilesh AI.\n\n## Setup\n\`\`\`bash\npython -m venv venv\n.\\venv\\Scripts\\activate\npip install -r requirements.txt\npython main.py\n\`\`\`\n`,
        },
      ];
    } else if (newProjType === 'react') {
      files = [
        {
          path: 'package.json',
          content: JSON.stringify({
            name,
            private: true,
            version: '0.0.0',
            type: 'module',
            scripts: { dev: 'vite', build: 'vite build' },
            dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', 'lucide-react': '^0.400.0' },
            devDependencies: { vite: '^5.3.0' },
          }, null, 2),
        },
        {
          path: 'index.html',
          content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${name}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>\n`,
        },
        {
          path: 'src/main.jsx',
          content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n`,
        },
        {
          path: 'src/App.jsx',
          content: `export default function App() {\n  return (\n    <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, textAlign: 'center' }}>\n      <h1>🚀 Welcome to ${name}</h1>\n      <p>Created and verified by Nilesh AI.</p>\n    </div>\n  );\n}\n`,
        },
        {
          path: 'README.md',
          content: `# ${name}\n\nReact application created with Nilesh AI.\n\n## Quick Start\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`,
        },
      ];
    } else {
      files = [
        {
          path: 'index.html',
          content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${name}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>${name}</h1>\n  <p>Website built with Nilesh AI.</p>\n  <script src="app.js"></script>\n</body>\n</html>\n`,
        },
        {
          path: 'style.css',
          content: `body { font-family: system-ui, sans-serif; margin: 40px; background: #0f172a; color: #f8fafc; }\nh1 { color: #38bdf8; }\n`,
        },
        {
          path: 'app.js',
          content: `console.log("${name} loaded successfully!");\n`,
        },
        {
          path: 'README.md',
          content: `# ${name}\n\nSimple web project. Open \`index.html\` in any web browser.\n`,
        },
      ];
    }

    try {
      const res = await api.post<any>('/api/file-manager/save-to-disk', {
        projectName: name,
        files,
        category: newProjType === 'python' ? 'ml' : 'projects',
      });
      setCreateSuccess(`Project verified on disk at: ${res.exactPath}`);
      loadHistory();
      setNewProjName('');
      setTimeout(() => setShowCreateModal(false), 2000);
    } catch (err: any) {
      alert('Failed to create project: ' + err.message);
    } finally {
      setCreatingProj(false);
    }
  }

  async function handleOpenExplorer(targetPath: string) {
    try {
      await openInExplorer(targetPath);
    } catch (err: any) {
      alert('Could not launch Windows Explorer: ' + err.message);
    }
  }

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + s[i];
  };

  return (
    <div className="project-manager-view" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header Bar */}
      <div className="page-header" style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
          }}>
            <HardDrive size={20} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              Project & File Manager
              <span className="badge badge-blue">Windows Local Disk</span>
            </h2>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              Scan local projects, configure Windows Downloads auto-saving, manage project archives & exports
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => { loadConfig(); loadHistory(); }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> New Project Folder
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ─── 1. Downloads & Auto-Save Configuration Banner ─── */}
        <div className="card" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <FolderOpen size={16} color="var(--accent-light)" />
                <span style={{ fontWeight: 600, fontSize: 14 }}>Default Output Directory (Windows Downloads)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'monospace', fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                <span>{config?.downloadsDir || 'Detecting Windows Downloads…'}</span>
                <button
                  className="btn-icon-subtle"
                  style={{ padding: 4 }}
                  onClick={() => {
                    if (config?.downloadsDir) {
                      navigator.clipboard.writeText(config.downloadsDir);
                      setCopiedPath(true);
                      setTimeout(() => setCopiedPath(false), 2000);
                    }
                  }}
                  title="Copy path"
                >
                  {copiedPath ? <Check size={13} color="var(--emerald)" /> : <Copy size={13} />}
                </button>
                <button
                  className="btn-icon-subtle"
                  style={{ padding: 4 }}
                  onClick={() => config?.downloadsDir && handleOpenExplorer(config.downloadsDir)}
                  title="Open in Windows File Explorer"
                >
                  <ExternalLink size={13} />
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Target user: <strong>{config?.username || 'Current User'}</strong> | System: <strong>{config?.platform === 'win32' ? 'Windows' : config?.platform}</strong>
              </div>
            </div>

            {/* Auto Save Toggle & Organization Mode */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Auto-Save</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={config?.autoSaveEnabled ?? true}
                    onChange={handleToggleAutoSave}
                    style={{ cursor: 'pointer', width: 16, height: 16 }}
                  />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {config?.autoSaveEnabled ? 'Enabled (Instant Save)' : 'Manual (Click to Save)'}
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Folder Structure</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className={`btn btn-sm ${config?.downloadsOrgMode === 'organized' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => handleToggleOrgMode('organized')}
                    title="Organize into Downloads\NileshAI\Projects, Documents, MLProjects"
                  >
                    Organized Subfolders
                  </button>
                  <button
                    className={`btn btn-sm ${config?.downloadsOrgMode === 'direct' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={() => handleToggleOrgMode('direct')}
                    title="Save directly into Downloads\<Project>"
                  >
                    Direct in Downloads
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 2. Project Scanner Section ─── */}
        <div className="card" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <FolderSearch size={18} color="var(--accent-light)" />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Project Scanner & Context Inspector</h3>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-muted)' }}>
            Enter any project directory path to scan its programming languages, frameworks, entrypoints, dependencies, and configuration health.
          </p>

          {/* Path input & scan trigger */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              className="input"
              style={{ flex: 1, fontFamily: 'monospace', fontSize: 13 }}
              placeholder="C:\Users\win-11\Downloads\MyProject"
              value={scanPath}
              onChange={e => setScanPath(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleScan(); }}
            />
            <button
              className="btn btn-primary"
              onClick={() => handleScan()}
              disabled={scanning || !scanPath.trim()}
              style={{ minWidth: 120 }}
            >
              {scanning ? 'Scanning…' : <><FolderSearch size={14} /> Scan Project</>}
            </button>
          </div>

          {/* Quick path suggestion chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Quick locations:</span>
            {config?.subFolders?.projects && (
              <button
                className="btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }}
                onClick={() => { setScanPath(config.subFolders.projects); handleScan(config.subFolders.projects); }}
              >
                📁 NileshAI Projects
              </button>
            )}
            {config?.downloadsDir && (
              <button
                className="btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }}
                onClick={() => { setScanPath(config.downloadsDir); handleScan(config.downloadsDir); }}
              >
                📥 Downloads Root
              </button>
            )}
            {config?.workspaceProjectsDir && (
              <button
                className="btn-ghost"
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }}
                onClick={() => { setScanPath(config.workspaceProjectsDir); handleScan(config.workspaceProjectsDir); }}
              >
                💾 USB Workspace
              </button>
            )}
          </div>

          {/* Scan Error Banner */}
          {scanError && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--red)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} />
              <span>{scanError}</span>
            </div>
          )}

          {/* Scan Results Card */}
          {scanResult && (
            <div style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}>
              {/* Header info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                    📦 {scanResult.projectName}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                    {scanResult.projectPath}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-blue">
                    {scanResult.totalFiles} files ({formatSize(scanResult.totalBytes)})
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenExplorer(scanResult.projectPath)}
                  >
                    <ExternalLink size={12} /> Open in Explorer
                  </button>
                </div>
              </div>

              {/* Grid breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                {/* Languages */}
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Primary Languages
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {scanResult.primaryLanguages.length > 0 ? (
                      scanResult.primaryLanguages.map(l => (
                        <span key={l.ext} className="badge badge-gray">
                          {l.ext}: {l.count} files
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>None detected</span>
                    )}
                  </div>
                </div>

                {/* Frameworks */}
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Detected Frameworks
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {scanResult.frameworks.length > 0 ? (
                      scanResult.frameworks.map(fw => (
                        <span key={fw} className="badge badge-blue">{fw}</span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Standard / Vanilla</span>
                    )}
                  </div>
                </div>

                {/* Entry Points */}
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Entry Point Files
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {scanResult.entryPoints.length > 0 ? (
                      scanResult.entryPoints.map(ep => (
                        <span key={ep} style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-light)' }}>
                          ▶ {ep}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Standard entry file not found</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Run Instructions */}
              {scanResult.runInstructions && scanResult.runInstructions.length > 0 && (
                <div style={{ background: '#0a0d14', padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Terminal size={12} /> HOW TO RUN THIS PROJECT
                    </div>
                    <button
                      className="btn-ghost"
                      style={{ fontSize: 11, padding: '2px 6px' }}
                      onClick={() => {
                        navigator.clipboard.writeText(scanResult.runInstructions.join('\n'));
                        setCopiedCommands(true);
                        setTimeout(() => setCopiedCommands(false), 2000);
                      }}
                    >
                      {copiedCommands ? 'Copied!' : 'Copy Commands'}
                    </button>
                  </div>
                  <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace', color: '#38bdf8', whiteSpace: 'pre-wrap' }}>
                    {scanResult.runInstructions.join('\n')}
                  </pre>
                </div>
              )}

              {/* Missing configs or errors */}
              {scanResult.missingConfigs.length > 0 && (
                <div style={{ padding: 10, borderRadius: 6, background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--amber)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={13} /> Project Configuration Notices:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {scanResult.missingConfigs.map((mc, idx) => <li key={idx}>{mc}</li>)}
                  </ul>
                </div>
              )}

              {/* Security Shield */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                <ShieldCheck size={14} color="var(--emerald)" />
                <span>Security verified: Sensitive files (.env, secrets) and bulky caches (.git, node_modules) were protected from inspection leaks.</span>
              </div>
            </div>
          )}
        </div>

        {/* ─── 3. Recent File Operations & Projects Table ─── */}
        <div className="card" style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 18,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Archive size={17} color="var(--accent-light)" />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Recent Disk Operations & Saved Projects</h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={loadHistory}>
              <RefreshCw size={12} /> Refresh History
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading recent operations…
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              No recent file operations recorded yet. Ask Nilesh to create a project or file to see verified saves here.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 10px' }}>Name / Project</th>
                    <th style={{ padding: '8px 10px' }}>Type</th>
                    <th style={{ padding: '8px 10px' }}>Disk Path</th>
                    <th style={{ padding: '8px 10px' }}>Files</th>
                    <th style={{ padding: '8px 10px' }}>Size</th>
                    <th style={{ padding: '8px 10px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', opacity: 0.95 }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span className="badge badge-gray">{item.type}</span>
                      </td>
                      <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-secondary)' }}>
                        {item.target_path}
                      </td>
                      <td style={{ padding: '8px 10px' }}>{item.file_count}</td>
                      <td style={{ padding: '8px 10px' }}>{formatSize(item.size_bytes)}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => handleOpenExplorer(item.target_path)}
                            title="Open in Windows Explorer"
                          >
                            <FolderOpen size={11} /> Open
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => { setScanPath(item.target_path); handleScan(item.target_path); }}
                            title="Scan this project"
                          >
                            <FolderSearch size={11} /> Scan
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ─── Create Project Modal ─── */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-title">📁 Create Project in Downloads</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Project Name *</label>
                <input
                  className="input"
                  placeholder="e.g. PrinitCafe or HousePricePrediction"
                  value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="input-group">
                <label className="input-label">Project Template / Tech Stack</label>
                <select
                  className="input"
                  value={newProjType}
                  onChange={e => setNewProjType(e.target.value as any)}
                >
                  <option value="mern">MERN Stack (React + Node + Express + MongoDB)</option>
                  <option value="react">React Frontend (Vite + JSX)</option>
                  <option value="python">Python Data Science & Machine Learning</option>
                  <option value="html">Vanilla HTML, CSS & JavaScript</option>
                </select>
              </div>

              {createSuccess && (
                <div style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.15)', color: 'var(--emerald)', fontSize: 12 }}>
                  <CheckCircle2 size={14} style={{ display: 'inline', marginRight: 4 }} />
                  {createSuccess}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleCreateProject}
                  disabled={creatingProj || !newProjName.trim()}
                >
                  {creatingProj ? 'Creating on Disk…' : 'Create & Verify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
