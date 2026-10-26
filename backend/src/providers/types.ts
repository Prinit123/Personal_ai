// src/providers/types.ts — Common types for AI providers

export type Role = 'user' | 'assistant' | 'system' | 'model';

export interface ChatMessage {
  role: Role;
  content: string;
  images?: Array<{ mimeType: string; data: string }>;
}

export interface ProviderOptions {
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  numPredict?: number;
  numCtx?: number;
  keepAlive?: string | number;
  signal?: AbortSignal;
}

export interface StreamChatCallbacks {
  onChunk: (text: string) => void;
  signal?: AbortSignal;
}

export interface CompletionResult {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: string;
  loadTimeMs?: number;
  evalTimeMs?: number;
  tokensPerSecond?: string;
  cached?: boolean;
}

export interface ProviderStatus {
  provider: string;
  ok: boolean;
  message: string;
  model?: string;
  availableModels?: string[];
  elapsedMs?: number;
}
