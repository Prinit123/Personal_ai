// src/providers/index.ts — Unified AI Provider Router with Intelligent Auto Switching
import { streamGemini, chatGemini, testGeminiConnection, getGeminiApiKey } from './gemini.ts';
import { streamOpenAI, chatOpenAI, testOpenAIConnection, getOpenAIApiKey } from './openai.ts';
import { streamOllama, chatOllama, checkOllamaStatus } from './ollama.ts';
import { getSetting } from '../db.ts';
import type {
  ChatMessage,
  CompletionResult,
  ProviderOptions,
  StreamChatCallbacks,
  ProviderStatus,
} from './types.ts';

export * from './types.ts';

export type SupportedProvider = 'gemini' | 'openai' | 'groq' | 'openrouter' | 'ollama' | 'auto';

/**
 * Check if the machine currently has active internet connectivity
 */
export async function checkInternetConnectivity(): Promise<boolean> {
  try {
    const res = await fetch('https://dns.google/resolve?name=google.com&type=A', {
      signal: AbortSignal.timeout(1800),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Detect the active provider based on settings, explicit requests, and availability.
 * When 'auto' is selected:
 * 1. Checks if online access is permitted (online_enabled setting)
 * 2. Checks if a valid Gemini API key is configured in .env
 * 3. Tests if internet access is actually reachable
 * 4. Only if all three pass, selects 'gemini'; otherwise uses local 'ollama'.
 */
export async function resolveActiveProvider(requested?: string): Promise<'gemini' | 'ollama' | 'openai' | 'groq' | 'openrouter'> {
  const req = (requested || '').toLowerCase();

  if (req === 'gemini') return 'gemini';
  if (req === 'ollama') return 'ollama';
  if (req === 'openai') return 'openai';
  if (req === 'groq') return 'groq';
  if (req === 'openrouter') return 'openrouter';

  // If specific manual provider is stored in DB/env and not 'auto'
  const savedProvider = (getSetting('ai_provider', process.env.AI_PROVIDER || 'auto')).toLowerCase();
  if (savedProvider && savedProvider !== 'auto') {
    if (['gemini', 'ollama', 'openai', 'groq', 'openrouter'].includes(savedProvider)) {
      return savedProvider as any;
    }
  }

  // AUTO MODE LOGIC:
  // Strict check: Is online mode enabled by user?
  const onlineEnabled = getSetting('online_enabled', 'false') === 'true';
  const hasGeminiKey = !!getGeminiApiKey();

  if (onlineEnabled && hasGeminiKey) {
    const hasInternet = await checkInternetConnectivity();
    if (hasInternet) {
      return 'gemini';
    }
  }

  // Fallback to local Ollama
  return 'ollama';
}

/**
 * Synchronous provider resolver for backward compatibility
 */
export function getActiveProvider(requested?: string): 'gemini' | 'ollama' | 'openai' | 'groq' | 'openrouter' {
  if (requested && requested !== 'auto') {
    return requested.toLowerCase() as any;
  }
  const configured = (process.env.AI_PROVIDER || getSetting('ai_provider', 'auto')).toLowerCase();
  if (configured === 'gemini' || configured === 'google') return 'gemini';
  if (configured === 'groq') return 'groq';
  if (configured === 'openrouter') return 'openrouter';
  if (configured === 'openai') return 'openai';
  if (configured === 'ollama' || configured === 'local') return 'ollama';

  // Default to ollama for strict offline privacy when not explicitly set
  return 'ollama';
}

/**
 * Stream chat completion using the requested or auto-detected provider
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  options: ProviderOptions,
  callbacks: StreamChatCallbacks,
  providerOverride?: string
): Promise<{
  tokensUsed: number;
  fullResponse: string;
  provider: string;
  model: string;
  loadTimeMs?: number;
  evalTimeMs?: number;
  tokensPerSecond?: string;
}> {
  const provider = await resolveActiveProvider(providerOverride);

  if (provider === 'gemini') {
    try {
      const res = await streamGemini(messages, options, callbacks);
      return {
        ...res,
        provider: 'gemini',
        model: options.model || 'gemini-3.8-flash',
      };
    } catch (err: any) {
      // If Auto mode was requested and Gemini failed (rate limit, quota, network drop), fall back to local Ollama
      if (providerOverride === 'auto' || !providerOverride) {
        const { online } = await checkOllamaStatus();
        if (online) {
          console.warn(`[provider] Gemini failed in Auto mode (${err.message}). Falling back to local Ollama.`);
          const res = await streamOllama(messages, options, callbacks);
          return { ...res, provider: 'ollama' };
        }
      }
      throw err;
    }
  }

  if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
    const res = await streamOpenAI(messages, options, callbacks);
    return {
      ...res,
      provider,
      model: options.model || provider,
    };
  }

  if (provider === 'ollama') {
    const res = await streamOllama(messages, options, callbacks);
    return { ...res, provider: 'ollama' };
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

/**
 * Non-streaming chat completion using the requested or auto-detected provider
 */
export async function chatCompletion(
  messages: ChatMessage[],
  options: ProviderOptions,
  providerOverride?: string
): Promise<CompletionResult> {
  const provider = await resolveActiveProvider(providerOverride);

  if (provider === 'gemini') {
    try {
      return await chatGemini(messages, options);
    } catch (err: any) {
      if (providerOverride === 'auto' || !providerOverride) {
        const { online } = await checkOllamaStatus();
        if (online) {
          console.warn(`[provider] Gemini failed in Auto mode (${err.message}). Falling back to local Ollama.`);
          return await chatOllama(messages, options);
        }
      }
      throw err;
    }
  }

  if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
    return chatOpenAI(messages, options);
  }

  if (provider === 'ollama') {
    return chatOllama(messages, options);
  }

  throw new Error(`Unsupported AI provider: ${provider}`);
}

/**
 * Diagnostic test for any provider
 */
export async function testProvider(
  provider: string,
  model?: string,
  apiKey?: string
): Promise<ProviderStatus> {
  const targetProvider = provider.toLowerCase();

  if (targetProvider === 'auto') {
    const resolved = await resolveActiveProvider('auto');
    const res = await testProvider(resolved, model, apiKey);
    if (!res.ok && resolved === 'gemini') {
      console.warn(`[Auto Mode] Gemini test failed (${res.message}). Auto-fallback to local Ollama.`);
      const ollamaRes = await testProvider('ollama', model);
      return {
        ...ollamaRes,
        message: `[Auto Mode Fallback to OLLAMA]: Gemini unavailable (${res.message.slice(0, 100)}...). Fallback to local Ollama: ${ollamaRes.message}`,
      };
    }
    return {
      ...res,
      message: `[Auto Mode Resolved to ${resolved.toUpperCase()}]: ${res.message}`,
    };
  }

  if (targetProvider === 'gemini') {
    const res = await testGeminiConnection(apiKey, model);
    return { provider: 'gemini', ...res };
  }

  if (targetProvider === 'openai' || targetProvider === 'groq' || targetProvider === 'openrouter') {
    const res = await testOpenAIConnection(apiKey, model);
    return { provider: targetProvider, ...res };
  }

  if (targetProvider === 'ollama') {
    const start = Date.now();
    const { online, models, host } = await checkOllamaStatus();
    return {
      provider: 'ollama',
      ok: online,
      message: online
        ? `Ollama is running at ${host}. Installed models: ${models.join(', ') || 'none'}`
        : `Ollama is not reachable at ${host}. Start it with: ollama serve`,
      availableModels: models,
      elapsedMs: Date.now() - start,
    };
  }

  return {
    provider,
    ok: false,
    message: `Unknown provider: ${provider}`,
  };
}
