// src/api/client.ts — Nilesh Frontend API Client
import type { ParsedFile, BuilderPlan, ChatAttachment, TemporaryMemoryItem, CacheStats } from '../types';
import { buildClientZip } from '../utils/clientZip';

export const BASE_URL = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' && window.location.port === '3001' ? '' : 'http://localhost:3001');

// ─── Generic fetch helper ─────────────────────────────────────────────────────

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }
  return res.json();
}

export const api = {
  get:    <T>(path: string)                 => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown) => request<T>('POST',   path, body),
  patch:  <T>(path: string, body?: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                 => request<T>('DELETE', path),
};

// ─── Upload Files ─────────────────────────────────────────────────────────────

export async function uploadFiles(files: File[]): Promise<ChatAttachment[]> {
  const formData = new FormData();
  for (const f of files) {
    formData.append('files', f);
  }
  const res = await fetch(`${BASE_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Failed to upload files');
  }
  const data = await res.json();
  return (data.files || []).map((f: any) => ({
    ...f,
    url: f.url.startsWith('http') ? f.url : `${BASE_URL}${f.url}`,
  }));
}

// ─── SSE Streaming — shared reader ───────────────────────────────────────────

async function consumeSSEStream(
  res: Response,
  onChunk: (data: Record<string, unknown>) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  signal?: AbortSignal
): Promise<void> {
  if (!res.body) { onError('No response body received from server'); return; }
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (signal?.aborted) { reader.cancel(); return; }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') { onDone(); return; }
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        if (parsed.error) { onError(parsed.error as string); return; }
        if (parsed.done)  { onChunk(parsed); onDone(); return; }
        onChunk(parsed);
      } catch { /* incomplete JSON chunk — ignore */ }
    }
  }
  onDone();
}

// ─── Chat streaming ───────────────────────────────────────────────────────────

export interface StreamDoneMeta {
  tokensUsed?:      number;
  provider?:        string;
  model?:           string;
  cached?:          boolean;
  loadTimeMs?:      number;
  evalTimeMs?:      number;
  tokensPerSecond?: string;
  files?:           ParsedFile[];
}

export interface StreamOptions {
  message:            string;
  model?:             string;
  provider?:          string;
  projectId?:         string | null;
  conversationId?:    string | null;
  history?:           Array<{ role: string; content: string }>;
  searchResults?:     unknown[];
  attachments?:       ChatAttachment[];
  systemPrompt?:      string;
  regenerate?:        boolean;
  onChunk:            (chunk: string) => void;
  onConversationId?:  (id: string) => void;
  onDone:             (meta?: StreamDoneMeta) => void;
  onError:            (err: string) => void;
  signal?:            AbortSignal;
}

export async function streamChat(opts: StreamOptions): Promise<void> {
  const {
    message, model, provider, projectId, conversationId,
    history = [], searchResults, attachments = [], systemPrompt, regenerate, onChunk, onConversationId, onDone, onError, signal,
  } = opts;

  try {
    const res = await fetch(`${BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, model, provider, projectId, conversationId, history, searchResults, attachments, systemPrompt, regenerate }),
      signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const text = errJson?.error || errJson?.message || await res.text().catch(() => res.statusText);
      onError(text || 'Stream request failed');
      return;
    }

    let tokensUsed = 0;
    let providerName = '';
    let modelName = '';
    let cached = false;
    let loadTimeMs: number | undefined;
    let evalTimeMs: number | undefined;
    let tokensPerSecond: string | undefined;
    let files: ParsedFile[] = [];

    await consumeSSEStream(
      res,
      (parsed) => {
        if (parsed.error)          onError(parsed.error as string);
        if (parsed.conversationId) onConversationId?.(parsed.conversationId as string);
        if (parsed.content)        onChunk(parsed.content as string);
        if (parsed.tokensUsed)     tokensUsed = parsed.tokensUsed as number;
        if (parsed.provider)       providerName = parsed.provider as string;
        if (parsed.model)          modelName = parsed.model as string;
        if (parsed.cached)         cached = true;
        if (parsed.loadTimeMs)     loadTimeMs = parsed.loadTimeMs as number;
        if (parsed.evalTimeMs)     evalTimeMs = parsed.evalTimeMs as number;
        if (parsed.tokensPerSecond) tokensPerSecond = parsed.tokensPerSecond as string;
        if (parsed.files)          files = parsed.files as ParsedFile[];
      },
      () => onDone({
        tokensUsed,
        provider: providerName,
        model: modelName,
        cached,
        loadTimeMs,
        evalTimeMs,
        tokensPerSecond,
        files,
      }),
      onError,
      signal
    );
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    onError(err instanceof Error ? err.message : 'Unknown network error');
  }
}

// ─── Direct non-streaming chat (rock-solid for local Ollama) ──────────────────

export interface DirectChatOptions {
  message:         string;
  model?:          string;
  provider?:       string;
  projectId?:      string | null;
  conversationId?: string | null;
  history?:        Array<{ role: string; content: string }>;
  searchResults?:  unknown[];
  attachments?:    ChatAttachment[];
  systemPrompt?:   string;
  regenerate?:     boolean;
  signal?:         AbortSignal;
}

export interface DirectChatResponse {
  content:          string;
  conversationId:   string;
  tokensUsed?:      number;
  model?:           string;
  provider?:        string;
  cached?:          boolean;
  loadTimeMs?:      number;
  evalTimeMs?:      number;
  tokensPerSecond?: string;
  files?:           ParsedFile[];
}

export async function sendDirectChat(opts: DirectChatOptions): Promise<DirectChatResponse> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
    signal: opts.signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || 'Request failed');
  }

  return res.json();
}

// ─── Temporary Memory & Repeated-Question Cache APIs ──────────────────────────

export async function getMemories(): Promise<{ enabled: boolean; count: number; memories: TemporaryMemoryItem[] }> {
  return api.get('/api/memory');
}

export async function saveMemory(key: string, content: string, category = 'preference', ttlDays?: number): Promise<{ ok: boolean; message: string }> {
  return api.post('/api/memory', { key, content, category, ttlDays });
}

export async function deleteMemory(id: string): Promise<{ ok: boolean; message: string }> {
  return api.delete(`/api/memory/${id}`);
}

export async function clearAllMemories(): Promise<{ ok: boolean; cleared: number; message: string }> {
  return api.delete('/api/memory');
}

export async function getCacheStats(): Promise<CacheStats> {
  return api.get('/api/cache/stats');
}

export async function clearResponseCache(): Promise<{ ok: boolean; cleared: number; message: string }> {
  return api.delete('/api/cache');
}

// ─── Builder streaming ────────────────────────────────────────────────────────

export interface BuilderStreamOptions {
  prompt:         string;
  plan?:          BuilderPlan | Record<string, unknown> | null;
  projectId?:     string | null;
  model?:         string;
  provider?:      string;
  onPlan?:        (plan: Record<string, unknown>) => void;
  onChunk:        (chunk: string) => void;
  onFile?:        (file: ParsedFile) => void;
  onFileCreated?: (path: string) => void;
  onDone?:        (files?: string[]) => void;
  onError:        (err: string) => void;
  signal?:        AbortSignal;
}

export async function streamBuilder(opts: BuilderStreamOptions): Promise<void> {
  const { prompt, plan, projectId, model, provider, onPlan, onChunk, onFile, onFileCreated, onDone, onError, signal } = opts;

  try {
    const res = await fetch(`${BASE_URL}/api/builder/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, plan, projectId, model, provider }),
      signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      const text = errJson?.error || errJson?.message || await res.text().catch(() => res.statusText);
      onError(text || 'Builder stream request failed');
      return;
    }

    const createdFiles: string[] = [];

    await consumeSSEStream(
      res,
      (parsed) => {
        if (parsed.type === 'plan' && parsed.plan && onPlan) onPlan(parsed.plan as Record<string, unknown>);
        if (parsed.content) onChunk(parsed.content as string);
        if (parsed.text) onChunk(parsed.text as string);
        if (parsed.fileCreated) {
          createdFiles.push(parsed.fileCreated as string);
          onFileCreated?.(parsed.fileCreated as string);
        }
        if (parsed.file && onFile) {
          onFile(parsed.file as ParsedFile);
        }
        if (parsed.filesCreated && Array.isArray(parsed.filesCreated)) {
          for (const f of parsed.filesCreated) {
            if (!createdFiles.includes(f)) createdFiles.push(f);
          }
        }
        if (parsed.error) onError(parsed.error as string);
      },
      () => onDone?.(createdFiles),
      onError,
      signal
    );
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    onError(err instanceof Error ? err.message : 'Unknown network error');
  }
}

// ─── Learning challenge streaming ─────────────────────────────────────────────

export interface LearningStreamOptions {
  topic:       string;
  difficulty:  string;
  language?:   string;
  onChunk:     (chunk: string) => void;
  onDone:      () => void;
  onError:     (err: string) => void;
  signal?:     AbortSignal;
}

export async function streamLearning(opts: LearningStreamOptions): Promise<void> {
  const { topic, difficulty, language, onChunk, onDone, onError, signal } = opts;

  try {
    const res = await fetch(`${BASE_URL}/api/learning/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, difficulty, language }),
      signal,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => null);
      onError(errJson?.error || 'Learning stream failed');
      return;
    }

    await consumeSSEStream(
      res,
      (parsed) => { if (parsed.content) onChunk(parsed.content as string); },
      onDone,
      onError,
      signal
    );
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    onError(err instanceof Error ? err.message : 'Unknown network error');
  }
}

// ─── Project & File Download & Save As Helpers ────────────────────────────────

// ─── Project & File Download & Save As Helpers ────────────────────────────────
function getMimeType(filename: string): string {
  const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')).toLowerCase() : '';
  const map: Record<string, string> = {
    '.py':    'text/x-python; charset=utf-8',
    '.js':    'application/javascript; charset=utf-8',
    '.jsx':   'text/jsx; charset=utf-8',
    '.ts':    'application/typescript; charset=utf-8',
    '.tsx':   'text/tsx; charset=utf-8',
    '.html':  'text/html; charset=utf-8',
    '.css':   'text/css; charset=utf-8',
    '.json':  'application/json; charset=utf-8',
    '.md':    'text/markdown; charset=utf-8',
    '.txt':   'text/plain; charset=utf-8',
    '.csv':   'text/csv; charset=utf-8',
    '.pdf':   'application/pdf',
    '.zip':   'application/zip',
    '.png':   'image/png',
    '.jpg':   'image/jpeg',
    '.svg':   'image/svg+xml',
    '.sql':   'text/x-sql; charset=utf-8',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Retrieves a valid ZIP archive Blob for a project.
 * Attempts server-side packaging first via /api/download/project-zip.
 * If server is offline or fails, falls back seamlessly to client-side PKZIP generator.
 * NEVER returns an error string or HTML error page as a Blob.
 */
export async function getProjectZipBlob(projectName: string, files: ParsedFile[]): Promise<Blob> {
  const cleanName = (projectName || 'Project').trim().replace(/[\\/:*?"<>|]/g, '-') || 'Nilesh-Project';
  
  // Format files list
  const validFiles = files.filter(f => f && f.path).map(f => ({
    path: f.path,
    content: f.content ?? '',
  }));

  // Ensure README exists if multi-file project
  const hasReadme = validFiles.some(f => /readme\.md$/i.test(f.path));
  if (!hasReadme && validFiles.length > 1) {
    const isNode = validFiles.some(f => f.path.endsWith('package.json') || f.path.endsWith('.jsx') || f.path.endsWith('.tsx'));
    const isPython = validFiles.some(f => f.path.endsWith('.py'));
    let readme = `# ${cleanName}\n\nGenerated with Nilesh AI.\n\n## Instructions\n\n`;
    if (isNode) readme += `\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;
    else if (isPython) readme += `\`\`\`bash\npython -m venv venv\n.\\venv\\Scripts\\activate\npip install -r requirements.txt\npython main.py\n\`\`\`\n`;
    else readme += `Open index.html in your browser.\n`;
    validFiles.push({ path: 'README.md', content: readme });
  }

  // 1. Try Backend Packaging
  try {
    const res = await fetch(`${BASE_URL}/api/download/project-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectName: cleanName, files: validFiles }),
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/zip') || contentType.includes('octet-stream')) {
        const blob = await res.blob();
        if (blob.size > 22) { // Minimum valid ZIP size is 22 bytes (empty EOCD)
          return blob;
        }
      }
    }
  } catch (err) {
    console.warn('[Download] Backend zip packaging unavailable, using client-side generator:', err);
  }

  // 2. Fallback: Pure Client-side PKZIP generation
  const zipBlob = buildClientZip(validFiles);
  return zipBlob;
}

export async function downloadProjectZip(projectName: string, files: ParsedFile[]): Promise<{ success: boolean; filename: string; size: number }> {
  const cleanName = (projectName || 'Project').trim().replace(/[\\/:*?"<>|]/g, '-') || 'Nilesh-Project';
  const blob = await getProjectZipBlob(cleanName, files);

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);

  return { success: true, filename: `${cleanName}.zip`, size: blob.size };
}

export async function downloadSingleFile(filename: string, content: string): Promise<void> {
  const cleanName = filename.replace(/[\\/:*?"<>|]/g, '_') || 'download.txt';
  const mimeType = getMimeType(cleanName);

  // Attempt backend endpoint for audit logging, fallback to direct browser Blob
  try {
    const res = await fetch(`${BASE_URL}/api/download/single-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: cleanName, content }),
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      return;
    }
  } catch {
    // Backend offline or error — proceed with browser direct download
  }

  // Pure browser download fallback
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Modern Save As dialog: uses showSaveFilePicker where available, with browser download fallback.
 * Strictly verifies content validity and ensures correct file extensions.
 */
export async function saveAsInteractive(
  suggestedName: string,
  content: string | Blob,
  fileTypeDesc = 'File'
): Promise<{ success: boolean; pathSaved?: string }> {
  const isBlob = content instanceof Blob;
  const mimeType = isBlob ? (content as Blob).type : getMimeType(suggestedName);
  const ext = suggestedName.includes('.') ? suggestedName.slice(suggestedName.lastIndexOf('.')) : '.txt';

  // If window.showSaveFilePicker is supported (Chrome, Edge on Windows)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName,
        types: [{
          description: fileTypeDesc,
          accept: { [mimeType || 'application/octet-stream']: [ext] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return { success: true, pathSaved: handle.name };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false }; // User explicitly cancelled picker dialog
      }
      // If permission error or environment restriction, fall through to browser download
      console.warn('[SaveAs] FilePicker declined, falling back to browser download:', err);
    }
  }

  // Fallback: standard browser download anchor
  const blob = isBlob ? (content as Blob) : new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
  return { success: true, pathSaved: suggestedName };
}

export async function saveProjectToDisk(
  projectName: string,
  files: ParsedFile[],
  category = 'projects',
  overwrite = false,
  customTargetDir?: string
): Promise<{
  success: boolean;
  verified: boolean;
  exactPath: string;
  projectName: string;
  totalFiles: number;
  filesWritten: Array<{ path: string; size: number }>;
  totalSize: number;
}> {
  return api.post('/api/file-manager/save-to-disk', {
    projectName,
    files,
    category,
    overwrite,
    customTargetDir,
  });
}

export async function openInExplorer(targetPath: string): Promise<{ success: boolean; message: string }> {
  return api.post('/api/file-manager/open-explorer', { targetPath });
}

export async function scanProjectDirectory(projectPath: string) {
  return api.post('/api/file-manager/scan', { projectPath });
}
