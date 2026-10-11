import { describe, it, expect } from "vitest";
import { monthly, runRate, forecast, goalPlan, addDays } from "../src/lib/projections";
import { DEFAULT_SETTINGS, type Data, type Sale, type Listing } from "../src/types";

const sale = (o: Partial<Sale>): Sale => ({ date: "", listed: "", brand: "", cat: "Tops", size: "M", desc: "", price: 0, ship: 0, depopFee: 0, payFee: 0, boost: 0, usps: 0, refund: 0, feeBack: 0, cogs: 0, state: "", sku: "", platform: "Depop", tax: 0, ...o });
const listing = (o: Partial<Listing>): Listing => ({ cat: "Tops", size: "M", desc: "", orig: null, price: 0, posted: "", exact: true, boosted: false, link: "", status: "Active", ...o });
const ASOF = "2026-10-10";
const data: Data = {
  sales: [
    sale({ date: "2026-10-01", listed: "2026-09-25", price: 20, payFee: 1, cogs: 5 }),
    sale({ date: "2026-10-05", price: 10, payFee: 0.5, cogs: 2 }),
    sale({ date: "2026-08-15", price: 30, payFee: 1.5 }),
  ],
  listings: [listing({ price: 15, posted: "2026-10-02" }), listing({ price: 25, posted: "2026-10-03" }), listing({ price: 99, posted: "2026-10-03", status: "Sold" })],
  inventory: [], issues: [],
  expenses: [{ date: "2026-10-02", cat: "Packing supplies", vendor: "", desc: "", amount: 4, paidWith: "Cash", receipt: false, notes: "" }],
  mileage: [{ date: "2026-10-03", purpose: "Post office", miles: 10 }],
  time: [{ date: "2026-10-04", activity: "Listing", minutes: 120, notes: "" }],
  settings: { ...DEFAULT_SETTINGS, shopStart: "2026-08-01", mileageRate: 0.7, snapshot: ASOF },
};

describe("addDays", () => {
  it("steps back across a month boundary", () => { expect(addDays("2026-10-10", -29)).toBe("2026-09-11"); });
});

describe("monthly", () => {
  const m = monthly(data, ASOF);
  it("covers every month from shopStart to asOf, including empty ones", () => { expect(m.map(r => r.month)).toEqual(["2026-08", "2026-09", "2026-10"]); });
  it("aggregates August", () => { const a = m[0]; expect(a.sold).toBe(1); expect(a.gross).toBe(30); expect(a.fees).toBe(1.5); expect(a.payout).toBe(28.5); expect(a.profit).toBe(28.5); });
  it("counts September as a listing-only month", () => { const s = m[1]; expect(s.sold).toBe(0); expect(s.listed).toBe(1); expect(s.profit).toBe(0); expect(s.margin).toBe(0); });
  it("aggregates October with costs and mileage", () => { const o = m[2]; expect(o.sold).toBe(2); expect(o.listed).toBe(2); expect(o.gross).toBe(30); expect(o.fees).toBe(1.5); expect(o.payout).toBe(28.5); expect(o.cogs).toBe(7); expect(o.costs).toBe(11); expect(o.profit).toBe(10.5); expect(o.avg).toBe(15); expect(o.margin).toBeCloseTo(0.35, 10); });
});

describe("runRate, last 30 days", () => {
  const rr = runRate(data, "30", ASOF);
  it("uses a 30 day window ending asOf", () => { expect(rr.from).toBe("2026-09-11"); expect(rr.to).toBe(ASOF); expect(rr.days).toBe(30); });
  it("totals only the sales, expenses and mileage inside the window", () => { expect(rr.sold).toBe(2); expect(rr.gross).toBe(30); expect(rr.payout).toBe(28.5); expect(rr.cogs).toBe(7); expect(rr.overhead).toBe(11); expect(rr.profit).toBe(10.5); });
  it("derives per-day and per-sale rates", () => { expect(rr.perDay).toBeCloseTo(2 / 30, 10); expect(rr.profitPerDay).toBeCloseTo(0.35, 10); expect(rr.avgSale).toBe(15); expect(rr.avgPayout).toBe(14.25); expect(rr.avgProfit).toBe(10.75); expect(rr.avgCogs).toBe(3.5); expect(rr.feeRate).toBeCloseTo(0.05, 10); });
  it("flags a thin sample", () => { expect(rr.sample).toBe("thin"); });
});

describe("runRate, since the start", () => {
  const rr = runRate(data, "all", ASOF);
  it("starts at shopStart when it is earlier than the first sale", () => { expect(rr.from).toBe("2026-08-01"); expect(rr.days).toBe(71); expect(rr.sold).toBe(3); });
  it("reports none when there are no sales", () => { expect(runRate({ ...data, sales: [] }, "30", ASOF).sample).toBe("none"); });
});

describe("forecast", () => {
  const rr = runRate(data, "30", ASOF); const f = forecast(data, rr, ASOF);
  it("carries the run rate forward 30 and 90 days", () => { expect(f.next30).toEqual({ days: 30, sold: 2, gross: 30, payout: 28.5, profit: 10.5 }); expect(f.next90.sold).toBe(6); expect(f.next90.profit).toBe(31.5); });
  it("projects year end from actual year-to-date plus remaining days", () => { expect(f.yearEnd.year).toBe(2026); expect(f.yearEnd.toDate).toBe(39); expect(f.yearEnd.remainingDays).toBe(82); expect(f.yearEnd.projected).toBe(67.7); });
  it("values the rack by sell-through and fee rate", () => { expect(f.rack.active).toBe(2); expect(f.rack.asking).toBe(40); expect(f.rack.sellThrough).toBeCloseTo(0.6, 10); expect(f.rack.expectedPayout).toBe(22.8); expect(f.rack.daysToClear).toBe(30); });
  it("has no clear date without sales", () => { const z = runRate({ ...data, sales: [] }, "30", ASOF); expect(forecast({ ...data, sales: [] }, z, ASOF).rack.daysToClear).toBeNull(); });
});

describe("goalPlan", () => {
  const rr = runRate(data, "30", ASOF); const g = goalPlan(data, rr, 100, ASOF);
  it("compares the target to the current monthly pace", () => { expect(g.currentMonthly).toBe(10.64); expect(g.gap).toBe(89.36); expect(g.onTrack).toBe(false); expect(g.overheadMonthly).toBe(11.15); });
  it("turns the target into sales, listings, cash and hours", () => { expect(g.avgProfit).toBe(10.75); expect(g.salesNeeded).toBe(11); expect(g.perWeek).toBe(2.53); expect(g.listingsNeeded).toBe(19); expect(g.cashNeeded).toBe(66.5); expect(g.profitPerHour).toBe(25); expect(g.hoursNeeded).toBe(4.45); });
  it("is on track when the pace beats the target", () => { expect(goalPlan(data, rr, 10, ASOF).onTrack).toBe(true); });
  it("cannot plan without any profitable sales", () => { const z = runRate({ ...data, sales: [] }, "30", ASOF); const p = goalPlan({ ...data, sales: [], listings: [] }, z, 100, ASOF); expect(p.reachable).toBe(false); expect(p.salesNeeded).toBeNull(); expect(p.perWeek).toBeNull(); expect(p.listingsNeeded).toBeNull(); expect(p.cashNeeded).toBeNull(); });
});
