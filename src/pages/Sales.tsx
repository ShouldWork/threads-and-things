import { useMemo, useState } from "react";
import type { Data, Sale } from "../types";
import { money, net, daysToSell, fmtDate, weekOf } from "../lib/calc";
import { notFuture } from "../lib/dashboard";
import { useToday } from "../lib/useToday";
import { Kpi, HBars, I, Chips } from "../components/ui";

export default function Sales({ data, onEdit }: { data: Data; onEdit: (s: Sale) => void }) {
  const [limit,setLimit] = useState(100);
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [sort, setSort] = useState("new");
  // Date range for everything on this page (totals, category bars and the list). Uses her phone's local date.
  const [range, setRange] = useState<"today" | "week" | "month" | "all">("all");
  // A week runs Monday to Sunday, the same weeks the Learn charts use.
  const asOf = useToday(), monthStart = asOf.slice(0, 8) + "01", weekStart = weekOf(asOf);
  // "All sales" follows the shared rule (nothing dated in the future), so its total matches Home and the AI.
  const inRange = (d: string) => range === "all" ? notFuture(d, asOf) : range === "today" ? d === asOf : !!d && d >= (range === "week" ? weekStart : monthStart) && d <= asOf;
  // Where each sold item is stored, from the listing it sold through, so she can find it to ship.
  const spotFor = useMemo(() => new Map(data.listings.filter(l => l.soldBy && l.location?.trim()).map(l => [l.soldBy!, l.location!.trim()])), [data.listings]);
  const cats = ["All", ...Array.from(new Set(data.sales.map(s => s.cat))).filter(Boolean).sort()];  const list = useMemo(() => {
    let l = data.sales.filter(s => inRange(s.date)).map(s => ({ ...s, n: net(s), dts: daysToSell(s.listed, s.date) }));
    if (cat !== "All") l = l.filter(s => s.cat === cat);
    if (q) l = l.filter(s => (s.desc + " " + s.brand + " " + s.size + " " + s.sku).toLowerCase().includes(q.toLowerCase()));
    const f: Record<string, (a: typeof l[0], b: typeof l[0]) => number> = { new: (a, b) => b.date.localeCompare(a.date), old: (a, b) => a.date.localeCompare(b.date), hi: (a, b) => b.price - a.price, fast: (a, b) => (Number.isFinite(a.dts) ? a.dts : Infinity) - (Number.isFinite(b.dts) ? b.dts : Infinity) };
    return l.sort(f[sort]);
  }, [data.sales, q, cat, sort, range, asOf]);
  const cats2 = useMemo(() => { const m: Record<string, number> = Object.create(null); list.forEach(s => (m[s.cat] = (m[s.cat] || 0) + s.price)); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })); }, [list]);
  return <>
    <h1>Sales</h1><p className="sub">Every item that sold. Tap a sale to edit it.</p>
    <div style={{ marginTop: 10 }}><Chips value={range} onChange={r => { setRange(r); setLimit(100); }} label="Sales period" options={[["today", "Today"], ["week", "This week"], ["month", "This month"], ["all", "All"]]} /></div>
    <div className="controls">
      <input id="s-q" type="search" placeholder="Search brand, description, size, SKU" value={q} onChange={e => setQ(e.target.value)} aria-label="Search sales" />
      <div className="two">
        <select id="s-cat" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">{cats.map(c => <option key={c}>{c}</option>)}</select>
        <select id="s-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="hi">Highest price</option><option value="fast">Fastest to sell</option></select>
      </div>
    </div>
    <div className="kpis" style={{ marginTop: 12 }}>
      <Kpi tip="sold" label="Showing" value={list.length} />
      <Kpi tip="gross" label="Gross" value={money(list.reduce((a, s) => a + s.price, 0), 0)} />
    </div>
    {cats2.length > 1 && <div className="card"><h3>Where the money comes from</h3><HBars data={cats2} fmt={n => money(n, 0)} /></div>}
    <div className="card">
      {list.length === 0 && <div className="empty"><b>{range === "today" && !q && cat === "All" ? "No sales yet today" : range === "week" && !q && cat === "All" ? "No sales yet this week" : range === "month" && !q && cat === "All" ? "No sales yet this month" : "No sales match"}</b>{range !== "all" && !q && cat === "All" ? "They show up here as soon as one is logged or imported." : "Clear the search, or log a sale with the + button."}</div>}
      {list.slice(0, limit).map(s => <button type="button" className="rowbtn" key={s.id} onClick={() => onEdit(s)}><div className="row">
        <div className="main"><div className="desc">{s.desc.split("\n")[0] || "(no description)"}</div>
          <div className="meta">{spotFor.get(s.id!) && <span className="pill spot">{I.pin}{spotFor.get(s.id!)}</span>}<span>{fmtDate(s.date)}</span><span>{s.cat}</span><span>{s.size}</span>{s.brand && s.brand !== "Other" && <span>{s.brand}</span>}{s.sku && <span>{s.sku}</span>}
            {isFinite(s.dts) && <span className={"pill " + (s.dts <= 3 ? "good" : s.dts >= 14 ? "warn" : "soft")}>{s.dts}d to sell</span>}{s.boost > 0 && <span className="pill gold">boosted</span>}{s.platform && s.platform !== "Depop" && <span className="pill soft">{s.platform}</span>}</div></div>
        <div className="price">{money(s.price)}<s style={{ textDecoration: "none" }}>net {money(s.n - s.cogs)}</s></div>
      </div></button>)}
      {list.length > limit && <button type="button" className="btn" onClick={() => setLimit(n => n+100)}>Show more ({list.length-limit} remaining)</button>}
    </div>
  </>;
}
