import type { Business } from '../types/business';

export function getCustomerReviewUrl(businessSlug: string, source: 'qr' | 'whatsapp' | 'direct' = 'direct'): string {
  const host = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  return `${host}/r/${businessSlug}?src=${source}`;
}

export function buildWhatsAppMessage(business: Business): string {
  const reviewUrl = getCustomerReviewUrl(business.slug, 'whatsapp');
  return `Hi! Thank you for visiting ${business.name}. We'd love to hear about your experience. You can quickly speak or type your thoughts here:\n\n${reviewUrl}\n\nIt takes less than 30 seconds and helps us improve!`;
}

export function getWhatsAppShareLink(business: Business, optionalPhone?: string): string {
  const message = buildWhatsAppMessage(business);
  const cleanPhone = optionalPhone ? optionalPhone.replace(/\D/g, '') : '';
  const baseUrl = cleanPhone ? `https://wa.me/${cleanPhone}` : 'https://wa.me/';
  return `${baseUrl}?text=${encodeURIComponent(message)}`;
}
