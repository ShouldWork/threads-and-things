import {describe,it,expect} from 'vitest';
import * as XLSX from 'xlsx';
import {sale,item,listing,emptyData} from './fixtures';
import {mergeSales,duplicateSaleGroups,consolidateSaleRows} from '../src/lib/imports';
import {mergeRecords,markManual,reconcileInventory,withoutImportedSales} from '../src/lib/importRecords';
import {finalizedImport,readBackup} from '../src/lib/importPlan';
import {parseWorkbook} from '../src/lib/parse';
const sourced=<T extends object>(row:T,keys:string[])=>({...row,sourceData:JSON.stringify(Object.fromEntries(keys.map(k=>[k,(row as Record<string,unknown>)[k]])))});
function workbook(name:string,grid:unknown[][]){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(grid),name);return XLSX.write(wb,{type:'array',bookType:'xlsx'}) as ArrayBuffer;}
describe('sales import updates',()=>{
  it('updates fees and refunds under a native ID without duplicating the sale or erasing absent costs',()=>{
    const original=mergeSales([],[sourced(sale({sourceId:'tx-1',cogs:5}),['date','desc','price','payFee','refund','cogs'])]).rows[0];
    const result=mergeSales([original],[sourced(sale({sourceId:'tx-1',price:25,payFee:1.5,refund:3}),['date','desc','price','payFee','refund'])]);
    expect(result.rows).toHaveLength(1);expect(result.updated).toBe(1);expect(result.rows[0]).toMatchObject({id:original.id,price:25,payFee:1.5,refund:3,cogs:5});
  });
  it('preserves manual corrections while retaining the newest imported values',()=>{
    const original=mergeSales([],[sale({sourceId:'tx-1',price:20})]).rows[0];
    const edited=markManual('sales',{...original,price:22,desc:'My correction'},original) as unknown as typeof original;
    const result=mergeSales([edited],[sale({sourceId:'tx-1',price:30,payFee:2})]);
    expect(result.rows[0]).toMatchObject({price:22,desc:'My correction',payFee:2});expect(JSON.parse(result.rows[0].sourceData!).price).toBe(30);
  });
  it('pairs a one-to-one legacy match automatically when the CSV only omits details, keeping them',()=>{
    const existing=sale({id:'saved',sku:'TT-1',brand:'Acme',listed:'2026-09-01'}),csv=sale();
    const confirmed=mergeSales([existing],[csv]);expect(confirmed.uncertain).toEqual([]);expect(confirmed.added).toBe(0);
    expect(confirmed.rows).toHaveLength(1);expect(confirmed.rows[0]).toMatchObject({id:'saved',sku:'TT-1',brand:'Acme'});
    const repeated=mergeSales(confirmed.rows,[csv]);expect(repeated.uncertain).toEqual([]);expect(repeated.added).toBe(0);
  });
  it('learns a newly supplied native ID without changing the saved record ID',()=>{
    const old=sale({id:'legacy'}),csv=sale({sourceId:'new-native-id'});
    const matched=mergeSales([old],[csv]);expect(matched.uncertain).toEqual([]);
    expect(matched.rows[0]).toMatchObject({id:'legacy',sourceId:'new-native-id'});expect(mergeSales(matched.rows,[{...csv,refund:4}]).updated).toBe(1);
  });
  it('requires review for existing duplicates and for identical rows without IDs',()=>{
    const rows=[sale({id:'a'}),sale({id:'b'})];expect(mergeSales(rows,[sale()]).uncertain[0].candidates).toHaveLength(2);
    const result=mergeSales([],[sale(),sale()]);expect(result.added).toBe(1);expect(result.uncertain).toHaveLength(1);
    expect(mergeSales([],[sale(),sale()],{'1':'new'}).rows).toHaveLength(2);
  });
  it('keeps distinct native transactions and product lines separate',()=>{
    const rows=[sale({sourceId:'one',id:'a'}),sale({sourceId:'two',id:'b'})];expect(duplicateSaleGroups(rows)).toEqual([]);
    expect(mergeSales([],[sale({sourceId:'order',productId:'item1'}),sale({sourceId:'order',productId:'item2'})]).added).toBe(2);
  });
  it('remembers a confirmed native match when later exports omit the product ID',()=>{
    const old=sale({id:'old',sourceId:'tx-1',productId:'product-1'}),csv=sale({sourceId:'tx-1'});
    expect(mergeSales([old],[csv]).uncertain).toHaveLength(1);const matched=mergeSales([old],[csv],{'0':'old'});
    expect(mergeSales(matched.rows,[csv]).uncertain).toHaveLength(0);expect(mergeSales(matched.rows,[csv]).rows).toHaveLength(1);
  });
  it('consolidates duplicates while keeping the chosen financial values and unambiguous local identity',()=>{
    const old=sale({id:'old',sourceId:'tx-1',sku:'TT-1',price:25}),keeper=sale({id:'keep',price:20,cogs:7});
    const rows=consolidateSaleRows([old,keeper],['old','keep'],'keep');expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({id:'keep',sourceId:'tx-1',sku:'TT-1',price:20,cogs:7});
    expect(mergeSales(rows,[old]).added).toBe(0);
  });
});
describe('inventory, source masks and backups',()=>{
  it('preserves legacy notes and cost through repeated SKU imports',()=>{
    const old=item({id:'i1',notes:'Keep this note',cost:9});const upload=item({notes:'Spreadsheet note',cost:2});
    const first=mergeRecords('inventory',[old],[upload]);const second=mergeRecords('inventory',first.rows,[upload]);
    expect(second.rows).toHaveLength(1);expect(second.rows[0]).toMatchObject({id:'i1',notes:'Keep this note',cost:9});
  });
  it('updates source-owned inventory values while protecting later app edits and missing rows',()=>{
    const initial=mergeRecords('inventory',[],[item()]).rows[0],other=item({id:'manual',sku:'TT-OTHER'});
    const edited=markManual('inventory',{...initial,notes:'App note',cost:7},initial);
    const result=mergeRecords('inventory',[edited,other],[item({brand:'New source brand',cost:1,notes:'Old source note'})]);
    expect(result.rows).toHaveLength(2);expect(result.rows[0]).toMatchObject({id:initial.id,notes:'App note',cost:7,brand:'New source brand'});expect(result.rows[1]).toEqual(other);
  });
  it('accepts a partial inventory update without clearing its acquisition date',()=>{
    const old=item({id:'i1'});const incoming=sourced({...item(),acquired:'',brand:'Updated brand'},['sku','brand']);
    const result=mergeRecords('inventory',[old],[incoming]);expect(result.rows[0]).toMatchObject({id:'i1',acquired:'2026-09-01'});
  });
  it('handles CSV aliases and omits absent columns from the source update',()=>{
    const parsed=parseWorkbook(workbook('Sales',[['sale date','item price','description','transaction id'],['2026-10-01',25,'Blue shirt','tx-1']]));
    expect(parsed.sales![0]).toMatchObject({sourceId:'tx-1',price:25});expect(JSON.parse(parsed.sales![0].sourceData!)).not.toHaveProperty('cogs');
  });
  it('combines order and product identifiers for multi-item orders',()=>{
    const parsed=parseWorkbook(workbook('Sales',[['Date of sale','Item price','Description','Order ID','Product ID'],['2026-10-01',20,'A','order-1','product-1'],['2026-10-01',30,'B','order-1','product-2']]));
    expect(mergeSales([],parsed.sales!).added).toBe(2);expect(parsed.sales![0].sourceId).not.toBe(parsed.sales![1].sourceId);
  });
  it('does not reset known listing dates with estimates and preserves absent listings',()=>{
    const old=listing({id:'old',link:'https://www.depop.com/products/one/',posted:'2026-08-01'}),other=listing({id:'other',link:'https://www.depop.com/products/two/'});
    const incoming=sourced(listing({link:old.link,posted:'2026-10-01',exact:false,price:15}),['link','price','desc','status']);
    const result=mergeRecords('listings',[old,other],[incoming]);expect(result.rows[0]).toMatchObject({id:'old',price:15,posted:'2026-08-01'});expect(result.rows).toHaveLength(2);
  });
  it('links imported sales by SKU, fills missing item costs and restores links after clearing',()=>{
    const data=emptyData();data.inventory=[item({id:'i1'})];data.sales=mergeSales([],[sourced(sale({sku:'TT-0001'}),['date','desc','price','sku'])]).rows;
    const linked=reconcileInventory(data);expect(linked.sales[0].cogs).toBe(5);expect(linked.inventory[0]).toMatchObject({status:'Sold',outcome:'2026-10-01'});
    const cleared=reconcileInventory({...linked,sales:[]});expect(cleared.inventory[0]).toMatchObject({status:'Listed',outcome:''});
  });
  it('clears imported financial history without making physically sold inventory available again',()=>{
    const data=emptyData();data.sales=[sale({id:'s1',sku:'TT-0001',origin:'import'})];data.inventory=[item({id:'i1'})];
    const cleared=withoutImportedSales(reconcileInventory(data));expect(cleared.sales).toEqual([]);expect(cleared.inventory[0]).toMatchObject({status:'Sold',outcome:'2026-10-01',soldBy:''});
  });
  it('blocks unresolved matches before an import can publish',()=>{
    const data=emptyData();data.sales=[sale({id:'old',sku:'TT-1'})];expect(()=>finalizedImport(data,{sales:[sale({sku:'TT-2'})]})).toThrow('uncertain');
  });
  it('a placeholder SKU (N/A on every row) does not make same-day sales look like each other',()=>{
    const saved=[sale({id:'a',desc:'Pink hoodie',sku:'N/A',price:5}),sale({id:'b',desc:'Kids mittens',sku:'N/A',price:2})];
    const csv=[sale({desc:'Pink hoodie',sku:'N/A',price:5,ship:4.5}),sale({desc:'Kids mittens',sku:'N/A',price:2,ship:3})];
    const r=mergeSales(saved,csv);
    expect(r.uncertain).toEqual([]);expect(r.added).toBe(0);expect(r.rows.map(s=>[s.id,s.ship])).toEqual([['a',4.5],['b',3]]);
    const again=mergeSales(r.rows,csv);expect(again).toMatchObject({added:0,updated:0,unchanged:2});
  });
  it('still asks when a legacy sale and the CSV row disagree, differ in price, or could be one of two rows',()=>{
    const saved=sale({id:'old',sku:'TT-1'});
    expect(mergeSales([saved],[sale({sku:'TT-2'})]).uncertain).toHaveLength(1);
    expect(mergeSales([saved],[sale({price:99})]).uncertain).toHaveLength(1);
    expect(mergeSales([saved],[sale(),sale()]).uncertain.length).toBeGreaterThan(0);
    expect(mergeSales([saved],[sale({sku:'N/A'})]).uncertain).toEqual([]);
  });
  it('round-trips IDs, notes and protected fields in a full backup and rejects duplicate IDs',()=>{
    const data=emptyData();data.inventory=[markManual('inventory',item({id:'i1',notes:'My note'})) as unknown as typeof data.inventory[0]];
    const restored=readBackup(JSON.parse(JSON.stringify({format:'threads-and-things',version:1,data})));expect(restored.inventory).toEqual(data.inventory);
    expect(()=>readBackup({format:'threads-and-things',version:1,data:{...data,inventory:[...data.inventory,...data.inventory]}})).toThrow('repeated');
  });
});
