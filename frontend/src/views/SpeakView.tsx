// src/views/SpeakView.tsx — Hands-Free Voice Conversation Room with Bluetooth Neckband & Microphone Selector
import { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Square, RotateCcw,
  Eye, EyeOff, Radio, Languages, Send, AlertCircle,
  Headphones, RefreshCw, Activity
} from 'lucide-react';
import { useVoiceInput, useSpeechSynthesis, type SupportedVoiceLang } from '../hooks/useVoiceInput';
import { streamChat } from '../api/client';

export default function SpeakView() {
  const [conversation, setConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    { role: 'assistant', text: 'Hello! I am Nilesh, your voice conversation partner. Tap the microphone or connect your Bluetooth neckband to speak with me in English, Hindi, or Gujarati!' }
  ]);
  const [continuousMode, setContinuousMode] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [fallbackInput, setFallbackInput] = useState('');
  const [lastAssistantText, setLastAssistantText] = useState('');
  const [showMicSettings, setShowMicSettings] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef(false);

  const { speak, stop: stopSpeaking, isSpeaking, supported: ttsSupported } = useSpeechSynthesis();

  // Voice recognition hook with Device Selector, VU volume meter, and Gemini multimodal audio fallback
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: sttSupported,
    error: sttError,
    language,
    volumeLevel,
    devices,
    selectedDeviceId,
    isTranscribing,
    setLanguage,
    setSelectedDeviceId,
    startListening,
    stopListening,
    resetTranscript,
    refreshDevices,
    testMicrophone,
  } = useVoiceInput(undefined, 'en-US');

  const silenceTimerRef = useRef<any>(null);
  const speechDetectedRef = useRef<boolean>(false);

  // Keep track of speaking state in a ref
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Scroll to bottom when conversation updates
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation, showTranscript]);

  // Silence auto-detection for Hands-Free Continuous Mode
  useEffect(() => {
    if (!isListening || !continuousMode || isThinking || isTranscribing) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      return;
    }

    const currentText = (transcript || interimTranscript).trim();

    if (currentText.length > 0 || volumeLevel > 25) {
      speechDetectedRef.current = true;
    }

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }

    // When speech was detected and now silence occurs, auto-commit after 1.6s
    if (speechDetectedRef.current && currentText.length > 0) {
      silenceTimerRef.current = setTimeout(async () => {
        speechDetectedRef.current = false;
        const finalSpoken = await stopListening();
        const textToSend = (finalSpoken || currentText).trim();
        if (textToSend) {
          sendSpokenMessage(textToSend);
        }
      }, 1600);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, [transcript, interimTranscript, volumeLevel, isListening, continuousMode, isThinking, isTranscribing, stopListening]);

  // Send message to Nilesh AI and speak the response aloud
  const sendSpokenMessage = async (userText: string) => {
    if (!userText.trim() || isThinking) return;

    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    speechDetectedRef.current = false;

    const cleanInput = userText.trim();
    resetTranscript();
    setIsThinking(true);

    // Stop listening while AI is thinking and generating
    await stopListening();

    setConversation(prev => [...prev, { role: 'user', text: cleanInput }]);

    // Context instructions for Nilesh
    const systemPrompt = `You are Nilesh AI, my personal English teacher, communication mentor, and voice conversation partner.
You speak naturally, warmly, and concisely, like a real person talking on a phone or voice call.
Rules:
1. Always keep responses brief (2 to 4 sentences maximum) so voice listening is enjoyable and natural.
2. If the user spoke in English, respond in English.
3. If the user spoke in Hindi or Gujarati, respond naturally in that language.
4. If the user made a grammar error, politely give a gentle 1-sentence tip and continue the conversation.`;

    const history = conversation.map(m => ({
      role: m.role,
      content: m.text,
    }));

    let finalText = '';

    await streamChat({
      message: cleanInput,
      history,
      model: 'gemini-3.5-flash',
      provider: 'gemini',
      systemPrompt,
      onChunk: (chunk) => {
        finalText += chunk;
      },
      onDone: () => {
        setIsThinking(false);
        setLastAssistantText(finalText);
        setConversation(prev => [...prev, { role: 'assistant', text: finalText }]);

        // Speak aloud if not muted
        if (!isMuted && ttsSupported) {
          speak(finalText, language, () => {
            // Callback when speaking finishes: If continuous mode, start listening again!
            if (continuousMode) {
              setTimeout(() => {
                resetTranscript();
                startListening();
              }, 400);
            }
          });
        } else if (continuousMode) {
          setTimeout(() => {
            resetTranscript();
            startListening();
          }, 600);
        }
      },
      onError: (err) => {
        setIsThinking(false);
        const errMsg = `I encountered an issue: ${err}`;
        setConversation(prev => [...prev, { role: 'assistant', text: errMsg }]);
      },
    });
  };

  // When listening stops and we have a final transcript, submit it
  const handleToggleMic = async () => {
    if (isSpeaking) {
      stopSpeaking();
    }
    if (isListening) {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      speechDetectedRef.current = false;
      const spoken = await stopListening();
      const current = (transcript || interimTranscript).trim();
      const textToSend = spoken.trim() || current;
      if (textToSend) {
        sendSpokenMessage(textToSend);
      }
    } else {
      resetTranscript();
      speechDetectedRef.current = false;
      await startListening();
    }
  };

  const handleManualSend = () => {
    if (!fallbackInput.trim()) return;
    const text = fallbackInput;
    setFallbackInput('');
    sendSpokenMessage(text);
  };

  const handleInterrupt = () => {
    stopSpeaking();
    setIsThinking(false);
    stopListening();
  };

  const handleRepeatLast = () => {
    if (lastAssistantText && !isMuted) {
      speak(lastAssistantText, language);
    }
  };

  const handleTestMic = async () => {
    setIsTesting(true);
    setTestResult('🎙️ Listening to your neckband for 4 seconds... Please say "Hello Nilesh" into your microphone!');
    const ok = await testMicrophone();
    setIsTesting(false);
    if (ok) {
      setTestResult('✅ Microphone active! Sound was detected successfully. You can now speak to Nilesh.');
    } else {
      setTestResult('⚠️ No sound detected. Check if your neckband is turned ON, connected in Bluetooth, and selected below.');
    }
    setTimeout(() => setTestResult(null), 8000);
  };

  const selectedDeviceObj = devices.find(d => d.deviceId === selectedDeviceId);

  return (
    <div className="view-container voice-room-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header */}
      <header className="chat-header" style={{ flexShrink: 0 }}>
        <div className="chat-header-left">
          <div className="chat-header-title">
            <span className="brand-dot" style={{ background: isListening ? 'var(--red)' : isSpeaking ? 'var(--emerald)' : 'var(--accent)' }} />
            <span className="brand-name">Speak with Nilesh</span>
            <span className="brand-badge" style={{ background: 'var(--emerald-dim)', color: 'var(--emerald)' }}>
              Live Voice Room
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="chat-header-actions" style={{ gap: 8, flexWrap: 'wrap' }}>
          {/* Microphone / Neckband Selector Button */}
          <button
            className={`btn-icon-subtle ${showMicSettings ? 'active-pill' : ''}`}
            onClick={() => setShowMicSettings(prev => !prev)}
            title="Microphone & Bluetooth Neckband Settings"
            style={{
              fontSize: 11,
              borderRadius: 99,
              padding: '4px 10px',
              gap: 5,
              background: showMicSettings ? 'var(--accent-dim)' : 'var(--bg-card)',
              color: showMicSettings ? 'var(--accent-light)' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <Headphones size={13} />
            <span>{selectedDeviceObj?.isBluetooth ? '🎧 Neckband Connected' : '🎙️ Mic Device'}</span>
          </button>

          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Languages size={15} color="var(--text-muted)" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedVoiceLang)}
              className="voice-lang-select"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '99px',
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <option value="en-US">English (US/UK)</option>
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">Hindi (हिंदी)</option>
              <option value="gu-IN">Gujarati (ગુજરાતી)</option>
            </select>
          </div>

          {/* Continuous Mode Toggle */}
          <button
            className={`btn-icon-subtle ${continuousMode ? 'active-pill' : ''}`}
            onClick={() => setContinuousMode(prev => !prev)}
            title={continuousMode ? 'Hands-Free ON: Nilesh listens automatically after speaking' : 'Hands-Free OFF: Tap mic each turn'}
            style={{
              fontSize: 11,
              borderRadius: 99,
              padding: '4px 10px',
              background: continuousMode ? 'var(--accent-dim)' : 'transparent',
              color: continuousMode ? 'var(--accent-light)' : 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
          >
            <Radio size={13} style={{ marginRight: 4 }} />
            {continuousMode ? 'Hands-Free ON' : 'Hands-Free OFF'}
          </button>

          {/* Hide/Show Transcript */}
          <button
            className="btn-icon-subtle"
            onClick={() => setShowTranscript(prev => !prev)}
            title={showTranscript ? 'Hide transcript (Audio-only room)' : 'Show text transcript'}
          >
            {showTranscript ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          {/* Mute/Unmute */}
          <button
            className="btn-icon-subtle"
            onClick={() => {
              if (!isMuted) stopSpeaking();
              setIsMuted(prev => !prev);
            }}
            title={isMuted ? 'Unmute AI Voice' : 'Mute AI Voice'}
          >
            {isMuted ? <VolumeX size={16} color="var(--red)" /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      {/* Microphone & Neckband Diagnostics Panel (Drawer) */}
      {showMicSettings && (
        <div style={{
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          padding: '14px 24px',
          boxShadow: 'var(--shadow-md)',
          animation: 'fadeIn 0.2s ease',
          zIndex: 10
        }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={18} color="var(--accent)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Microphone & Bluetooth Neckband Selector
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={refreshDevices}
                  title="Rescan audio devices"
                  style={{ fontSize: 11, padding: '3px 8px', gap: 4 }}
                >
                  <RefreshCw size={12} />
                  <span>Rescan Devices</span>
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleTestMic}
                  disabled={isTesting}
                  style={{ fontSize: 11, padding: '3px 10px', gap: 4 }}
                >
                  <Activity size={12} />
                  <span>{isTesting ? 'Testing Mic...' : 'Test Neckband Mic'}</span>
                </button>
              </div>
            </div>

            {/* Device Picker Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Input Mic:</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 260,
                  height: 34,
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0 10px',
                  fontSize: 12,
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">Default System Microphone</option>
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.isBluetooth ? '🎧 ' : '🎙️ '}{d.label} {d.isBluetooth ? '(Bluetooth Neckband/Headset)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Volume Meter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 80 }}>Sound Level:</span>
              <div style={{
                flex: 1,
                height: 8,
                background: 'var(--bg-input)',
                borderRadius: 99,
                overflow: 'hidden',
                border: '1px solid var(--border)'
              }}>
                <div style={{
                  height: '100%',
                  width: `${volumeLevel}%`,
                  background: volumeLevel > 60 ? 'var(--emerald)' : volumeLevel > 20 ? 'var(--accent)' : 'var(--text-muted)',
                  transition: 'width 0.08s ease'
                }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: volumeLevel > 15 ? 'var(--emerald)' : 'var(--text-muted)', width: 35 }}>
                {volumeLevel}%
              </span>
            </div>

            {/* Test result banner */}
            {testResult && (
              <div style={{
                fontSize: 12,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: testResult.includes('✅') ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: testResult.includes('✅') ? 'var(--emerald)' : 'var(--red)',
                border: testResult.includes('✅') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
              }}>
                {testResult}
              </div>
            )}

            {/* Quick neckband troubleshooting tips */}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, background: 'rgba(99, 102, 241, 0.05)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
              💡 <strong>Neckband Tip:</strong> In Windows 11/10, press <code>Win + I</code> → <strong>Sound</strong> → <strong>Input</strong> and make sure your Bluetooth neckband is set as the <strong>Default Input Device</strong>. In Chrome/Edge, click the lock/tune icon in the address bar and ensure <strong>Microphone</strong> is set to <strong>Allow</strong>.
            </div>
          </div>
        </div>
      )}

      {/* Main Center Stage */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '20px 24px', overflowY: 'auto' }}>
        
        {/* Error Notification Alert */}
        {sttError && (
          <div style={{
            maxWidth: 620,
            width: '100%',
            marginBottom: 16,
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: 'var(--red)'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>{sttError}</div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowMicSettings(true)}
              style={{ fontSize: 11, padding: '2px 8px', borderColor: 'var(--red)', color: 'var(--red)' }}
            >
              Fix Mic
            </button>
          </div>
        )}

        {/* Status Indicator */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, color: isTranscribing ? 'var(--amber)' : isListening ? 'var(--red)' : isThinking ? 'var(--accent-light)' : isSpeaking ? 'var(--emerald)' : 'var(--text-muted)' }}>
            {isTranscribing
              ? '✨ Transcribing neckband audio with Nilesh AI…'
              : isListening
              ? '🎙️ Listening to your neckband / mic… Speak naturally'
              : isThinking
              ? '⚡ Nilesh is thinking…'
              : isSpeaking
              ? '🔊 Nilesh is speaking aloud…'
              : 'Tap the microphone or speak into your neckband'}
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Language: <strong>{language === 'hi-IN' ? 'Hindi (हिंदी)' : language === 'gu-IN' ? 'Gujarati (ગુજરાતી)' : 'English'}</strong>
            {selectedDeviceObj?.label && <span> · Mic: <strong>{selectedDeviceObj.label.slice(0, 30)}</strong></span>}
          </p>
        </div>

        {/* Big Animated Center Microphone */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '12px 0 24px' }}>
          {/* Pulsing Ripple rings when active */}
          {(isListening || isSpeaking || isTranscribing) && (
            <div
              className="voice-pulse-ring"
              style={{
                borderColor: isTranscribing ? 'rgba(245, 158, 11, 0.4)' : isListening ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                background: isTranscribing ? 'rgba(245, 158, 11, 0.08)' : isListening ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
              }}
            />
          )}

          <button
            onClick={handleToggleMic}
            className={`large-voice-mic-btn ${isListening ? 'listening' : isSpeaking ? 'speaking' : isTranscribing ? 'speaking' : ''}`}
            title={isListening ? 'Click to stop and send' : 'Click to start speaking into your neckband'}
            disabled={isTranscribing}
          >
            {isTranscribing ? (
              <RefreshCw size={36} color="white" className="spin-slow" />
            ) : isListening ? (
              <MicOff size={42} color="white" />
            ) : (
              <Mic size={42} color="white" />
            )}
          </button>
        </div>

        {/* Live Audio Level VU Meter during speech */}
        {isListening && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            padding: '6px 16px',
            borderRadius: 99
          }}>
            <Activity size={14} color={volumeLevel > 15 ? 'var(--emerald)' : 'var(--text-muted)'} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Neckband Input:</span>
            <div style={{ width: 100, height: 6, background: 'var(--bg-input)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${volumeLevel}%`,
                background: volumeLevel > 15 ? 'var(--emerald)' : 'var(--text-muted)',
                transition: 'width 0.05s ease'
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: volumeLevel > 15 ? 'var(--emerald)' : 'var(--text-muted)' }}>
              {volumeLevel > 15 ? 'Hearing sound' : 'Listening...'}
            </span>
          </div>
        )}

        {/* Live Interim Transcript Bubble */}
        {(interimTranscript || transcript) && (
          <div className="voice-interim-bubble">
            <span style={{ color: 'var(--accent-light)', marginRight: 6 }}>You:</span>
            <span>"{transcript || interimTranscript}"</span>
            {isListening && <span className="cursor-blink" />}
          </div>
        )}

        {/* Quick Voice Actions Bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12 }}>
          {isSpeaking && (
            <button className="btn btn-secondary btn-sm" onClick={handleInterrupt} style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>
              <Square size={13} style={{ marginRight: 4 }} />
              Interrupt
            </button>
          )}

          {lastAssistantText && !isSpeaking && (
            <button className="btn btn-secondary btn-sm" onClick={handleRepeatLast} title="Repeat last answer">
              <RotateCcw size={13} style={{ marginRight: 4 }} />
              Repeat
            </button>
          )}

          {isListening && transcript.trim() && (
            <button className="btn btn-primary btn-sm" onClick={() => sendSpokenMessage(transcript)}>
              <Send size={13} style={{ marginRight: 4 }} />
              Send Speech
            </button>
          )}
        </div>

        {/* Warning if Speech API is unsupported */}
        {!sttSupported && (
          <div className="setup-alert-card" style={{ maxWidth: 480, marginTop: 20 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <AlertCircle size={18} color="var(--amber)" />
              <div style={{ fontSize: 12 }}>
                <strong>Microphone recognition note:</strong> Web Speech API is supported in Google Chrome and Microsoft Edge. Please use Chrome or Edge for full voice conversation.
              </div>
            </div>
          </div>
        )}

        {/* Written Transcript Feed (Optional) */}
        {showTranscript && (
          <div className="voice-transcript-drawer" style={{ width: '100%', maxWidth: 760, marginTop: 24, borderRadius: 'var(--radius-md)', padding: 14 }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Conversation Transcript</span>
              <button
                className="btn-icon-subtle"
                onClick={() => setConversation([{ role: 'assistant', text: 'Chat cleared. How can I help you today?' }])}
                style={{ fontSize: 10, padding: '2px 6px' }}
              >
                Clear
              </button>
            </div>
            <div className="voice-transcript-list" style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conversation.map((msg, i) => (
                <div key={i} className={`voice-message-row ${msg.role}`} style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-input)',
                  color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  fontSize: 13,
                  lineHeight: 1.5
                }}>
                  <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>
                    {msg.role === 'user' ? 'You' : 'Nilesh AI'}
                  </div>
                  <div>{msg.text}</div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>
          </div>
        )}
      </div>

      {/* Fallback Text Input Bar */}
      <footer className="chat-input-footer" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="chat-input-container" style={{ borderRadius: 99, padding: '6px 10px 6px 16px' }}>
          <input
            type="text"
            className="chat-textarea"
            placeholder="Or type here if you prefer to type…"
            value={fallbackInput}
            onChange={(e) => setFallbackInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleManualSend();
              }
            }}
            disabled={isThinking}
            style={{ height: 36, padding: 0 }}
          />
          <button
            className="send-message-btn"
            onClick={handleManualSend}
            disabled={!fallbackInput.trim() || isThinking}
            title="Send text"
          >
            <Send size={15} color="white" />
          </button>
        </div>
      </footer>
    </div>
  );
}
