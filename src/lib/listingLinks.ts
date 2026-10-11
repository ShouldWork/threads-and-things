import type { Data, Listing, Sale } from '../types';

// Links between a sale and the Depop listing it came from. A linked listing has status "Sold" and soldBy = the
// sale's id, so Closet can show it under Sold (with its bin) and the Sales screen can show where it was stored.
// Depop's sales export has no listing ID, so an unlinked sale is matched only by identical description, and only
// when the pairing is unambiguous. A missed match leaves the listing active, which is the safe failure.
export type LinkedListing = Listing & { soldBy?: string; previousStatus?: string };
export const isActiveListing = (l: Listing) => /^active$/i.test((l.status || '').trim());
export const isSoldListing = (l: Listing) => /^sold$/i.test((l.status || '').trim());
const norm = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export function soldListing(l: LinkedListing, saleId: string): LinkedListing {
  // If she already set the status to Sold by hand, restoring later should put it back on the rack, not "Sold".
  const previous = l.previousStatus || (isSoldListing(l) ? 'Active' : l.status || 'Active');
  return { ...l, status: 'Sold', soldBy: saleId, previousStatus: previous };
}
export function releasedListing(l: LinkedListing): LinkedListing {
  return { ...l, status: l.previousStatus || 'Active', soldBy: '', previousStatus: '' };
}
export const listingForSale = (listings: LinkedListing[], saleId?: string) => saleId ? listings.find(l => l.soldBy === saleId) : undefined;

// The one active, unlinked listing with this sale's description that could have produced it. Estimated posting
// dates (exact=false) are guesses, so the "posted on or before the sale" check only applies to exact dates.
export function matchListing(listings: LinkedListing[], sale: Sale, taken: Set<string> = new Set()): LinkedListing | undefined {
  const d = norm(sale.desc); if (!d) return undefined;
  const hits = listings.filter(l => l.id && isActiveListing(l) && !l.soldBy && !taken.has(l.id) && norm(l.desc) === d
    && (!l.exact || !l.posted || !sale.date || l.posted <= sale.date));
  return hits.length === 1 ? hits[0] : undefined;
}

// After an import, clear or consolidation: release listings whose sale no longer exists, then link each unlinked
// sale to its listing when exactly one sale and one listing share that description.
export function reconcileListings(data: Data): { data: Data; marked: number } {
  const saleIds = new Set(data.sales.map(s => s.id).filter(Boolean));
  // A link to a sale that no longer exists is released. A link to a sale that exists always means Sold, even if a
  // listings-page import just set the status back to Active (the page can still show an item that sold).
  let listings = (data.listings as LinkedListing[]).map(l => !l.soldBy ? l : !saleIds.has(l.soldBy) ? releasedListing(l) : isSoldListing(l) ? l : { ...l, status: 'Sold' });
  const linked = new Set(listings.map(l => l.soldBy).filter(Boolean));
  const unlinked = data.sales.filter(s => s.id && !linked.has(s.id));
  const salesPerDesc = new Map<string, number>();
  for (const s of unlinked) { const d = norm(s.desc); if (d) salesPerDesc.set(d, (salesPerDesc.get(d) || 0) + 1); }
  const taken = new Set<string>(); let marked = 0;
  for (const s of unlinked) {
    if (salesPerDesc.get(norm(s.desc)) !== 1) continue; // two sales of the "same" item: leave for a person
    const hit = matchListing(listings, s, taken); if (!hit) continue;
    taken.add(hit.id!); marked++;
    listings = listings.map(l => l.id === hit.id ? soldListing(l, s.id!) : l);
  }
  return { data: { ...data, listings }, marked };
}
