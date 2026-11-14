import { useState, type FormEvent } from 'react';
import { ArrowLeft, Mic, MicOff, PenLine } from 'lucide-react';
import type { ExperienceInputMode } from '../../types/business';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { EXPERIENCE_MAX, validateExperience } from '../../utils/validation';
import { Button } from '../common/Button';
import { TextArea } from '../common/TextArea';
import { Alert } from '../common/Alert';
import { cn } from '../../utils/cn';

interface Props {
  mode: ExperienceInputMode;
  initialText: string;
  onModeChange: (mode: ExperienceInputMode) => void;
  onBack: () => void;
  onSubmit: (text: string) => void;
}

export function ExperienceStep({ mode, initialText, onModeChange, onBack, onSubmit }: Props) {
  const [text, setText] = useState(initialText);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeechRecognition();

  const value = mode === 'voice' ? speech.transcript : text;
  const setValue = mode === 'voice' ? speech.setTranscript : setText;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (speech.listening) speech.stop();
    const msg = validateExperience(value);
    setError(msg);
    if (!msg) onSubmit(value.trim());
  }

  function switchToText() {
    if (speech.listening) speech.stop();
    setText(value);
    setError(null);
    onModeChange('text');
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {mode === 'voice' ? 'Tell us about your visit' : 'Describe your experience'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Food, service, ambience, value — mention whatever stood out, including anything we could improve.
        </p>
      </div>

      {mode === 'voice' && !speech.isSupported && (
        <Alert tone="warning">
          <p>Voice input isn't supported in this browser. Try Chrome or Edge, or type your experience instead.</p>
          <Button type="button" variant="secondary" className="mt-2" onClick={switchToText}>
            <PenLine className="h-4 w-4" aria-hidden /> Type instead
          </Button>
        </Alert>
      )}

      {mode === 'voice' && speech.isSupported && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? 'Stop recording' : 'Start speaking'}
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              speech.listening ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-500 motion-safe:animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500',
            )}
          >
            {speech.listening ? <MicOff className="h-7 w-7" aria-hidden /> : <Mic className="h-7 w-7" aria-hidden />}
          </button>
          <p className="text-sm text-slate-600" aria-live="polite">
            {speech.listening ? 'Listening… tap to stop' : value ? 'Tap to add more' : 'Tap the microphone and start speaking'}
          </p>
          {speech.interim && <p className="text-center text-sm italic text-slate-500">{speech.interim}</p>}
          <p className="text-xs text-slate-400">Your voice is not recorded or stored.</p>
        </div>
      )}

      {speech.error && mode === 'voice' && (
        <Alert tone="error">
          <p>{speech.error}</p>
          <button type="button" className="font-medium underline" onClick={switchToText}>Type instead</button>
        </Alert>
      )}

      {(mode === 'text' || (speech.isSupported && (value || !speech.listening))) && (
        <TextArea
          label={mode === 'voice' ? 'Recognised text (you can edit it)' : 'Your experience'}
          rows={mode === 'voice' ? 5 : 7}
          value={value}
          readOnly={speech.listening}
          maxLength={EXPERIENCE_MAX}
          placeholder={mode === 'voice' ? 'Your words will appear here…' : 'e.g. The biryani was flavourful, but we waited 30 minutes for our order…'}
          hint={`${value.trim().length}/${EXPERIENCE_MAX} characters`}
          error={error}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button type="submit" disabled={mode === 'voice' && !speech.isSupported}>Continue</Button>
      </div>
    </form>
  );
}
