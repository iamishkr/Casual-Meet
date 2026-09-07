import type { GeoPoint, SensitiveKind } from './types';

let seq = 0;
export const uid = (p: string) => `${p}_${(++seq).toString(36)}${Date.now().toString(36).slice(-4)}`;

/* ---------------- geo ---------------- */

export const point = (lng: number, lat: number): GeoPoint => ({ type: 'Point', coordinates: [lng, lat] });

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const [lng1, lat1] = a.coordinates;
  const [lng2, lat2] = b.coordinates;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const mapsLink = (p: GeoPoint) =>
  `https://maps.google.com/?q=${p.coordinates[1].toFixed(5)},${p.coordinates[0].toFixed(5)}`;

export const fmtDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;

/* Coordinates are treated as secret material: anything leaving the "API"
   boundary is passed through redact() so raw lat/lng can never leak. */
export const COORD_REDACTED = '••.••••, ••.••••';

/* ---------------- sensitive content scanner (server-authoritative) ---------------- */

const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}|\+\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{3,4}[\s-]?\d{3,4}/;
const UPI_RE = /[a-z0-9._-]{2,}@(?:upi|paytm|gpay|phonepe|ybl|yapl|okhdfcbank|okaxis|apl|ibl)\b|\b(?:gpay|paytm|phonepe|bhim)\b[\s:]*(?:no|number|id)?[\s:#-]*[7-9]\d{9}/i;
const AADHAAR_RE = /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/;
const ADDRESS_KEYWORDS = /\b(?:flat\s*(?:no|number)?\s*[a-z0-9-]+|apartment|villa|house\s*(?:no|number)|my\s+place|come\s+to\s+my|hostel|pg\s+(?:room|building)|\d+(?:st|nd|rd|th)\s+(?:cross|main|street|block))\b/i;
const PINCODE_RE = /\bpin(?:code)?[\s:#-]*\d{6}\b/i;

export interface SensitiveHit {
  kind: SensitiveKind;
  label: string;
}

export function scanSensitive(text: string): SensitiveHit[] {
  const hits: SensitiveHit[] = [];
  if (AADHAAR_RE.test(text)) hits.push({ kind: 'pii', label: 'National ID pattern' });
  if (UPI_RE.test(text)) hits.push({ kind: 'upi', label: 'UPI / payment handle' });
  if (PHONE_RE.test(text)) hits.push({ kind: 'phone', label: 'Phone number' });
  if (ADDRESS_KEYWORDS.test(text) || PINCODE_RE.test(text)) hits.push({ kind: 'address', label: 'Home address cue' });
  return hits;
}

export const blurText = (t: string) => '█'.repeat(Math.min(Math.max(t.length, 8), 26));

/* ---------------- phone validation (E.164 or Indian 10-digit) ---------------- */

export const isValidPhone = (p: string) =>
  /^\+[1-9]\d{6,14}$/.test(p.replace(/[\s-]/g, '')) || /^[6-9]\d{9}$/.test(p.replace(/[\s-]/g, ''));

export const normalizePhone = (p: string) => {
  const c = p.replace(/[\s-]/g, '');
  return /^[6-9]\d{9}$/.test(c) ? `+91${c}` : c;
};

export const isIndianNumber = (p: string) => normalizePhone(p).startsWith('+91');

/* ---------------- formatting ---------------- */

export const fmtClock = (wall: number) =>
  new Date(wall).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const fmtTimeShort = (wall: number) =>
  new Date(wall).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
}

export const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const relTime = (wall: number) => {
  const d = Date.now() - wall;
  if (d < 5000) return 'now';
  if (d < 60000) return `${Math.floor(d / 1000)}s`;
  if (d < 3600000) return `${Math.floor(d / 60000)}m`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h`;
  return `${Math.floor(d / 86400000)}d`;
};

export const smsBody = (userName: string, loc: GeoPoint | null, locationName: string) =>
  `EMERGENCY ALERT: ${userName} triggered an SOS. Location: ${
    loc ? mapsLink(loc) : locationName ? `${locationName} (coordinates unavailable)` : 'Location unavailable'
  }. Please check in immediately.`;

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const latency = () => Math.round(rand(18, 74));
