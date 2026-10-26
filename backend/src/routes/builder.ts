// src/routes/builder.ts — MERN Website Builder: generate, edit, and fix projects
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../db.ts';
import { streamChatCompletion } from '../providers/index.ts';
import { randomUUID } from 'crypto';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECTS_BASE = path.resolve(__dirname, '../../../projects');

// ─── Generate plan ─────────────────────────────────────────────────────────────

router.post('/builder/plan', async (req, res) => {
  const { prompt, projectName } = req.body;
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt is required' });

  const systemPrompt = `You are an expert MERN stack developer. Analyze the user's website request and produce a clear implementation plan.

Return JSON with this exact structure:
{
  "projectName": "kebab-case-name",
  "title": "Human readable title",
  "description": "What this site does",
  "pages": ["Home", "About", "..."],
  "features": ["Feature 1", "Feature 2", "..."],
  "models": [{"name": "ModelName", "fields": ["field1: Type", "field2: Type"]}],
  "apiEndpoints": ["GET /api/items", "POST /api/items", "..."],
  "dependencies": {
    "frontend": ["react-router-dom", "axios", "..."],
    "backend": ["express", "mongoose", "bcryptjs", "jsonwebtoken", "..."]
  },
  "estimatedFiles": 20,
  "requiresAuth": true,
  "requiresMongoDB": true,
  "clarifyingQuestions": []
}

Only include clarifyingQuestions if truly essential info is missing. Keep it to max 2 questions.`;

  try {
    let planText = '';

    await streamChatCompletion(
      [{ role: 'user', content: `Plan this website: ${prompt}` }],
      {
        systemPrompt,
        model: process.env.AI_MODEL || 'gemini-3.8-flash',
        temperature: 0.7,
      },
      {
        onChunk: (chunk) => { planText += chunk; }
      }
    );

    // Extract JSON from response
    const jsonMatch = planText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.json({ raw: planText, parsed: null });

    try {
      const plan = JSON.parse(jsonMatch[0]);
      if (projectName) plan.projectName = projectName;
      res.json({ plan, raw: planText });
    } catch {
      res.json({ raw: planText, parsed: null });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Generate project files ────────────────────────────────────────────────────

router.post(['/builder/generate', '/builder/stream'], async (req, res) => {
  const { prompt, plan, projectId } = req.body;
  if (!prompt || !projectId) return res.status(400).json({ error: 'prompt and projectId required' });

  const projDir = path.join(PROJECTS_BASE, projectId);
  if (!fs.existsSync(projDir)) {
    return res.status(404).json({ error: 'Project directory not found. Create the project first.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const systemPrompt = `You are an expert MERN stack developer generating a complete, working website.

IMPORTANT: For every file you generate, use this exact format:
\`\`\`javascript:frontend/src/App.jsx
// file content here
\`\`\`

Or for other file types:
\`\`\`json:package.json
{ ... }
\`\`\`

Generate ALL necessary files for a production-ready MERN app including:
- frontend/package.json, frontend/src/App.jsx, frontend/src/main.jsx, frontend/index.html
- frontend/src/components/* (all components)
- frontend/src/pages/* (all pages)  
- frontend/src/context/* (if needed for auth)
- backend/package.json, backend/server.js, backend/.env.example
- backend/routes/* (all API routes)
- backend/models/* (all Mongoose models)
- backend/middleware/auth.js (if auth needed)
- README.md (with setup instructions)

Make all API endpoints actually functional. Use real MongoDB Mongoose schemas.
Use React Router for navigation. Add loading states and error handling everywhere.
Style with clean CSS modules or inline styles — no external CSS frameworks needed.`;

  const userPrompt = plan
    ? `Build this MERN project: ${prompt}\n\nPlan:\n${JSON.stringify(plan, null, 2)}`
    : `Build this MERN project: ${prompt}`;

  let fullText = '';
  const createdFiles: string[] = [];

  try {
    const geminiKey = process.env.GEMINI_API_KEY;

    const onChunk = (text: string) => {
      fullText += text;
      sendEvent({ content: text });

      // Progressive file writing — detect complete code blocks
      const regex = /```(?:[a-zA-Z0-9_-]+):([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\r?\n([\s\S]*?)```/g;
      let match;
      while ((match = regex.exec(fullText)) !== null) {
        const rawPath = match[1].trim();
        const content = match[2];
        const safePath = path.normalize(rawPath).replace(/^(\.\.[\\/])+/, '');
        const targetFile = path.join(projDir, safePath);
        if (!targetFile.startsWith(projDir)) continue;
        if (!createdFiles.includes(safePath)) {
          try {
            fs.mkdirSync(path.dirname(targetFile), { recursive: true });
            fs.writeFileSync(targetFile, content, 'utf-8');
            createdFiles.push(safePath);
            sendEvent({ fileCreated: safePath });
          } catch { /* skip */ }
        }
      }
    };

    await streamChatCompletion(
      [{ role: 'user', content: userPrompt }],
      {
        systemPrompt,
        model: process.env.AI_MODEL || 'gemini-3.8-flash',
        maxTokens: 16384,
        temperature: 0.7,
      },
      {
        onChunk
      }
    );

    // Update project metadata
    const metaFile = path.join(projDir, '.mypersonalai.json');
    try {
      const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf-8')) : {};
      meta.updatedAt = Date.now();
      meta.generatedFiles = createdFiles.length;
      meta.description = prompt.slice(0, 200);
      fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));
    } catch { /* non-fatal */ }

    sendEvent({ done: true, filesCreated: createdFiles });

  } catch (err: any) {
    sendEvent({ error: err.message });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

// ─── Explain a file ────────────────────────────────────────────────────────────

router.post('/builder/explain', async (req, res) => {
  const { filePath, projectId } = req.body;
  if (!filePath || !projectId) return res.status(400).json({ error: 'filePath and projectId required' });

  const projDir = path.join(PROJECTS_BASE, projectId);
  const safePath = path.normalize(filePath).replace(/^(\.\.[\\/])+/, '');
  const targetFile = path.join(projDir, safePath);

  if (!targetFile.startsWith(projDir) || !fs.existsSync(targetFile)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const content = fs.readFileSync(targetFile, 'utf-8').slice(0, 4000);
  const systemPrompt = 'You are Nilesh. Explain code files clearly for a student learning MERN stack.';
  const userPrompt = `Explain this file in simple terms:\n\nFile: ${safePath}\n\`\`\`\n${content}\n\`\`\``;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const sendEvent = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  let explanation = '';

  try {
    await streamChatCompletion(
      [{ role: 'user', content: userPrompt }],
      {
        systemPrompt,
        model: process.env.AI_MODEL || 'gemini-3.8-flash',
        temperature: 0.7,
      },
      {
        onChunk: (c) => { explanation += c; sendEvent({ content: c }); }
      }
    );
    sendEvent({ done: true });
  } catch (err: any) {
    sendEvent({ error: err.message });
  }

  res.write('data: [DONE]\n\n');
  res.end();
});

export default router;
