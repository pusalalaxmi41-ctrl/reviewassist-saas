import { isSupabaseConfigured } from '../../lib/supabase';
import type { IBusinessRepository } from './BusinessRepository';
import {
  businessRepository as mockBusinessRepository,
  PLACEHOLDER_GOOGLE_REVIEW_URL,
} from './MockLocalStorageRepository';
import { SupabaseBusinessRepository } from './SupabaseBusinessRepository';

export const businessRepository: IBusinessRepository = isSupabaseConfigured
  ? new SupabaseBusinessRepository()
  : mockBusinessRepository;

export { PLACEHOLDER_GOOGLE_REVIEW_URL };
export type { IBusinessRepository } from './BusinessRepository';
