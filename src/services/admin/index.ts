import type { IAdminRepository } from './AdminRepository';
import { MockAdminRepository } from './MockAdminRepository';
import { SupabaseAdminRepository } from './SupabaseAdminRepository';

export type { IAdminRepository } from './AdminRepository';
export { MockAdminRepository } from './MockAdminRepository';
export { SupabaseAdminRepository } from './SupabaseAdminRepository';

export const mockAdminRepository = new MockAdminRepository();
export const supabaseAdminRepository = new SupabaseAdminRepository();

/**
 * Default repository wired to MockAdminRepository so the /admin panel works
 * immediately out-of-the-box before migration 003 is applied.
 * Once 003_platform_admin_and_account_lifecycle.sql is reviewed and applied,
 * set VITE_ADMIN_DATA_SOURCE=supabase (or toggle in the Admin Settings tab)
 * to use SupabaseAdminRepository.
 */
export function getAdminRepository(
  mode: 'mock' | 'supabase' = 'mock',
): IAdminRepository {
  return mode === 'supabase' ? supabaseAdminRepository : mockAdminRepository;
}

export const adminRepository: IAdminRepository =
  import.meta.env.VITE_ADMIN_DATA_SOURCE === 'supabase'
    ? supabaseAdminRepository
    : mockAdminRepository;
