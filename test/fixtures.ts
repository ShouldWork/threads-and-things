import { prepareRow, emptyData } from '../src/lib/records';
import type { Sale, Listing, Item } from '../src/types';
export const sale=(input:object={}):Sale=>prepareRow('sales',{date:'2026-10-01',desc:'Blue shirt',price:20,...input}) as unknown as Sale;
export const listing=(input:object={}):Listing=>prepareRow('listings',{posted:'2026-10-01',desc:'Blue shirt',price:20,status:'Active',...input}) as unknown as Listing;
export const item=(input:object={}):Item=>prepareRow('inventory',{sku:'TT-0001',acquired:'2026-09-01',desc:'Blue shirt',cost:5,status:'Listed',listed:'2026-09-02',...input}) as unknown as Item;
export {emptyData};
