// src/index.ts — MyPersonalAI Backend Server — Nilesh Assistant
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (portable across USB drive relocations)
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // fallback
}

// Initialize SQLite Database
import './db.ts';

import healthRouter        from './routes/health.ts';
import chatRouter          from './routes/chat.ts';
import conversationsRouter from './routes/conversations.ts';
import projectsRouter      from './routes/projects.ts';
import filesRouter         from './routes/files.ts';
import settingsRouter      from './routes/settings.ts';
import searchRouter        from './routes/search.ts';
import ollamaRouter        from './routes/ollama.ts';
import learningRouter      from './routes/learning.ts';
import builderRouter       from './routes/builder.ts';
import knowledgeRouter     from './routes/knowledge.ts';
import terminalRouter      from './routes/terminal.ts';
import uploadRouter, { UPLOADS_DIR } from './routes/upload.ts';
import communicationRouter from './routes/communication.ts';
import fileManagerRouter  from './routes/fileManager.ts';
import memoryRouter       from './routes/memory.ts';

const app  = express();
const PORT = Number(process.env.PORT ?? 3001);

// ─── Middleware ────────────────────────────────────────────────────────────────

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    process.env.FRONTEND_ORIGIN ?? '',
  ].filter(Boolean),
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Development request logger
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    if (!req.path.startsWith('/api/status')) {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
  });
}

// Serve uploaded files statically
app.use('/uploads', express.static(UPLOADS_DIR));

// ─── API Routes ────────────────────────────────────────────────────────────────

app.use('/api', healthRouter);
app.use('/api', chatRouter);
app.use('/api', uploadRouter);
app.use('/api', communicationRouter);
app.use('/api', conversationsRouter);
app.use('/api', projectsRouter);
app.use('/api', filesRouter);
app.use('/api', settingsRouter);
app.use('/api', searchRouter);
app.use('/api', ollamaRouter);
app.use('/api', learningRouter);
app.use('/api', builderRouter);
app.use('/api', knowledgeRouter);
app.use('/api', terminalRouter);
app.use('/api', fileManagerRouter);
app.use('/api', memoryRouter);

// ─── Static Frontend Serving (Single Process, Low-RAM Mode) ────────────────
const FRONTEND_DIST = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      name: 'MyPersonalAI — Nilesh Coding Assistant',
      status: 'running',
      version: '2.0.0',
      endpoints: {
        chat:          'POST /api/chat',
        chatStream:    'POST /api/chat/stream',
        conversations: 'GET  /api/conversations',
        projects:      'GET  /api/projects',
        applyFiles:    'POST /api/projects/apply-files',
        status:        'GET  /api/status',
        settings:      'GET  /api/settings',
      },
    });
  });
}

// ─── 404 handler for unmatched API routes ─────────────────────────────────────
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[Backend Error]', err);
  res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});

// ─── Startup Validation & Server Listen ───────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  const geminiConfigured = !!(process.env.AI_API_KEY || process.env.GEMINI_API_KEY);
  const activeProvider = process.env.AI_PROVIDER || (geminiConfigured ? 'gemini' : 'ollama');

  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║       Nilesh — MyPersonalAI Backend Ready              ║');
  console.log(`║       API Server: http://localhost:${PORT}                    ║`);
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Active Provider:  ${activeProvider}`);
  console.log(`  Default Model:    ${process.env.AI_MODEL || (activeProvider === 'gemini' ? 'gemini-3.8-flash' : 'qwen2.5-coder:1.5b')}`);
  console.log(`  Gemini API Key:   ${geminiConfigured ? '✅ Configured in .env' : '⚠️  Not configured (add AI_API_KEY / GEMINI_API_KEY in .env or via Settings UI)'}`);
  console.log(`  Ollama Local URL: ${process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'}`);
  console.log(`  Projects Dir:     ${path.resolve(__dirname, '../../projects')}`);
  console.log(`  Data Dir:         ${path.resolve(__dirname, '../../data')}`);
  console.log('');
  if (!geminiConfigured) {
    console.log('  👉 TIP: Get a free Google Gemini key at https://aistudio.google.com/app/apikey');
    console.log('     and paste it in the chat interface or in e:\\MyPersonalAI\\.env');
    console.log('');
  }
});

export default app;
