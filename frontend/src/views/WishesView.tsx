// src/views/WishesView.tsx — Birthday, Festival & Special Wishes Generator
import { useState } from 'react';
import {
  Volume2, Copy, Check, Bookmark, Sparkles,
  PartyPopper, Mic, MicOff, Loader2
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis, useVoiceInput } from '../hooks/useVoiceInput';
import type { GeneratedMessage } from '../types';

interface WishCategory {
  id: string;
  name: string;
  icon: string;
  examples: string[];
}

const CATEGORIES: WishCategory[] = [
  {
    id: 'birthday',
    name: 'Birthday Wishes',
    icon: '🎂',
    examples: [
      'Happy birthday to my brother who is my biggest support',
      'Warm birthday wishes to my respected teacher',
      'Birthday wish to my best friend with funny memories',
      'Birthday wish to boss wishing health and success',
      'Sweet birthday message for little sister'
    ]
  },
  {
    id: 'congrats',
    name: 'Congratulations & Achievements',
    icon: '🎉',
    examples: [
      'Congratulations on getting your dream job at Google',
      'Proud of you for scoring top rank in board exams',
      'Hearty congratulations on your well-deserved promotion',
      'Congratulations on buying your new car / home',
      'Huge congratulations on graduating college'
    ]
  },
  {
    id: 'wedding',
    name: 'Wedding & Anniversary',
    icon: '💍',
    examples: [
      'Wishing a lifetime of love and happiness on your wedding day',
      'Happy 25th wedding anniversary to wonderful parents',
      'Warm wishes to the newlyweds as you start your journey',
      'Happy anniversary to my dear friend and spouse'
    ]
  },
  {
    id: 'festivals',
    name: 'Festival & New Year Greetings',
    icon: '🪔',
    examples: [
      'Wishing you and your family a sparkling and prosperous Diwali',
      'Eid Mubarak! May divine peace and joy fill your home',
      'Happy Holi! Wishing you vibrant colors of health and happiness',
      'Happy Uttarayan / Makar Sankranti filled with sweet chikki',
      'Wishing you a joyous Christmas and a prosperous New Year'
    ]
  },
  {
    id: 'thanks',
    name: 'Gratitude & Thank You',
    icon: '🙏',
    examples: [
      'Thank you so much for mentoring and believing in me',
      'Heartfelt thank you for standing by me during tough times',
      'Thank you teacher for always inspiring us to do our best',
      'Thank you to my team for making this project a success'
    ]
  },
  {
    id: 'condolence',
    name: 'Sympathy & Condolences',
    icon: '🕊️',
    examples: [
      'Deepest condolences for your loss. Thinking of you and your family',
      'May God grant peace to the departed soul and strength to you',
      'Sending love and strength during this difficult time'
    ]
  }
];

export default function WishesView() {
  const [activeCategory, setActiveCategory] = useState<string>('birthday');
  const [recipientName, setRecipientName] = useState('');
  const [relation, setRelation] = useState('Brother');
  const [prompt, setPrompt] = useState('Happy birthday to my brother wishing him success and good health');
  const [styleTone, setStyleTone] = useState<'Warm & Loving' | 'Energetic & Fun' | 'Respectful & Polite' | 'Short & Sweet'>('Warm & Loving');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GeneratedMessage | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { speak } = useSpeechSynthesis();

  // Voice dictation
  const { isListening, startListening, stopListening } = useVoiceInput((chunk) => {
    setPrompt(prev => prev ? `${prev} ${chunk}` : chunk);
  }, 'en-US');

  const handleGenerate = async () => {
    if (!prompt.trim() || isLoading) return;
    setIsLoading(true);
    setSavedSuccess(false);

    const detailedInstruction = `${prompt}. Recipient name: ${recipientName || relation || 'Friend'}. Relation: ${relation}. Tone: ${styleTone}. Occasion category: ${activeCategory}.`;

    try {
      const res = await api.post<GeneratedMessage>('/api/comm/write-message', {
        instruction: detailedInstruction,
        recipient: relation || 'Friend',
        tone: styleTone,
        language: 'english'
      });
      setResult(res);
    } catch (err: any) {
      alert(`Error generating wish: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSave = async (content: string) => {
    try {
      await api.post('/api/comm/templates', {
        title: `${activeCategory.toUpperCase()}: ${recipientName || relation}`,
        category: 'Special Wishes',
        recipient: relation,
        tone: styleTone,
        content
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Could not save wish: ${err.message}`);
    }
  };

  const currentCategoryData = CATEGORIES.find(c => c.id === activeCategory) || CATEGORIES[0];

  return (
    <div className="view-container" style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ maxWidth: 940, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
            <PartyPopper size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Birthday & Special Wishes
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Create heartwarming, celebratory, or respectful wishes for any occasion in English, Hindi, and Gujarati.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Category Tabs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10
        }}>
          {CATEGORIES.map(cat => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setPrompt(cat.examples[0]);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-card)',
                  color: active ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: active ? 600 : 500,
                  fontSize: 13,
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 18 }}>{cat.icon}</span>
                <span>{cat.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Wish Customizer Form */}
        <div className="dashboard-card" style={{ padding: 22 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{currentCategoryData.icon}</span>
            <span>Customize Your {currentCategoryData.name}</span>
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Recipient Name (Optional):
              </label>
              <input
                type="text"
                className="chat-textarea"
                placeholder="e.g. Rahul, Priya, Sharma Sir..."
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px',
                  fontSize: 13
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                Relationship:
              </label>
              <select
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 12px',
                  fontSize: 13,
                  color: 'var(--text-primary)'
                }}
              >
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
                <option value="Best Friend">Best Friend</option>
                <option value="Teacher / Sir">Teacher / Sir</option>
                <option value="Madam">Madam</option>
                <option value="Parents">Parents</option>
                <option value="Boss / Manager">Boss / Manager</option>
                <option value="Colleague">Colleague</option>
                <option value="Student">Student</option>
                <option value="Cousin">Cousin</option>
              </select>
            </div>
          </div>

          {/* Style / Tone Pill Selector */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Wish Style:
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['Warm & Loving', 'Energetic & Fun', 'Respectful & Polite', 'Short & Sweet'] as const).map(tone => (
                <button
                  key={tone}
                  onClick={() => setStyleTone(tone)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: styleTone === tone ? 600 : 400,
                    border: styleTone === tone ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: styleTone === tone ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    color: styleTone === tone ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Examples */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              Select an Idea:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {currentCategoryData.examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => setPrompt(ex)}
                  style={{
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 99,
                    border: '1px dashed var(--border)',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              className="chat-textarea"
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to wish..."
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 42px 10px 12px',
                fontSize: 14
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
              disabled={isLoading || !prompt.trim()}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 20px', borderRadius: 'var(--radius-md)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Composing Wish...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Wish</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Wish Result Card */}
        {result && (
          <div className="dashboard-card" style={{ padding: 24, border: '1.5px solid rgba(236, 72, 153, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#ec4899',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <PartyPopper size={14} /> Ready-to-Send Wish
              </span>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => speak(result.message, 'en-US')}
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  <Volume2 size={14} />
                  <span>Listen</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleCopy(result.message, 'wish')}
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  {copiedKey === 'wish' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                  <span>{copiedKey === 'wish' ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => handleSave(result.message)}
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  <Bookmark size={14} />
                  <span>{savedSuccess ? 'Saved!' : 'Save'}</span>
                </button>
              </div>
            </div>

            {/* Main Wish Box */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.05), rgba(59, 130, 246, 0.05))',
              border: '1px solid rgba(236, 72, 153, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 18,
              fontSize: 16,
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              marginBottom: 16
            }}>
              {result.message}
            </div>

            {/* Hindi & Gujarati versions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b' }}>
                    🇮🇳 Hindi (हिंदी)
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => speak(result.hindiVersion, 'hi-IN')}
                      style={{ padding: 4 }}
                    >
                      <Volume2 size={13} />
                    </button>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => handleCopy(result.hindiVersion, 'hi')}
                      style={{ padding: 4 }}
                    >
                      {copiedKey === 'hi' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                  {result.hindiVersion}
                </div>
              </div>

              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 14
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>
                    🇮🇳 Gujarati (ગુજરાતી)
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => speak(result.gujaratiVersion, 'gu-IN')}
                      style={{ padding: 4 }}
                    >
                      <Volume2 size={13} />
                    </button>
                    <button
                      className="btn-icon-subtle"
                      onClick={() => handleCopy(result.gujaratiVersion, 'gu')}
                      style={{ padding: 4 }}
                    >
                      {copiedKey === 'gu' ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
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
