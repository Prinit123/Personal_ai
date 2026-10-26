// src/components/ChatPanel.tsx — Modern ChatGPT-style conversational coding interface with Voice Input, File Attachments & Photo Uploads
import { useEffect, useRef, useState, type KeyboardEvent, type DragEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send, Square, Trash2, Bot, User, Copy, Check, Download,
  Menu, FolderPlus, Key, ExternalLink, Sparkles, AlertCircle, FileCode,
  Mic, MicOff, Paperclip, Image as ImageIcon, X, FileText, CheckCheck,
  Volume2, VolumeX, Loader2, ZoomIn, HardDrive, CheckCircle2, ChevronDown,
  ChevronUp, FolderCheck, Terminal, FolderOpen, RefreshCw
} from 'lucide-react';
import type { ChatMessage, ParsedFile, SystemStatus, ChatAttachment } from '../types';
import FileReviewModal from './FileReviewModal';
import ImageLightbox from './ImageLightbox';
import { useVoiceInput, useSpeechSynthesis } from '../hooks/useVoiceInput';
import {
  api,
  uploadFiles,
  downloadProjectZip,
  downloadSingleFile,
  getProjectZipBlob,
  saveAsInteractive,
  saveProjectToDisk,
  openInExplorer
} from '../api/client';

interface ChatPanelProps {
  messages:        ChatMessage[];
  isThinking:      boolean;
  onSend:          (text: string, attachments?: ChatAttachment[]) => void;
  onRegenerate?:   (userText: string, assistantMsgId: string) => void;
  onStop:          () => void;
  onClear:         () => void;
  onNewChat:       () => void;
  onOpenSettings:  () => void;
  onToggleSidebar: () => void;
  systemStatus:    SystemStatus | null;
  activeModel:     string;
  activeProvider?: string;
  onModelChange?:  (model: string, provider?: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ── Code block with language tag & copy button ────────────────────────────────

function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const rawCode = String(children || '').replace(/\n$/, '');

  const match = /language-([a-zA-Z0-9_-]+)(?::([^\s]+))?/.exec(className || '');
  const lang = match ? match[1] : '';
  const filepath = match && match[2] ? match[2] : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <FileCode size={13} color="var(--accent-light)" />
            <span className="code-block-lang">
              {filepath ? `${filepath} (${lang})` : (lang || 'code')}
            </span>
          </div>
        </div>
        <button className="code-copy-btn" onClick={handleCopy} title="Copy code">
          {copied ? (
            <>
              <Check size={12} color="var(--emerald)" /> Copied
            </>
          ) : (
            <>
              <Copy size={12} /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="code-block-pre">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

// ── Project Files Detected Card ───────────────────────────────────────────────

// ── Project & File Results Panel ─────────────────────────────────────────────

function ProjectResultsPanel({
  files,
  messageId,
  onReview,
}: {
  files: ParsedFile[];
  messageId: string;
  onReview: () => void;
}) {
  if (!files || files.length === 0) return null;

  const isSingleFile = files.length === 1;

  // Infer project or file name
  let inferredName = 'Project';
  if (isSingleFile) {
    inferredName = files[0].path;
  } else {
    const pkg = files.find(f => /package\.json$/i.test(f.path));
    if (pkg) {
      try {
        const parsed = JSON.parse(pkg.content);
        if (parsed.name) inferredName = parsed.name;
      } catch {}
    }
    if (inferredName === 'Project') {
      const topSegment = files[0].path.split(/[/\\]/)[0];
      if (topSegment && !['src', 'backend', 'frontend', 'app'].includes(topSegment.toLowerCase())) {
        inferredName = topSegment;
      } else {
        inferredName = 'NileshProject';
      }
    }
  }

  // Detect technology stack
  const isNode = files.some(f => f.path.endsWith('package.json') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx'));
  const isPython = files.some(f => f.path.endsWith('.py'));
  const isWeb = files.some(f => f.path.endsWith('.html'));

  const defaultRunCommands = isNode
    ? 'npm install && npm run dev'
    : isPython
      ? 'python -m venv venv && .\\venv\\Scripts\\activate && pip install -r requirements.txt && python main.py'
      : isWeb
        ? 'Open index.html in your browser'
        : 'See README.md for instructions';

  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [savingToDisk, setSavingToDisk] = useState(false);
  const [savingAs, setSavingAs] = useState(false);
  const [verifiedPath, setVerifiedPath] = useState<string | null>(null);
  const [diskError, setDiskError] = useState<string | null>(null);
  const [copiedCmds, setCopiedCmds] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [singleDownloading, setSingleDownloading] = useState<string | null>(null);

  // Auto-Save: Automatically trigger saving to Downloads once on generation
  useEffect(() => {
    const autoSavePref = localStorage.getItem('nilesh_auto_save');
    if (autoSavePref !== 'false' && !verifiedPath) {
      handleSaveToDownloads(true);
    }
  }, [messageId]);

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      if (isSingleFile) {
        await downloadSingleFile(files[0].path, files[0].content);
      } else {
        await downloadProjectZip(inferredName, files);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err: any) {
      alert('Download error: ' + err.message);
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadSingle(filePath: string, content: string) {
    setSingleDownloading(filePath);
    try {
      await downloadSingleFile(filePath, content);
    } catch (err: any) {
      alert('Failed to download file: ' + err.message);
    } finally {
      setSingleDownloading(null);
    }
  }

  async function handleSaveAs() {
    setSavingAs(true);
    try {
      if (isSingleFile) {
        await saveAsInteractive(files[0].path, files[0].content, 'Generated File');
      } else {
        const cleanName = inferredName.replace(/[\\/:*?"<>|]/g, '-') || 'Nilesh-Project';
        const zipBlob = await getProjectZipBlob(cleanName, files);
        if (!zipBlob || zipBlob.size === 0) {
          throw new Error('Failed to package project files into ZIP archive');
        }
        await saveAsInteractive(`${cleanName}.zip`, zipBlob, 'ZIP Project Archive');
      }
    } catch (err: any) {
      alert('Save As error: ' + err.message);
    } finally {
      setSavingAs(false);
    }
  }

  async function handleSaveToDownloads(isAuto = false) {
    if (savingToDisk) return;
    setSavingToDisk(true);
    setDiskError(null);
    try {
      const res = await saveProjectToDisk(
        inferredName,
        files,
        isPython ? 'ml' : 'projects'
      );
      if (res.verified) {
        setVerifiedPath(res.exactPath);
      }
    } catch (err: any) {
      if (!isAuto) {
        setDiskError(err.message || 'Failed to save to local Downloads');
      }
    } finally {
      setSavingToDisk(false);
    }
  }

  async function handleOpenExplorer() {
    if (!verifiedPath) return;
    try {
      await openInExplorer(verifiedPath);
    } catch (err: any) {
      alert('Could not open folder in Explorer: ' + err.message);
    }
  }

  const totalBytes = files.reduce((acc, f) => acc + (f.content?.length || 0), 0);

  return (
    <div className="project-results-panel" style={{
      marginTop: 14,
      background: 'linear-gradient(180deg, #111827 0%, #0b0f19 100%)',
      border: '1px solid #1f293d',
      borderRadius: 12,
      padding: 16,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
          }}>
            <CheckCircle2 size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isSingleFile ? 'File Ready for Download' : `Project Ready: ${inferredName}`}
              <span className="badge badge-green" style={{ fontSize: 10 }}>
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </span>
              <span className="badge badge-gray" style={{ fontSize: 10 }}>
                {formatBytes(totalBytes)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {isNode ? 'Node.js & React Full-Stack' : isPython ? 'Python / Machine Learning' : 'Web Project'} • Complete working code generated
            </div>
          </div>
        </div>

        {/* Quick status pill */}
        {verifiedPath && (
          <span className="badge badge-green" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '4px 8px' }}>
            <FolderCheck size={12} /> Auto-Saved to Disk
          </span>
        )}
      </div>

      {/* Verified Local Disk Path Banner */}
      {verifiedPath && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          fontSize: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, flex: 1 }}>
            <HardDrive size={15} color="var(--emerald)" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--emerald)', fontWeight: 600 }}>
                Verified on PC (Downloads):
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#e2e8f0', wordBreak: 'break-all' }}>
                {verifiedPath}
              </span>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11, padding: '4px 10px', borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--emerald)' }}
            onClick={handleOpenExplorer}
            title="Open project folder in Windows File Explorer"
          >
            <FolderOpen size={12} /> Open in Explorer
          </button>
        </div>
      )}

      {diskError && (
        <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={13} /> {diskError}
        </div>
      )}

      {/* Action Buttons Row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Primary Download Button */}
        <button
          className="btn btn-primary"
          style={{ padding: '7px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleDownloadAll}
          disabled={downloading}
          title={isSingleFile ? 'Download generated file to PC' : 'Download complete project as a ready-to-run ZIP archive'}
        >
          {downloading ? (
            <><Loader2 size={13} className="spin" /> Packaging ZIP…</>
          ) : downloadSuccess ? (
            <><Check size={13} color="white" /> Downloaded!</>
          ) : (
            <><Download size={13} /> {isSingleFile ? 'Download File' : 'Download Complete Project (ZIP)'}</>
          )}
        </button>

        {/* Save As Button */}
        <button
          className="btn btn-secondary"
          style={{ padding: '7px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={handleSaveAs}
          disabled={savingAs}
          title="Choose a specific folder and filename to save this output"
        >
          <FolderPlus size={13} /> Save As…
        </button>

        {/* Save to Downloads Local Button */}
        {!verifiedPath && (
          <button
            className="btn btn-secondary"
            style={{ padding: '7px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => handleSaveToDownloads(false)}
            disabled={savingToDisk}
            title="Save directly into Windows Downloads folder"
          >
            {savingToDisk ? (
              <><Loader2 size={13} className="spin" /> Saving…</>
            ) : (
              <><HardDrive size={13} /> Save to Downloads</>
            )}
          </button>
        )}

        {/* Copy Setup Commands */}
        <button
          className="btn btn-ghost"
          style={{ padding: '7px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => {
            navigator.clipboard.writeText(defaultRunCommands);
            setCopiedCmds(true);
            setTimeout(() => setCopiedCmds(false), 2000);
          }}
          title="Copy terminal setup commands"
        >
          <Terminal size={13} /> {copiedCmds ? 'Copied Commands!' : 'Copy Setup Commands'}
        </button>

        {/* Review Modal Opener */}
        <button
          className="btn-ghost"
          style={{ padding: '7px 10px', fontSize: 12, marginLeft: 'auto', color: 'var(--text-muted)' }}
          onClick={onReview}
          title="Inspect files in modal dialog"
        >
          Detailed Review
        </button>
      </div>

      {/* Expandable Run Instructions */}
      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
          onClick={() => setShowInstructions(prev => !prev)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
            <Terminal size={12} color="var(--accent-light)" /> How to install & run this project
          </span>
          {showInstructions ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>

        {showInstructions && (
          <div style={{ marginTop: 8, background: '#0a0d14', padding: '10px 12px', borderRadius: 6, border: '1px solid #1e293b' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Terminal commands:</div>
            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: 12, color: '#38bdf8', whiteSpace: 'pre-wrap' }}>
              {defaultRunCommands}
            </pre>
          </div>
        )}
      </div>

      {/* Expandable File List */}
      <div style={{ borderTop: '1px solid #1e293b', paddingTop: 8 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
          onClick={() => setShowFiles(prev => !prev)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 }}>
            <FileCode size={12} color="var(--accent-light)" /> View generated files ({files.length})
          </span>
          {showFiles ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </div>

        {showFiles && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg-input)',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: 'monospace'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <FileText size={12} color="var(--accent-light)" />
                  <span style={{ color: '#e2e8f0' }}>{f.path}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {formatBytes(f.content?.length || 0)}
                  </span>
                  <button
                    className="btn-icon-subtle"
                    style={{ padding: 2 }}
                    onClick={() => handleDownloadSingle(f.path, f.content)}
                    disabled={singleDownloading === f.path}
                    title="Download this file individually"
                  >
                    {singleDownloading === f.path ? <Loader2 size={11} className="spin" /> : <Download size={11} />}
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

// ── Single Message Bubble ─────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onReviewFiles,
  onOpenPhoto,
  onSpeak,
  isSpeakingThis,
  onRegenerate,
}: {
  msg: ChatMessage;
  onReviewFiles: (files: ParsedFile[]) => void;
  onOpenPhoto: (url: string, name: string) => void;
  onSpeak?: (text: string) => void;
  isSpeakingThis?: boolean;
  onRegenerate?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser  = msg.role === 'user';
  const isError = msg.role === 'error';
  const isAI    = msg.role === 'assistant';

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const timeString = new Date(msg.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-row ${isUser ? 'user' : ''}`}>
      <div className={`avatar ${isUser ? 'user' : isError ? 'error' : 'ai'}`}>
        {isUser ? <User size={15} color="var(--text-secondary)" /> : <Bot size={15} color="white" />}
      </div>

      <div className={`message-bubble ${isUser ? 'user' : isError ? 'error' : 'ai'}`}>
        {/* Render Attachments (Photos and Documents) */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="message-attachments-container">
            {msg.attachments.map((att, idx) => {
              if (att.type === 'image') {
                return (
                  <div
                    key={att.id || idx}
                    className="message-photo-card"
                    onClick={() => onOpenPhoto(att.url, att.name)}
                    title="Click to view high-res photo"
                  >
                    <img src={att.url} alt={att.name} className="message-photo-img" />
                    <div className="photo-zoom-hint">
                      <ZoomIn size={11} /> Zoom
                    </div>
                  </div>
                );
              }
              return (
                <a
                  key={att.id || idx}
                  href={att.url}
                  download={att.name}
                  className="message-doc-badge"
                  title="Click to download document"
                >
                  <FileText size={16} color="var(--accent-light)" />
                  <div className="doc-info">
                    <span className="doc-name">{att.name}</span>
                    <span className="doc-size">{formatBytes(att.size)}</span>
                  </div>
                  <Download size={13} style={{ marginLeft: 4, opacity: 0.7 }} />
                </a>
              );
            })}
          </div>
        )}

        {isUser ? (
          <div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <span>{timeString}</span>
              <CheckCheck size={12} color="var(--accent-light)" />
            </div>
          </div>
        ) : isError ? (
          <div className="error-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <AlertCircle size={16} color="var(--red)" />
              <strong>AI Connection Notice:</strong>
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
          </div>
        ) : (
          <div className="md-body">
            {/* AI Provider, Model & Cache Pill */}
            {isAI && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {msg.provider === 'gemini' ? (
                  <span className="badge badge-green" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={11} /> Gemini Online ({msg.model || 'flash'})
                  </span>
                ) : msg.provider === 'ollama' ? (
                  <span className="badge badge-blue" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <HardDrive size={11} /> Ollama Offline ({msg.model ? msg.model.replace('qwen2.5-coder:', '') : '1.5b'})
                  </span>
                ) : (
                  <span className="badge badge-purple" style={{ fontSize: 10 }}>
                    {msg.provider || 'AI'} {msg.model ? `• ${msg.model}` : ''}
                  </span>
                )}

                {msg.cached && (
                  <span
                    className="badge"
                    style={{
                      background: 'rgba(168, 85, 247, 0.2)',
                      color: '#c084fc',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      fontSize: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Served instantly from safe repeated-question cache"
                  >
                    ⚡ Cached
                  </span>
                )}

                {msg.evalTimeMs ? (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {(msg.evalTimeMs / 1000).toFixed(1)}s {msg.tokensPerSecond ? `(${msg.tokensPerSecond} t/s)` : ''}
                  </span>
                ) : null}
              </div>
            )}

            {msg.content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }: any) {
                    return !inline ? (
                      <CodeBlock className={className}>{children}</CodeBlock>
                    ) : (
                      <code className="inline-code" {...props}>
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {msg.content}
              </ReactMarkdown>
            ) : msg.isStreaming ? (
              <div className="typing-dots" style={{ padding: '6px 0', display: 'flex', gap: '4px' }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            ) : null}

            {msg.isStreaming && msg.content && <span className="cursor-blink" />}

            {/* If files were parsed from this message, show rich Results Panel with Download, Save As, Auto-save & Run */}
            {msg.files && msg.files.length > 0 && !msg.isStreaming && (
              <ProjectResultsPanel
                files={msg.files}
                messageId={msg.id}
                onReview={() => onReviewFiles(msg.files || [])}
              />
            )}
          </div>
        )}

        {/* Message Footer */}
        {isAI && !msg.isStreaming && msg.content && (
          <div className="message-footer">
            <button className="btn-icon-subtle" onClick={handleCopy} title="Copy full response">
              {copied ? (
                <>
                  <Check size={12} color="var(--emerald)" /> Copied
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy
                </>
              )}
            </button>

            {msg.cached && onRegenerate && (
              <button
                className="btn-icon-subtle"
                onClick={onRegenerate}
                title="Regenerate fresh response from model (bypass cache)"
                style={{ color: 'var(--accent-light)', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={11} /> Regenerate
              </button>
            )}

            {onSpeak && (
              <button
                className={`tts-speak-btn ${isSpeakingThis ? 'speaking' : ''}`}
                onClick={() => onSpeak(msg.content)}
                title={isSpeakingThis ? 'Stop speaking' : 'Read aloud with Nilesh Voice'}
              >
                {isSpeakingThis ? (
                  <>
                    <VolumeX size={12} color="var(--emerald)" />
                    <span>Stop</span>
                  </>
                ) : (
                  <>
                    <Volume2 size={12} />
                    <span>Speak</span>
                  </>
                )}
              </button>
            )}

            {msg.tokensUsed ? (
              <span className="tokens-badge">{msg.tokensUsed} tokens</span>
            ) : null}

            <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 'auto' }}>
              {timeString}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="message-row">
      <div className="avatar ai">
        <Bot size={15} color="white" />
      </div>
      <div className="message-bubble ai typing-bubble">
        <div className="typing-dots">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  );
}

// ── Main ChatPanel Component ──────────────────────────────────────────────────

export default function ChatPanel({
  messages,
  isThinking,
  onSend,
  onRegenerate,
  onStop,
  onClear,
  onNewChat,
  onOpenSettings,
  onToggleSidebar,
  systemStatus,
  activeModel,
  activeProvider = 'ollama',
  onModelChange,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeLightbox, setActiveLightbox] = useState<{ url: string; name: string } | null>(null);
  const [reviewFiles, setReviewFiles] = useState<ParsedFile[] | null>(null);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Text-To-Speech
  const { speak, stop: stopSpeech, isSpeaking } = useSpeechSynthesis();

  // Voice Input (Web Speech Recognition)
  const {
    isListening,
    interimTranscript,
    isSupported: voiceSupported,
    error: voiceError,
    startListening,
    stopListening,
  } = useVoiceInput((finalText) => {
    setInput(prev => {
      const updated = prev ? `${prev} ${finalText}` : finalText;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px';
        }
      }, 50);
      return updated;
    });
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  // Handle files selection
  const handleFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadFiles(fileList);
      setAttachments(prev => [...prev, ...uploaded]);
    } catch (err: any) {
      setUploadError(err.message || 'File upload failed');
      setTimeout(() => setUploadError(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Drag and Drop
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleSend = () => {
    const text = input.trim();
    if ((!text && attachments.length === 0) || isThinking || isUploading) return;
    
    if (isListening) {
      stopListening();
    }
    
    onSend(text, attachments);
    setInput('');
    setAttachments([]);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  };

  const handleToggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSpeak = (text: string, msgId: string) => {
    if (speakingMsgId === msgId && isSpeaking) {
      stopSpeech();
      setSpeakingMsgId(null);
    } else {
      setSpeakingMsgId(msgId);
      speak(text, () => setSpeakingMsgId(null));
    }
  };

  const handleExport = () => {
    if (messages.length === 0) return;
    const md = messages
      .map(m => `### ${m.role.toUpperCase()} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n---\n`)
      .join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nilesh-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isGeminiConfigured = systemStatus?.gemini === 'configured';
  const isOllamaOnline = systemStatus?.ollama === 'online';
  const isOnline = systemStatus?.activeProvider === 'gemini' ? isGeminiConfigured : isOllamaOnline;

  const suggestions = [
    {
      title: 'KICT Computer Classes Website',
      prompt: 'Create a complete website for KICT computer classes with course listings, course prices in INR, student registration, inquiry forms, pass-out student records, and nine Ahmedabad branches.',
    },
    {
      title: 'Full-Stack MERN Todo & Notes App',
      prompt: 'Build a production-ready MERN stack Task & Notes app with user authentication (JWT), MongoDB schemas, Express REST API, and a modern responsive React frontend.',
    },
    {
      title: 'Student Registration & Fees API',
      prompt: 'Create a Node.js and Express backend with MongoDB for student registration, branch selection, and INR course fees tracking with complete input validation.',
    },
    {
      title: 'Explain & Refactor Code',
      prompt: 'Explain the difference between useEffect and useLayoutEffect in React with practical code examples and common pitfalls to avoid.',
    },
  ];

  return (
    <div
      className="chat-panel"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="chat-drag-overlay">
          <ImageIcon size={44} />
          <div>Drop photos or documents here to attach to Nilesh</div>
          <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            Supports PNG, JPG, WebP, PDF, DOCX, TXT, JSON, MD (Max 10MB)
          </span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="chat-header">
        <div className="chat-header-left">
          <button
            className="btn-icon-subtle menu-toggle-btn"
            onClick={onToggleSidebar}
            title="Toggle sidebar"
          >
            <Menu size={18} />
          </button>
          <div className="chat-header-title">
            <span className="brand-dot" />
            <span className="brand-name">Nilesh</span>
            <span className="brand-badge">AI Assistant</span>
          </div>
        </div>

        <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Active Model Selector */}
          <div className="model-selector-bar" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <span
              className={`status-dot ${isOnline ? 'ok' : 'warn'}`}
              title={
                activeProvider === 'ollama'
                  ? isOllamaOnline ? 'Ollama is online' : 'Ollama is offline'
                  : isGeminiConfigured ? 'Gemini online' : 'Gemini key required'
              }
            />
            <select
              className="chat-model-select"
              value={activeModel}
              onChange={(e) => {
                const val = e.target.value;
                const prov = val === 'auto' ? 'auto' : val.startsWith('gemini') ? 'gemini' : 'ollama';
                onModelChange?.(val, prov);
              }}
              disabled={isThinking}
              title="Select local or online model"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
                border: 'none',
                fontSize: 12,
                fontWeight: 500,
                cursor: isThinking ? 'not-allowed' : 'pointer',
                outline: 'none',
              }}
            >
              <optgroup label="Hybrid & Auto Routing">
                <option value="auto">Auto (Online Gemini / Offline Ollama)</option>
              </optgroup>
              <optgroup label="Local Offline Models (Ollama)">
                <option value="qwen2.5-coder:1.5b">qwen2.5-coder:1.5b (1.5B • Fast & Low RAM)</option>
                <option value="qwen2.5-coder:3b">qwen2.5-coder:3b (3B • Precision)</option>
              </optgroup>
              {isGeminiConfigured && (
                <optgroup label="Cloud Online AI">
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Online)</option>
                  <option value="gemini-3.8-pro">gemini-3.8-pro (Online)</option>
                </optgroup>
              )}
            </select>

            {activeProvider === 'auto' ? (
              <span className="badge badge-purple" style={{ fontSize: 10, padding: '1px 5px' }}>
                Auto
              </span>
            ) : activeProvider === 'ollama' ? (
              <span className={`badge ${isOllamaOnline ? 'badge-blue' : 'badge-red'}`} style={{ fontSize: 10, padding: '1px 5px' }}>
                {isOllamaOnline ? 'Offline' : 'Offline (Stopped)'}
              </span>
            ) : (
              <span className="badge badge-green" style={{ fontSize: 10, padding: '1px 5px' }}>
                Online
              </span>
            )}
          </div>

          {/* Quick Free RAM Action for 8GB RAM PC */}
          {activeProvider === 'ollama' && isOllamaOnline && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  await api.post('/api/ollama/unload', { model: activeModel });
                  alert(`Freed RAM: Model ${activeModel} unloaded from memory.`);
                } catch (err: any) {
                  alert(`Could not free RAM: ${err.message}`);
                }
              }}
              title="Free system RAM by unloading model from memory"
              style={{ fontSize: 11, padding: '3px 8px', height: 26 }}
            >
              Free RAM
            </button>
          )}

          <button className="btn-icon-subtle" onClick={onOpenSettings} title="Open AI Settings">
            <Key size={15} />
          </button>

          <button className="btn-icon-subtle" onClick={onNewChat} title="New Chat">
            <Sparkles size={16} />
          </button>
          <button className="btn-icon-subtle" onClick={handleExport} title="Export chat as Markdown">
            <Download size={16} />
          </button>
          <button className="btn-icon-subtle" onClick={onClear} title="Clear conversation">
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* Save banner feedback */}
      {saveBanner && (
        <div className="save-banner">
          <Check size={16} />
          <span>{saveBanner}</span>
          <button className="btn-icon-subtle" onClick={() => setSaveBanner(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Upload error notice */}
      {uploadError && (
        <div className="save-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          <AlertCircle size={16} />
          <span>{uploadError}</span>
          <button className="btn-icon-subtle" onClick={() => setUploadError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Voice error notice */}
      {voiceError && (
        <div className="save-banner" style={{ background: 'rgba(239, 68, 68, 0.15)', borderColor: 'var(--red)', color: 'var(--red)' }}>
          <AlertCircle size={16} />
          <span>{voiceError}</span>
        </div>
      )}

      {/* Scrollable Messages Area */}
      <div className="chat-messages-area">
        {messages.length === 0 ? (
          <div className="chat-welcome-container">
            <div className="welcome-avatar">
              <Sparkles size={28} color="white" />
            </div>
            <h1 className="welcome-title">
              Hi! I'm Nilesh, your personal AI coding assistant.
            </h1>
            <p className="welcome-subtitle">
              What would you like to build today? Ask me any coding question, speak with your microphone, attach documents, or upload photos.
            </p>

            <div className="welcome-capabilities-chips">
              <span className="capability-chip">⚡ Full-Stack MERN</span>
              <span className="capability-chip">🎙️ Voice Speech</span>
              <span className="capability-chip">📷 Vision & Photo AI</span>
              <span className="capability-chip">📎 Document Review</span>
              <span className="capability-chip">💻 Live Project Generator</span>
            </div>

            {/* Setup Banner if Gemini key is missing */}
            {!isGeminiConfigured && (
              <div className="setup-alert-card">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <Key size={18} color="var(--accent-light)" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600 }}>
                      Google Gemini API Key Needed
                    </h4>
                    <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                      Nilesh works best with Google Gemini online. Free keys are available from Google AI Studio.
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn btn-primary btn-sm" onClick={onOpenSettings}>
                        Configure API Key
                      </button>
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <span>Get Free Key</span>
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Prompt Starter Pills */}
            <div className="suggestions-grid">
              {suggestions.map((item, idx) => (
                <div
                  key={idx}
                  className="suggestion-card"
                  onClick={() => onSend(item.prompt)}
                >
                  <div className="suggestion-title">{item.title}</div>
                  <div className="suggestion-desc">{item.prompt}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages-stream">
            {messages.map((msg, idx) => {
              const prevUserMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user');
              return (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onReviewFiles={(files) => setReviewFiles(files)}
                  onOpenPhoto={(url, name) => setActiveLightbox({ url, name })}
                  onSpeak={(text) => handleSpeak(text, msg.id)}
                  isSpeakingThis={speakingMsgId === msg.id && isSpeaking}
                  onRegenerate={prevUserMsg ? () => onRegenerate?.(prevUserMsg.content, msg.id) : undefined}
                />
              );
            })}
            {isThinking && messages[messages.length - 1]?.role !== 'assistant' && (
              <TypingIndicator />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Hidden File Pickers */}
      <input
        type="file"
        ref={photoInputRef}
        style={{ display: 'none' }}
        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
        multiple
        onChange={e => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={docInputRef}
        style={{ display: 'none' }}
        accept=".pdf,.txt,.docx,.doc,.md,.json,.csv,.js,.ts,.html,.css"
        multiple
        onChange={e => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Bottom Message Input Box */}
      <footer className="chat-input-footer">
        {/* Voice recording pulsing banner */}
        {isListening && (
          <div className="voice-recording-banner">
            <span className="recording-dot" />
            <span>Listening to your voice… Speak now (click mic again to stop)</span>
            {interimTranscript && (
              <span style={{ fontStyle: 'italic', opacity: 0.8, marginLeft: 6 }}>
                "{interimTranscript}"
              </span>
            )}
          </div>
        )}

        {/* Pre-Send Attachment Preview Tray */}
        {attachments.length > 0 && (
          <div className="preview-tray">
            {attachments.map(att => (
              <div key={att.id} className="preview-item">
                {att.type === 'image' ? (
                  <img src={att.url} alt={att.name} className="preview-image-thumb" />
                ) : (
                  <FileText size={20} color="var(--accent-light)" />
                )}
                <div className="preview-info">
                  <span className="preview-name">{att.name}</span>
                  <span className="preview-size">{formatBytes(att.size)}</span>
                </div>
                <button
                  className="preview-remove-btn"
                  onClick={() => removeAttachment(att.id)}
                  title="Remove attachment"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-input-container" style={attachments.length > 0 ? { borderRadius: '0 0 var(--radius-md) var(--radius-md)' } : {}}>
          {/* Action buttons (Microphone, Photo, Document) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 6 }}>
            <button
              type="button"
              className={`btn-icon-subtle ${isListening ? 'mic-btn-recording' : ''}`}
              onClick={handleToggleVoice}
              title={
                !voiceSupported
                  ? 'Voice input not supported in this browser'
                  : isListening
                  ? 'Stop voice recording'
                  : 'Voice input (Click to speak)'
              }
              disabled={!voiceSupported || isThinking}
              style={{
                borderRadius: '50%',
                width: 32,
                height: 32,
                transition: 'all 0.2s',
              }}
            >
              {isListening ? <MicOff size={16} /> : <Mic size={16} />}
            </button>

            <button
              type="button"
              className="btn-icon-subtle"
              onClick={() => photoInputRef.current?.click()}
              title="Upload photo or screenshot (.png, .jpg, .webp)"
              disabled={isUploading || isThinking}
              style={{ borderRadius: '50%', width: 32, height: 32 }}
            >
              <ImageIcon size={16} />
            </button>

            <button
              type="button"
              className="btn-icon-subtle"
              onClick={() => docInputRef.current?.click()}
              title="Attach document (.pdf, .txt, .docx, .md, .json)"
              disabled={isUploading || isThinking}
              style={{ borderRadius: '50%', width: 32, height: 32 }}
            >
              <Paperclip size={16} />
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="chat-textarea"
            value={input}
            onChange={e => {
              setInput(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isUploading
                ? 'Uploading attachments…'
                : isListening
                ? 'Listening to speech…'
                : 'Message Nilesh… (Enter to send, Shift+Enter for new line)'
            }
            rows={1}
            disabled={isThinking}
          />

          {isUploading ? (
            <div style={{ padding: '0 10px', display: 'flex', alignItems: 'center' }}>
              <Loader2 size={16} className="spin" color="var(--accent-light)" />
            </div>
          ) : isThinking ? (
            <button className="stop-gen-btn" onClick={onStop} title="Stop generation">
              <Square size={14} />
            </button>
          ) : (
            <button
              className="send-message-btn"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0)}
              title="Send message"
            >
              <Send size={15} color="white" />
            </button>
          )}
        </div>

        <div className="chat-shortcuts-legend">
          <span>↵ Send</span>
          <span>⇧↵ New line</span>
          <span>🎤 Voice</span>
          <span>📷 Photos</span>
          <span>📎 Files</span>
          <span>Drag & Drop enabled</span>
        </div>
      </footer>

      {/* Image Lightbox Modal */}
      {activeLightbox && (
        <ImageLightbox
          imageUrl={activeLightbox.url}
          imageName={activeLightbox.name}
          onClose={() => setActiveLightbox(null)}
        />
      )}

      {/* File Review Modal if open */}
      {reviewFiles && reviewFiles.length > 0 && (
        <FileReviewModal
          files={reviewFiles}
          onClose={() => setReviewFiles(null)}
          onSuccess={(result) => {
            setSaveBanner(`Successfully saved ${result.filesWritten.length} file(s) into projects/${result.projectId}/`);
            setReviewFiles(null);
            setTimeout(() => setSaveBanner(null), 6000);
          }}
        />
      )}
    </div>
  );
}
