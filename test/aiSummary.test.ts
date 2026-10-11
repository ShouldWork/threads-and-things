import { describe,it,expect } from 'vitest';
import { shopSummary } from '../src/lib/aiSummary';
import { formatAnswer } from '../src/components/Ask';
import { dashboard } from '../src/lib/dashboard';
import { sale,listing,item,emptyData } from './fixtures';
const shop=()=>{const d=emptyData();
  d.sales=[sale({id:'s1',date:'2026-10-05',listed:'2026-10-01',cat:'Tops',price:20,buyer:'Jane Buyer',state:'TX',orderId:'ORD-9'}),sale({id:'s2',date:'2026-09-02',cat:'Bottoms',price:30,buyer:'Sam Smith',state:'OR'})];
  d.listings=[listing({id:'l1',posted:'2026-09-01',cat:'Tops',price:15,desc:'Old lace top\nsecond line',link:'https://www.depop.com/products/x'}),listing({id:'l2',posted:'2026-10-08',cat:'Bottoms',price:25})];
  d.inventory=[{...item({id:'i1',status:'Unlisted'}),location:'Bin 3'},item({id:'i2',sku:'TT-0002',status:'Sold'})];
  return d;};
describe('AI shop summary',()=>{
  it('never includes buyer names, buyer states, order IDs or links',()=>{
    const text=JSON.stringify(shopSummary(shop(),'2026-10-10'));
    for(const secret of ['Jane Buyer','Sam Smith','"TX"','"OR"','ORD-9','depop.com','buyer','"state"'])expect(text).not.toContain(secret);
  });
  it('uses the same totals as the dashboard',()=>{
    const d=shop(),s=shopSummary(d,'2026-10-10'),dash=dashboard(d,'all','2026-10-10');
    expect(s.allTime.itemsSold).toBe(dash.sales.length);expect(s.allTime.grossSales).toBe(50);expect(s.allTime.netProfit).toBe(Math.round(dash.profit*100)/100);
    expect(s.last7Days.itemsSold).toBe(1);
  });
  it('reports listing age, category sell-through and storage spots',()=>{
    const s=shopSummary(shop(),'2026-10-10');
    expect(s.activeListings).toMatchObject({count:2,sitting21PlusDays:1,newThisWeek:1});
    expect(s.activeListings.oldestFive[0]).toMatchObject({title:'Old lace top',daysListed:39});
    expect(s.byCategory.find(c=>c.category==='Tops')).toMatchObject({sold:1,stillListed:1,sellThrough:0.5,medianDaysToSell:4});
    expect(s.inventory).toMatchObject({itemsOnHand:1,notListedYet:1,byStorageSpot:{'Bin 3':1}});
    expect(s.longestListed).toMatchObject({fullDescription:'Old lace top\nsecond line',daysListed:39,price:15});
  });
});
describe('AI answer formatting',()=>{
  it('renders bullets and bold as elements and strips dashes and headings',()=>{
    const nodes=formatAnswer('## Nice month\nYou sold **12** items — great.\n- List more tops\n- Refresh old ones');
    expect(nodes).toHaveLength(3);
    const html=JSON.stringify(nodes);expect(html).not.toContain('—');expect(html).not.toContain('##');expect(html).toContain('List more tops');
  });
  it('keeps the first hashtag and bolds short label lines',()=>{
    const html=JSON.stringify(formatAnswer('Suggested Title:\nNWT Liz Claiborne Jeans\n#lizclaiborne #creamjeans'));
    expect(html).toContain('#lizclaiborne #creamjeans');expect(html).toContain('ans-label');
  });
});
