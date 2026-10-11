import { useState } from "react";
import type { Data, Sale } from "../types";
import { parseWorkbook, saleKey } from "../lib/parse";
import { parseDepopListingsHtml } from "../lib/depopHtml";
import { addMany, replaceAll, saveSettings, currentShop } from "../hooks/useData";
import { logout } from "../firebase";
import { money, today } from "../lib/calc";
import { Field } from "../components/ui";

export default function More({ data, email, toast }: { data: Data; email: string; toast: (s: string) => void }) {
  const [busy, setBusy] = useState(""); const [err, setErr] = useState("");
  const [name, setName] = useState(data.settings.name); const [taxPct, setTaxPct] = useState(Math.round(data.settings.taxPct * 100)); const [rate, setRate] = useState(data.settings.mileageRate);

  async function importFile(f: File | null | undefined, mode: "merge" | "replace") {
    if (!f) return; setErr(""); setBusy("Reading file…");
    try {
      if (/\.html?$/i.test(f.name)) {
        const rows = parseDepopListingsHtml(await f.text(), data.settings.shopStart);
        if (!rows.length) throw new Error("No listings found in that page. Save the Selling hub › Active page after clicking Load more until it is gone.");
        setBusy(`Saving ${rows.length} listings…`);
        await replaceAll("listings", data.listings.map(l => l.id!), rows);
        await saveSettings({ snapshot: today() });
        toast(`${rows.length} listings loaded. Snapshot date set to today.`); setBusy(""); return;
      }
      const p = parseWorkbook(await f.arrayBuffer(), data.settings.shopStart);
      let msg: string[] = [];
      if (p.sales) {
        if (mode === "replace") { setBusy("Replacing sales…"); await replaceAll("sales", data.sales.map(s => s.id!), p.sales); msg.push(`${p.sales.length} sales`); }
        else { const have = new Set(data.sales.map(saleKey)); const fresh = p.sales.filter(s => !have.has(saleKey(s))); setBusy(`Adding ${fresh.length} new sales…`); await addMany("sales", fresh as Sale[]); msg.push(`${fresh.length} new sales (${p.sales.length - fresh.length} already here)`); }
      }
      if (p.kind === "tracker") {
        if (p.listings) { await replaceAll("listings", data.listings.map(l => l.id!), p.listings); msg.push(`${p.listings.length} listings`); }
        if (p.inventory?.length) { await replaceAll("inventory", data.inventory.map(i => i.id!), p.inventory); msg.push(`${p.inventory.length} inventory`); }
        if (p.expenses) { await replaceAll("expenses", data.expenses.map(e => e.id!), p.expenses); msg.push(`${p.expenses.length} expenses`); }
        if (p.mileage) { await replaceAll("mileage", data.mileage.map(t => t.id!), p.mileage); msg.push(`${p.mileage.length} trips`); }
        if (p.time) { await replaceAll("time", data.time.map(t => t.id!), p.time); msg.push(`${p.time.length} time rows`); }
        if (p.issues) { await replaceAll("issues", data.issues.map(i => i.id!), p.issues); msg.push(`${p.issues.length} issues`); }
        const s: Record<string, unknown> = {}; if (p.snapshot) s.snapshot = p.snapshot; if (p.taxPct) s.taxPct = p.taxPct; if (p.mileageRate) s.mileageRate = p.mileageRate; if (Object.keys(s).length) await saveSettings(s);
      }
      toast("Imported: " + msg.join(", "));
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Import failed."); }
    setBusy("");
  }
  function exportCsv() {
    const cols = ["date", "listed", "platform", "sku", "brand", "cat", "size", "desc", "price", "ship", "depopFee", "payFee", "boost", "usps", "refund", "feeBack", "cogs", "tax", "state"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...data.sales.map(s => cols.map(c => esc((s as unknown as Record<string, unknown>)[c])).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = `threads-and-things-sales-${today()}.csv`; a.click();
  }
  return <>
    <h1>More</h1><p className="sub">Imports, settings and your account.</p>

    <div className="card"><h3>Import a Depop sales export</h3>
      <p style={{ margin: "0 0 8px" }}>Selling hub › Sales › Export on Depop. New sales are added; ones already here are skipped.</p>
      <label className="btn primary" style={{ display: "inline-block", cursor: "pointer" }}>Choose export file<input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e => importFile(e.target.files?.[0], "merge")} /></label>
    </div>
    <div className="card"><h3>Import your Depop listings page</h3>
      <p style={{ margin: "0 0 8px" }}>On a computer: Selling hub › Active, click <b>Load more</b> until it disappears, then save the page (Ctrl+S, "Webpage, Complete"). Load the .html file here. This replaces the listings list and sets the snapshot date to today.</p>
      <label className="btn" style={{ display: "inline-block", cursor: "pointer" }}>Choose saved page<input type="file" accept=".html,.htm" hidden onChange={e => importFile(e.target.files?.[0], "replace")} /></label>
    </div>
    <div className="card"><h3>Import the tracker spreadsheet</h3>
      <p style={{ margin: "0 0 8px" }}>One-time move from the Excel/Google Sheets tracker. Sales are merged; inventory, expenses, mileage, time, issues and listings are <b>replaced</b> with what is in the file.</p>
      <label className="btn" style={{ display: "inline-block", cursor: "pointer" }}>Choose tracker .xlsx<input type="file" accept=".xlsx" hidden onChange={e => importFile(e.target.files?.[0], "merge")} /></label>
    </div>
    {busy && <p className="note" role="status">{busy}</p>}{err && <p className="err" role="alert">{err}</p>}

    <div className="card"><h3>Settings</h3>
      <div className="form" style={{ marginTop: 4 }}>
        <Field label="Your first name"><input value={name} onChange={e => setName(e.target.value)} /></Field>
        <div className="grid2"><Field label="Tax set-aside %"><input type="number" min={0} max={60} value={taxPct} onChange={e => setTaxPct(parseInt(e.target.value) || 0)} /></Field><Field label="Mileage rate $/mile"><input type="number" step="0.01" value={rate} onChange={e => setRate(parseFloat(e.target.value) || 0)} /></Field></div>
        <p className="note" style={{ margin: 0 }}>Listings snapshot date: {data.settings.snapshot}. Set automatically when you import a listings page.</p>
        <div className="actions"><button type="button" className="btn primary" onClick={async () => { await saveSettings({ name: name || "there", taxPct: taxPct / 100, mileageRate: rate }); toast("Settings saved."); }}>Save settings</button></div>
      </div>
    </div>
    <div className="card"><h3>Your data</h3>
      <table><tbody>
        <tr><td>Sales</td><td>{data.sales.length}</td></tr><tr><td>Listings</td><td>{data.listings.length}</td></tr><tr><td>Inventory</td><td>{data.inventory.length}</td></tr>
        <tr><td>Expenses</td><td>{data.expenses.length} ({money(data.expenses.reduce((a, e) => a + e.amount, 0))})</td></tr><tr><td>Time / mileage / issues</td><td>{data.time.length} / {data.mileage.length} / {data.issues.length}</td></tr>
      </tbody></table>
      <div className="actions"><button type="button" className="btn" onClick={exportCsv}>Download sales as CSV</button></div>
    </div>
    <div className="card"><h3>Account</h3><p style={{ margin: "0 0 8px" }}>Signed in as {email}. Shop: <b>{currentShop()}</b>. Data saves to the cloud instantly and works offline until you reconnect.</p><button type="button" className="btn" onClick={logout}>Sign out</button></div>
  </>;
}
