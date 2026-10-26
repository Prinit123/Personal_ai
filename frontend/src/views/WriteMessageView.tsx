// src/views/WriteMessageView.tsx — Automatic Message Writer & Etiquette Assistant
import { useState } from 'react';
import {
  PenTool, Volume2, Copy, Check, Bookmark, Sparkles,
  Mic, MicOff, UserCheck, Sliders, Loader2
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis, useVoiceInput } from '../hooks/useVoiceInput';
import type { GeneratedMessage } from '../types';

interface RecipientOption {
  id: string;
  label: string;
  emoji: string;
  desc: string;
  defaultTone: string;
}

const RECIPIENTS: RecipientOption[] = [
  { id: 'Sir / Male Teacher', label: 'Sir / Teacher', emoji: '👨‍🏫', desc: 'Respectful and polite', defaultTone: 'Respectful' },
  { id: 'Madam / Female Teacher', label: 'Madam / Teacher', emoji: '👩‍🏫', desc: 'Respectful and polite', defaultTone: 'Respectful' },
  { id: 'Student', label: 'Student', emoji: '🎓', desc: 'Clear, encouraging, friendly', defaultTone: 'Friendly' },
  { id: 'Brother / Sister', label: 'Brother / Sister', emoji: '👫', desc: 'Warm and informal', defaultTone: 'Casual' },
  { id: 'Friend', label: 'Friend', emoji: '🤝', desc: 'Natural and casual', defaultTone: 'Friendly' },
  { id: 'Parents', label: 'Parents', emoji: '❤️', desc: 'Respectful and caring', defaultTone: 'Respectful' },
  { id: 'Boss / Manager', label: 'Boss / Manager', emoji: '💼', desc: 'Professional and concise', defaultTone: 'Professional' },
  { id: 'Customer / Client', label: 'Customer', emoji: '🛍️', desc: 'Polite and helpful', defaultTone: 'Professional' },
  { id: 'Colleague', label: 'Colleague', emoji: '💻', desc: 'Professional and friendly', defaultTone: 'Professional' },
  { id: 'Family Member', label: 'Family Member', emoji: '🏡', desc: 'Warm and personal', defaultTone: 'Friendly' },
  { id: 'General / Unknown', label: 'Unknown Recipient', emoji: '✉️', desc: 'Neutral and polite', defaultTone: 'Polite' },
];

const TONES = [
  'Respectful',
  'Professional',
  'Friendly',
  'Formal',
  'Casual',
  'Emotional',
  'Short',
  'Detailed'
];

const QUICK_PROMPTS = [
  'Today no lecture we will continue Monday',
  'Asking for 2 days leave due to fever',
  'Thank you for your guidance and help',
  'Reminder: Please submit assignment by tomorrow 5 PM',
  'Are you free for a quick phone call today?',
  'Apology for joining the meeting late',
  'Can you please share yesterday lecture notes?'
];

export default function WriteMessageView() {
  const [recipient, setRecipient] = useState<string>(RECIPIENTS[0].id);
  const [tone, setTone] = useState<string>(RECIPIENTS[0].defaultTone);
  const [instruction, setInstruction] = useState('Today no lecture we will continue Monday');
  const [language, setLanguage] = useState<'english' | 'hindi' | 'gujarati'>('english');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GeneratedMessage | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { speak } = useSpeechSynthesis();

  // Voice dictation for the message instruction
  const { isListening, startListening, stopListening } = useVoiceInput((chunk) => {
    setInstruction(prev => prev ? `${prev} ${chunk}` : chunk);
  }, language === 'hindi' ? 'hi-IN' : language === 'gujarati' ? 'gu-IN' : 'en-US');

  const handleRecipientSelect = (rec: RecipientOption) => {
    setRecipient(rec.id);
    setTone(rec.defaultTone);
  };

  const handleGenerate = async () => {
    if (!instruction.trim() || isLoading) return;
    setIsLoading(true);
    setSavedSuccess(false);
    try {
      const res = await api.post<GeneratedMessage>('/api/comm/write-message', {
        instruction: instruction.trim(),
        recipient,
        tone,
        language
      });
      setResult(res);
    } catch (err: any) {
      alert(`Error creating message: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveTemplate = async (content: string, title: string) => {
    try {
      await api.post('/api/comm/templates', {
        title: title || `${recipient} — ${tone}`,
        category: 'Messages',
        recipient,
        tone,
        content
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Could not save template: ${err.message}`);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ maxWidth: 940, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
            <PenTool size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Write a Message
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Give Nilesh a quick thought or instruction. Get a ready-to-send, etiquette-perfect message with Hindi & Gujarati translations.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Recipient Selection Bar */}
        <div className="dashboard-card" style={{ padding: 18 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
            <UserCheck size={16} color="var(--primary)" />
            Step 1: Who are you sending this message to?
          </label>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))',
            gap: 8
          }}>
            {RECIPIENTS.map(rec => {
              const active = recipient === rec.id;
              return (
                <button
                  key={rec.id}
                  onClick={() => handleRecipientSelect(rec)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '10px 8px',
                    borderRadius: 'var(--radius-md)',
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-input)',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: 20 }}>{rec.emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: active ? 600 : 500 }}>{rec.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{rec.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tone & Context Section */}
        <div className="dashboard-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              <Sliders size={16} color="var(--primary)" />
              Step 2: Choose Tone & Type Your Thought
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Language:</span>
              <button
                onClick={() => setLanguage('english')}
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: language === 'english' ? 'var(--primary)' : 'transparent',
                  color: language === 'english' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('hindi')}
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: language === 'hindi' ? 'var(--primary)' : 'transparent',
                  color: language === 'hindi' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                हिंदी
              </button>
              <button
                onClick={() => setLanguage('gujarati')}
                style={{
                  padding: '3px 9px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: 600,
                  border: '1px solid var(--border)',
                  background: language === 'gujarati' ? 'var(--primary)' : 'transparent',
                  color: language === 'gujarati' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                ગુજરાતી
              </button>
            </div>
          </div>

          {/* Tone pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {TONES.map(t => {
              const active = tone === t;
              return (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {t}
                </button>
              );
            })}
          </div>

          {/* Quick prompts chips */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Quick Suggestions:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {QUICK_PROMPTS.map(qp => (
                <button
                  key={qp}
                  onClick={() => setInstruction(qp)}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 99,
                    border: '1px dashed var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {/* Instruction textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              className="chat-textarea"
              rows={3}
              placeholder="e.g. today not lecture we continue monday, or wish happy birthday..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 42px 12px 12px',
                fontSize: 14,
              }}
            />
            <button
              className={`btn-icon-subtle ${isListening ? 'mic-btn-recording' : ''}`}
              onClick={isListening ? stopListening : startListening}
              title="Dictate with voice"
              style={{
                position: 'absolute',
                right: 8,
                top: 8,
                borderRadius: 99,
                padding: 6
              }}
            >
              {isListening ? <MicOff size={16} color="var(--error)" /> : <Mic size={16} />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={isLoading || !instruction.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 'var(--radius-md)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Drafting Message...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Draft Message for {recipient}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Message Display */}
        {result && (
          <div className="dashboard-card" style={{ padding: 24, border: '1.5px solid rgba(59, 130, 246, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--primary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Sparkles size={12} /> Ready to Send Message ({recipient} · {tone})
                </span>
                {result.subject && (
                  <h3 style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 600 }}>
                    Subject: {result.subject}
                  </h3>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => speak(result.message, 'en-US')}
                  title="Listen to pronunciation"
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  <Volume2 size={14} />
                  <span>Listen</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleCopy(result.message, 'main')}
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  {copiedKey === 'main' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                  <span>{copiedKey === 'main' ? 'Copied' : 'Copy Message'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSaveTemplate(result.message, result.subject || `${recipient} Message`)}
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  <Bookmark size={14} />
                  <span>{savedSuccess ? 'Saved!' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Main Message Box */}
            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 18,
              fontSize: 15,
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              marginBottom: 16
            }}>
              {result.message}
            </div>

            {/* Etiquette Tip */}
            {result.etiquetteTip && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                borderLeft: '3px solid var(--primary)',
                padding: '10px 14px',
                borderRadius: '0 8px 8px 0',
                fontSize: 13,
                color: 'var(--text-secondary)',
                marginBottom: 16
              }}>
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>💡 Nilesh's Etiquette Tip: </span>
                {result.etiquetteTip}
              </div>
            )}

            {/* Hindi and Gujarati Translations */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Hindi */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>
                    🇮🇳 Hindi Version (हिंदी)
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => speak(result.hindiVersion, 'hi-IN')}
                      title="Listen in Hindi"
                      style={{ padding: 4 }}
                    >
                      <Volume2 size={13} />
                    </button>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => handleCopy(result.hindiVersion, 'hindi')}
                      title="Copy Hindi"
                      style={{ padding: 4 }}
                    >
                      {copiedKey === 'hindi' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {result.hindiVersion}
                </div>
              </div>

              {/* Gujarati */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                    🇮🇳 Gujarati Version (ગુજરાતી)
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => speak(result.gujaratiVersion, 'gu-IN')}
                      title="Listen in Gujarati"
                      style={{ padding: 4 }}
                    >
                      <Volume2 size={13} />
                    </button>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => handleCopy(result.gujaratiVersion, 'gujarati')}
                      title="Copy Gujarati"
                      style={{ padding: 4 }}
                    >
                      {copiedKey === 'gujarati' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {result.gujaratiVersion}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
