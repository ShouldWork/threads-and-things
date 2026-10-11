import { describe,it,expect } from 'vitest';
import { prepareRow } from '../src/lib/records';
import { mergeRecords,markManual } from '../src/lib/importRecords';
import { saleWrites } from '../src/lib/saleWrites';
import { locations } from '../src/components/Forms';
import { item,sale,emptyData } from './fixtures';
describe('inventory storage location',()=>{
  it('keeps the location when a record is prepared and leaves it out when absent',()=>{
    expect(prepareRow('inventory',{...item(),location:'Bin 3'}).location).toBe('Bin 3');
    expect('location' in prepareRow('inventory',item())).toBe(false);
    expect(()=>prepareRow('inventory',{...item(),location:5})).toThrow();
  });
  it('suggests each saved spot once, trimmed and sorted',()=>{
    const data=emptyData();data.inventory=[item({location:'Bin 3'}),item({sku:'TT-0002',location:' closet shelf '}),item({sku:'TT-0003',location:'Bin 3'}),item({sku:'TT-0004'})];
    expect(locations(data)).toEqual(['Bin 3','closet shelf']);
  });
  it('a tracker re-import never wipes a location the spreadsheet does not have',()=>{
    const imported=mergeRecords('inventory',[],[item()]).rows[0];
    const placed=markManual('inventory',{...imported,location:'Garage tote'},imported);
    const {rows}=mergeRecords('inventory',[placed],[item({cost:7})]);
    expect(rows[0]).toMatchObject({location:'Garage tote',cost:7});
  });
  it('selling an item keeps where it was stored',()=>{
    const data=emptyData();data.inventory=[{...item({id:'i1'}),location:'Bin 3'}];
    const plan=saleWrites(data,'s1',sale({sku:'TT-0001'}));
    expect(plan.inventory[0]).toMatchObject({status:'Sold',location:'Bin 3'});
  });
});
