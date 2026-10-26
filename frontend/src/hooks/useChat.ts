// src/hooks/useChat.ts — Chat state management with real-time streaming, file parsing & attachments
import { useState, useCallback, useRef } from 'react';
import { api, streamChat, sendDirectChat } from '../api/client';
import type { ChatMessage, ParsedFile, ChatAttachment } from '../types';

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Extract files formatted like ```lang:path/to/file.ext\n...``` from message content
 */
export function extractFiles(content: string): ParsedFile[] {
  const files: ParsedFile[] = [];
  const regex = /```([a-zA-Z0-9_-]+):([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]+)\r?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    files.push({
      language: match[1],
      path: match[2].trim(),
      content: match[3],
    });
  }
  return files;
}

export function useChat(
  model: string,
  provider: string,
  activeConvId: string | null,
  onConvIdAssigned?: (id: string) => void
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const abortCtrl = useRef<AbortController | null>(null);

  // Load an existing conversation from backend SQLite
  const loadConversation = useCallback(async (convId: string) => {
    try {
      setLastError(null);
      const conv = await api.get<{ messages: any[] }>(`/api/conversations/${convId}`);
      const msgs: ChatMessage[] = (conv.messages || []).map(m => {
        let attachments: ChatAttachment[] = [];
        if (m.attachments) {
          try {
            attachments = typeof m.attachments === 'string' ? JSON.parse(m.attachments) : m.attachments;
          } catch {}
        }
        return {
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
          tokensUsed: m.tokens_used,
          files: extractFiles(m.content),
          attachments,
        };
      });
      setMessages(msgs);
    } catch (err: any) {
      console.warn('Could not load conversation:', err.message);
    }
  }, []);

  const sendMessage = useCallback(async (
    text: string,
    attachments: ChatAttachment[] = [],
    regenerate = false,
    targetAssistantId?: string
  ) => {
    const hasText = !!text.trim();
    const hasAtts = attachments && attachments.length > 0;
    // Duplicate submission protection
    if ((!hasText && !hasAtts) || isThinking) return;

    setLastError(null);

    let assistantId = targetAssistantId;
    if (targetAssistantId) {
      // Regenerating an existing message
      setMessages(prev => prev.map(m => {
        if (m.id !== targetAssistantId) return m;
        return {
          ...m,
          content: '',
          isStreaming: true,
          files: [],
          cached: false,
        };
      }));
    } else {
      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        attachments: hasAtts ? attachments : undefined,
      };

      assistantId = makeId();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
        files: [],
      };

      setMessages(prev => [...prev, userMsg, assistantMsg]);
    }

    setIsThinking(true);
    abortCtrl.current = new AbortController();

    // Prepare previous history for context (up to 20 messages)
    const history = messages.slice(-20).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      if (provider === 'ollama') {
        // Direct non-streaming for local Ollama
        const result = await sendDirectChat({
          message: text,
          model,
          provider: 'ollama',
          conversationId: activeConvId,
          history,
          attachments,
          regenerate,
          signal: abortCtrl.current.signal,
        });

        if (result.conversationId && !activeConvId && onConvIdAssigned) {
          onConvIdAssigned(result.conversationId);
        }

        const parsedFiles = result.files && result.files.length > 0 ? result.files : extractFiles(result.content);

        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m;
          return {
            ...m,
            content: result.content,
            isStreaming: false,
            tokensUsed: result.tokensUsed,
            provider: result.provider || 'ollama',
            model: result.model || model,
            cached: result.cached,
            loadTimeMs: result.loadTimeMs,
            evalTimeMs: result.evalTimeMs,
            tokensPerSecond: result.tokensPerSecond,
            files: parsedFiles,
          };
        }));
      } else {
        // SSE Streaming for cloud providers (Gemini, Groq) or Auto mode
        await streamChat({
          message: text,
          model,
          provider,
          conversationId: activeConvId,
          history,
          attachments,
          regenerate,
          signal: abortCtrl.current.signal,
          onConversationId: (newId) => {
            if (!activeConvId && onConvIdAssigned) {
              onConvIdAssigned(newId);
            }
          },
          onChunk: (chunk) => {
            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              const newContent = m.content + chunk;
              return {
                ...m,
                content: newContent,
                files: extractFiles(newContent),
              };
            }));
          },
          onDone: (meta) => {
            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              return {
                ...m,
                isStreaming: false,
                tokensUsed: meta?.tokensUsed,
                provider: meta?.provider || provider,
                model: meta?.model || model,
                cached: meta?.cached,
                loadTimeMs: meta?.loadTimeMs,
                evalTimeMs: meta?.evalTimeMs,
                tokensPerSecond: meta?.tokensPerSecond,
                files: extractFiles(m.content),
              };
            }));
          },
          onError: (err) => {
            setLastError(err);
            setMessages(prev => prev.map(m => {
              if (m.id !== assistantId) return m;
              return {
                ...m,
                role: 'error',
                content: err,
                isStreaming: false,
              };
            }));
          },
        });
      }
    } catch (err: any) {
      if (abortCtrl.current?.signal.aborted) {
        return;
      }
      const errMsg = err.message || 'Failed to generate response';
      console.error('[useChat] sendMessage error:', errMsg);
      setLastError(errMsg);
      setMessages(prev => prev.map(m => {
        if (m.id !== assistantId) return m;
        return {
          ...m,
          role: 'error',
          content: errMsg,
          isStreaming: false,
        };
      }));
    } finally {
      // Guaranteed spinner reset and send button recovery
      setIsThinking(false);
    }
  }, [model, provider, activeConvId, messages, isThinking, onConvIdAssigned]);

  const regenerateResponse = useCallback((userText: string, assistantMsgId: string) => {
    sendMessage(userText, [], true, assistantMsgId);
  }, [sendMessage]);

  const stopGeneration = useCallback(() => {
    abortCtrl.current?.abort();
    setIsThinking(false);
    setMessages(prev => prev.map(m =>
      m.isStreaming ? { ...m, isStreaming: false, files: extractFiles(m.content) } : m
    ));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setLastError(null);
  }, []);

  return {
    messages,
    setMessages,
    isThinking,
    lastError,
    sendMessage,
    regenerateResponse,
    stopGeneration,
    clearMessages,
    loadConversation,
  };
}
