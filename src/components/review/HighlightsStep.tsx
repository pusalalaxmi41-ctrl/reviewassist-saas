import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Mic,
  MicOff,
  PenLine,
} from 'lucide-react';
import type {
  BusinessCategory,
  ExperienceInputMode,
  ExperienceRating,
} from '../../types/business';
import {
  composeExperienceText,
  getCategoryExperience,
  getRatingOption,
} from '../../config/reviewExperience';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { validateExperience } from '../../utils/validation';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';
import { cn } from '../../utils/cn';

interface Props {
  category: BusinessCategory;
  rating: ExperienceRating;
  mode: ExperienceInputMode;
  initialLikedIds: string[];
  initialImproveIds: string[];
  initialNote: string;
  onModeChange: (mode: ExperienceInputMode) => void;
  onSubmit: (payload: {
    text: string;
    likedIds: string[];
    improveIds: string[];
    note: string;
  }) => void;
}

export function HighlightsStep({
  category,
  rating,
  mode,
  initialLikedIds,
  initialImproveIds,
  initialNote,
  onModeChange,
  onSubmit,
}: Props) {
  const cat = getCategoryExperience(category);
  const ratingMeta = getRatingOption(rating);

  const [likedIds, setLikedIds] = useState<string[]>(initialLikedIds);
  const [improveIds, setImproveIds] = useState<string[]>(initialImproveIds);
  const [note, setNote] = useState(initialNote);
  const [showNote, setShowNote] = useState(
    Boolean(initialNote.trim()) || mode === 'voice',
  );
  const [showImproveForGood, setShowImproveForGood] = useState(
    rating === 'average' || rating === 'not_good' || initialImproveIds.length > 0,
  );
  const [error, setError] = useState<string | null>(null);

  const speech = useSpeechRecognition();
  const activeNote = mode === 'voice' ? speech.transcript || note : note;

  function toggleLiked(id: string) {
    setLikedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (error) setError(null);
  }

  function toggleImprove(id: string) {
    setImproveIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (error) setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (speech.listening) speech.stop();

    const liked = cat.liked.filter((o) => likedIds.includes(o.id));
    const improve = cat.improve.filter((o) => improveIds.includes(o.id));
    const combined = composeExperienceText({
      rating,
      liked,
      improve,
      note: activeNote,
    });

    const msg = validateExperience(combined);
    if (msg) {
      setError('Please tap at least 1 option or add a short note so we can write your review.');
      return;
    }

    onSubmit({
      text: combined,
      likedIds,
      improveIds,
      note: activeNote,
    });
  }

  const isNegative = rating === 'not_good';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div className="text-center space-y-1">
        <h2 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[26px]">
          {ratingMeta?.highlightTitle ?? 'What did you like?'}
        </h2>
        <p className="text-[14px] text-[#626B65]">
          {ratingMeta?.highlightSubtitle ?? 'Choose all that apply.'}
        </p>
      </div>

      {/* Primary Option Grid (Liked for positive/good/average, Improve for not_good) */}
      {!isNegative && (
        <div className="grid grid-cols-2 gap-2.5">
          {cat.liked.map((opt) => {
            const active = likedIds.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleLiked(opt.id)}
                aria-pressed={active}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[14px] font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
                  active
                    ? 'border-[#244B40] bg-[#EEF3EC] text-[#244B40] font-semibold ring-1 ring-[#244B40]'
                    : 'border-[#DDE4DC] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40]/60',
                )}
              >
                <span className="text-lg leading-none shrink-0" aria-hidden>
                  {opt.emoji}
                </span>
                <span className="truncate">{opt.label}</span>
                {active && (
                  <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#244B40] text-white">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Improvement Options (Shown upfront for average/not_good, or expandable for good/excellent) */}
      {!showImproveForGood ? (
        <button
          type="button"
          onClick={() => setShowImproveForGood(true)}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[#626B65] hover:text-[#244B40] cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
          Anything that could be better? (optional)
        </button>
      ) : (
        <div className="space-y-2">
          {!isNegative && (
            <p className="text-[13px] font-semibold text-[#626B65]">
              What could be better? (optional)
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {cat.improve.map((opt) => {
              const active = improveIds.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleImprove(opt.id)}
                  aria-pressed={active}
                  className={cn(
                    'relative flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-[14px] font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
                    active
                      ? 'border-[#244B40] bg-[#FAF3DF] text-[#252B29] font-semibold ring-1 ring-[#E4BD63]'
                      : 'border-[#DDE4DC] bg-[#FFFFFF] text-[#252B29] hover:border-[#244B40]/60',
                  )}
                >
                  <span className="text-lg leading-none shrink-0" aria-hidden>
                    {opt.emoji}
                  </span>
                  <span className="truncate">{opt.label}</span>
                  {active && (
                    <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#244B40] text-white">
                      <Check className="h-3 w-3" aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Collapsible Short Note / Voice Box (matching screenshot's "Add a short note (optional) >") */}
      {!showNote ? (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="flex w-full items-center justify-between rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] px-4 py-3 text-left text-[14px] font-medium text-[#252B29] hover:border-[#244B40] transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-2.5">
            <PenLine className="h-4 w-4 text-[#244B40]" aria-hidden />
            <span>Add a short note <span className="text-[#626B65]">(optional)</span></span>
          </span>
          <ChevronRight className="h-4 w-4 text-[#626B65]" aria-hidden />
        </button>
      ) : (
        <div className="space-y-2.5 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowNote(false)}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#252B29] cursor-pointer"
            >
              <ChevronDown className="h-4 w-4 text-[#244B40]" aria-hidden />
              Short note (optional)
            </button>

            {speech.isSupported && (
              <button
                type="button"
                onClick={() => {
                  if (mode === 'voice' && speech.listening) {
                    speech.stop();
                  } else {
                    onModeChange('voice');
                    speech.start();
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors cursor-pointer',
                  speech.listening
                    ? 'bg-red-600 text-white'
                    : 'bg-[#FFFFFF] border border-[#DDE4DC] text-[#244B40] hover:border-[#244B40]',
                )}
              >
                {speech.listening ? (
                  <>
                    <MicOff className="h-3.5 w-3.5" aria-hidden /> Stop Mic
                  </>
                ) : (
                  <>
                    <Mic className="h-3.5 w-3.5" aria-hidden /> Speak
                  </>
                )}
              </button>
            )}
          </div>

          {speech.error && (
            <Alert tone="warning">
              <p className="text-[12px]">{speech.error}</p>
            </Alert>
          )}

          <textarea
            rows={3}
            value={activeNote}
            onChange={(e) => {
              if (mode === 'voice') speech.setTranscript(e.target.value);
              setNote(e.target.value);
              if (error) setError(null);
            }}
            placeholder={cat.notePlaceholder}
            className="block w-full rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] px-3 py-2.5 text-[14px] text-[#252B29] placeholder:text-[#626B65] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
          />
          {speech.interim && (
            <p className="text-[12px] italic text-[#626B65]">
              Listening: {speech.interim}
            </p>
          )}
        </div>
      )}

      {error && (
        <Alert tone="error">
          <p className="text-[13px]">{error}</p>
        </Alert>
      )}

      <Button
        type="submit"
        className="w-full rounded-full text-[15px] font-semibold"
      >
        Write My Review <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}
