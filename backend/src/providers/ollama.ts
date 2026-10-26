// src/providers/ollama.ts — High-Performance Ollama provider with Smart Routing & Low-RAM Optimizations
import type { ChatMessage, CompletionResult, ProviderOptions, StreamChatCallbacks } from './types.ts';
import { getSetting } from '../db.ts';

export function getOllamaBaseUrl(): string {
  return process.env.AI_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
}

/**
 * Smart router for local models
 * Dynamically picks between qwen2.5-coder:1.5b and qwen2.5-coder:3b
 * - 1.5B: Greetings, general Q&A, short queries, quick syntax explanations (faster, ~1.2 GB RAM)
 * - 3B: Complex MERN scaffolding, architecture design, multi-file code generation
 */
let currentlyLoadedModel: string | null = null;

export function smartRouteLocalModel(
  lastUserPrompt = '',
  requestedModel?: string,
  installedModels: string[] = []
): string {
  // If user selected a specific model (and not 'auto' or 'smart'), honor it
  if (requestedModel && requestedModel !== 'auto' && requestedModel !== 'smart' && !requestedModel.startsWith('gemini')) {
    return requestedModel;
  }

  const smartRoutingEnabled = getSetting('local_smart_routing', 'true') === 'true';
  const has3B = installedModels.some(m => m.includes('3b'));
  const has15B = installedModels.some(m => m.includes('1.5b'));

  if (!smartRoutingEnabled || !has3B) {
    return has15B ? 'qwen2.5-coder:1.5b' : (installedModels[0] || 'qwen2.5-coder:1.5b');
  }

  const prompt = (lastUserPrompt || '').toLowerCase();

  // Complex coding, multi-file architecture, algorithmic logic -> 3B (if available)
  const isComplex =
    prompt.includes('mern') ||
    prompt.includes('architecture') ||
    prompt.includes('refactor') ||
    prompt.includes('regex') ||
    prompt.includes('database') ||
    prompt.includes('schema') ||
    prompt.includes('docker') ||
    prompt.includes('algorithm') ||
    prompt.includes('full-stack') ||
    prompt.includes('bug') ||
    prompt.includes('function') ||
    prompt.includes('class') ||
    prompt.length > 250 ||
    prompt.includes('```');

  if (isComplex && has3B) {
    return 'qwen2.5-coder:3b';
  }

  // Greetings, simple questions, conversational queries -> 1.5B (faster, lower RAM)
  return 'qwen2.5-coder:1.5b';
}

export function resolveOllamaModel(model?: string, installedModels: string[] = [], lastPrompt = ''): string {
  if (model && model !== 'auto' && model !== 'smart' && !model.startsWith('gemini')) {
    return model;
  }
  return smartRouteLocalModel(lastPrompt, model, installedModels);
}

export async function checkOllamaStatus(): Promise<{ online: boolean; models: string[]; host: string }> {
  const host = getOllamaBaseUrl();
  try {
    const res = await fetch(`${host}/api/tags`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { online: false, models: [], host };
    const data = await res.json() as { models?: Array<{ name: string; model?: string }> };
    const models = (data.models ?? []).map((m) => m.name || m.model || '');
    return { online: true, models, host };
  } catch {
    return { online: false, models: [], host };
  }
}

/**
 * Free memory by immediately unloading a model from RAM
 */
export async function unloadOllamaModel(modelName?: string): Promise<{ success: boolean; message: string }> {
  const host = getOllamaBaseUrl();
  const targetModel = modelName || 'qwen2.5-coder:1.5b';
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: targetModel,
        keep_alive: 0,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      return { success: true, message: `Model ${targetModel} successfully unloaded from RAM.` };
    }
    return { success: false, message: `Failed to unload model: HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, message: `Error unloading model: ${err.message}` };
  }
}

/**
 * Clean up Ollama error messages into human-friendly explanations
 */
function normalizeOllamaError(errText: string, modelName?: string): string {
  if (
    errText.includes('out-of-memory') ||
    errText.includes('unable to allocate CPU buffer') ||
    errText.includes('failed to allocate buffer') ||
    errText.includes('insufficient memory')
  ) {
    return (
      '⚠️ **Local AI Memory Error:** Your computer does not have enough free RAM right now to run this model.\n\n' +
      '**Solutions:**\n' +
      '1. Switch to the smaller lightweight model: **`qwen2.5-coder:1.5b`** (uses only ~1.2 GB RAM).\n' +
      '2. Close background applications to free system RAM.\n' +
      '3. Use the "Free RAM" button in the top bar to unload idle models.'
    );
  }
  if (errText.includes('model not found') || errText.includes('try pulling it first')) {
    return (
      `⚠️ **Model Not Found:** The model \`${modelName || 'requested'}\` is not installed in your local Ollama.\n\n` +
      `Your installed models are: \`qwen2.5-coder:1.5b\` and \`qwen2.5-coder:3b\`.\n` +
      `Please select one of the installed models from the model selector.`
    );
  }
  return `Ollama error: ${errText}`;
}

/**
 * Non-streaming chat completion with Ollama — Optimized with keep_alive & timing metrics
 */
export async function chatOllama(
  messages: ChatMessage[],
  options: ProviderOptions
): Promise<CompletionResult> {
  const host = getOllamaBaseUrl();
  const startTime = Date.now();

  // 1. Verify Ollama connectivity first
  const { online, models } = await checkOllamaStatus();
  if (!online) {
    throw new Error(
      `Could not connect to running Ollama instance at ${host}.\n` +
      `Please verify Ollama is running by opening PowerShell and executing "ollama serve" or "ollama list".`
    );
  }

  // 2. Resolve model via smart routing or explicit selection
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  const model = resolveOllamaModel(options.model, models, lastUserMsg);

  // 3. Verify model existence
  const modelMatches = models.some(m => m === model || m.startsWith(model + ':') || model.startsWith(m + ':'));
  if (models.length > 0 && !modelMatches) {
    throw new Error(
      `The selected model "${model}" is not installed in local Ollama.\n` +
      `Installed models found: ${models.join(', ')}.\n` +
      `Please select an installed model from the model selector.`
    );
  }

  const ollamaMessages = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }));

  if (options.systemPrompt) {
    ollamaMessages.unshift({ role: 'system', content: options.systemPrompt });
  }

  const keepAlive = options.keepAlive || getSetting('ollama_keep_alive', '5m');
  const numPredict = options.numPredict || Number(getSetting('ollama_num_predict', '512')) || 512;
  const numCtx = options.numCtx || Number(getSetting('ollama_num_ctx', '2048')) || 2048;
  const timeoutMs = Number(getSetting('request_timeout', '240')) * 1000 || 240000;
  currentlyLoadedModel = model;

  let response: Response;
  try {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;

    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: false,
        keep_alive: keepAlive,
        options: {
          num_predict: numPredict,
          num_ctx: numCtx,
          temperature: options.temperature ?? 0.7,
        },
      }),
      signal: combinedSignal,
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.message?.includes('timed out')) {
      throw new Error(`Ollama request timed out after ${Math.round(timeoutMs / 1000)} seconds while loading model "${model}".`);
    }
    if (err.name === 'AbortError') {
      throw err;
    }
    throw new Error(`Cannot connect to Ollama at ${host}. Please ensure Ollama is running (\`ollama serve\`).`);
  }

  if (!response.ok) {
    const txt = await response.text().catch(() => response.statusText);
    console.error(`[Ollama Error] HTTP ${response.status}: ${txt}`);
    throw new Error(normalizeOllamaError(txt, model));
  }

  const data = await response.json() as any;
  const content = data.message?.content ?? '';
  const tokensUsed = data.eval_count ?? 0;
  const elapsedMs = Date.now() - startTime;
  const loadTimeMs = data.load_duration ? Math.round(data.load_duration / 1e6) : 0;
  const evalTimeMs = data.eval_duration ? Math.round(data.eval_duration / 1e6) : elapsedMs;
  const tokensPerSec = evalTimeMs > 0 && tokensUsed > 0 ? ((tokensUsed / evalTimeMs) * 1000).toFixed(1) : undefined;

  if (!content || !content.trim()) {
    throw new Error(`Ollama returned an empty response for model "${model}". Please retry your message.`);
  }

  console.log(
    `[Ollama] Chat success: model="${model}", tokens=${tokensUsed}, time=${elapsedMs}ms, load=${loadTimeMs}ms, eval=${evalTimeMs}ms (${tokensPerSec ?? '0'} t/s)`
  );

  return {
    content,
    tokensUsed,
    model,
    provider: 'ollama',
    loadTimeMs,
    evalTimeMs,
    tokensPerSecond: tokensPerSec,
  };
}

/**
 * Streaming completion with Ollama — Optimized with keep_alive, options & timing metrics
 */
export async function streamOllama(
  messages: ChatMessage[],
  options: ProviderOptions,
  callbacks: StreamChatCallbacks
): Promise<{
  tokensUsed: number;
  fullResponse: string;
  model: string;
  loadTimeMs?: number;
  evalTimeMs?: number;
  tokensPerSecond?: string;
}> {
  const host = getOllamaBaseUrl();
  const startTime = Date.now();

  // 1. Verify Ollama connectivity first
  const { online, models } = await checkOllamaStatus();
  if (!online) {
    throw new Error(
      `Could not connect to running Ollama instance at ${host}.\n` +
      `Please verify Ollama is running by opening PowerShell and executing "ollama serve" or "ollama list".`
    );
  }

  // 2. Resolve model via smart routing or explicit selection
  const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || '';
  const model = resolveOllamaModel(options.model, models, lastUserMsg);

  // 3. Verify model existence
  const modelMatches = models.some(m => m === model || m.startsWith(model + ':') || model.startsWith(m + ':'));
  if (models.length > 0 && !modelMatches) {
    throw new Error(
      `The selected model "${model}" is not installed in local Ollama.\n` +
      `Installed models found: ${models.join(', ')}.\n` +
      `Please select an installed model from the model selector.`
    );
  }

  const ollamaMessages = messages.map(m => ({
    role: m.role === 'model' ? 'assistant' : m.role,
    content: m.content,
  }));

  if (options.systemPrompt) {
    ollamaMessages.unshift({ role: 'system', content: options.systemPrompt });
  }

  const keepAlive = options.keepAlive || getSetting('ollama_keep_alive', '5m');
  const numPredict = options.numPredict || Number(getSetting('ollama_num_predict', '512')) || 512;
  const numCtx = options.numCtx || Number(getSetting('ollama_num_ctx', '2048')) || 2048;
  const timeoutMs = Number(getSetting('request_timeout', '240')) * 1000 || 240000;
  currentlyLoadedModel = model;

  let response: Response;
  try {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const combinedSignal = callbacks.signal ? AbortSignal.any([callbacks.signal, timeoutSignal]) : timeoutSignal;

    response = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: ollamaMessages,
        stream: true,
        keep_alive: keepAlive,
        options: {
          num_predict: numPredict,
          num_ctx: numCtx,
          temperature: options.temperature ?? 0.7,
        },
      }),
      signal: combinedSignal,
    });
  } catch (err: any) {
    if (err.name === 'TimeoutError' || err.message?.includes('timed out')) {
      throw new Error(`Ollama streaming request timed out after ${Math.round(timeoutMs / 1000)} seconds while loading model "${model}".`);
    }
    if (err.name === 'AbortError') throw err;
    throw new Error(`Cannot connect to Ollama at ${host}. Please ensure Ollama is running (\`ollama serve\`).`);
  }

  if (!response.ok || !response.body) {
    const txt = await response.text().catch(() => response.statusText);
    console.error(`[Ollama Stream Error] HTTP ${response.status}: ${txt}`);
    throw new Error(normalizeOllamaError(txt, model));
  }

  const reader = (response.body as any).getReader();
  const decoder = new TextDecoder();
  let tokensUsed = 0;
  let fullResponse = '';
  let buffer = '';
  let loadTimeMs = 0;
  let evalTimeMs = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed.message?.content) {
          const delta = parsed.message.content;
          fullResponse += delta;
          callbacks.onChunk(delta);
        }
        if (parsed.done) {
          if (parsed.eval_count) tokensUsed = parsed.eval_count;
          if (parsed.load_duration) loadTimeMs = Math.round(parsed.load_duration / 1e6);
          if (parsed.eval_duration) evalTimeMs = Math.round(parsed.eval_duration / 1e6);
        }
      } catch {
        // partial JSON chunk — continue
      }
    }
  }

  const elapsedMs = Date.now() - startTime;
  if (!evalTimeMs) evalTimeMs = elapsedMs;
  const tokensPerSec = evalTimeMs > 0 && tokensUsed > 0 ? ((tokensUsed / evalTimeMs) * 1000).toFixed(1) : undefined;

  console.log(
    `[Ollama Stream Finished] model="${model}", tokens=${tokensUsed}, time=${elapsedMs}ms, load=${loadTimeMs}ms, eval=${evalTimeMs}ms (${tokensPerSec ?? '0'} t/s)`
  );

  return {
    tokensUsed,
    fullResponse,
    model,
    loadTimeMs,
    evalTimeMs,
    tokensPerSecond: tokensPerSec,
  };
}
