import { useState, type FormEvent } from 'react';
import { ArrowLeft, Check, Mic, MicOff, PenLine, Sparkles } from 'lucide-react';
import type { BusinessCategory, ExperienceInputMode } from '../../types/business';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { EXPERIENCE_MAX, validateExperience } from '../../utils/validation';
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

const CATEGORY_QUICK_TAGS: Record<BusinessCategory, QuickTag[]> = {
  restaurant: [
    { id: 'r1', label: 'Food was excellent & super tasty', phrase: 'the food was excellent and super tasty', tone: 'positive' },
    { id: 'r2', label: 'Fresh & hot food', phrase: 'the food was served fresh and hot', tone: 'positive' },
    { id: 'r3', label: 'Good water & clean hygiene', phrase: 'drinking water and table hygiene were clean and good', tone: 'positive' },
    { id: 'r4', label: 'Nice ambience', phrase: 'the ambience and seating were nice and comfortable', tone: 'positive' },
    { id: 'r5', label: 'Polite staff & quick service', phrase: 'the staff were polite and service was quick', tone: 'positive' },
    { id: 'r6', label: 'Good value for money', phrase: 'the pricing felt reasonable and worth it', tone: 'positive' },
    { id: 'r7', label: 'Food was decent / average', phrase: 'the food taste was decent and okay', tone: 'neutral' },
    { id: 'r8', label: 'Service was a bit slow', phrase: 'service took a little longer than expected', tone: 'construct' },
    { id: 'r9', label: 'Recommend people to eat here', phrase: 'I recommend others to try the food here', tone: 'positive' },
  ],
  cafe: [
    { id: 'c1', label: 'Coffee & snacks were super tasty', phrase: 'the coffee and snacks were really tasty', tone: 'positive' },
    { id: 'c2', label: 'Freshly made items', phrase: 'everything we ordered was fresh', tone: 'positive' },
    { id: 'c3', label: 'Good water & clean tables', phrase: 'drinking water was good and tables were clean', tone: 'positive' },
    { id: 'c4', label: 'Cozy ambience & vibe', phrase: 'the cafe has a nice and relaxed ambience', tone: 'positive' },
    { id: 'c5', label: 'Friendly staff', phrase: 'the staff were friendly and helpful', tone: 'positive' },
    { id: 'c6', label: 'Taste was decent / okay', phrase: 'the taste was decent overall', tone: 'neutral' },
    { id: 'c7', label: 'Order took a little time', phrase: 'the order took a bit of waiting time', tone: 'construct' },
    { id: 'c8', label: 'Recommend visiting with friends', phrase: 'I recommend this spot to hang out and grab a bite', tone: 'positive' },
  ],
  pg: [
    { id: 'p1', label: 'Rooms are clean & well maintained', phrase: 'the rooms and common areas are clean and well maintained', tone: 'positive' },
    { id: 'p2', label: 'Homely & tasty food', phrase: 'the PG food is homely and tastes really good', tone: 'positive' },
    { id: 'p3', label: 'Good drinking water & 24/7 water', phrase: 'drinking water quality and water supply are good', tone: 'positive' },
    { id: 'p4', label: 'Good ambience & peaceful stay', phrase: 'the environment is peaceful and safe', tone: 'positive' },
    { id: 'p5', label: 'Fast Wi-Fi & power backup', phrase: 'Wi-Fi and power backup work reliably', tone: 'positive' },
    { id: 'p6', label: 'Helpful owner & staff', phrase: 'the owner and staff are polite and cooperative', tone: 'positive' },
    { id: 'p7', label: 'Food is decent / average', phrase: 'the daily food is decent and manageable', tone: 'neutral' },
    { id: 'p8', label: 'Wi-Fi or maintenance could improve', phrase: 'Wi-Fi speed or maintenance response could be a little better', tone: 'construct' },
    { id: 'p9', label: 'Recommend this PG to others', phrase: 'I recommend this PG for students and working people', tone: 'positive' },
  ],
  hotel: [
    { id: 'h1', label: 'Clean & comfortable rooms', phrase: 'the room and bed were clean and comfortable', tone: 'positive' },
    { id: 'h2', label: 'Food & breakfast were excellent', phrase: 'the food and breakfast were really tasty', tone: 'positive' },
    { id: 'h3', label: 'Good water & clean washroom', phrase: 'the washroom was clean with good water supply', tone: 'positive' },
    { id: 'h4', label: 'Nice ambience & peaceful location', phrase: 'the property has a nice ambience and quiet atmosphere', tone: 'positive' },
    { id: 'h5', label: 'Polite staff & smooth check-in', phrase: 'the staff were polite and check-in was smooth', tone: 'positive' },
    { id: 'h6', label: 'Stay was decent for the price', phrase: 'the stay was decent for the price paid', tone: 'neutral' },
    { id: 'h7', label: 'Room service was a bit slow', phrase: 'room service took a little extra time', tone: 'construct' },
    { id: 'h8', label: 'Recommend staying here', phrase: 'I recommend this place for a comfortable stay', tone: 'positive' },
  ],
};

interface Props {
  category?: BusinessCategory;
  mode: ExperienceInputMode;
  initialText: string;
  onModeChange: (mode: ExperienceInputMode) => void;
  onBack: () => void;
  onSubmit: (text: string) => void;
}

export function ExperienceStep({
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

  const quickTags = CATEGORY_QUICK_TAGS[category] ?? CATEGORY_QUICK_TAGS.restaurant;

  const value = mode === 'voice' ? speech.transcript : text;
  const setValue = mode === 'voice' ? speech.setTranscript : setText;

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (speech.listening) speech.stop();

    const combined = buildCombinedExperience();
    if (selectedTagIds.length === 0 && combined.length < 20) {
      setError('Tap one or more quick options above, or write at least 20 characters about your visit.');
      return;
    }

    const msg = validateExperience(combined);
    setError(msg);
    if (!msg) onSubmit(combined);
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
          {mode === 'voice' ? 'Tell us about your visit' : 'How was your experience?'}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Tap the options that match your visit, or add your own words below.
        </p>
      </div>

      {/* Quick Tap Options */}
      <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            Quick Tap Highlights ({selectedTagIds.length} selected)
          </span>
          {selectedTagIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedTagIds([])}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {quickTags.map((tag) => {
            const active = selectedTagIds.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer',
                  active
                    ? tag.tone === 'construct'
                      ? 'border-amber-600 bg-amber-600 text-white shadow-xs'
                      : 'border-indigo-600 bg-indigo-600 text-white shadow-xs'
                    : tag.tone === 'construct'
                      ? 'border-amber-200 bg-white text-amber-900 hover:border-amber-300 hover:bg-amber-50/60'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/50',
                )}
              >
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                {tag.label}
              </button>
            );
          })}
        </div>
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
              speech.listening
                ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-500 motion-safe:animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-700 focus-visible:ring-indigo-500',
            )}
          >
            {speech.listening ? <MicOff className="h-7 w-7" aria-hidden /> : <Mic className="h-7 w-7" aria-hidden />}
          </button>
          <p className="text-sm text-slate-600" aria-live="polite">
            {speech.listening
              ? 'Listening… tap to stop'
              : value
                ? 'Tap to add more'
                : 'Optional: Tap the mic to add extra details'}
          </p>
          {speech.interim && <p className="text-center text-sm italic text-slate-500">{speech.interim}</p>}
          <p className="text-xs text-slate-400">Your voice is not recorded or stored.</p>
        </div>
      )}

      {speech.error && mode === 'voice' && (
        <Alert tone="error">
          <p>{speech.error}</p>
          <button type="button" className="font-medium underline" onClick={switchToText}>
            Type instead
          </button>
        </Alert>
      )}

      {(mode === 'text' || (speech.isSupported && (value || !speech.listening))) && (
        <TextArea
          label={
            selectedTagIds.length > 0
              ? 'Add any extra detail or dish/room name (optional)'
              : mode === 'voice'
                ? 'Recognised text (you can edit it)'
                : 'Or write in your own words'
          }
          rows={4}
          value={value}
          readOnly={speech.listening}
          maxLength={EXPERIENCE_MAX}
          placeholder={
            mode === 'voice'
              ? 'Your words will appear here…'
              : 'Optional if you selected tags above — e.g. tried the paneer biryani, or stayed in 2-sharing room…'
          }
          hint={
            selectedTagIds.length > 0
              ? `${selectedTagIds.length} quick highlight(s) ready — you can click Continue anytime`
              : `${value.trim().length}/${EXPERIENCE_MAX} characters`
          }
          error={error}
          onChange={(e) => {
            setValue(e.target.value);
            if (error) setError(null);
          }}
        />
      )}

      {error && mode === 'voice' && speech.listening && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </Button>
        <Button type="submit" disabled={mode === 'voice' && !speech.isSupported && selectedTagIds.length === 0}>
          Continue
        </Button>
      </div>
    </form>
  );
}
