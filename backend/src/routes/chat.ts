// src/routes/chat.ts — Nilesh Chat Engine: Hybrid Provider, Memory, Cache & RAG
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import {
  db,
  getSetting,
  getActiveMemories,
  getCachedResponse,
  setCachedResponse,
} from '../db.ts';
import {
  streamChatCompletion,
  chatCompletion,
  type ChatMessage,
  resolveActiveProvider,
} from '../providers/index.ts';
import { UPLOADS_DIR } from './upload.ts';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECTS_BASE = path.resolve(__dirname, '../../../projects');
const PROMPTS_BASE  = path.resolve(__dirname, '../../../ai/prompts');
const SYSTEM_PROMPT_FILE = path.join(PROMPTS_BASE, 'system_prompt.md');

// ── Dynamic Query Detector for Response Cache ─────────────────────────────────

export function isDynamicQuery(query: string, searchResults?: any[]): boolean {
  if (searchResults && searchResults.length > 0) return true;
  const q = (query || '').toLowerCase().trim();
  // Check for dynamic temporal words, real-time data, live weather/stocks/news
  const dynamicPattern = /\b(today|tomorrow|yesterday|what time|current time|right now|date today|current date|weather|stock price|gold price|crypto price|exchange rate|live news|breaking news)\b/i;
  return dynamicPattern.test(q);
}

// ── Approved Project Files Knowledge Retriever (Phase 6 RAG) ──────────────────

export function getApprovedProjectContext(projectId?: string | null, query = ''): string {
  if (!projectId) return '';
  const projDir = path.join(PROJECTS_BASE, projectId);
  if (!fs.existsSync(projDir)) return '';

  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (queryTerms.length === 0) return '';

  const matchedSnippets: string[] = [];
  const scanAndMatch = (dir: string, depth = 0) => {
    if (depth > 4 || matchedSnippets.length >= 3) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'coverage'].includes(e.name)) continue;
        const fullPath = path.join(dir, e.name);
        const relPath = path.relative(projDir, fullPath);

        // Security check: NEVER inspect .env, secret files, keys, or credentials
        if (
          e.name.startsWith('.env') ||
          e.name.includes('secret') ||
          e.name.includes('credential') ||
          e.name.endsWith('.pem') ||
          e.name.endsWith('.key')
        ) {
          continue;
        }

        if (e.isDirectory()) {
          scanAndMatch(fullPath, depth + 1);
        } else {
          const ext = path.extname(e.name).toLowerCase();
          if (['.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.html', '.css', '.py'].includes(ext)) {
            const relLower = relPath.toLowerCase();
            const matchesFilename = queryTerms.some(term => relLower.includes(term));
            if (matchesFilename) {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8').slice(0, 2500);
                matchedSnippets.push(`--- Approved Project File: "${relPath}" ---\n${content}\n--- End of file ---`);
              } catch {}
            }
          }
        }
      }
    } catch {}
  };

  scanAndMatch(projDir);
  if (matchedSnippets.length > 0) {
    return `\n\n---\nRELEVANT APPROVED PROJECT FILES (Local Project Context):\n${matchedSnippets.join('\n\n')}`;
  }
  return '';
}

// ── System Prompt Builder ──────────────────────────────────────────────────────

export function getNileshSystemPrompt(projectId?: string | null, provider?: string): string {
  let basePrompt: string;

  // Ultra-fast lightweight system prompt for local Ollama on CPU/integrated graphics
  if (provider === 'ollama') {
    basePrompt = `You are Nilesh — an elite personal AI coding assistant and computer science tutor.
Mission: Help learn programming, understand concepts, build software, and fix errors.
Core areas: MERN Stack (React, Node.js, Express, MongoDB), JavaScript, TypeScript, Python, and Data Science.
When generating code files for projects, always use this exact code block format:
\`\`\`language:relative/path/to/filename.ext
// Full, working, un-truncated file contents here
\`\`\`
Provide friendly, clear, beginner-friendly explanations with complete, copy-paste ready code.`;
  } else {
    basePrompt = `You are Nilesh — an elite Senior Full-Stack MERN Developer, Software Architect, and personal AI coding assistant created for Nilesh.

Your mission is to help Nilesh learn, design, build, debug, and deploy real, working full-stack applications and write clean, robust code across all programming languages (MERN Stack: React, Node.js, Express, MongoDB, as well as JavaScript, TypeScript, Python, Java, C++, SQL, HTML/CSS).

### CORE RULES & CAPABILITIES:

1. FULL-STACK MERN ARCHITECTURE EXPERTISE:
   When Nilesh asks you to create a website or web application (such as "Create a complete website for KICT computer classes with course listings, course prices in INR, student registration, inquiry forms, pass-out student records, and nine Ahmedabad branches"):
   - Understand the project scope and real-world domain requirements.
   - Ask clarifying questions ONLY if essential business information is missing. Otherwise, make sensible architectural assumptions and proceed decisively.
   - Plan a clean, modular project structure with clear frontend and backend separation.
   - Generate complete React frontend components, pages, routing, and responsive UI.
   - Generate production-ready Node.js and Express backend servers.
   - Design MongoDB schemas and Mongoose models with proper data types, indexes, and validations.
   - Implement RESTful API routes and controller functions with input validation and comprehensive error handling.
   - Connect the frontend cleanly to backend APIs (using fetch or axios).
   - Configure environment variables (.env / .env.example).
   - Provide exact dependency lists, package.json files, and npm install commands.
   - Provide complete folder tree diagrams and step-by-step instructions to run frontend and backend together.
   - Include modern security practices (CORS, sanitized queries, hashed passwords with bcryptjs, JWT authentication where appropriate).

2. CODE FILE GENERATION FORMAT:
   When generating code for files that belong to a project, ALWAYS use this exact code block format so MyPersonalAI can parse and offer to save the file:
   \`\`\`language:relative/path/to/filename.ext
   // Full, working, un-truncated file contents here
   \`\`\`

3. CODING EXCELLENCE:
   - Provide complete, copy-paste ready, bug-free code. Avoid placeholder comments like "// do this yourself" or "// rest of code here".
   - Explain non-obvious architecture choices simply and concisely.
   - Keep answers friendly, highly knowledgeable, and encouraging.`;
  }

  if (fs.existsSync(SYSTEM_PROMPT_FILE)) {
    try {
      const customPrompt = fs.readFileSync(SYSTEM_PROMPT_FILE, 'utf-8').trim();
      if (customPrompt) {
        basePrompt = customPrompt + '\n\n' + basePrompt;
      }
    } catch {
      // use default base prompt
    }
  }

  // Inject active temporary memories if enabled (Phase 4)
  const memoryEnabled = getSetting('memory_enabled', 'true') === 'true';
  if (memoryEnabled) {
    const memories = getActiveMemories();
    if (memories.length > 0) {
      const memLines = memories.slice(0, 8).map(m => `- [${m.category}] ${m.key}: ${m.content}`).join('\n');
      basePrompt += `\n\n---\nTEMPORARY PERSONAL MEMORY (Context from user's recent recurring preferences):\n${memLines}\n(Note: This memory is stored locally in temporary SQLite cache and does not alter underlying model weights.)`;
    }
  }

  // Inject workspace context if active project
  if (projectId) {
    const projDir = path.join(PROJECTS_BASE, projectId);
    if (fs.existsSync(projDir)) {
      const files: string[] = [];
      const scan = (dir: string, depth = 0) => {
        if (depth > 3) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            if (['node_modules', '.git', 'dist', 'build', '.next'].includes(e.name)) continue;
            const rel = path.relative(projDir, path.join(dir, e.name));
            files.push(e.isDirectory() ? `📁 ${rel}/` : `📄 ${rel}`);
            if (e.isDirectory()) scan(path.join(dir, e.name), depth + 1);
          }
        } catch { /* skip */ }
      };
      scan(projDir);
      basePrompt += `\n\n---\nACTIVE WORKSPACE PROJECT: "${projectId}"\nWorkspace files:\n${files.slice(0, 50).join('\n') || '(empty project)'}`;
    }
  }

  return basePrompt;
}

// ── Extract code file actions from assistant text ─────────────────────────────

export interface ParsedFile {
  path: string;
  content: string;
  language: string;
}

export function extractCodeFiles(text: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const regex = /```([a-zA-Z0-9_-]+):([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\r?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const language = match[1];
    const rawPath = match[2].trim();
    const content = match[3];
    const safePath = path.normalize(rawPath).replace(/^(\.\.[\\/])+/, '');
    files.push({
      language,
      path: safePath,
      content,
    });
  }
  return files;
}

// ── Persist conversation messages helper ──────────────────────────────────────

function ensureConversation(convId: string, initialTitle = 'New Chat'): string {
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(convId);
  if (!existing) {
    const now = Date.now();
    db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(convId, initialTitle, now, now);
  }
  return convId;
}

function saveMessage(
  convId: string,
  role: 'user' | 'assistant' | 'error',
  content: string,
  meta?: { tokensUsed?: number; searchResults?: any; attachments?: any[]; cached?: boolean }
) {
  try {
    ensureConversation(convId);
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, search_results, tokens_used, attachments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      convId,
      role,
      content,
      Date.now(),
      meta?.searchResults ? JSON.stringify(meta.searchResults) : null,
      meta?.tokensUsed ?? 0,
      meta?.attachments ? JSON.stringify(meta.attachments) : '[]'
    );
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(Date.now(), convId);
  } catch (err) {
    console.warn('[chat] Failed to save message:', err);
  }
}

function processAttachments(attachments: any[] = []) {
  const images: Array<{ mimeType: string; data: string }> = [];
  let docContext = '';

  if (!Array.isArray(attachments)) return { images, docContext };

  for (const att of attachments) {
    if (!att || !att.url) continue;
    const filename = path.basename(att.url);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) continue;

    const mime = (att.mimeType || '').toLowerCase();
    const isImage = att.type === 'image' || mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(filename);

    if (isImage) {
      try {
        const buf = fs.readFileSync(filePath);
        images.push({
          mimeType: att.mimeType || 'image/jpeg',
          data: buf.toString('base64'),
        });
      } catch (err) {
        console.warn('[chat] Failed to read image attachment:', err);
      }
    } else {
      const ext = path.extname(filename).toLowerCase();
      if (['.txt', '.md', '.json', '.csv', '.js', '.ts', '.html', '.css', '.py', '.java', '.sql'].includes(ext)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8').slice(0, 50000);
          docContext += `\n\n--- Content of attached file "${att.name}" ---\n${content}\n--- End of file ---`;
        } catch {}
      } else {
        docContext += `\n\n[Attached File: "${att.name}" (${att.size ? (att.size / 1024).toFixed(1) + ' KB' : ''})]`;
      }
    }
  }

  return { images, docContext };
}

// ─── POST /api/chat — Standard Non-Streaming Endpoint ─────────────────────────

router.post('/chat', async (req, res) => {
  const {
    message,
    conversationId,
    history = [],
    model,
    provider,
    projectId,
    searchResults,
    attachments = [],
    regenerate = false,
  } = req.body;

  const hasText = typeof message === 'string' && message.trim().length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!hasText && !hasAttachments) {
    return res.status(400).json({ error: 'Message or attachment is required and cannot be empty.' });
  }

  const convId = conversationId || randomUUID();
  const rawUserContent = message?.trim() || (hasAttachments ? `[Attachment: ${attachments.map((a: any) => a.name).join(', ')}]` : '');

  // 1. Check Repeated-Question Cache (Phase 4C)
  const cacheEnabled = getSetting('cache_enabled', 'true') === 'true';
  const resolvedProv = await resolveActiveProvider(provider);
  const targetModel = model || (resolvedProv === 'gemini' ? 'gemini-3.8-flash' : 'qwen2.5-coder:1.5b');

  if (cacheEnabled && !regenerate && hasText && !isDynamicQuery(message, searchResults)) {
    const cached = getCachedResponse(resolvedProv, targetModel, message.trim(), projectId);
    if (cached) {
      console.log(`[Cache Hit] Serving repeated question for "${message.trim().slice(0, 40)}" in <1ms`);
      saveMessage(convId, 'user', rawUserContent, { searchResults, attachments });
      saveMessage(convId, 'assistant', cached.answer, { tokensUsed: cached.tokens_used, cached: true });

      const files = extractCodeFiles(cached.answer);
      return res.json({
        content: cached.answer,
        conversationId: convId,
        tokensUsed: cached.tokens_used,
        model: cached.model,
        provider: cached.provider,
        files,
        cached: true,
      });
    }
  }

  let systemPrompt = req.body.systemPrompt || getNileshSystemPrompt(projectId, resolvedProv);

  if (searchResults?.length) {
    const snippets = searchResults
      .slice(0, 5)
      .map((r: any, i: number) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
      .join('\n\n');
    systemPrompt += `\n\n---\nWeb Search Results:\n${snippets}`;
  }

  // Approved project files knowledge (Phase 6 RAG)
  if (projectId && hasText) {
    const projectContext = getApprovedProjectContext(projectId, message);
    if (projectContext) {
      systemPrompt += projectContext;
    }
  }

  const { images, docContext } = processAttachments(attachments);
  const userText = (message?.trim() || (hasAttachments ? 'Please review the attached file(s).' : '')) + docContext;

  // Build message history with pruning for local Ollama on 8GB RAM
  const maxLocalHistory = Number(getSetting('max_local_history', '6')) || 6;
  const historyToUse = resolvedProv === 'ollama' ? history.slice(-maxLocalHistory) : history;

  const messages: ChatMessage[] = [];
  for (const h of historyToUse) {
    if (h.role && h.content) {
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      });
    }
  }
  messages.push({
    role: 'user',
    content: userText,
    images: images.length > 0 ? images : undefined,
  });

  // Save user message
  saveMessage(convId, 'user', rawUserContent, { searchResults, attachments });

  try {
    const result = await chatCompletion(
      messages,
      {
        model: targetModel,
        systemPrompt,
        maxTokens: 8192,
      },
      provider
    );

    // Save assistant message
    saveMessage(convId, 'assistant', result.content, { tokensUsed: result.tokensUsed });

    // Store in Repeated-Question Cache if eligible
    if (cacheEnabled && hasText && !isDynamicQuery(message, searchResults) && result.content) {
      setCachedResponse(result.provider, result.model, message.trim(), result.content, result.tokensUsed || 0, projectId);
    }

    // Auto title if first message
    const conv = db.prepare('SELECT title FROM conversations WHERE id = ?').get(convId) as any;
    if (conv?.title === 'New Chat') {
      const autoTitle = message.slice(0, 50) + (message.length > 50 ? '…' : '');
      db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(autoTitle, convId);
    }

    const files = extractCodeFiles(result.content);

    return res.json({
      content: result.content,
      conversationId: convId,
      tokensUsed: result.tokensUsed,
      model: result.model,
      provider: result.provider,
      loadTimeMs: result.loadTimeMs,
      evalTimeMs: result.evalTimeMs,
      tokensPerSecond: result.tokensPerSecond,
      files,
      cached: false,
    });
  } catch (err: any) {
    const errMsg = err.message || 'Failed to generate response';
    console.error('[chat] Chat error:', errMsg);
    saveMessage(convId, 'error', `Error: ${errMsg}`);
    return res.status(500).json({ error: errMsg, conversationId: convId });
  }
});

// ─── POST /api/chat/stream — SSE Streaming Endpoint ───────────────────────────

router.post('/chat/stream', async (req, res) => {
  const {
    message,
    conversationId,
    history = [],
    model,
    provider,
    projectId,
    searchResults,
    attachments = [],
    regenerate = false,
  } = req.body;

  const hasText = typeof message === 'string' && message.trim().length > 0;
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!hasText && !hasAttachments) {
    return res.status(400).json({ error: 'Message or attachment is required and cannot be empty.' });
  }

  const convId = conversationId || randomUUID();
  const rawUserContent = message?.trim() || (hasAttachments ? `[Attachment: ${attachments.map((a: any) => a.name).join(', ')}]` : '');

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const sendEvent = (data: object) => {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch { /* client disconnected */ }
  };

  // 1. Check Repeated-Question Cache (Phase 4C)
  const cacheEnabled = getSetting('cache_enabled', 'true') === 'true';
  const resolvedProv = await resolveActiveProvider(provider);
  const targetModel = model || (resolvedProv === 'gemini' ? 'gemini-3.8-flash' : 'qwen2.5-coder:1.5b');

  if (cacheEnabled && !regenerate && hasText && !isDynamicQuery(message, searchResults)) {
    const cached = getCachedResponse(resolvedProv, targetModel, message.trim(), projectId);
    if (cached) {
      console.log(`[Cache Hit] Streaming repeated question for "${message.trim().slice(0, 40)}" instantly`);
      saveMessage(convId, 'user', rawUserContent, { searchResults, attachments });
      saveMessage(convId, 'assistant', cached.answer, { tokensUsed: cached.tokens_used, cached: true });

      sendEvent({ conversationId: convId });
      sendEvent({ content: cached.answer });
      const files = extractCodeFiles(cached.answer);
      sendEvent({
        done: true,
        tokensUsed: cached.tokens_used,
        provider: cached.provider,
        model: cached.model,
        conversationId: convId,
        files,
        cached: true,
      });
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
  }

  let systemPrompt = getNileshSystemPrompt(projectId, resolvedProv);

  if (searchResults?.length) {
    const snippets = searchResults
      .slice(0, 5)
      .map((r: any, i: number) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
      .join('\n\n');
    systemPrompt += `\n\n---\nWeb Search Results:\n${snippets}`;
  }

  // Approved project files knowledge (Phase 6 RAG)
  if (projectId && hasText) {
    const projectContext = getApprovedProjectContext(projectId, message);
    if (projectContext) {
      systemPrompt += projectContext;
    }
  }

  const { images, docContext } = processAttachments(attachments);
  const userText = (message?.trim() || (hasAttachments ? 'Please review the attached file(s).' : '')) + docContext;

  // Build message history with pruning for local Ollama on 8GB RAM
  const maxLocalHistory = Number(getSetting('max_local_history', '6')) || 6;
  const historyToUse = resolvedProv === 'ollama' ? history.slice(-maxLocalHistory) : history;

  const messages: ChatMessage[] = [];
  for (const h of historyToUse) {
    if (h.role && h.content) {
      messages.push({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content,
      });
    }
  }
  messages.push({
    role: 'user',
    content: userText,
    images: images.length > 0 ? images : undefined,
  });

  // Save user message
  saveMessage(convId, 'user', rawUserContent, { searchResults, attachments });

  // Inform client of conversation ID
  sendEvent({ conversationId: convId });

  // Abort controller for client disconnect
  const abortCtrl = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortCtrl.abort();
    }
  });

  try {
    const result = await streamChatCompletion(
      messages,
      {
        model: targetModel,
        systemPrompt,
        maxTokens: 8192,
        signal: abortCtrl.signal,
      },
      {
        onChunk: (chunk: string) => {
          sendEvent({ content: chunk });
        },
        signal: abortCtrl.signal,
      },
      provider
    );

    // Save assistant message
    if (result.fullResponse) {
      saveMessage(convId, 'assistant', result.fullResponse, { tokensUsed: result.tokensUsed });

      // Store in Repeated-Question Cache if eligible
      if (cacheEnabled && hasText && !isDynamicQuery(message, searchResults)) {
        setCachedResponse(result.provider, result.model, message.trim(), result.fullResponse, result.tokensUsed || 0, projectId);
      }

      // Auto title
      const conv = db.prepare('SELECT title FROM conversations WHERE id = ?').get(convId) as any;
      if (conv?.title === 'New Chat') {
        const autoTitle = message.slice(0, 50) + (message.length > 50 ? '…' : '');
        db.prepare('UPDATE conversations SET title = ? WHERE id = ?').run(autoTitle, convId);
      }
    }

    const files = extractCodeFiles(result.fullResponse);

    sendEvent({
      done: true,
      tokensUsed: result.tokensUsed,
      provider: result.provider,
      model: result.model,
      loadTimeMs: result.loadTimeMs,
      evalTimeMs: result.evalTimeMs,
      tokensPerSecond: result.tokensPerSecond,
      conversationId: convId,
      files,
      cached: false,
    });
  } catch (err: any) {
    if (abortCtrl.signal.aborted) {
      return;
    }
    const errMsg = err.message || 'Stream processing failed';
    console.error('[chat/stream] Error:', errMsg);
    saveMessage(convId, 'error', `Error: ${errMsg}`);
    sendEvent({ error: errMsg, conversationId: convId });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

export default router;
