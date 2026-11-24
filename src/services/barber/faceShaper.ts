import { BARBER_UI_MEDIA } from '../../config/barberMedia.ts';

function readViteSupabaseConfig(): { url: string; key: string } | null {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const url = env?.VITE_SUPABASE_URL?.trim();
  const key = env?.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

export type FaceGender = 'male' | 'female';

export type MaleFaceShapeId =
  | 'Oval'
  | 'Square'
  | 'Heart'
  | 'Round'
  | 'Triangle'
  | 'Oblong / Rectangle'
  | 'Diamond';

export type FemaleFaceShapeId =
  | 'Oval'
  | 'Square'
  | 'Heart'
  | 'Round'
  | 'Triangle'
  | 'Rectangle'
  | 'Oblong'
  | 'Diamond'
  | 'Inverted Triangle';

export type FaceShapeId = MaleFaceShapeId | FemaleFaceShapeId;

export interface FaceGeometryMetrics {
  gender: FaceGender;
  /** Relative horizontal caliper values (30-100 scale) */
  foreheadWidth: number;
  cheekboneWidth: number;
  jawWidth: number;
  /** Vertical length relative to cheekbone width (50-135 scale; ~88+ means elongated) */
  faceLength: number;
  jawContour: 'angular' | 'rounded' | 'tapered' | 'pointed';
}

export interface FaceStyleGuide {
  id: FaceShapeId;
  gender: FaceGender;
  summary: string;
  previewImage: string;
  characteristics: string[];
  recommendations: {
    styleName: string;
    whyItWorks: string;
    fadeNote: string;
  }[];
  beardPairing: string;
  barberPrompt: string;
}

export interface FaceAnalysisResult {
  gender: FaceGender;
  faceShape: string;
  confidence: number;
  characteristics: string[];
  recommendations: string[];
  beardPairing: string;
  barberPrompt: string;
  previewImage: string;
  source: 'claude_vision' | 'gemini_vision' | 'openai_vision' | 'openrouter_vision' | 'geometric_caliper';
}

export const MALE_FACE_GUIDES: Record<MaleFaceShapeId, FaceStyleGuide> = {
  Oval: {
    id: 'Oval',
    gender: 'male',
    summary: 'Well-balanced proportions with gently rounded jawline and forehead slightly wider than the chin.',
    previewImage: BARBER_UI_MEDIA.faceStyles.oval,
    characteristics: [
      'Face length is moderately greater than cheekbone width',
      'Forehead sits slightly wider than the rounded jawline',
      'Balanced facial symmetry suits nearly every modern length',
    ],
    recommendations: [
      {
        styleName: 'Textured French Crop + Mid Fade',
        whyItWorks: 'Adds crisp crown texture while keeping side volume clean and balanced.',
        fadeNote: 'Mid drop skin fade keeps natural symmetry without stretching height.',
      },
      {
        styleName: 'Classic Executive Side Part',
        whyItWorks: 'Defines an angular part line that adds mild structure to soft jaw curves.',
        fadeNote: 'Tapered scissor sides or #2 guard clean-up.',
      },
      {
        styleName: 'Pushed-Back Textured Quiff',
        whyItWorks: 'Creates effortless crown lift without overwhelming facial balance.',
        fadeNote: 'Low taper around ears & nape.',
      },
      {
        styleName: 'Clean Buzz Cut + Sharp Shape-Up',
        whyItWorks: 'Oval geometry naturally carries short minimalist silhouettes effortlessly.',
        fadeNote: 'Mid bald fade with crisp temple hairline.',
      },
    ],
    beardPairing: 'Short boxed stubble (3–5 mm) or clean shave to preserve natural balance.',
    barberPrompt: 'Textured top with mid skin taper fade + crisp temple line-up and light 4mm boxed stubble.',
  },
  Square: {
    id: 'Square',
    gender: 'male',
    summary: 'Strong, angular jawline and similarly proportional forehead, cheekbones, and jaw width.',
    previewImage: BARBER_UI_MEDIA.faceStyles.square,
    characteristics: [
      'Forehead, cheekbones, and jawline share nearly equal width',
      'Strong, chisel-defined 90-degree mandibular jaw corner',
      'Face length and width sit in tight athletic proportion',
    ],
    recommendations: [
      {
        styleName: 'High-Volume Crew Cut + Tight Fade',
        whyItWorks: 'Sharpens clean upper proportions while showing off your strong jawline.',
        fadeNote: 'High skin or #0.5 drop fade keeping tight perimeter.',
      },
      {
        styleName: 'Classic Ivy League / Taper Cut',
        whyItWorks: 'Neat combed top adds refined versatility for both formal & casual settings.',
        fadeNote: 'Natural scissor taper behind ears.',
      },
      {
        styleName: 'Textured Comb-Over Pompadour',
        whyItWorks: 'Draws slight vertical height on top to elongate the balanced square frame.',
        fadeNote: 'Mid fade blended high into crown.',
      },
      {
        styleName: 'Uniform Textured Buzz (#3 Top)',
        whyItWorks: 'Highlights strong bone structure cleanly with minimal styling time.',
        fadeNote: 'Razor fade on temples & neck.',
      },
    ],
    beardPairing: 'Keep stubble ultra-short (2–3 mm) or clean-shaven so your sharp bone structure stays hero.',
    barberPrompt: 'Tight mid-high fade with textured crew/ivy top and short 2mm jawline-hugging stubble.',
  },
  Heart: {
    id: 'Heart',
    gender: 'male',
    summary: 'Wider upper forehead and brow line that tapers gracefully toward a narrower chin.',
    previewImage: BARBER_UI_MEDIA.faceStyles.heart,
    characteristics: [
      'Forehead and brow line are noticeably wider than the lower jaw',
      'High cheekbones tapering down to a narrower pointed chin',
      'Benefits from medium top volume without extreme tight high fades',
    ],
    recommendations: [
      {
        styleName: 'Medium Layered Fringe / Curtain Flow',
        whyItWorks: 'Softens upper forehead width while framing cheekbones cleanly.',
        fadeNote: 'Soft scissor taper (avoid overly stark shaved sides).',
      },
      {
        styleName: 'Side-Swept Textured Fringe',
        whyItWorks: 'Breaks up a broad brow visually and builds natural diagonal movement.',
        fadeNote: 'Low drop taper keeping medium side weight.',
      },
      {
        styleName: 'Mid-Length Brush-Back',
        whyItWorks: 'Balances upper and lower facial thirds with controlled volume.',
        fadeNote: 'Classic tapered neck with natural sideburns.',
      },
    ],
    beardPairing: 'Lightly fuller boxed beard around the chin (6–8 mm) adds strong visual weight to the lower jaw.',
    barberPrompt: 'Medium scissor-layered textured fringe with low taper sides + slightly fuller chin beard balancing jaw.',
  },
  Round: {
    id: 'Round',
    gender: 'male',
    summary: 'Similar face length and cheekbone width with softer cheeks and gently curved jawline.',
    previewImage: BARBER_UI_MEDIA.faceStyles.round,
    characteristics: [
      'Cheekbone width closely matches total face length',
      'Soft, curved chin and fuller cheek fullness',
      'Hairstyles adding crisp vertical height and tighter sides create instant definition',
    ],
    recommendations: [
      {
        styleName: 'Spiky Faux Hawk / High Textured Quiff',
        whyItWorks: 'Lifts eye line vertically so the overall silhouette reads noticeably longer and leaner.',
        fadeNote: 'High skin fade right into crown corner.',
      },
      {
        styleName: 'High-Top Undercut + Sharp Side Part',
        whyItWorks: 'Adds crisp geometric angles that contrast soft cheek contours.',
        fadeNote: 'Tight #1 high fade minimizing side roundness.',
      },
      {
        styleName: 'Angular Textured Pompadour',
        whyItWorks: 'Creates tall vertical volume on top while tapering sides slim.',
        fadeNote: 'Clean high drop fade.',
      },
    ],
    beardPairing: 'Squared goatee or crisp angled cheek-line beard lengthens the lower third noticeably.',
    barberPrompt: 'High tight fade on sides with tall structured textured quiff on top + crisp angular cheek beard.',
  },
  Triangle: {
    id: 'Triangle',
    gender: 'male',
    summary: 'Dominant, broader jawline paired with cheekbones and forehead that narrow upward.',
    previewImage: BARBER_UI_MEDIA.faceStyles.triangle,
    characteristics: [
      'Jawline sits wider than cheekbones and temples',
      'Narrower upper forehead benefits from structured crown volume',
      'Fullness at temples & upper sides balances strong lower jaw',
    ],
    recommendations: [
      {
        styleName: 'Textured Fringe with Scissor Volume',
        whyItWorks: 'Builds upper temple fullness so forehead matches lower jaw width effortlessly.',
        fadeNote: 'Scissor-cut sides — skip ultra-high skin fades.',
      },
      {
        styleName: 'Medium Layered Pompadour / Side Swept',
        whyItWorks: 'Adds visual breadth across the upper third for harmonious alignment.',
        fadeNote: 'Low/mid scissor taper keeping upper fullness.',
      },
      {
        styleName: 'Full Textured Waves / Messy Layering',
        whyItWorks: 'Natural horizontal flow at temple height balances bold jaw width.',
        fadeNote: 'Clean tapered neckline only.',
      },
    ],
    beardPairing: 'Clean-shaven or ultra-tight designer stubble (1.5 mm) keeps the lower jaw from feeling heavy.',
    barberPrompt: 'Full textured scissor-cut top with temple volume, soft low taper, and clean/light 1.5mm trim.',
  },
  'Oblong / Rectangle': {
    id: 'Oblong / Rectangle',
    gender: 'male',
    summary: 'Significantly elongated face with uniform width from forehead through jawline.',
    previewImage: BARBER_UI_MEDIA.faceStyles.oblong,
    characteristics: [
      'Face length exceeds cheekbone width by a noticeable margin',
      'Forehead, cheeks, and jaw maintain uniform straight side lines',
      'Avoid sky-high pompadours; aim for balanced side thickness and soft fringe',
    ],
    recommendations: [
      {
        styleName: 'Classic Side Part with Scissor Sides',
        whyItWorks: 'Preserves balanced width on the sides rather than elongating further.',
        fadeNote: 'Classic #2–#4 scissor/clipper taper (avoid tall skin fades).',
      },
      {
        styleName: 'Textured Crop with Forward Fringe',
        whyItWorks: 'Light forehead fringe shortens overall vertical appearance cleanly.',
        fadeNote: 'Low tapered perimeter with fuller temple weight.',
      },
      {
        styleName: 'Mid-Length Brush Over',
        whyItWorks: 'Balanced horizontal silhouette keeps proportions athletic.',
        fadeNote: 'All-scissor classic trim.',
      },
    ],
    beardPairing: 'Even short uniform beard (4–5 mm) without extended chin length avoids stretching face further.',
    barberPrompt: 'Scissor-tapered sides with textured forward fringe/side part (avoid extreme top height or skin fade).',
  },
  Diamond: {
    id: 'Diamond',
    gender: 'male',
    summary: 'Prominent, widest cheekbones framed by a narrower forehead and tapered chin.',
    previewImage: BARBER_UI_MEDIA.faceStyles.diamond,
    characteristics: [
      'Cheekbones mark the clear widest point of the face',
      'Angular chin paired with slightly narrower brow/temple width',
      'Textured medium length and brow-adding fringes shine on this structure',
    ],
    recommendations: [
      {
        styleName: 'Textured Layered Fringe / Locks',
        whyItWorks: 'Adds softness & visual width across the forehead to harmonize with sharp cheekbones.',
        fadeNote: 'Keep medium side volume or soft drop taper.',
      },
      {
        styleName: 'Side-Swept Long Textured Quiff',
        whyItWorks: 'Draws attention diagonally across brows while spotlighting cheekbone structure.',
        fadeNote: 'Low scissor taper for seamless blend.',
      },
      {
        styleName: 'Loose Textured Faux Hawk',
        whyItWorks: 'Maintains length through upper corners while tapering neck neatly.',
        fadeNote: 'Natural nape taper.',
      },
    ],
    beardPairing: 'Light to medium boxed beard rounds out a sharp pointed chin comfortably.',
    barberPrompt: 'Medium textured layers with diagonal brow width, soft low taper, and sculpted 5mm boxed beard.',
  },
};

export const FEMALE_FACE_GUIDES: Record<FemaleFaceShapeId, FaceStyleGuide> = {
  Oval: {
    id: 'Oval',
    gender: 'female',
    summary: 'Harmonious length-to-width balance with softly rounded jawline.',
    previewImage: BARBER_UI_MEDIA.faceStyles.oval,
    characteristics: [
      'Forehead slightly broader than rounded jaw',
      'Even proportions work across pixie, bob, lob, and long layers',
    ],
    recommendations: [
      { styleName: 'Blunt Collarbone Lob', whyItWorks: 'Frames cheekbones cleanly.', fadeNote: 'Sharp even perimeter.' },
      { styleName: 'Face-Framing Soft Layers', whyItWorks: 'Highlights natural balance.', fadeNote: 'Starts below chin.' },
      { styleName: 'Textured Pixie Cut', whyItWorks: 'Showcases bone structure effortlessly.', fadeNote: 'Tapered nape.' },
    ],
    beardPairing: 'Soft wispy curtain bangs effortlessly spotlight eye symmetry.',
    barberPrompt: 'Balanced collarbone layers or blunt bob with light face-framing movement.',
  },
  Square: {
    id: 'Square',
    gender: 'female',
    summary: 'Defined angular jaw and uniform brow-to-jaw proportions.',
    previewImage: BARBER_UI_MEDIA.faceStyles.square,
    characteristics: [
      'Strong horizontal jawline & hairline',
      'Minimum facial taper — soft curves add elegant contrast',
    ],
    recommendations: [
      { styleName: 'Long Layered Waves', whyItWorks: 'Softens angular jaw edges naturally.', fadeNote: 'Long movement past jaw.' },
      { styleName: 'Side-Swept Wispy Shag', whyItWorks: 'Breaks up boxy horizontal symmetry.', fadeNote: 'Feathered ends.' },
      { styleName: 'Soft A-Line Lob', whyItWorks: 'Elongates jawline gently forward.', fadeNote: 'Below-chin length.' },
    ],
    beardPairing: 'Diagonal side-swept fringe softens brow and jaw corners.',
    barberPrompt: 'Softly textured shoulder+ layers with wispy feathered framing past the jawline.',
  },
  Round: {
    id: 'Round',
    gender: 'female',
    summary: 'Similar facial width and height with soft curved chin contours.',
    previewImage: BARBER_UI_MEDIA.faceStyles.round,
    characteristics: [
      'Fullest width across cheeks',
      'Benefits from vertical length below the chin & off-center parting',
    ],
    recommendations: [
      { styleName: 'Long Angled Lob', whyItWorks: 'Creates sleek vertical framing lines.', fadeNote: 'Clean front angle.' },
      { styleName: 'Deep Side-Part Voluminous Layers', whyItWorks: 'Adds diagonal asymmetry & height.', fadeNote: 'Keep sides sleek near cheeks.' },
      { styleName: 'Crown-Volume Pixie', whyItWorks: 'Lifts crown vertically.', fadeNote: 'Sleek temples.' },
    ],
    beardPairing: 'Skip heavy blunt bangs; favor deep side parts or long cheek-grazing layers.',
    barberPrompt: 'Sleek angled lob past collarbone with deep side part and subtle crown lift.',
  },
  Heart: {
    id: 'Heart',
    gender: 'female',
    summary: 'Broad brow and sculpted cheekbones narrowing down to a delicate chin.',
    previewImage: BARBER_UI_MEDIA.faceStyles.heart,
    characteristics: [
      'Widest across temples/cheeks; narrow pointed chin',
      'Chin-level volume balances upper and lower silhouette',
    ],
    recommendations: [
      { styleName: 'Curtain Bangs + Layered Bob', whyItWorks: 'Softens brow breadth and adds fullness near chin.', fadeNote: 'Ends flip lightly outward.' },
      { styleName: 'Wavy Shoulder Lob', whyItWorks: 'Draws weight below cheekbones.', fadeNote: 'Textured lower third.' },
      { styleName: 'Side-Parted Mid Layers', whyItWorks: 'Frames delicate jaw cleanly.', fadeNote: 'Wispy brow sweep.' },
    ],
    beardPairing: 'Wispy parted curtain bangs harmonize forehead and chin seamlessly.',
    barberPrompt: 'Chin-to-shoulder layered bob with gentle volume below ears and soft curtain bangs.',
  },
  Diamond: {
    id: 'Diamond',
    gender: 'female',
    summary: 'High dramatic cheekbones with narrower brow and jawline.',
    previewImage: BARBER_UI_MEDIA.faceStyles.diamond,
    characteristics: [
      'Cheekbones mark widest horizontal axis',
      'Narrower forehead & chin shine with fullness at ends and temples',
    ],
    recommendations: [
      { styleName: 'Chin-Length Textured Bob', whyItWorks: 'Adds balanced fullness around narrower jaw.', fadeNote: 'Tuckable behind ear.' },
      { styleName: 'Layered Shag with Fringe', whyItWorks: 'Opens temple silhouette cleanly.', fadeNote: 'Feather-cut crown.' },
      { styleName: 'Sweeping Collarbone Waves', whyItWorks: 'Spotlight high cheekbones gently.', fadeNote: 'Soft face-framing.' },
    ],
    beardPairing: 'Feathered temple fringe adds effortless balance.',
    barberPrompt: 'Chin-length textured bob or wispy shag highlighting cheekbones with soft jaw volume.',
  },
  Triangle: {
    id: 'Triangle',
    gender: 'female',
    summary: 'Wider jawline transitioning smoothly up toward a narrower forehead.',
    previewImage: BARBER_UI_MEDIA.faceStyles.triangle,
    characteristics: [
      'Jawline exceeds brow width',
      'Crown & temple volume brings harmonious top-to-bottom symmetry',
    ],
    recommendations: [
      { styleName: 'Layered Volume Pixie / Bixie', whyItWorks: 'Concentrates lift & fullness above temples.', fadeNote: 'Tapered nape.' },
      { styleName: 'Crown-Lifted Shoulder Shag', whyItWorks: 'Builds breadth across upper half.', fadeNote: 'Choppy upper layers.' },
      { styleName: 'Side-Swept Long Layers', whyItWorks: 'Softens lower jaw width cleanly.', fadeNote: 'Light volume near crown.' },
    ],
    beardPairing: 'Breezy layered crown with tapered ends avoids adding lower-jaw weight.',
    barberPrompt: 'Upper-crown layered cut building temple fullness with clean tapered lower ends.',
  },
  'Inverted Triangle': {
    id: 'Inverted Triangle',
    gender: 'female',
    summary: 'Distinctly wider brow and cheekbones with narrow sculpted chin.',
    previewImage: BARBER_UI_MEDIA.faceStyles.heart,
    characteristics: [
      'Broad upper third tapering sharply downward',
      'Lower-third waves & chin fullness create instant harmony',
    ],
    recommendations: [
      { styleName: 'Wavy Chin-to-Collarbone Lob', whyItWorks: 'Builds natural fullness along lower jaw.', fadeNote: 'Soft textured tips.' },
      { styleName: 'Long Bottom-Curled Layers', whyItWorks: 'Shifts weight effortlessly downward.', fadeNote: 'Smooth sleek roots.' },
      { styleName: 'Curtain Fringe + Soft Waves', whyItWorks: 'Narrows temple breadth aesthetically.', fadeNote: 'Graduated ends.' },
    ],
    beardPairing: 'Keep roots sleek and add bounce from jawline down.',
    barberPrompt: 'Sleek roots transitioning into full waves below jawline with soft parted fringe.',
  },
  Rectangle: {
    id: 'Rectangle',
    gender: 'female',
    summary: 'Elongated silhouette with clean straight sides and square jawline.',
    previewImage: BARBER_UI_MEDIA.faceStyles.oblong,
    characteristics: [
      'Face noticeably taller than wide',
      'Soft horizontal texture and gentle bangs bring width back to center',
    ],
    recommendations: [
      { styleName: 'Voluminous Shoulder Waves', whyItWorks: 'Adds natural side-to-side fullness.', fadeNote: 'Soft rounded perimeter.' },
      { styleName: 'Blunt Bangs + Medium Shag', whyItWorks: 'Reduces vertical length cleanly.', fadeNote: 'Eyebrow-skimming fringe.' },
      { styleName: 'Curled Collarbone Bob', whyItWorks: 'Softens sharp corners & shortens height.', fadeNote: 'Layered mid-shaft.' },
    ],
    beardPairing: 'Softly textured brow-skimming bangs work wonders for elongation.',
    barberPrompt: 'Eyebrow-skimming textured fringe paired with voluminous shoulder waves.',
  },
  Oblong: {
    id: 'Oblong',
    gender: 'female',
    summary: 'Gracefully tall and narrow face with similar width throughout.',
    previewImage: BARBER_UI_MEDIA.faceStyles.oblong,
    characteristics: [
      'Long vertical proportion with narrow profile',
      'Width-building side waves & bangs add ideal proportion',
    ],
    recommendations: [
      { styleName: 'Textured Curly Bob', whyItWorks: 'Adds instant horizontal dimension.', fadeNote: 'Cheekbone-level bounce.' },
      { styleName: 'Airy Curtain Fringe + Lob', whyItWorks: 'Visual break shortens high forehead.', fadeNote: 'Mid-neck length.' },
      { styleName: 'Feathered Mid-Length Layers', whyItWorks: 'Creates lush body through sides.', fadeNote: 'Volume at cheekbones.' },
    ],
    beardPairing: 'Keep crown sleeker while emphasizing breezy cheek-level waves.',
    barberPrompt: 'Cheek-level layered bob or lob with airy bangs boosting horizontal fullness.',
  },
};

export function lookupStyleGuide(gender: FaceGender, shapeName: string): FaceStyleGuide {
  const normalized = shapeName.trim().toLowerCase();
  const table = gender === 'female' ? FEMALE_FACE_GUIDES : MALE_FACE_GUIDES;
  const guides = Object.values(table);

  for (const guide of guides) {
    if (guide.id.toLowerCase() === normalized) {
      return guide;
    }
  }

  const sortedBySpecificity = [...guides].sort(
    (a, b) => b.id.length - a.id.length,
  );
  for (const guide of sortedBySpecificity) {
    if (normalized.includes(guide.id.toLowerCase().split('/')[0].trim())) {
      return guide;
    }
  }

  return table.Oval;
}

/**
 * Classifies face shape geometrically from forehead, cheekbone, jawline, and face length ratios
 * aligned with Goodman's Barber Lounge (Male) and Headcurve (Female) criteria.
 */
export function classifyFaceGeometry(metrics: FaceGeometryMetrics): FaceAnalysisResult {
  const { gender, foreheadWidth, cheekboneWidth, jawWidth, faceLength, jawContour } = metrics;
  const maxWidth = Math.max(foreheadWidth, cheekboneWidth, jawWidth, 1);
  const lengthRatio = faceLength / maxWidth; // ~1.0 = round/square, >1.18 = elongated

  let shapeId: FaceShapeId = 'Oval';
  let confidence = 0.84;

  const browMinusJaw = foreheadWidth - jawWidth;
  const jawMinusBrow = jawWidth - foreheadWidth;
  const cheekDominance = cheekboneWidth - Math.max(foreheadWidth, jawWidth);

  if (lengthRatio >= 1.18 && Math.abs(browMinusJaw) < 12) {
    shapeId = gender === 'female' ? (jawContour === 'angular' ? 'Rectangle' : 'Oblong') : 'Oblong / Rectangle';
    confidence = 0.86;
  } else if (
    cheekDominance >= 7 &&
    lengthRatio > 1.04 &&
    jawContour !== 'rounded' &&
    foreheadWidth < cheekboneWidth &&
    jawWidth < cheekboneWidth
  ) {
    shapeId = 'Diamond';
    confidence = 0.85;
  } else if (browMinusJaw >= 10) {
    if (gender === 'female' && browMinusJaw >= 16 && jawContour !== 'pointed') {
      shapeId = 'Inverted Triangle';
    } else {
      shapeId = 'Heart';
    }
    confidence = 0.87;
  } else if (jawMinusBrow >= 9) {
    shapeId = 'Triangle';
    confidence = 0.86;
  } else if (lengthRatio <= 1.04) {
    shapeId = jawContour === 'angular' ? 'Square' : 'Round';
    confidence = 0.88;
  } else if (jawContour === 'angular' && Math.abs(browMinusJaw) <= 8) {
    shapeId = 'Square';
    confidence = 0.83;
  } else {
    shapeId = 'Oval';
    confidence = 0.86;
  }

  const guide = lookupStyleGuide(gender, shapeId);

  const observedStats = [
    `Length-to-width ratio ${lengthRatio.toFixed(2)}:1 (${lengthRatio >= 1.15 ? 'elongated structure' : lengthRatio <= 1.04 ? 'compact balanced width' : 'balanced length'})`,
    browMinusJaw >= 8
      ? `Forehead leads jawline by ~${Math.round(browMinusJaw)} proportion units`
      : jawMinusBrow >= 8
        ? `Jawline measures ~${Math.round(jawMinusBrow)} units broader than brow`
        : cheekDominance >= 7
          ? `Cheekbones lead both forehead & jawline by ~${Math.round(cheekDominance)} units`
          : 'Forehead, cheekbones & jaw maintain even lateral balance',
    ...guide.characteristics.slice(0, 2),
  ];

  return {
    gender,
    faceShape: guide.id,
    confidence,
    characteristics: observedStats,
    recommendations: guide.recommendations.map(
      (r) => `${r.styleName} — ${r.whyItWorks} (${r.fadeNote})`,
    ),
    beardPairing: guide.beardPairing,
    barberPrompt: guide.barberPrompt,
    previewImage: guide.previewImage,
    source: 'geometric_caliper',
  };
}

/**
 * Resizes and compresses any uploaded or captured image cleanly on an offscreen canvas
 * so server uploads remain tiny (< 200 KB) and fast on 4G mobile connections.
 */
export async function compressFaceImageForAnalysis(
  fileOrBlob: Blob,
  maxSide = 768,
): Promise<{ previewDataUrl: string; base64: string; mimeType: 'image/jpeg'; autoMetrics?: Partial<FaceGeometryMetrics> }> {
  const objectUrl = URL.createObjectURL(fileOrBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode image file. Please choose a valid JPG, PNG, or WebP photo.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to initialize canvas image processor.');
    }
    ctx.drawImage(img, 0, 0, width, height);

    const previewDataUrl = canvas.toDataURL('image/jpeg', 0.84);
    const base64 = previewDataUrl.split(',')[1] ?? '';

    let autoMetrics: Partial<FaceGeometryMetrics> | undefined;
    try {
      const MaybeDetector = (window as unknown as {
        FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
          detect(target: CanvasImageSource): Promise<Array<{ boundingBox: { width: number; height: number } }>>;
        };
      }).FaceDetector;
      if (MaybeDetector) {
        const detector = new MaybeDetector({ fastMode: true, maxDetectedFaces: 1 });
        const faces = await detector.detect(canvas);
        if (faces[0]?.boundingBox) {
          const box = faces[0].boundingBox;
          const ratio = box.height / Math.max(box.width, 1);
          autoMetrics = {
            faceLength: Math.min(125, Math.max(68, Math.round(74 * Math.max(0.9, Math.min(1.45, ratio))))),
          };
        }
      }
    } catch {
      // Browser FaceDetector unavailable — default caliper handles apply cleanly
    }

    return { previewDataUrl, base64, mimeType: 'image/jpeg', autoMetrics };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Calls server-side analyze-face-shape Vision Edge Function if configured,
 * returning null when falling back to our geometric caliper engine.
 */
export async function callVisionFaceAnalyzer(
  base64: string,
  mimeType: 'image/jpeg',
): Promise<FaceAnalysisResult | null> {
  const cfg = readViteSupabaseConfig();
  if (!cfg) return null;

  try {
    const res = await fetch(`${cfg.url}/functions/v1/analyze-face-shape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
      },
      body: JSON.stringify({ imageBase64: base64, mimeType }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      fallbackToLocal?: boolean;
      gender?: string;
      face_shape?: string;
      confidence?: number;
      characteristics?: string[];
      recommendations?: string[];
      beard_pairing?: string;
      source?: FaceAnalysisResult['source'];
    };

    if (data.fallbackToLocal || !data.face_shape || data.face_shape === 'error') {
      return null;
    }

    const gender: FaceGender = data.gender === 'female' ? 'female' : 'male';
    const guide = lookupStyleGuide(gender, data.face_shape);
    return {
      gender,
      faceShape: data.face_shape,
      confidence: typeof data.confidence === 'number' ? Math.max(0.1, Math.min(1, data.confidence)) : 0.85,
      characteristics:
        Array.isArray(data.characteristics) && data.characteristics.length > 0
          ? data.characteristics
          : guide.characteristics,
      recommendations:
        Array.isArray(data.recommendations) && data.recommendations.length > 0
          ? data.recommendations
          : guide.recommendations.map((r) => `${r.styleName} — ${r.whyItWorks}`),
      beardPairing: data.beard_pairing || guide.beardPairing,
      barberPrompt: guide.barberPrompt,
      previewImage: guide.previewImage,
      source: data.source ?? 'claude_vision',
    };
  } catch {
    return null;
  }
}
