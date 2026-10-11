import { DEFAULT_SETTINGS, type Data, type Sale, type Settings } from '../types';
import { COLS, prepareRow, prepareSettings, type ColName, type Row } from './records';
import { mergeSales, type MatchDecisions } from './imports';
import { mergeRecords, reconcileInventory, sourceValues, manualFields } from './importRecords';

export type ImportChanges = {
  sales?: Sale[];
  merge?: Partial<Record<Exclude<ColName,'sales'>,object[]>>;
  /** Reserved for explicit reset/recovery operations; file imports merge by default. */
  replace?: Partial<Record<ColName,object[]>>;
  settings?: Partial<Settings>;
  decisions?: MatchDecisions;
  label?: string;
};
export function previewImport(data: Data, changes: ImportChanges) {
  const sales=mergeSales(data.sales,changes.sales || [],changes.decisions);
  let next:Data={...data,sales:sales.rows,settings:{...data.settings,...prepareSettings(changes.settings || {})}};
  const collections:Partial<Record<ColName,{added:number;updated:number;unchanged:number}>>={};
  if(changes.sales)collections.sales=sales;
  for(const [c,incoming] of Object.entries(changes.merge || {})){
    const key=c as Exclude<ColName,'sales'>;const result=mergeRecords(key,data[key],incoming!);
    (next[key] as unknown as Row[])=result.rows;collections[key]=result;
  }
  for(const [c,incoming] of Object.entries(changes.replace || {})) (next[c as ColName] as unknown as Row[])=incoming!.map(r=>({...prepareRow(c as ColName,r),id:crypto.randomUUID()}));
  for(const c of COLS)next[c].forEach(r=>prepareRow(c,r,true));
  const counts=Object.values(collections).reduce((n,r)=>({added:n.added+r.added,updated:n.updated+r.updated,unchanged:n.unchanged+r.unchanged}),{added:0,updated:0,unchanged:0});
  return {next,collections,...counts,skipped:sales.skipped,uncertain:sales.uncertain};
}
export function finalizedImport(data: Data, changes: ImportChanges){
  const plan=previewImport(data,changes);
  if(plan.uncertain.length)throw new Error('Review every uncertain sale match before importing.');
  plan.next.sales=plan.next.sales.map(s=>({...s,id:s.id?.startsWith('import-row-')?crypto.randomUUID():s.id}));
  for(const c of COLS){const ids=plan.next[c].map(r=>r.id);if(new Set(ids).size!==ids.length)throw new Error(`The import contains repeated ${c} record IDs.`);}
  return {...plan,next:reconcileInventory(plan.next)};
}

// True when an operation would leave every record and setting exactly as it was (compared field by field,
// ignoring key order). Lets a no-op re-import skip copying the whole dataset into a new version.
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v && typeof v==='object'?Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([,x])=>x!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
export function sameData(a:Data,b:Data){
  const rows=(d:Data,c:ColName)=>JSON.stringify(canonical([...(d[c] as unknown as Row[])].sort((x,y)=>String(x.id).localeCompare(String(y.id)))));
  return COLS.every(c=>rows(a,c)===rows(b,c)) && JSON.stringify(canonical(prepareSettings(a.settings)))===JSON.stringify(canonical(prepareSettings(b.settings)));
}

export type OperationCounts={added:number;updated:number;unchanged:number;skipped:number};
export type HistoryEntry={id:string;action:'import'|'clear-sales'|'reset'|'deduplicate'|'undo'|'restore';label:string;actor:string;createdAt:string;beforeVersion:string;afterVersion:string;revisionBefore:number;revisionAfter:number;beforeSettings:Settings;afterSettings:Settings;counts:OperationCounts};
export function readBackup(input:unknown):Data{
  const file=input as {format?:string;version?:number;data?:Data};
  if(!file || file.format!=='threads-and-things' || file.version!==1 || !file.data)throw new Error('Choose a Threads and Things full JSON backup.');
  if(!file.data.settings || typeof file.data.settings!=='object')throw new Error('Backup is missing shop settings.');
  const next={...file.data,settings:{...DEFAULT_SETTINGS,...prepareSettings(file.data.settings)}};
  for(const c of COLS){
    if(!Array.isArray(next[c]))throw new Error(`Backup is missing ${c}.`);
    const ids=new Set<string>();
    (next[c] as unknown as Row[])=next[c].map(row=>{
      const clean=prepareRow(c,row,true);sourceValues(clean);manualFields(clean);
      const id=clean.id || crypto.randomUUID();
      if(typeof id!=='string' || id.includes('/') || id.length>1500 || ids.has(id))throw new Error(`Backup contains invalid or repeated ${c} IDs.`);
      ids.add(id);return{...clean,id};
    });
  }
  return next;
}
