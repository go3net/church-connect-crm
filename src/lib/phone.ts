/**
 * Normalize Nigerian phone numbers to E.164 (+234...).
 * Accepts: 08031234567, 8031234567, +2348031234567, 2348031234567, 234 803 123 4567
 */
export function normalizePhone(input: string, defaultCountry = "234"): string {
  if (!input) return "";
  let digits = input.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) return digits;

  // strip leading zeros
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith(defaultCountry)) return `+${digits}`;
  if (digits.startsWith("0")) return `+${defaultCountry}${digits.slice(1)}`;
  // bare local number e.g. 8031234567
  if (digits.length === 10) return `+${defaultCountry}${digits}`;
  return `+${digits}`;
}

export function isValidPhone(input: string): boolean {
  const e164 = normalizePhone(input);
  return /^\+\d{10,15}$/.test(e164);
}
