import * as XLSX from 'xlsx';
import type { Sale, Listing, Item, Expense, Trip, TimeRow, Issue } from '../types';
import { prepareRow, validDate, type ColName, type Row } from './records';
export { saleKey } from './imports';

export function iso(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,10) : '';
  if (typeof v === 'number') {const d=XLSX.SSF.parse_date_code(v);return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : '';}
  const value=String(v).trim();if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return validDate(value)?value:'';
  const t=Date.parse(value);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):'';
}
export function num(v: unknown) {
  const value=String(v??'').replace(/[$,]/g,'').trim();if(!value)return 0;
  const n=Number(value);if(!Number.isFinite(n))throw new Error(`Invalid spreadsheet number: ${String(v).slice(0,80)}. No data was changed.`);return n;
}
const str=(v:unknown)=>v==null || v==='nan' ? '' : String(v).trim();
const normalized=(v:unknown)=>str(v).toLowerCase().replace(/[_\s]+/g,' ');
function pick(r: Row, keys: string[]) {for(const key of keys){const found=Object.keys(r).find(k=>normalized(k)===normalized(key));if(found!==undefined && r[found]!== '')return r[found];}return '';}
function has(r: Row,keys:string[]){return Object.keys(r).some(k=>keys.some(a=>normalized(k)===normalized(a)));}
function rowsFrom(ws:XLSX.WorkSheet,headers:string[]):Row[]{
  const grid=XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,raw:true,defval:''});
  const h=grid.findIndex(r=>r.some(c=>headers.some(a=>normalized(c)===normalized(a))));
  if(h<0)throw new Error(`The spreadsheet is missing its "${headers[0]}" header. No data was changed.`);
  const head=grid[h].map(str);
  return grid.slice(h+1).filter(r=>r.some(c=>c!=='' && c!=null)).map(r=>{const o:Row=Object.create(null);head.forEach((k,i)=>{if(k&&!['__proto__','constructor','prototype'].includes(k))o[k]=r[i];});return o;});
}
const fields:Record<ColName,Record<string,string[]>>={
  sales:{date:['Date of sale','Sale date','Date sold','date'],listed:['Date listed','Date of listing','listed'],brand:['Brand'],cat:['Category','cat'],size:['Size'],desc:['Description','Item description','desc'],state:['State'],sku:['SKU'],platform:['Platform'],buyer:['Buyer','Buyer username'],price:['Item price','Sale price','price'],ship:['Buyer shipping','Shipping price','ship'],depopFee:['Depop fee','Depop selling fee','depopFee'],payFee:['Payment fee','Depop Payments fee','payFee'],boost:['Boost fee','Boosting fee','boost'],usps:['USPS cost','Label cost','usps'],refund:['Refund','Refunded to buyer amount'],feeBack:['Fees refunded','Fees refunded to seller','feeBack'],cogs:['Item cost (from Inventory)','Item cost (COGS)','cogs'],tax:['Sales tax collected','US Sales tax','tax'],sourceId:['Sale ID','Transaction ID','sourceId'],productId:['Product ID','Item ID','Listing ID','productId'],orderId:['Order ID','orderId']},
  inventory:{sku:['SKU'],acquired:['Date acquired','acquired'],source:['Source'],cost:['Cost paid','cost'],cat:['Category','cat'],size:['Size'],brand:['Brand'],desc:['Description','desc'],platform:['Listed on','Platform'],listed:['Date listed','listed'],status:['Status'],outcome:['Outcome date','outcome'],notes:['Notes']},
  listings:{cat:['Category','cat'],size:['Size'],desc:['Description','desc'],orig:['Original price','orig'],price:['Current price','price'],posted:['Posted date (est.)','Date','posted'],exact:['Date confidence'],boosted:['Boosted'],link:['Link'],status:['Status'],productId:['Product ID','Item ID','productId']},
  expenses:{date:['Date'],cat:['Category','cat'],vendor:['Vendor'],desc:['Description','desc'],amount:['Amount'],paidWith:['Paid with','paidWith'],receipt:['Receipt saved?','receipt'],notes:['Notes']},
  mileage:{date:['Date'],purpose:['Purpose (post office, sourcing, supplies)','Purpose'],miles:['Miles']},
  time:{date:['Date'],activity:['Activity'],minutes:['Minutes'],notes:['Notes']},
  issues:{date:['Date'],sku:['SKU'],platform:['Platform'],type:['Issue type','type'],lost:['Amount lost','lost'],resolved:['Resolved?','resolved'],what:['What happened','what'],next:['What to do differently','next']},
};
const numeric=new Set(['price','ship','depopFee','payFee','boost','usps','refund','feeBack','cogs','tax','cost','amount','miles','minutes','lost','orig']);
const dates=new Set(['date','listed','acquired','outcome','posted']);
function parseRow(c:ColName,r:Row,shopStart:string):Row {
  const row:Row={};
  for(const [key,aliases] of Object.entries(fields[c])){
    const value=pick(r,aliases);
    row[key]=numeric.has(key)?(key==='orig'&&value===''?null:num(value)):dates.has(key)?iso(value):['boosted','receipt','resolved'].includes(key)?/^(yes|true|1)$/i.test(str(value)):key==='exact'?str(value)!=='Estimated':str(value);
  }
  if(c==='sales'){row.platform ||= 'Depop';if(!row.sourceId && row.orderId && (row.productId || row.sku))row.sourceId=`order:${row.orderId}|item:${row.productId || row.sku}`;}
  if(c==='inventory')row.status ||= 'Unlisted';
  if(c==='listings'){row.status ||= 'Active';row.posted ||= shopStart;}
  if(c==='time')row.activity ||= 'Other';
  if(c==='issues')row.type ||= 'Other';
  if(c==='mileage'&&!has(r,fields.mileage.miles)){row.miles=num(pick(r,['End']))-num(pick(r,['Start']));}
  const clean=prepareRow(c,row,true);
  clean.sourceData=JSON.stringify(Object.fromEntries(Object.keys(fields[c]).filter(k=>has(r,fields[c][k]) && !['sourceId','productId','orderId'].includes(k)).map(k=>[k,clean[k]])));
  if(c==='mileage'&&!has(r,fields.mileage.miles))clean.sourceData=JSON.stringify({...JSON.parse(clean.sourceData as string),miles:clean.miles});
  return clean;
}
export type Parsed={sales?:Sale[];listings?:Listing[];inventory?:Item[];expenses?:Expense[];mileage?:Trip[];time?:TimeRow[];issues?:Issue[];snapshot?:string;taxPct?:number;mileageRate?:number;kind:'tracker'|'depop'};
export function parseWorkbook(buf:ArrayBuffer,shopStart='2026-08-01'):Parsed{
  const wb=XLSX.read(buf,{type:'array',cellDates:true}),find=(re:RegExp)=>wb.SheetNames.find(n=>re.test(n));
  const out:Parsed={kind:wb.SheetNames.some(n=>/^(inventory|expenses|mileage|time log|issues|dashboard|active listings)$/i.test(n))?'tracker':'depop'};
  const sales=find(/^sales$/i)||find(/depop sales/i)||(out.kind==='depop'&&wb.SheetNames.length===1?wb.SheetNames[0]:undefined);
  if(sales)out.sales=rowsFrom(wb.Sheets[sales],fields.sales.date).map(r=>parseRow('sales',r,shopStart)) as unknown as Sale[];
  const tabs:[Exclude<ColName,'sales'>,RegExp,string[]][]=[['inventory',/^inventory$/i,['SKU']],['listings',/active listings/i,['Category']],['expenses',/^expenses$/i,['Amount']],['mileage',/^mileage$/i,['Start','Miles']],['time',/^time log$/i,['Minutes']],['issues',/^issues$/i,['Issue type']]];
  for(const [c,re,headers] of tabs){
    const name=find(re);if(!name)continue;
    const rows=rowsFrom(wb.Sheets[name],headers).filter(r=>c==='inventory'?str(pick(r,['SKU']))&&!/example row/i.test(str(pick(r,['Description']))):c==='listings'?str(pick(r,['Description'])):true).map(r=>parseRow(c,r,shopStart)).filter(r=>!['expenses','mileage','time'].includes(c)||Number(r[c==='expenses'?'amount':c==='mileage'?'miles':'minutes'])!==0);
    Object.assign(out,{[c]:rows});
    if(c==='listings'){const snap=iso(wb.Sheets[name].B1?.v);if(snap)out.snapshot=snap;}
    if(c==='mileage'){const raw=wb.Sheets[name].D1?.v;const rate=typeof raw==='number'||/^\$?\d+(\.\d+)?$/.test(str(raw))?num(raw):0;if(rate)out.mileageRate=rate;}
  }
  const dash=find(/^dashboard$/i);if(dash){const v=num(wb.Sheets[dash].B29?.v);if(v>0&&v<1)out.taxPct=v;}
  if(!['sales','listings','inventory','expenses','mileage','time','issues'].some(k=>k in out))throw new Error('No supported tracker tab or Depop sales export was found.');
  return out;
}
