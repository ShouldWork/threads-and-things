import type { Data } from '../types';
import { net, DAY } from './calc';
export type Range = 'all' | '30' | '7';

// Shared date rules, so every screen and the AI agree on what has already happened.
// Totals keep undated legacy records (they happened, we just don't know when); dated buckets skip them.
export const notFuture = (date: string, asOf: string) => !date || date <= asOf;
export const datedBy = (date: string, asOf: string) => !!date && date <= asOf;

export function inRange(date: string, range: Range, asOf: string) {
  if (range === 'all') return notFuture(date, asOf);
  const from = new Date(Date.parse(asOf + 'T00:00:00Z') - (Number(range)-1) * DAY).toISOString().slice(0,10);
  return !!date && date >= from && date <= asOf;
}
function totals(data: Data, keep: (date: string) => boolean) {
  const sales = data.sales.filter(s => keep(s.date));
  const gross = sales.reduce((n,s) => n+s.price,0), payout = sales.reduce((n,s) => n+net(s),0), cogs = sales.reduce((n,s) => n+s.cogs,0);
  const exp = data.expenses.filter(e => keep(e.date)).reduce((n,e) => n+e.amount,0);
  const miles = data.mileage.filter(t => keep(t.date)).reduce((n,t) => n+t.miles,0)*data.settings.mileageRate;
  const hours = data.time.filter(t => keep(t.date)).reduce((n,t) => n+t.minutes,0)/60;
  const fees = sales.reduce((n,s) => n+s.depopFee+s.payFee+s.boost,0);
  return { sales,gross,payout,cogs,exp,miles,hours,fees,profit:payout-cogs-exp-miles };
}
export function dashboard(data: Data, range: Range, asOf: string) {
  return totals(data, date => inRange(date,range,asOf));
}
// Calendar month so far (the 1st through asOf), for "how did this month go?".
export function monthToDate(data: Data, asOf: string) {
  const from = asOf.slice(0,8) + '01';
  return totals(data, date => !!date && date >= from && date <= asOf);
}
