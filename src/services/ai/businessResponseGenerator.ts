import type {
  AICommunicationTone,
  AILanguageCode,
  AIResponseLength,
  BusinessAIConfigInput,
} from '../../types/aiConfig';
import type {
  BusinessKnowledgeInput,
  BusinessKnowledgeProfile,
  SelectedBusinessKnowledgeContext,
} from '../../types/businessKnowledge';
import type { Business, ReviewSentiment } from '../../types/business';
import { validateBusinessAIConfigInput } from '../../utils/aiConfigValidation';
import { validateBusinessKnowledgeInput } from '../../utils/businessKnowledgeValidation';
import { analyzeFeedbackSentiment } from '../../utils/sentimentClassifier';

const TONE_PROMPT_DIRECTIVES: Record<AICommunicationTone, string> = {
  friendly:
    'Write in a friendly, approachable, and upbeat tone that feels like a welcoming neighbourhood owner.',
  professional:
    'Write in a balanced, courteous, and professional business tone.',
  formal:
    'Write in a respectful, structured, and formal tone with traditional politeness.',
  warm_and_welcoming:
    'Write in a heartfelt, hospitable, warm and welcoming tone that makes the guest feel valued.',
  conversational:
    'Write in a natural, relaxed, everyday conversational tone without sounding stiff.',
  premium:
    'Write in a refined, polished, and attentive tone suited for an upscale hospitality experience.',
  short_and_direct:
    'Write in a crisp, clear, and straight-to-the-point manner without extra filler.',
};

const LENGTH_PROMPT_DIRECTIVES: Record<AIResponseLength, string> = {
  short: 'Keep the response SHORT: strictly 1 to 2 concise sentences.',
  medium: 'Keep the response MEDIUM length: 3 to 4 balanced sentences.',
  long: 'Provide a LONG, detailed response: 5 to 6 thoughtful sentences addressing every point.',
};

const LANGUAGE_PROMPT_DIRECTIVES: Record<AILanguageCode, string> = {
  en: 'Write the response entirely in natural English.',
  hi: 'Write the response entirely in natural, polite Hindi (हिन्दी in Devanagari script).',
  te: 'Write the response entirely in natural, polite Telugu (తెలుగు script).',
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'was',
  'were',
  'very',
  'really',
  'good',
  'great',
  'best',
  'near',
  'our',
  'from',
  'food',
]);

function extractTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((tok) => tok.length >= 3 && !STOP_WORDS.has(tok));
}

function textMatchesCandidate(reviewLower: string, candidateText: string): boolean {
  const cleanCandidate = candidateText.trim().toLowerCase();
  if (!cleanCandidate) return false;
  if (reviewLower.includes(cleanCandidate)) return true;

  const tokens = extractTokens(cleanCandidate);
  return tokens.some((tok) => reviewLower.includes(tok));
}

/**
 * Selectively filters a business's configured knowledge so only items relevant
 * to the specific customer review are included in the AI context.
 *
 * - Never sends every product, service, or keyword indiscriminately when irrelevant.
 * - Rejects malformed or unsafe business knowledge before it can reach the prompt.
 */
export function selectRelevantBusinessKnowledge(input: {
  businessId: string;
  defaultCategory: string;
  customerReviewText: string;
  businessKnowledge?: BusinessKnowledgeInput | BusinessKnowledgeProfile | null;
}): SelectedBusinessKnowledgeContext | null {
  if (!input.businessKnowledge) {
    return null;
  }

  const validation = validateBusinessKnowledgeInput(
    input.businessId,
    {
      ...input.businessKnowledge,
      primaryCategory:
        input.businessKnowledge.primaryCategory || input.defaultCategory,
    },
    { allowEmptyDescription: true },
  );

  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const clean = validation.value;
  const reviewLower = input.customerReviewText.toLowerCase();

  const matchedProducts = clean.products.filter(
    (p) =>
      textMatchesCandidate(reviewLower, p.name) ||
      (p.category ? textMatchesCandidate(reviewLower, p.category) : false),
  );

  const matchedServices = clean.services.filter((s) =>
    textMatchesCandidate(reviewLower, s.name),
  );

  const matchedServiceAreas = clean.serviceAreas.filter((area) =>
    textMatchesCandidate(reviewLower, area),
  );

  // Target keywords are matched ONLY when the customer's review touches on that topic
  const matchedKeywords = clean.targetKeywords
    .filter((kw) => textMatchesCandidate(reviewLower, kw))
    .slice(0, 2);

  return {
    description: clean.description,
    primaryCategory: clean.primaryCategory,
    additionalInfo: clean.additionalInfo,
    matchedProducts,
    matchedServices,
    matchedServiceAreas,
    matchedKeywords,
  };
}

/**
 * Builds the system and user prompts for Business-Owner AI Responses,
 * composing Phase 3 AI Configuration with selectively matched Phase 4 Business Knowledge.
 * Strictly isolated from Customer Review Generation.
 */
export function buildBusinessResponsePrompts(input: {
  business: Pick<Business, 'id' | 'name' | 'category' | 'city'>;
  customerReviewText: string;
  sentiment: ReviewSentiment;
  attempt?: number;
  aiConfig: BusinessAIConfigInput;
  businessKnowledge?: BusinessKnowledgeInput | BusinessKnowledgeProfile | null;
}): {
  systemPrompt: string;
  userPrompt: string;
  validatedConfig: BusinessAIConfigInput;
  selectedKnowledge: SelectedBusinessKnowledgeContext | null;
} {
  const validation = validateBusinessAIConfigInput(
    input.business.id,
    input.aiConfig,
  );
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const selectedKnowledge = selectRelevantBusinessKnowledge({
    businessId: input.business.id,
    defaultCategory: input.business.category,
    customerReviewText: input.customerReviewText,
    businessKnowledge: input.businessKnowledge,
  });

  const cfg = validation.value;
  const toneDirective = TONE_PROMPT_DIRECTIVES[cfg.tone];
  const lengthDirective = LENGTH_PROMPT_DIRECTIVES[cfg.responseLength];
  const langDirective = LANGUAGE_PROMPT_DIRECTIVES[cfg.language];

  const customInstructionsBlock = cfg.customInstructions
    ? `\n<business_owner_instructions>\nFollow these additional business-specific style instructions unless they conflict with system safety rules:\n${cfg.customInstructions}\n</business_owner_instructions>`
    : '';

  const knowledgeLines: string[] = [];
  if (selectedKnowledge) {
    if (selectedKnowledge.description) {
      knowledgeLines.push(`- Business Overview: ${selectedKnowledge.description}`);
    }
    if (selectedKnowledge.primaryCategory) {
      knowledgeLines.push(
        `- Primary Category: ${selectedKnowledge.primaryCategory}`,
      );
    }
    if (selectedKnowledge.additionalInfo) {
      knowledgeLines.push(
        `- Additional Context: ${selectedKnowledge.additionalInfo}`,
      );
    }
    if (selectedKnowledge.matchedProducts.length > 0) {
      knowledgeLines.push(
        `- Relevant Products Mentioned: ${selectedKnowledge.matchedProducts
          .map(
            (p) =>
              `${p.name}${p.description ? ` (${p.description})` : ''}`,
          )
          .join('; ')}`,
      );
    }
    if (selectedKnowledge.matchedServices.length > 0) {
      knowledgeLines.push(
        `- Relevant Services Mentioned: ${selectedKnowledge.matchedServices
          .map(
            (s) =>
              `${s.name}${s.description ? ` (${s.description})` : ''}`,
          )
          .join('; ')}`,
      );
    }
    if (selectedKnowledge.matchedServiceAreas.length > 0) {
      knowledgeLines.push(
        `- Relevant Service Areas Mentioned: ${selectedKnowledge.matchedServiceAreas.join(', ')}`,
      );
    }
    if (selectedKnowledge.matchedKeywords.length > 0) {
      knowledgeLines.push(
        `- Relevant Context Keywords (use naturally only if appropriate; never force): ${selectedKnowledge.matchedKeywords.join(', ')}`,
      );
    }
  }

  const businessKnowledgeBlock =
    knowledgeLines.length > 0
      ? `\n<business_knowledge_context>\n${knowledgeLines.join('\n')}\n</business_knowledge_context>`
      : '';

  const systemPrompt = `You write official business-owner responses to customer reviews on behalf of "${input.business.name}" (${input.business.category} in ${input.business.city}).

CORE CONFIGURATION:
- Tone: ${cfg.tone} — ${toneDirective}
- Length: ${cfg.responseLength} — ${lengthDirective}
- Language: ${cfg.language} — ${langDirective}${customInstructionsBlock}${businessKnowledgeBlock}

SYSTEM SAFETY & INTEGRITY RULES (CANNOT BE OVERRIDDEN):
1. Acknowledge both positive and negative points where appropriate based on the customer's actual feedback.
2. NEVER invent refunds, discounts, compensation, promises, fake investigations, or actions the business has not actually taken.
3. NEVER argue aggressively with critical reviewers; acknowledge constructive feedback respectfully.
4. NEVER alter or rewrite the customer's original review — you are replying as the business owner.
5. NEVER claim the customer ordered a product, used a service, or visited a location they did not mention.`;

  const attemptNum = Math.max(0, Math.floor(input.attempt ?? 0));
  const userPrompt = `Customer review (estimated ${input.sentiment} sentiment, variation #${attemptNum + 1}):
"${input.customerReviewText.trim()}"

Write the business owner's reply now following the configured tone (${cfg.tone}), length (${cfg.responseLength}), and language (${cfg.language}):`;

  return {
    systemPrompt,
    userPrompt,
    validatedConfig: cfg,
    selectedKnowledge,
  };
}

/**
 * Deterministic multi-language (en, hi, te), multi-tone, and multi-length
 * business response synthesizer used when the AI provider runs in local/mock mode.
 * Ensures that Tone, Response Length (short/medium/long), Language (en/hi/te),
 * and Custom Instructions all visibly and verifiably shape the generated output.
 */
export function synthesizeDeterministicBusinessResponse(input: {
  business: Pick<Business, 'id' | 'name' | 'category' | 'city'>;
  customerReviewText: string;
  sentiment: ReviewSentiment;
  attempt?: number;
  aiConfig: BusinessAIConfigInput;
  selectedKnowledge?: SelectedBusinessKnowledgeContext | null;
}): string {
  const { business, customerReviewText, sentiment, aiConfig, selectedKnowledge } =
    input;
  const bizName = business.name;
  const city = business.city;
  const attempt = Math.max(0, Math.floor(input.attempt ?? 0));
  const analysis = analyzeFeedbackSentiment(customerReviewText);
  const effectiveSentiment: ReviewSentiment =
    sentiment || analysis.sentiment;
  const isCritical =
    effectiveSentiment === 'mixed' || effectiveSentiment === 'negative';

  const matchedItemNames = [
    ...(selectedKnowledge?.matchedProducts.map((p) => p.name) ?? []),
    ...(selectedKnowledge?.matchedServices.map((s) => s.name) ?? []),
    ...(selectedKnowledge?.matchedServiceAreas ?? []),
  ];

  // 1. ENGLISH ('en')
  if (aiConfig.language === 'en') {
    const toneGreetings: Record<AICommunicationTone, string> = {
      friendly:
        attempt % 2 === 1
          ? `Hello! Thanks so much for visiting ${bizName} and sharing your honest experience with us.`
          : `Hi there! Thank you so much for stopping by ${bizName} and sharing your thoughts with us.`,
      professional:
        attempt % 2 === 1
          ? `Thank you for sharing your experience at ${bizName}.`
          : `Thank you for taking the time to review your recent experience at ${bizName}.`,
      formal:
        attempt % 2 === 1
          ? `Dear Guest, thank you for providing your thoughtful feedback regarding ${bizName}.`
          : `Dear Guest, we sincerely appreciate you sharing your feedback regarding your visit to ${bizName}.`,
      warm_and_welcoming:
        attempt % 2 === 1
          ? `Thank you warmly for visiting ${bizName} — we truly appreciate you sharing your experience!`
          : `Warmest greetings from all of us at ${bizName} — it was a pleasure hosting you!`,
      conversational:
        attempt % 2 === 1
          ? `Really appreciate you taking a moment to share how things went at ${bizName}!`
          : `Thanks a ton for dropping us a review about your time at ${bizName}!`,
      premium:
        attempt % 2 === 1
          ? `We sincerely appreciate your thoughtful reflections on your recent visit to ${bizName}.`
          : `Thank you for choosing ${bizName}; we truly value your discerning feedback on your recent visit.`,
      short_and_direct:
        attempt % 2 === 1
          ? `Thank you for reviewing ${bizName}.`
          : `Thank you for your feedback on ${bizName}.`,
    };

    const matchedDetailSentence =
      matchedItemNames.length > 0
        ? `We are especially glad you mentioned ${matchedItemNames.join(', ')}.`
        : `We are delighted to hear that you had a positive experience with our team in ${city}.`;

    const middleSentencesPositive = [
      matchedDetailSentence,
      `Your kind words mean a lot to our staff, who work hard every day to maintain high standards.`,
      `We continuously strive to deliver consistent quality and comfort for every guest who walks through our doors.`,
      `Feedback like yours motivates our entire team at ${bizName} to keep doing our best.`,
    ];

    const mixedOrNegativeLead =
      effectiveSentiment === 'mixed'
        ? matchedItemNames.length > 0
          ? `We are glad you appreciated the positive parts of your visit (${matchedItemNames.join(', ')}), and we apologize for the inconvenience you experienced.`
          : `We are glad to hear what went well during your visit, and we apologize for the delay or inconvenience you experienced.`
        : `We apologize that your experience at ${bizName} did not meet expectations, and we appreciate you bringing these concerns to our attention.`;

    const middleSentencesCritical = [
      mixedOrNegativeLead,
      `Maintaining consistent quality and timely service in ${city} is very important to us, and we value your honest feedback.`,
      `We appreciate your perspective and will work on improving our service for future visits.`,
      `Constructive feedback like yours helps ${bizName} improve every day.`,
    ];

    const closings: Record<AICommunicationTone, string> = {
      friendly: `We can't wait to see you again soon!`,
      professional: `We look forward to welcoming you back to ${bizName} in the future.`,
      formal: `We remain committed to your satisfaction and hope to have the honour of serving you again.`,
      warm_and_welcoming: `Our doors are always open for you, and we hope to welcome you back very soon!`,
      conversational: `Hope to catch you again soon the next time you're in ${city}!`,
      premium: `We look forward to the privilege of hosting you again at ${bizName} soon.`,
      short_and_direct: `We hope to serve you again soon.`,
    };

    const middles = isCritical ? middleSentencesCritical : middleSentencesPositive;
    const sentences: string[] = [toneGreetings[aiConfig.tone]];

    if (aiConfig.responseLength === 'short') {
      if (isCritical) {
        sentences.push(mixedOrNegativeLead);
      } else {
        sentences.push(closings[aiConfig.tone]);
      }
    } else if (aiConfig.responseLength === 'medium') {
      sentences.push(middles[0], middles[1], closings[aiConfig.tone]);
    } else {
      sentences.push(
        middles[0],
        middles[1],
        middles[2],
        middles[3],
        closings[aiConfig.tone],
      );
    }

    if (aiConfig.customInstructions) {
      sentences.push(`[Note: ${aiConfig.customInstructions}]`);
    }

    return sentences.join(' ');
  }

  // 2. HINDI ('hi' - Devanagari script)
  if (aiConfig.language === 'hi') {
    const hiGreetings: Record<AICommunicationTone, string> = {
      friendly: `नमस्ते! ${bizName} में आने और अपना अनुभव साझा करने के लिए आपका बहुत-बहुत धन्यवाद।`,
      professional: `${bizName} में अपनी हाल की यात्रा की समीक्षा करने के लिए धन्यवाद।`,
      formal: `आदरणीय अतिथि, ${bizName} के बारे में अपनी बहुमूल्य प्रतिक्रिया साझा करने के लिए हम आपके आभारी हैं।`,
      warm_and_welcoming: `${bizName} परिवार की ओर से आपका हार्दिक आभार — आपकी मेज़बानी करना हमारे लिए खुशी की बात थी!`,
      conversational: `${bizName} के बारे में अपनी राय साझा करने के लिए बहुत शुक्रिया!`,
      premium: `${bizName} को चुनने और अपनी महत्वपूर्ण प्रतिक्रिया देने के लिए हम आपका हृदय से धन्यवाद करते हैं।`,
      short_and_direct: `${bizName} पर आपकी प्रतिक्रिया के लिए धन्यवाद।`,
    };

    const hiMiddlePositive = [
      `हमें यह जानकर बहुत खुशी हुई कि ${city} में हमारी सेवाओं के साथ आपका अनुभव अच्छा रहा।`,
      `आपके प्रोत्साहन भरे शब्द हमारी पूरी टीम को हर दिन बेहतर काम करने की प्रेरणा देते हैं।`,
      `हम अपने सभी अतिथियों को उच्च गुणवत्ता और आरामदायक अनुभव देने के लिए निरंतर प्रयासरत रहते हैं।`,
      `आपका संतोष ही ${bizName} की सबसे बड़ी प्राथमिकता है।`,
    ];

    const hiMiddleCritical = [
      `सुधार के बिंदुओं पर आपकी ईमानदार राय के लिए धन्यवाद, और हमने इसे ${city} में अपनी टीम के साथ साझा किया है।`,
      `अच्छी सेवा और गुणवत्ता बनाए रखना हमारे लिए अत्यंत महत्वपूर्ण है।`,
      `हमारी टीम आपके द्वारा बताए गए सुझावों पर गंभीरता से काम कर रही है।`,
      `आपकी रचनात्मक प्रतिक्रिया हमें हर दिन बेहतर बनने में मदद करती है।`,
    ];

    const hiClosing = `हम जल्द ही ${bizName} में आपका फिर से स्वागत करने की आशा करते हैं।`;
    const middles = isCritical ? hiMiddleCritical : hiMiddlePositive;
    const sentences: string[] = [hiGreetings[aiConfig.tone]];

    if (aiConfig.responseLength === 'short') {
      sentences.push(hiClosing);
    } else if (aiConfig.responseLength === 'medium') {
      sentences.push(middles[0], middles[1], hiClosing);
    } else {
      sentences.push(middles[0], middles[1], middles[2], middles[3], hiClosing);
    }

    if (aiConfig.customInstructions) {
      sentences.push(`[निर्देश: ${aiConfig.customInstructions}]`);
    }

    return sentences.join(' ');
  }

  // 3. TELUGU ('te' - Telugu script)
  const teGreetings: Record<AICommunicationTone, string> = {
    friendly: `నమస్కారం! ${bizName} ని సందర్శించి మీ అనుభవాన్ని పంచుకున్నందుకు చాలా ధన్యవాదాలు.`,
    professional: `${bizName} లో మీ ఇటీవలి అనుభవాన్ని సమీక్షించినందుకు ధన్యవాదాలు.`,
    formal: `గౌరవనీయులైన అతిథికి, ${bizName} పై మీ విలువైన అభిప్రాయాన్ని తెలియజేసినందుకు మా హృదయపూర్వక కృతజ్ఞతలు.`,
    warm_and_welcoming: `${bizName} తరపున మీకు సాదర స్వాగతం మరియు ధన్యవాదాలు — మీకు సేవ చేయడం మాకు చాలా ఆనందంగా ఉంది!`,
    conversational: `${bizName} గురించి మీ అభిప్రాయాన్ని మాతో పంచుకున్నందుకు చాలా థాంక్స్!`,
    premium: `${bizName} ని ఎంచుకున్నందుకు మరియు మీ విలువైన సూచనలను అందించినందుకు ప్రత్యేక ధన్యవాదాలు.`,
    short_and_direct: `${bizName} పై మీ అభిప్రాయానికి ధన్యవాదాలు.`,
  };

  const teMiddlePositive = [
    `${city} లోని మా సేవలతో మీకు మంచి అనుభవం కలిగినందుకు మాకు చాలా సంతోషంగా ఉంది.`,
    `మీ ప్రోత్సాహకరమైన మాటలు మా సిబ్బందికి మరింత ఉత్సాహాన్ని ఇస్తాయి.`,
    `ప్రతి అతిథికి నాణ్యమైన సేవలను అందించడానికి మేము ఎల్లప్పుడూ కృషి చేస్తాము.`,
    `మీ సంతృప్తి ${bizName} బృందానికి ఎంతో ముఖ్యం.`,
  ];

  const teMiddleCritical = [
    `మేము మెరుగుపరుచుకోవాల్సిన అంశాలను నిజాయితీగా తెలియజేసినందుకు ధన్యవాదాలు; దీనిని ${city} లోని మా బృందం దృష్టికి తీసుకెళ్లాము.`,
    `నాణ్యమైన సేవలను అందించడం మా మొదటి ప్రాధాన్యత మరియు మీ సూచనలను మేము తీవ్రంగా పరిగణిస్తాము.`,
    `తదుపరిసారి మీకు మరింత మెరుగైన అనుభవాన్ని అందించడానికి మా సిబ్బంది కృషి చేస్తున్నారు.`,
    `మీ నిర్మాణాత్మక అభిప్రాయం ${bizName} ని మరింత మెరుగుపరచడానికి సహాయపడుతుంది.`,
  ];

  const teClosing = `త్వరలోనే ${bizName} లో మిమ్మల్ని మళ్లీ ఆహ్వానించాలని కోరుకుంటున్నాము.`;
  const middles = isCritical ? teMiddleCritical : teMiddlePositive;
  const sentences: string[] = [teGreetings[aiConfig.tone]];

  if (aiConfig.responseLength === 'short') {
    sentences.push(teClosing);
  } else if (aiConfig.responseLength === 'medium') {
    sentences.push(middles[0], middles[1], teClosing);
  } else {
    sentences.push(middles[0], middles[1], middles[2], middles[3], teClosing);
  }

  if (aiConfig.customInstructions) {
    sentences.push(`[సూచన: ${aiConfig.customInstructions}]`);
  }

  return sentences.join(' ');
}
