import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

/**
 * Normalize a phone number to E.164 format
 * @param phone - Phone number to normalize
 * @param country - Country code for parsing (default: CA)
 * @returns Phone number in E.164 format (+1234567890)
 */
export function normalizePhoneNumber(phone: string, country: CountryCode = 'CA'): string {
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.format('E.164') || phone;
}

/**
 * Format a phone number in national format for display
 * @param phone - Phone number to format
 * @param country - Country code for parsing (default: CA)
 * @returns Phone number in national format
 */
export function formatPhoneNumber(phone: string, country: CountryCode = 'CA'): string {
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.formatNational() || phone;
}

/**
 * Validate a phone number
 * @param phone - Phone number to validate
 * @param country - Country code for parsing (default: CA)
 * @returns True if valid, false otherwise
 */
export function isValidPhoneNumber(phone: string, country: CountryCode = 'CA'): boolean {
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.isValid() || false;
}
