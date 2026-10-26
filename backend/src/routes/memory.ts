// src/routes/memory.ts — Temporary Memory & Repeated-Question Cache Management API
import { Router } from 'express';
import {
  getActiveMemories,
  saveMemory,
  deleteMemory,
  clearAllMemories,
  getCacheStats,
  clearResponseCache,
  getSetting,
  setSetting,
} from '../db.ts';

const router = Router();

// ── Memory Endpoints ──────────────────────────────────────────────────────────

/**
 * GET /api/memory — Fetch active (unexpired) temporary personal memories
 */
router.get('/memory', (_req, res) => {
  try {
    const memoryEnabled = getSetting('memory_enabled', 'true') === 'true';
    const memories = getActiveMemories();
    res.json({
      enabled: memoryEnabled,
      count: memories.length,
      memories,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch memories' });
  }
});

/**
 * POST /api/memory — Manually save or update a temporary memory
 */
router.post('/memory', (req, res) => {
  try {
    const { key, content, category = 'preference', ttlDays } = req.body;
    if (!key || !content) {
      return res.status(400).json({ error: 'Both "key" and "content" are required' });
    }

    const defaultTtl = Number(getSetting('memory_ttl_days', '7')) || 7;
    const finalTtl = typeof ttlDays === 'number' && ttlDays > 0 ? ttlDays : defaultTtl;

    const saved = saveMemory(key, content, category, finalTtl);
    if (!saved) {
      return res.status(400).json({
        error: 'Memory rejected: contains sensitive information (passwords, tokens, or keys) or exceeds limits.',
      });
    }

    res.json({
      ok: true,
      message: 'Memory saved successfully (expires in ' + finalTtl + ' days)',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to save memory' });
  }
});

/**
 * DELETE /api/memory/:id — Delete a specific memory item
 */
router.delete('/memory/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = deleteMemory(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Memory item not found' });
    }
    res.json({ ok: true, message: 'Memory item deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete memory' });
  }
});

/**
 * DELETE /api/memory — Clear all temporary memories
 */
router.delete('/memory', (_req, res) => {
  try {
    const count = clearAllMemories();
    res.json({ ok: true, cleared: count, message: `Cleared ${count} temporary memory items.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear memories' });
  }
});

// ── Response Cache Endpoints ──────────────────────────────────────────────────

/**
 * GET /api/cache/stats — Get response cache statistics
 */
router.get('/cache/stats', (_req, res) => {
  try {
    const stats = getCacheStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to get cache stats' });
  }
});

/**
 * DELETE /api/cache — Clear cached answers
 */
router.delete('/cache', (_req, res) => {
  try {
    const count = clearResponseCache();
    res.json({ ok: true, cleared: count, message: `Cleared ${count} cached answers.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to clear cache' });
  }
});

export default router;
