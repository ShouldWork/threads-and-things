import {useEffect,useState} from 'react';
import {DEFAULT_SETTINGS,type Data,type Settings,type Sale} from '../src/types';
import {COLS,prepareRow,emptyData,type ColName} from '../src/lib/records';
import {saleWrites} from '../src/lib/saleWrites';
import {finalizedImport,readBackup,sameData,type ImportChanges,type HistoryEntry,type OperationCounts} from '../src/lib/importPlan';
import {importedSale,reconcileInventory,withoutImportedSales} from '../src/lib/importRecords';
import {consolidateSaleRows} from '../src/lib/imports';
import seed from './seed.json';
let store:Data=emptyData(),revision=0,version='',history:HistoryEntry[]=[];
const backups=new Map<string,Data>();
const clone=(data:Data):Data=>JSON.parse(JSON.stringify(data));
COLS.forEach(c=>{(store[c] as object[])=(seed[c] as object[]).map(r=>prepareRow(c,r,true));});
store.settings={...DEFAULT_SETTINGS,snapshot:'2026-10-10'};
const subs=new Set<(d:Data)=>void>(),emit=()=>{revision++;subs.forEach(f=>f({...store}));};
export const newRecordId=():string=>crypto.randomUUID();
export const currentShop=()=> 'demo';
export {COLS};export type {ColName};
const saved={queued:false},zero={added:0,updated:0,unchanged:0,skipped:0};
export function useData(email:string|null){const[data,setData]=useState(store);useEffect(()=>{if(!email)return;subs.add(setData);return()=>{subs.delete(setData);};},[email]);return{data,history,revision,version,role:'owner',ready:!!email,error:'',syncError:'',pending:false,fromCache:false};}
// New array, like a Firestore snapshot, so memoized lists see the change.
export const add=async(c:ColName,row:object,id=newRecordId())=>{(store[c] as object[])=[...store[c],{...prepareRow(c,row),id}];emit();return saved;};
export const update=async(c:ColName,id:string,row:object)=>{(store[c] as object[])=store[c].map(r=>r.id===id?{...prepareRow(c,row),id}:r);emit();return saved;};
export const remove=async(c:ColName,id:string)=>{(store[c] as object[])=store[c].filter(r=>r.id!==id);emit();return saved;};
export const saveSettings=async(settings:Partial<Settings>)=>{store={...store,settings:{...store.settings,...settings}};emit();return saved;};
export const saveSale=async(data:Data,id:string,sale:Sale|null,previous?:Sale,listingId?:string)=>{
  const plan=saleWrites(data,id,sale,previous,listingId);
  for(const row of plan.listings)store.listings=store.listings.map(l=>l.id===row.id?row as unknown as typeof l:l);store.sales=store.sales.filter(s=>s.id!==id);if(sale)store.sales=[...store.sales,{...sale,id}];
  for(const row of plan.inventory)store.inventory=store.inventory.map(i=>i.id===row.id?row as unknown as typeof i:i);
  emit();return saved;
};
function stage(action:HistoryEntry['action'],label:string,next:Data,counts:OperationCounts){
  const after=newRecordId();backups.set(version,clone(store));
  history=[{id:after,action,label,actor:'demo@example.com',createdAt:new Date().toISOString(),beforeVersion:version,afterVersion:after,revisionBefore:revision,revisionAfter:revision+1,beforeSettings:store.settings,afterSettings:next.settings,counts},...history];
  store=next;version=after;emit();return counts;
}
export const importData=async(changes:ImportChanges)=>{const p=finalizedImport(store,changes);if(sameData(store,p.next))return {added:p.added,updated:p.updated,unchanged:p.unchanged,skipped:p.skipped};return stage('import',changes.label || 'Data import',p.next,{added:p.added,updated:p.updated,unchanged:p.unchanged,skipped:p.skipped});};
export const clearImportedSales=async()=>stage('clear-sales','Clear imported / unclassified sales',withoutImportedSales(store),{...zero,updated:store.sales.filter(importedSale).length});
export const resetShop=async()=>stage('reset','Reset all shop records',{...emptyData(),settings:store.settings},{...zero,updated:COLS.reduce((n,c)=>n+store[c].length,0)});
export const restoreBackup=async(data:Data)=>{const next=readBackup({format:'threads-and-things',version:1,data});return stage('restore','Restore full JSON backup',next,{...zero,added:COLS.reduce((n,c)=>n+next[c].length,0)});};
export const consolidateSales=async(ids:string[],keepId:string)=>stage('deduplicate','Consolidate duplicate sales',reconcileInventory({...store,sales:consolidateSaleRows(store.sales,ids,keepId)}),{...zero,updated:ids.length-1});
export const undoImport=async(id:string)=>{
  const entry=history.find(h=>h.id===id);
  if(!entry || entry.afterVersion!==version || entry.revisionAfter!==revision)throw new Error('This operation has later changes. Undo is blocked to protect them.');
  const data=backups.get(entry.beforeVersion);if(!data)throw new Error('Backup is unavailable.');
  return stage('undo',`Undo: ${entry.label}`,clone(data),zero);
};
