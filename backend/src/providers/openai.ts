// src/providers/openai.ts — OpenAI-compatible provider (Groq, OpenRouter, OpenAI, LocalAI, LM Studio)
import type { ChatMessage, CompletionResult, ProviderOptions, StreamChatCallbacks } from './types.ts';

export function getOpenAIBaseUrl(): string {
  const custom = process.env.AI_BASE_URL;
  if (custom) return custom.replace(/\/+$/, '');
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  if (provider === 'groq') return 'https://api.groq.com/openai/v1';
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  return 'https://api.openai.com/v1';
}

export function getOpenAIApiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY;
}

export function resolveOpenAIModel(model?: string): string {
  if (model && model !== 'auto') return model;
  const provider = (process.env.AI_PROVIDER || '').toLowerCase();
  if (provider === 'groq') return process.env.AI_MODEL || 'llama-3.3-70b-versatile';
  if (provider === 'openrouter') return process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct';
  return process.env.AI_MODEL || 'gpt-4o-mini';
}

/**
 * Format messages into OpenAI format, prepending system prompt if given
 */
function formatOpenAIMessages(messages: ChatMessage[], systemPrompt?: string) {
  const result: Array<{ role: string; content: string }> = [];
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }
  for (const m of messages) {
    result.push({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    });
  }
  return result;
}

/**
 * Stream chat completions from OpenAI-compatible API
 */
export async function streamOpenAI(
  messages: ChatMessage[],
  options: ProviderOptions,
  callbacks: StreamChatCallbacks
): Promise<{ tokensUsed: number; fullResponse: string }> {
  const baseUrl = getOpenAIBaseUrl();
  const apiKey = getOpenAIApiKey();
  const model = resolveOpenAIModel(options.model);
  const formattedMessages = formatOpenAIMessages(messages, options.systemPrompt);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      stream: true,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    }),
    signal: callbacks.signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI API Error (${response.status}): ${errorText}`);
  }

  const reader = (response.body as any).getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let tokensUsed = 0;
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === '[DONE]') break;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          fullResponse += delta;
          callbacks.onChunk(delta);
        }
        if (parsed.usage?.total_tokens) {
          tokensUsed = parsed.usage.total_tokens;
        }
      } catch {
        // partial json
      }
    }
  }

  return { tokensUsed, fullResponse };
}

/**
 * Non-streaming chat completion from OpenAI-compatible API
 */
export async function chatOpenAI(
  messages: ChatMessage[],
  options: ProviderOptions
): Promise<CompletionResult> {
  const baseUrl = getOpenAIBaseUrl();
  const apiKey = getOpenAIApiKey();
  const model = resolveOpenAIModel(options.model);
  const formattedMessages = formatOpenAIMessages(messages, options.systemPrompt);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: formattedMessages,
      stream: false,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
    }),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`OpenAI API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content ?? '';
  const tokensUsed = data.usage?.total_tokens ?? 0;

  return {
    content,
    tokensUsed,
    model,
    provider: 'openai',
  };
}

/**
 * Test connection to OpenAI-compatible provider
 */
export async function testOpenAIConnection(
  apiKey?: string,
  model?: string
): Promise<{ ok: boolean; model: string; message: string; elapsedMs: number }> {
  const start = Date.now();
  const baseUrl = getOpenAIBaseUrl();
  const key = apiKey || getOpenAIApiKey();
  const targetModel = resolveOpenAIModel(model);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) headers['Authorization'] = `Bearer ${key}`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: targetModel,
        messages: [{ role: 'user', content: 'Say "READY" in one word.' }],
        max_tokens: 10,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const err = await res.text();
      return {
        ok: false,
        model: targetModel,
        message: `HTTP ${res.status}: ${err}`,
        elapsedMs: Date.now() - start,
      };
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? 'OK';
    return {
      ok: true,
      model: targetModel,
      message: `Connected successfully! Response: "${text.trim()}"`,
      elapsedMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      model: targetModel,
      message: err.message || 'Connection failed',
      elapsedMs: Date.now() - start,
    };
  }
}
