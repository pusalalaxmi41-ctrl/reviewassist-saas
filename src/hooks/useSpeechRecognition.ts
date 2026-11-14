import { useCallback, useEffect, useRef, useState } from 'react';

// Minimal typings — the Web Speech API is not in TypeScript's DOM lib.
interface SpeechResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function errorMessage(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow microphone access in your browser settings, or type your experience instead.';
    case 'audio-capture':
      return 'No microphone was found. Please check your device or type your experience instead.';
    case 'no-speech':
      return "We didn't hear anything. Tap the microphone and try again.";
    case 'network':
      return 'Speech recognition needs an internet connection. Please try again or type instead.';
    default:
      return 'Something went wrong with voice input. Please try again or type instead.';
  }
}

/** Browser speech-to-text. Audio is processed by the browser only; nothing is recorded or stored by this app. */
export function useSpeechRecognition(lang = 'en-IN') {
  const [isSupported] = useState(() => Boolean(getCtor()));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (finalText) setTranscript((prev) => `${prev} ${finalText}`.trim());
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setError(errorMessage(e.error));
    };
    rec.onend = () => {
      setListening(false);
      setInterim('');
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError(errorMessage('unknown'));
    }
  }, [lang]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { isSupported, listening, transcript, setTranscript, interim, error, start, stop };
}
