import type { Data, Sale, Item } from '../types';
import { prepareRow, type Row } from './records';
import { listingForSale, matchListing, releasedListing, soldListing, type LinkedListing } from './listingLinks';

// A sale and every affected inventory and listing row are applied in one Firestore batch.
// listingId: the listing she logged this sale from (explicit link). Without it, a new sale links to its listing
// only when exactly one active listing has the same description.
export function saleWrites(data: Data, id: string, sale: Sale | null, previous?: Sale, listingId?: string) {
  const inventory: Row[] = [];
  const listings: Row[] = [];
  const all = data.listings as LinkedListing[];
  const current = listingForSale(all, id);
  if (!sale) { if (current) listings.push(prepareRow('listings', releasedListing(current), true)); }
  else if (listingId && listingId !== current?.id) {
    const target = all.find(l => l.id === listingId);
    if (!target) throw new Error('That listing no longer exists. Close this form and try again.');
    if (target.soldBy && target.soldBy !== id) throw new Error('That listing is already linked to another sale.');
    if (current) listings.push(prepareRow('listings', releasedListing(current), true));
    listings.push(prepareRow('listings', soldListing(target, id), true));
  } else if (!current && !previous) {
    const hit = matchListing(all, sale);
    if (hit) listings.push(prepareRow('listings', soldListing(hit, id), true));
  }
  const oldItem = previous?.sku ? data.inventory.find(i => i.sku === previous.sku) : undefined;
  const nextItem = sale?.sku ? data.inventory.find(i => i.sku === sale.sku) : undefined;
  const others = data.sales.filter(s => s.id !== id);
  if (nextItem && others.some(s => s.sku === nextItem.sku)) throw new Error('This SKU already belongs to another sale.');
  if (oldItem?.id && oldItem.id !== nextItem?.id && !others.some(s => s.sku === oldItem.sku)) {
    const old = oldItem as Item & { previousStatus?: string; previousOutcome?: string };
    inventory.push(prepareRow('inventory', { ...old, status: old.previousStatus || (old.listed ? 'Listed' : 'Unlisted'), outcome: old.previousOutcome || '', soldBy: '', previousStatus: '', previousOutcome: '' }, true));
  }
  if (nextItem?.id && sale) {
    const next = nextItem as Item & { soldBy?: string; previousStatus?: string; previousOutcome?: string };
    if (next.soldBy && next.soldBy !== id) throw new Error('This inventory item is already sold.');
    inventory.push(prepareRow('inventory', { ...next, status: 'Sold', outcome: sale.date, soldBy: id,
      previousStatus: next.previousStatus || (next.status === 'Sold' ? (next.listed ? 'Listed' : 'Unlisted') : next.status),
      previousOutcome: next.previousOutcome ?? (next.status === 'Sold' ? '' : next.outcome) }, true));
  }
  return { sale: sale ? prepareRow('sales', sale) : null, inventory, listings };
}
