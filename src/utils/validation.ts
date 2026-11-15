export const EXPERIENCE_MIN = 20;
export const EXPERIENCE_MAX = 2000;

/**
 * Validates customer experience input before AI generation.
 * Ensures the input is within [20, 2000] characters and contains enough
 * meaningful words so the AI never has to guess or invent details.
 */
export function validateExperience(text: string): string | null {
  const trimmed = text.trim();
  const len = trimmed.length;

  if (len === 0) {
    return 'Please share a few details about your experience first.';
  }

  if (len < EXPERIENCE_MIN) {
    return `Please add a little more detail about your visit (at least ${EXPERIENCE_MIN} characters) so we don't have to guess.`;
  }

  if (len > EXPERIENCE_MAX) {
    return `Please keep your feedback under ${EXPERIENCE_MAX} characters.`;
  }

  // Check for meaningful word count (at least 3 words with letters)
  const words = trimmed
    .split(/\s+/)
    .filter((w) => /[a-zA-Z]{2,}/.test(w));

  if (words.length < 3) {
    return 'Could you share a few more words about what you liked or what could be improved?';
  }

  // Reject single-character spam like "aaaaaaaaaaaaaaaaaaaa"
  if (/^(.)\1{15,}$/i.test(trimmed.replace(/\s+/g, ''))) {
    return 'Please describe your actual experience in a few clear words.';
  }

  return null;
}
