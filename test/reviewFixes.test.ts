// Regression tests for the 2026-10-10 Codex review fixes (see .codex-reviews comparison file).
import { describe, it, expect } from 'vitest';
import { friendlyError } from '../src/lib/aiErrors';
import { shopSummary, scrub } from '../src/lib/aiSummary';
import { dashboard, monthToDate } from '../src/lib/dashboard';
import { monthly, runRate, forecast } from '../src/lib/projections';
import { mergeRecords } from '../src/lib/importRecords';
import { sameData } from '../src/lib/importPlan';
import { weekOf } from '../src/lib/calc';
import { invGroup, LISTS } from '../src/types';
import { prepareRow } from '../src/lib/records';
import { sale, listing, item, emptyData } from './fixtures';

const URL = 'https://firebasevertexai.googleapis.com/v1beta/projects/p/models/gemini-3.8-flash:generateContent';
describe('AI error messages (C01, F24)', () => {
  it('does not blame the quota for offline, permission or server errors', () => {
    expect(friendlyError(new Error(`Error fetching from ${URL}: Failed to fetch`), false)).toMatch(/internet connection/);
    expect(friendlyError(new Error(`Error fetching from ${URL}: Failed to fetch`), true)).toMatch(/internet connection/);
    expect(friendlyError(new Error(`Error fetching from ${URL}: [403 Forbidden] API has not been used`), true)).toMatch(/not switched on/);
    expect(friendlyError(new Error(`Error fetching from ${URL}: [500 Internal Server Error] boom`), true)).toMatch(/on its end/);
    expect(friendlyError(new Error(`Error fetching from ${URL}: [429 Too Many Requests] Resource exhausted`), true)).toMatch(/allowance/);
    expect(friendlyError(new Error(`Error fetching from ${URL}: signal is aborted without reason`), true)).toMatch(/too long/);
    expect(friendlyError(new Error('something odd'), true)).toMatch(/went wrong/);
  });
});

describe('AI summary safety (F01, F08)', () => {
  it('strips links, emails and phone numbers but keeps dates and sizes', () => {
    const s = scrub('See https://depop.com/x or www.foo.com, mail me a@b.co, call (801) 555-1234. Bought 2026-10-10, 30x32.');
    expect(s).not.toMatch(/depop\.com|foo\.com|a@b\.co|555-1234/);
    expect(s).toContain('2026-10-10'); expect(s).toContain('30x32');
  });
  it('treats "constructor" and "__proto__" labels as ordinary text', () => {
    const d = emptyData();
    d.sales = [sale({ id: 's1', cat: 'constructor' }), sale({ id: 's2', cat: '__proto__' })];
    d.inventory = [{ ...item({ id: 'i1', status: 'Unlisted' }), location: 'constructor' }];
    const s = shopSummary(d, '2026-10-10');
    expect(s.byCategory.map(c => c.category).sort()).toEqual(['__proto__', 'constructor']);
    expect(s.inventory.byStorageSpot.constructor).toBe(1);
  });
});

describe('shared date rules (F09, F15, C10)', () => {
  const d = emptyData();
  d.sales = [sale({ id: 'a', date: '2026-10-05', price: 20, cogs: 5 }), sale({ id: 'b', date: '2026-10-25', price: 100, cogs: 10 })];
  it('leaves future-dated sales out of every total, chart and the AI', () => {
    const s = shopSummary(d, '2026-10-10');
    expect(dashboard(d, 'all', '2026-10-10').gross).toBe(20);
    expect(s.salesByMonth).toEqual([{ month: '2026-10', sold: 1, gross: 20, payout: 20 }]);
    expect(s.byCategory.reduce((n, c) => n + c.sold, 0)).toBe(1);
    expect(monthly(d, '2026-10-10').find(m => m.month === '2026-10')?.gross).toBe(20);
    expect(forecast(d, runRate(d, 'all', '2026-10-10'), '2026-10-10').yearEnd.toDate).toBe(15);
  });
  it('gives the AI a calendar month-to-date total', () => {
    expect(monthToDate(d, '2026-10-10').gross).toBe(20);
    expect(shopSummary(d, '2026-10-10').thisMonthSoFar).toMatchObject({ from: '2026-10-01', itemsSold: 1, netProfit: 15 });
  });
  it('weekOf returns blank instead of crashing on undated records (F07, C05)', () => {
    expect(weekOf('')).toBe(''); expect(weekOf('not a date')).toBe(''); expect(weekOf('2026-10-08')).toBe('2026-10-05');
  });
  it('undated legacy listings do not break the summary', () => {
    const x = emptyData(); x.listings = [{ ...listing({ id: 'l1' }), posted: '' } as never, listing({ id: 'l2', posted: '2026-09-01' })];
    const s = shopSummary(x, '2026-10-10');
    expect(s.longestListed?.daysListed).toBe(39);
  });
});

describe('inventory status groups (F10, C07)', () => {
  it('puts every status in exactly one group', () => {
    const groups = Object.fromEntries(LISTS.itemStatus.map(s => [s, invGroup(s)]));
    expect(groups).toEqual({ Unlisted: 'onHand', Listed: 'onHand', Sold: 'sold', Bundled: 'gone', Donated: 'gone', Kept: 'gone', 'Returned to me': 'onHand', 'Lost/damaged': 'gone' });
  });
});

describe('imports (F06, F23)', () => {
  it('a first import of undated inventory succeeds and keeps the date blank', () => {
    const undated = { sku: 'TT-0009', desc: 'Undated shirt', acquired: '', status: 'Unlisted' };
    const { rows, added } = mergeRecords('inventory', [], [undated]);
    expect(added).toBe(1); expect(rows[0].acquired).toBe('');
  });
  it('recognizes a no-op result regardless of key order', () => {
    const a = emptyData(); a.sales = [sale({ id: 's1' })];
    const b = emptyData(); b.sales = [Object.fromEntries(Object.entries(prepareRow('sales', { ...sale({ id: 's1' }) })).reverse()) as never];
    expect(sameData(a, b)).toBe(true);
    b.sales = [sale({ id: 's1', price: 21 })];
    expect(sameData(a, b)).toBe(false);
  });
});
