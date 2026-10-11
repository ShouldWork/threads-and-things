import { DEFAULT_SETTINGS, type Data, type Settings } from '../types';

export const COLS = ['sales', 'listings', 'inventory', 'expenses', 'mileage', 'time', 'issues'] as const;
export type ColName = (typeof COLS)[number];
export type Row = Record<string, unknown> & { id?: string };
const textFields: Record<ColName, string[]> = {
  sales: ['date','listed','brand','cat','size','desc','state','sku','platform'],
  listings: ['cat','size','desc','posted','link','status'],
  inventory: ['sku','acquired','source','cat','size','brand','desc','platform','listed','status','outcome','notes'],
  expenses: ['date','cat','vendor','desc','paidWith','notes'],
  mileage: ['date','purpose'], time: ['date','activity','notes'],
  issues: ['date','sku','platform','type','what','next'],
};
const numbers: Record<ColName, string[]> = {
  sales: ['price','ship','depopFee','payFee','boost','usps','refund','feeBack','cogs','tax'],
  listings: ['price'], inventory: ['cost'], expenses: ['amount'], mileage: ['miles'], time: ['minutes'], issues: ['lost'],
};
const booleans: Partial<Record<ColName, string[]>> = { listings: ['exact','boosted'], expenses: ['receipt'], issues: ['resolved'] };
const optionalText: Partial<Record<ColName, string[]>> = { sales: ['buyer','sourceId','importKey','importFingerprint'], listings: ['location','soldBy','previousStatus'], inventory: ['soldBy','previousStatus','previousOutcome','location'] };
const dateFields = ['date','listed','posted','acquired','outcome'];
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === value;
}
export function prepareRow(c: ColName, input: object, legacy = false): Row {
  const source = input as Row; const row: Row = {};
  for (const field of textFields[c]) {
    const value = source[field] ?? '';
    if (typeof value !== 'string' || value.length > 20000) throw new Error(`${c}: ${field} must be text (at most 20,000 characters).`);
    if (dateFields.includes(field) && value && !validDate(value)) throw new Error(`${c}: ${field} must be a valid date.`);
    row[field] = value;
  }
  for (const field of numbers[c]) {
    const value = source[field] ?? 0;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9) throw new Error(`${c}: ${field} must be a finite, nonnegative number.`);
    row[field] = value;
  }
  for (const field of booleans[c] || []) {
    const value = source[field] ?? (field === 'exact');
    if (typeof value !== 'boolean') throw new Error(`${c}: ${field} must be true or false.`);
    row[field] = value;
  }
  for (const field of [...(optionalText[c] || []), 'sourceData','manualFields','origin','productId','orderId','importAliases']) if (source[field] !== undefined) {
    if (typeof source[field] !== 'string' || (source[field] as string).length > 20000) throw new Error(`${c}: invalid ${field}.`);
    row[field] = source[field];
  }
  if (c === 'listings') {
    const value = source.orig ?? null;
    // Same limits as firestore.rules, so nothing accepted here is rejected by the server after it queues.
    if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e9)) throw new Error('Original price must be between 0 and 1,000,000,000.');
    row.orig = value;
    // The rule's link pattern is case-sensitive: lowercase the scheme and host, keep the path as typed.
    if (row.link) row.link = (row.link as string).trim().replace(/^https:\/\/(www\.)?depop\.com/i, m => m.toLowerCase());
    if (row.link && !/^https:\/\/(www\.)?depop\.com\/products\/.*$/.test(row.link as string)) throw new Error('Use an https Depop product link.');
  }
  const requiredDate = c === 'inventory' ? 'acquired' : c === 'listings' ? 'posted' : 'date';
  if (!legacy && !row[requiredDate]) throw new Error(`${c}: enter ${requiredDate}.`);
  if (c === 'inventory' && !(row.sku as string).trim()) throw new Error('Every inventory item needs a SKU.');
  if (c === 'sales' && !row.desc && !row.price) throw new Error('Add at least a description or a price.');
  if (!legacy && ['expenses','mileage','time'].includes(c) && !row[numbers[c][0]]) throw new Error(`${c}: enter a value greater than zero.`);
  if (c === 'listings' && !row.desc) throw new Error('Enter a listing description.');
  if (source.id) row.id = source.id;
  return row;
}
export function prepareSettings(input: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = {};
  for (const [key,value] of Object.entries(input)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (['name','snapshot','shopStart'].includes(key)) {
      if (typeof value !== 'string' || value.length > 200) throw new Error(`Invalid ${key}.`);
      if (key !== 'name' && !validDate(value)) throw new Error(`Enter a valid ${key} date.`);
      if (key === 'name' && !value.trim()) throw new Error('Enter your name.');
    } else if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > (key === 'taxPct' ? 0.6 : key === 'mileageRate' ? 100 : 1e9)) throw new Error(`Invalid ${key}.`);
    Object.assign(out, { [key]: value });
  }
  return out;
}
export function emptyData(): Data { return { sales: [], listings: [], inventory: [], expenses: [], mileage: [], time: [], issues: [], settings: { ...DEFAULT_SETTINGS } }; }
export function withoutId(row: object) { return Object.fromEntries(Object.entries(row).filter(([key,value]) => key !== 'id' && value !== undefined)); }
