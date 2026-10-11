import { useEffect, useMemo, useState } from "react";
import type { Data } from "../types";
import { money, pct, days, isKids, isPlus, median, weekOf } from "../lib/calc";
import { Chips, HBars, Tip } from "../components/ui";
import { PLAYBOOK } from "../lib/playbook";

export default function Learn({ data, setCrumb }: { data: Data; setCrumb: (s: string) => void }) {
  const [view, setView] = useState<"insights" | "playbook">("insights");
  useEffect(() => { setCrumb(view === "insights" ? "Your numbers" : "Seller playbook"); }, [view, setCrumb]);
  const S = data.sales; const active = useMemo(() => data.listings.filter(l => /active/i.test(l.status)), [data.listings]);
  const thru = (s: number, a: number) => (s + a ? s / (s + a) : 0);
  const kS = S.filter(s => isKids(s.size)).length, kA = active.filter(l => isKids(l.size)).length, pS = S.filter(s => isPlus(s.size)).length, pA = active.filter(l => isPlus(l.size)).length, aS = S.length - kS, aA = active.length - kA;
  const b = S.filter(s => s.boost > 0), nb = S.filter(s => s.boost === 0 && s.listed);
  const bDays = median(b.filter(s => s.listed).map(s => days(s.listed, s.date))), nDays = median(nb.map(s => days(s.listed, s.date))), boostSpend = b.reduce((a, s) => a + s.boost, 0);
  const medPrice = median(S.map(s => s.price)), fast = S.filter(s => s.listed && days(s.listed, s.date) <= 3).length, disc = active.filter(l => l.orig && l.orig > l.price), overall = thru(S.length, active.length);
  const catRows = useMemo(() => { const m: Record<string, { s: number; a: number }> = {}; S.forEach(s => { m[s.cat] = m[s.cat] || { s: 0, a: 0 }; m[s.cat].s++; }); active.forEach(l => { m[l.cat] = m[l.cat] || { s: 0, a: 0 }; m[l.cat].a++; }); return Object.entries(m).filter(([, v]) => v.s + v.a >= 4).map(([k, v]) => ({ label: k, value: thru(v.s, v.a), sub: `${v.s}/${v.s + v.a}`, tone: thru(v.s, v.a) < .2 ? "var(--bad)" : thru(v.s, v.a) >= .4 ? "var(--good)" : undefined })).sort((a, b) => b.value - a.value); }, [S, active]);
  const WORDS = ["flare", "jeans", "low rise", "graphic", "denim", "vintage", "lace", "skirt", "floral", "cropped", "sweater", "costume", "shorts", "dress", "leggings", "y2k"];
  const words = useMemo(() => WORDS.map(w => { const re = new RegExp("\\b" + w, "i"); const s = S.filter(x => re.test(x.desc)).length, a = active.filter(x => re.test(x.desc)).length; return { w, s, a, r: thru(s, a) }; }).filter(x => x.s + x.a >= 6).sort((x, y) => y.r - x.r), [S, active]);
  const weekly = useMemo(() => { const m: Record<string, { l: number; s: number }> = {}; S.forEach(s => { if (s.listed) { const k = weekOf(s.listed); m[k] = m[k] || { l: 0, s: 0 }; m[k].l++; } const k2 = weekOf(s.date); m[k2] = m[k2] || { l: 0, s: 0 }; m[k2].s++; }); active.forEach(l => { if (l.exact) { const k = weekOf(l.posted); m[k] = m[k] || { l: 0, s: 0 }; m[k].l++; } }); data.inventory.forEach(i => { if (i.listed) { const k = weekOf(i.listed); m[k] = m[k] || { l: 0, s: 0 }; m[k].l++; } }); return Object.keys(m).sort().slice(-8).map(k => ({ label: new Date(k + "T12:00").toLocaleDateString("en-US", { month: "numeric", day: "numeric" }), l: m[k].l, s: m[k].s })); }, [S, active, data.inventory]);
  const [open, setOpen] = useState<number | null>(0);

  return <>
    <h1>Learn</h1><p className="sub">What your numbers say, and what experienced sellers recommend.</p>
    <div style={{ marginTop: 10 }}><Chips value={view} onChange={setView} label="View" options={[["insights", "Your numbers"], ["playbook", "Seller playbook"]]} /></div>
    {view === "insights" && <>
      <p className="note">Sell-through = sold ÷ (sold + still listed). The shop is at {pct(overall)} overall.</p>
      {S.length === 0 && <div className="empty"><b>Nothing to read yet</b>Insights appear once a few sales are logged.</div>}
      {kA > 0 && <div className={"insight " + (thru(kS, kA) < overall / 2 ? "bad" : "")}><b>Kids sizes: {pct(thru(kS, kA))} sell-through</b>{kS} sold vs {kA} still listed. Adult sizes are at {pct(thru(aS, aA))}. Bundle kids items by size, or sell them on Mercari or locally.</div>}
      {pS + pA > 0 && <div className={"insight " + (thru(pS, pA) > overall ? "good" : "")}><b>Plus sizes: {pct(thru(pS, pA))} sell-through</b>XL and up: {pS} sold, {pA} listed.{thru(pS, pA) > overall ? " When you buy inventory, start here." : ""}</div>}
      {S.length > 0 && <div className="insight gold"><b>Median sale {money(medPrice)}</b>{fast} of {S.length} items sold within 3 days of listing. Things that sell that fast can usually carry a higher price.</div>}
      {b.length > 0 && <div className={"insight " + (bDays >= nDays ? "bad" : "good")}><b>Boosting: {money(boostSpend)} spent</b>Boosted items took a median {bDays} days to sell; unboosted took {nDays}. {bDays >= nDays ? "Boosting is not speeding anything up. Pause it except on higher-priced items." : "Boosting is helping."}</div>}
      {disc.length > 0 && <div className="insight"><b>{disc.length} listings marked down</b>From {money(disc.reduce((a, l) => a + (l.orig as number), 0) / disc.length)} to {money(disc.reduce((a, l) => a + l.price, 0) / disc.length)} on average. Hold markdowns until an item has sat 2 to 3 weeks, and drop 5% at a time.</div>}
      {catRows.length > 0 && <><h2>Sell-through by category</h2><div className="card" style={{ marginTop: 0 }}><Tip k="catthru" /><HBars data={catRows} fmt={pct} max={1} /></div></>}
      {weekly.length > 1 && <><h2>Listed vs sold, by week</h2><div className="card" style={{ marginTop: 0 }}><Tip k="listedvs" />
        <svg viewBox="0 0 340 160" width="100%" role="img">{(() => { const mx = Math.max(1, ...weekly.flatMap(w => [w.l, w.s])); const bw = 332 / Math.max(1, weekly.length); return <><line x1="0" x2="340" y1="138" y2="138" stroke="var(--line)" />{weekly.map((w, i) => { const x = 4 + i * bw; const hl = 118 * w.l / mx, hs = 118 * w.s / mx; return <g key={w.label}><rect x={x + bw * .12} y={138 - hl} width={bw * .34} height={hl} rx="5" fill="var(--gold)" /><rect x={x + bw * .52} y={138 - hs} width={bw * .34} height={hs} rx="5" fill="var(--rose)" /><text x={x + bw * .5} y="154" textAnchor="middle">{w.label}</text></g>; })}</>; })()}</svg>
        <div className="legend"><span><i style={{ background: "var(--gold)" }} />Listed</span><span><i style={{ background: "var(--rose)" }} />Sold</span></div></div></>}
      {words.length > 0 && <><h2>Words that sell</h2><div className="card scroll" style={{ marginTop: 0 }}><Tip k="words" /><table><thead><tr><th>Word</th><th>Sold</th><th>Listed</th><th>Sell-through</th></tr></thead>
        <tbody>{words.map(x => <tr key={x.w}><td>“{x.w}”</td><td>{x.s}</td><td>{x.a}</td><td style={{ color: x.r >= overall * 1.2 ? "var(--good)" : x.r < overall * .8 ? "var(--bad)" : "inherit", fontWeight: 800 }}>{pct(x.r)}</td></tr>)}</tbody></table></div></>}
    </>}
    {view === "playbook" && <>
      <p className="note">Collected from Depop's own guidance and seller blogs, Oct 2026. Most blogs are written by companies selling reseller tools, so treat the tactics as things to test. Fee figures are platform rules.</p>
      {PLAYBOOK.map((g, i) => <div className="card" key={g.title} style={{ padding: 0, overflow: "hidden", marginTop: 10 }}>
        <button type="button" className="acc" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}><span><span className="t">{g.title}</span><span className="note" style={{ display: "block" }}>{g.note}</span></span><span className="chev" aria-hidden="true">{open === i ? "–" : "+"}</span></button>
        {open === i && <div style={{ padding: "0 14px 6px" }}>{g.items.map(it => <div className="tipitem" key={it.h}><b>{it.h}</b><span>{it.b}</span>{it.src && <span className="note" style={{ display: "block", marginTop: 2 }}>Source: {it.src}</span>}</div>)}</div>}
      </div>)}
    </>}
  </>;
}
