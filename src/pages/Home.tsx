import { useMemo, useState } from "react";
import type { Data, Sale } from "../types";
import { money, pct, net, days, isKids, today } from "../lib/calc";
import { Kpi, Chips, Bars, HBars, I } from "../components/ui";

import { dashboard, datedBy, type Range } from '../lib/dashboard';
import { invGroup } from "../types";
import Ask from "../components/Ask";
export default function Home({ data, go, openAdd }: { data: Data; go: (t: string) => void; openAdd: () => void }) {
  const [range, setRange] = useState<Range>("all");
  const active = useMemo(() => data.listings.filter(l => /^active$/i.test(l.status)), [data.listings]);
  const asOf = today();
  const { sales,gross,payout,cogs,exp,miles,profit,hours,fees } = useMemo(() => dashboard(data,range,asOf),[data,range,asOf]);
  const snapshot = asOf;
  const stale = active.filter(l => days(l.posted, snapshot) >= 21);
  const months = useMemo(() => { const m: Record<string, { g: number; n: number }> = Object.create(null); data.sales.forEach(s => { if (!datedBy(s.date, asOf)) return; const k = s.date.slice(0, 7); m[k] = m[k] || { g: 0, n: 0 }; m[k].g += s.price; m[k].n++; }); return Object.keys(m).sort().slice(-6).map(k => ({ label: new Date(k + "-15").toLocaleString("en-US", { month: "short" }), value: m[k].g, n: m[k].n })); }, [data.sales, asOf]);
  const wd = useMemo(() => { const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; const c = [0, 0, 0, 0, 0, 0, 0]; sales.forEach(s => { c[(new Date(s.date + "T12:00").getDay() + 6) % 7]++; }); const mx = Math.max(...c); return names.map((l, i) => ({ label: l, value: c[i], hi: c[i] === mx && mx > 0 })); }, [sales]);
  const kids = active.filter(l => isKids(l.size)).length;
  const hour = new Date().getHours(); const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const inv = data.inventory, onHand = inv.filter(i => invGroup(i.status) === "onHand"), unsoldOut = inv.filter(i => invGroup(i.status) === "gone").length;
  const lost = data.issues.reduce((a, i) => a + i.lost, 0);
  // Tax set-aside is on all-time profit to date, using the same rule as the totals (future-dated records excluded).
  const profitAll = useMemo(() => dashboard(data, "all", asOf).profit, [data, asOf]);
  const tax = sales.reduce((a, s) => a + (s.tax || 0), 0);
  const byPlat = useMemo(() => { const m: Record<string, number> = {}; sales.forEach(s => { const k = s.platform || "Depop"; m[k] = (m[k] || 0) + s.price; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })); }, [sales]);

  const todo: { ic: JSX.Element; tone?: string; t: string; d: string; go: string }[] = [];
  if (stale.length) todo.push({ ic: I.refresh, tone: "bad", t: `${stale.length} listings have sat 21+ days`, d: "Open each one, tap Edit, save. That bumps it in search without losing likes.", go: "closet" });
  if (kids >= 10) todo.push({ ic: I.box, tone: "gold", t: `${kids} kids-size listings`, d: "Kids clothes rarely sell on Depop. Bundle by size or move them to Mercari or local.", go: "learn" });
  const best = wd.find(d => d.hi); if (best && best.value) todo.push({ ic: I.heart, t: `${best.label} is your best sales day`, d: "List new items the evening before so they are fresh when buyers browse.", go: "learn" });
  if (!hours) todo.push({ ic: I.clock, t: "No time logged yet", d: "Tap + and log a few sessions. Profit per hour is the number that matters most.", go: "add" });

  return <>
    <div className="greeting"><div className="g"><p className="hello-tag">{hello}</p><h1>Hi {data.settings.name} <span className="heart" aria-hidden="true">{I.heart}</span></h1><p className="sub">Here's how your shop is doing.</p></div></div>
    <div style={{ marginTop: 12 }}><Chips value={range} onChange={setRange} label="Time range" options={[["all", "All time"], ["30", "Last 30 days"], ["7", "Last 7 days"]]} /></div>
    <div className="kpis" style={{ marginTop: 6 }}>
      <Kpi hero tip="profit" label="Net profit" value={money(profit)} detail={`${sales.length} items · after fees${exp ? `, ${money(exp, 0)} expenses` : ""}${miles ? ", mileage" : ""}`} />
      <Kpi tip="sold" label="Items sold" value={sales.length} />
      <Kpi tip="avg" label="Average sale" value={money(sales.length ? gross / sales.length : 0)} />
      <Kpi tip="payout" label="Payout per item" value={money(sales.length ? payout / sales.length : 0)} />
      <Kpi tip="fees" label="Fees take" value={pct(gross ? fees / gross : 0)} />
    </div>

    <h2>To do this week</h2>
    <div className="card" style={{ marginTop: 0 }}>
      {todo.length === 0 && <div className="empty"><b>Nothing urgent</b>Keep listing. Check back after the next sale.</div>}
      {todo.map((t, i) => <div className="todo" key={i}><span className={"ic " + (t.tone || "")}>{t.ic}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 800 }}>{t.t}</div><div className="note">{t.d}</div></div><button type="button" className="btn small" style={{ flex: "none" }} onClick={() => t.go === "add" ? openAdd() : go(t.go)}>Go</button></div>)}
    </div>

    <div className="quick">
      <button type="button" onClick={openAdd}>{I.tag}Log a sale</button>
      <button type="button" onClick={() => go("closet")}>{I.hanger}Closet</button>
      <button type="button" onClick={() => go("plan")}>{I.chart}Plan</button>
      <button type="button" onClick={() => go("more")}>{I.more}Import</button>
    </div>

    <Ask data={data} />

    <h2>Sales by month</h2>
    <div className="card" style={{ marginTop: 0 }}>{months.length ? <><Bars data={months} fmt={n => money(n, 0)} title="Sales by month" /><p className="note" style={{ margin: "4px 0 0" }}>{months.map(m => `${m.label}: ${m.n} sold`).join(" · ")}</p></> : <div className="empty"><b>No sales yet</b>Log your first sale with the + button.</div>}</div>
    <h2>Best days to sell</h2>
    <div className="card" style={{ marginTop: 0 }}><Bars data={wd} fmt={n => String(n)} height={150} title="Items sold by day of week" /></div>

    <h2>On the rack</h2>
    <div className="kpis" style={{ marginTop: 0 }}>
      <Kpi tip="active" label="Active listings" value={active.length} />
      <Kpi tip="asking" label="Asking value" value={money(active.reduce((a, l) => a + l.price, 0), 0)} />
      <Kpi tip="stale" label="Sitting 21+ days" value={stale.length} color={stale.length ? "var(--bad)" : undefined} />
      <Kpi tip="thru" label="Sell-through" value={pct(data.sales.length / (data.sales.length + active.length))} />
    </div>

    <h2>Behind the scenes</h2>
    {!inv.length && !data.time.length && !data.issues.length && <p className="note" style={{ margin: "0 0 8px" }}>Add inventory, time and issues with the + button and these light up.</p>}
    <div className="kpis" style={{ marginTop: 0 }}>
      <Kpi tip="hours" label="Hours logged" value={hours ? hours.toFixed(1) : "–"} />
      <Kpi tip="perhour" label="Profit per hour" value={hours ? money(profit / hours) : "–"} />
      <Kpi tip="onhand" label="Items on hand" value={inv.length ? onHand.length : "–"} />
      <Kpi tip="cash" label="Cash in inventory" value={inv.length ? money(onHand.reduce((a, i) => a + i.cost, 0), 0) : "–"} />
      <Kpi tip="unsold" label="Left unsold" value={inv.length ? unsoldOut : "–"} />
      <Kpi tip="issues" label="Issues / lost" value={data.issues.length ? `${data.issues.length} / ${money(lost, 0)}` : "–"} />
      <Kpi tip="tax" label={`Set aside for tax (${Math.round(data.settings.taxPct * 100)}%)`} value={money(Math.max(0, profitAll) * data.settings.taxPct, 0)} />
      <Kpi tip="stax" label="Sales tax collected" value={money(tax, 0)} />
    </div>
    {byPlat.length > 1 && <div className="card"><h3>Gross by platform</h3><HBars data={byPlat} fmt={n => money(n, 0)} /></div>}
  </>;
}
