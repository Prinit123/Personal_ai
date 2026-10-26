// src/routes/settings.ts — Settings, Configuration & Diagnostic Status API
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSetting, setSetting, getAllSettings } from '../db.ts';
import { testProvider, resolveActiveProvider, checkInternetConnectivity } from '../providers/index.ts';
import { checkOllamaStatus } from '../providers/ollama.ts';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.resolve(__dirname, '../../../.env');

// ── GET /api/settings ─────────────────────────────────────────────────────────

router.get('/settings', async (_req, res) => {
  try {
    const settings = getAllSettings();
    const safe: Record<string, string> = { ...settings };

    const configuredProvider = settings.ai_provider || process.env.AI_PROVIDER || 'auto';
    const resolvedProvider = await resolveActiveProvider(configuredProvider);

    safe['ai_provider'] = configuredProvider;
    safe['resolved_provider'] = resolvedProvider;
    safe['ai_model'] = process.env.AI_MODEL || settings.ai_model || (resolvedProvider === 'gemini' ? 'gemini-3.8-flash' : 'qwen2.5-coder:1.5b');
    safe['gemini_configured'] = (!!process.env.AI_API_KEY || !!process.env.GEMINI_API_KEY) ? 'true' : 'false';
    safe['ollama_base_url'] = process.env.AI_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
    safe['theme'] = settings.theme || 'dark';

    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/settings — Update preferences ────────────────────────────────────

router.post('/settings', (req, res) => {
  try {
    const { key, value, settings } = req.body;

    if (settings && typeof settings === 'object') {
      for (const [k, v] of Object.entries(settings)) {
        if (v !== undefined) {
          setSetting(k, String(v));
          if (k === 'ai_provider') process.env.AI_PROVIDER = String(v);
          if (k === 'ai_model') process.env.AI_MODEL = String(v);
        }
      }
      return res.json({ ok: true, settings });
    }

    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }

    if (key === 'ai_provider') {
      process.env.AI_PROVIDER = String(value);
    }
    if (key === 'ai_model') {
      process.env.AI_MODEL = String(value);
    }

    setSetting(key, String(value));
    res.json({ ok: true, key, value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/settings/save-key — Securely update API key in .env and memory ───

router.post('/settings/save-key', (req, res) => {
  const { apiKey, provider = 'gemini' } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
    return res.status(400).json({ error: 'Valid API key is required' });
  }

  const cleanKey = apiKey.trim();

  // 1. Update in-memory environment variables immediately
  process.env.AI_API_KEY = cleanKey;
  if (provider === 'gemini') {
    process.env.GEMINI_API_KEY = cleanKey;
    process.env.AI_PROVIDER = 'gemini';
    setSetting('ai_provider', 'gemini');
    setSetting('online_enabled', 'true');
  } else if (provider === 'groq') {
    process.env.GROQ_API_KEY = cleanKey;
    process.env.AI_PROVIDER = 'groq';
    setSetting('ai_provider', 'groq');
  } else {
    process.env.OPENAI_API_KEY = cleanKey;
    process.env.AI_PROVIDER = provider;
    setSetting('ai_provider', provider);
  }

  // 2. Persist to project root .env file
  try {
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf-8');
    }

    const updateOrAppend = (content: string, keyName: string, val: string) => {
      const regex = new RegExp(`^${keyName}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${keyName}=${val}`);
      }
      return content.trim() + `\n${keyName}=${val}\n`;
    };

    envContent = updateOrAppend(envContent, 'AI_API_KEY', cleanKey);
    if (provider === 'gemini') {
      envContent = updateOrAppend(envContent, 'GEMINI_API_KEY', cleanKey);
      envContent = updateOrAppend(envContent, 'AI_PROVIDER', 'gemini');
    }

    fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
    return res.json({
      ok: true,
      provider,
      message: `${provider.toUpperCase()} API key saved and activated successfully.`,
    });
  } catch (err: any) {
    console.error('[settings] Failed to write .env:', err);
    return res.json({
      ok: true,
      provider,
      message: 'API key activated for this session (could not update .env on disk).',
    });
  }
});

// ── POST /api/settings/test-provider — Test AI provider connectivity ───────────

router.post('/settings/test-provider', async (req, res) => {
  const { provider = 'auto', model, apiKey } = req.body;
  try {
    const result = await testProvider(provider, model, apiKey);
    res.json(result);
  } catch (err: any) {
    res.json({
      provider,
      ok: false,
      message: err.message || 'Diagnostic test failed',
    });
  }
});

// ── GET /api/status — Comprehensive system diagnostic ──────────────────────────

router.get('/status', async (_req, res) => {
  const { online: ollamaOnline, models: ollamaModels } = await checkOllamaStatus();
  const internetOnline = await checkInternetConnectivity();

  const savedProvider = getSetting('ai_provider', 'auto');
  const activeProvider = await resolveActiveProvider(savedProvider);
  const geminiConfigured = !!(process.env.AI_API_KEY || process.env.GEMINI_API_KEY);
  const memoryEnabled = getSetting('memory_enabled', 'true') === 'true';
  const cacheEnabled = getSetting('cache_enabled', 'true') === 'true';

  res.json({
    backend: 'online',
    configuredProvider: savedProvider,
    activeProvider,
    activeModel: process.env.AI_MODEL || (activeProvider === 'gemini' ? 'gemini-3.8-flash' : 'qwen2.5-coder:1.5b'),
    gemini: geminiConfigured ? 'configured' : 'not-configured',
    ollama: ollamaOnline ? 'online' : 'offline',
    ollamaModels,
    internet: internetOnline ? 'online' : 'offline',
    memoryEnabled,
    cacheEnabled,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

export default router;
