// src/components/FileReviewModal.tsx — Interactive Project File Review & Approval Dialog
import { useState } from 'react';
import { X, Check, FileCode, FolderPlus, AlertCircle, ShieldCheck } from 'lucide-react';
import type { ParsedFile } from '../types';
import { api } from '../api/client';

interface FileReviewModalProps {
  files: ParsedFile[];
  onClose: () => void;
  onSuccess: (result: { projectId: string; filesWritten: string[] }) => void;
}

export default function FileReviewModal({ files, onClose, onSuccess }: FileReviewModalProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    files.forEach(f => { init[f.path] = true; });
    return init;
  });
  const [projectName, setProjectName] = useState('kict-website');
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFile = (path: string) => {
    setSelectedFiles(prev => ({ ...prev, [path]: !prev[path] }));
  };

  const currentFile = files[selectedFileIndex] || files[0];
  const approvedFiles = files.filter(f => selectedFiles[f.path]);

  const handleApply = async () => {
    if (approvedFiles.length === 0) {
      setError('Please select at least one file to save.');
      return;
    }

    if (!projectName.trim()) {
      setError('Please provide a valid project folder name.');
      return;
    }

    setIsApplying(true);
    setError(null);

    try {
      const res = await api.post<{
        success: boolean;
        projectId: string;
        createdFiles: string[];
        modifiedFiles: string[];
      }>('/api/projects/apply-files', {
        projectName: projectName.trim(),
        files: approvedFiles,
      });

      const allWritten = [...(res.createdFiles || []), ...(res.modifiedFiles || [])];
      onSuccess({
        projectId: res.projectId,
        filesWritten: allWritten,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project files.');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog file-review-modal">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="badge-icon">
              <FolderPlus size={18} color="var(--accent-light)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Review & Write Project Files</h3>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Inspect AI-generated files and approve writing them to your USB workspace
              </p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Workspace target config */}
        <div className="project-target-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              Target Directory: <code>projects/</code>
            </span>
            <input
              type="text"
              className="text-input"
              style={{ maxWidth: 220, padding: '6px 10px', fontSize: 13 }}
              value={projectName}
              onChange={e => setProjectName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))}
              placeholder="project-name"
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            <strong>{approvedFiles.length}</strong> of {files.length} files selected
          </div>
        </div>

        {error && (
          <div className="error-banner" style={{ margin: '12px 20px 0' }}>
            <AlertCircle size={15} color="var(--red)" />
            <span>{error}</span>
          </div>
        )}

        {/* Body with File List and Code Preview */}
        <div className="modal-body file-review-body">
          {/* File selector list */}
          <div className="file-review-list">
            <div className="file-review-list-header">Generated Files</div>
            {files.map((file, idx) => {
              const isSelected = selectedFiles[file.path];
              const isCurrent = idx === selectedFileIndex;
              return (
                <div
                  key={file.path}
                  className={`file-review-item ${isCurrent ? 'active' : ''}`}
                  onClick={() => setSelectedFileIndex(idx)}
                >
                  <input
                    type="checkbox"
                    checked={!!isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleFile(file.path);
                    }}
                  />
                  <FileCode size={14} color="var(--accent-light)" />
                  <span className="file-review-path" title={file.path}>
                    {file.path}
                  </span>
                </div>
              );
            })}
          </div>

          {/* File Preview */}
          <div className="file-review-preview">
            {currentFile ? (
              <>
                <div className="file-preview-header">
                  <span style={{ fontWeight: 500, fontSize: 13 }}>📄 {currentFile.path}</span>
                  <span className="badge badge-blue">{currentFile.language || 'text'}</span>
                </div>
                <pre className="file-preview-content">
                  <code>{currentFile.content}</code>
                </pre>
              </>
            ) : (
              <div className="empty-state">No file selected</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <ShieldCheck size={14} color="var(--emerald)" />
            <span>Safe backend workspace isolation. No automatic shell commands.</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={isApplying}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={isApplying || approvedFiles.length === 0}
            >
              {isApplying ? (
                <>Writing Files…</>
              ) : (
                <>
                  <Check size={14} /> Approve & Write ({approvedFiles.length} files)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
