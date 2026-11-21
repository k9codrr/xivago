/**
 * Indian mobile number handling, shared by profile editing (M2) and
 * WhatsApp OTP login (M6) so both agree on exactly one normalized shape:
 * E.164, e.g. "+919876543210".
 */

const INDIAN_MOBILE_REGEX = /^(\+91)?[6-9]\d{9}$/;

/** Strips spaces/dashes and returns true if the result is a valid Indian mobile number (with or without +91). */
export function isValidIndianMobile(raw: string): boolean {
  return INDIAN_MOBILE_REGEX.test(raw.replace(/[\s-]/g, ""));
}

/** Normalizes to E.164 (+91XXXXXXXXXX). Assumes `isValidIndianMobile(raw)` is already true. */
export function toE164IndianMobile(raw: string): string {
  const cleaned = raw.replace(/[\s-]/g, "");
  return cleaned.startsWith("+91") ? cleaned : `+91${cleaned}`;
}
