import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export function normalizePhoneNumber(phone: string, country: CountryCode = 'CA'): string {
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.format('E.164') || phone;
}

export function formatPhoneNumber(phone: string, country: CountryCode = 'CA'): string {
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.formatNational() || phone;
}

export function isValidPhoneNumber(phone: string, country: CountryCode = 'CA'): boolean {
  const parsed = parsePhoneNumberFromString(phone, country);
  return parsed?.isValid() || false;
}
