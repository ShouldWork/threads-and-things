import { useMemo, useState } from "react";
import { invGroup, type Data, type Item, type Listing } from "../types";
import { money, days, isKids, fmtDate, today } from "../lib/calc";
import { FilterPicker, I } from "../components/ui";
import { locations } from "../components/Forms";
import { isActiveListing, isSoldListing } from "../lib/listingLinks";

const NO_SPOT = "\u0000none";

type View = "listings" | "sold" | "removed" | "inventory";
export default function Closet({ data, onEditItem, onEditListing }: { data: Data; onEditItem: (i: Item) => void; onEditListing: (l: Listing) => void }) {
  const [view, setView] = useState<View>("listings");
  const [limit,setLimit] = useState(100);
  const [q, setQ] = useState(""); const [cat, setCat] = useState("All"); const [loc, setLoc] = useState(""); const [age, setAge] = useState("all"); const [sort, setSort] = useState("old"); const [status, setStatus] = useState("open");
  const active = useMemo(() => data.listings.filter(isActiveListing), [data.listings]);
  // Sold and removed listings stay findable (with their bin) instead of disappearing.
  const sold = useMemo(() => data.listings.filter(isSoldListing), [data.listings]);
  const removed = useMemo(() => data.listings.filter(l => !isActiveListing(l) && !isSoldListing(l)), [data.listings]);
  const isListingView = view !== "inventory";
  const source = view === "sold" ? sold : view === "removed" ? removed : active;
  const saleById = useMemo(() => new Map(data.sales.map(s => [s.id, s])), [data.sales]);
  const snapshot = today();
  const cats = ["All", ...Array.from(new Set((isListingView ? source : data.inventory).map(l => l.cat))).filter(Boolean).sort()];
  // Storage spots used in the current view (On Depop listings or inventory), for the filter chips.
  const viewRows: { location?: string }[] = isListingView ? source : data.inventory;
  const spots = useMemo(() => locations({ ...data, listings: isListingView ? source : [], inventory: view === "inventory" ? data.inventory : [] }), [data, source, isListingView, view]);
  const hasUnplaced = viewRows.some(r => !(r.location || "").trim());
  const atSpot = (r: { location?: string }) => !loc || (loc === NO_SPOT ? !(r.location || "").trim() : (r.location || "").trim() === loc);
  const listings = useMemo(() => {
    let l = source.map(x => ({ ...x, age: days(x.posted, snapshot) }));
    if (cat !== "All") l = l.filter(x => x.cat === cat); if (q) l = l.filter(x => (x.desc + " " + x.size + " " + (x.location || "")).toLowerCase().includes(q.toLowerCase()));
    l = l.filter(atSpot);
    if (age === "21") l = l.filter(x => x.age >= 21); if (age === "new") l = l.filter(x => x.age < 7);
    const s: Record<string, (a: typeof l[0], b: typeof l[0]) => number> = { old: (a, b) => b.age - a.age, new: (a, b) => a.age - b.age, hi: (a, b) => b.price - a.price, lo: (a, b) => a.price - b.price };
    return l.sort(s[sort]);
  }, [source, q, cat, loc, age, sort, snapshot]);

  const items = useMemo(() => {
    let l = data.inventory.slice();
    if (status === "open") l = l.filter(i => invGroup(i.status) === "onHand"); if (status === "unlisted") l = l.filter(i => /^unlisted$/i.test(i.status.trim())); if (status === "sold") l = l.filter(i => invGroup(i.status) === "sold"); if (status === "gone") l = l.filter(i => invGroup(i.status) === "gone");
    if (cat !== "All") l = l.filter(x => x.cat === cat); if (q) l = l.filter(x => (x.desc + " " + x.size + " " + x.sku + " " + x.brand + " " + (x.location || "")).toLowerCase().includes(q.toLowerCase()));
    l = l.filter(atSpot);
    return l.sort((a, b) => (b.acquired || "").localeCompare(a.acquired || ""));
  }, [data.inventory, status, cat, q, loc]);

  return <>
    <h1>Closet</h1><p className="sub">{{ listings: "Everything on the rack right now. Red tags need a refresh or a new price.", sold: "Listings that sold, and where each was stored. Tap one to see or fix it.", removed: "Listings taken down or no longer on Depop. Set one back to Active to return it to the rack.", inventory: "Every item you have logged, what it cost, and where it ended up." }[view]}</p>
    <div className="controls">
      {/* One row of filter buttons; each opens a pop-up of choices instead of showing every option on the page. */}
      <div className="pickers">
        <FilterPicker short="Status" title="Status" value={view} onChange={v => { setView(v); setCat("All"); setLoc(""); setAge("all"); }}
          options={[["listings", `On Depop (${active.length})`], ["sold", `Sold (${sold.length})`], ["removed", `Removed (${removed.length})`], ["inventory", `Inventory (${data.inventory.length})`]]} />
        {view === "listings" && <FilterPicker short="Age" title="Listing age" value={age} onChange={setAge} options={[["all", "Any age"], ["21", "Sitting 21+ days"], ["new", "New this week"]]} />}
        {spots.length > 0 && <FilterPicker short="Spot" title="Where it's stored" value={loc} onChange={setLoc} options={[["", "Anywhere"], ...spots.map(s => [s, s] as [string, string]), ...(hasUnplaced ? [[NO_SPOT, "No spot yet"] as [string, string]] : [])]} />}
      </div>
      <input id="c-q" type="search" placeholder={isListingView ? "Search, e.g. flare, size M, bin 1" : "Search description, SKU, brand, spot"} value={q} onChange={e => setQ(e.target.value)} aria-label="Search" />
      <div className="two">
        <select id="c-cat" value={cat} onChange={e => setCat(e.target.value)} aria-label="Category">{cats.map(c => <option key={c}>{c}</option>)}</select>
        {isListingView ? <select id="c-sort" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort"><option value="old">Oldest first</option><option value="new">Newest first</option><option value="hi">Price high to low</option><option value="lo">Price low to high</option></select>
          : <select id="c-status" value={status} onChange={e => setStatus(e.target.value)} aria-label="Status"><option value="open">On hand</option><option value="unlisted">Not listed yet</option><option value="sold">Sold</option><option value="gone">Left unsold</option><option value="all">All</option></select>}
      </div>
    </div>

    {isListingView && <>
      <p className="note" style={{ margin: "8px 0 0" }}>{listings.length} listings · {money(listings.reduce((a, l) => a + l.price, 0), 0)} {view === "listings" ? "asking" : "listed at"}. “est.” means the date was estimated. Ages count through today; the last imported snapshot is {data.settings.snapshot}.</p>
      <div className="card">
        {listings.length === 0 && <div className="empty"><b>Nothing here</b>{source.length ? "Try loosening the filters." : view === "sold" ? "Listings you mark sold, or that match an imported sale, show up here." : view === "removed" ? "Nothing removed." : "Import your Depop listings page from the More tab, or add listings with +."}</div>}
        {listings.slice(0, limit).map(l => <div className="row" key={l.id}>
          <div className="main"><button type="button" className="rowbtn" onClick={() => onEditListing(l)}><div className="desc">{l.desc.split("\n")[0]}</div></button>
            <div className="meta">{l.location?.trim() && <span className="pill spot">{I.pin}{l.location.trim()}</span>}<span>{l.cat}</span><span>{l.size}</span>{view === "listings" ? <span className={"pill " + (l.age >= 21 ? "bad" : l.age < 7 ? "good" : "soft")}>{l.age}d{l.exact ? "" : " est."}</span> : (() => { const sale = l.soldBy ? saleById.get(l.soldBy) : undefined; return <span className={"pill " + (view === "sold" ? "good" : "warn")}>{sale ? `Sold ${fmtDate(sale.date)} · ${money(sale.price)}` : l.status}</span>; })()}{isKids(l.size) && <span className="pill gold">Kids</span>}{l.boosted && <span className="pill warn">boosted</span>}{l.link && <a href={l.link} target="_blank" rel="noopener">Open ↗</a>}</div></div>
          <div className="price">{l.orig && l.orig > l.price ? <s>{money(l.orig)}</s> : null}{money(l.price)}</div>
        </div>)}
        {listings.length > limit && <button type="button" className="btn" onClick={() => setLimit(n => n+100)}>Show more ({listings.length-limit} remaining)</button>}
      </div>
    </>}

    {view === "inventory" && <>
      <p className="note" style={{ margin: "8px 0 0" }}>{items.length} items · {money(items.reduce((a, i) => a + i.cost, 0), 0)} paid. Write the SKU on the tag so a sale can be matched back here.</p>
      <div className="card">
        {items.length === 0 && <div className="empty"><b>No inventory yet</b>Tap + and choose Inventory item when something new comes in.</div>}
        {items.map(i => <button type="button" className="rowbtn" key={i.id} onClick={() => onEditItem(i)}><div className="row">
          <div className="main"><div className="desc">{i.desc || i.brand || i.sku}</div>
            <div className="meta"><span className="pill soft">{i.sku}</span>{i.location?.trim() && <span className="pill spot">{I.pin}{i.location.trim()}</span>}<span>{i.cat}</span><span>{i.size}</span><span>{i.source}</span>{i.acquired && <span>{fmtDate(i.acquired)}</span>}<span className={"pill " + ({ sold: "good", gone: "warn", onHand: /^listed$/i.test(i.status.trim()) ? "soft" : "gold" } as const)[invGroup(i.status)]}>{i.status}</span></div></div>
          <div className="price">{money(i.cost)}<s style={{ textDecoration: "none" }}>cost</s></div>
        </div></button>)}
      </div>
    </>}
  </>;
}
