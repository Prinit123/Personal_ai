// src/views/TranslateView.tsx — Bidirectional English, Hindi & Gujarati Translator
import { useState } from 'react';
import {
  Languages, ArrowLeftRight, Volume2, Copy, Check,
  Mic, MicOff, Sparkles, Loader2
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis, useVoiceInput, type SupportedVoiceLang } from '../hooks/useVoiceInput';
import type { TranslationResult } from '../types';

type SupportedLang = 'english' | 'hindi' | 'gujarati';

const LANG_CONFIG: Record<SupportedLang, { name: string; nativeName: string; flag: string; speechCode: SupportedVoiceLang }> = {
  english: { name: 'English', nativeName: 'English', flag: '🇬🇧', speechCode: 'en-US' },
  hindi: { name: 'Hindi', nativeName: 'हिंदी', flag: '🇮🇳', speechCode: 'hi-IN' },
  gujarati: { name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', speechCode: 'gu-IN' }
};

const SAMPLE_PHRASES: Record<SupportedLang, string[]> = {
  english: [
    'There will be no lecture today. We will continue on Monday.',
    'Thank you so much for your kind help and guidance.',
    'Could you please share yesterday’s class notes with me?'
  ],
  hindi: [
    'Aaj class nahi hogi, hum Monday ko continue karenge.',
    'Aapki madad ke liye bahut bahut dhanyawad.',
    'Kya aap mujhe kal ke lecture ke notes de sakte hain?'
  ],
  gujarati: [
    'Aaje lecture nathi, somvare chalu karishu.',
    'Tamari madad mate khub khub aabhar.',
    'Shu tame mane kaal na lecture na notes aapi shako?'
  ]
};

export default function TranslateView() {
  const [sourceLang, setSourceLang] = useState<SupportedLang>('gujarati');
  const [targetLang, setTargetLang] = useState<SupportedLang>('english');
  const [scriptPref, setScriptPref] = useState<'native' | 'roman'>('native');
  const [inputText, setInputText] = useState('Aaje lecture nathi, somvare chalu karishu.');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { speak } = useSpeechSynthesis();

  // Voice dictation with matching speech recognition language
  const { isListening, startListening, stopListening } = useVoiceInput((chunk) => {
    setInputText(prev => prev ? `${prev} ${chunk}` : chunk);
  }, LANG_CONFIG[sourceLang].speechCode);

  const handleSwap = () => {
    const prevSrc = sourceLang;
    const prevTgt = targetLang;
    setSourceLang(prevTgt);
    setTargetLang(prevSrc);
    if (result) {
      setInputText(result.translation);
      setResult(null);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);

    try {
      const res = await api.post<TranslationResult>('/api/comm/translate', {
        text: inputText.trim(),
        from: sourceLang,
        to: targetLang,
        script: scriptPref
      });
      setResult(res);
    } catch (err: any) {
      alert(`Translation error: ${err.message}`);
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
      <div style={{ maxWidth: 940, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
            <Languages size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Translate Languages
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Natural, contextual translations between English, Hindi, and Gujarati. Supports native scripts and Romanized spelling (Hinglish / Gujlish).
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Language Selection Bar */}
        <div className="dashboard-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            {/* Source selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              {(['english', 'hindi', 'gujarati'] as SupportedLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setSourceLang(l)}
                  disabled={targetLang === l}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: sourceLang === l ? 600 : 400,
                    border: sourceLang === l ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: sourceLang === l ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    color: sourceLang === l ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: targetLang === l ? 'not-allowed' : 'pointer',
                    opacity: targetLang === l ? 0.4 : 1
                  }}
                >
                  {LANG_CONFIG[l].nativeName}
                </button>
              ))}
            </div>

            {/* Swap Button */}
            <button
              className="btn btn-secondary"
              onClick={handleSwap}
              title="Swap languages"
              style={{ borderRadius: 99, padding: '6px 12px', gap: 6, fontSize: 12 }}
            >
              <ArrowLeftRight size={14} />
              <span>Swap</span>
            </button>

            {/* Target selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              {(['english', 'hindi', 'gujarati'] as SupportedLang[]).map(l => (
                <button
                  key={l}
                  onClick={() => setTargetLang(l)}
                  disabled={sourceLang === l}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: targetLang === l ? 600 : 400,
                    border: targetLang === l ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: targetLang === l ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    color: targetLang === l ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: sourceLang === l ? 'not-allowed' : 'pointer',
                    opacity: sourceLang === l ? 0.4 : 1
                  }}
                >
                  {LANG_CONFIG[l].nativeName}
                </button>
              ))}
            </div>
          </div>

          {/* Script Preference (Native vs Roman) */}
          {(targetLang === 'hindi' || targetLang === 'gujarati') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Script Style:</span>
              <button
                onClick={() => setScriptPref('native')}
                style={{
                  padding: '3px 10px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: scriptPref === 'native' ? 600 : 400,
                  border: scriptPref === 'native' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: scriptPref === 'native' ? 'var(--primary)' : 'transparent',
                  color: scriptPref === 'native' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Native Script ({targetLang === 'hindi' ? 'हिंदी' : 'ગુજરાતી'})
              </button>
              <button
                onClick={() => setScriptPref('roman')}
                style={{
                  padding: '3px 10px',
                  borderRadius: 99,
                  fontSize: 11,
                  fontWeight: scriptPref === 'roman' ? 600 : 400,
                  border: scriptPref === 'roman' ? '1px solid var(--primary)' : '1px solid var(--border)',
                  background: scriptPref === 'roman' ? 'var(--primary)' : 'transparent',
                  color: scriptPref === 'roman' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Roman English Letters ({targetLang === 'hindi' ? 'Hinglish' : 'Gujlish'})
              </button>
            </div>
          )}
        </div>

        {/* Translation Boxes (Side by Side or Stacked) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Input Panel */}
          <div className="dashboard-card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                {LANG_CONFIG[sourceLang].name} Input
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="btn-icon-subtle"
                  onClick={() => speak(inputText, LANG_CONFIG[sourceLang].speechCode)}
                  disabled={!inputText.trim()}
                  title="Listen input"
                >
                  <Volume2 size={14} />
                </button>
                <button
                  className={`btn-icon-subtle ${isListening ? 'mic-btn-recording' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  title="Speak into input"
                >
                  {isListening ? <MicOff size={14} color="var(--error)" /> : <Mic size={14} />}
                </button>
              </div>
            </div>

            <textarea
              className="chat-textarea"
              rows={6}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={`Type or speak in ${LANG_CONFIG[sourceLang].name}...`}
              style={{
                width: '100%',
                flex: 1,
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
                fontSize: 14,
                marginBottom: 12
              }}
            />

            {/* Sample phrase suggestions */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                Sample Phrases:
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SAMPLE_PHRASES[sourceLang].map(sample => (
                  <button
                    key={sample}
                    onClick={() => setInputText(sample)}
                    style={{
                      textAlign: 'left',
                      fontSize: 11,
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'transparent',
                      border: '1px dashed var(--border)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer'
                    }}
                  >
                    "{sample}"
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleTranslate}
              disabled={isLoading || !inputText.trim()}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px 16px', borderRadius: 'var(--radius-md)' }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Translate to {LANG_CONFIG[targetLang].name}</span>
                </>
              )}
            </button>
          </div>

          {/* Output Panel */}
          <div className="dashboard-card" style={{ padding: 18, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                {LANG_CONFIG[targetLang].name} Translation
              </span>
              {result && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn-icon-subtle"
                    onClick={() => speak(result.translation, LANG_CONFIG[targetLang].speechCode)}
                    title="Listen translation"
                  >
                    <Volume2 size={14} />
                  </button>
                  <button
                    className="btn-icon-subtle"
                    onClick={() => handleCopy(result.translation, 'out')}
                    title="Copy translation"
                  >
                    {copiedKey === 'out' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            <div style={{
              flex: 1,
              minHeight: 140,
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              fontSize: 15,
              lineHeight: 1.6,
              color: result ? 'var(--text-primary)' : 'var(--text-muted)',
              whiteSpace: 'pre-wrap',
              marginBottom: 12
            }}>
              {result ? result.translation : 'Translation will appear here...'}
            </div>

            {/* Romanized pronunciation if present */}
            {result?.romanized && (
              <div style={{
                background: 'rgba(59, 130, 246, 0.05)',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px',
                marginBottom: 10
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                    Roman Pronunciation (Hinglish/Gujlish):
                  </span>
                  <button
                    className="btn-icon-subtle"
                    onClick={() => handleCopy(result.romanized, 'roman')}
                    title="Copy Roman text"
                    style={{ padding: 2 }}
                  >
                    {copiedKey === 'roman' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                  </button>
                </div>
                <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                  {result.romanized}
                </div>
              </div>
            )}

            {/* Cultural or grammar notes */}
            {result?.notes && (
              <div style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)'
              }}>
                <span style={{ fontWeight: 600 }}>💡 Note: </span>
                {result.notes}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
