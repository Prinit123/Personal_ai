// src/views/EnglishPracticeView.tsx — Interactive Spoken English Practice & Roleplay
import { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Volume2, RefreshCw, Send,
  Award, VolumeX
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis, useVoiceInput } from '../hooks/useVoiceInput';
import type { PracticeTurnResult } from '../types';

interface PracticeScenario {
  id: string;
  title: string;
  emoji: string;
  desc: string;
  starterPrompt: string;
}

const SCENARIOS: PracticeScenario[] = [
  {
    id: 'interview',
    title: 'Job Interview',
    emoji: '💼',
    desc: 'Practice answering HR and technical questions with confidence.',
    starterPrompt: 'Hello! Welcome to our interview. To start off, could you please introduce yourself and tell me a little about your background?'
  },
  {
    id: 'teacher',
    title: 'Speaking to Teacher / Professor',
    emoji: '👨‍🏫',
    desc: 'Ask questions, explain doubts, or request leave respectfully.',
    starterPrompt: 'Good morning! How are you doing today? Did you have any questions about yesterday’s lecture or your project?'
  },
  {
    id: 'daily',
    title: 'Daily Casual Conversation',
    emoji: '☕',
    desc: 'Chat about daily routines, hobbies, food, and weekend plans.',
    starterPrompt: 'Hey there! Nice to catch up with you. How has your day been going so far? Did you do anything interesting today?'
  },
  {
    id: 'workplace',
    title: 'Workplace & Office Meeting',
    emoji: '💻',
    desc: 'Participate in team standups, discuss deadlines, and collaborate.',
    starterPrompt: 'Hi team, let’s do a quick sync. What task are you currently working on, and do you have any blockers?'
  },
  {
    id: 'phone',
    title: 'Telephone Call Practice',
    emoji: '📞',
    desc: 'Make appointments, order food, or handle customer queries over the phone.',
    starterPrompt: 'Thank you for calling City Tech Support. My name is Alex. How may I assist you today?'
  },
  {
    id: 'introduction',
    title: 'Introducing Yourself',
    emoji: '👋',
    desc: 'Introduce yourself confidently at college, social gatherings, or events.',
    starterPrompt: 'Hi, I do not think we have met yet! I am Nilesh. What is your name, and where are you from?'
  }
];

interface ChatHistoryItem {
  speaker: 'nilesh' | 'user';
  text: string;
  feedback?: string;
  betterWay?: string | null;
}

export default function EnglishPracticeView() {
  const [level, setLevel] = useState<'Beginner' | 'Intermediate' | 'Advanced'>('Beginner');
  const [selectedScenario, setSelectedScenario] = useState<PracticeScenario>(SCENARIOS[0]);
  const [history, setHistory] = useState<ChatHistoryItem[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const { speak } = useSpeechSynthesis();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Voice input
  const { isListening, startListening, stopListening } = useVoiceInput((chunk) => {
    setUserInput(prev => prev ? `${prev} ${chunk}` : chunk);
  }, 'en-US');

  // Start scenario
  const handleStartScenario = (sc: PracticeScenario) => {
    setSelectedScenario(sc);
    setHistory([{
      speaker: 'nilesh',
      text: sc.starterPrompt
    }]);
    if (autoSpeak) {
      speak(sc.starterPrompt, 'en-US');
    }
  };

  useEffect(() => {
    handleStartScenario(SCENARIOS[0]);
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, isLoading]);

  const handleSendTurn = async () => {
    if (!userInput.trim() || isLoading) return;
    const textToSend = userInput.trim();
    setUserInput('');

    // Append user's turn
    const newHist: ChatHistoryItem[] = [...history, { speaker: 'user', text: textToSend }];
    setHistory(newHist);
    setIsLoading(true);

    try {
      const res = await api.post<PracticeTurnResult>('/api/comm/practice-turn', {
        userSpeech: textToSend,
        scenario: selectedScenario.title,
        level,
        history: newHist.slice(-6).map(h => ({ speaker: h.speaker, text: h.text }))
      });

      const fullReply = `${res.reply} ${res.questionForUser || ''}`.trim();

      setHistory(prev => [
        ...prev,
        {
          speaker: 'nilesh',
          text: fullReply,
          feedback: res.feedback,
          betterWay: res.betterWay
        }
      ]);

      if (autoSpeak) {
        speak(fullReply, 'en-US');
      }
    } catch (err: any) {
      setHistory(prev => [
        ...prev,
        {
          speaker: 'nilesh',
          text: `I had a small connection issue, but let's continue! Could you repeat what you said?`
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="view-container" style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ maxWidth: 940, margin: '0 auto 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
            <Award size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              English Speaking Practice
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Practice realistic conversations with Nilesh. Speak aloud, receive gentle feedback on mistakes, and learn natural phrases.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Controls Bar: Level & Scenario & Audio Toggle */}
        <div className="dashboard-card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* Level selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>Level:</span>
              {(['Beginner', 'Intermediate', 'Advanced'] as const).map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setLevel(lvl)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: level === lvl ? 600 : 400,
                    border: level === lvl ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: level === lvl ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    color: level === lvl ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Auto speak toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-secondary"
                onClick={() => setAutoSpeak(prev => !prev)}
                style={{ fontSize: 12, padding: '4px 10px', gap: 6, borderRadius: 99 }}
              >
                {autoSpeak ? <Volume2 size={14} color="var(--primary)" /> : <VolumeX size={14} />}
                <span>Auto Read Aloud: {autoSpeak ? 'ON' : 'OFF'}</span>
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => handleStartScenario(selectedScenario)}
                style={{ fontSize: 12, padding: '4px 10px', gap: 6, borderRadius: 99 }}
                title="Restart conversation"
              >
                <RefreshCw size={13} />
                <span>Restart</span>
              </button>
            </div>
          </div>

          {/* Scenario Chips */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            {SCENARIOS.map(sc => {
              const active = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleStartScenario(sc)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 99,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    fontWeight: active ? 600 : 400,
                    border: active ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                    background: active ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                    color: active ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  <span>{sc.emoji}</span>
                  <span>{sc.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Practice Dialogue Area */}
        <div className="dashboard-card" style={{ padding: 20, minHeight: 400, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', maxHeight: 460, paddingRight: 6 }}>
            {history.map((item, idx) => {
              const isNilesh = item.speaker === 'nilesh';
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isNilesh ? 'flex-start' : 'flex-end',
                    gap: 4
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                      {isNilesh ? '👨‍🏫 Nilesh AI' : '👤 You'}
                    </span>
                    {isNilesh && (
                      <button
                        className="btn-icon-subtle"
                        onClick={() => speak(item.text, 'en-US')}
                        title="Repeat response aloud"
                        style={{ padding: 2 }}
                      >
                        <Volume2 size={13} />
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '12px 16px',
                      borderRadius: isNilesh ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                      background: isNilesh ? 'var(--bg-card)' : 'var(--primary)',
                      color: isNilesh ? 'var(--text-primary)' : '#ffffff',
                      border: isNilesh ? '1px solid var(--border)' : 'none',
                      fontSize: 14,
                      lineHeight: 1.5,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                  >
                    {item.text}
                  </div>

                  {/* Teacher Feedback & Better Way (if provided) */}
                  {(item.feedback || item.betterWay) && (
                    <div style={{
                      maxWidth: '82%',
                      marginTop: 4,
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(245, 158, 11, 0.08)',
                      borderLeft: '3px solid #f59e0b',
                      fontSize: 12,
                      color: 'var(--text-secondary)'
                    }}>
                      {item.feedback && (
                        <div style={{ marginBottom: item.betterWay ? 4 : 0 }}>
                          <span style={{ fontWeight: 600, color: '#f59e0b' }}>💡 Feedback: </span>
                          {item.feedback}
                        </div>
                      )}
                      {item.betterWay && (
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--primary)' }}>✨ Natural way to say it: </span>
                          "{item.betterWay}"
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                <span className="spin">◌</span> Nilesh is listening and thinking...
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* User Input Bar (Voice or Text) */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                className={`btn-icon-subtle ${isListening ? 'mic-btn-recording' : ''}`}
                onClick={isListening ? stopListening : startListening}
                title="Speak your reply"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 99,
                  background: isListening ? 'var(--error)' : 'var(--primary)',
                  color: '#fff',
                  flexShrink: 0
                }}
              >
                {isListening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              <input
                type="text"
                className="chat-textarea"
                placeholder={isListening ? 'Listening to your voice...' : 'Type or speak your answer in English...'}
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendTurn();
                  }
                }}
                style={{
                  flex: 1,
                  height: 44,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 14px',
                  fontSize: 14
                }}
              />

              <button
                className="btn btn-primary"
                onClick={handleSendTurn}
                disabled={isLoading || !userInput.trim()}
                style={{ height: 44, padding: '0 18px', borderRadius: 'var(--radius-md)', gap: 6 }}
              >
                <Send size={16} />
                <span>Send</span>
              </button>
            </div>
            {isListening && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--error)', textAlign: 'center' }}>
                🎙️ Speak naturally in English. Click the mic button again when finished.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
