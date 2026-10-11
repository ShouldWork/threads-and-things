import {useState} from 'react';
import type {Data} from '../types';
import {clearImportedSales,resetShop,undoImport,consolidateSales,restoreBackup,type HistoryEntry} from '../hooks/useData';
import {duplicateSaleGroups} from '../lib/imports';
import {importedSale} from '../lib/importRecords';
import {readBackup} from '../lib/importPlan';
import {COLS} from '../lib/records';
import {money,today} from '../lib/calc';
import {Field,FileButton} from './ui';

type Props={data:Data;history:HistoryEntry[];version:string;revision:number;canReset:boolean;disabled:boolean;toast:(s:string)=>void;onBusy:(busy:boolean)=>void};
type Confirmation={title:string;message:string;word:string;run:()=>Promise<unknown>};
export default function DataTools({data,history,version,revision,canReset,disabled,toast,onBusy}:Props){
  const [confirmation,setConfirmation]=useState<Confirmation|null>(null),[word,setWord]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [keepers,setKeepers]=useState<Record<string,string>>({});
  const groups=duplicateSaleGroups(data.sales);
  function confirm(next:Confirmation){setConfirmation(next);setWord('');setError('');}
  function download(){
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'threads-and-things',version:1,createdAt:new Date().toISOString(),data},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`threads-and-things-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function execute(){
    if(!confirmation || busy || disabled || word!==confirmation.word)return;
    setBusy(true);onBusy(true);setError('');
    try{await confirmation.run();setConfirmation(null);toast('Data changes saved. A recovery snapshot is in the history.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);onBusy(false);}
  }
  return <>
    <div className="card"><h3>Backup and recovery</h3><p>Download all records, notes, protected edits and settings as a JSON backup.</p><button className="btn" disabled={busy} onClick={download}>Download full backup</button>
      {canReset && <FileButton label="Restore JSON backup" accept=".json,application/json" disabled={disabled || busy} onFile={async file=>{
        setError('');
        try{if(file.size>20*1024*1024)throw new Error('Choose a backup smaller than 20 MB.');const restored=readBackup(JSON.parse(await file.text()));confirm({title:'Restore backup',message:`Replace all current records with ${COLS.reduce((n,c)=>n+restored[c].length,0)} records from ${file.name}. Current records will be retained in a recovery snapshot.`,word:'RESTORE',run:()=>restoreBackup(restored)});}catch(err){setError((err as Error).message);}
      }}/>}
    </div>
    {!!groups.length && <div className="card"><h3>Review possible duplicate sales</h3><p>These are suggestions. Distinct sales can look alike. Choose the record to keep only after checking the rows; its financial values and edits will be retained.</p>
      {groups.map(group=>{const key=group.map(s=>s.id).join('|'),keep=keepers[key] || group[0].id!;return <div key={key}><Field label={`Sale to keep: ${group[0].desc}`}><select value={keep} onChange={e=>setKeepers(k=>({...k,[key]:e.target.value}))}>{group.map((s,index)=><option key={s.id} value={s.id}>Record {index+1}: {s.desc} · {s.date} · {money(s.price)} · SKU {s.sku || 'none'}{s.sourceId?` · transaction ${s.sourceId}`:''}</option>)}</select></Field>
        <ul>{group.map(s=><li key={s.id}>{s.date} · {s.desc} · {money(s.price)} · fees {money(s.depopFee+s.payFee+s.boost)} · refund {money(s.refund)} · cost {money(s.cogs)} · SKU {s.sku || 'none'}</li>)}</ul>
        <button className="btn small" disabled={disabled || busy} onClick={()=>confirm({title:'Consolidate sales',message:`Keep the selected sale and remove ${group.length-1} other records from the totals. Inventory links will be reconciled. This is saved with a recovery snapshot.`,word:'MERGE',run:()=>consolidateSales(group.map(s=>s.id!),keep)})}>Consolidate these {group.length} sales</button>
      </div>;})}
    </div>}
    <div className="card"><h3>Import and data history</h3>
      {!history.length && <p className="note">New imports and data operations will appear here. Older imports have no history entry.</p>}
      {history.slice(0,30).map(entry=>{const canUndo=entry.afterVersion===version && entry.revisionAfter===revision;return <div key={entry.id}><p><b>{entry.label}</b><br/>{new Date(entry.createdAt).toLocaleString()} · {entry.actor}<br/>{entry.action==='import'?`${entry.counts.added} new · ${entry.counts.updated} updated · ${entry.counts.unchanged} unchanged · ${entry.counts.skipped} skipped`:entry.action}</p>
        <button className="btn small" disabled={!canUndo || disabled || busy} onClick={()=>confirm({title:'Undo data operation',message:`Restore the records and settings from before “${entry.label}”. Undo is blocked if there have been later edits, so those edits cannot be lost.`,word:'UNDO',run:()=>undoImport(entry.id)})}>Undo this operation</button>
        {!canUndo && <p className="note">Undo unavailable: later changes or a different active dataset. Stored recovery snapshots are retained.</p>}
      </div>;})}
    </div>
    {canReset && <div className="card"><h3>Clear data</h3><p>These actions retain a recovery snapshot. Download a full backup first. Undo is available until another edit or operation is made.</p>
      <div className="actions"><button className="btn" disabled={disabled || busy || !data.sales.some(importedSale)} onClick={()=>confirm({title:'Clear imported sales',message:`Remove ${data.sales.filter(importedSale).length} imported or older unclassified sales. Explicitly tagged manual sales, inventory, notes and other logs remain. Inventory keeps its sold status; links to the cleared sales are removed. Older records have no origin tag, so review or back them up first.`,word:'CLEAR SALES',run:clearImportedSales})}>Clear imported sales</button>
      <button className="btn" disabled={disabled || busy} onClick={()=>confirm({title:'Reset shop',message:'Clear all sales, inventory, listings, expenses, mileage, time and issues. Keep account access, settings and recovery history.',word:'RESET SHOP',run:resetShop})}>Reset shop data</button></div>
    </div>}
    {confirmation && <div className="card" role="region" aria-label="Confirm data changes"><h3>{confirmation.title}</h3><p>{confirmation.message}</p><Field label={`Type ${confirmation.word} to confirm`}><input value={word} disabled={busy} onChange={e=>setWord(e.target.value)}/></Field><div className="actions"><button className="btn primary" disabled={disabled || busy || word!==confirmation.word} onClick={execute}>{busy?'Saving...':'Confirm data changes'}</button><button className="btn" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel</button></div></div>}
    {error && <p role="alert" className="err">{error}</p>}
  </>;
}
