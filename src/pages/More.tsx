import { useEffect, useMemo, useState } from 'react';
import type { Data, Settings } from '../types';
import { importData, saveSettings, currentShop, newRecordId, type ImportChanges, type HistoryEntry } from '../hooks/useData';
import { logout } from '../firebase';
import { money, today } from '../lib/calc';
import { COLS, prepareRow, type ColName, type Row } from '../lib/records';
import { previewImport } from '../lib/importPlan';
import DataTools from '../components/DataTools';
import { Chips, Field, FileButton, I } from '../components/ui';
import { recordKey } from '../lib/importRecords';
import { isActiveListing } from '../lib/listingLinks';
import { savedTheme, setTheme, type Theme } from '../lib/theme';
import type { Kind } from '../components/Forms';

type Props = { data: Data; email: string; pending: boolean; history:HistoryEntry[];version:string;revision:number;role:string; toast: (s:string)=>void; onEdit: (kind:Kind,row:Row)=>void };
export default function More({data,email,pending,history,version,revision,role,toast,onEdit}: Props) {
  const [busy,setBusy]=useState(''), [err,setErr]=useState('');
  const [theme,setThemeState]=useState<Theme>(savedTheme);
  // retireCandidates: active listings (from an earlier listings import) that are missing from this saved page.
  const [proposal,setProposal]=useState<{name:string; changes:ImportChanges;suggestedSettings?:Partial<Settings>;retireCandidates?:string[]}|null>(null);
  const [name,setName]=useState(data.settings.name), [taxPct,setTaxPct]=useState(data.settings.taxPct*100), [rate,setRate]=useState(data.settings.mileageRate);
  const [recordKind,setRecordKind]=useState<ColName>('expenses');
  const [decisions,setDecisions]=useState<Record<string,string>>({});
  useEffect(()=>{setName(data.settings.name);setTaxPct(data.settings.taxPct*100);setRate(data.settings.mileageRate);},[data.settings]);
  async function readFile(file:File|undefined,kind:'depop'|'tracker'|'html') {
    if(!file || busy) return;
    setErr('');setProposal(null);setDecisions({});setBusy('Reading file…');
    try {
      if(file.size > 20*1024*1024) throw new Error('Choose a file smaller than 20 MB.');
      let changes:ImportChanges;
      let suggestedSettings:Partial<Settings>|undefined;
      let retireCandidates:string[]|undefined;
      if(kind === 'html') {
        const {parseDepopListingsHtml}=await import('../lib/depopHtml');
        const rows=parseDepopListingsHtml(await file.text(),data.settings.shopStart);
        if(!rows.length) throw new Error('No listings found. Save the complete Selling hub Active page after loading all listings.');
        changes={merge:{listings:rows},settings:{snapshot:today()}};
        const onPage=new Set(rows.map(r=>recordKey('listings',r)));
        retireCandidates=data.listings.filter(l=>l.id && isActiveListing(l) && !l.soldBy && (l.link || l.productId) && !onPage.has(recordKey('listings',l))).map(l=>l.id!);
      } else {
        const {parseWorkbook}=await import('../lib/parse');
        const parsed=parseWorkbook(await file.arrayBuffer(),data.settings.shopStart);
        if(kind === 'depop' && parsed.kind === 'tracker') throw new Error('Use the tracker importer for this workbook.');
        changes={sales:parsed.sales,merge:{},settings:{}};
        if(kind === 'tracker') {
          for(const c of COLS) if(c!=='sales' && parsed[c] !== undefined) changes.merge![c]=parsed[c];
          const settings:Partial<Settings>={};
          if(parsed.snapshot)settings.snapshot=parsed.snapshot;
          suggestedSettings={};
          if(parsed.taxPct !== undefined)suggestedSettings.taxPct=parsed.taxPct;
          if(parsed.mileageRate !== undefined)suggestedSettings.mileageRate=parsed.mileageRate;
          changes.settings=settings;
        }
      }
      changes.sales?.forEach((row,i)=>{try{prepareRow('sales',row);}catch(e){throw new Error(`Sales row ${i+1}: ${(e as Error).message}`);}});
      for(const [c,rows] of Object.entries(changes.merge || {})) rows!.forEach((row,i)=>{try{prepareRow(c as ColName,row,true);}catch(e){throw new Error(`${c} row ${i+1}: ${(e as Error).message}`);}});
      if(!changes.sales?.length && !Object.keys(changes.merge || {}).length)throw new Error('This file contains no records to import.');
      changes.sales=changes.sales?.map(s=>({...s,id:newRecordId()}));changes.label=file.name;
      setProposal({name:file.name,changes,suggestedSettings,retireCandidates});
    } catch(e){setErr((e as Error).message);} finally {setBusy('');}
  }
  async function applyImport(){
    if(!proposal || busy)return;
    setErr('');setBusy('Saving and verifying the import…');
    try{const result=await importData({...proposal.changes,decisions});toast(`Imported: ${result.added} new, ${result.updated} updated, ${result.unchanged} unchanged.`);setProposal(null);}
    catch(e){setErr((e as Error).message);}finally{setBusy('');}
  }
  function exportCsv(){
    const columns=['date','listed','platform','sku','brand','cat','size','desc','price','ship','depopFee','payFee','boost','usps','refund','feeBack','cogs','tax','state','buyer','sourceId'];
    const esc=(v:unknown)=>{let value=String(v??'');if(/^\s*[=+@-]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};
    const csv=[columns.join(','),...data.sales.map(s=>columns.map(c=>esc((s as unknown as Row)[c])).join(','))].join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})); const a=document.createElement('a');a.href=url;a.download=`threads-and-things-sales-${today()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  const chooser=(label:string,accept:string,kind:'depop'|'tracker'|'html')=><FileButton label={label} accept={accept} disabled={!!busy} onFile={f=>void readFile(f,kind)}/>;
  const records=data[recordKind] as unknown as Row[];
  const kinds:Partial<Record<ColName,Kind>>={expenses:'expense',mileage:'trip',time:'time',issues:'issue'};
  const reviewed=useMemo(()=>{try{return{plan:proposal?previewImport(data,{...proposal.changes,decisions}):null,error:''};}catch(e){return{plan:null,error:(e as Error).message};}},[data,proposal,decisions]);
  const merged=reviewed.plan;
  return <>
    <h1>More</h1><p className="sub">Imports, settings and your account.</p>
    <div className="card"><h3>Import a Depop sales export</h3><p>Update matching sales and add new ones after you review the file.</p>{chooser('Choose export file','.xlsx,.xls,.csv','depop')}</div>
    <div className="card"><h3>Import your Depop listings page</h3><p>Load every listing in Selling hub › Active, then save the page as “Webpage, Complete”.</p>{chooser('Choose saved page','.html,.htm','html')}</div>
    <div className="card"><h3>Import the tracker spreadsheet</h3><p>Update matching records and add new ones. Inventory is matched by SKU. Notes, protected edits and records missing from the file stay saved.</p>{chooser('Choose tracker .xlsx','.xlsx','tracker')}</div>
    {proposal && <div className="card" role="region" aria-label="Review import"><h3>Review {proposal.name}</h3>
      <p>{merged?.added || 0} new; {merged?.updated || 0} updated; {merged?.unchanged || 0} unchanged; {merged?.skipped || 0} skipped.</p>
      <ul>{Object.entries(merged?.collections || {}).map(([c,counts])=><li key={c}>{c}: {counts!.added} new, {counts!.updated} updated, {counts!.unchanged} unchanged.</li>)}</ul>
      {!!merged?.listingsToMarkSold && <p className="note linknote">{I.tag} {merged.listingsToMarkSold} {merged.listingsToMarkSold===1?'listing matches a sale in this file and will be':'listings match sales in this file and will be'} marked sold. You'll find them under Closet › Sold, with their bins.</p>}
      {!!proposal.retireCandidates?.length && <label className="retire"><input type="checkbox" checked={!!proposal.changes.retireListings?.length} onChange={e=>{const on=e.target.checked;setProposal(p=>p?{...p,changes:{...p.changes,retireListings:on?p.retireCandidates:undefined}}:p);}}/> <span><b>{proposal.retireCandidates.length} {proposal.retireCandidates.length===1?'listing is':'listings are'} no longer on this page. Mark {proposal.retireCandidates.length===1?'it':'them'} removed?</b><br/><span className="note">Only if you scrolled to load every listing before saving the page; otherwise some may still be on Depop. Removed listings move to Closet › Removed and can be set back to Active.</span></span></label>}
      {reviewed.error && <p role="alert" className="err">{reviewed.error}</p>}
      {merged?.uncertain.map(match=><div key={match.index}><p><b>Review sales row {match.index+1}: {match.sale.desc}</b><br/>{match.sale.date} · {money(match.sale.price)}<br/>{match.reason}</p><Field label={`Match for sales row ${match.index+1}`}><select value={decisions[match.index] || ''} onChange={e=>setDecisions(d=>({...d,[match.index]:e.target.value}))}><option value="">Choose what to do...</option>{match.candidates.map(s=><option key={s.id} value={s.id}>Update {s.desc} · {s.date} · {money(s.price)} · SKU {s.sku || 'none'}</option>)}<option value="new">Add as a separate sale</option><option value="skip">Skip this row</option></select></Field></div>)}
      {Object.entries(decisions).filter(([,choice])=>choice).map(([index,choice])=><p className="note" key={index}>Reviewed sales row {Number(index)+1}: {choice==='new'?'add a separate sale':choice==='skip'?'skip this row':`update ${data.sales.find(s=>s.id===choice)?.desc || proposal.changes.sales?.find(s=>s.id===choice)?.desc || 'the chosen sale'}`}. <button className="btn small" onClick={()=>setDecisions(d=>{const next={...d};delete next[index];return next;})}>Review again</button></p>)}
      <p className="note">Protected app edits keep their current values. Open a record and choose “Use latest imported values” to release that protection.</p>
      {Object.entries(proposal.suggestedSettings || {}).map(([key,value])=><label key={key} style={{display:'block'}}><input type="checkbox" checked={proposal.changes.settings?.[key as keyof Settings]===value} onChange={e=>{const checked=e.target.checked;setProposal(p=>{if(!p)return p;const settings={...p.changes.settings};if(checked)Object.assign(settings,{[key]:value});else delete settings[key as keyof Settings];return{...p,changes:{...p.changes,settings}};});}}/> Apply tracker {key==='taxPct'?`tax set-aside (${Number(value)*100}%)`:`mileage rate (${money(Number(value))}/mile)`}</label>)}
      {!!merged?.uncertain.length && proposal.changes.sales?.some(s=>!s.sourceId) && <p className="note">Some rows have no transaction ID. Possible matches require your review; identical transactions without IDs cannot be distinguished automatically.</p>}
      <p className="note">Your current data stays available if saving fails. Imports require an internet connection and all pending changes to finish syncing.</p>
      <div className="actions"><button className="btn primary" disabled={!!busy || pending || !navigator.onLine || !merged || !!merged.uncertain.length} onClick={applyImport}>Import these changes</button><button className="btn" disabled={!!busy} onClick={()=>setProposal(null)}>Cancel import</button></div>
    </div>}
    {busy && <p role="status">{busy}</p>}{err && <p role="alert" className="err">{err}</p>}
    <div className="card"><h3>Settings</h3><form className="form" onSubmit={async e=>{
      e.preventDefault();if(busy)return;setBusy('Saving settings…');setErr('');
      try{const result=await saveSettings({name,taxPct:taxPct/100,mileageRate:rate});toast(result.queued?'Settings saved on this device; will sync.':'Settings saved.');}catch(e){setErr((e as Error).message);}finally{setBusy('');}
    }}>
      <Field label="Your first name"><input required value={name} onChange={e=>setName(e.target.value)}/></Field>
      <div className="grid2"><Field label="Tax set-aside %"><input type="number" min={0} max={60} step="0.1" required value={taxPct} onChange={e=>setTaxPct(e.target.valueAsNumber)}/></Field><Field label="Mileage rate $/mile"><input type="number" min={0} max={100} step="0.01" required value={rate} onChange={e=>setRate(e.target.valueAsNumber)}/></Field></div>
      <p className="note">Listings last imported: {data.settings.snapshot}. Listing ages advance through today.</p><button className="btn primary" disabled={!!busy}>Save settings</button>
    </form></div>
    <div className="card"><h3>Appearance</h3>
      <Chips value={theme} onChange={t=>{setThemeState(t);setTheme(t);}} label="Appearance" options={[['auto','Match phone'],['light','Light'],['dark','Dark']]}/>
      <p className="note" style={{margin:'6px 0 0'}}>Saved on this phone only.</p>
    </div>
    <div className="card"><h3>Manage your logs</h3>
      <select aria-label="Log to edit" value={recordKind} onChange={e=>setRecordKind(e.target.value as ColName)}>{['expenses','mileage','time','issues'].map(c=><option key={c} value={c}>{c}</option>)}</select>
      {!records.length && <p className="note">No records yet. Add one with +.</p>}
      {records.map(row=><button className="rowbtn" key={row.id} onClick={()=>onEdit(kinds[recordKind]!,row)}><div className="row"><span>{String(row.date || 'No date')} · {String(row.desc || row.purpose || row.activity || row.what || row.type || recordKind)}</span><span>{row.amount!==undefined?money(Number(row.amount)):row.miles!==undefined?`${row.miles} mi`:row.minutes!==undefined?`${row.minutes} min`:money(Number(row.lost || 0))}</span></div></button>)}
    </div>
    <div className="card"><h3>Your data</h3><table><tbody>{COLS.map(c=><tr key={c}><td>{c}</td><td>{data[c].length}</td></tr>)}</tbody></table><div className="actions"><button className="btn" onClick={exportCsv}>Download sales as CSV</button></div></div>
    <DataTools data={data} history={history} version={version} revision={revision} canReset={role==='owner'} disabled={!!busy || pending || !navigator.onLine} toast={toast} onBusy={b=>setBusy(b?'Saving data changes...':'')}/>
    <div className="card"><h3>Account</h3><p>Signed in as {email}. Shop: <b>{currentShop()}</b>.</p><p className="note">{pending?'Changes on this device are waiting to sync. Reconnect before signing out.':'All local changes have synced.'} Only use this app on a trusted device; offline records remain in this browser.</p><button className="btn" disabled={pending || !!busy} onClick={()=>logout().catch(e=>setErr(e.message))}>Sign out</button></div>
  </>;
}
