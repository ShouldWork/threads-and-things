import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, writeBatch, increment, getDocFromServer, getDocsFromServer, runTransaction, type WriteBatch } from 'firebase/firestore';
import { auth } from '../firebase';
import { db } from '../firestore';
import { DEFAULT_SETTINGS, type Data, type Sale, type Settings } from '../types';
import { COLS, emptyData, prepareRow, prepareSettings, withoutId, type ColName, type Row } from '../lib/records';
import { saleWrites } from '../lib/saleWrites';
import { finalizedImport, readBackup, sameData, type ImportChanges, type HistoryEntry, type OperationCounts } from '../lib/importPlan';
import { importedSale, reconcileInventory, withoutImportedSales } from '../lib/importRecords';
import { consolidateSaleRows } from '../lib/imports';
export type { ImportChanges, HistoryEntry } from '../lib/importPlan';
export { COLS }; export type { ColName };

type Session = { email: string; shop: string; version: string; role:string; ready: boolean; pending: boolean; fromCache: boolean };
let session: Session | null = null;
const failureListeners = new Set<(message: string) => void>();
export const currentShop = () => session?.shop || '';
export const newRecordId = (): string => crypto.randomUUID();
function database() { if (!db) throw new Error('Firebase is not configured.'); return db; }
function current() {
  if (!session?.ready || auth?.currentUser?.email?.toLowerCase() !== session.email) throw new Error('Wait for your shop to finish loading.');
  return { ...session };
}
const shopRef = (s: Session) => doc(database(),'shops',s.shop);
const rootRef = (s: Session) => s.version ? doc(shopRef(s),'datasets',s.version) : shopRef(s);
const col = (s: Session,c: ColName) => collection(rootRef(s),c);
function same(s: Session) { return session?.ready && session.email === s.email && session.shop === s.shop && session.version === s.version; }

type State = { email: string | null; data: Data; history:HistoryEntry[];version:string;revision:number;role:string; ready: boolean; error: string; syncError: string; pending: boolean; fromCache: boolean };
const initial = (email: string | null): State => ({email,data:emptyData(),history:[],version:'',revision:0,role:'',ready:false,error:'',syncError:'',pending:false,fromCache:true});
export function useData(email: string | null) {
  email = email?.toLowerCase() || null;
  const [state,setState] = useState<State>(() => initial(email));
  useEffect(() => {
    setState(initial(email)); session = null;
    if (!email || !db) return;
    let alive = true, generation = 0, shopGeneration = 0, selectedShop = '';
    let shopUnsub = () => {}, historyUnsub = () => {}; let rowUnsubs: (() => void)[] = [];
    const resetRows = () => { generation++; rowUnsubs.forEach(u=>u()); rowUnsubs=[]; };
    const fail = (e: {code?: string; message: string}) => {
      if (!alive) return;
      session = null; shopGeneration++; shopUnsub();historyUnsub();resetRows();
      setState({...initial(email),error:e.code === 'permission-denied' ? 'This account no longer has access to this shop.' : e.message});
    };
    const syncFailure = (message: string) => { if (alive) setState(s=>({...s,syncError:message})); };
    failureListeners.add(syncFailure);
    const membershipUnsub = onSnapshot(doc(db,'users',email),user => {
      if (!alive) return;
      const shops = user.data()?.shops;
      if (!user.exists() || !Array.isArray(shops) || typeof shops[0] !== 'string' || !shops[0]) { fail({message:'This Google account is not on the users list yet.'}); return; }
      const role=String(user.data()?.role || '');
      if (selectedShop === shops[0] && session) {session.role=role;setState(s=>({...s,role}));return;}
      shopUnsub();historyUnsub(); resetRows(); selectedShop = shops[0]; const shopToken=++shopGeneration;
      setState(initial(email));
      session = {email,shop:selectedShop,version:'',role,ready:false,pending:false,fromCache:true};
      historyUnsub=onSnapshot(collection(db!,'shops',selectedShop,'history'),snapshot=>{
        if(!alive || shopToken !== shopGeneration)return;
        const history=snapshot.docs.map(d=>({...d.data(),id:d.id}) as HistoryEntry).sort((a,b)=>b.revisionAfter-a.revisionAfter);
        setState(s=>({...s,history}));
      },e=>{if(alive && shopToken === shopGeneration)fail(e);});
      let version: string | null = null;
      let revision=0;
      let next = emptyData(); const loaded = new Set<string>();
      const metadata = new Map<string,{pending:boolean;cached:boolean}>();
      const publish = () => {
        if (!alive || !session) return;
        const ready = loaded.size === COLS.length;
        const pending = [...metadata.values()].some(m=>m.pending), fromCache = [...metadata.values()].some(m=>m.cached);
        session.ready=ready; session.pending=pending; session.fromCache=fromCache;
        setState(s=>({...s,email,data:ready?{...next}:emptyData(),version:version || '',revision,role:session?.role || role,ready,error:'',pending,fromCache}));
      };
      shopUnsub = onSnapshot(doc(db!,'shops',selectedShop),{includeMetadataChanges:true},settings => {
        if (!alive || shopToken !== shopGeneration) return;
        try {
          const raw = settings.data() || {};
          revision=Number(raw.revision || 0);
          const incoming = typeof raw.dataVersion === 'string' ? raw.dataVersion : '';
          next.settings = { ...DEFAULT_SETTINGS,...prepareSettings(raw) };
          metadata.set('settings',{pending:settings.metadata.hasPendingWrites,cached:settings.metadata.fromCache});
          if (version !== incoming) {
            resetRows(); loaded.clear(); next = {...emptyData(),settings:next.settings}; metadata.clear();
            metadata.set('settings',{pending:settings.metadata.hasPendingWrites,cached:settings.metadata.fromCache});
            version=incoming; session = {email,shop:selectedShop,version:incoming,role:session?.role || role,ready:false,pending:false,fromCache:true};
            const context={...session}, token=generation;
            for (const c of COLS) rowUnsubs.push(onSnapshot(col(context,c),{includeMetadataChanges:true},snapshot => {
              if (!alive || token !== generation) return;
              try {
                const rows = snapshot.docs.map(d=>prepareRow(c,{...d.data(),id:d.id},true));
                next={...next,[c]:rows}; loaded.add(c);
                metadata.set(c,{pending:snapshot.metadata.hasPendingWrites,cached:snapshot.metadata.fromCache}); publish();
              } catch(e) { fail({message:`Invalid ${c} data: ${(e as Error).message}`}); }
            },e=>{if(alive && token === generation) fail(e);}));
          }
          publish();
        } catch(e) { fail({message:(e as Error).message}); }
      },e=>{if(alive && shopToken === shopGeneration) fail(e);});
    },fail);
    return () => { alive=false; membershipUnsub(); shopUnsub();historyUnsub(); resetRows(); failureListeners.delete(syncFailure); if(session?.email === email) session=null; };
  },[email]);
  return state.email === email ? state : initial(email);
}

export type WriteResult = { queued: boolean };
let importing = false;
function assertWrite(s: Session) { if (!same(s)) throw new Error('The active shop changed. Reopen this form.'); if(importing) throw new Error('Wait for the import to finish.'); }
async function commitLocal(s: Session,b: WriteBatch): Promise<WriteResult> {
  assertWrite(s);
  const token=newRecordId(); b.set(shopRef(s),{revision:increment(1),lastWrite:token},{merge:true});
  return new Promise((resolve,reject)=>{
    let completed=false, unsub=()=>{};
    const finish=(result:WriteResult)=>{if(!completed){completed=true;unsub();resolve(result);}};
    unsub=onSnapshot(shopRef(s),{includeMetadataChanges:true},snap=>{
      if(snap.data()?.lastWrite === token) finish({queued:snap.metadata.hasPendingWrites});
    },e=>{if(!completed){completed=true;unsub();reject(e);}});
    b.commit().then(()=>finish({queued:false})).catch(e=>{
      unsub();
      if(!completed) {completed=true;reject(e);} else if(same(s)) failureListeners.forEach(f=>f(`A saved change could not sync: ${e.message}. Check the affected record before retrying.`));
    });
  });
}
export async function add(c: ColName,row: object,id=newRecordId()) {
  const s=current(), b=writeBatch(database()); b.set(doc(col(s,c),id),withoutId(prepareRow(c,row))); return commitLocal(s,b);
}
export async function update(c: ColName,id: string,row: object) {
  const s=current(), b=writeBatch(database()); b.set(doc(col(s,c),id),withoutId(prepareRow(c,row))); return commitLocal(s,b);
}
export async function remove(c: ColName,id: string) {
  const s=current(), b=writeBatch(database()); b.delete(doc(col(s,c),id)); return commitLocal(s,b);
}
export async function saveSettings(settings: Partial<Settings>) {
  const s=current(), b=writeBatch(database()); b.set(shopRef(s),prepareSettings(settings),{merge:true}); return commitLocal(s,b);
}
export async function saveSale(data: Data,id: string,sale: Sale|null,previous?: Sale,listingId?: string) {
  const s=current(), plan=saleWrites(data,id,sale,previous,listingId), b=writeBatch(database());
  if(plan.sale) b.set(doc(col(s,'sales'),id),withoutId(plan.sale)); else b.delete(doc(col(s,'sales'),id));
  plan.inventory.forEach(i=>b.set(doc(col(s,'inventory'),i.id!),withoutId(i)));
  plan.listings.forEach(l=>b.set(doc(col(s,'listings'),l.id!),withoutId(l)));
  return commitLocal(s,b);
}

async function stageOperation(action:HistoryEntry['action'],label:string,plan:(data:Data)=>{next:Data;counts:OperationCounts}|Promise<{next:Data;counts:OperationCounts}>,expected?:{version:string;revision:number}) {
  const s=current();
  if(importing) throw new Error('An import is already running.');
  if(!navigator.onLine || s.pending) throw new Error('Reconnect and let your pending changes sync before importing.');
  if(['clear-sales','reset','restore'].includes(action) && s.role !== 'owner')throw new Error('Only the shop owner can clear, reset or restore data.');
  importing=true;
  try {
    const before=await getDocFromServer(shopRef(s)), revision=before.data()?.revision || 0;
    if((before.data()?.dataVersion || '') !== s.version) throw new Error('The shop changed. Reload before importing.');
    if(expected && (s.version!==expected.version || revision!==expected.revision))throw new Error('This operation has later changes. Undo is blocked to protect them.');
    const snapshots=await Promise.all(COLS.map(c=>getDocsFromServer(col(s,c))));
    const original=emptyData();original.settings={...DEFAULT_SETTINGS,...prepareSettings(before.data() || {})};
    COLS.forEach((c,i)=>{ (original[c] as unknown as Row[])=snapshots[i].docs.map(d=>prepareRow(c,{...d.data(),id:d.id},true)); });
    const {next,counts}=await plan(original);const settings=prepareSettings(next.settings);
    // A re-import that changes nothing returns its counts without staging another full dataset copy.
    if(action==='import' && sameData(original,next)) return counts;
    const version=newRecordId(), staged={...s,version};
    const entries=COLS.flatMap(c=>next[c].map(r=>({c,row:prepareRow(c,r,true)})));
    for(let i=0;i<entries.length;i+=400) {
      if(!same(s)) throw new Error('The account or shop changed during import.');
      const b=writeBatch(database());
      entries.slice(i,i+400).forEach(({c,row})=>b.set(doc(col(staged,c),row.id || newRecordId()),withoutId(row)));
      await b.commit();
    }
    if(!same(s)) throw new Error('The account or shop changed during import.');
    await runTransaction(database(),async tx=>{
      const latest=await tx.get(shopRef(s));
      if(!same(s)) throw new Error('The account or shop changed during import.');
      if((latest.data()?.revision || 0)!==revision || (latest.data()?.dataVersion || '')!==s.version) throw new Error('Someone changed this shop during import. Nothing was replaced. Try again.');
      tx.set(shopRef(s),{...settings,dataVersion:version,revision:revision+1,lastWrite:newRecordId()},{merge:true});
      tx.set(doc(shopRef(s),'history',version),{action,label:label.slice(0,200),actor:s.email,createdAt:new Date().toISOString(),beforeVersion:s.version,afterVersion:version,revisionBefore:revision,revisionAfter:revision+1,beforeSettings:original.settings,afterSettings:next.settings,counts});
    });
    return counts;
  } finally { importing=false; }
}
export async function importData(changes:ImportChanges){
  for(const [c,rows] of Object.entries(changes.merge || {}))rows!.forEach(r=>prepareRow(c as ColName,r,true));
  for(const [c,rows] of Object.entries(changes.replace || {}))rows!.forEach(r=>prepareRow(c as ColName,r));
  changes.sales?.forEach(r=>prepareRow('sales',r));prepareSettings(changes.settings || {});
  return stageOperation('import',changes.label || 'Data import',data=>{const p=finalizedImport(data,changes);return{next:p.next,counts:{added:p.added,updated:p.updated,unchanged:p.unchanged,skipped:p.skipped}};});
}
const zeroCounts:OperationCounts={added:0,updated:0,unchanged:0,skipped:0};
export const clearImportedSales=()=>stageOperation('clear-sales','Clear imported / unclassified sales',data=>({next:withoutImportedSales(data),counts:{...zeroCounts,updated:data.sales.filter(importedSale).length}}));
export const resetShop=()=>stageOperation('reset','Reset all shop records',data=>({next:{...emptyData(),settings:data.settings},counts:{...zeroCounts,updated:COLS.reduce((n,c)=>n+data[c].length,0)}}));
export const restoreBackup=(data:Data)=>{const next=readBackup({format:'threads-and-things',version:1,data});return stageOperation('restore','Restore full JSON backup',()=>({next,counts:{...zeroCounts,added:COLS.reduce((n,c)=>n+next[c].length,0)}}));};
export function consolidateSales(ids:string[],keepId:string){
  return stageOperation('deduplicate','Consolidate duplicate sales',data=>{
    const sales=consolidateSaleRows(data.sales,ids,keepId);
    return{next:reconcileInventory({...data,sales}),counts:{...zeroCounts,updated:ids.length-1}};
  });
}
export async function undoImport(id:string){
  const s=current();if(importing || s.pending || !navigator.onLine)throw new Error('Reconnect and sync your changes before undoing.');
  const entry=await getDocFromServer(doc(shopRef(s),'history',id));const history=entry.data() as Omit<HistoryEntry,'id'>|undefined;
  if(!same(s) || !history)throw new Error('The account or history changed. Reload before undoing.');
  return stageOperation('undo',`Undo: ${history.label}`,async()=>{
    const restored=emptyData();restored.settings=history.beforeSettings;
    const snapshots=await Promise.all(COLS.map(c=>getDocsFromServer(col({...s,version:history.beforeVersion},c))));
    COLS.forEach((c,i)=>{(restored[c] as unknown as Row[])=snapshots[i].docs.map(d=>prepareRow(c,{...d.data(),id:d.id},true));});
    // Restore into a fresh active version; recovery snapshots are never reopened for edits.
    return{next:restored,counts:zeroCounts};
  },{version:history.afterVersion,revision:history.revisionAfter});
}
