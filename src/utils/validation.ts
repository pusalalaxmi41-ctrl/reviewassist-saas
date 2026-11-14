export const EXPERIENCE_MIN = 20;
export const EXPERIENCE_MAX = 2000;

export function validateExperience(text: string): string | null {
  const len = text.trim().length;
  if (len === 0) return 'Please tell us about your experience.';
  if (len < EXPERIENCE_MIN) return `Please add a little more detail (at least ${EXPERIENCE_MIN} characters).`;
  if (len > EXPERIENCE_MAX) return `Please keep it under ${EXPERIENCE_MAX} characters.`;
  return null;
}
