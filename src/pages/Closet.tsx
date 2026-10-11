import { useEffect, useMemo, useState } from "react";
import type { Data, Item, Listing } from "../types";
import { money, days, isKids, fmtDate } from "../lib/calc";
import { Chips } from "../components/ui";

type View = "listings" | "inventory";
export default function Closet({ data, setCrumb, onEditItem, onEditListing }: { data: Data; setCrumb: (s: string) => void; onEditItem: (i: Item) => void; onEditListing: (l: Listing) => void }) {
  const [view, setView] = useState<View>("listings");
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [age, setAge] = useState("all"); const [kids, setKids] = useState("all"); const [sort, setSort] = useState("old"); const [status, setStatus] = useState("open");
  const active = useMemo(() => data.listings.filter(l => /active/i.test(l.status)), [data.listings]);
  const snapshot = data.settings.snapshot;
  const cats = ["All", ...Array.from(new Set((view === "listings" ? active : data.inventory).map(l => l.cat))).filter(Boolean).sort()];
  useEffect(() => { const parts = [view === "inventory" ? "Inventory" : "", cat !== "All" ? cat : "", age === "21" ? "Sitting 21+ days" : age === "new" ? "New this week" : "", kids === "kids" ? "Kids" : kids === "adult" ? "Adult" : ""].filter(Boolean); setCrumb(parts.join(" · ")); }, [view, cat, age, kids, setCrumb]);

  const listings = useMemo(() => {
    let l = active.map(x => ({ ...x, age: days(x.posted, snapshot) }));
    if (cat !== "All") l = l.filter(x => x.cat === cat); if (q) l = l.filter(x => (x.desc + " " + x.size).toLowerCase().includes(q.toLowerCase()));
    if (age === "21") l = l.filter(x => x.age >= 21); if (age === "new") l = l.filter(x => x.age < 7);
    if (kids === "kids") l = l.filter(x => isKids(x.size)); if (kids === "adult") l = l.filter(x => !isKids(x.size));
    const s: Record<string, (a: typeof l[0], b: typeof l[0]) => number> = { old: (a, b) => b.age - a.age, new: (a, b) => a.age - b.age, hi: (a, b) => b.price - a.price, lo: (a, b) => a.price - b.price };
    return l.sort(s[sort]);
  }, [active, q, cat, age, kids, sort, snapshot]);

  const items = useMemo(() => {
    let l = data.inventory.slice();
    if (status === "open") l = l.filter(i => !/sold|donated|bundled|kept|lost/i.test(i.status)); if (status === "sold") l = l.filter(i => /sold/i.test(i.status)); if (status === "gone") l = l.filter(i => /donated|bundled|kept|lost|returned/i.test(i.status));
    if (cat !== "All") l = l.filter(x => x.cat === cat); if (q) l = l.filter(x => (x.desc + " " + x.size + " " + x.sku + " " + x.brand).toLowerCase().includes(q.toLowerCase()));
    return l.sort((a, b) => (b.acquired || "").localeCompare(a.acquired || ""));
  }, [data.inventory, status, cat, q]);

  return <>
    <h1>Closet</h1><p className="sub">{view === "listings" ? "Everything on the rack right now. Red tags need a refresh or a new price." : "Every item you have logged, what it cost, and where it ended up."}</p>
    <div style={{ marginTop: 10 }}><Chips value={view} onChange={v => { setView(v); setCat("All"); }} label="View" options={[["listings", `On Depop (${active.length})`], ["inventory", `Inventory (${data.inventory.length})`]]} /></div>
    <div className="controls">
      <input id="c-q" type="search" placeholder={view === "listings" ? "Search, e.g. flare, lace, size M" : "Search description, SKU, brand"} value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
      <div className="two">
        <select id="c-cat" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">{cats.map(c => <option key={c}>{c}</option>)}</select>
        {view === "listings" ? <select id="c-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="old">Oldest first</option><option value="new">Newest first</option><option value="hi">Price high to low</option><option value="lo">Price low to high</option></select>
          : <select id="c-status" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"><option value="open">On hand</option><option value="sold">Sold</option><option value="gone">Left unsold</option><option value="all">All</option></select>}
      </div>
      {view === "listings" && <div className="chips">
        {[["all", "Any age"], ["21", "Sitting 21+ days"], ["new", "New this week"]].map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={age === k} onClick={() => setAge(k)}>{l}</button>)}
        {[["all", "All sizes"], ["adult", "Adult"], ["kids", "Kids"]].map(([k, l]) => <button key={"k" + k} type="button" className="chip" aria-pressed={kids === k} onClick={() => setKids(k)}>{l}</button>)}
      </div>}
    </div>

    {view === "listings" && <>
      <p className="note" style={{ margin: "8px 0 0" }}>{listings.length} listings · {money(listings.reduce((a, l) => a + l.price, 0), 0)} asking. “est.” means the date was estimated. Ages count from the snapshot date in Settings.</p>
      <div className="card">
        {listings.length === 0 && <div className="empty"><b>Nothing here</b>{active.length ? "Try loosening the filters." : "Import your Depop listings page from the More tab, or add listings with +."}</div>}
        {listings.slice(0, 250).map(l => <div className="row" key={l.id}>
          <div className="main"><button type="button" className="rowbtn" onClick={() => onEditListing(l)}><div className="desc">{l.desc.split("\n")[0]}</div></button>
            <div className="meta"><span>{l.cat}</span><span>{l.size}</span><span className={"pill " + (l.age >= 21 ? "bad" : l.age < 7 ? "good" : "soft")}>{l.age}d{l.exact ? "" : " est."}</span>{isKids(l.size) && <span className="pill gold">Kids</span>}{l.boosted && <span className="pill warn">boosted</span>}{l.link && <a href={l.link} target="_blank" rel="noopener">Open ↗</a>}</div></div>
          <div className="price">{l.orig && l.orig > l.price ? <s>{money(l.orig)}</s> : null}{money(l.price)}</div>
        </div>)}
      </div>
    </>}

    {view === "inventory" && <>
      <p className="note" style={{ margin: "8px 0 0" }}>{items.length} items · {money(items.reduce((a, i) => a + i.cost, 0), 0)} paid. Write the SKU on the tag so a sale can be matched back here.</p>
      <div className="card">
        {items.length === 0 && <div className="empty"><b>No inventory yet</b>Tap + and choose Inventory item when something new comes in.</div>}
        {items.map(i => <button type="button" className="rowbtn" key={i.id} onClick={() => onEditItem(i)}><div className="row">
          <div className="main"><div className="desc">{i.desc || i.brand || i.sku}</div>
            <div className="meta"><span className="pill soft">{i.sku}</span><span>{i.cat}</span><span>{i.size}</span><span>{i.source}</span>{i.acquired && <span>{fmtDate(i.acquired)}</span>}<span className={"pill " + (/sold/i.test(i.status) ? "good" : /listed/i.test(i.status) ? "soft" : /donated|bundled|kept|lost/i.test(i.status) ? "warn" : "gold")}>{i.status}</span></div></div>
          <div className="price">{money(i.cost)}<s style={{ textDecoration: "none" }}>cost</s></div>
        </div></button>)}
      </div>
    </>}
  </>;
}
