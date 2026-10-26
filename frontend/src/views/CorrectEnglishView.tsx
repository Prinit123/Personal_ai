// src/views/CorrectEnglishView.tsx — English Grammar Corrector & Teacher
import { useState } from 'react';
import {
  CheckCheck, Volume2, Copy, Check, Sparkles, BookOpen,
  Mic, MicOff, Loader2
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis, useVoiceInput } from '../hooks/useVoiceInput';
import type { EnglishCorrectionResult } from '../types';

export default function CorrectEnglishView() {
  const [inputSentence, setInputSentence] = useState('Today not lecture we will continue monday.');
  const [context, setContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EnglishCorrectionResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { speak } = useSpeechSynthesis();

  // Voice input for dictating the sentence
  const { isListening, startListening, stopListening } = useVoiceInput((chunk) => {
    setInputSentence(prev => prev ? `${prev} ${chunk}` : chunk);
  }, 'en-US');

  const handleCorrect = async () => {
    if (!inputSentence.trim() || isLoading) return;
    setIsLoading(true);
    try {
      const res = await api.post<EnglishCorrectionResult>('/api/comm/correct-english', {
        text: inputSentence.trim(),
        context: context.trim(),
      });
      setResult(res);
    } catch (err: any) {
      alert(`Error correcting sentence: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="view-container" style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ maxWidth: 880, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
            <CheckCheck size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Correct My English
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Type or speak any English sentence. Nilesh will explain the grammar, correct errors, and provide 6 communication styles.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Input Card */}
        <div className="dashboard-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Enter or Speak Your Sentence:
            </label>
            <button
              className={`btn-icon-subtle ${isListening ? 'mic-btn-recording' : ''}`}
              onClick={isListening ? stopListening : startListening}
              title="Speak sentence with microphone"
              style={{ borderRadius: 99, padding: '4px 10px', fontSize: 12, gap: 6 }}
            >
              {isListening ? <MicOff size={14} /> : <Mic size={14} />}
              <span>{isListening ? 'Stop Speaking' : 'Voice Dictate'}</span>
            </button>
          </div>

          <textarea
            className="chat-textarea"
            rows={3}
            placeholder="e.g., Today not lecture we will continue monday..."
            value={inputSentence}
            onChange={(e) => setInputSentence(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              fontSize: 14,
            }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Optional: Who is this for? (e.g. to sir, to friend, in interview)"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              style={{
                flex: 1,
                minWidth: 240,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--text-primary)',
              }}
            />

            <button
              className="btn btn-primary"
              onClick={handleCorrect}
              disabled={!inputSentence.trim() || isLoading}
              style={{ minWidth: 150 }}
            >
              {isLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              <span>Check & Correct</span>
            </button>
          </div>
        </div>

        {/* Results Breakdown */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Primary Corrected Sentence Hero Card */}
            <div
              className="dashboard-card"
              style={{
                padding: 24,
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.05) 100%)',
                borderColor: 'var(--accent)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-light)', fontWeight: 600, marginBottom: 6 }}>
                    {result.isAlreadyCorrect ? '✅ Sentence is Already Correct!' : '✨ Correct & Natural English'}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    "{result.corrected}"
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn-icon-subtle"
                    onClick={() => speak(result.corrected, 'en-US')}
                    title="Listen to pronunciation"
                    style={{ borderRadius: 8, padding: 6 }}
                  >
                    <Volume2 size={18} color="var(--accent-light)" />
                  </button>
                  <button
                    className="btn-icon-subtle"
                    onClick={() => handleCopy(result.corrected, 'primary')}
                    title="Copy corrected sentence"
                    style={{ borderRadius: 8, padding: 6 }}
                  >
                    {copiedKey === 'primary' ? <Check size={18} color="var(--emerald)" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              {/* Hindi & Gujarati Meanings */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                {result.hindiMeaning && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Hindi:</strong> {result.hindiMeaning}
                  </div>
                )}
                {result.gujaratiMeaning && (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Gujarati:</strong> {result.gujaratiMeaning}
                  </div>
                )}
              </div>
            </div>

            {/* Teacher's Grammar Explanation Card */}
            <div className="dashboard-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <BookOpen size={18} color="var(--emerald)" />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Teacher's Explanation</h3>
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {result.explanation}
              </p>

              {result.grammarRule && (
                <div style={{ padding: '8px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--accent-light)' }}>Grammar Rule:</strong> {result.grammarRule}
                </div>
              )}
            </div>

            {/* 6 Communication Tone Variations */}
            {result.variations && (
              <div className="dashboard-card" style={{ padding: 20 }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 600 }}>6 Ways to Say It by Situation</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
                  {Object.entries(result.variations).map(([tone, text]) => (
                    <div
                      key={tone}
                      style={{
                        padding: 12,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, textTransform: 'capitalize', fontWeight: 600, color: 'var(--accent-light)' }}>
                          {tone}
                        </span>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className="btn-icon-subtle"
                            onClick={() => speak(text, 'en-US')}
                            title="Listen"
                            style={{ padding: 2 }}
                          >
                            <Volume2 size={13} />
                          </button>
                          <button
                            className="btn-icon-subtle"
                            onClick={() => handleCopy(text, tone)}
                            title="Copy"
                            style={{ padding: 2 }}
                          >
                            {copiedKey === tone ? <Check size={13} color="var(--emerald)" /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        "{text}"
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
