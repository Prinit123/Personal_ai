import { Router } from 'express';
import http from 'http';

const router = Router();
const OLLAMA_HOST = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

router.get('/ollama/status', async (_req, res) => {
  try {
    const url = new URL('/api/tags', OLLAMA_HOST);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timer);

    if (response.ok) {
      const data = await response.json();
      return res.json({ status: 'ok', models: data.models || [] });
    }
    return res.status(503).json({ status: 'error', message: 'Ollama service returned non-200 status' });
  } catch (err: any) {
    return res.status(503).json({ status: 'offline', message: err.message || 'Cannot connect to Ollama' });
  }
});

router.post('/ollama/pull', async (req, res) => {
  const { model } = req.body;
  if (!model) {
    return res.status(400).json({ error: 'Model name required' });
  }

  try {
    const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model })
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to start pull' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (!response.body) {
      return res.status(500).json({ error: 'No response body from Ollama' });
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      res.write(`data: ${text}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ollama/ps', async (_req, res) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/ps`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    return res.json({ models: [] });
  } catch (err: any) {
    return res.status(503).json({ error: err.message || 'Cannot query Ollama ps' });
  }
});

router.post('/ollama/unload', async (req, res) => {
  const { model } = req.body;
  try {
    const targetModel = model || 'qwen2.5-coder:1.5b';
    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: targetModel, keep_alive: 0 }),
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      return res.json({ success: true, message: `Model ${targetModel} unloaded from RAM.` });
    }
    return res.status(response.status).json({ error: 'Failed to unload model' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
