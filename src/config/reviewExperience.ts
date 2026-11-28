import type {
  BusinessCategory,
  ExperienceRating,
  ReviewFontStyle,
} from '../types/business';

/**
 * Single source of truth for the customer review experience:
 * business categories, their emoji + quick-tap highlight options,
 * overall rating choices, and the review display fonts.
 *
 * Every `phrase` is a short, factual first-person clause. The selected
 * phrases are stitched into the customer's experience text and sent to the
 * AI, which rewrites them into a natural review without inventing details.
 */

export interface HighlightOption {
  id: string;
  emoji: string;
  label: string;
  phrase: string;
}

export interface CategoryExperience {
  label: string;
  setupLabel: string;
  emoji: string;
  /** Small decorative emojis that float around the welcome illustration. */
  sceneEmojis: [string, string, string];
  greeting: string;
  liked: HighlightOption[];
  improve: HighlightOption[];
  notePlaceholder: string;
}

export const CATEGORY_ORDER: BusinessCategory[] = [
  'restaurant',
  'cafe',
  'hotel',
  'pg',
  'salon',
  'barber',
  'clinic',
  'catering',
  'gym',
  'loyalty',
  'retail',
  'services',
];

export const CATEGORY_EXPERIENCE: Record<BusinessCategory, CategoryExperience> = {
  restaurant: {
    label: 'Restaurant',
    setupLabel: 'Restaurant / Dining',
    emoji: '🍽️',
    sceneEmojis: ['🍛', '🥗', '🍹'],
    greeting: 'Hope you enjoyed your meal!',
    liked: [
      { id: 'tasty', emoji: '🍛', label: 'Tasty food', phrase: 'the food was fresh and tasty' },
      { id: 'clean', emoji: '🧼', label: 'Clean & hygienic', phrase: 'the place was clean and hygienic' },
      { id: 'staff', emoji: '🙋', label: 'Friendly staff', phrase: 'the staff were friendly and polite' },
      { id: 'quick', emoji: '⚡', label: 'Quick service', phrase: 'the service was quick' },
      { id: 'ambience', emoji: '🪑', label: 'Nice ambience', phrase: 'the ambience and seating were comfortable' },
      { id: 'value', emoji: '💰', label: 'Value for money', phrase: 'the prices were reasonable for the quality' },
      { id: 'portions', emoji: '🥘', label: 'Good portions', phrase: 'the portion sizes were generous' },
    ],
    improve: [
      { id: 'slow', emoji: '🐢', label: 'Slow service', phrase: 'the service was slow' },
      { id: 'cold', emoji: '🥶', label: 'Food was cold', phrase: 'some of the food was served cold' },
      { id: 'taste', emoji: '🧂', label: 'Taste could improve', phrase: 'the taste could be better' },
      { id: 'hygiene', emoji: '🧹', label: 'Cleanliness', phrase: 'the cleanliness could be better' },
      { id: 'pricey', emoji: '💸', label: 'A bit expensive', phrase: 'it felt a bit expensive' },
      { id: 'noisy', emoji: '🔊', label: 'Noisy / crowded', phrase: 'it was quite noisy and crowded' },
    ],
    notePlaceholder: 'Which dish did you love? Anything we should know?',
  },
  cafe: {
    label: 'Cafe & Bakery',
    setupLabel: 'Cafe / Bakery / Coffee',
    emoji: '☕',
    sceneEmojis: ['🥐', '🧁', '🍵'],
    greeting: 'Hope you enjoyed your cuppa!',
    liked: [
      { id: 'coffee', emoji: '☕', label: 'Great coffee', phrase: 'the coffee was really good' },
      { id: 'bakes', emoji: '🥐', label: 'Fresh snacks & bakes', phrase: 'the snacks and bakes were fresh' },
      { id: 'cozy', emoji: '🛋️', label: 'Cozy vibe', phrase: 'the cafe had a cozy, relaxed vibe' },
      { id: 'staff', emoji: '🙋', label: 'Friendly staff', phrase: 'the staff were friendly' },
      { id: 'wifi', emoji: '📶', label: 'Good for work', phrase: 'it was a comfortable place to work with good Wi-Fi' },
      { id: 'aesthetic', emoji: '📸', label: 'Aesthetic place', phrase: 'the place looks lovely and aesthetic' },
      { id: 'value', emoji: '💰', label: 'Worth the price', phrase: 'the prices felt fair' },
    ],
    improve: [
      { id: 'wait', emoji: '⏳', label: 'Long wait', phrase: 'the order took a while to arrive' },
      { id: 'drinks', emoji: '🥤', label: 'Drinks could improve', phrase: 'the drinks could be better' },
      { id: 'seating', emoji: '🪑', label: 'Hard to find seats', phrase: 'it was hard to find seating' },
      { id: 'pricey', emoji: '💸', label: 'A bit pricey', phrase: 'it felt a little pricey' },
      { id: 'loud', emoji: '🔊', label: 'Too loud', phrase: 'it was a bit too loud' },
    ],
    notePlaceholder: 'What did you order? Your favourite drink or bake?',
  },
  hotel: {
    label: 'Hotel & Stay',
    setupLabel: 'Hotel / Resort / Homestay',
    emoji: '🏨',
    sceneEmojis: ['🛏️', '🌅', '🧳'],
    greeting: 'Hope you had a restful stay!',
    liked: [
      { id: 'room', emoji: '🛏️', label: 'Comfortable room', phrase: 'the room was clean and comfortable' },
      { id: 'washroom', emoji: '🚿', label: 'Clean washroom', phrase: 'the washroom was spotless with good hot water' },
      { id: 'breakfast', emoji: '🍳', label: 'Good breakfast', phrase: 'the breakfast was tasty' },
      { id: 'checkin', emoji: '🛎️', label: 'Smooth check-in', phrase: 'check-in was smooth and quick' },
      { id: 'staff', emoji: '🙋', label: 'Helpful staff', phrase: 'the staff were helpful and courteous' },
      { id: 'location', emoji: '📍', label: 'Great location', phrase: 'the location was convenient' },
      { id: 'view', emoji: '🌅', label: 'Lovely view', phrase: 'the view from the property was lovely' },
    ],
    improve: [
      { id: 'water', emoji: '🚿', label: 'Hot water issue', phrase: 'hot water was not always available' },
      { id: 'clean', emoji: '🧹', label: 'Room cleanliness', phrase: 'room cleanliness could be better' },
      { id: 'wifi', emoji: '📶', label: 'Weak Wi-Fi', phrase: 'the Wi-Fi was weak' },
      { id: 'noise', emoji: '🔊', label: 'Noisy', phrase: 'it was noisy at night' },
      { id: 'roomservice', emoji: '🐢', label: 'Slow room service', phrase: 'room service was slow' },
      { id: 'maintenance', emoji: '🛠️', label: 'AC / maintenance', phrase: 'the AC and maintenance need attention' },
    ],
    notePlaceholder: 'How was your room, food or the staff?',
  },
  pg: {
    label: 'PG / Hostel',
    setupLabel: 'PG / Hostel / Co-living',
    emoji: '🏠',
    sceneEmojis: ['🛏️', '🍲', '📶'],
    greeting: 'Hope it feels like home!',
    liked: [
      { id: 'rooms', emoji: '🛏️', label: 'Clean rooms', phrase: 'the rooms are clean and well maintained' },
      { id: 'food', emoji: '🍲', label: 'Homely food', phrase: 'the food is homely and tasty' },
      { id: 'water', emoji: '💧', label: 'Good water supply', phrase: 'the water supply is reliable' },
      { id: 'wifi', emoji: '📶', label: 'Fast Wi-Fi', phrase: 'the Wi-Fi is fast and reliable' },
      { id: 'power', emoji: '🔌', label: 'Power backup', phrase: 'power backup works well' },
      { id: 'safe', emoji: '🔒', label: 'Safe & secure', phrase: 'the place feels safe and secure' },
      { id: 'owner', emoji: '🙋', label: 'Helpful owner', phrase: 'the owner and staff are helpful' },
      { id: 'laundry', emoji: '🧺', label: 'Housekeeping', phrase: 'housekeeping and laundry are handled well' },
    ],
    improve: [
      { id: 'food', emoji: '🍲', label: 'Food quality', phrase: 'the food quality could improve' },
      { id: 'wifi', emoji: '📶', label: 'Slow Wi-Fi', phrase: 'the Wi-Fi is slow at times' },
      { id: 'water', emoji: '💧', label: 'Water issues', phrase: 'there are occasional water issues' },
      { id: 'cleaning', emoji: '🧹', label: 'Cleaning frequency', phrase: 'cleaning could be more frequent' },
      { id: 'maintenance', emoji: '🛠️', label: 'Slow repairs', phrase: 'repairs and maintenance take time' },
      { id: 'noise', emoji: '🔊', label: 'Noise', phrase: 'it gets noisy sometimes' },
    ],
    notePlaceholder: 'How long have you stayed? What do you like most?',
  },
  salon: {
    label: 'Salon & Spa',
    setupLabel: 'Salon / Spa / Beauty Parlour',
    emoji: '💇',
    sceneEmojis: ['✂️', '💅', '💆'],
    greeting: 'Hope you love your new look!',
    liked: [
      { id: 'style', emoji: '✂️', label: 'Great styling', phrase: 'the haircut and styling were great' },
      { id: 'relax', emoji: '💆', label: 'Relaxing service', phrase: 'the service was very relaxing' },
      { id: 'hygiene', emoji: '🧼', label: 'Hygienic tools', phrase: 'the tools and space were hygienic' },
      { id: 'staff', emoji: '🙋', label: 'Skilled staff', phrase: 'the staff were skilled and friendly' },
      { id: 'ontime', emoji: '⏰', label: 'On time', phrase: 'my appointment started on time' },
      { id: 'price', emoji: '💰', label: 'Fair pricing', phrase: 'the pricing was fair' },
      { id: 'result', emoji: '✨', label: 'Loved the result', phrase: 'I loved the final result' },
    ],
    improve: [
      { id: 'wait', emoji: '⏳', label: 'Long waiting', phrase: 'I had to wait longer than expected' },
      { id: 'result', emoji: '🎯', label: 'Not as I asked', phrase: 'the result was not exactly what I asked for' },
      { id: 'pricey', emoji: '💸', label: 'A bit pricey', phrase: 'it felt a bit pricey' },
      { id: 'hygiene', emoji: '🧹', label: 'Hygiene', phrase: 'hygiene could be better' },
      { id: 'upsell', emoji: '🗣️', label: 'Pushy upselling', phrase: 'there was some pushy upselling' },
    ],
    notePlaceholder: 'Which service did you take? Who helped you?',
  },
  barber: {
    label: 'Barber Shop',
    setupLabel: 'Barber Shop / Men’s Grooming Studio',
    emoji: '💈',
    sceneEmojis: ['✂️', '🪒', '💈'],
    greeting: 'Looking sharp! Hope you loved your cut!',
    liked: [
      { id: 'fade', emoji: '✂️', label: 'Sharp haircut', phrase: 'the haircut and fade were sharp and clean' },
      { id: 'beard', emoji: '🪒', label: 'Great beard trim', phrase: 'the beard trim and styling were super neat' },
      { id: 'hygiene', emoji: '🧼', label: 'Clean tools', phrase: 'the shop and tools were clean and sanitized' },
      { id: 'queue', emoji: '⏱️', label: 'Live queue timer', phrase: 'the live wait-time queue made it super easy to plan my visit' },
      { id: 'barber', emoji: '🙋', label: 'Skilled barber', phrase: 'the barber was skilled and listened carefully' },
      { id: 'price', emoji: '💰', label: 'Fair price', phrase: 'the pricing was very fair' },
    ],
    improve: [
      { id: 'wait', emoji: '⏳', label: 'Longer wait', phrase: 'the wait time felt a bit long' },
      { id: 'cut', emoji: '🎯', label: 'Not exact style', phrase: 'the cut was slightly different from what I asked for' },
      { id: 'hygiene', emoji: '🧹', label: 'Cleanliness', phrase: 'shop cleanliness could be improved' },
      { id: 'pricey', emoji: '💸', label: 'A bit pricey', phrase: 'it felt slightly pricey' },
    ],
    notePlaceholder: 'Which service did you get? Who cut your hair?',
  },
  clinic: {
    label: 'Clinic & Healthcare',
    setupLabel: 'Clinic / Hospital / Dental / Diagnostics',
    emoji: '🩺',
    sceneEmojis: ['💊', '🦷', '❤️'],
    greeting: 'Wishing you good health!',
    liked: [
      { id: 'doctor', emoji: '👩‍⚕️', label: 'Caring doctor', phrase: 'the doctor was caring and patient' },
      { id: 'explain', emoji: '🗣️', label: 'Explained clearly', phrase: 'everything was explained clearly' },
      { id: 'wait', emoji: '⏰', label: 'Short waiting', phrase: 'the waiting time was short' },
      { id: 'clean', emoji: '🧼', label: 'Clean clinic', phrase: 'the clinic was clean and well kept' },
      { id: 'staff', emoji: '🙋', label: 'Helpful staff', phrase: 'the front desk staff were helpful' },
      { id: 'better', emoji: '💪', label: 'Feeling better', phrase: 'I am feeling better after the treatment' },
      { id: 'fees', emoji: '💰', label: 'Fair fees', phrase: 'the fees were reasonable' },
    ],
    improve: [
      { id: 'wait', emoji: '⏳', label: 'Long waiting', phrase: 'the waiting time was long' },
      { id: 'appointment', emoji: '📅', label: 'Appointment hassle', phrase: 'booking an appointment was difficult' },
      { id: 'explain', emoji: '🗣️', label: 'Needed more clarity', phrase: 'I needed a clearer explanation' },
      { id: 'pricey', emoji: '💸', label: 'Expensive', phrase: 'it felt expensive' },
      { id: 'clean', emoji: '🧹', label: 'Cleanliness', phrase: 'cleanliness could be better' },
    ],
    notePlaceholder: 'What were you treated for? How was the care?',
  },
  catering: {
    label: 'Catering & Banquets',
    setupLabel: 'CateringOS & Banquet Halls (Events, Buffets & Bulk Orders)',
    emoji: '🏛️',
    sceneEmojis: ['🍛', '🥂', '🎪'],
    greeting: 'Thank you for celebrating with us!',
    liked: [
      { id: 'taste', emoji: '🍛', label: 'Delicious buffet', phrase: 'every dish on the buffet was hot, fresh, and delicious' },
      { id: 'punctual', emoji: '⏰', label: 'On-time setup', phrase: 'the catering setup and delivery arrived right on time' },
      { id: 'hall', emoji: '🏛️', label: 'Grand banquet hall', phrase: 'the banquet hall ambience, AC, and seating were spotless' },
      { id: 'staff', emoji: '🙋', label: 'Courteous serving staff', phrase: 'the serving staff and event manager were attentive and polite' },
      { id: 'portions', emoji: '🥘', label: 'Generous quantities', phrase: 'food quantities were generous for all our guests' },
      { id: 'value', emoji: '💰', label: 'Transparent pricing', phrase: 'the package pricing was clear and great value' },
    ],
    improve: [
      { id: 'delay', emoji: '⏳', label: 'Refill speed', phrase: 'buffet counter refills could be slightly faster' },
      { id: 'temp', emoji: '🌡️', label: 'Food temperature', phrase: 'a couple of dishes could have been warmer' },
      { id: 'ac', emoji: '❄️', label: 'Hall cooling / sound', phrase: 'hall cooling or sound levels needed minor adjustment' },
      { id: 'coord', emoji: '📋', label: 'Event coordination', phrase: 'pre-event coordination could be smoother' },
    ],
    notePlaceholder: 'What occasion did we cater? Which dish did guests love most?',
  },
  gym: {
    label: 'Gym & Fitness',
    setupLabel: 'Gym / Yoga / Fitness Studio',
    emoji: '🏋️',
    sceneEmojis: ['💪', '🧘', '🥤'],
    greeting: 'Keep crushing your goals!',
    liked: [
      { id: 'equipment', emoji: '🏋️', label: 'Good equipment', phrase: 'the equipment is good and well maintained' },
      { id: 'trainers', emoji: '🧑‍🏫', label: 'Helpful trainers', phrase: 'the trainers are helpful and knowledgeable' },
      { id: 'clean', emoji: '🧼', label: 'Clean & hygienic', phrase: 'the gym is clean and hygienic' },
      { id: 'vibe', emoji: '🎵', label: 'Motivating vibe', phrase: 'the atmosphere is motivating' },
      { id: 'changing', emoji: '🚿', label: 'Clean changing rooms', phrase: 'the changing rooms are clean' },
      { id: 'timings', emoji: '⏰', label: 'Flexible timings', phrase: 'the timings are flexible' },
      { id: 'value', emoji: '💰', label: 'Worth the fee', phrase: 'the membership is worth the fee' },
    ],
    improve: [
      { id: 'crowd', emoji: '👥', label: 'Crowded at peak', phrase: 'it gets crowded at peak hours' },
      { id: 'equipment', emoji: '🛠️', label: 'Equipment upkeep', phrase: 'some equipment needs maintenance' },
      { id: 'clean', emoji: '🧹', label: 'Cleanliness', phrase: 'cleanliness could be better' },
      { id: 'trainer', emoji: '🧑‍🏫', label: 'More trainer attention', phrase: 'trainers could give more attention' },
      { id: 'pricey', emoji: '💸', label: 'A bit pricey', phrase: 'the fees feel a bit high' },
    ],
    notePlaceholder: 'Your goals, favourite trainer or class?',
  },
  loyalty: {
    label: 'Loyalty & AI Reviews',
    setupLabel: 'Standalone Loyalty & AI Reviews (Retail, Clinic, Salon, Bakery)',
    emoji: '⭐',
    sceneEmojis: ['⭐', '🎁', '🛍️'],
    greeting: 'Thanks for visiting us today!',
    liked: [
      { id: 'service', emoji: '🙋', label: 'Helpful service', phrase: 'the team was helpful and welcoming' },
      { id: 'quality', emoji: '✨', label: 'Great quality', phrase: 'the quality exceeded expectations' },
      { id: 'fast', emoji: '⚡', label: 'Quick billing', phrase: 'the checkout experience was smooth and quick' },
      { id: 'clean', emoji: '🧼', label: 'Clean & organized', phrase: 'the place was neat and well organized' },
      { id: 'value', emoji: '💰', label: 'Great value', phrase: 'pricing felt fair for the quality' },
      { id: 'rewards', emoji: '🎁', label: 'Loyalty perks', phrase: 'collecting loyalty stars was super easy' },
    ],
    improve: [
      { id: 'wait', emoji: '⏳', label: 'Counter wait time', phrase: 'checkout took a bit longer than expected' },
      { id: 'stock', emoji: '📦', label: 'Stock availability', phrase: 'some items were out of stock' },
      { id: 'clarity', emoji: '🗣️', label: 'More info needed', phrase: 'clearer guidance would have helped' },
      { id: 'pricey', emoji: '💸', label: 'Pricing', phrase: 'prices felt slightly high' },
    ],
    notePlaceholder: 'What did you buy or experience today?',
  },
  retail: {
    label: 'Retail Store',
    setupLabel: 'Retail / Boutique / Supermarket',
    emoji: '🛍️',
    sceneEmojis: ['👗', '🧾', '🎁'],
    greeting: 'Hope you found what you needed!',
    liked: [
      { id: 'variety', emoji: '🛍️', label: 'Great variety', phrase: 'there was a great variety to choose from' },
      { id: 'quality', emoji: '✅', label: 'Good quality', phrase: 'the product quality was good' },
      { id: 'staff', emoji: '🙋', label: 'Helpful staff', phrase: 'the staff were helpful' },
      { id: 'prices', emoji: '💰', label: 'Good prices', phrase: 'the prices were good' },
      { id: 'billing', emoji: '⚡', label: 'Quick billing', phrase: 'billing was quick' },
      { id: 'neat', emoji: '🧼', label: 'Neat store', phrase: 'the store was neat and well organised' },
      { id: 'exchange', emoji: '🔄', label: 'Easy exchange', phrase: 'exchange and returns were easy' },
    ],
    improve: [
      { id: 'stock', emoji: '📦', label: 'Out of stock', phrase: 'some items were out of stock' },
      { id: 'billing', emoji: '🐢', label: 'Slow billing', phrase: 'billing was slow' },
      { id: 'pricey', emoji: '💸', label: 'A bit pricey', phrase: 'prices felt a bit high' },
      { id: 'staff', emoji: '🙋', label: 'Need more help', phrase: 'I needed more help from the staff' },
      { id: 'untidy', emoji: '🧹', label: 'Untidy', phrase: 'the store felt untidy' },
    ],
    notePlaceholder: 'What did you buy? Anyone who helped you?',
  },
  services: {
    label: 'Local Services',
    setupLabel: 'Local Services (repairs, laundry, tailoring, etc.)',
    emoji: '🛠️',
    sceneEmojis: ['🔧', '🧺', '🚚'],
    greeting: 'Thanks for trusting us with the job!',
    liked: [
      { id: 'quality', emoji: '🛠️', label: 'Quality work', phrase: 'the work quality was excellent' },
      { id: 'ontime', emoji: '⏰', label: 'On time', phrase: 'they arrived and finished on time' },
      { id: 'communication', emoji: '💬', label: 'Clear updates', phrase: 'communication was clear throughout' },
      { id: 'polite', emoji: '🙋', label: 'Professional', phrase: 'they were polite and professional' },
      { id: 'price', emoji: '💰', label: 'Fair price', phrase: 'the price was fair' },
      { id: 'quick', emoji: '⚡', label: 'Quick turnaround', phrase: 'the turnaround was quick' },
      { id: 'tidy', emoji: '🧹', label: 'Left it tidy', phrase: 'they left everything neat and tidy' },
    ],
    improve: [
      { id: 'delay', emoji: '⏳', label: 'Delayed', phrase: 'the work was delayed' },
      { id: 'updates', emoji: '💬', label: 'Poor updates', phrase: 'updates could have been better' },
      { id: 'quote', emoji: '💸', label: 'Higher than quoted', phrase: 'the final bill was higher than quoted' },
      { id: 'redo', emoji: '🔁', label: 'Needed a redo', phrase: 'part of the work had to be redone' },
      { id: 'mess', emoji: '🧹', label: 'Left a mess', phrase: 'they left some mess behind' },
    ],
    notePlaceholder: 'What service did you get done?',
  },
};

export function getCategoryExperience(category: BusinessCategory | string | undefined): CategoryExperience {
  if (category && category in CATEGORY_EXPERIENCE) {
    return CATEGORY_EXPERIENCE[category as BusinessCategory];
  }
  return CATEGORY_EXPERIENCE.restaurant;
}

export const categoryLabels: Record<BusinessCategory, string> = Object.fromEntries(
  CATEGORY_ORDER.map((c) => [c, CATEGORY_EXPERIENCE[c].label]),
) as Record<BusinessCategory, string>;

// ---------------------------------------------------------------------------
// Overall rating (step 1)
// ---------------------------------------------------------------------------

export interface RatingOption {
  id: ExperienceRating;
  emoji: string;
  label: string;
  phrase: string;
  highlightTitle: string;
  highlightSubtitle: string;
}

export const RATING_OPTIONS: RatingOption[] = [
  {
    id: 'excellent',
    emoji: '🤩',
    label: 'Excellent',
    phrase: 'Walked out super happy with my visit.',
    highlightTitle: 'What did you love?',
    highlightSubtitle: 'Tap everything that made it great.',
  },
  {
    id: 'good',
    emoji: '😊',
    label: 'Good',
    phrase: 'Had a really good, smooth visit.',
    highlightTitle: 'What did you like?',
    highlightSubtitle: 'Choose all that apply.',
  },
  {
    id: 'average',
    emoji: '😐',
    label: 'Average',
    phrase: 'Had a mixed visit with some good points and room to improve.',
    highlightTitle: 'What stood out?',
    highlightSubtitle: 'Pick the good bits and what could be better.',
  },
  {
    id: 'not_good',
    emoji: '😞',
    label: 'Not good',
    phrase: 'Left disappointed with my visit today.',
    highlightTitle: 'What could be better?',
    highlightSubtitle: 'Your honest feedback helps them improve.',
  },
];

export function getRatingOption(id: ExperienceRating | null): RatingOption | undefined {
  return RATING_OPTIONS.find((r) => r.id === id);
}

function joinNaturally(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * Builds the factual experience text sent to the AI from the customer's
 * rating, tapped highlights and optional note.
 */
export function composeExperienceText(input: {
  rating: ExperienceRating;
  liked: HighlightOption[];
  improve: HighlightOption[];
  note: string;
}): string {
  const rating = getRatingOption(input.rating);
  const sentences: string[] = [];
  if (rating) sentences.push(rating.phrase);

  if (input.liked.length > 0) {
    sentences.push(`I liked that ${joinNaturally(input.liked.map((o) => o.phrase))}.`);
  }
  if (input.improve.length > 0) {
    const lead = input.improve.length === 1 ? 'One thing that could be better:' : 'Things that could be better:';
    sentences.push(`${lead} ${joinNaturally(input.improve.map((o) => o.phrase))}.`);
  }

  const note = input.note.trim();
  if (note) sentences.push(/[.!?]$/.test(note) ? note : `${note}.`);

  return sentences.join(' ');
}

// ---------------------------------------------------------------------------
// Review display fonts (owner picks one in Dashboard → Settings)
// ---------------------------------------------------------------------------

export interface ReviewFontOption {
  id: ReviewFontStyle;
  label: string;
  tagline: string;
  fontFamily: string;
  fontWeight: number;
  /** Mobile-first size in px; fancy fonts need a little more size to stay readable. */
  fontSize: number;
  lineHeight: number;
}

export const REVIEW_FONT_ORDER: ReviewFontStyle[] = [
  'classic',
  'handwritten',
  'script',
  'typewriter',
  'gothic',
  'gothic_bold',
];

export const REVIEW_FONTS: Record<ReviewFontStyle, ReviewFontOption> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    tagline: 'Clean & modern',
    fontFamily: '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    fontWeight: 400,
    fontSize: 16,
    lineHeight: 1.6,
  },
  handwritten: {
    id: 'handwritten',
    label: 'Handwritten ✍',
    tagline: 'Friendly, personal note',
    fontFamily: '"Caveat", "Segoe Print", cursive',
    fontWeight: 600,
    fontSize: 23,
    lineHeight: 1.35,
  },
  script: {
    id: 'script',
    label: 'Elegant Script',
    tagline: '𝓣𝔂𝓹𝓮 · premium & graceful',
    fontFamily: '"Great Vibes", "Brush Script MT", cursive',
    fontWeight: 400,
    fontSize: 25,
    lineHeight: 1.4,
  },
  typewriter: {
    id: 'typewriter',
    label: 'Typewriter',
    tagline: '𝚃𝚢𝚙𝚎 · retro & honest',
    fontFamily: '"Courier Prime", "Courier New", monospace',
    fontWeight: 400,
    fontSize: 15,
    lineHeight: 1.65,
  },
  gothic: {
    id: 'gothic',
    label: 'Old English',
    tagline: '𝔗𝔶𝔭𝔢 · classic & royal',
    fontFamily: '"UnifrakturMaguntia", "Old English Text MT", serif',
    fontWeight: 400,
    fontSize: 20,
    lineHeight: 1.5,
  },
  gothic_bold: {
    id: 'gothic_bold',
    label: 'Bold Old English',
    tagline: '𝕿𝖞𝖕𝖊 · bold & striking',
    fontFamily: '"UnifrakturCook", "Old English Text MT", serif',
    fontWeight: 700,
    fontSize: 20,
    lineHeight: 1.5,
  },
};

export function getReviewFont(id: ReviewFontStyle | string | undefined | null): ReviewFontOption {
  if (id && id in REVIEW_FONTS) return REVIEW_FONTS[id as ReviewFontStyle];
  return REVIEW_FONTS.classic;
}
