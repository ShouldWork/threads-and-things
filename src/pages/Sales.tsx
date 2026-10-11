import { useEffect, useMemo, useState } from "react";
import type { Data, Sale } from "../types";
import { money, net, days, fmtDate } from "../lib/calc";
import { Kpi, HBars } from "../components/ui";

export default function Sales({ data, setCrumb, onEdit }: { data: Data; setCrumb: (s: string) => void; onEdit: (s: Sale) => void }) {
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [sort, setSort] = useState("new");
  const cats = ["All", ...Array.from(new Set(data.sales.map(s => s.cat))).filter(Boolean).sort()];
  useEffect(() => { setCrumb(cat !== "All" ? cat : q ? `Search “${q}”` : ""); }, [cat, q, setCrumb]);
  const list = useMemo(() => {
    let l = data.sales.map(s => ({ ...s, n: net(s), dts: s.listed ? days(s.listed, s.date) : NaN }));
    if (cat !== "All") l = l.filter(s => s.cat === cat);
    if (q) l = l.filter(s => (s.desc + " " + s.brand + " " + s.size + " " + s.sku).toLowerCase().includes(q.toLowerCase()));
    const f: Record<string, (a: typeof l[0], b: typeof l[0]) => number> = { new: (a, b) => b.date.localeCompare(a.date), old: (a, b) => a.date.localeCompare(b.date), hi: (a, b) => b.price - a.price, fast: (a, b) => (a.dts || 99) - (b.dts || 99) };
    return l.sort(f[sort]);
  }, [data.sales, q, cat, sort]);
  const cats2 = useMemo(() => { const m: Record<string, number> = {}; list.forEach(s => (m[s.cat] = (m[s.cat] || 0) + s.price)); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value })); }, [list]);
  return <>
    <h1>Sales</h1><p className="sub">Every item that sold. Tap a sale to edit it.</p>
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
      {list.length === 0 && <div className="empty"><b>No sales match</b>Clear the search, or log a sale with the + button.</div>}
      {list.slice(0, 300).map(s => <button type="button" className="rowbtn" key={s.id} onClick={() => onEdit(s)}><div className="row">
        <div className="main"><div className="desc">{s.desc.split("\n")[0] || "(no description)"}</div>
          <div className="meta"><span>{fmtDate(s.date)}</span><span>{s.cat}</span><span>{s.size}</span>{s.brand && s.brand !== "Other" && <span>{s.brand}</span>}{s.sku && <span>{s.sku}</span>}
            {isFinite(s.dts) && <span className={"pill " + (s.dts <= 3 ? "good" : s.dts >= 14 ? "warn" : "soft")}>{s.dts}d to sell</span>}{s.boost > 0 && <span className="pill gold">boosted</span>}{s.platform && s.platform !== "Depop" && <span className="pill soft">{s.platform}</span>}</div></div>
        <div className="price">{money(s.price)}<s style={{ textDecoration: "none" }}>net {money(s.n - s.cogs)}</s></div>
      </div></button>)}
    </div>
  </>;
}
