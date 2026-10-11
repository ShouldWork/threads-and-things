import {describe,it,expect} from 'vitest';
import {saleWrites} from '../src/lib/saleWrites';
import {emptyData,sale,item} from './fixtures';
describe('sale and inventory write plan',()=>{
  it('marks the matched item sold in the same plan as the sale',()=>{
    const data=emptyData();data.inventory=[item({id:'i1'})];const plan=saleWrites(data,'s1',sale({sku:'TT-0001'}));
    expect(plan.sale).not.toBeNull();expect(plan.inventory[0]).toMatchObject({id:'i1',status:'Sold',soldBy:'s1',previousStatus:'Listed'});
  });
  it('restores the old SKU and marks the new SKU when editing',()=>{
    const data=emptyData(),old=sale({id:'s1',sku:'TT-0001'});data.sales=[old];
    data.inventory=[item({id:'i1',status:'Sold',outcome:old.date,soldBy:'s1',previousStatus:'Listed',previousOutcome:''}),item({id:'i2',sku:'TT-0002',status:'Unlisted',listed:''})];
    const plan=saleWrites(data,'s1',{...old,sku:'TT-0002'} ,old);
    expect(plan.inventory[0]).toMatchObject({id:'i1',status:'Listed',outcome:'',soldBy:''});expect(plan.inventory[1]).toMatchObject({id:'i2',status:'Sold',soldBy:'s1'});
  });
  it('restores inventory when a sale is deleted',()=>{
    const data=emptyData(),previous=sale({id:'s1',sku:'TT-0001'});data.sales=[previous];data.inventory=[item({id:'i1',status:'Sold'})];
    const plan=saleWrites(data,'s1',null,previous);expect(plan.sale).toBeNull();expect(plan.inventory[0].status).toBe('Listed');
  });
  it('rejects selling a SKU already used by another sale',()=>{
    const data=emptyData();data.sales=[sale({id:'existing',sku:'TT-0001'})];data.inventory=[item({id:'i1'})];expect(()=>saleWrites(data,'new',sale({sku:'TT-0001'}))).toThrow('another sale');
  });
});
