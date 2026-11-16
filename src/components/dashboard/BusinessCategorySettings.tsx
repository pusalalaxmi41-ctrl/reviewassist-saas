import { useState, type FormEvent } from 'react';
import { Building2, Check, Save } from 'lucide-react';
import type { Business, BusinessCategory } from '../../types/business';
import { businessRepository } from '../../services/storage';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
  onUpdated: (updated: Business) => void;
}

const CATEGORY_OPTIONS: Array<{
  value: BusinessCategory;
  title: string;
  previewOptions: string[];
}> = [
  {
    value: 'restaurant',
    title: 'Restaurant',
    previewOptions: ['Food was tasty & fresh', 'Clean hygiene & water', 'Polite staff & quick service'],
  },
  {
    value: 'cafe',
    title: 'Cafe & Bakery',
    previewOptions: ['Coffee & snacks were great', 'Freshly prepared items', 'Relaxed ambience'],
  },
  {
    value: 'hotel',
    title: 'Hotel & Lodge',
    previewOptions: ['Clean & comfortable room', 'Good food & breakfast', 'Smooth check-in'],
  },
  {
    value: 'pg',
    title: 'PG / Hostel',
    previewOptions: ['Clean & well-maintained rooms', 'Homely food', 'Good water supply', 'Reliable Wi-Fi & power backup'],
  },
];

export function BusinessCategorySettings({ business, onUpdated }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory>(business.category);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const updated = await businessRepository.updateBusinessCategory(
        business.id,
        selectedCategory,
      );
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError((err as Error).message || 'Unable to update business category.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 sm:p-6 shadow-2xs space-y-5">
      <div className="border-b border-[#DDE4DC] pb-4">
        <h3 className="flex items-center gap-2 text-[18px] font-semibold tracking-tight text-[#252B29] sm:text-[20px]">
          <Building2 className="h-5 w-5 text-[#244B40]" aria-hidden />
          Business Category &amp; QR Quick Options
        </h3>
        <p className="mt-1 text-[13px] text-[#626B65]">
          Choose what kind of business this is. Your QR review page automatically shows matching quick-tap options for your customers.
        </p>
      </div>

      {saved && (
        <Alert tone="success">
          <p>Business category updated! Your QR page now shows options tailored for this category.</p>
        </Alert>
      )}

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORY_OPTIONS.map((opt) => {
            const active = selectedCategory === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelectedCategory(opt.value)}
                aria-pressed={active}
                className={`rounded-xl border p-4 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                  active
                    ? 'border-[#244B40] bg-[#EEF3EC]/60 ring-1 ring-[#244B40]'
                    : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40]/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-semibold text-[#252B29]">{opt.title}</span>
                  {active && (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#244B40] text-white">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] text-[#626B65] leading-relaxed">
                  QR options: {opt.previewOptions.join(' · ')}
                </p>
              </button>
            );
          })}
        </div>

        <Button
          type="submit"
          loading={saving}
          disabled={selectedCategory === business.category}
          className="w-full sm:w-auto"
        >
          <Save className="h-4 w-4" aria-hidden /> Save Business Category
        </Button>
      </form>
    </div>
  );
}
