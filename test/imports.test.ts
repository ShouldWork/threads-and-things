import { describe,it,expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/parse';
import { saleKey,mergeSales } from '../src/lib/imports';
import { prepareRow,validDate } from '../src/lib/records';
import { sale } from './fixtures';
const workbook=(name:string,grid:unknown[][])=>{const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(grid),name);return XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer;};
describe('imports',()=>{
  it('recognizes inventory-only and listings-only trackers',()=>{
    expect(parseWorkbook(workbook('Inventory',[['SKU','Description','Cost paid'],['TT-0001','Shirt',5]])).kind).toBe('tracker');
    expect(parseWorkbook(workbook('Active Listings',[['Category','Description','Current price'],['Tops','Shirt',20]])).kind).toBe('tracker');
  });
  it('recognizes empty tabs but rejects a missing header instead of silently clearing data',()=>{
    expect(parseWorkbook(workbook('Expenses',[['Amount','Date']])).expenses).toEqual([]);
    expect(()=>parseWorkbook(workbook('Expenses',[['Unexpected header'],[10]]))).toThrow('missing');
  });
  it('retains stable transaction IDs',()=>{
    const p=parseWorkbook(workbook('Depop Sales',[['Date of sale','Item price','Description','Sale ID'],['2026-10-01',20,'Shirt','tx-123']]));expect(p.sales?.[0].sourceId).toBe('tx-123');
  });
  it('reads Depop export placeholders: "-" and "N/A" are empty amounts, and "Buyer shipping cost" is shipping',()=>{
    const p=parseWorkbook(workbook('Depop Sales',[
      ['Date of sale','Item price','Description','Buyer shipping cost','Boosting fee','Depop Payments fee','US Sales tax','Refunded to buyer amount','Fees refunded to seller'],
      ['2026-10-01','$5.00','Hoodie','$4.50','-','$0.76','$0.42','N/A','N/A'],
      ['2026-10-01','$1.80','Bundle extra','-','$0.22','-','-','N/A','n/a'],
    ]));
    expect(p.sales?.map(s=>({price:s.price,ship:s.ship,boost:s.boost,payFee:s.payFee,tax:s.tax,refund:s.refund,feeBack:s.feeBack}))).toEqual([
      {price:5,ship:4.5,boost:0,payFee:0.76,tax:0.42,refund:0,feeBack:0},
      {price:1.8,ship:0,boost:0.22,payFee:0,tax:0,refund:0,feeBack:0},
    ]);
  });
  it('rejects malformed spreadsheet amounts instead of silently turning them into zero',()=>{
    expect(()=>parseWorkbook(workbook('Depop Sales',[['Date of sale','Item price','Description'],['2026-10-01','20oops','Shirt']]))).toThrow('Invalid spreadsheet number');
  });
  it('deduplicates within an upload and across imports even after editing',()=>{
    const input=sale();const first=mergeSales([],[input,input]);expect(first.added).toBe(1);expect(first.uncertain).toHaveLength(1);
    expect(mergeSales([],[input,input],{'1':'skip'}).skipped).toBe(1);
    const edited={...first.rows[0],desc:'Edited description',price:25};expect(mergeSales([edited],[input]).added).toBe(0);
  });
  it('distinguishes separate SKUs and description endings',()=>{
    expect(saleKey(sale({sku:'one'}))).not.toBe(saleKey(sale({sku:'two'})));
    const prefix='A'.repeat(40);expect(mergeSales([],[sale({desc:prefix+' one'}),sale({desc:prefix+' two'})]).added).toBe(2);
  });
  it('rejects blank dates, impossible dates, negative and nonfinite numbers',()=>{
    expect(validDate('2026-02-30')).toBe(false);
    for(const price of [-1,NaN,Infinity])expect(()=>prepareRow('sales',sale({price}))).toThrow();
    expect(()=>prepareRow('sales',{...sale(),date:''})).toThrow();
    expect(()=>prepareRow('listings',{posted:'2026-10-01',desc:'Shirt',link:'javascript:alert(1)'})).toThrow();
  });
});
