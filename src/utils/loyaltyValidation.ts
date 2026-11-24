import type { BusinessCategory } from '../types/business';
import type {
  LoyaltyProgramConfigInput,
  LoyaltyVerificationMode,
} from '../types/loyalty';
import { validateBusinessId } from './aiConfigValidation';

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/g;

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS_RE, '').trim();
}

export function isLoyaltyCategory(
  category?: BusinessCategory | string | null,
): boolean {
  return category === 'loyalty';
}

export function normalizeLoyaltyPhone(rawPhone: string): string {
  let digits = stripControlChars(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 20);
}

export function getLoyaltyPortalUrl(
  businessSlug: string,
  baseOrigin?: string,
): string {
  const cleanSlug = stripControlChars(businessSlug).toLowerCase();
  if (!cleanSlug || !/^[a-z0-9-]{3,80}$/.test(cleanSlug)) {
    throw new Error('A valid business slug is required for the Loyalty Pass URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}/loyalty`;
}

export function validateCounterPin(pin: string): string {
  const clean = stripControlChars(pin).replace(/[^0-9]/g, '');
  if (clean.length < 4 || clean.length > 6) {
    throw new Error('Counter Secret PIN must be 4 to 6 digits (e.g. 4821).');
  }
  return clean;
}

export function validateLoyaltyConfigInput(
  businessId: string,
  input: LoyaltyProgramConfigInput,
): LoyaltyProgramConfigInput {
  validateBusinessId(businessId);
  const starsRequired = Math.round(Number(input.starsRequired));
  if (!Number.isFinite(starsRequired) || starsRequired < 3 || starsRequired > 20) {
    throw new Error('Stars required per reward must be between 3 and 20.');
  }
  const rewardTitle = stripControlChars(input.rewardTitle ?? '').slice(0, 100);
  if (rewardTitle.length < 3) {
    throw new Error('Please enter a clear reward title (at least 3 characters).');
  }
  const allowedModes: LoyaltyVerificationMode[] = [
    'cooldown_only',
    'counter_pin',
    'cashier_approval',
  ];
  if (!allowedModes.includes(input.verificationMode)) {
    throw new Error('Invalid anti-fraud verification mode.');
  }
  const counterSecretPin =
    input.verificationMode === 'counter_pin' || input.counterSecretPin
      ? validateCounterPin(input.counterSecretPin || '1234')
      : '1234';
  const scanCooldownHours = Math.round(Number(input.scanCooldownHours));
  if (
    !Number.isFinite(scanCooldownHours) ||
    scanCooldownHours < 1 ||
    scanCooldownHours > 168
  ) {
    throw new Error('Visit cooldown must be between 1 and 168 hours.');
  }
  const googleReviewBonusStars = Math.round(Number(input.googleReviewBonusStars));
  if (
    !Number.isFinite(googleReviewBonusStars) ||
    googleReviewBonusStars < 1 ||
    googleReviewBonusStars > 3
  ) {
    throw new Error('Google review bonus stars must be between 1 and 3.');
  }
  const rawHex = stripControlChars(input.brandAccentHex ?? '#C8F135');
  const brandAccentHex = /^#[0-9A-Fa-f]{6}$/.test(rawHex)
    ? rawHex.toUpperCase()
    : '#C8F135';

  return {
    starsRequired,
    rewardTitle,
    rewardDescription: input.rewardDescription
      ? stripControlChars(input.rewardDescription).slice(0, 160)
      : null,
    verificationMode: input.verificationMode,
    counterSecretPin,
    scanCooldownHours,
    googleReviewBonusEnabled: Boolean(input.googleReviewBonusEnabled),
    googleReviewBonusStars,
    brandAccentHex,
  };
}

export function applyStarsWithRewardRollover(params: {
  currentStars: number;
  lifetimeStars: number;
  rewardsUnlocked: number;
  addedStars: number;
  starsRequired: number;
}): {
  currentStars: number;
  lifetimeStars: number;
  rewardsUnlocked: number;
  earnedRewards: number;
} {
  const safeAdded = Math.max(0, Math.round(params.addedStars));
  const rawNext = params.currentStars + safeAdded;
  const earnedRewards =
    rawNext >= params.starsRequired
      ? Math.floor(rawNext / params.starsRequired)
      : 0;
  return {
    currentStars: rawNext % params.starsRequired,
    lifetimeStars: params.lifetimeStars + safeAdded,
    rewardsUnlocked: params.rewardsUnlocked + earnedRewards,
    earnedRewards,
  };
}
