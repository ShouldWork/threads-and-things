import { describe, it, expect } from 'vitest';
import { matchListing, reconcileListings, soldListing, releasedListing } from '../src/lib/listingLinks';
import { saleWrites } from '../src/lib/saleWrites';
import { finalizedImport, previewImport } from '../src/lib/importPlan';
import { withoutImportedSales } from '../src/lib/importRecords';
import { sale, listing, emptyData } from './fixtures';

const shop = () => { const d = emptyData();
  d.listings = [
    { ...listing({ id: 'l1', desc: 'Pink Puma hoodie #sporty', posted: '2026-09-20' }), location: 'Bin 1' },
    { ...listing({ id: 'l2', desc: 'Levi 501 jeans', posted: '2026-09-25' }), location: 'Bin 2' },
  ];
  return d; };

describe('matching a sale to its listing', () => {
  it('matches only one active listing with the same description, posted on or before the sale', () => {
    const d = shop();
    expect(matchListing(d.listings, sale({ desc: '  pink puma HOODIE   #sporty ', date: '2026-10-01' }))?.id).toBe('l1');
    expect(matchListing(d.listings, sale({ desc: 'Pink Puma hoodie #sporty', date: '2026-09-01' }))).toBeUndefined(); // sold before it was posted
    expect(matchListing(d.listings, sale({ desc: 'Something else', date: '2026-10-01' }))).toBeUndefined();
    d.listings.push(listing({ id: 'l3', desc: 'Levi 501 jeans', posted: '2026-09-26' }));
    expect(matchListing(d.listings, sale({ desc: 'Levi 501 jeans', date: '2026-10-01' }))).toBeUndefined(); // two candidates
  });
  it('ignores the posted date when it was only estimated', () => {
    const d = emptyData(); d.listings = [listing({ id: 'e', desc: 'Old tee', posted: '2026-10-05', exact: false })];
    expect(matchListing(d.listings, sale({ desc: 'Old tee', date: '2026-10-01' }))?.id).toBe('e');
  });
  it('a hand-marked Sold listing goes back to Active when its sale is removed', () => {
    const marked = soldListing({ ...listing({ id: 'x', status: 'Sold' }) }, 's1');
    expect(marked).toMatchObject({ status: 'Sold', soldBy: 's1', previousStatus: 'Active' });
    expect(releasedListing(marked)).toMatchObject({ status: 'Active', soldBy: '', previousStatus: '' });
  });
});

describe('logging and deleting sales', () => {
  it('logging a sale from a listing links that listing and keeps its bin', () => {
    const plan = saleWrites(shop(), 's1', sale({ desc: 'anything', date: '2026-10-01' }), undefined, 'l2');
    expect(plan.listings).toHaveLength(1);
    expect(plan.listings[0]).toMatchObject({ id: 'l2', status: 'Sold', soldBy: 's1', location: 'Bin 2' });
  });
  it('a new sale from the + menu links automatically only on an unambiguous match', () => {
    expect(saleWrites(shop(), 's1', sale({ desc: 'Pink Puma hoodie #sporty', date: '2026-10-01' })).listings[0]).toMatchObject({ id: 'l1', soldBy: 's1' });
    expect(saleWrites(shop(), 's1', sale({ desc: 'No such listing', date: '2026-10-01' })).listings).toEqual([]);
  });
  it('deleting the sale puts the listing back on the rack', () => {
    const d = shop(); d.listings[0] = soldListing(d.listings[0], 's1') as typeof d.listings[0];
    const plan = saleWrites(d, 's1', null, sale({ id: 's1' }));
    expect(plan.listings[0]).toMatchObject({ id: 'l1', status: 'Active', soldBy: '', location: 'Bin 1' });
  });
  it('refuses to link a listing that already belongs to another sale', () => {
    const d = shop(); d.listings[0] = soldListing(d.listings[0], 'other') as typeof d.listings[0];
    expect(() => saleWrites(d, 's1', sale(), undefined, 'l1')).toThrow('already linked');
  });
});

describe('imports', () => {
  it('a sales import marks matching listings sold, and the review says how many', () => {
    const d = shop();
    const changes = { sales: [sale({ id: 'n1', desc: 'Pink Puma hoodie #sporty', date: '2026-10-02' })] };
    expect(previewImport(d, changes).listingsToMarkSold).toBe(1);
    const next = finalizedImport(d, changes).next;
    expect(next.listings.find(l => l.id === 'l1')).toMatchObject({ status: 'Sold', soldBy: 'n1', location: 'Bin 1' });
    expect(next.listings.find(l => l.id === 'l2')).toMatchObject({ status: 'Active' });
  });
  it('two sales of the same description are left for a person to sort out', () => {
    const r = reconcileListings({ ...shop(), sales: [sale({ id: 'a', desc: 'Levi 501 jeans', date: '2026-10-01' }), sale({ id: 'b', desc: 'Levi 501 jeans', date: '2026-10-02' })] });
    expect(r.marked).toBe(0);
  });
  it('clearing imported sales keeps the listing Sold but drops the link', () => {
    const d = shop(); d.sales = [sale({ id: 's1', origin: 'import' })]; d.listings[0] = soldListing(d.listings[0], 's1') as typeof d.listings[0];
    expect(withoutImportedSales(d).listings[0]).toMatchObject({ status: 'Sold', soldBy: '' });
  });
  it('listings missing from the page are retired only when she opts in, and can come back', () => {
    const d = shop();
    const kept = previewImport(d, { merge: { listings: [] } }).next.listings;
    expect(kept.every(l => l.status === 'Active')).toBe(true);
    const retired = previewImport(d, { merge: { listings: [] }, retireListings: ['l2'] });
    expect(retired.listingsRetired).toBe(1);
    expect(retired.next.listings.find(l => l.id === 'l2')).toMatchObject({ status: 'Removed', previousStatus: 'Active', location: 'Bin 2' });
  });
});
