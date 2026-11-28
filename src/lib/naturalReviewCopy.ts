import type { Business, ExperienceRating } from '../types/business';
import type { HighlightOption } from '../config/reviewExperience';

const ROBOTIC_REVIEW_PATTERNS: readonly RegExp[] = [
  /^here is my honest experience\b/i,
  /^sharing my experience at\b/i,
  /^a few thoughts on\b/i,
  /\boverall,\s*i had a (?:good|great|average) experience\b/i,
  /\boverall,\s*my experience was (?:excellent|good|average|not good)\b/i,
  /\bhonestly,\s*my experience was not good this time\b/i,
];

/**
 * Smart title-cases all-lowercase business names (e.g. 'mens hair' -> 'Mens Hair')
 * while preserving intentional mixed-case or uppercase brands (e.g. 'ClipAura', 'BistroOS').
 */
export function formatDisplayBusinessName(rawName: string): string {
  const trimmed = (rawName ?? '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  if (trimmed !== trimmed.toLowerCase()) {
    return trimmed;
  }
  return trimmed.replace(/\b([a-z])/g, (ch) => ch.toUpperCase());
}

export function hasRoboticReviewCliche(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  return ROBOTIC_REVIEW_PATTERNS.some((re) => re.test(clean));
}

function joinClausesNaturally(clauses: string[]): string {
  const cleaned = clauses.map((c) => c.trim().replace(/[.!?]+$/, '')).filter(Boolean);
  if (cleaned.length === 0) return '';
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(', ')}, and ${cleaned[cleaned.length - 1]}`;
}

function formatCustomNoteSentence(rawNote: string): string {
  const trimmed = rawNote.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  const capped = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capped) ? capped : `${capped}.`;
}

export interface NaturalReviewDraftInput {
  business: Pick<Business, 'name' | 'city' | 'category'>;
  rating: ExperienceRating;
  liked: HighlightOption[];
  improve: HighlightOption[];
  note: string;
  attempt: number;
  previousText?: string;
}

/**
 * Generates warm, natural, human Google Maps-style review copy tailored to the
 * selected rating, highlight chips, and optional custom detail—with 4 distinct
 * phrasing variations so Regenerate always feels fresh and authentic.
 */
export function buildNaturalHumanReview(input: NaturalReviewDraftInput): string {
  const name = formatDisplayBusinessName(input.business.name);
  const city = (input.business.city ?? '').trim();
  const likedText = joinClausesNaturally(input.liked.map((o) => o.phrase));
  const improveText = joinClausesNaturally(input.improve.map((o) => o.phrase));
  const noteSentence = formatCustomNoteSentence(input.note);

  const renderVariant = (variantIdx: number): string => {
    const v = ((variantIdx % 4) + 4) % 4;
    const parts: string[] = [];

    if (input.rating === 'excellent') {
      const openers = [
        `Stopped by ${name} today and walked out super happy with everything.`,
        city
          ? `Had a fantastic experience at ${name} in ${city}!`
          : `Had a fantastic experience at ${name}!`,
        `Really impressed with my visit to ${name}.`,
        `Checked out ${name} recently and it genuinely lived up to expectations.`,
      ];
      const closers = [
        'Definitely coming back!',
        city
          ? `Easily one of my favourite spots in ${city}.`
          : 'Easily one of my go-to spots now.',
        'Highly recommend checking them out!',
        'Will happily recommend this place to friends and family.',
      ];

      parts.push(openers[v]);
      if (likedText) {
        const likedLeads = [
          `${likedText.charAt(0).toUpperCase() + likedText.slice(1)}.`,
          `Loved that ${likedText}.`,
          `From start to finish, ${likedText}.`,
          `What stood out most was that ${likedText}.`,
        ];
        parts.push(likedLeads[v]);
      }
      if (noteSentence) parts.push(noteSentence);
      parts.push(closers[v]);
      return parts.join(' ');
    }

    if (input.rating === 'good') {
      const openers = [
        `Had a really good visit at ${name}.`,
        `Visited ${name} today and had a smooth, pleasant experience.`,
        city
          ? `Dropped into ${name} in ${city} and came away happy.`
          : `Dropped into ${name} recently and came away happy.`,
        `Good experience at ${name} today.`,
      ];
      const closers = [
        city ? `Solid spot in ${city}.` : 'Solid spot and worth a visit.',
        'Would gladly visit again.',
        'Happy with the service and will be back.',
        'A reliable place I would recommend.',
      ];

      parts.push(openers[v]);
      if (likedText) {
        const likedLeads = [
          `${likedText.charAt(0).toUpperCase() + likedText.slice(1)}, with zero rush throughout.`,
          `Really appreciated that ${likedText}.`,
          `Everything went smoothly and ${likedText}.`,
          `Glad to see that ${likedText}.`,
        ];
        parts.push(likedLeads[v]);
      }
      if (noteSentence) parts.push(noteSentence);
      parts.push(closers[v]);
      return parts.join(' ');
    }

    if (input.rating === 'average') {
      const openers = [
        `Visited ${name} recently.`,
        city
          ? `Stopped by ${name} in ${city} today.`
          : `Stopped by ${name} today.`,
        `Had a mixed experience at ${name}.`,
        `Checked out ${name} this week.`,
      ];
      parts.push(openers[v]);

      if (likedText && improveText) {
        parts.push(
          `On the plus side, ${likedText}, though ${improveText}.`,
        );
      } else if (likedText) {
        parts.push(
          `Appreciated that ${likedText}, though a few small touches could be better.`,
        );
      } else if (improveText) {
        parts.push(
          `Felt that ${improveText}.`,
        );
      } else {
        parts.push('Some things were decent, while a few details have room to improve.');
      }

      if (noteSentence) parts.push(noteSentence);
      const closers = [
        'Decent visit with a bit of room for improvement.',
        'With a few small fixes, this place could be much better.',
        'Sharing constructive feedback for the team.',
        'Fair experience, hoping to see improvements next time.',
      ];
      parts.push(closers[v]);
      return parts.join(' ');
    }

    // rating === 'not_good' (Honest, non-gated constructive review)
    const openers = [
      `Visited ${name} today and left disappointed.`,
      city
        ? `Stopped by ${name} in ${city} recently, and it fell short of expectations.`
        : `Stopped by ${name} recently, and it fell short of expectations.`,
      `Had a frustrating visit at ${name}.`,
      `My recent visit to ${name} wasn't up to the mark.`,
    ];
    parts.push(openers[v]);

    if (improveText) {
      parts.push(`${improveText.charAt(0).toUpperCase() + improveText.slice(1)}.`);
    }
    if (noteSentence) parts.push(noteSentence);

    const closers = [
      'Sharing this hoping the team looks into these issues.',
      'Hope management takes note and improves things soon.',
      'Needs attention from the team before I would consider returning.',
      'Hopefully they address this for future visitors.',
    ];
    parts.push(closers[v]);
    return parts.join(' ');
  };

  let candidate = renderVariant(input.attempt);
  if (
    input.previousText &&
    candidate.trim() === input.previousText.trim()
  ) {
    candidate = renderVariant(input.attempt + 1);
  }
  return candidate;
}
