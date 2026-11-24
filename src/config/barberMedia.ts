/**
 * Verified local WebP media catalog for the ClipAura Barber & Salon platform.
 * Every path maps 1-to-1 to optimized static assets under public/barber-ui/.
 */
export const BARBER_UI_MEDIA = {
  banners: {
    shopHero: '/barber-ui/shop-hero.webp',
    shopLounge: '/barber-ui/shop-lounge.webp',
    heroDarkSpace: '/barber-ui/hero-barber.webp',
    promoPortrait: '/barber-ui/promo-cut.webp',
  },
  icons: {
    chair: '/barber-ui/icon-chair.webp',
    calendar: '/barber-ui/icon-calendar.webp',
    checklist: '/barber-ui/icon-checklist.webp',
    crown: '/barber-ui/icon-crown.webp',
    trophy: '/barber-ui/icon-trophy.webp',
    gift: '/barber-ui/icon-gift.webp',
    referralGift: '/barber-ui/icon-referral-gift.webp',
  },
  services: {
    haircut: '/barber-ui/service-haircut.webp',
    fade: '/barber-ui/service-fade.webp',
    beard: '/barber-ui/service-beard.webp',
    shave: '/barber-ui/service-shave.webp',
    combo: '/barber-ui/service-combo.webp',
    grooming: '/barber-ui/service-grooming.webp',
  },
  barbers: [
    '/barber-ui/barber-1.webp',
    '/barber-ui/barber-2.webp',
    '/barber-ui/barber-3.webp',
    '/barber-ui/barber-4.webp',
  ],
  faceStyles: {
    oval: '/barber-ui/style-oval.webp',
    square: '/barber-ui/style-square.webp',
    diamond: '/barber-ui/style-diamond.webp',
    heart: '/barber-ui/style-heart.webp',
    round: '/barber-ui/style-round.webp',
    oblong: '/barber-ui/style-oblong.webp',
    triangle: '/barber-ui/style-triangle.webp',
  },
} as const;

export function resolveBarberServiceImage(serviceName: string): string {
  const lower = serviceName.toLowerCase();
  if (lower.includes('combo') || (lower.includes('haircut') && lower.includes('beard'))) {
    return BARBER_UI_MEDIA.services.combo;
  }
  if (lower.includes('shave') || lower.includes('towel') || lower.includes('razor')) {
    return BARBER_UI_MEDIA.services.shave;
  }
  if (lower.includes('beard') || lower.includes('mustache') || lower.includes('sculpt')) {
    return BARBER_UI_MEDIA.services.beard;
  }
  if (lower.includes('fade') || lower.includes('taper') || lower.includes('buzz')) {
    return BARBER_UI_MEDIA.services.fade;
  }
  if (
    lower.includes('massage') ||
    lower.includes('facial') ||
    lower.includes('wash') ||
    lower.includes('spa') ||
    lower.includes('kit')
  ) {
    return BARBER_UI_MEDIA.services.grooming;
  }
  return BARBER_UI_MEDIA.services.haircut;
}

export function resolveBarberPortrait(seed: string | number): string {
  const pool = BARBER_UI_MEDIA.barbers;
  if (typeof seed === 'number') {
    return pool[Math.abs(seed) % pool.length];
  }
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[hash % pool.length];
}
