import type { Sale } from "../types";
export const DAY = 86400000;
export const money = (n: number, d = 2) => (n < 0 ? "-" : "") + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
export const pct = (n: number) => (isFinite(n) ? Math.round(n * 100) + "%" : "–");
export const net = (s: Sale) => s.price - s.depopFee - s.payFee - s.boost - s.usps - s.refund + s.feeBack;
export const isKids = (size: string) => /year|month|\byrs?\b|^kids$/i.test(size || "");
export const isPlus = (size: string) => /^(XL|XXL|2XL|3XL|4XL|1X|2X|3X)$/i.test((size || "").trim());
export const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
// Days from listing to sale; NaN when either date is missing or the listed date is after the sale (bad data),
// so an impossible "-4 days" never counts as a fast sale.
export const daysToSell = (listed: string, sold: string) => { if (!listed || !sold) return NaN; const d = days(listed, sold); return d >= 0 ? d : NaN; };
export const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
export const fmtDate = (d: string) => (d ? new Date(d + "T12:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
// Monday of the week containing d; "" for a blank or invalid date (legacy records can be undated).
// Date-only math is done in UTC so the result is the same calendar date in every time zone.
export const weekOf = (d: string) => { const t = new Date(d + "T00:00:00Z"); if (!d || isNaN(t.getTime())) return ""; const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day); return t.toISOString().slice(0, 10); };
export const newSku = (existing: string[]) => { let n = existing.length + 1; let s; do { s = "TT-" + String(n).padStart(4, "0"); n++; } while (existing.includes(s)); return s; };
