import { useState, useEffect, type FormEvent } from 'react';
import {
  Save,
  RotateCcw,
  Trash2,
  Sparkles,
  Check,
  ShieldCheck,
  Languages,
  Sliders,
  MessageSquareReply,
} from 'lucide-react';
import type { Business } from '../../types/business';
import {
  AI_LANGUAGE_OPTIONS,
  AI_RESPONSE_LENGTH_OPTIONS,
  AI_TONE_OPTIONS,
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  DEFAULT_BUSINESS_AI_CONFIG,
  type AICommunicationTone,
  type AILanguageCode,
  type AIResponseLength,
} from '../../types/aiConfig';
import { validateBusinessAIConfigInput } from '../../utils/aiConfigValidation';
import { businessRepository } from '../../services/storage';
import { aiProvider, type BusinessResponseDraft } from '../../services/ai';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
}

const SAMPLE_CUSTOMER_REVIEWS = [
  {
    label: 'Positive Experience',
    text: 'Loved the ambiance and outdoor seating! The butter chicken and garlic naan were fresh and delicious.',
  },
  {
    label: 'Mixed Experience (Wait Time)',
    text: 'The food quality was super and very flavourful, however the wait time for drinks was around 20 minutes.',
  },
  {
    label: 'Short Feedback',
    text: 'Clean rooms, good water pressure, and courteous staff.',
  },
];

export function AIConfigurationSettings({ business }: Props) {
  const [tone, setTone] = useState<AICommunicationTone>(
    DEFAULT_BUSINESS_AI_CONFIG.tone,
  );
  const [customInstructions, setCustomInstructions] = useState<string>(
    DEFAULT_BUSINESS_AI_CONFIG.customInstructions,
  );
  const [responseLength, setResponseLength] = useState<AIResponseLength>(
    DEFAULT_BUSINESS_AI_CONFIG.responseLength,
  );
  const [language, setLanguage] = useState<AILanguageCode>(
    DEFAULT_BUSINESS_AI_CONFIG.language,
  );

  const [loadingConfig, setLoadingConfig] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Business-owner AI response verification state
  const [sampleCustomerReview, setSampleCustomerReview] = useState<string>(
    SAMPLE_CUSTOMER_REVIEWS[0].text,
  );
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [previewResult, setPreviewResult] =
    useState<BusinessResponseDraft | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const config = await businessRepository.getBusinessAIConfig(business.id);
        if (!active) return;
        setTone(config.tone);
        setCustomInstructions(config.customInstructions);
        setResponseLength(config.responseLength);
        setLanguage(config.language);
      } catch (err) {
        if (!active) return;
        setError(
          (err as Error).message ||
            'Failed to load AI configuration for this business.',
        );
      } finally {
        if (active) {
          setLoadingConfig(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [business.id]);

  async function persistConfig(nextInput: {
    tone: AICommunicationTone;
    customInstructions: string;
    responseLength: AIResponseLength;
    language: AILanguageCode;
  }, successMessage: string) {
    setError(null);
    setSavedBanner(null);

    const validation = validateBusinessAIConfigInput(business.id, nextInput);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    try {
      const updated = await businessRepository.updateBusinessAIConfig(
        business.id,
        validation.value,
      );
      setTone(updated.tone);
      setCustomInstructions(updated.customInstructions);
      setResponseLength(updated.responseLength);
      setLanguage(updated.language);
      setSavedBanner(successMessage);
    } catch (err) {
      setError(
        (err as Error).message || 'Unable to save AI configuration.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await persistConfig(
      {
        tone,
        customInstructions,
        responseLength,
        language,
      },
      'AI Configuration saved for this business.',
    );
  }

  async function handleClearInstructions() {
    setCustomInstructions('');
    await persistConfig(
      {
        tone,
        customInstructions: '',
        responseLength,
        language,
      },
      'Custom AI instructions cleared and saved.',
    );
  }

  async function handleResetDefaults() {
    await persistConfig(
      {
        tone: DEFAULT_BUSINESS_AI_CONFIG.tone,
        customInstructions: DEFAULT_BUSINESS_AI_CONFIG.customInstructions,
        responseLength: DEFAULT_BUSINESS_AI_CONFIG.responseLength,
        language: DEFAULT_BUSINESS_AI_CONFIG.language,
      },
      'AI Configuration reset to default settings.',
    );
  }

  async function handleGeneratePreview() {
    setPreviewError(null);
    const validation = validateBusinessAIConfigInput(business.id, {
      tone,
      customInstructions,
      responseLength,
      language,
    });
    if (!validation.ok) {
      setPreviewError(validation.error);
      return;
    }

    if (!sampleCustomerReview.trim()) {
      setPreviewError('Enter a sample customer review to test the business response.');
      return;
    }

    setGeneratingPreview(true);
    try {
      const businessKnowledge = await businessRepository.getBusinessKnowledge(
        business.id,
      );
      const result = await aiProvider.generateBusinessResponse({
        business,
        customerReviewText: sampleCustomerReview,
        aiConfig: validation.value,
        businessKnowledge,
      });
      setPreviewResult(result);
    } catch (err) {
      setPreviewError(
        (err as Error).message || 'Failed to generate business response preview.',
      );
    } finally {
      setGeneratingPreview(false);
    }
  }

  const remainingChars =
    CUSTOM_INSTRUCTIONS_MAX_LENGTH - customInstructions.length;

  return (
    <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE4DC] pb-4">
        <div>
          <h3 className="text-[18px] font-semibold tracking-tight text-[#252B29] flex items-center gap-2 sm:text-[20px]">
            <Sliders className="h-5 w-5 text-[#244B40]" aria-hidden />
            AI Configuration (Business-Owner Responses)
          </h3>
          <p className="mt-1 text-[13px] text-[#626B65]">
            Configure communication tone, custom instructions, response length, and output language for{' '}
            <strong className="text-[#252B29]">{business.name}</strong>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#626B65] font-mono">
          <span>Business ID:</span>
          <span className="bg-[#F7F7F2] border border-[#DDE4DC] px-2 py-0.5 rounded text-[#252B29] font-bold">
            {business.id}
          </span>
        </div>
      </div>

      {/* Separation of AI Tasks Notice */}
      <div className="flex items-start gap-2.5 rounded-xl bg-[#EEF3EC] border border-[#A8BFA5] p-3.5 text-[13px] text-[#252B29]">
        <ShieldCheck className="h-4 w-4 text-[#244B40] shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold text-[#252B29]">
            Strict Separation of AI Tasks
          </p>
          <p className="text-[#626B65] leading-relaxed">
            These settings apply exclusively to <strong className="text-[#252B29]">Business-Owner AI Responses</strong> written on behalf of{' '}
            <strong className="text-[#252B29]">{business.name}</strong> (such as owner replies to customer reviews). They never alter or override{' '}
            <strong className="text-[#252B29]">Customer Review Generation</strong> on <code>/r/{business.slug}</code>, which always preserves the customer&apos;s genuine feedback.
          </p>
        </div>
      </div>

      {savedBanner && (
        <Alert tone="success">
          <p>{savedBanner}</p>
        </Alert>
      )}

      {error && (
        <Alert tone="error">
          <p>{error}</p>
        </Alert>
      )}

      {loadingConfig ? (
        <div className="py-8 text-center text-[13px] text-[#626B65]">
          Loading business AI configuration...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* A. AI Communication Tone */}
          <div className="space-y-2">
            <label
              htmlFor="ai-tone-select"
              className="block text-[14px] font-semibold text-[#252B29]"
            >
              A. AI Communication Tone (Single Primary Tone)
            </label>
            <p className="text-[13px] text-[#626B65]">
              Select the primary voice used when generating responses on behalf of {business.name}.
            </p>
            <select
              id="ai-tone-select"
              value={tone}
              onChange={(e) => setTone(e.target.value as AICommunicationTone)}
              className="min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[14px] font-medium text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
            >
              {AI_TONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* C & D: Response Length and Language side-by-side */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* C. Response Length */}
            <div className="space-y-2">
              <label
                htmlFor="ai-length-select"
                className="block text-[14px] font-semibold text-[#252B29]"
              >
                C. Response Length
              </label>
              <p className="text-[13px] text-[#626B65]">
                Controls the target length and detail of generated business replies.
              </p>
              <select
                id="ai-length-select"
                value={responseLength}
                onChange={(e) =>
                  setResponseLength(e.target.value as AIResponseLength)
                }
                className="min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[14px] font-medium text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
              >
                {AI_RESPONSE_LENGTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} — {opt.description}
                  </option>
                ))}
              </select>
            </div>

            {/* D. Language */}
            <div className="space-y-2">
              <label
                htmlFor="ai-language-select"
                className="block text-[14px] font-semibold text-[#252B29] flex items-center gap-1.5"
              >
                <Languages className="h-4 w-4 text-[#244B40]" aria-hidden />
                D. Output Language
              </label>
              <p className="text-[13px] text-[#626B65]">
                Select the language used for generated business-owner responses.
              </p>
              <select
                id="ai-language-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value as AILanguageCode)}
                className="min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[14px] font-medium text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
              >
                {AI_LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.nativeLabel}) [{opt.value}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* B. Custom AI Instructions */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="ai-custom-instructions"
                className="block text-[14px] font-semibold text-[#252B29]"
              >
                B. Custom AI Instructions
              </label>
              <span
                className={`text-[12px] font-mono ${
                  remainingChars < 0
                    ? 'text-red-700 font-bold'
                    : 'text-[#626B65]'
                }`}
              >
                {customInstructions.length} / {CUSTOM_INSTRUCTIONS_MAX_LENGTH} characters
              </span>
            </div>
            <p className="text-[13px] text-[#626B65]">
              Optional guidelines for business-owned AI responses (e.g., &ldquo;Use simple English. Keep responses friendly and professional. Avoid exaggerated marketing language. Never make promises that the business cannot fulfil.&rdquo;).
            </p>
            <textarea
              id="ai-custom-instructions"
              rows={3}
              maxLength={CUSTOM_INSTRUCTIONS_MAX_LENGTH}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Use simple English. Keep responses friendly and professional. Avoid exaggerated marketing language. Be respectful and concise. Never make promises that the business cannot fulfil."
              className="w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[14px] text-[#252B29] placeholder:text-[#626B65] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#DDE4DC] pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleClearInstructions}
                disabled={saving || customInstructions.length === 0}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Clear Instructions
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleResetDefaults}
                disabled={saving}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Reset Defaults
              </Button>
            </div>

            <Button type="submit" loading={saving}>
              {savedBanner ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              Save AI Configuration
            </Button>
          </div>
        </form>
      )}

      {/* Business-Owner Response Verification Sandbox */}
      <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-[15px] font-semibold text-[#252B29] flex items-center gap-1.5">
              <MessageSquareReply className="h-4 w-4 text-[#244B40]" aria-hidden />
              Test Business-Owner AI Response Generation
            </h4>
            <p className="text-[13px] text-[#626B65] mt-0.5">
              Verify how your selected tone (<code>{tone}</code>), response length (<code>{responseLength}</code>), language (<code>{language}</code>), and custom instructions shape owner replies.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_CUSTOMER_REVIEWS.map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => {
                  setSampleCustomerReview(sample.text);
                }}
                className="rounded-lg border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[12px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#EEF3EC] cursor-pointer"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="sample-customer-review"
            className="block text-[13px] font-medium text-[#252B29] mb-1"
          >
            Sample Customer Review to Reply To
          </label>
          <input
            id="sample-customer-review"
            type="text"
            value={sampleCustomerReview}
            onChange={(e) => setSampleCustomerReview(e.target.value)}
            className="min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
          />
        </div>

        {previewError && (
          <Alert tone="error">
            <p>{previewError}</p>
          </Alert>
        )}

        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="secondary"
            loading={generatingPreview}
            onClick={handleGeneratePreview}
          >
            <Sparkles className="h-4 w-4 text-[#244B40]" aria-hidden />
            Generate Business Response Preview
          </Button>
        </div>

        {previewResult && (
          <div className="rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[#626B65] border-b border-[#DDE4DC] pb-2">
              <span className="font-semibold text-[#252B29]">
                Generated Business-Owner Reply ({previewResult.appliedConfig.language.toUpperCase()} ·{' '}
                {previewResult.appliedConfig.tone} · {previewResult.appliedConfig.responseLength})
              </span>
              <span className="font-mono text-[#626B65]">
                Source: {previewResult.generationSource}
              </span>
            </div>
            <p className="text-[15px] text-[#252B29] leading-relaxed whitespace-pre-wrap">
              {previewResult.text}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
