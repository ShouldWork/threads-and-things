import { describe,it,expect } from 'vitest';
import { dashboard,inRange } from '../src/lib/dashboard';
import { emptyData,sale } from './fixtures';
describe('dashboard windows',()=>{
  it('excludes a stale sale while retaining recent costs during a quiet month',()=>{
    const data=emptyData();data.sales=[sale({date:'2026-08-15'})];data.expenses=[{id:'e',date:'2026-10-01',amount:5,cat:'Other',vendor:'',desc:'',paidWith:'',receipt:false,notes:''}];
    const result=dashboard(data,'30','2026-10-10');expect(result.sales).toHaveLength(0);expect(result.profit).toBe(-5);
  });
  it('includes costs before the first sale and excludes future dates',()=>{
    const data=emptyData();data.sales=[sale({date:'2026-10-10'}),sale({date:'2026-10-11'})];
    data.mileage=[{date:'2026-09-11',purpose:'Sourcing',miles:10},{date:'2026-10-11',purpose:'Future',miles:100}];
    data.time=[{date:'2026-10-02',activity:'Listing',minutes:60,notes:''},{date:'2026-08-01',activity:'Listing',minutes:600,notes:''}];
    const result=dashboard(data,'30','2026-10-10');expect(result.sales).toHaveLength(1);expect(result.miles).toBe(7);expect(result.hours).toBe(1);
  });
  it('uses inclusive calendar boundaries and counts undated costs only in all time',()=>{
    expect(inRange('2026-09-11','30','2026-10-10')).toBe(true);expect(inRange('2026-09-10','30','2026-10-10')).toBe(false);expect(inRange('','30','2026-10-10')).toBe(false);expect(inRange('','all','2026-10-10')).toBe(true);
  });
});
