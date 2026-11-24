import type { CSSProperties } from 'react';
import {
  GYM_THEME_PRESETS,
  normalizeGymAccentColor,
  normalizeGymThemePreset,
} from '../../../utils/gymValidation';

export interface ResolvedGymBrandTheme {
  accent: string;
  accentInk: '#0B0D10' | '#FFFFFF';
  accentText: string;
  presetId: string;
  presetLabel: string;
  cssVars: CSSProperties;
}

/** Computes accessible dark or white foreground ink for filled accent surfaces. */
export function getContrastInkForHex(hex: string): '#0B0D10' | '#FFFFFF' {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#0B0D10';
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 145 ? '#0B0D10' : '#FFFFFF';
}

/**
 * Lightens dark accent colors (e.g. crimson #EF4444) when rendered as small text
 * against dark #171B22 surfaces while preserving exact accent hue identity.
 */
function lightenForDarkSurface(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  if (yiq >= 135) return hex;
  const mix = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * 0.35));
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/**
 * Resolves FitPro x GymOS dark-mode CSS tokens from owner portal branding config,
 * honoring both explicit hex overrides and preset selection cleanly.
 */
export function resolveGymBrandTheme(config: {
  accentColor?: string | null;
  themePreset?: string | null;
}): ResolvedGymBrandTheme {
  const presetId = normalizeGymThemePreset(config.themePreset);
  const presetMeta =
    GYM_THEME_PRESETS.find((t) => t.key === presetId) ?? GYM_THEME_PRESETS[0];
  const hasExplicitHex =
    typeof config.accentColor === 'string' &&
    config.accentColor.trim().length > 0;
  const accent = hasExplicitHex
    ? normalizeGymAccentColor(config.accentColor)
    : presetMeta.accentColor;
  const accentInk = getContrastInkForHex(accent);
  const accentText = lightenForDarkSurface(accent);

  const cssVars = {
    '--bg-canvas': '#0B0D10',
    '--bg-rail': '#111419',
    '--surface-card': '#171B22',
    '--surface-elevated': '#1D222B',
    '--surface-subtle': '#232933',
    '--border-subtle': 'rgba(255, 255, 255, 0.08)',
    '--border-strong': 'rgba(255, 255, 255, 0.14)',
    '--text-primary': '#F5F7FA',
    '--text-secondary': '#A4ADBB',
    '--text-muted': '#778191',
    '--gym-accent': accent,
    '--gym-accent-ink': accentInk,
    '--gym-accent-text': accentText,
    '--gym-accent-soft': `${accent}24`,
    '--gym-ink': accentInk,
  } as CSSProperties;

  return {
    accent,
    accentInk,
    accentText,
    presetId,
    presetLabel: presetMeta.label,
    cssVars,
  };
}
