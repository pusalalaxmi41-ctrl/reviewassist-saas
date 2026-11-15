import { Mic, PenLine, ArrowRight, MapPin } from 'lucide-react';
import type { Business, ExperienceInputMode } from '../../types/business';
import { categoryLabels } from '../../services/business/mockBusinesses';

interface Props {
  business: Business;
  onSelect: (mode: ExperienceInputMode) => void;
}

const options: {
  mode: ExperienceInputMode;
  title: string;
  desc: string;
  badge: string;
  Icon: typeof Mic;
}[] = [
  {
    mode: 'text',
    title: 'Write a few quick notes',
    desc: 'Type your thoughts or tap quick highlights — we will turn them into a clear review.',
    badge: 'Most popular',
    Icon: PenLine,
  },
  {
    mode: 'voice',
    title: 'Speak your experience',
    desc: 'Use browser voice-to-text to speak naturally. No audio is ever uploaded or stored.',
    badge: 'Voice-to-text',
    Icon: Mic,
  },
];

export function WelcomeStep({ business, onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div className="space-y-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#A8BFA5] bg-[#EEF3EC] px-3 py-1 text-[13px] font-medium text-[#244B40]">
          <span>{categoryLabels[business.category]}</span>
          <span className="text-[#626B65]">·</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {business.city}
          </span>
        </div>

        <h1 className="text-[24px] font-semibold tracking-tight text-[#252B29] sm:text-[28px]">
          {business.name}
        </h1>

        <p className="text-[15px] leading-relaxed text-[#626B65] sm:text-[16px]">
          Thank you for visiting! Share your honest experience in a few words — what went well or what could be better — and we will help you draft a clear review you can edit and approve.
        </p>
      </div>

      <div className="space-y-3 pt-1">
        <p className="text-[13px] font-medium uppercase tracking-wider text-[#626B65]">
          Choose how you&apos;d like to share
        </p>
        <div className="grid gap-3">
          {options.map(({ mode, title, desc, badge, Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => onSelect(mode)}
              className="group flex w-full items-start gap-4 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 text-left shadow-2xs transition-all duration-150 hover:border-[#244B40] hover:bg-[#F7F7F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] cursor-pointer sm:p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] text-[#244B40] transition-colors group-hover:bg-[#244B40] group-hover:border-[#244B40] group-hover:text-[#FFFFFF]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>

              <span className="flex-1 space-y-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-semibold text-[#252B29]">
                    {title}
                  </span>
                  <span
                    className={
                      mode === 'text'
                        ? 'rounded-full border border-[#E4BD63] bg-[#FAF3DF] px-2.5 py-0.5 text-[12px] font-medium text-[#252B29]'
                        : 'rounded-full border border-[#DDE4DC] bg-[#F7F7F2] px-2.5 py-0.5 text-[12px] font-medium text-[#626B65]'
                    }
                  >
                    {badge}
                  </span>
                </span>
                <span className="block text-[14px] leading-relaxed text-[#626B65]">
                  {desc}
                </span>
              </span>

              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-[#626B65] transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#244B40]"
                aria-hidden
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
