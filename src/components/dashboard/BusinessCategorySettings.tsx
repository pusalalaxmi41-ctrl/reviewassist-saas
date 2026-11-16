import { useState, type FormEvent } from 'react';
import { Building2, Check, Save, Type } from 'lucide-react';
import type { Business, BusinessCategory, ReviewFontStyle } from '../../types/business';
import { businessRepository } from '../../services/storage';
import {
  CATEGORY_EXPERIENCE,
  CATEGORY_ORDER,
  REVIEW_FONTS,
  REVIEW_FONT_ORDER,
} from '../../config/reviewExperience';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
  onUpdated: (updated: Business) => void;
}

export function BusinessCategorySettings({ business, onUpdated }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory>(business.category);
  const [selectedFont, setSelectedFont] = useState<ReviewFontStyle>(
    business.reviewFont ?? 'classic',
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    selectedCategory !== business.category ||
    selectedFont !== (business.reviewFont ?? 'classic');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      let latest = business;
      if (selectedCategory !== business.category) {
        latest = await businessRepository.updateBusinessCategory(
          business.id,
          selectedCategory,
        );
      }
      if (selectedFont !== (business.reviewFont ?? 'classic')) {
        latest = await businessRepository.updateBusinessReviewFont(
          business.id,
          selectedFont,
        );
      }
      onUpdated(latest);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message || 'Unable to update business experience settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 sm:p-6 shadow-2xs space-y-6">
      <div className="border-b border-[#DDE4DC] pb-4">
        <h3 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-[#252B29] sm:text-[20px]">
          <Building2 className="h-5 w-5 text-[#244B40]" aria-hidden />
          Business Category &amp; Customer Review Experience
        </h3>
        <p className="mt-1 text-[13px] text-[#626B65]">
          Pick your business type and the font style shown while AI writes your customer&apos;s review.
        </p>
      </div>

      {saved && (
        <Alert tone="success">
          <p>Saved! Your QR review page now uses this category&apos;s options and writing font.</p>
        </Alert>
      )}

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        {/* 1. Business Category Picker */}
        <div className="space-y-2.5">
          <p className="text-[14px] font-semibold text-[#252B29]">
            1. Business Category (sets QR quick-tap options &amp; emojis)
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORY_ORDER.map((cat) => {
              const cfg = CATEGORY_EXPERIENCE[cat];
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                    active
                      ? 'border-[#244B40] bg-[#EEF3EC]/60 ring-1 ring-[#244B40]'
                      : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#252B29]">
                      <span aria-hidden>{cfg.emoji}</span>
                      {cfg.label}
                    </span>
                    {active && (
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#244B40] text-white">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] text-[#626B65] leading-relaxed line-clamp-2">
                    {cfg.liked
                      .slice(0, 3)
                      .map((o) => `${o.emoji} ${o.label}`)
                      .join(' · ')}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Review Writing Font Picker */}
        <div className="space-y-2.5 border-t border-[#DDE4DC] pt-5">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-[#252B29]">
            <Type className="h-4 w-4 text-[#244B40]" aria-hidden />
            2. AI Review Writing Font (shown live to customers)
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {REVIEW_FONT_ORDER.map((fontId) => {
              const font = REVIEW_FONTS[fontId];
              const active = selectedFont === fontId;
              return (
                <button
                  key={fontId}
                  type="button"
                  onClick={() => setSelectedFont(fontId)}
                  aria-pressed={active}
                  className={`rounded-xl border p-3.5 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                    active
                      ? 'border-[#244B40] bg-[#EEF3EC]/60 ring-1 ring-[#244B40]'
                      : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40]/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-[#252B29]">{font.label}</span>
                    {active && (
                      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#244B40] text-white">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-2 truncate text-[#244B40]"
                    style={{
                      fontFamily: font.fontFamily,
                      fontWeight: font.fontWeight,
                      fontSize: `${Math.min(font.fontSize, 20)}px`,
                    }}
                  >
                    Great experience, really loved it!
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <Button
          type="submit"
          loading={saving}
          disabled={!hasChanges}
          className="w-full sm:w-auto"
        >
          <Save className="h-4 w-4" aria-hidden /> Save Category &amp; Font
        </Button>
      </form>
    </div>
  );
}
