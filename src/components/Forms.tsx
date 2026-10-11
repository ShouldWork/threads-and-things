import { useRef, useState } from "react";
import { LISTS, type Data, type Sale, type Item, type Expense, type Trip, type TimeRow, type Issue, type Listing } from "../types";
import { today, newSku, net, money, fmtDate } from "../lib/calc";
import { add, update, remove, saveSale, newRecordId, type ColName } from "../hooks/useData";
import { prepareRow } from '../lib/records';
import { saleKey } from '../lib/imports';
import { markManual, sourceValues } from '../lib/importRecords';
import { Field, Select, I } from "./ui";

export type Kind = "sale" | "item" | "expense" | "time" | "trip" | "issue" | "listing";
export const KIND_LABEL: Record<Kind, string> = { sale: "Sale", item: "Inventory item", expense: "Expense", time: "Time", trip: "Mileage", issue: "Issue", listing: "Listing" };
const COL: Record<Kind, ColName> = { sale: "sales", item: "inventory", expense: "expenses", time: "time", trip: "mileage", issue: "issues", listing: "listings" };

// Every storage spot used so far, on listings and inventory, so the location box can suggest them.
export const locations = (data: Data) => Array.from(new Set([...data.listings, ...data.inventory].map(r => (r.location || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));

// After saving, a form can hand off to another form (marking a listing Sold opens "Log this sale").
export type NextSheet = { kind: Kind; initial?: Record<string, unknown>; listingId?: string };
// A new sale prefilled from the listing it came from. An estimated posting date (exact: false) is a guess, so it is
// not copied into "Date listed", where it would quietly drive days-to-sell figures.
export const saleFromListing = (l: Partial<Listing>) => ({ date: today(), desc: l.desc || "", cat: l.cat || "Tops", size: l.size || "", price: l.price || 0, listed: l.exact === false ? "" : l.posted || "", platform: "Depop" });

type Props ={ kind: Kind; data: Data; initial?: Partial<Sale & Item & Expense & Trip & TimeRow & Issue & Listing> & { id?: string }; listingId?: string; onDone: (msg: string, next?: NextSheet) => void; onCancel: () => void };

export default function Form({ kind, data, initial, listingId, onDone, onCancel }: Props) {
  const editing = !!initial?.id;
  const recordId = useRef(initial?.id || newRecordId());
  const saving = useRef(false);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [protectEdits,setProtectEdits] = useState(true);
  const [costTouched,setCostTouched] = useState(false);
  const defaults: Record<Kind, object> = {
    sale: { date: today(), listed: "", brand: "", cat: "Tops", size: "M", desc: "", price: 0, ship: 0, depopFee: 0, payFee: 0, boost: 0, usps: 0, refund: 0, feeBack: 0, cogs: 0, state: "", sku: "", platform: "Depop", tax: 0 },
    item: { sku: newSku(data.inventory.map(i => i.sku)), acquired: today(), source: "Thrift store", cost: 0, cat: "Tops", size: "M", brand: "", desc: "", platform: "Depop", listed: "", status: "Unlisted", outcome: "", notes: "", location: "" },
    expense: { date: today(), cat: "Packing supplies", vendor: "", desc: "", amount: 0, paidWith: "Business checking", receipt: false, notes: "" },
    time: { date: today(), activity: "Listing", minutes: 30, notes: "" },
    trip: { date: today(), purpose: "Post office", miles: 0 },
    issue: { date: today(), sku: "", platform: "Depop", type: "Refund issued", lost: 0, resolved: false, what: "", next: "" },
    listing: { cat: "Tops", size: "M", desc: "", orig: null, price: 0, posted: today(), exact: true, boosted: false, link: "", status: "Active", location: "" },
  };
  // "boosted" on a sale is a form-only switch (the saved field is the boost fee); on a listing it is a real field.
  const [f, setF] = useState<Record<string, unknown>>({ ...defaults[kind], ...(initial || {}), ...(kind === "sale" && initial ? { boosted: Number(initial.boost || 0) > 0 } : {}) });
  const s = (k: string, v: unknown) => {if(k==='cogs')setCostTouched(true);setF(o => ({ ...o, [k]: v }));};
  const str = (k: string) => String(f[k] ?? ""); const n = (k: string) => Number(f[k] ?? 0);
  const num = (k: string, step = "0.01") => <input type="number" inputMode="decimal" step={step} min={0} value={f[k] == null ? "" : String(f[k])} onChange={e => s(k, e.target.value === "" ? 0 : parseFloat(e.target.value))} />;
  const text = (k: string, ph = "") => <input type="text" value={str(k)} onChange={e => s(k, e.target.value)} placeholder={ph} />;
  const date = (k: string) => <input type="date" required={["date","acquired","posted"].includes(k)} value={str(k)} onChange={e => s(k, e.target.value)} />;

  // Sale helper: estimate Depop fees from price + shipping if the user hasn't entered them
  const estimateFees = () => { const price = n("price"); const ship = n("ship"); const tax = n("tax"); const pay = Math.round((0.033 * (price + ship + tax) + 0.45) * 100) / 100; s("payFee", pay); if (f.boosted) s("boost", Math.round(price * 0.12 * 100) / 100); };
  const skuMatch = kind === "sale" && str("sku") ? data.inventory.find(i => i.sku === str("sku")) : undefined;
  // Listing links: the sale this listing was sold through, and (on a sale form) the listing it is being logged from.
  const linkedSale = kind === "listing" && initial?.soldBy ? data.sales.find(x => x.id === initial.soldBy) : undefined;
  const fromListing = kind === "sale" ? (listingId ? data.listings.find(l => l.id === listingId) : data.listings.find(l => l.soldBy && l.soldBy === initial?.id)) : undefined;

  // logSale: save this listing (keeping any edits such as a new bin), then open the linked sale form.
  async function persist(deleting = false, logSale = false) {
    if (saving.current) return;
    saving.current = true; setBusy(true); setErr('');
    try {
      let row: Record<string, unknown> = { ...f }; delete row.boosted;
      if (kind === 'listing') row.boosted = f.boosted;
      if (kind === 'item' && initial) {
        const linked = (initial as Record<string, unknown>).soldBy;
        if (linked && (deleting || row.sku !== initial.sku || row.status !== initial.status || row.outcome !== initial.outcome)) {
          throw new Error('Edit or delete the linked sale to change this item’s sold status or SKU.');
        }
      }
      if (kind === 'listing' && linkedSale && (deleting || row.status !== initial?.status)) {
        throw new Error('This listing is linked to a sale. To put it back on the rack, delete that sale in Sales.');
      }
      let result;
      if (kind === 'sale') {
        if (!deleting && row.listed && row.date && String(row.listed) > String(row.date)) throw new Error("Date listed can't be after the date sold.");
        if (skuMatch && !row.cogs && !costTouched && !editing) row.cogs = skuMatch.cost;
        if (initial) row.importKey = saleKey(initial as Sale);
        if (!deleting) row = markManual('sales',row,initial,protectEdits);
        result = await saveSale(data, recordId.current, deleting ? null : prepareRow('sales',row) as unknown as Sale, editing ? initial as Sale : undefined, listingId);
      } else if (deleting) result = await remove(COL[kind], recordId.current);
      else {
        if (kind === 'item' && data.inventory.some(i => i.sku === row.sku && i.id !== initial?.id)) throw new Error('This SKU is already in inventory.');
        const clean = markManual(COL[kind],row,initial,protectEdits);
        result = editing ? await update(COL[kind],recordId.current,clean) : await add(COL[kind],clean,recordId.current);
      }
      const msg = result.queued ? (deleting ? 'Deletion queued; will sync.' : 'Saved on this device; will sync.') : deleting ? 'Deleted.' : 'Saved.';
      // Just marked an unlinked listing Sold, or tapped Log sale: open the sale form, prefilled and linked to this listing.
      const justSold = kind === 'listing' && !deleting && !linkedSale && /^sold$/i.test(String(row.status)) && !/^sold$/i.test(String(initial?.status || ''));
      if (kind === 'listing' && !deleting && !linkedSale && (justSold || logSale)) onDone(justSold ? 'Marked sold. Log the sale so it counts in your totals.' : '', { kind: 'sale', initial: saleFromListing(row as Partial<Listing>), listingId: recordId.current });
      else onDone(msg);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { saving.current=false; setBusy(false); }
  }

  return <form className="form" aria-busy={busy} onSubmit={e => { e.preventDefault(); persist(); }}>
    <fieldset disabled={busy} className="formfields">
    {initial?.sourceData && <div><label><input type="checkbox" checked={protectEdits} onChange={e=>setProtectEdits(e.target.checked)}/> Protect my edits on future imports</label><p className="note">Imported values update automatically. Fields you edit here stay as you set them while protection is enabled.</p><button type="button" className="btn small" onClick={()=>{setF(o=>({...o,...sourceValues(initial),manualFields:'[]'}));setProtectEdits(false);}}>Use latest imported values</button></div>}
    {kind === "sale" && <>
      <div className="grid2"><Field label="Date sold">{date("date")}</Field><Field label="Platform"><Select value={str("platform")} onChange={v => s("platform", v)} options={LISTS.platforms} /></Field></div>
      <Field label="Description">{text("desc", "Brand, color, style, item, size")}</Field>
      {fromListing && <p className="note linknote">{I.pin} {listingId && !initial?.id ? "Saving marks this listing sold" : "Sold from listing"}: <b>{fromListing.desc.split("\n")[0].slice(0, 60)}</b>{fromListing.location?.trim() ? ` · stored in ${fromListing.location.trim()}` : ""}</p>}
      <div className="grid2"><Field label="Category"><Select value={str("cat")} onChange={v => s("cat", v)} options={LISTS.categories} /></Field><Field label="Size"><Select value={str("size")} onChange={v => s("size", v)} options={LISTS.sizes} /></Field></div>
      <div className="grid2"><Field label="Brand">{text("brand")}</Field><Field label="SKU (from inventory)">{text("sku", "TT-0001")}</Field></div>
      {skuMatch && <p className="note" style={{ margin: 0 }}>Matched inventory: {skuMatch.desc || skuMatch.brand} (cost {money(skuMatch.cost)}). It will be marked Sold.</p>}
      <div className="grid2"><Field label="Item price">{num("price")}</Field><Field label="Buyer paid shipping">{num("ship")}</Field></div>
      <div className="grid2"><Field label="Sales tax collected">{num("tax")}</Field><Field label="Date listed">{date("listed")}</Field></div>
      <div className="actions"><button type="button" className="btn small" onClick={estimateFees}>Estimate Depop fees</button><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".85rem", fontWeight: 700 }}><input type="checkbox" checked={!!f.boosted} onChange={e => { s("boosted", e.target.checked); if (!e.target.checked) s("boost", 0); }} /> Boosted</label></div>
      <div className="grid2"><Field label="Depop selling fee">{num("depopFee")}</Field>
      <Field label="Fees refunded">{num("feeBack")}</Field>
      <Field label="Buyer">{text("buyer")}</Field>
      <Field label="Payment fee">{num("payFee")}</Field><Field label="Boost fee">{num("boost")}</Field></div>
      <div className="grid2"><Field label="Item cost (COGS)">{num("cogs")}</Field><Field label="Label cost you paid">{num("usps")}</Field></div>
      <div className="grid2"><Field label="Refunded to buyer">{num("refund")}</Field><Field label="Buyer state">{text("state", "TX")}</Field></div>
      <p className="note" style={{ margin: 0 }}>Net payout: <b>{money(net({ ...(f as unknown as Sale) }))}</b> · profit after cost: <b>{money(net({ ...(f as unknown as Sale) }) - n("cogs"))}</b></p>
    </>}
    {kind === "item" && <>
      <div className="grid2"><Field label="SKU">{text("sku")}</Field><Field label="Date acquired">{date("acquired")}</Field></div>
      <Field label="Description">{text("desc", "Brand, color, style, item")}</Field>
      <div className="grid2"><Field label="Category"><Select value={str("cat")} onChange={v => s("cat", v)} options={LISTS.categories} /></Field><Field label="Size"><Select value={str("size")} onChange={v => s("size", v)} options={LISTS.sizes} /></Field></div>
      <div className="grid2"><Field label="Brand">{text("brand")}</Field><Field label="Cost paid">{num("cost")}</Field></div>
      <div className="grid2"><Field label="Source"><Select value={str("source")} onChange={v => s("source", v)} options={LISTS.sources} /></Field><Field label="Status"><Select value={str("status")} onChange={v => s("status", v)} options={LISTS.itemStatus} /></Field></div>
      <Field label="Where it's stored"><input type="text" list="tt-locations" autoComplete="off" value={str("location")} onChange={e => s("location", e.target.value)} placeholder="Bin 3, closet shelf, garage tote..." /></Field>
      <datalist id="tt-locations">{locations(data).map(l => <option key={l} value={l} />)}</datalist>
      <div className="grid2"><Field label="Listed on"><Select value={str("platform")} onChange={v => s("platform", v)} options={LISTS.platforms} allowBlank /></Field><Field label="Date listed">{date("listed")}</Field></div>
      <Field label="Outcome date (sold, donated...)">{date("outcome")}</Field>
      <Field label="Notes"><textarea value={str("notes")} onChange={e => s("notes", e.target.value)} /></Field>
    </>}
    {kind === "expense" && <>
      <div className="grid2"><Field label="Date">{date("date")}</Field><Field label="Amount">{num("amount")}</Field></div>
      <Field label="Category"><Select value={str("cat")} onChange={v => s("cat", v)} options={LISTS.expenseCats} /></Field>
      <div className="grid2"><Field label="Vendor">{text("vendor", "USPS, Walmart...")}</Field><Field label="Paid with"><Select value={str("paidWith")} onChange={v => s("paidWith", v)} options={LISTS.paidWith} /></Field></div>
      <Field label="What was it">{text("desc")}</Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: ".9rem" }}><input type="checkbox" checked={!!f.receipt} onChange={e => s("receipt", e.target.checked)} /> Receipt photo saved</label>
    </>}
    {kind === "time" && <>
      <div className="grid2"><Field label="Date">{date("date")}</Field><Field label="Minutes">{num("minutes", "5")}</Field></div>
      <Field label="Activity"><Select value={str("activity")} onChange={v => s("activity", v)} options={LISTS.activities} /></Field>
      <div className="chips">{[15, 30, 45, 60, 90, 120].map(m => <button key={m} type="button" className="chip" aria-pressed={n("minutes") === m} onClick={() => s("minutes", m)}>{m} min</button>)}</div>
      <Field label="Notes">{text("notes")}</Field>
    </>}
    {kind === "trip" && <>
      <div className="grid2"><Field label="Date">{date("date")}</Field><Field label="Miles (round trip)">{num("miles", "0.1")}</Field></div>
      <Field label="Purpose">{text("purpose", "Post office, thrift run...")}</Field>
      <p className="note" style={{ margin: 0 }}>Deduction at {money(data.settings.mileageRate)}/mile: <b>{money(n("miles") * data.settings.mileageRate)}</b></p>
    </>}
    {kind === "issue" && <>
      <div className="grid2"><Field label="Date">{date("date")}</Field><Field label="Type"><Select value={str("type")} onChange={v => s("type", v)} options={LISTS.issueTypes} /></Field></div>
      <div className="grid2"><Field label="SKU">{text("sku")}</Field><Field label="Platform"><Select value={str("platform")} onChange={v => s("platform", v)} options={LISTS.platforms} /></Field></div>
      <Field label="Money lost">{num("lost")}</Field>
      <Field label="What happened"><textarea value={str("what")} onChange={e => s("what", e.target.value)} /></Field>
      <Field label="What to do differently"><textarea value={str("next")} onChange={e => s("next", e.target.value)} /></Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: ".9rem" }}><input type="checkbox" checked={!!f.resolved} onChange={e => s("resolved", e.target.checked)} /> Resolved</label>
    </>}
    {kind === "listing" && <>
      <Field label="Description">{text("desc")}</Field>
      {/* First field after the description: this is what she needs when the item sells and has to be found. */}
      <Field label="Where it's stored"><input type="text" list="tt-locations" autoComplete="off" value={str("location")} onChange={e => s("location", e.target.value)} placeholder="Bin 1, closet shelf, garage tote..." /></Field>
      <datalist id="tt-locations">{locations(data).map(l => <option key={l} value={l} />)}</datalist>
      {linkedSale && <p className="note linknote">Sold {fmtDate(linkedSale.date)} for {money(linkedSale.price)}. To put it back on the rack, delete that sale in Sales.</p>}
      <div className="grid2"><Field label="Category"><Select value={str("cat")} onChange={v => s("cat", v)} options={LISTS.categories} /></Field><Field label="Size"><Select value={str("size")} onChange={v => s("size", v)} options={LISTS.sizes} /></Field></div>
      <div className="grid2"><Field label="Current price">{num("price")}</Field><Field label="Original price (if marked down)"><input type="number" min={0} step="0.01" value={f.orig == null ? "" : String(f.orig)} onChange={e => s("orig", e.target.value === "" ? null : parseFloat(e.target.value))} /></Field></div>
      <div className="grid2"><Field label="Posted date">{date("posted")}</Field><Field label="Status"><Select value={str("status")} onChange={v => s("status", v)} options={["Active", "Sold", "Removed", "Relisted"]} /></Field></div>
      <Field label="Depop link">{text("link", "https://www.depop.com/products/...")}</Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: ".9rem" }}><input type="checkbox" checked={!!f.boosted} onChange={e => s("boosted", e.target.checked)} /> Boosted</label>
    </>}
    </fieldset>
    {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
    <div className="actions">
      <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add"}</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      {/* Shortcut for an item that sold: opens the sale form prefilled and linked to this listing. */}
      {/* Also on a Sold listing with no sale yet (e.g. she cancelled the sale form after marking it sold). */}
      {kind === "listing" && editing && !linkedSale && /^(active|sold)$/i.test(str("status").trim()) && <button type="button" className="btn" disabled={busy} onClick={() => persist(false, true)}>Log sale</button>}
      {editing && (!confirmDel ? <button type="button" className="btn danger" disabled={busy} onClick={() => setConfirmDel(true)}>Delete</button> : <><span className="note">Really delete?</span><button type="button" className="btn danger" disabled={busy} onClick={() => persist(true)}>Yes, delete</button></>)}
    </div>
  </form>;
}
