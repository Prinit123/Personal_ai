import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5000/api/file-manager';
const AUTO_SAVE_API = 'http://localhost:5000/api/auto-save';

export default function ProjectFileManager() {
  const [systemPaths, setSystemPaths] = useState(null);
  const [scanPath, setScanPath] = useState('');
  const [projectTree, setProjectTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // New Project Wizard State
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState('web');

  // Operation Logs
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    fetchPaths();
  }, []);

  const addLog = (msg, type = 'info') => {
    setLogs((prev) => [{ id: Date.now(), msg, type, time: new Date().toLocaleTimeString() }, ...prev]);
  };

  const fetchPaths = async () => {
    try {
      const res = await fetch(`${API_BASE}/paths`);
      const data = await res.json();
      if (data.success) {
        setSystemPaths(data.paths);
        setScanPath(data.paths.downloads);
        addLog(`System workspace loaded: ${data.paths.downloads}`, 'success');
      }
    } catch (err) {
      addLog(`Failed to connect to local file backend: ${err.message}`, 'error');
    }
  };

  const handleScan = async () => {
    if (!scanPath) return;
    setLoading(true);
    setStatusMessage('Scanning project structure...');
    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectPath: scanPath }),
      });
      const data = await res.json();
      if (data.success) {
        setProjectTree(data.tree);
        addLog(`Successfully scanned: ${scanPath}`, 'success');
      } else {
        addLog(`Scan Error: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`Scan Exception: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const handleCreateProjectFolder = async () => {
    if (!newProjectName) return alert('Enter project name');
    setLoading(true);
    try {
      let targetParent = systemPaths.structure.projects;
      if (newProjectType === 'ml') targetParent = systemPaths.structure.mlProjects;
      if (newProjectType === 'code') targetParent = systemPaths.structure.codeExamples;

      const targetPath = `${targetParent}\\${newProjectName}`;

      const res = await fetch(`${API_BASE}/create-directory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`Created directory: ${data.result.path}`, 'success');
        setScanPath(data.result.path);
        setNewProjectName('');
      } else {
        addLog(`Creation failed: ${data.error}`, 'error');
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render Directory Tree Recursive Component
  const renderTree = (node) => {
    if (!node) return null;
    return (
      <div key={node.path || node.name} className="ml-4 my-1 font-mono text-sm">
        <div className="flex items-center gap-2 text-gray-200">
          <span>{node.type === 'directory' ? '📁' : '📄'}</span>
          <span className={node.type === 'directory' ? 'font-bold text-blue-400' : 'text-gray-300'}>
            {node.name}
          </span>
          {node.size && <span className="text-xs text-gray-500">({(node.size / 1024).toFixed(1)} KB)</span>}
        </div>
        {node.children && node.children.map((child) => renderTree(child))}
      </div>
    );
  };

  return (
    <div className="p-6 bg-slate-900 text-white min-h-screen font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-700 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">Nilesh AI — Project & File Manager</h1>
            <p className="text-gray-400 text-sm">Automatic Windows Downloads Disk Writing & Project Scanner</p>
          </div>
          <div className="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-lg border border-slate-700">
            <span className="text-sm font-medium">Auto-Save to Disk:</span>
            <button
              onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
              className={`px-3 py-1 text-xs font-bold rounded ${
                autoSaveEnabled ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {autoSaveEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>
        </div>

        {/* Workspace Quick Paths */}
        {systemPaths && (
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h2 className="text-sm font-semibold text-gray-400 mb-2">ACTIVE WORKSPACE LOCATION</h2>
            <div className="font-mono text-xs text-cyan-300 bg-slate-950 p-3 rounded border border-slate-800 flex justify-between items-center">
              <span>{systemPaths.downloads}</span>
              <span className="text-emerald-400 font-sans font-medium text-xs">Verified Local System Path</span>
            </div>
          </div>
        )}

        {/* Controls Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Project Scanner Card */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🔍</span> Project Scanner
            </h2>
            <input
              type="text"
              value={scanPath}
              onChange={(e) => setScanPath(e.target.value)}
              placeholder="C:\Users\Username\Downloads\MyProject"
              className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-cyan-300 font-mono focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleScan}
              disabled={loading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded text-sm transition"
            >
              {loading ? 'Scanning Disk...' : 'Scan Selected Folder'}
            </button>
          </div>

          {/* Project Creator Card */}
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🚀</span> Create New Project Directory
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Project Name (e.g. PrinitCafe)"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
              <select
                value={newProjectType}
                onChange={(e) => setNewProjectType(e.target.value)}
                className="bg-slate-950 border border-slate-700 text-sm text-white rounded px-2"
              >
                <option value="web">Web (Full-Stack)</option>
                <option value="ml">Machine Learning</option>
                <option value="code">Code Example</option>
              </select>
            </div>
            <button
              onClick={handleCreateProjectFolder}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded text-sm transition"
            >
              Create Folder Structure in Downloads
            </button>
          </div>
        </div>

        {/* Directory Scan Visualizer */}
        {projectTree && (
          <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
            <h2 className="text-lg font-bold text-white mb-3">Project Folder Hierarchy</h2>
            <div className="bg-slate-950 p-4 rounded border border-slate-800 max-h-96 overflow-y-auto">
              {renderTree(projectTree)}
            </div>
          </div>
        )}

        {/* Operation History Logs */}
        <div className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
          <h2 className="text-sm font-bold text-gray-400">FILE OPERATION LOGS & VERIFICATION</h2>
          <div className="bg-slate-950 p-3 rounded border border-slate-800 h-40 overflow-y-auto space-y-1 font-mono text-xs">
            {logs.length === 0 && <span className="text-gray-600">No recent operations logged.</span>}
            {logs.map((log) => (
              <div
                key={log.id}
                className={
                  log.type === 'error'
                    ? 'text-rose-400'
                    : log.type === 'success'
                    ? 'text-emerald-400'
                    : 'text-cyan-300'
                }
              >
                [{log.time}] {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
