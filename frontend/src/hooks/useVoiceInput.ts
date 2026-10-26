// src/hooks/useVoiceInput.ts — Dual-Engine Voice Input (Web Speech API + Gemini Multimodal Fallback) with Bluetooth Neckband Support
import { useState, useEffect, useRef, useCallback } from 'react';

// Declare Web Speech API types for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export type SupportedVoiceLang = 'en-US' | 'en-IN' | 'hi-IN' | 'gu-IN';

export interface AudioInputDevice {
  deviceId: string;
  label: string;
  isBluetooth: boolean;
  isDefault: boolean;
}

export interface VoiceInputState {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  isSupported: boolean;
  error: string | null;
  language: SupportedVoiceLang;
  volumeLevel: number; // 0 to 100 for live VU meter
  devices: AudioInputDevice[];
  selectedDeviceId: string;
  hasPermission: boolean;
  isTranscribing: boolean; // true while AI multimodal audio transcription is processing
  setLanguage: (lang: SupportedVoiceLang) => void;
  setSelectedDeviceId: (id: string) => void;
  startListening: () => Promise<void>;
  stopListening: () => Promise<string>;
  resetTranscript: () => void;
  refreshDevices: () => Promise<void>;
  testMicrophone: () => Promise<boolean>;
  transcribeRecordedAudio: () => Promise<string>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceInput(
  onTranscriptChunk?: (text: string) => void,
  initialLang: SupportedVoiceLang = 'en-US'
): VoiceInputState {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<SupportedVoiceLang>(initialLang);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string>(() => {
    return localStorage.getItem('nilesh_preferred_mic') || '';
  });
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const onChunkRef = useRef(onTranscriptChunk);

  // Buffer refs for persistent transcription tracking
  const accumulatedTranscriptRef = useRef<string>('');
  const currentInterimRef = useRef<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recorderMimeTypeRef = useRef<string>('audio/webm');

  useEffect(() => {
    onChunkRef.current = onTranscriptChunk;
  }, [onTranscriptChunk]);

  const isSupported = typeof window !== 'undefined' &&
    !!((window as IWindow).SpeechRecognition || (window as IWindow).webkitSpeechRecognition);

  // ── Audio Level Meter (VU Meter) ───────────────────────────────────────────
  const startVolumeMeter = useCallback((stream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        audioContextRef.current = new AudioContextClass();
      }

      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }

      const audioCtx = audioContextRef.current;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100 * 1.5));
        setVolumeLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn('[useVoiceInput] Volume meter failed:', err);
    }
  }, []);

  const stopVolumeMeter = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setVolumeLevel(0);
  }, []);

  // ── Enumerate Audio Input Devices (Neckbands, Headsets, Mics) ───────────────
  const refreshDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');

      const mapped: AudioInputDevice[] = audioInputs.map(d => {
        const lowerLabel = (d.label || '').toLowerCase();
        const isBluetooth = lowerLabel.includes('bluetooth') ||
          lowerLabel.includes('hands-free') ||
          lowerLabel.includes('neckband') ||
          lowerLabel.includes('buds') ||
          lowerLabel.includes('wireless') ||
          lowerLabel.includes('headset');

        return {
          deviceId: d.deviceId,
          label: d.label || (d.deviceId === 'default' ? 'Default Microphone' : `Microphone (${d.deviceId.slice(0, 6)})`),
          isBluetooth,
          isDefault: d.deviceId === 'default',
        };
      });

      setDevices(mapped);

      // Auto-select Bluetooth neckband if found and no specific device selected
      if (!selectedDeviceId && mapped.length > 0) {
        const btDevice = mapped.find(d => d.isBluetooth && d.deviceId !== 'default');
        if (btDevice) {
          setSelectedDeviceIdState(btDevice.deviceId);
          localStorage.setItem('nilesh_preferred_mic', btDevice.deviceId);
        }
      }
    } catch (err) {
      console.warn('[useVoiceInput] enumerateDevices error:', err);
    }
  }, [selectedDeviceId]);

  // Request mic permission on mount to reveal device names
  useEffect(() => {
    refreshDevices();

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  const setSelectedDeviceId = useCallback((id: string) => {
    setSelectedDeviceIdState(id);
    localStorage.setItem('nilesh_preferred_mic', id);

    if (shouldListenRef.current) {
      stopListening().then(() => {
        setTimeout(() => {
          startListening();
        }, 300);
      });
    }
  }, []);

  // ── Fallback Transcribe via Backend Gemini Multimodal ──────────────────────
  const transcribeRecordedAudio = useCallback(async (): Promise<string> => {
    if (recordedChunksRef.current.length === 0) return '';
    setIsTranscribing(true);

    try {
      const mimeType = recorderMimeTypeRef.current || 'audio/webm';
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });

      if (blob.size < 1200) {
        // Less than 1.2KB -> likely silent audio
        setIsTranscribing(false);
        return '';
      }

      const audioBase64 = await blobToBase64(blob);
      const resp = await fetch('/api/comm/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      const transcribed = (data.text || '').trim();

      if (transcribed) {
        accumulatedTranscriptRef.current = transcribed;
        setTranscript(transcribed);
        onChunkRef.current?.(transcribed);
      }

      setIsTranscribing(false);
      return transcribed;
    } catch (err: any) {
      console.warn('[useVoiceInput] Multimodal transcription error:', err.message);
      setIsTranscribing(false);
      return '';
    }
  }, []);

  // ── Web Speech API Setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionAPI = (window as IWindow).SpeechRecognition || (window as IWindow).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const item = event.results[i];
        if (item.isFinal) {
          final += item[0].transcript;
        } else {
          interim += item[0].transcript;
        }
      }

      if (final) {
        setTranscript(prev => {
          const updated = prev ? `${prev} ${final.trim()}` : final.trim();
          accumulatedTranscriptRef.current = updated;
          onChunkRef.current?.(final.trim());
          return updated;
        });
      }

      currentInterimRef.current = interim;
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: any) => {
      console.warn('[useVoiceInput] Speech recognition error event:', event.error);

      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setError('⚠️ Microphone access is blocked. Click the lock icon in your browser address bar and select "Allow" for Microphone.');
        shouldListenRef.current = false;
        setIsListening(false);
      } else if (event.error === 'audio-capture') {
        setError('⚠️ No audio captured. Check if your Bluetooth neckband is connected, powered ON, and not muted in Windows sound settings.');
        shouldListenRef.current = false;
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // Silent pause, normal behavior in speech recognition
      } else if (event.error === 'network') {
        // Network error for cloud speech recognition — we rely on MediaRecorder fallback
        console.info('[useVoiceInput] Web Speech network error. MediaRecorder fallback will transcribe.');
      }
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch {
          setIsListening(false);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {}
    };
  }, [isSupported, language]);

  // ── Start Listening with Device Stream & MediaRecorder Fallback ────────────
  const startListening = useCallback(async () => {
    setError(null);
    setInterimTranscript('');
    accumulatedTranscriptRef.current = '';
    currentInterimRef.current = '';
    recordedChunksRef.current = [];
    shouldListenRef.current = true;

    // 1. Explicitly open microphone stream to activate Bluetooth neckband & verify permission
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        if (selectedDeviceId && selectedDeviceId !== 'default') {
          audioConstraints.deviceId = { exact: selectedDeviceId };
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        streamRef.current = stream;
        setHasPermission(true);

        // Start volume VU meter for visual feedback
        startVolumeMeter(stream);

        // Setup MediaRecorder for raw neckband audio fallback
        try {
          const supportedTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            '',
          ];
          const chosenMime = supportedTypes.find(t => !t || (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t))) || '';
          recorderMimeTypeRef.current = chosenMime || 'audio/webm';

          const recorder = chosenMime ? new MediaRecorder(stream, { mimeType: chosenMime }) : new MediaRecorder(stream);
          recorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };
          recorder.start(200);
          mediaRecorderRef.current = recorder;
        } catch (recErr) {
          console.warn('[useVoiceInput] MediaRecorder init failed:', recErr);
        }

        refreshDevices();
      }
    } catch (mediaErr: any) {
      console.warn('[useVoiceInput] getUserMedia failed:', mediaErr);
      if (mediaErr.name === 'NotAllowedError' || mediaErr.name === 'PermissionDeniedError') {
        setError('⚠️ Microphone access is blocked. Please click the lock/settings icon in your browser address bar and select "Allow" for Microphone.');
        shouldListenRef.current = false;
        setIsListening(false);
        return;
      }
      if (mediaErr.name === 'NotFoundError' || mediaErr.name === 'DevicesNotFoundError') {
        setError('⚠️ No microphone found. Please connect your Bluetooth neckband or headset and try again.');
        shouldListenRef.current = false;
        setIsListening(false);
        return;
      }
    }

    // 2. Start Web Speech API if supported
    if (isSupported) {
      try {
        recognitionRef.current?.start();
      } catch {
        try { recognitionRef.current?.stop(); } catch {}
        setTimeout(() => {
          try { recognitionRef.current?.start(); } catch {}
        }, 150);
      }
    } else {
      setIsListening(true);
    }
  }, [isSupported, selectedDeviceId, startVolumeMeter, refreshDevices]);

  // ── Stop Listening & Return Transcribed Spoken Text ────────────────────────
  const stopListening = useCallback(async (): Promise<string> => {
    shouldListenRef.current = false;

    // 1. Commit any unfinalized interim speech text
    let combined = accumulatedTranscriptRef.current.trim();
    if (currentInterimRef.current.trim()) {
      const pending = currentInterimRef.current.trim();
      combined = combined ? `${combined} ${pending}` : pending;
      accumulatedTranscriptRef.current = combined;
      setTranscript(combined);
      onChunkRef.current?.(pending);
    }

    // 2. Stop Web Speech recognition
    try {
      recognitionRef.current?.stop();
    } catch {}

    // 3. Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
    }

    // 4. Stop VU meter and close hardware mic stream
    stopVolumeMeter();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsListening(false);
    setInterimTranscript('');
    currentInterimRef.current = '';

    // 5. If Web Speech API captured text, return it immediately
    if (combined) {
      return combined;
    }

    // 6. If Web Speech API yielded nothing, fallback to Gemini Multimodal Audio
    if (recordedChunksRef.current.length > 0) {
      await new Promise(r => setTimeout(r, 200));
      const fallbackText = await transcribeRecordedAudio();
      return fallbackText;
    }

    return '';
  }, [stopVolumeMeter, transcribeRecordedAudio]);

  const resetTranscript = useCallback(() => {
    accumulatedTranscriptRef.current = '';
    currentInterimRef.current = '';
    recordedChunksRef.current = [];
    setTranscript('');
    setInterimTranscript('');
  }, []);

  // ── Test Microphone for 4 Seconds ──────────────────────────────────────────
  const testMicrophone = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      const audioConstraints: MediaTrackConstraints = {};
      if (selectedDeviceId && selectedDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: selectedDeviceId };
      }
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      startVolumeMeter(testStream);
      setHasPermission(true);

      let maxDetectedVolume = 0;
      const checkInterval = setInterval(() => {
        setVolumeLevel(cur => {
          if (cur > maxDetectedVolume) maxDetectedVolume = cur;
          return cur;
        });
      }, 100);

      await new Promise(r => setTimeout(r, 4000));

      clearInterval(checkInterval);
      stopVolumeMeter();
      testStream.getTracks().forEach(t => t.stop());

      return maxDetectedVolume > 10;
    } catch (err: any) {
      setError(`Microphone test failed: ${err.message}. Check your Bluetooth connection.`);
      return false;
    }
  }, [selectedDeviceId, startVolumeMeter, stopVolumeMeter]);

  return {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    language,
    volumeLevel,
    devices,
    selectedDeviceId,
    hasPermission,
    isTranscribing,
    setLanguage,
    setSelectedDeviceId,
    startListening,
    stopListening,
    resetTranscript,
    refreshDevices,
    testMicrophone,
    transcribeRecordedAudio,
  };
}

// ── Text-to-Speech (SpeechSynthesis) Helper Hook ──────────────────────────────

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        setVoices(available);
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = useCallback((text: string, langOrOnEnd?: string | (() => void), onEndCallback?: () => void) => {
    if (!supported || !text.trim()) return;

    const langCode = typeof langOrOnEnd === 'string' ? langOrOnEnd : 'en-US';
    const onEnd = typeof langOrOnEnd === 'function' ? langOrOnEnd : onEndCallback;

    window.speechSynthesis.cancel(); // stop any current speech

    // Strip markdown tags and code blocks for natural audio readout
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' [Code block omitted] ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/[#*_~>]/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .slice(0, 1500);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = langCode;

    // Pick appropriate voice if available
    if (voices.length > 0) {
      const prefix = langCode.slice(0, 2).toLowerCase();
      const match = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
      if (match) utterance.voice = match;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      onEnd?.();
    };
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [supported, voices]);

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [supported]);

  return { speak, stop, isSpeaking, supported, voices };
}
