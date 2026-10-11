import { useState } from "react";
import { LISTS, type Data, type Sale, type Item, type Expense, type Trip, type TimeRow, type Issue, type Listing } from "../types";
import { today, newSku, net, money } from "../lib/calc";
import { add, update, remove, type ColName } from "../hooks/useData";
import { Field, Select } from "./ui";

export type Kind = "sale" | "item" | "expense" | "time" | "trip" | "issue" | "listing";
export const KIND_LABEL: Record<Kind, string> = { sale: "Sale", item: "Inventory item", expense: "Expense", time: "Time", trip: "Mileage", issue: "Issue", listing: "Listing" };
const COL: Record<Kind, ColName> = { sale: "sales", item: "inventory", expense: "expenses", time: "time", trip: "mileage", issue: "issues", listing: "listings" };

type Props = { kind: Kind; data: Data; initial?: Partial<Sale & Item & Expense & Trip & TimeRow & Issue & Listing> & { id?: string }; onDone: (msg: string) => void; onCancel: () => void };

export default function Form({ kind, data, initial, onDone, onCancel }: Props) {
  const editing = !!initial?.id;
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const defaults: Record<Kind, object> = {
    sale: { date: today(), listed: "", brand: "", cat: "Tops", size: "M", desc: "", price: 0, ship: 0, depopFee: 0, payFee: 0, boost: 0, usps: 0, refund: 0, feeBack: 0, cogs: 0, state: "", sku: "", platform: "Depop", tax: 0 },
    item: { sku: newSku(data.inventory.map(i => i.sku)), acquired: today(), source: "Thrift store", cost: 0, cat: "Tops", size: "M", brand: "", desc: "", platform: "Depop", listed: "", status: "Unlisted", outcome: "", notes: "" },
    expense: { date: today(), cat: "Packing supplies", vendor: "", desc: "", amount: 0, paidWith: "Business checking", receipt: false, notes: "" },
    time: { date: today(), activity: "Listing", minutes: 30, notes: "" },
    trip: { date: today(), purpose: "Post office", miles: 0 },
    issue: { date: today(), sku: "", platform: "Depop", type: "Refund issued", lost: 0, resolved: false, what: "", next: "" },
    listing: { cat: "Tops", size: "M", desc: "", orig: null, price: 0, posted: today(), exact: true, boosted: false, link: "", status: "Active" },
  };
  // "boosted" on a sale is a form-only switch (the saved field is the boost fee); on a listing it is a real field.
  const [f, setF] = useState<Record<string, unknown>>({ ...defaults[kind], ...(initial || {}), ...(kind === "sale" && initial ? { boosted: Number(initial.boost || 0) > 0 } : {}) });
  const s = (k: string, v: unknown) => setF(o => ({ ...o, [k]: v }));
  const str = (k: string) => String(f[k] ?? ""); const n = (k: string) => Number(f[k] ?? 0);
  const num = (k: string, step = "0.01") => <input type="number" inputMode="decimal" step={step} value={f[k] == null ? "" : String(f[k])} onChange={e => s(k, e.target.value === "" ? 0 : parseFloat(e.target.value))} />;
  const text = (k: string, ph = "") => <input type="text" value={str(k)} onChange={e => s(k, e.target.value)} placeholder={ph} />;
  const date = (k: string) => <input type="date" value={str(k)} onChange={e => s(k, e.target.value)} />;

  // Sale helper: estimate Depop fees from price + shipping if the user hasn't entered them
  const estimateFees = () => { const price = n("price"); const ship = n("ship"); const tax = n("tax"); const pay = Math.round((0.033 * (price + ship + tax) + 0.45) * 100) / 100; s("payFee", pay); if (f.boosted) s("boost", Math.round(price * 0.12 * 100) / 100); };
  const skuMatch = kind === "sale" && str("sku") ? data.inventory.find(i => i.sku === str("sku")) : undefined;

  async function save() {
    setBusy(true); setErr("");
    try {
      const row: Record<string, unknown> = { ...f }; if (kind === "sale") delete row.boosted;
      if (kind === "sale") { if (!row.desc && !row.price) throw new Error("Add at least a description or a price."); if (skuMatch && !row.cogs) row.cogs = skuMatch.cost; }
      if (kind === "item" && !row.sku) throw new Error("Every item needs a SKU.");
      if (kind === "expense" && !n("amount")) throw new Error("Enter an amount.");
      if (kind === "time" && !n("minutes")) throw new Error("Enter minutes.");
      if (kind === "trip" && !n("miles")) throw new Error("Enter miles.");
      if (editing) await update(COL[kind], initial!.id!, row); else await add(COL[kind], row);
      // When a sale is logged against a SKU, mark that inventory item sold
      if (kind === "sale" && skuMatch && skuMatch.id && !/sold/i.test(skuMatch.status)) await update("inventory", skuMatch.id, { status: "Sold", outcome: str("date") });
      onDone(editing ? "Saved." : `${KIND_LABEL[kind]} added.`);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Could not save."); }
    setBusy(false);
  }
  async function del() { if (!initial?.id) return; setBusy(true); try { await remove(COL[kind], initial.id); onDone("Deleted."); } catch { setErr("Could not delete."); setBusy(false); } }

  return <form className="form" onSubmit={e => { e.preventDefault(); save(); }}>
    {kind === "sale" && <>
      <div className="grid2"><Field label="Date sold">{date("date")}</Field><Field label="Platform"><Select value={str("platform")} onChange={v => s("platform", v)} options={LISTS.platforms} /></Field></div>
      <Field label="Description">{text("desc", "Brand, color, style, item, size")}</Field>
      <div className="grid2"><Field label="Category"><Select value={str("cat")} onChange={v => s("cat", v)} options={LISTS.categories} /></Field><Field label="Size"><Select value={str("size")} onChange={v => s("size", v)} options={LISTS.sizes} /></Field></div>
      <div className="grid2"><Field label="Brand">{text("brand")}</Field><Field label="SKU (from inventory)">{text("sku", "TT-0001")}</Field></div>
      {skuMatch && <p className="note" style={{ margin: 0 }}>Matched inventory: {skuMatch.desc || skuMatch.brand} (cost {money(skuMatch.cost)}). It will be marked Sold.</p>}
      <div className="grid2"><Field label="Item price">{num("price")}</Field><Field label="Buyer paid shipping">{num("ship")}</Field></div>
      <div className="grid2"><Field label="Sales tax collected">{num("tax")}</Field><Field label="Date listed">{date("listed")}</Field></div>
      <div className="actions"><button type="button" className="btn small" onClick={estimateFees}>Estimate Depop fees</button><label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".85rem", fontWeight: 700 }}><input type="checkbox" checked={!!f.boosted} onChange={e => { s("boosted", e.target.checked); if (!e.target.checked) s("boost", 0); }} /> Boosted</label></div>
      <div className="grid2"><Field label="Payment fee">{num("payFee")}</Field><Field label="Boost fee">{num("boost")}</Field></div>
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
      <div className="grid2"><Field label="Category"><Select value={str("cat")} onChange={v => s("cat", v)} options={LISTS.categories} /></Field><Field label="Size"><Select value={str("size")} onChange={v => s("size", v)} options={LISTS.sizes} /></Field></div>
      <div className="grid2"><Field label="Current price">{num("price")}</Field><Field label="Original price (if marked down)"><input type="number" step="0.01" value={f.orig == null ? "" : String(f.orig)} onChange={e => s("orig", e.target.value === "" ? null : parseFloat(e.target.value))} /></Field></div>
      <div className="grid2"><Field label="Posted date">{date("posted")}</Field><Field label="Status"><Select value={str("status")} onChange={v => s("status", v)} options={["Active", "Sold", "Removed", "Relisted"]} /></Field></div>
      <Field label="Depop link">{text("link", "https://www.depop.com/products/...")}</Field>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: ".9rem" }}><input type="checkbox" checked={!!f.boosted} onChange={e => s("boosted", e.target.checked)} /> Boosted</label>
    </>}
    {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
    <div className="actions">
      <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add"}</button>
      <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      {editing && (!confirmDel ? <button type="button" className="btn danger" onClick={() => setConfirmDel(true)}>Delete</button> : <><span className="note">Really delete?</span><button type="button" className="btn danger" onClick={del}>Yes, delete</button></>)}
    </div>
  </form>;
}
