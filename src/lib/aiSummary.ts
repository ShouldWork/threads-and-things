import { invGroup, type Data } from '../types';
import { net, days, isKids, median } from './calc';
import { dashboard, monthToDate, notFuture, datedBy } from './dashboard';

// What the AI is allowed to see. Buyer fields (buyer name, buyer state, order and transaction IDs, links) are never
// included. Text she wrote herself (listing titles and descriptions, category, size, storage labels) is included,
// with web links, email addresses and phone numbers stripped, because the AI needs it to suggest listing rewrites.
const r2 = (n: number) => Math.round(n * 100) / 100;
export const scrub = (s: string) => (s || '')
  .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link removed]')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email removed]')
  .replace(/(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g, '[number removed]');
const title = (desc: string) => scrub((desc.split('\n')[0] || '').slice(0, 70));
// Grouping by labels she typed: use prototype-free objects so "constructor" or "__proto__" are ordinary keys.
const dict = <T>() => Object.create(null) as Record<string, T>;

export function shopSummary(data: Data, asOf: string) {
  const pack = (d: ReturnType<typeof dashboard>) => ({ itemsSold: d.sales.length, grossSales: r2(d.gross), payoutAfterFees: r2(d.payout), itemCost: r2(d.cogs), expenses: r2(d.exp), mileageDeduction: r2(d.miles), netProfit: r2(d.profit), hoursLogged: r2(d.hours), feesPaid: r2(d.fees) });
  const active = data.listings.filter(l => /^active$/i.test(l.status)).map(l => ({ ...l, age: l.posted ? days(l.posted, asOf) : null }));
  const byAge = [...active].sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
  const happened = data.sales.filter(s => notFuture(s.date, asOf)); // same rule as the dashboard totals
  const dated = data.sales.filter(s => datedBy(s.date, asOf));

  const cats = dict<{ sold: number; listed: number; prices: number[]; daysToSell: number[] }>();
  const cat = (k: string) => (cats[scrub(k) || 'Other'] ||= { sold: 0, listed: 0, prices: [], daysToSell: [] });
  for (const s of happened) { const c = cat(s.cat); c.sold++; c.prices.push(s.price); if (s.listed && s.date) c.daysToSell.push(days(s.listed, s.date)); }
  for (const l of active) cat(l.cat).listed++;
  const byCategory = Object.entries(cats).map(([category, c]) => ({
    category, sold: c.sold, stillListed: c.listed,
    sellThrough: c.sold + c.listed ? r2(c.sold / (c.sold + c.listed)) : null,
    medianSalePrice: c.prices.length ? r2(median(c.prices)) : null,
    medianDaysToSell: c.daysToSell.length ? median(c.daysToSell) : null,
  })).sort((a, b) => b.sold + b.stillListed - (a.sold + a.stillListed));

  const months = dict<{ sold: number; gross: number; payout: number }>();
  for (const s of dated) { const m = (months[s.date.slice(0, 7)] ||= { sold: 0, gross: 0, payout: 0 }); m.sold++; m.gross += s.price; m.payout += net(s); }
  const salesByMonth = Object.keys(months).sort().slice(-12).map(month => ({ month, sold: months[month].sold, gross: r2(months[month].gross), payout: r2(months[month].payout) }));

  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => ({ day, sold: 0 }));
  for (const s of dated) weekday[new Date(s.date + 'T12:00').getDay()].sold++;

  const onHand = data.inventory.filter(i => invGroup(i.status) === 'onHand');
  const spots = dict<number>();
  for (const i of onHand) { const k = scrub((i.location || '').trim()) || 'no spot recorded'; spots[k] = (spots[k] || 0) + 1; }

  const boosted = happened.filter(s => s.boost > 0);
  const oldest = byAge[0];
  return {
    asOf,
    goalMonthlyProfit: data.settings.goalMonthly || null,
    allTime: pack(dashboard(data, 'all', asOf)), last30Days: pack(dashboard(data, '30', asOf)), last7Days: pack(dashboard(data, '7', asOf)),
    thisMonthSoFar: { from: asOf.slice(0, 8) + '01', ...pack(monthToDate(data, asOf)) },
    salesByMonth, salesByWeekday: weekday, byCategory,
    activeListings: {
      count: active.length,
      askingTotal: r2(active.reduce((n, l) => n + l.price, 0)),
      medianAskingPrice: active.length ? r2(median(active.map(l => l.price))) : null,
      sitting21PlusDays: active.filter(l => (l.age ?? 0) >= 21).length,
      newThisWeek: active.filter(l => l.age != null && l.age < 7).length,
      kidsSizes: active.filter(l => isKids(l.size)).length,
      markedDown: active.filter(l => l.orig && l.orig > l.price).length,
      boosted: active.filter(l => l.boosted).length,
      oldestFive: byAge.slice(0, 5).map(l => ({ title: title(l.desc), category: scrub(l.cat), size: scrub(l.size), price: l.price, daysListed: l.age })),
    },
    // Full listing text for the single longest-listed item, so the AI can suggest title and description rewrites.
    longestListed: oldest ? { fullDescription: scrub(oldest.desc.slice(0, 2000)), category: scrub(oldest.cat), size: scrub(oldest.size), price: oldest.price, originalPrice: oldest.orig, boosted: oldest.boosted, daysListed: oldest.age, dateIsEstimated: !oldest.exact } : null,
    boosting: { boostedSales: boosted.length, boostSpend: r2(boosted.reduce((n, s) => n + s.boost, 0)) },
    inventory: {
      itemsOnHand: onHand.length,
      cashTiedUp: r2(onHand.reduce((n, i) => n + i.cost, 0)),
      notListedYet: onHand.filter(i => /^unlisted$/i.test(i.status.trim())).length,
      byStorageSpot: spots,
    },
    issues: { count: data.issues.length, moneyLost: r2(data.issues.reduce((n, i) => n + i.lost, 0)) },
  };
}

export type ShopSummary = ReturnType<typeof shopSummary>;
