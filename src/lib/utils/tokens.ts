import { randomBytes } from 'crypto';

/**
 * Generate a secure random token for claim links
 */
export function generateClaimToken(): string {
  return randomBytes(32).toString('hex');
}
