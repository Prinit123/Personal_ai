import { Router } from 'express';
import { checkOllamaStatus } from '../providers/ollama.ts';
import { getActiveProvider } from '../providers/index.ts';

const router = Router();

router.get('/health', async (_req, res) => {
  const ollama = await checkOllamaStatus();
  const activeProvider = getActiveProvider();
  const activeModel = process.env.AI_MODEL || (activeProvider === 'gemini' ? 'gemini-3.8-flash' : 'qwen2.5-coder:1.5b');

  res.json({
    status: 'ok',
    backend: 'online',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    app: 'MyPersonalAI',
    activeProvider,
    activeModel,
    ollama: {
      online: ollama.online,
      host: ollama.host,
      models: ollama.models,
      count: ollama.models.length,
    },
    memory: {
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
  });
});

export default router;
