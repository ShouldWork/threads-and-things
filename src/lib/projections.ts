// Projections. Pure functions over Data; no Firebase, no React. Every number here is a straight
// extrapolation of what has already been logged, so the UI labels each one with its basis.
import type { Data, Sale } from "../types";
import { DAY, net } from "./calc";
import { datedBy, notFuture } from "./dashboard";

const d2 = (n: number) => Math.round(n * 100) / 100;
const DAYS_PER_MONTH = 30.4; // 365 / 12
export const monthKey = (d: string) => d.slice(0, 7);
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T12:00") + n * DAY).toISOString().slice(0, 10);
export const monthLabel = (k: string) => new Date(k + "-15T12:00").toLocaleString("en-US", { month: "short", year: "2-digit" });
const nextMonth = (k: string) => { const [y, m] = k.split("-").map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };
const fees = (s: Sale) => (s.depopFee || 0) + (s.payFee || 0) + (s.boost || 0);
const activeOf = (data: Data) => data.listings.filter(l => /^active$/i.test(l.status));

// ---------- Month by month ----------
export type MonthRow = { month: string; sold: number; listed: number; gross: number; fees: number; payout: number; cogs: number; costs: number; profit: number; avg: number; margin: number };

export function monthly(data: Data, asOf: string): MonthRow[] {
  const rows: Record<string, MonthRow> = {};
  const row = (k: string) => rows[k] || (rows[k] = { month: k, sold: 0, listed: 0, gross: 0, fees: 0, payout: 0, cogs: 0, costs: 0, profit: 0, avg: 0, margin: 0 });
  const start = monthKey(data.settings.shopStart || ""), end = monthKey(asOf);
  if (/^\d{4}-\d{2}$/.test(start) && /^\d{4}-\d{2}$/.test(end)) for (let k = start; k <= end; k = nextMonth(k)) row(k); // empty months still show
  // Only records dated on or before asOf (same rule as the dashboard), so future-dated entries don't inflate months.
  const done = (d: string) => datedBy(d, asOf);
  data.sales.forEach(s => { if (!done(s.date)) return; const r = row(monthKey(s.date)); r.sold++; r.gross += s.price; r.fees += fees(s); r.payout += net(s); r.cogs += s.cogs || 0; if (done(s.listed)) row(monthKey(s.listed)).listed++; });
  activeOf(data).forEach(l => { if (l.exact && done(l.posted)) row(monthKey(l.posted)).listed++; });
  data.expenses.forEach(e => { if (done(e.date)) row(monthKey(e.date)).costs += e.amount; });
  data.mileage.forEach(t => { if (done(t.date)) row(monthKey(t.date)).costs += t.miles * data.settings.mileageRate; });
  return Object.keys(rows).sort().map(k => { const r = rows[k]; r.profit = d2(r.payout - r.cogs - r.costs); r.avg = r.sold ? d2(r.gross / r.sold) : 0; r.margin = r.gross ? r.profit / r.gross : 0; r.gross = d2(r.gross); r.fees = d2(r.fees); r.payout = d2(r.payout); r.cogs = d2(r.cogs); r.costs = d2(r.costs); return r; });
}

// ---------- Run rate: what the shop does per day over a recent window ----------
export type Basis = "30" | "90" | "all";
export const BASIS_LABEL: Record<Basis, string> = { "30": "Last 30 days", "90": "Last 90 days", all: "Since the start" };
export type RunRate = { basis: Basis; from: string; to: string; days: number; sold: number; gross: number; payout: number; cogs: number; overhead: number; profit: number; perDay: number; payoutPerDay: number; profitPerDay: number; avgSale: number; avgPayout: number; avgProfit: number; avgCogs: number; feeRate: number; sample: "none" | "thin" | "ok" };

export function runRate(data: Data, basis: Basis, asOf: string): RunRate {
  const firstSale = data.sales.reduce((m, s) => (s.date && s.date < m ? s.date : m), asOf);
  const shopStart = data.settings.shopStart && data.settings.shopStart <= asOf ? data.settings.shopStart : asOf;
  const earliest = shopStart < firstSale ? shopStart : firstSale;
  let from = basis === "all" ? earliest : addDays(asOf, -(Number(basis) - 1));
  if (from < earliest) from = earliest;
  const days = Math.max(1, Math.round((Date.parse(asOf + "T12:00") - Date.parse(from + "T12:00")) / DAY) + 1);
  const inWin = (d: string) => !!d && d >= from && d <= asOf;
  const sales = data.sales.filter(s => inWin(s.date));
  const sold = sales.length;
  const gross = sales.reduce((a, s) => a + s.price, 0), payout = sales.reduce((a, s) => a + net(s), 0), cogs = sales.reduce((a, s) => a + (s.cogs || 0), 0), fee = sales.reduce((a, s) => a + fees(s), 0);
  const overhead = data.expenses.filter(e => inWin(e.date)).reduce((a, e) => a + e.amount, 0) + data.mileage.filter(t => inWin(t.date)).reduce((a, t) => a + t.miles, 0) * data.settings.mileageRate;
  const profit = payout - cogs - overhead;
  return { basis, from, to: asOf, days, sold, gross: d2(gross), payout: d2(payout), cogs: d2(cogs), overhead: d2(overhead), profit: d2(profit),
    perDay: sold / days, payoutPerDay: payout / days, profitPerDay: profit / days,
    avgSale: sold ? gross / sold : 0, avgPayout: sold ? payout / sold : 0, avgProfit: sold ? (payout - cogs) / sold : 0, avgCogs: sold ? cogs / sold : 0,
    feeRate: gross ? fee / gross : 0, sample: sold === 0 ? "none" : sold < 10 ? "thin" : "ok" };
}

// ---------- Forecast: run rate carried forward ----------
export type Horizon = { days: number; sold: number; gross: number; payout: number; profit: number };
export type Forecast = { next30: Horizon; next90: Horizon; yearEnd: { year: number; toDate: number; remainingDays: number; projected: number }; rack: { active: number; asking: number; sellThrough: number; expectedPayout: number; daysToClear: number | null } };

export function forecast(data: Data, rr: RunRate, asOf: string): Forecast {
  const h = (days: number): Horizon => ({ days, sold: Math.round(rr.perDay * days), gross: d2(rr.perDay * days * rr.avgSale), payout: d2(rr.payoutPerDay * days), profit: d2(rr.profitPerDay * days) });
  const year = asOf.slice(0, 4); const inYear = (d: string) => datedBy(d, asOf) && d.slice(0, 4) === year;
  const ySales = data.sales.filter(s => inYear(s.date));
  const toDate = ySales.reduce((a, s) => a + net(s) - (s.cogs || 0), 0) - data.expenses.filter(e => inYear(e.date)).reduce((a, e) => a + e.amount, 0) - data.mileage.filter(t => inYear(t.date)).reduce((a, t) => a + t.miles, 0) * data.settings.mileageRate;
  const remainingDays = Math.max(0, Math.round((Date.parse(`${year}-12-31T12:00`) - Date.parse(asOf + "T12:00")) / DAY));
  const active = activeOf(data); const asking = active.reduce((a, l) => a + l.price, 0);
  const soldAll = data.sales.filter(s => notFuture(s.date, asOf)).length; const sellThrough = soldAll + active.length ? soldAll / (soldAll + active.length) : 0;
  return { next30: h(30), next90: h(90),
    yearEnd: { year: Number(year), toDate: d2(toDate), remainingDays, projected: d2(toDate + remainingDays * rr.profitPerDay) },
    rack: { active: active.length, asking: d2(asking), sellThrough, expectedPayout: d2(asking * sellThrough * (1 - rr.feeRate)), daysToClear: rr.perDay > 0 ? Math.round(active.length / rr.perDay) : null } };
}

// ---------- Goal: what it takes to hit a monthly profit target ----------
// salesNeeded and everything derived from it is null when each sale makes no profit: no number of sales reaches the goal.
export type GoalPlan = { target: number; currentMonthly: number; gap: number; onTrack: boolean; overheadMonthly: number; avgProfit: number; reachable: boolean; salesNeeded: number | null; perWeek: number | null; sellThrough: number; listingsNeeded: number | null; cashNeeded: number | null; profitPerHour: number | null; hoursNeeded: number | null };

export function goalPlan(data: Data, rr: RunRate, target: number, asOf: string): GoalPlan {
  const currentMonthly = d2(rr.profitPerDay * DAYS_PER_MONTH);
  const overheadMonthly = d2(rr.overhead / rr.days * DAYS_PER_MONTH);
  const reachable = rr.avgProfit > 0;
  const salesNeeded = reachable ? Math.ceil((target + overheadMonthly) / rr.avgProfit) : null;
  const perWeek = salesNeeded == null ? null : d2(salesNeeded / (DAYS_PER_MONTH / 7));
  const done = data.sales.filter(s => notFuture(s.date, asOf));
  const active = activeOf(data).length, soldAll = done.length; const sellThrough = soldAll + active ? soldAll / (soldAll + active) : 0;
  const listingsNeeded = salesNeeded != null && sellThrough > 0 ? Math.ceil(salesNeeded / sellThrough) : null;
  const cashNeeded = listingsNeeded == null ? null : d2(listingsNeeded * rr.avgCogs);
  const hours = data.time.filter(t => notFuture(t.date, asOf)).reduce((a, t) => a + t.minutes, 0) / 60;
  const profitPerHour = hours > 0 ? d2(done.reduce((a, s) => a + net(s) - (s.cogs || 0), 0) / hours) : null;
  const hoursNeeded = profitPerHour && profitPerHour > 0 ? d2((target + overheadMonthly) / profitPerHour) : null;
  return { target, currentMonthly, gap: d2(target - currentMonthly), onTrack: currentMonthly >= target, overheadMonthly, avgProfit: d2(rr.avgProfit), reachable, salesNeeded, perWeek, sellThrough, listingsNeeded, cashNeeded, profitPerHour, hoursNeeded };
}
