import QRCode from 'qrcode';
import type { Business } from '../../types/business';
import { getCustomerReviewUrl } from '../../utils/sharing';

export type QRTemplateId =
  | 'minimal_google'
  | 'business_branded'
  | 'table_standee';

export interface QRDesignSettings {
  template: QRTemplateId;
  heading: string;
  instruction: string;
  businessName: string;
  accentColor: string;
  logoDataUrl: string | null;
}

export interface QRAccentPreset {
  id: string;
  label: string;
  hex: string;
}

/**
 * Curated high-contrast dark accent colors that maintain WCAG AAA contrast
 * against white (#FFFFFF) and warm white (#F7F7F2) backgrounds, and pair
 * cleanly with muted gold (#D5A34A).
 */
export const QR_ACCENT_PRESETS: QRAccentPreset[] = [
  { id: 'forest', label: 'Forest Green', hex: '#244B40' },
  { id: 'emerald', label: 'Classic Green', hex: '#185A40' },
  { id: 'charcoal', label: 'Charcoal', hex: '#252B29' },
  { id: 'navy', label: 'Deep Navy', hex: '#1E3A5F' },
  { id: 'indigo', label: 'Slate Indigo', hex: '#312E81' },
];

export const QR_TEMPLATE_DEFAULTS: Record<
  QRTemplateId,
  {
    name: string;
    description: string;
    defaultHeading: string;
    defaultInstruction: string;
  }
> = {
  minimal_google: {
    name: 'Template A — Minimal Google-Inspired',
    description:
      'Clean white card with logo badge, central QR code, and Google colour accents.',
    defaultHeading: 'Check us out on Google',
    defaultInstruction: 'Scan to share your experience',
  },
  business_branded: {
    name: 'Template B — Business Branded (Green & Gold)',
    description:
      'Forest green & muted gold architectural double-frame standee with 5-star badge.',
    defaultHeading: 'Please leave us a review',
    defaultInstruction: 'Scan to share your experience',
  },
  table_standee: {
    name: 'Template C — Printable Table Standee (A5)',
    description:
      'Portrait A5 print-friendly layout with large QR code and 3-step guest guide.',
    defaultHeading: 'Share your experience with us',
    defaultInstruction: 'Point your phone camera at the QR code',
  },
};

const STORAGE_PREFIX = 'reviewassist_qr_settings_v1_';

export function getDefaultQRDesignSettings(business: Business): QRDesignSettings {
  return {
    template: 'minimal_google',
    heading: QR_TEMPLATE_DEFAULTS.minimal_google.defaultHeading,
    instruction: QR_TEMPLATE_DEFAULTS.minimal_google.defaultInstruction,
    businessName: business.name,
    accentColor: '#244B40',
    logoDataUrl: null,
  };
}

export function loadBusinessQRSettings(business: Business): QRDesignSettings {
  const defaults = getDefaultQRDesignSettings(business);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${business.id}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<QRDesignSettings>;
        return {
          template:
            parsed.template === 'minimal_google' ||
            parsed.template === 'business_branded' ||
            parsed.template === 'table_standee'
              ? parsed.template
              : defaults.template,
          heading:
            typeof parsed.heading === 'string' && parsed.heading.trim()
              ? parsed.heading
              : defaults.heading,
          instruction:
            typeof parsed.instruction === 'string' && parsed.instruction.trim()
              ? parsed.instruction
              : defaults.instruction,
          businessName:
            typeof parsed.businessName === 'string' && parsed.businessName.trim()
              ? parsed.businessName
              : business.name,
          accentColor:
            typeof parsed.accentColor === 'string' &&
            /^#[0-9a-fA-F]{6}$/.test(parsed.accentColor)
              ? parsed.accentColor
              : defaults.accentColor,
          logoDataUrl:
            typeof parsed.logoDataUrl === 'string' ? parsed.logoDataUrl : null,
        };
      }
    }
  } catch {
    // ignore storage read errors
  }
  return defaults;
}

export function saveBusinessQRSettings(
  businessId: string,
  settings: QRDesignSettings,
): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        `${STORAGE_PREFIX}${businessId}`,
        JSON.stringify(settings),
      );
    }
  } catch {
    // ignore storage quota errors
  }
}

export interface QRMatrixResult {
  /** Encoded business-specific review URL. */
  url: string;
  /** Number of modules per side (excluding quiet zone). */
  moduleCount: number;
  /** Quiet zone width in modules on each side (minimum 4 per ISO/IEC 18004). */
  quietZoneModules: number;
  /** Total grid dimension including quiet zone: moduleCount + quietZoneModules * 2. */
  totalModules: number;
  /** 1 = dark module, 0 = light module (length = moduleCount * moduleCount). */
  modules: Uint8Array;
}

/**
 * Generates a real ISO/IEC 18004 QR code matrix for a specific business slug
 * with Error Correction Level 'M' and a strict 4-module quiet zone.
 */
export function generateBusinessQRMatrix(
  businessSlug: string,
  baseOrigin?: string,
): QRMatrixResult {
  const url = getCustomerReviewUrl(businessSlug, 'qr', baseOrigin);
  const qr = QRCode.create(url, {
    errorCorrectionLevel: 'M',
  });
  const moduleCount = qr.modules.size;
  const quietZoneModules = 4;
  const rawData = qr.modules.data;
  const modules = new Uint8Array(moduleCount * moduleCount);
  for (let i = 0; i < modules.length; i++) {
    modules[i] = rawData[i] ? 1 : 0;
  }

  return {
    url,
    moduleCount,
    quietZoneModules,
    totalModules: moduleCount + quietZoneModules * 2,
    modules,
  };
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [36, 75, 64];
  const n = Number.parseInt(clean, 16);
  if (Number.isNaN(n)) return [36, 75, 64];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Renders the selected template + QR code into a deterministic RGBA pixel buffer.
 * Used for automated headless QR scan verification across all 3 templates.
 */
export function renderQrTemplateToRgbaBuffer(
  businessSlug: string,
  settings: Pick<QRDesignSettings, 'template' | 'accentColor'>,
  options?: { width?: number; height?: number; baseOrigin?: string },
): {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  expectedUrl: string;
} {
  const width = options?.width ?? 800;
  const height = options?.height ?? 1132;
  const data = new Uint8ClampedArray(width * height * 4);

  const matrix = generateBusinessQRMatrix(businessSlug, options?.baseOrigin);

  // 1. Background fill according to template
  const bgRgb: [number, number, number] =
    settings.template === 'minimal_google'
      ? [255, 255, 255]
      : settings.template === 'business_branded'
        ? parseHexRgb(settings.accentColor || '#244B40')
        : [247, 247, 242]; // #F7F7F2 warm white

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    data[idx] = bgRgb[0];
    data[idx + 1] = bgRgb[1];
    data[idx + 2] = bgRgb[2];
    data[idx + 3] = 255;
  }

  // 2. Central QR Code Box (always pure white #FFFFFF quiet zone + crisp #111827 dark modules)
  const qrBoxSize = Math.floor(width * 0.56);
  const qrBoxX = Math.floor((width - qrBoxSize) / 2);
  const qrBoxY = Math.floor(height * 0.34);

  // Fill white quiet-zone container
  for (let y = qrBoxY; y < qrBoxY + qrBoxSize; y++) {
    if (y < 0 || y >= height) continue;
    for (let x = qrBoxX; x < qrBoxX + qrBoxSize; x++) {
      if (x < 0 || x >= width) continue;
      const idx = (y * width + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 255;
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }

  // Draw crisp QR modules inside the quiet zone
  const totalMods = matrix.totalModules;
  const qz = matrix.quietZoneModules;
  const mCount = matrix.moduleCount;

  for (let py = 0; py < qrBoxSize; py++) {
    const modY = Math.floor((py / qrBoxSize) * totalMods) - qz;
    if (modY < 0 || modY >= mCount) continue;
    for (let px = 0; px < qrBoxSize; px++) {
      const modX = Math.floor((px / qrBoxSize) * totalMods) - qz;
      if (modX < 0 || modX >= mCount) continue;

      const isDark = matrix.modules[modY * mCount + modX] === 1;
      if (isDark) {
        const idx = ((qrBoxY + py) * width + (qrBoxX + px)) * 4;
        data[idx] = 17;
        data[idx + 1] = 24;
        data[idx + 2] = 39;
        data[idx + 3] = 255;
      }
    }
  }

  return {
    width,
    height,
    data,
    expectedUrl: matrix.url,
  };
}

function getBusinessInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return 'RA';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2,
): number {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines - 1) break;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  lines.forEach((line, idx) => {
    ctx.fillText(line, centerX, startY + idx * lineHeight);
  });

  return startY + lines.length * lineHeight;
}

function drawQrModulesOnCanvas(
  ctx: CanvasRenderingContext2D,
  matrix: QRMatrixResult,
  boxX: number,
  boxY: number,
  boxSize: number,
  darkColor = '#111827',
) {
  // Always fill pure white quiet-zone box first
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(boxX, boxY, boxSize, boxSize);

  const cellSize = boxSize / matrix.totalModules;
  const offset = matrix.quietZoneModules;

  ctx.fillStyle = darkColor;
  for (let r = 0; r < matrix.moduleCount; r++) {
    for (let c = 0; c < matrix.moduleCount; c++) {
      if (matrix.modules[r * matrix.moduleCount + c] === 1) {
        const x = Math.round(boxX + (c + offset) * cellSize);
        const y = Math.round(boxY + (r + offset) * cellSize);
        const nextX = Math.round(boxX + (c + offset + 1) * cellSize);
        const nextY = Math.round(boxY + (r + offset + 1) * cellSize);
        ctx.fillRect(x, y, Math.max(1, nextX - x), Math.max(1, nextY - y));
      }
    }
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawLogoOrMonogram(
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  businessName: string,
  centerX: number,
  centerY: number,
  radius: number,
  borderColor: string,
  bgColor: string,
  textColor: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.clip();

  if (logoImg) {
    const size = radius * 2;
    ctx.drawImage(logoImg, centerX - radius, centerY - radius, size, size);
  } else {
    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(radius * 0.72)}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(getBusinessInitials(businessName), centerX, centerY + 2);
  }
  ctx.restore();
}

function drawFiveGoldStars(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  starRadius: number,
  gap: number,
  color = '#F59E0B',
) {
  ctx.save();
  ctx.fillStyle = color;
  const totalWidth = 5 * (starRadius * 2) + 4 * gap;
  let startX = centerX - totalWidth / 2 + starRadius;

  for (let s = 0; s < 5; s++) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? starRadius : starRadius * 0.44;
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const sx = startX + r * Math.cos(angle);
      const sy = centerY + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
    startX += starRadius * 2 + gap;
  }
  ctx.restore();
}

/**
 * Renders the complete QR poster (1200 x 1700 base coordinate space, A5 portrait ratio)
 * onto an HTMLCanvasElement for both live preview and high-resolution PNG / PDF export.
 */
export async function renderQrPosterToCanvas(
  canvas: HTMLCanvasElement,
  business: Business,
  settings: QRDesignSettings,
  options?: { width?: number; height?: number },
): Promise<string> {
  const W = 1200;
  const H = 1700;
  const targetWidth = options?.width ?? W;
  const targetHeight = options?.height ?? H;

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('2D canvas context is not available.');
  }

  ctx.save();
  ctx.scale(targetWidth / W, targetHeight / H);

  const matrix = generateBusinessQRMatrix(business.slug);
  const logoImg = settings.logoDataUrl
    ? await loadImageElement(settings.logoDataUrl)
    : null;
  const displayBizName = settings.businessName.trim() || business.name;
  const headingText =
    settings.heading.trim() ||
    QR_TEMPLATE_DEFAULTS[settings.template].defaultHeading;
  const instructionText =
    settings.instruction.trim() ||
    QR_TEMPLATE_DEFAULTS[settings.template].defaultInstruction;
  const accent = settings.accentColor || '#244B40';

  // =========================================================================
  // TEMPLATE A — Minimal Google-Inspired (Clean White Card + Multi-Color Accent)
  // =========================================================================
  if (settings.template === 'minimal_google') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    // Subtle outer card border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 4;
    drawRoundedRect(ctx, 36, 36, W - 72, H - 72, 28);
    ctx.stroke();

    // Top 4-color Google-inspired accent bar
    const barY = 36;
    const barW = (W - 72) / 4;
    const gColors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];
    gColors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(36 + i * barW, barY, barW, 12);
    });

    // Logo / Monogram circle
    drawLogoOrMonogram(
      ctx,
      logoImg,
      displayBizName,
      W / 2,
      205,
      78,
      '#1E293B',
      '#F8FAFC',
      accent,
    );

    // Business Name
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 48px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    drawWrappedText(ctx, displayBizName, W / 2, 315, 960, 58, 2);

    // Main Heading ("Check us out on Google")
    ctx.fillStyle = '#334155';
    ctx.font = '500 38px Inter, system-ui, sans-serif';
    drawWrappedText(ctx, headingText, W / 2, 430, 920, 48, 2);

    // Large Central QR Code with Quiet Zone
    const qrSize = 640;
    const qrX = Math.round((W - qrSize) / 2);
    const qrY = 540;

    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20);
    ctx.stroke();

    drawQrModulesOnCanvas(ctx, matrix, qrX, qrY, qrSize, '#0F172A');

    // Supporting Instruction ("Scan to share your experience")
    ctx.fillStyle = '#334155';
    ctx.font = '500 34px Inter, system-ui, sans-serif';
    drawWrappedText(ctx, instructionText, W / 2, 1235, 920, 44, 2);

    // Google-colored letters + 5 stars
    const gWord = [
      { ch: 'G', color: '#4285F4' },
      { ch: 'o', color: '#EA4335' },
      { ch: 'o', color: '#FBBC05' },
      { ch: 'g', color: '#4285F4' },
      { ch: 'l', color: '#34A853' },
      { ch: 'e', color: '#EA4335' },
    ];
    ctx.font = '700 76px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    const totalWordWidth = gWord.reduce(
      (sum, item) => sum + ctx.measureText(item.ch).width,
      0,
    );
    let cursorX = (W - totalWordWidth) / 2;
    for (const item of gWord) {
      ctx.fillStyle = item.color;
      ctx.textAlign = 'left';
      ctx.fillText(item.ch, cursorX, 1410);
      cursorX += ctx.measureText(item.ch).width;
    }

    drawFiveGoldStars(ctx, W / 2, 1465, 22, 14, '#FBBC05');

    // Non-affiliation & URL footer
    ctx.fillStyle = '#94A3B8';
    ctx.font = '400 22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(matrix.url, W / 2, 1565);
    ctx.font = '400 18px Inter, system-ui, sans-serif';
    ctx.fillText(
      'Independent customer review assistant · Not affiliated with Google LLC',
      W / 2,
      1605,
    );
  }

  // =========================================================================
  // TEMPLATE B — Business Branded (Forest Green & Muted Gold Double-Frame)
  // =========================================================================
  else if (settings.template === 'business_branded') {
    const gold = '#D5A34A';
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, H);

    // Architectural Double Gold Border + Corner Ornaments (matching Image 2)
    ctx.strokeStyle = gold;
    ctx.lineWidth = 8;
    ctx.strokeRect(72, 72, W - 144, H - 144);

    ctx.lineWidth = 5;
    ctx.strokeRect(102, 102, W - 204, H - 204);

    // Corner square accents
    const corners = [
      [72, 72],
      [W - 102, 72],
      [72, H - 102],
      [W - 102, H - 102],
    ];
    ctx.fillStyle = gold;
    for (const [cx, cy] of corners) {
      ctx.fillRect(cx + 8, cy + 8, 14, 14);
    }

    // Optional Logo / Monogram at top
    drawLogoOrMonogram(
      ctx,
      logoImg,
      displayBizName,
      W / 2,
      220,
      62,
      gold,
      '#F7F7F2',
      accent,
    );

    // Gold Uppercase Heading
    ctx.fillStyle = gold;
    ctx.font = '700 54px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    drawWrappedText(ctx, headingText.toUpperCase(), W / 2, 315, 880, 64, 2);

    // Crisp White-Backed Central QR Code Framed in Gold
    const qrSize = 640;
    const qrX = Math.round((W - qrSize) / 2);
    const qrY = 475;

    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.strokeRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36);

    drawQrModulesOnCanvas(ctx, matrix, qrX, qrY, qrSize, '#111827');

    // Supporting Instruction in Gold
    ctx.fillStyle = '#F7F7F2';
    ctx.font = '600 34px Inter, system-ui, sans-serif';
    drawWrappedText(
      ctx,
      instructionText.toUpperCase(),
      W / 2,
      1175,
      900,
      44,
      2,
    );

    // 5 Gold Stars
    drawFiveGoldStars(ctx, W / 2, 1315, 24, 18, gold);

    // Business Name & Destination Footer
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 44px Inter, system-ui, sans-serif';
    drawWrappedText(ctx, displayBizName, W / 2, 1385, 900, 52, 1);

    ctx.fillStyle = '#E8EFEA';
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillText(matrix.url, W / 2, 1475);

    ctx.fillStyle = gold;
    ctx.font = '500 20px Inter, system-ui, sans-serif';
    ctx.fillText('POWERED BY REVIEWASSIST', W / 2, 1535);
  }

  // =========================================================================
  // TEMPLATE C — Printable Table Standee (A5 Portrait Layout)
  // =========================================================================
  else {
    // Warm white background (#F7F7F2)
    ctx.fillStyle = '#F7F7F2';
    ctx.fillRect(0, 0, W, H);

    // Outer Standee Card Frame
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, 56, 56, W - 112, H - 112, 32);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = accent;
    ctx.stroke();

    // Top Header Banner in Accent Color
    ctx.save();
    drawRoundedRect(ctx, 56, 56, W - 112, 250, 32);
    ctx.clip();
    ctx.fillStyle = accent;
    ctx.fillRect(56, 56, W - 112, 230);
    ctx.restore();

    // Category + City Pill in Header
    ctx.fillStyle = '#E8EFEA';
    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `${business.category.toUpperCase()} · ${business.city.toUpperCase()}`,
      W / 2,
      100,
    );

    // Business Name in Header
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 54px Inter, system-ui, sans-serif';
    drawWrappedText(ctx, displayBizName, W / 2, 145, 960, 62, 2);

    // Call to Action Heading
    ctx.fillStyle = '#252B29';
    ctx.font = '700 44px Inter, system-ui, sans-serif';
    drawWrappedText(ctx, headingText, W / 2, 335, 940, 54, 2);

    // Large Scannable QR Code
    const qrSize = 640;
    const qrX = Math.round((W - qrSize) / 2);
    const qrY = 465;

    ctx.fillStyle = '#E8EFEA';
    drawRoundedRect(ctx, qrX - 24, qrY - 24, qrSize + 48, qrSize + 92, 24);
    ctx.fill();

    drawQrModulesOnCanvas(ctx, matrix, qrX, qrY, qrSize, '#111827');

    ctx.fillStyle = accent;
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText('SCAN WITH YOUR PHONE CAMERA', W / 2, qrY + qrSize + 22);

    // Supporting Instruction
    ctx.fillStyle = '#334155';
    ctx.font = '500 30px Inter, system-ui, sans-serif';
    drawWrappedText(ctx, instructionText, W / 2, 1210, 920, 40, 2);

    // 3-Step Table Standee Guide Box
    ctx.fillStyle = '#F7F7F2';
    drawRoundedRect(ctx, 130, 1300, W - 260, 210, 20);
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.stroke();

    const steps = [
      '1. Scan QR code with your phone camera',
      '2. Tap highlights or speak your honest experience',
      '3. Copy your review draft & post on Google',
    ];
    ctx.textAlign = 'left';
    ctx.font = '500 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#252B29';
    steps.forEach((stepText, idx) => {
      ctx.fillText(stepText, 175, 1330 + idx * 54);
    });

    // Footer URL
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748B';
    ctx.font = '400 22px Inter, system-ui, sans-serif';
    ctx.fillText(matrix.url, W / 2, 1555);
  }

  ctx.restore();
  return matrix.url;
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  // Node.js fallback for automated tests
  const buf = Buffer.from(base64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/**
 * Generates a standards-compliant Printable Portrait A5 PDF (%PDF-1.4)
 * containing the high-resolution rendered QR poster with proper print margins.
 * Zero external PDF dependencies required.
 */
export function buildPrintableA5PdfFromJpeg(
  jpegBytes: Uint8Array,
  imageWidthPx: number,
  imageHeightPx: number,
): Uint8Array {
  // Portrait A5 in PostScript points (148mm x 210mm = 419.53 x 595.28 pt)
  const pageW = 420;
  const pageH = 595;
  const margin = 18;
  const drawW = pageW - margin * 2;
  const drawH = pageH - margin * 2;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLength = 0;

  function pushStr(str: string) {
    const arr = encoder.encode(str);
    chunks.push(arr);
    byteLength += arr.byteLength;
  }

  function pushBytes(arr: Uint8Array) {
    chunks.push(arr);
    byteLength += arr.byteLength;
  }

  function startObj(id: number) {
    offsets[id] = byteLength;
    pushStr(`${id} 0 obj\n`);
  }

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog
  startObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  startObj(2);
  pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page (A5 Portrait)
  startObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  // Object 4: High-Res Poster Image XObject (DCTDecode = JPEG)
  startObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${imageWidthPx} /Height ${imageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  // Object 5: Page Content Stream placing image inside print margins
  const contentStream = `q\n${drawW} 0 0 ${drawH} ${margin} ${margin} cm\n/Im0 Do\nQ\n`;
  const contentBytes = encoder.encode(contentStream);
  startObj(5);
  pushStr(`<< /Length ${contentBytes.byteLength} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr('endstream\nendobj\n');

  // Cross-reference table
  const xrefOffset = byteLength;
  pushStr('xref\n0 6\n0000000000 65535 f \n');
  for (let i = 1; i <= 5; i++) {
    const padded = String(offsets[i]).padStart(10, '0');
    pushStr(`${padded} 00000 n \n`);
  }

  pushStr(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  const output = new Uint8Array(byteLength);
  let pos = 0;
  for (const chunk of chunks) {
    output.set(chunk, pos);
    pos += chunk.byteLength;
  }
  return output;
}

export function generatePrintablePdfBlobFromCanvas(
  canvas: HTMLCanvasElement,
): Blob {
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.96);
  const base64 = jpegDataUrl.split(',')[1] ?? '';
  const jpegBytes = base64ToUint8Array(base64);
  const pdfBytes = buildPrintableA5PdfFromJpeg(
    jpegBytes,
    canvas.width,
    canvas.height,
  );
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
