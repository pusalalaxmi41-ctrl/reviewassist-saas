import type { BusinessCategory } from '../../types/business';
export { businessRepository, PLACEHOLDER_GOOGLE_REVIEW_URL } from '../storage';

export const categoryLabels: Record<BusinessCategory, string> = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  hotel: 'Hotel',
  pg: 'PG Accommodation',
};
