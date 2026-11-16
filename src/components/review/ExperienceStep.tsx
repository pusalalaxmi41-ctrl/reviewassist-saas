import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Mic,
  MicOff,
  PenLine,
  Sparkles,
} from 'lucide-react';
import type { BusinessCategory, ExperienceInputMode } from '../../types/business';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import {
  EXPERIENCE_MAX,
  EXPERIENCE_MIN,
  validateExperience,
} from '../../utils/validation';
import { Button } from '../common/Button';
import { TextArea } from '../common/TextArea';
import { Alert } from '../common/Alert';
import { cn } from '../../utils/cn';

interface QuickTag {
  id: string;
  label: string;
  phrase: string;
  tone: 'positive' | 'neutral' | 'construct';
}

const CATEGORY_QUICK_TAGS: Partial<Record<BusinessCategory, QuickTag[]>> = {
  restaurant: [
    { id: 'r1', label: 'Food was tasty & fresh', phrase: 'the food was fresh and really tasty', tone: 'positive' },
    { id: 'r2', label: 'Clean hygiene & water', phrase: 'table hygiene and drinking water were clean', tone: 'positive' },
    { id: 'r3', label: 'Comfortable ambience', phrase: 'the ambience and seating were comfortable', tone: 'positive' },
    { id: 'r4', label: 'Polite staff & quick service', phrase: 'the staff were polite and service was quick', tone: 'positive' },
    { id: 'r5', label: 'Good value for money', phrase: 'the pricing felt reasonable for the quality', tone: 'positive' },
    { id: 'r6', label: 'Food was decent / average', phrase: 'the food was decent overall', tone: 'neutral' },
    { id: 'r7', label: 'Service was a bit slow', phrase: 'service took a little longer than expected', tone: 'construct' },
  ],
  cafe: [
    { id: 'c1', label: 'Coffee & snacks were great', phrase: 'the coffee and snacks were really good', tone: 'positive' },
    { id: 'c2', label: 'Freshly prepared items', phrase: 'everything we ordered was fresh', tone: 'positive' },
    { id: 'c3', label: 'Clean tables & good water', phrase: 'tables were clean and drinking water was good', tone: 'positive' },
    { id: 'c4', label: 'Relaxed ambience', phrase: 'the cafe has a calm, relaxed ambience', tone: 'positive' },
    { id: 'c5', label: 'Friendly staff', phrase: 'the staff were friendly and helpful', tone: 'positive' },
    { id: 'c6', label: 'Taste was decent / okay', phrase: 'the taste was decent overall', tone: 'neutral' },
    { id: 'c7', label: 'Order took some waiting time', phrase: 'our order took a bit of waiting time', tone: 'construct' },
  ],
  pg: [
    { id: 'p1', label: 'Clean & well-maintained rooms', phrase: 'the rooms and common areas are clean and well maintained', tone: 'positive' },
    { id: 'p2', label: 'Homely food', phrase: 'the daily food is homely and tastes good', tone: 'positive' },
    { id: 'p3', label: 'Good water supply', phrase: 'drinking water and 24/7 water supply are reliable', tone: 'positive' },
    { id: 'p4', label: 'Peaceful & safe stay', phrase: 'the environment is peaceful and safe', tone: 'positive' },
    { id: 'p5', label: 'Reliable Wi-Fi & power backup', phrase: 'Wi-Fi and power backup work reliably', tone: 'positive' },
    { id: 'p6', label: 'Helpful owner & staff', phrase: 'the owner and staff are polite and cooperative', tone: 'positive' },
    { id: 'p7', label: 'Food is average / decent', phrase: 'the daily food is decent and manageable', tone: 'neutral' },
    { id: 'p8', label: 'Maintenance or Wi-Fi could improve', phrase: 'Wi-Fi speed and maintenance response could be improved', tone: 'construct' },
  ],
  hotel: [
    { id: 'h1', label: 'Clean & comfortable room', phrase: 'the room and bedding were clean and comfortable', tone: 'positive' },
    { id: 'h2', label: 'Good food & breakfast', phrase: 'the food and breakfast were tasty', tone: 'positive' },
    { id: 'h3', label: 'Clean washroom & hot water', phrase: 'the washroom was clean with reliable water supply', tone: 'positive' },
    { id: 'h4', label: 'Quiet & pleasant location', phrase: 'the property has a quiet and pleasant atmosphere', tone: 'positive' },
    { id: 'h5', label: 'Polite staff & smooth check-in', phrase: 'the staff were polite and check-in was smooth', tone: 'positive' },
    { id: 'h6', label: 'Decent stay for the price', phrase: 'the stay was decent for the price paid', tone: 'neutral' },
    { id: 'h7', label: 'Room service was a bit slow', phrase: 'room service took a little extra time', tone: 'construct' },
  ],
};

interface Props {
  businessName?: string;
  category?: BusinessCategory;
  mode: ExperienceInputMode;
  initialText: string;
  onModeChange: (mode: ExperienceInputMode) => void;
  onBack: () => void;
  onSubmit: (text: string) => void;
}

export function ExperienceStep({
  businessName,
  category = 'restaurant',
  mode,
  initialText,
  onModeChange,
  onBack,
  onSubmit,
}: Props) {
  const [text, setText] = useState(initialText);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const speech = useSpeechRecognition();

  const quickTags =
    CATEGORY_QUICK_TAGS[category] ?? CATEGORY_QUICK_TAGS.restaurant ?? [];

  const value = mode === 'voice' ? speech.transcript || text : text;

  function updateValue(next: string) {
    if (mode === 'voice') {
      speech.setTranscript(next);
    }
    setText(next);
    if (error) setError(null);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
    if (error) setError(null);
  }

  function buildCombinedExperience(): string {
    const selectedPhrases = quickTags
      .filter((t) => selectedTagIds.includes(t.id))
      .map((t) => t.phrase);

    const customNote = value.trim();

    if (selectedPhrases.length > 0 && customNote.length > 0) {
      return `${selectedPhrases.join(', ')}. ${customNote}`;
    }
    if (selectedPhrases.length > 0) {
      return `${selectedPhrases.join(', ')}.`;
    }
    return customNote;
  }

  function handleModeSwitch(nextMode: ExperienceInputMode) {
    if (nextMode === mode) return;
    if (speech.listening) {
      speech.stop();
    }
    // Preserve current transcript/text across mode switches
    if (mode === 'voice' && speech.transcript.trim()) {
      setText(speech.transcript);
    } else if (mode === 'text' && text.trim()) {
      speech.setTranscript(text);
    }
    setError(null);
    onModeChange(nextMode);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (speech.listening) speech.stop();

    const combined = buildCombinedExperience();
    const validationMsg = validateExperience(combined);
    setError(validationMsg);
    if (!validationMsg) {
      onSubmit(combined);
    }
  }

  const combinedPreviewLength = buildCombinedExperience().length;
  const meetsMinChars = combinedPreviewLength >= EXPERIENCE_MIN;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Header & Input Mode Segmented Toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight text-[#252B29] sm:text-[22px]">
            Share your experience{businessName ? ` at ${businessName}` : ''}
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-[#626B65]">
            Tell us what stood out or what could be improved. We only use the facts you share.
          </p>
        </div>

        <div
          className="inline-flex shrink-0 self-start rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-1 text-[13px]"
          role="tablist"
          aria-label="Input mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'text'}
            onClick={() => handleModeSwitch('text')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
              mode === 'text'
                ? 'bg-[#FFFFFF] text-[#252B29] shadow-2xs font-semibold'
                : 'text-[#626B65] hover:text-[#252B29]',
            )}
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden />
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'voice'}
            onClick={() => handleModeSwitch('voice')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
              mode === 'voice'
                ? 'bg-[#FFFFFF] text-[#252B29] shadow-2xs font-semibold'
                : 'text-[#626B65] hover:text-[#252B29]',
            )}
          >
            <Mic className="h-3.5 w-3.5" aria-hidden />
            Voice-to-text
          </button>
        </div>
      </div>

      {/* Optional Quick-Tap Highlights */}
      <div className="space-y-2.5 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-3.5 sm:p-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#252B29]">
            <Sparkles className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
            Quick highlights (tap what fits your visit — no typing needed)
            {selectedTagIds.length > 0 && (
              <span className="rounded-full border border-[#A8BFA5] bg-[#EEF3EC] px-2 py-0.5 text-[12px] font-semibold text-[#244B40]">
                {selectedTagIds.length} selected
              </span>
            )}
          </span>
          {selectedTagIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTagIds([])}
              className="text-[13px] font-medium text-[#244B40] hover:underline cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {quickTags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
                  active
                    ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF] shadow-2xs'
                    : 'border-[#DDE4DC] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40] hover:bg-[#EEF3EC]/60',
                )}
              >
                {active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
                {tag.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Voice-to-Text Panel */}
      {mode === 'voice' && !speech.isSupported && (
        <Alert tone="warning">
          <p className="font-medium">
            Browser speech recognition is not available in this browser.
          </p>
          <p className="mt-0.5 text-[13px]">
            Please use Chrome, Edge, or Safari for voice-to-text, or switch to writing below.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="mt-2.5"
            onClick={() => handleModeSwitch('text')}
          >
            <PenLine className="h-4 w-4" aria-hidden /> Switch to typing
          </Button>
        </Alert>
      )}

      {mode === 'voice' && speech.isSupported && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[#A8BFA5] bg-[#EEF3EC]/60 p-5 text-center">
          <button
            type="button"
            onClick={speech.listening ? speech.stop : speech.start}
            aria-pressed={speech.listening}
            aria-label={speech.listening ? 'Stop voice-to-text' : 'Start voice-to-text'}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-full text-[#FFFFFF] shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer',
              speech.listening
                ? 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-600 ring-4 ring-red-100 motion-safe:animate-pulse'
                : 'bg-[#244B40] hover:bg-[#1C3B32] focus-visible:ring-[#244B40]',
            )}
          >
            {speech.listening ? (
              <MicOff className="h-6 w-6" aria-hidden />
            ) : (
              <Mic className="h-6 w-6" aria-hidden />
            )}
          </button>

          <div className="space-y-0.5">
            <p className="text-[15px] font-medium text-[#252B29]" aria-live="polite">
              {speech.listening
                ? 'Listening — speak naturally, then tap to stop'
                : value
                  ? 'Tap the microphone to add more'
                  : 'Tap the microphone to speak your experience'}
            </p>
            {speech.interim && (
              <p className="text-[13px] italic text-[#244B40]">{speech.interim}</p>
            )}
            <p className="text-[13px] text-[#626B65]">
              Voice-to-text happens in your browser. Audio is never recorded, uploaded, or stored.
            </p>
          </div>
        </div>
      )}

      {speech.error && mode === 'voice' && (
        <Alert tone="error">
          <p>{speech.error}</p>
          <button
            type="button"
            className="mt-1 text-[13px] font-semibold underline cursor-pointer"
            onClick={() => handleModeSwitch('text')}
          >
            Switch to typing instead
          </button>
        </Alert>
      )}

      {/* Main Text Input (Always visible & editable so customer can refine text or voice transcript) */}
      <div className="space-y-1.5">
        <TextArea
          label={
            mode === 'voice'
              ? 'Voice-to-text transcript (you can edit or type here)'
              : 'Your experience in your own words'
          }
          rows={4}
          value={value}
          readOnly={speech.listening}
          maxLength={EXPERIENCE_MAX}
          placeholder={
            mode === 'voice'
              ? 'Your spoken words will appear here as text…'
              : 'Tell us what you ordered or experienced, how the service or cleanliness was, and any honest feedback…'
          }
          error={error}
          onChange={(e) => updateValue(e.target.value)}
        />

        <div className="flex items-center justify-between px-0.5 text-[13px]">
          <span
            className={cn(
              'transition-colors',
              meetsMinChars ? 'text-[#244B40] font-medium' : 'text-[#626B65]',
            )}
          >
            {meetsMinChars
              ? 'Ready to create your review'
              : `At least ${EXPERIENCE_MIN} characters needed (${Math.max(0, EXPERIENCE_MIN - combinedPreviewLength)} more)`}
          </span>
          <span className="font-mono text-[13px] text-[#626B65]">
            {value.length}/{EXPERIENCE_MAX}
          </span>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button type="submit">
          Create Review Draft <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}
