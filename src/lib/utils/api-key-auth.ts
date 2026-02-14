import { NextRequest } from 'next/server';
import { validateApiKey } from '@/lib/services/api-key-management';

/**
 * Extract and validate an API key from the request.
 * Supports both `Authorization: Bearer cs_...` and `X-API-Key: cs_...` headers.
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<{ clientId: string; scopes: string[] } | null> {
  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  let key: string | null = null;

  if (authHeader?.startsWith('Bearer cs_')) {
    key = authHeader.substring(7); // Remove 'Bearer '
  } else if (apiKeyHeader?.startsWith('cs_')) {
    key = apiKeyHeader;
  }

  if (!key) return null;

  return validateApiKey(key);
}

/**
 * Check if a given scope is present in the list of granted scopes.
 */
export function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes('*');
}
