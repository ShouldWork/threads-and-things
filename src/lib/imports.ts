import type { Sale } from '../types';
import { manualFields, mergeRecord, sourceValues } from './importRecords';

const text = (s: unknown) => String(s || '').trim().replace(/\s+/g,' ').toLowerCase();
const platform = (s: Sale) => text(s.platform) || 'depop';
export function externalSaleKey(s: Sale): string {
  return s.sourceId ? JSON.stringify([platform(s),s.sourceId,s.productId || '']) : '';
}
// Retained for compatibility with previously saved import keys and manually edited records.
export function saleKey(s: Sale): string {
  if (s.importKey) return s.importKey;
  if (s.sourceId) return JSON.stringify(['id',s.platform || 'Depop',s.sourceId,...(s.productId ? [s.productId] : [])]);
  return JSON.stringify(['row',s.platform || 'Depop',s.date,s.price,s.buyer || '',s.sku || '',s.listed || '',s.brand || '',s.size || '',s.desc]);
}
function original(s: Sale): Sale { return s.sourceData ? {...s,...sourceValues(s)} as Sale : s; }
function possibleMatch(a: Sale,b: Sale): boolean {
  if (platform(a) !== platform(b)) return false;
  if (a.sourceId && b.sourceId && a.sourceId !== b.sourceId) return false;
  if (a.productId && b.productId && a.productId !== b.productId) return false;
  const x = original(a), y = original(b);
  if (x.date !== y.date) return false;
  if (x.sku && y.sku && text(x.sku) === text(y.sku)) return true;
  if (a.productId && a.productId === b.productId) return true;
  return !!text(x.desc) && text(x.desc) === text(y.desc) && (!x.buyer || !y.buyer || text(x.buyer) === text(y.buyer));
}
export type MatchDecisions = Record<string,string>;
export type UncertainSale = {index:number;sale:Sale;candidates:Sale[];reason:string};
function aliases(s: Sale): string[] { try { const value=JSON.parse(s.importAliases || '[]');return Array.isArray(value) ? value.filter(v=>typeof v === 'string') : []; } catch { return []; } }
export function mergeSales(existing: Sale[], incoming: Sale[], decisions: MatchDecisions = {}) {
  const rows = [...existing]; const uncertain: UncertainSale[] = [];
  let added=0,updated=0,unchanged=0,skipped=0;
  const assigned = new Set<string>();
  incoming.forEach((sale,index)=>{
    const native = externalSaleKey(sale);
    const exact = rows.filter(s=>native ? externalSaleKey(s) === native || (s.sourceId===sale.sourceId && !(s.productId && sale.productId && s.productId!==sale.productId) && aliases(s).includes(saleKey(sale))) : saleKey(s) === saleKey(sale) || aliases(s).includes(saleKey(sale)) || (s.sourceData && saleKey(original(s)) === saleKey(sale)));
    const candidates = exact.length ? exact : rows.filter(s=>possibleMatch(s,sale));
    let previous: Sale | undefined;
    const decision = decisions[index];
    if (decision === 'skip') { skipped++; return; }
    if (decision && decision !== 'new') {
      previous = candidates.find(s=>s.id === decision);
      if (!previous) throw new Error('An import match changed. Review this row again.');
    } else if (decision !== 'new') {
      if (exact.length === 1 && !(assigned.has(exact[0].id!) && (!native || text(original(exact[0]).desc) !== text(sale.desc)))) previous = exact[0];
      else if (candidates.length) {
        uncertain.push({index,sale,candidates,reason:exact.length > 1 ? 'More than one saved sale matches.' : assigned.has(candidates[0].id!) ? 'Another row in this file may be the same sale.' : 'This may be a saved sale with different or missing export details.'});
        return;
      }
    }
    const next = mergeRecord('sales',previous,{...sale,importKey:previous?.importKey || saleKey(sale),id:sale.id || `import-row-${index}`}) as unknown as Sale;
    next.importAliases = JSON.stringify([...new Set([...(previous ? aliases(previous) : []),saleKey(sale)])].slice(-20));
    // A native identity learned during matching replaces neither the internal ID nor local edits.
    if (previous) {
      rows[rows.indexOf(previous)] = next; assigned.add(next.id!);
      if (Object.entries(next).some(([key,value])=>!['sourceData','manualFields','origin','importKey','sourceId','productId','orderId'].includes(key) && value !== (previous as unknown as Record<string,unknown>)[key])) updated++; else unchanged++;
    } else { rows.push(next); assigned.add(next.id!); added++; }
  });
  return {rows,added,updated,unchanged,skipped,uncertain};
}

// Suggestions only: the user chooses the keeper and explicitly confirms consolidation.
export function duplicateSaleGroups(sales: Sale[]): Sale[][] {
  const groups: Sale[][] = [], seen = new Set<string>();
  for (const sale of sales) {
    if (!sale.id || seen.has(sale.id)) continue;
    const native = externalSaleKey(sale);
    const group = sales.filter(s=>s.id && !seen.has(s.id) && (native && externalSaleKey(s) === native || possibleMatch(sale,s)));
    if (group.length > 1) { group.forEach(s=>seen.add(s.id!)); groups.push(group); }
  }
  return groups;
}
export function consolidateSaleRows(sales:Sale[],ids:string[],keepId:string):Sale[]{
  if(new Set(ids).size<2 || !ids.includes(keepId) || ids.some(id=>!sales.some(s=>s.id===id)))throw new Error('The selected sales changed. Review the duplicates again.');
  const selected=sales.filter(s=>ids.includes(s.id!)),keeper={...selected.find(s=>s.id===keepId)!};
  const keys=new Set(manualFields(keeper));
  for(const key of ['sku','listed','brand','size','cat','state','buyer','sourceId','productId','orderId'] as const){
    if(keeper[key])continue;
    const values=[...new Set(selected.map(s=>s[key]).filter(Boolean))];
    if(values.length===1){(keeper as unknown as Record<string,unknown>)[key]=values[0];if(selected.some(s=>manualFields(s).includes(key)))keys.add(key);}
  }
  keeper.importAliases=JSON.stringify([...new Set(selected.flatMap(s=>[...aliases(s),saleKey(s)]))].slice(-20));
  keeper.manualFields=JSON.stringify([...keys]);
  return sales.filter(s=>!ids.includes(s.id!) || s.id===keepId).map(s=>s.id===keepId?keeper:s);
}
