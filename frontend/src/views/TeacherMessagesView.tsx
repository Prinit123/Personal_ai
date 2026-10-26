// src/views/TeacherMessagesView.tsx — Education, Teacher & Student Communication
import { useState } from 'react';
import {
  GraduationCap, BookOpen, Volume2, Copy, Check, Bookmark, Sparkles,
  Mic, MicOff, Loader2
} from 'lucide-react';
import { api } from '../api/client';
import { useSpeechSynthesis, useVoiceInput } from '../hooks/useVoiceInput';
import type { GeneratedMessage } from '../types';

interface PresetTemplate {
  id: string;
  category: 'teacher-to-student' | 'student-to-teacher';
  title: string;
  instruction: string;
  recipient: string;
  tone: string;
  sampleMessage: string;
}

const PRESETS: PresetTemplate[] = [
  // Teacher to Student
  {
    id: 't-cancel',
    category: 'teacher-to-student',
    title: 'Class Cancelled / Rescheduled',
    instruction: 'Inform students that today lecture is cancelled and we will continue on Monday 10 AM',
    recipient: 'Student',
    tone: 'Friendly',
    sampleMessage: 'Dear students, please note that there will be no class today. We will resume our lectures on Monday at 10:00 AM. Please make sure to revise the previous topics. Enjoy your weekend!'
  },
  {
    id: 't-hw',
    category: 'teacher-to-student',
    title: 'Homework & Assignment Reminder',
    instruction: 'Remind students to submit assignment 2 by tomorrow 5 PM without fail',
    recipient: 'Student',
    tone: 'Clear & Encouraging',
    sampleMessage: 'Hello everyone! 😊 This is a quick reminder that Assignment 2 is due tomorrow by 5:00 PM. Please ensure you submit your work on time to avoid any late penalties. Reach out if you have any questions!'
  },
  {
    id: 't-exam',
    category: 'teacher-to-student',
    title: 'Exam Announcement & Syllabus',
    instruction: 'Announce unit test next Friday covering chapters 1 to 4',
    recipient: 'Student',
    tone: 'Professional',
    sampleMessage: 'Notice for all students: The Unit Test is scheduled for next Friday. The test will cover Chapters 1 through 4. A revision session will be conducted this Wednesday. Best of luck with your preparation!'
  },
  {
    id: 't-feedback',
    category: 'teacher-to-student',
    title: 'Encouraging Student Feedback',
    instruction: 'Praise students for good performance in practicals and motivate them',
    recipient: 'Student',
    tone: 'Encouraging',
    sampleMessage: 'Great job in today’s lab session! I was really impressed by the dedication and problem-solving skills shown by everyone. Keep up this amazing momentum!'
  },
  // Student to Teacher
  {
    id: 's-sick',
    category: 'student-to-teacher',
    title: 'Sick Leave Application',
    instruction: 'Sir I am unable to attend college today because I have high fever and doctor advised rest',
    recipient: 'Sir / Male Teacher',
    tone: 'Respectful',
    sampleMessage: 'Respected Sir, I am writing to inform you that I am unwell with a high fever and have been advised bed rest by the doctor today. Therefore, I will not be able to attend today’s classes. I will collect the notes and complete all missed work. Thank you for your understanding.'
  },
  {
    id: 's-notes',
    category: 'student-to-teacher',
    title: 'Request for Study Material / Notes',
    instruction: 'Politely ask teacher to share presentation slides of yesterday topic',
    recipient: 'Sir / Male Teacher',
    tone: 'Polite',
    sampleMessage: 'Good afternoon, Sir. Could you kindly share yesterday’s lecture slides and reference notes when you have a moment? It would really help us revise the topic thoroughly. Thank you so much for your guidance.'
  },
  {
    id: 's-doubt',
    category: 'student-to-teacher',
    title: 'Request for Doubt Clearing Time',
    instruction: 'Ask teacher when they are free in cabin for clearing project doubts',
    recipient: 'Madam / Female Teacher',
    tone: 'Respectful',
    sampleMessage: 'Respected Madam, I have a few questions regarding our ongoing project. Could you please let me know when you might be available for a brief discussion in your cabin? Thank you very much for your time.'
  },
  {
    id: 's-late',
    category: 'student-to-teacher',
    title: 'Late Submission Permission Request',
    instruction: 'Request 1 day extension for submission due to family emergency',
    recipient: 'Sir / Male Teacher',
    tone: 'Polite & Formal',
    sampleMessage: 'Respected Sir, Due to an unexpected family emergency, I was unable to complete the assignment by today’s deadline. I kindly request you to grant me an extension until tomorrow evening to submit it. I sincerely apologize for the delay and appreciate your kind consideration.'
  }
];

export default function TeacherMessagesView() {
  const [roleMode, setRoleMode] = useState<'teacher-to-student' | 'student-to-teacher'>('teacher-to-student');
  const [instruction, setInstruction] = useState('Inform students that today lecture is cancelled and we will continue on Monday 10 AM');
  const [recipient, setRecipient] = useState('Student');
  const [tone, setTone] = useState('Friendly');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<GeneratedMessage | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const { speak } = useSpeechSynthesis();

  // Voice dictation
  const { isListening, startListening, stopListening } = useVoiceInput((chunk) => {
    setInstruction(prev => prev ? `${prev} ${chunk}` : chunk);
  }, 'en-US');

  const handleRoleToggle = (mode: 'teacher-to-student' | 'student-to-teacher') => {
    setRoleMode(mode);
    if (mode === 'teacher-to-student') {
      setRecipient('Student');
      setTone('Friendly');
      setInstruction(PRESETS[0].instruction);
    } else {
      setRecipient('Sir / Male Teacher');
      setTone('Respectful');
      setInstruction(PRESETS[4].instruction);
    }
  };

  const handleApplyPreset = (p: PresetTemplate) => {
    setInstruction(p.instruction);
    setRecipient(p.recipient);
    setTone(p.tone);
    setResult({
      message: p.sampleMessage,
      hindiVersion: '',
      gujaratiVersion: '',
      etiquetteTip: 'Ready-to-use verified classroom template.'
    });
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
        language: 'english'
      });
      setResult(res);
    } catch (err: any) {
      alert(`Error generating message: ${err.message}`);
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
        title: `${roleMode === 'teacher-to-student' ? 'Teacher Msg' : 'Student Request'}: ${recipient}`,
        category: 'Education & Teaching',
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

  const filteredPresets = PRESETS.filter(p => p.category === roleMode);

  return (
    <div className="view-container" style={{ padding: '24px 32px', overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div style={{ maxWidth: 940, margin: '0 auto 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div className="avatar ai" style={{ width: 36, height: 36, borderRadius: 12 }}>
            <GraduationCap size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              Teacher & Student Messages
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              Write clear, respectful educational notices, lecture updates, leave applications, and doubt questions.
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 940, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Role Toggle Selector */}
        <div className="dashboard-card" style={{ padding: 14 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => handleRoleToggle('teacher-to-student')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: roleMode === 'teacher-to-student' ? '2px solid var(--primary)' : '1px solid var(--border)',
                background: roleMode === 'teacher-to-student' ? 'rgba(59, 130, 246, 0.12)' : 'var(--bg-input)',
                color: roleMode === 'teacher-to-student' ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <BookOpen size={18} />
              <span>I am a Teacher (Message to Students)</span>
            </button>

            <button
              onClick={() => handleRoleToggle('student-to-teacher')}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: roleMode === 'student-to-teacher' ? '2px solid #10b981' : '1px solid var(--border)',
                background: roleMode === 'student-to-teacher' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
                color: roleMode === 'student-to-teacher' ? '#10b981' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <GraduationCap size={18} />
              <span>I am a Student (Message to Sir / Madam)</span>
            </button>
          </div>
        </div>

        {/* Quick Instant Templates */}
        <div className="dashboard-card" style={{ padding: 18 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
            Ready-Made Templates (Click to Load):
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {filteredPresets.map(p => (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: 12,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {p.title}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {p.instruction.slice(0, 65)}...
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Message Generator */}
        <div className="dashboard-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              {roleMode === 'teacher-to-student' ? 'What do you want to announce to students?' : 'What do you want to ask / explain to your teacher?'}
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tone:</span>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                style={{
                  height: 30,
                  fontSize: 12,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  padding: '0 8px'
                }}
              >
                <option value="Respectful">Respectful</option>
                <option value="Polite & Formal">Polite & Formal</option>
                <option value="Friendly">Friendly</option>
                <option value="Clear & Encouraging">Clear & Encouraging</option>
                <option value="Short & Direct">Short & Direct</option>
              </select>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              className="chat-textarea"
              rows={3}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. today not lecture we continue monday or sir leave due to fever..."
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 42px 12px 12px',
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
                  <span>Generate Educational Message</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Message Result Card */}
        {result && (
          <div className="dashboard-card" style={{ padding: 24, border: '1.5px solid rgba(16, 185, 129, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#10b981',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}>
                  <GraduationCap size={14} /> Ready to Send Message ({recipient} · {tone})
                </span>
                {result.subject && (
                  <h3 style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600 }}>
                    Subject: {result.subject}
                  </h3>
                )}
              </div>

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
                  onClick={() => handleCopy(result.message, 'edu')}
                  style={{ fontSize: 12, padding: '4px 10px', gap: 4 }}
                >
                  {copiedKey === 'edu' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                  <span>{copiedKey === 'edu' ? 'Copied' : 'Copy'}</span>
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

            <div style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 18,
              fontSize: 15,
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              marginBottom: 14
            }}>
              {result.message}
            </div>

            {result.etiquetteTip && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.08)',
                borderLeft: '3px solid #10b981',
                padding: '10px 14px',
                borderRadius: '0 8px 8px 0',
                fontSize: 13,
                color: 'var(--text-secondary)'
              }}>
                <span style={{ fontWeight: 600, color: '#10b981' }}>💡 Etiquette Note: </span>
                {result.etiquetteTip}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
