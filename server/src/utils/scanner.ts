export type SensitiveKind = 'phone' | 'upi' | 'address' | 'pii';

export interface SensitiveHit {
  kind: SensitiveKind;
  label: string;
}

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\+\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/;
const UPI_RE = /[a-z0-9._-]{2,}@(?:upi|paytm|gpay|phonepe|ybl|yapl|okhdfcbank|okaxis|apl|ibl)\b|\b(?:gpay|paytm|phonepe|bhim)\b[\s:]*(?:no|number|id)?[\s:#-]*[7-9]\d{9}/i;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
const ADDRESS_KEYWORDS = /\b(?:flat\s*(?:no|number)?\s*[a-z0-9-]+|apartment|villa|house\s*(?:no|number)|my\s+place|come\s+to\s+my|hostel|pg\s+(?:room|building)|\d+(?:st|nd|rd|th)\s+(?:cross|main|street|block))\b/i;
const PINCODE_RE = /\bpin(?:code)?[\s:#-]*\d{6}\b/i;

export function scanSensitive(text: string): SensitiveHit[] {
  const hits: SensitiveHit[] = [];
  if (AADHAAR_RE.test(text)) hits.push({ kind: 'pii', label: 'National ID pattern' });
  if (UPI_RE.test(text)) hits.push({ kind: 'upi', label: 'UPI / payment handle' });
  if (PHONE_RE.test(text)) hits.push({ kind: 'phone', label: 'Phone number' });
  if (ADDRESS_KEYWORDS.test(text) || PINCODE_RE.test(text)) hits.push({ kind: 'address', label: 'Home address cue' });
  return hits;
}

export function haversineKm(coordsA: [number, number], coordsB: [number, number]): number {
  const R = 6371; // km
  const [lng1, lat1] = coordsA;
  const [lng2, lat2] = coordsB;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const normalizePhone = (p: string) => {
  const c = p.replace(/[\s-]/g, '');
  return /^[6-9]\d{9}$/.test(c) ? `+91${c}` : c;
};

export const isIndianNumber = (p: string) => normalizePhone(p).startsWith('+91');

export const isValidPhone = (p: string): boolean => {
  if (!p || typeof p !== 'string') return false;
  const digits = p.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
};

export const COORD_REDACTED = '••.••••, ••.••••';
