// src/routes/knowledge.ts — Knowledge base management & local RAG search
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { db } from '../db.ts';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_BASE = path.resolve(__dirname, '../../../knowledge');

// ─── List all knowledge sources ───────────────────────────────────────────────

router.get('/knowledge', (_req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM knowledge_sources ORDER BY created_at DESC').all();
    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Add new knowledge source ─────────────────────────────────────────────────

router.post('/knowledge', (req, res) => {
  const { name, type = 'note', url, content, tags = '' } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const id = crypto.randomUUID();
  const now = Date.now();

  try {
    // If it's a note or file with content, also save to filesystem for RAG search
    let savedPath = '';
    if (content) {
      const targetDir = path.join(KNOWLEDGE_BASE, 'notes');
      fs.mkdirSync(targetDir, { recursive: true });
      const safeName = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const filename = `${safeName}-${id.slice(0, 6)}.md`;
      savedPath = path.join(targetDir, filename);
      fs.writeFileSync(savedPath, `# ${name}\n\nTags: ${tags}\n\n${content}`, 'utf-8');
    }

    db.prepare(`
      INSERT INTO knowledge_sources (id, name, type, url, content, path, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, type, url || null, content || null, savedPath || null, tags, now, now);

    const created = db.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(id);
    res.status(201).json(created);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete knowledge source ──────────────────────────────────────────────────

router.delete('/knowledge/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM knowledge_sources WHERE id = ?').get(req.params.id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Knowledge source not found' });
    }

    // Delete file if on disk
    if (existing.path && fs.existsSync(existing.path)) {
      try { fs.unlinkSync(existing.path); } catch {}
    }

    db.prepare('DELETE FROM knowledge_sources WHERE id = ?').run(req.params.id);
    res.json({ success: true, deleted: req.params.id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Search local documents and code examples (RAG) ───────────────────────────

router.get('/knowledge/search', (req, res) => {
  const query = (req.query.q as string || '').toLowerCase().trim();
  if (!query) {
    return res.json([]);
  }

  const results: { file: string; excerpt: string; score: number }[] = [];
  const folders = ['docs', 'code_examples', 'notes'];

  for (const folder of folders) {
    const dir = path.join(KNOWLEDGE_BASE, folder);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (!fs.statSync(fullPath).isFile()) continue;

      const content = fs.readFileSync(fullPath, 'utf-8');
      const lowerContent = content.toLowerCase();

      // Simple keyword matching and scoring
      const queryTerms = query.split(/\s+/).filter(Boolean);
      let matchCount = 0;
      for (const term of queryTerms) {
        if (lowerContent.includes(term)) matchCount++;
      }

      if (matchCount > 0) {
        const firstMatchIndex = lowerContent.indexOf(queryTerms[0]);
        const start = Math.max(0, firstMatchIndex - 60);
        const excerpt = content.substring(start, start + 240).replace(/\s+/g, ' ');

        results.push({
          file: `${folder}/${file}`,
          excerpt: `...${excerpt}...`,
          score: matchCount / queryTerms.length
        });
      }
    }
  }

  // Also search database notes
  try {
    const dbNotes = db.prepare('SELECT * FROM knowledge_sources WHERE content IS NOT NULL').all() as any[];
    const queryTerms = query.split(/\s+/).filter(Boolean);

    for (const note of dbNotes) {
      const lower = (note.name + ' ' + note.content + ' ' + (note.tags || '')).toLowerCase();
      let matchCount = 0;
      for (const term of queryTerms) {
        if (lower.includes(term)) matchCount++;
      }
      if (matchCount > 0) {
        results.push({
          file: `DB: ${note.name}`,
          excerpt: (note.content || '').slice(0, 200),
          score: matchCount / queryTerms.length
        });
      }
    }
  } catch {}

  results.sort((a, b) => b.score - a.score);
  res.json(results.slice(0, 10));
});

export default router;
