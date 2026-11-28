import type { Business } from '../../types/business';
import { QRCodeManager } from './QRCodeManager';

export interface QRPosterGeneratorProps {
  business: Business;
  defaultMode?:
    | 'review'
    | 'barber_queue'
    | 'gym'
    | 'cafe'
    | 'loyalty'
    | 'clinic'
    | 'catering'
    | 'restaurant_menu';
}

/**
 * Multi-industry printable reception & counter standee generator.
 * For `category === 'clinic'`, generates a crisp reception standee:
 * "Scan for Live Queue Token & Digital Prescription Pass" -> `/r/:businessSlug/clinic`.
 * For `category === 'catering'`, generates a branded event standee:
 * "Scan to Customize Your Event Menu & Instant Catering Quote" -> `/r/:businessSlug/catering`.
 */
export function QRPosterGenerator({
  business,
  defaultMode,
}: QRPosterGeneratorProps) {
  return <QRCodeManager business={business} defaultMode={defaultMode} />;
}

export default QRPosterGenerator;
