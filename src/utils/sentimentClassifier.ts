import type { ReviewSentiment } from '../types/business';

/**
 * Rule- and keyword-based sentiment estimator for customer feedback.
 *
 * IMPORTANT LIMITATIONS (disclosed in UI and documentation):
 * 1. This is an estimated text classification, NOT a verified customer star rating.
 * 2. Because it relies on lexical patterns and negation rules, it may not detect
 *    subtle sarcasm, irony, regional idioms, or non-Latin scripts without English keywords.
 * 3. Mixed feedback (containing both praise and criticism) is classified as 'mixed'
 *    and is never forced into 'positive'.
 * 4. Negative feedback is classified as 'negative' and is never hidden or gated.
 */

const NEGATED_POSITIVE_PATTERN =
  /\b(?:not|never|hardly|barely|no)\s+(?:good|great|clean|fresh|friendly|polite|courteous|tasty|delicious|helpful|comfortable|quick|fast|worth|nice|pleasant|warm|recommended|happy|satisfied)\b/i;

const CRITICISM_PATTERN =
  /\b(?:slow|waited|waiting|took\s+too\s+long|long\s+wait|cold|bad|noisy|loud|expensive|overpriced|delay|delayed|issue|issues|problem|problems|rude|unfriendly|dirty|unclean|unhygienic|stale|bland|salty|oily|greasy|undercooked|overcooked|burnt|raw|poor|worst|disappointed|disappointing|mediocre|late|broken|cramped|crowded|smelly|flies|mosquitoes|bugs|hair|leak|leaking|terrible|horrible|awful|lacking|underwhelming)\b|\bnot\s+working\b/i;

const POSITIVE_PATTERN =
  /\b(?:great|good|tasty|delicious|fresh|loved|love|excellent|friendly|clean|spotless|polite|courteous|nice|best|recommend|recommended|amazing|wonderful|flavourful|flavorful|comfortable|cozy|quick|fast|prompt|awesome|pleasant|helpful|fantastic|superb|happy|satisfied|welcoming|authentic|generous|affordable|extraordinary|tender|crispy)\b/i;

const CONTRAST_CONJUNCTION_PATTERN =
  /\b(?:but|however|although|though|except|yet|unfortunately)\b/i;

export interface SentimentAnalysisResult {
  sentiment: ReviewSentiment;
  hasPositiveSignals: boolean;
  hasNegativeSignals: boolean;
  positiveSnippets: string[];
  negativeSnippets: string[];
  isEstimate: true;
}

export function analyzeFeedbackSentiment(text: string): SentimentAnalysisResult {
  const cleaned = text.trim();
  if (!cleaned) {
    return {
      sentiment: 'neutral',
      hasPositiveSignals: false,
      hasNegativeSignals: false,
      positiveSnippets: [],
      negativeSnippets: [],
      isEstimate: true,
    };
  }

  const hasNegatedPositive = NEGATED_POSITIVE_PATTERN.test(cleaned);
  const textWithoutNegatedPositives = cleaned.replace(
    new RegExp(NEGATED_POSITIVE_PATTERN.source, 'gi'),
    ' ',
  );

  const hasNegativeSignals =
    hasNegatedPositive || CRITICISM_PATTERN.test(cleaned);
  const hasPositiveSignals = POSITIVE_PATTERN.test(textWithoutNegatedPositives);

  // Split clauses on punctuation or contrast conjunctions to extract positive vs negative points
  const clauses = cleaned
    .split(/(?:[.!?;]+|,\s*(?=(?:but|however|although|though)\b)|\b(?:but|however|although|though)\b)/i)
    .map((c) => c.trim())
    .filter(Boolean);

  const positiveSnippets: string[] = [];
  const negativeSnippets: string[] = [];

  for (const clause of clauses) {
    const clauseNegated = NEGATED_POSITIVE_PATTERN.test(clause);
    const clauseWithoutNegated = clause.replace(
      new RegExp(NEGATED_POSITIVE_PATTERN.source, 'gi'),
      ' ',
    );
    const isClauseNegative = clauseNegated || CRITICISM_PATTERN.test(clause);
    const isClausePositive = POSITIVE_PATTERN.test(clauseWithoutNegated);

    if (isClauseNegative) {
      negativeSnippets.push(clause);
    } else if (isClausePositive) {
      positiveSnippets.push(clause);
    }
  }

  let sentiment: ReviewSentiment;
  if (hasPositiveSignals && hasNegativeSignals) {
    sentiment = 'mixed';
  } else if (hasNegativeSignals) {
    sentiment = CONTRAST_CONJUNCTION_PATTERN.test(cleaned) && positiveSnippets.length > 0
      ? 'mixed'
      : 'negative';
  } else if (hasPositiveSignals) {
    sentiment = 'positive';
  } else {
    sentiment = 'neutral';
  }

  return {
    sentiment,
    hasPositiveSignals,
    hasNegativeSignals,
    positiveSnippets,
    negativeSnippets,
    isEstimate: true,
  };
}

export function classifyEstimatedSentiment(text: string): ReviewSentiment {
  return analyzeFeedbackSentiment(text).sentiment;
}
