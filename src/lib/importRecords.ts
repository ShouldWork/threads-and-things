import type { Data, ImportMetadata, Sale } from '../types';
import { prepareRow, type ColName, type Row } from './records';
import { reconcileListings } from './listingLinks';

const metadata = new Set(['id','sourceData','manualFields','origin','importKey','importFingerprint','importAliases','sourceId','productId','orderId','soldBy','previousStatus','previousOutcome']);
export function sourceValues(row: object): Record<string, unknown> {
  const r = row as Row;
  if (typeof r.sourceData === 'string') {
    try { const value = JSON.parse(r.sourceData); if (value && typeof value === 'object' && !Array.isArray(value)) return Object.fromEntries(Object.entries(value).filter(([k])=>!metadata.has(k) && !['__proto__','constructor','prototype'].includes(k))); }
    catch { throw new Error('This record has invalid import information.'); }
  }
  return Object.fromEntries(Object.entries(r).filter(([k,v])=>!metadata.has(k) && v !== undefined));
}
export function manualFields(row: object): string[] {
  const value = (row as ImportMetadata).manualFields;
  if (!value) return [];
  try { const keys = JSON.parse(value); if (Array.isArray(keys) && keys.every(k=>typeof k === 'string' && !metadata.has(k))) return keys; }
  catch { /* Invalid legacy metadata must not allow imported fields to override a record. */ }
  throw new Error('This record has invalid edit protection information.');
}
export function markManual(c: ColName, input: object, previous?: object, protect = true): Row {
  const row = prepareRow(c,input);
  const old = previous as Row | undefined;
  const keys = new Set(protect && old ? manualFields(old) : []);
  if (protect) for (const [key,value] of Object.entries(row)) {
    if (!metadata.has(key) && (!old || value !== old[key])) keys.add(key);
  }
  return {...row,origin:old?.origin || (old?.sourceData || old?.importKey || old?.sourceId ? 'import' : 'manual'),manualFields:JSON.stringify([...keys])};
}
export function mergeRecord(c: ColName, previous: object | undefined, incoming: object): Row {
  const source = sourceValues(incoming), old = previous as Row | undefined;
  const row: Row = old ? {...old} : {...incoming}; const locked = new Set(old ? manualFields(old) : []);
  for (const [key,value] of Object.entries(source)) {
    // These values were maintained in the app/old tracker before import metadata existed.
    const legacyLocal = old && !old.sourceData && ['notes','cost','cogs','sku','listed','brand','size','cat','desc','acquired','source','status','outcome'].includes(key) && old[key] !== '' && old[key] !== undefined;
    if (legacyLocal) locked.add(key);
    if (!locked.has(key) && !legacyLocal && !(old && value === '' && ['sku','listed','brand','size','cat','desc','buyer','date','acquired','posted'].includes(key))) row[key] = value;
  }
  const imported = incoming as Row;
  for (const key of ['sourceId','productId','orderId']) if (imported[key]) row[key] = imported[key];
  row.sourceData = JSON.stringify({... (old?.sourceData ? sourceValues(old) : {}),...source});
  row.manualFields = JSON.stringify([...locked]);
  row.origin = old?.origin || 'import';
  row.id = old?.id || imported.id || crypto.randomUUID();
  if (c === 'sales') row.importKey = old?.importKey || imported.importKey;
  // Imported inventory may be undated (partial trackers); keep the date blank rather than invent one.
  // New items typed into the form still require a date.
  return prepareRow(c,row,!!old || c === 'inventory');
}

export function recordKey(c: Exclude<ColName,'sales'>, input: object): string {
  const row = input as Row, r = row.sourceData ? {...row,...sourceValues(row)} : row;
  if (c === 'inventory') return String(r.sku || '').trim().toLowerCase();
  if (c === 'listings') return String(row.productId || r.link || '').replace(/\/$/,'').toLowerCase();
  return JSON.stringify(Object.entries(r).filter(([key])=>!metadata.has(key) && key !== 'notes').sort(([a],[b])=>a.localeCompare(b)));
}
export function mergeRecords(c: Exclude<ColName,'sales'>, existing: object[], incoming: object[]) {
  const rows = [...existing] as Row[]; let added=0,updated=0,unchanged=0;
  for (const input of incoming) {
    const key = recordKey(c,input);
    if (!key) throw new Error(`Each imported ${c} record needs ${c === 'inventory' ? 'a SKU' : 'a product ID or link'}.`);
    const matches = rows.filter(row=>recordKey(c,row) === key);
    if (matches.length > 1) throw new Error(`Multiple ${c} records match this import. Resolve those duplicates before importing.`);
    const old = matches[0], next = mergeRecord(c,old,input);
    if (!old) { rows.push(next); added++; }
    else { rows[rows.indexOf(old)] = next; if (Object.entries(next).some(([key,value])=>!metadata.has(key) && value !== old[key])) updated++; else unchanged++; }
  }
  return {rows,added,updated,unchanged};
}

// Runs after every import, clear and consolidation: inventory links (by SKU), then listing links (see listingLinks.ts).
export function reconcileInventory(data: Data): Data {
  return reconcileListings(reconcileInventoryOnly(data)).data;
}
// SKU linkage is explicit; descriptions are never used to connect a sale to inventory.
function reconcileInventoryOnly(data: Data): Data {
  const sales=data.sales.map(s=>{
    const item=s.sku?data.inventory.find(i=>i.sku===s.sku):undefined;
    return item && !s.cogs && !manualFields(s).includes('cogs') && s.sourceData && !('cogs' in sourceValues(s)) ? {...s,cogs:item.cost} : s;
  });
  const inventory = data.inventory.map(item=>{
    const row = item as unknown as Row;
    const matches = sales.filter(s=>s.sku && s.sku === item.sku);
    if (matches.length === 1 && matches[0].id && matches[0].date) {
      const sale = matches[0];
      return {...item,status:'Sold',outcome:sale.date,soldBy:sale.id,
        previousStatus:row.previousStatus || (item.status === 'Sold' ? (item.listed ? 'Listed' : 'Unlisted') : item.status),
        previousOutcome:row.previousOutcome ?? (item.status === 'Sold' ? '' : item.outcome)};
    }
    if (!matches.length && row.soldBy) return {...item,status:String(row.previousStatus || (item.listed ? 'Listed' : 'Unlisted')),outcome:String(row.previousOutcome || ''),soldBy:'',previousStatus:'',previousOutcome:''};
    return item;
  });
  return {...data,sales,inventory};
}
export const importedSale = (s: Sale) => s.origin !== 'manual';
export function withoutImportedSales(data:Data):Data{
  const removed=new Set(data.sales.filter(importedSale).map(s=>s.id));
  // Clearing financial history does not mean a physically sold item is back on hand.
  const inventory=data.inventory.map(i=>removed.has((i as unknown as Row).soldBy as string)?{...i,soldBy:''}:i);
  // Same for listings: the item still sold, so it stays Sold; only the link to the cleared sale goes.
  const listings=data.listings.map(l=>removed.has((l as unknown as Row).soldBy as string)?{...l,soldBy:'',previousStatus:''}:l);
  return reconcileInventory({...data,sales:data.sales.filter(s=>!importedSale(s)),inventory,listings});
}
