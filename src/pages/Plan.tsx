import { useEffect, useMemo, useState } from "react";
import type { Data } from "../types";
import { money, pct, today } from "../lib/calc";
import { monthly, runRate, forecast, goalPlan, monthLabel, BASIS_LABEL, type Basis } from "../lib/projections";
import { Kpi, Chips, Bars, Tip } from "../components/ui";
import { saveSettings } from "../hooks/useData";

export default function Plan({ data, setCrumb, toast }: { data: Data; setCrumb: (s: string) => void; toast: (s: string) => void }) {
  const [basis, setBasis] = useState<Basis>("30");
  const asOf = today();
  useEffect(() => { setCrumb(BASIS_LABEL[basis]); }, [basis, setCrumb]);
  const rr = useMemo(() => runRate(data, basis, asOf), [data, basis, asOf]);
  const f = useMemo(() => forecast(data, rr, asOf), [data, rr, asOf]);
  const months = useMemo(() => monthly(data, asOf), [data, asOf]);
  const [goal, setGoal] = useState(String(data.settings.goalMonthly || ""));
  useEffect(() => { setGoal(String(data.settings.goalMonthly || "")); }, [data.settings.goalMonthly]);
  const target = data.settings.goalMonthly;
  const g = useMemo(() => (target > 0 ? goalPlan(data, rr, target) : null), [data, rr, target]);
  const basisNote = `${rr.sold} sales over ${rr.days} days (${rr.from} to ${rr.to})`;
  const last6 = months.slice(-6);

  return <>
    <h1>Plan</h1><p className="sub">Where the shop is heading if it keeps doing what it is doing now. Change the basis to see how much the answer depends on the window.</p>
    <div style={{ marginTop: 10 }}><Chips value={basis} onChange={setBasis} label="Basis" options={(Object.keys(BASIS_LABEL) as Basis[]).map(k => [k, BASIS_LABEL[k]])} /></div>
    {rr.sample === "none" && <div className="insight bad"><b>No sales in this window</b>Projections need at least a few sales. Try a wider basis or log recent sales.</div>}
    {rr.sample === "thin" && <div className="insight gold"><b>Thin sample: {rr.sold} sales</b>Under 10 sales, one good week swings every number below. Treat these as a sketch until the shop has more history.</div>}

    <div className="kpis" style={{ marginTop: 6 }}>
      <Kpi hero tip="next30" label="Projected profit, next 30 days" value={money(f.next30.profit)} detail={`about ${f.next30.sold} sales · basis: ${basisNote}`} />
      <Kpi tip="next90" label="Next 90 days" value={money(f.next90.profit)} detail={`about ${f.next90.sold} sales`} />
      <Kpi tip="yearend" label={`${f.yearEnd.year} year end`} value={money(f.yearEnd.projected)} detail={`${money(f.yearEnd.toDate)} so far, ${f.yearEnd.remainingDays} days left`} />
      <Kpi tip="pace" label="Sales per week" value={(rr.perDay * 7).toFixed(1)} detail={`${money(rr.avgProfit)} profit per sale`} />
      <Kpi tip="monthpace" label="Profit per month, current pace" value={money(rr.profitPerDay * 30.4)} detail={`${money(rr.overhead / rr.days * 30.4, 0)} of costs per month`} />
    </div>

    <h2>What the rack is worth</h2>
    <div className="kpis" style={{ marginTop: 0 }}>
      <Kpi tip="rackvalue" label="Expected payout" value={money(f.rack.expectedPayout)} detail={`${f.rack.active} listings asking ${money(f.rack.asking, 0)}`} />
      <Kpi tip="clear" label="Days to clear the rack" value={f.rack.daysToClear == null ? "–" : String(f.rack.daysToClear)} detail={`at ${(rr.perDay * 7).toFixed(1)} sales a week`} />
      <Kpi tip="thru" label="Sell-through" value={pct(f.rack.sellThrough)} />
      <Kpi tip="feerate" label="Fees take" value={pct(rr.feeRate)} />
    </div>

    <h2>Goal</h2>
    <div className="card" style={{ marginTop: 0 }}>
      <div className="form" style={{ marginTop: 0 }}>
        <div className="grid2" style={{ alignItems: "end" }}>
          <div className="field"><label>Profit target per month</label><input type="number" inputMode="decimal" step="10" min={0} value={goal} onChange={e => setGoal(e.target.value)} placeholder="300" /></div>
          <button type="button" className="btn primary" onClick={async () => { const v = Math.max(0, parseFloat(goal) || 0); await saveSettings({ goalMonthly: v }); toast(v ? "Goal saved." : "Goal cleared."); }}>Save goal</button>
        </div>
      </div>
      {!g && <p className="note" style={{ margin: "10px 0 0" }}>Set a monthly profit target and this works out how many sales, listings, dollars of inventory and hours it takes at your current numbers.</p>}
      {g && <>
        <div className={"insight " + (g.onTrack ? "good" : "")} style={{ marginBottom: 0 }}>
          <b>{g.onTrack ? `On pace: ${money(g.currentMonthly)} a month against ${money(g.target)}` : `${money(g.gap)} a month short of ${money(g.target)}`}</b>
          {g.onTrack ? "Keep listing at this rate. Watch the thin-sample warning if it appears." : `Current pace is ${money(g.currentMonthly)} a month after about ${money(g.overheadMonthly)} of costs.`}
        </div>
        <table style={{ marginTop: 8 }}><tbody>
          <tr><td>Sales needed per month</td><td>{g.salesNeeded}</td></tr>
          <tr><td>That is per week</td><td>{g.perWeek}</td></tr>
          <tr><td>Profit per sale (basis)</td><td>{money(g.avgProfit)}</td></tr>
          <tr><td>Listings to have up, at {pct(g.sellThrough)} sell-through</td><td>{g.listingsNeeded ?? "–"}</td></tr>
          <tr><td>Cash into inventory for those listings</td><td>{g.cashNeeded == null ? "–" : money(g.cashNeeded)}</td></tr>
          <tr><td>Hours per month, at {g.profitPerHour == null ? "no time logged" : money(g.profitPerHour) + "/hour"}</td><td>{g.hoursNeeded ?? "–"}</td></tr>
        </tbody></table>
        {g.cashNeeded === 0 && g.listingsNeeded != null && <p className="note" style={{ margin: "8px 0 0" }}>Cash shows $0 because sales in this window have no item cost logged. Add costs on inventory items and it fills in.</p>}
      </>}
    </div>

    <h2>Profit by month</h2>
    <div className="card" style={{ marginTop: 0 }}>
      {last6.some(m => m.sold) ? <Bars data={last6.map(m => ({ label: monthLabel(m.month), value: m.profit }))} fmt={n => money(n, 0)} /> : <div className="empty"><b>No months yet</b>Log a sale and this fills in.</div>}
    </div>
    <div className="card scroll"><Tip k="pl" /><h3>Month by month</h3>
      <table><thead><tr><th>Month</th><th>Sold</th><th>Listed</th><th>Gross</th><th>Fees</th><th>Payout</th><th>Cost of items</th><th>Costs</th><th>Profit</th><th>Margin</th></tr></thead>
        <tbody>{months.slice().reverse().map(m => <tr key={m.month}><td>{monthLabel(m.month)}</td><td>{m.sold}</td><td>{m.listed}</td><td>{money(m.gross, 0)}</td><td>{money(m.fees, 0)}</td><td>{money(m.payout, 0)}</td><td>{money(m.cogs, 0)}</td><td>{money(m.costs, 0)}</td><td style={{ fontWeight: 800, color: m.profit < 0 ? "var(--bad)" : "inherit" }}>{money(m.profit, 0)}</td><td>{m.gross ? pct(m.margin) : "–"}</td></tr>)}</tbody>
        <tfoot><tr><th>Total</th><th>{months.reduce((a, m) => a + m.sold, 0)}</th><th>{months.reduce((a, m) => a + m.listed, 0)}</th><th>{money(months.reduce((a, m) => a + m.gross, 0), 0)}</th><th>{money(months.reduce((a, m) => a + m.fees, 0), 0)}</th><th>{money(months.reduce((a, m) => a + m.payout, 0), 0)}</th><th>{money(months.reduce((a, m) => a + m.cogs, 0), 0)}</th><th>{money(months.reduce((a, m) => a + m.costs, 0), 0)}</th><th>{money(months.reduce((a, m) => a + m.profit, 0), 0)}</th><th /></tr></tfoot>
      </table>
      <p className="note" style={{ margin: "8px 0 0" }}>Listed counts sales by the date they were listed plus active listings with an exact date. Expenses without a date are left out of every month.</p>
    </div>
  </>;
}
