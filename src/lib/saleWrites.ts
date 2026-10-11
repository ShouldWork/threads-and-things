import type { Data, Sale, Item } from '../types';
import { prepareRow, type Row } from './records';

// A sale and every affected inventory row are applied in one Firestore batch.
export function saleWrites(data: Data, id: string, sale: Sale | null, previous?: Sale) {
  const inventory: Row[] = [];
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
  return { sale: sale ? prepareRow('sales', sale) : null, inventory };
}
