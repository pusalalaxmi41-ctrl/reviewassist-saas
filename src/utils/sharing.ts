import type { Business } from '../types/business';

/**
 * Generates the canonical business-specific customer review URL.
 * Example: https://yourdomain.com/r/the-urban-kitchen
 */
export function getCustomerReviewUrl(
  businessSlug: string,
  _source: 'qr' | 'whatsapp' | 'direct' = 'direct',
  baseOrigin?: string,
): string {
  const cleanSlug = businessSlug.trim().toLowerCase();
  if (!cleanSlug) {
    throw new Error('Business slug is required to generate a customer review URL.');
  }
  const host = (
    baseOrigin ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  ).replace(/\/+$/, '');
  return `${host}/r/${cleanSlug}`;
}

export function buildWhatsAppMessage(business: Business): string {
  const reviewUrl = getCustomerReviewUrl(business.slug, 'whatsapp');
  return `Hi! Thank you for visiting ${business.name}. We'd love to hear about your experience. You can quickly speak or type your thoughts here:\n\n${reviewUrl}\n\nIt takes less than 30 seconds and helps us improve!`;
}

export function getWhatsAppShareLink(
  business: Business,
  optionalPhone?: string,
): string {
  const message = buildWhatsAppMessage(business);
  const cleanPhone = optionalPhone ? optionalPhone.replace(/\D/g, '') : '';
  const baseUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : 'https://wa.me/';
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}
