import * as XLSX from "xlsx";
import type { Sale, Listing, Item, Expense, Trip, TimeRow, Issue } from "../types";

export function iso(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return new Date(v.getTime() - v.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : ""; }
  const t = Date.parse(String(v)); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}
export const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[$,]/g, "")); return isFinite(n) ? n : 0; };
const str = (v: unknown) => (v == null || v === "nan" ? "" : String(v).trim());
type Row = Record<string, unknown>;
function rowsFrom(ws: XLSX.WorkSheet, mustHave: string): Row[] {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });
  const h = grid.findIndex(r => r.some(c => String(c).trim() === mustHave));
  if (h < 0) return [];
  const head = grid[h].map(c => String(c).trim());
  return grid.slice(h + 1).filter(r => r.some(c => c !== "" && c != null)).map(r => { const o: Row = {}; head.forEach((k, i) => { if (k) o[k] = r[i]; }); return o; });
}
const pick = (o: Row, ...keys: string[]) => { for (const k of keys) { if (o[k] !== undefined && o[k] !== "") return o[k]; } return ""; };

export type Parsed = { sales?: Sale[]; listings?: Listing[]; inventory?: Item[]; expenses?: Expense[]; mileage?: Trip[]; time?: TimeRow[]; issues?: Issue[]; snapshot?: string; taxPct?: number; mileageRate?: number; kind: "tracker" | "depop" };

export function parseWorkbook(buf: ArrayBuffer, shopStart = "2026-08-01"): Parsed {
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const find = (re: RegExp) => wb.SheetNames.find(n => re.test(n));
  const out: Parsed = { kind: "depop" };
  const salesName = find(/^sales$/i) || find(/depop sales/i) || (wb.SheetNames.length === 1 ? wb.SheetNames[0] : undefined);
  if (salesName) {
    const rows = rowsFrom(wb.Sheets[salesName], "Date of sale");
    if (rows.length) out.sales = rows.filter(r => iso(r["Date of sale"])).map(r => ({
      date: iso(r["Date of sale"]), listed: iso(pick(r, "Date listed", "Date of listing")), brand: str(pick(r, "Brand")), cat: str(pick(r, "Category")), size: str(pick(r, "Size")),
      desc: str(pick(r, "Description")), price: num(pick(r, "Item price")), ship: num(pick(r, "Buyer shipping")), depopFee: num(pick(r, "Depop fee")), payFee: num(pick(r, "Payment fee", "Depop Payments fee")),
      boost: num(pick(r, "Boost fee", "Boosting fee")), usps: num(pick(r, "USPS cost", "USPS Cost")), refund: num(pick(r, "Refund", "Refunded to buyer amount")),
      feeBack: num(pick(r, "Fees refunded", "Fees refunded to seller")), cogs: num(pick(r, "Item cost (from Inventory)", "Item cost (COGS)")), state: str(pick(r, "State")),
      sku: str(pick(r, "SKU")), platform: str(pick(r, "Platform")) || "Depop", tax: num(pick(r, "Sales tax collected", "US Sales tax")), buyer: str(pick(r, "Buyer")) }));
  }
  const exp = find(/^expenses$/i); if (exp) { out.kind = "tracker"; out.expenses = rowsFrom(wb.Sheets[exp], "Amount").filter(r => num(r["Amount"])).map(r => ({ date: iso(r["Date"]), cat: str(pick(r, "Category")), vendor: str(pick(r, "Vendor")), desc: str(pick(r, "Description")), amount: num(r["Amount"]), paidWith: str(pick(r, "Paid with")), receipt: str(pick(r, "Receipt saved?")) === "Yes", notes: str(pick(r, "Notes")) })); }
  const mil = find(/^mileage$/i); if (mil) { const ws = wb.Sheets[mil]; const rate = num(ws["D1"]?.v); if (rate) out.mileageRate = rate; out.mileage = rowsFrom(ws, "Start").map(r => ({ date: iso(r["Date"]), purpose: str(pick(r, "Purpose (post office, sourcing, supplies)", "Purpose")), miles: num(r["End"]) - num(r["Start"]) })).filter(t => t.miles > 0); }
  const lst = find(/active listings/i); if (lst) { const ws = wb.Sheets[lst]; const snap = iso(ws["B1"]?.v); if (snap) out.snapshot = snap; out.listings = rowsFrom(ws, "Category").filter(r => str(pick(r, "Description"))).map(r => ({ cat: str(pick(r, "Category")), size: str(pick(r, "Size")), desc: str(pick(r, "Description")), orig: num(pick(r, "Original price")) || null, price: num(pick(r, "Current price")), posted: iso(pick(r, "Posted date (est.)", "Date")) || shopStart, exact: str(pick(r, "Date confidence")) !== "Estimated", boosted: str(pick(r, "Boosted")) === "Yes", link: str(pick(r, "Link")), status: str(pick(r, "Status")) || "Active" })); }
  const inv = find(/^inventory$/i); if (inv) out.inventory = rowsFrom(wb.Sheets[inv], "SKU").filter(r => str(r["SKU"]) && !/example row/i.test(str(r["Description"]))).map(r => ({ sku: str(r["SKU"]), acquired: iso(r["Date acquired"]), source: str(pick(r, "Source")), cost: num(r["Cost paid"]), cat: str(pick(r, "Category")), size: str(pick(r, "Size")), brand: str(pick(r, "Brand")), desc: str(pick(r, "Description")), platform: str(pick(r, "Listed on")), listed: iso(r["Date listed"]), status: str(pick(r, "Status")) || "Unlisted", outcome: iso(r["Outcome date"]), notes: str(pick(r, "Notes")) }));
  const tl = find(/^time log$/i); if (tl) out.time = rowsFrom(wb.Sheets[tl], "Minutes").filter(r => num(r["Minutes"]) > 0).map(r => ({ date: iso(r["Date"]), activity: str(pick(r, "Activity")) || "Other", minutes: num(r["Minutes"]), notes: str(pick(r, "Notes")) }));
  const iss = find(/^issues$/i); if (iss) out.issues = rowsFrom(wb.Sheets[iss], "Issue type").filter(r => iso(r["Date"]) || str(r["Issue type"])).map(r => ({ date: iso(r["Date"]), sku: str(pick(r, "SKU")), platform: str(pick(r, "Platform")), type: str(pick(r, "Issue type")) || "Other", lost: num(r["Amount lost"]), resolved: str(pick(r, "Resolved?")) === "Yes", what: str(pick(r, "What happened")), next: str(pick(r, "What to do differently")) }));
  const dash = find(/^dashboard$/i); if (dash) { const v = num(wb.Sheets[dash]["B29"]?.v); if (v > 0 && v < 1) out.taxPct = v; }
  if (!out.sales && !out.listings && !out.expenses && !out.inventory) throw new Error("No Sales, Expenses, Inventory or Active Listings tab was found. Use the tracker workbook or a Depop sales export.");
  return out;
}
// Key that identifies a Depop sale across repeated exports (so re-importing does not duplicate)
export const saleKey = (s: Sale) => [s.date, s.price.toFixed(2), s.buyer || "", s.desc.slice(0, 40)].join("|");
