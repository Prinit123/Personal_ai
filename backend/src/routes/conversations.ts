// src/routes/conversations.ts — Full conversation CRUD with message persistence
import { Router } from 'express';
import { db } from '../db.ts';
import { randomUUID } from 'crypto';

const router = Router();

// ── List all conversations ────────────────────────────────────────────────────
router.get('/conversations', (_req, res) => {
  try {
    const convs = db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
      LIMIT 100
    `).all();
    res.json(convs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create conversation ────────────────────────────────────────────────────────
router.post('/conversations', (req, res) => {
  try {
    const { title = 'New Chat', project_id, model, provider } = req.body;
    const id = randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at, project_id, model, provider)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, title, now, now, project_id ?? null, model ?? null, provider ?? 'ollama');
    res.status(201).json({ id, title, created_at: now, updated_at: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Get single conversation with messages ─────────────────────────────────────
router.get('/conversations/:id', (req, res) => {
  try {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(req.params.id);
    res.json({ ...conv as object, messages });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Rename conversation ───────────────────────────────────────────────────────
router.patch('/conversations/:id', (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(title.trim(), Date.now(), req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Delete conversation ───────────────────────────────────────────────────────
router.delete('/conversations/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Add message to conversation ───────────────────────────────────────────────
router.post('/conversations/:id/messages', (req, res) => {
  try {
    const { role, content, search_results, tokens_used } = req.body;
    const id = randomUUID();
    const now = Date.now();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at, search_results, tokens_used)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, role, content, now, search_results ? JSON.stringify(search_results) : null, tokens_used ?? 0);
    // Update conversation's updated_at
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, req.params.id);
    res.status(201).json({ id, created_at: now });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Export conversation as markdown ──────────────────────────────────────────
router.get('/conversations/:id/export', (req, res) => {
  try {
    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id) as any;
    if (!conv) return res.status(404).json({ error: 'Not found' });
    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(req.params.id) as any[];

    let md = `# ${conv.title}\n\n*Exported from Nilesh — ${new Date().toLocaleDateString()}*\n\n---\n\n`;
    for (const m of messages) {
      const label = m.role === 'user' ? '**You**' : m.role === 'assistant' ? '**Nilesh**' : `**${m.role}**`;
      md += `${label}\n\n${m.content}\n\n---\n\n`;
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${conv.title.replace(/[^a-z0-9]/gi, '_')}.md"`);
    res.send(md);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
