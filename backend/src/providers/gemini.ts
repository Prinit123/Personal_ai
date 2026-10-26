// src/providers/gemini.ts — Google Gemini AI Provider using official @google/genai SDK
import { GoogleGenAI } from '@google/genai';
import type { ChatMessage, CompletionResult, ProviderOptions, StreamChatCallbacks } from './types.ts';

export function getGeminiApiKey(): string | undefined {
  return process.env.AI_API_KEY || process.env.GEMINI_API_KEY;
}

export function createGeminiClient(apiKey?: string): GoogleGenAI {
  const key = apiKey || getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY or AI_API_KEY is not configured. Please add it to your .env file or settings.');
  }
  return new GoogleGenAI({ apiKey: key });
}

export const RELIABLE_GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-2.5-flash-lite',
  'gemini-pro-latest',
];

export function resolveGeminiModel(model?: string): string {
  if (!model || model === 'gemini-online' || model === 'auto' || model === 'gemini-1.5-flash' || model === 'gemini-2.0-flash' || model === 'gemini-2.5-flash' || model === 'gemini-3.5-flash') {
    const envModel = process.env.AI_MODEL;
    if (envModel && envModel.startsWith('gemini') && RELIABLE_GEMINI_MODELS.includes(envModel)) {
      return envModel;
    }
    return 'gemini-3.8-flash';
  }
  return model;
}

/**
 * Format messages for the Google GenAI SDK contents array
 */
function formatGeminiContents(messages: ChatMessage[]) {
  return messages.map(m => {
    const parts: any[] = [{ text: m.content || ' ' }];
    if (m.images && Array.isArray(m.images)) {
      for (const img of m.images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.data,
          },
        });
      }
    }
    return {
      role: m.role === 'user' ? 'user' : 'model',
      parts,
    };
  });
}

/**
 * Streaming chat completion with Google Gemini
 */
export async function streamGemini(
  messages: ChatMessage[],
  options: ProviderOptions,
  callbacks: StreamChatCallbacks
): Promise<{ tokensUsed: number; fullResponse: string }> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Google Gemini API key is missing. Please configure AI_API_KEY or GEMINI_API_KEY in .env.');
  }

  const ai = createGeminiClient(apiKey);
  const primaryModel = resolveGeminiModel(options.model);
  const modelsToTry = [primaryModel, ...RELIABLE_GEMINI_MODELS.filter(m => m !== primaryModel)];
  const contents = formatGeminiContents(messages);

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    let tokensUsed = 0;
    let fullResponse = '';
    let hasYielded = false;

    try {
      const streamResult = await ai.models.generateContentStream({
        model: currentModel,
        contents,
        config: {
          systemInstruction: options.systemPrompt,
          maxOutputTokens: options.maxTokens ?? 8192,
          temperature: options.temperature ?? 0.7,
        },
      });

      for await (const chunk of streamResult) {
        if (callbacks.signal?.aborted) break;
        const text = chunk.text ?? '';
        if (text) {
          hasYielded = true;
          fullResponse += text;
          callbacks.onChunk(text);
        }
        if (chunk.usageMetadata) {
          tokensUsed = chunk.usageMetadata.totalTokenCount ?? 0;
        }
      }

      return { tokensUsed, fullResponse };
    } catch (err: any) {
      lastError = err;
      const msg = err.message || String(err);

      if (hasYielded) {
        throw err;
      }

      if (msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('API key not valid')) {
        throw new Error('Invalid Gemini API Key. Please verify your key at https://aistudio.google.com/app/apikey.');
      }

      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('NOT_FOUND') || msg.includes('404')) {
        console.warn(`[gemini] Model ${currentModel} unavailable (${msg.slice(0, 60)}...). Rolling over to next Gemini model...`);
        continue;
      }

      if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand')) {
        try {
          await new Promise(r => setTimeout(r, 1000));
          const retryStream = await ai.models.generateContentStream({
            model: currentModel,
            contents,
            config: {
              systemInstruction: options.systemPrompt,
              maxOutputTokens: options.maxTokens ?? 8192,
              temperature: options.temperature ?? 0.7,
            },
          });
          for await (const chunk of retryStream) {
            if (callbacks.signal?.aborted) break;
            const text = chunk.text ?? '';
            if (text) {
              fullResponse += text;
              callbacks.onChunk(text);
            }
          }
          return { tokensUsed, fullResponse };
        } catch {
          continue;
        }
      }

      throw new Error(`Gemini API Error: ${msg}`);
    }
  }

  throw new Error(`Gemini API Error: ${lastError?.message || 'All Gemini models exhausted quota.'}`);
}

/**
 * Non-streaming chat completion with Google Gemini and model rollover
 */
export async function chatGemini(
  messages: ChatMessage[],
  options: ProviderOptions
): Promise<CompletionResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Google Gemini API key is missing. Please configure AI_API_KEY or GEMINI_API_KEY in .env.');
  }

  const ai = createGeminiClient(apiKey);
  const primaryModel = resolveGeminiModel(options.model);
  const modelsToTry = [primaryModel, ...RELIABLE_GEMINI_MODELS.filter(m => m !== primaryModel)];
  const contents = formatGeminiContents(messages);

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const result = await ai.models.generateContent({
        model: currentModel,
        contents,
        config: {
          systemInstruction: options.systemPrompt,
          maxOutputTokens: options.maxTokens ?? 8192,
          temperature: options.temperature ?? 0.7,
        },
      });

      const content = result.text ?? '';
      const tokensUsed = result.usageMetadata?.totalTokenCount ?? 0;

      return {
        content,
        tokensUsed,
        model: currentModel,
        provider: 'gemini',
      };
    } catch (err: any) {
      lastError = err;
      const msg = err.message || String(err);
      if (msg.includes('API_KEY_INVALID') || msg.includes('403')) {
        throw new Error('Invalid Gemini API Key. Please check your key at https://aistudio.google.com/app/apikey.');
      }
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('NOT_FOUND') || msg.includes('404')) {
        console.warn(`[gemini] Model ${currentModel} hit quota/not found. Trying next model...`);
        continue;
      }
      throw new Error(`Gemini API Error: ${msg}`);
    }
  }

  throw new Error(`Gemini API Error: ${lastError?.message || 'Quota exceeded across Gemini models.'}`);
}

/**
 * Test the Gemini API connection with a lightweight diagnostic ping
 */
export async function testGeminiConnection(
  apiKey?: string,
  model = 'gemini-3.8-flash'
): Promise<{ ok: boolean; model: string; message: string; elapsedMs: number }> {
  const start = Date.now();
  const key = apiKey || getGeminiApiKey();

  if (!key) {
    return {
      ok: false,
      model,
      message: 'GEMINI_API_KEY is not set in .env. Please get a free key from https://aistudio.google.com/app/apikey.',
      elapsedMs: 0,
    };
  }

  try {
    const ai = createGeminiClient(key);
    const result = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'Respond with the single word "READY".' }] }],
    });
    const text = (result.text ?? '').trim();
    return {
      ok: true,
      model,
      message: `Connected successfully! Response: "${text}"`,
      elapsedMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      ok: false,
      model,
      message: err.message || 'Connection failed',
      elapsedMs: Date.now() - start,
    };
  }
}

/**
 * Transcribe spoken audio (WebM, WAV, MP3) using Gemini Multimodal
 */
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string = 'audio/webm'
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured for audio transcription.');
  }

  const ai = createGeminiClient(apiKey);
  // Clean base64 header if present (e.g. data:audio/webm;base64,...)
  const cleanBase64 = base64Audio.replace(/^data:[^;]+;base64,/, '');

  const modelsToTry = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: 'Transcribe this spoken audio exactly into text. The audio may be in English, Hindi, or Gujarati. Output ONLY the transcribed words with appropriate punctuation and capitalization. If there is no speech or silence, output nothing. Do not add any notes, headers, or explanations.',
              },
            ],
          },
        ],
      });

      return (response.text ?? '').trim();
    } catch (err: any) {
      lastError = err;
      console.warn(`[transcribeAudio] Model ${currentModel} failed: ${err.message}. Trying next model...`);
      continue;
    }
  }

  throw new Error(`Audio transcription failed: ${lastError?.message || 'All models busy'}`);
}

