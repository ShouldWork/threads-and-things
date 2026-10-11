import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { configured, login, watchUser } from "./firebase";
import { useData } from "./hooks/useData";
import type { Sale, Item, Listing } from "./types";
import Home from "./pages/Home";
import Sales from "./pages/Sales";
import Closet from "./pages/Closet";
import Plan from "./pages/Plan";
import Learn from "./pages/Learn";
import More from "./pages/More";
import Form, { KIND_LABEL, type Kind } from "./components/Forms";
import { I, Sheet, useToast } from "./components/ui";

const TABS: [string, string, JSX.Element][] = [["home", "Home", I.home], ["sales", "Sales", I.tag], ["closet", "Closet", I.hanger], ["plan", "Plan", I.chart], ["learn", "Learn", I.spark], ["more", "More", I.more]];
const TITLES: Record<string, string> = { home: "Home", sales: "Sales", closet: "Closet", plan: "Plan", learn: "Learn", more: "More" };

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => watchUser(setUser), []);
  const { data, ready, error } = useData(user?.email || null);
  const [tab, setTabRaw] = useState(() => { const h = location.hash.slice(1); return TABS.some(t => t[0] === h) ? h : "home"; });
  const [crumb, setCrumbRaw] = useState("");
  const setCrumb = useCallback((s: string) => setCrumbRaw(s), []);
  const setTab = (id: string) => { setTabRaw(id); setCrumbRaw(""); try { history.replaceState(null, "", "#" + id); } catch { /* ignore */ } window.scrollTo(0, 0); };
  const [sheet, setSheet] = useState<{ kind: Kind; initial?: Record<string, unknown> } | "pick" | null>(null);
  const { msg, toast } = useToast();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); addEventListener("online", on); addEventListener("offline", off); return () => { removeEventListener("online", on); removeEventListener("offline", off); }; }, []);

  if (!configured) return <div className="wrap"><div className="login"><img src="/logo.png" alt="Threads and Things" /><h1>Almost there</h1><p className="sub">Firebase isn't configured yet. Copy <code>.env.example</code> to <code>.env</code>, paste the web app config from the Firebase console, and restart. The README walks through it.</p></div></div>;
  if (user === undefined) return <div className="wrap"><p className="note" style={{ paddingTop: 20 }}>Opening the shop…</p></div>;
  if (!user) return <div className="wrap"><div className="login"><img src="/logo.png" alt="Threads and Things" /><h1>Welcome back</h1><p className="sub">Sign in with the Google account Blake added for you.</p><button type="button" className="btn primary" onClick={() => login().catch(e => toast(e.message))}>Sign in with Google</button>{msg && <div className="toast">{msg}</div>}</div></div>;
  if (error) return <div className="wrap"><div className="login"><img src="/logo.png" alt="Threads and Things" /><h1>Not on the list</h1><p className="sub">{error}<br />Signed in as {user.email}. Ask Blake to add this email to the users list, then reload.</p><button type="button" className="btn" onClick={() => import("./firebase").then(m => m.logout())}>Sign out</button></div></div>;
  if (!ready) return <div className="wrap"><p className="note" style={{ paddingTop: 20 }}>Loading your shop…</p></div>;

  const active = data.listings.filter(l => /active/i.test(l.status)).length;
  const openEdit = (kind: Kind, row: Sale | Item | Listing) => setSheet({ kind, initial: row as unknown as Record<string, unknown> });

  return <>
    <div className="wrap">
      <header className="top">
        <div className="toprow">
          <div className="brand"><img src="/icon.png" alt="" /><span>Threads and Things</span></div>
          <div className="pillstat">{data.sales.length} sold<br />{active} on the rack{!online && <><br /><span className="offline">offline, will sync</span></>}</div>
        </div>
        <nav className="crumbs" aria-label="Where you are">
          <button type="button" onClick={() => setTab("home")}>Home</button>
          {tab !== "home" && <><span className="sep">›</span>{crumb ? <button type="button" onClick={() => setCrumbRaw("")}>{TITLES[tab]}</button> : <b>{TITLES[tab]}</b>}</>}
          {crumb && <><span className="sep">›</span><b>{crumb}</b></>}
        </nav>
      </header>
      <main className="fade" key={tab}>
        {tab === "home" && <Home data={data} go={setTab} openAdd={() => setSheet("pick")} />}
        {tab === "sales" && <Sales data={data} setCrumb={setCrumb} onEdit={s => openEdit("sale", s)} />}
        {tab === "closet" && <Closet data={data} setCrumb={setCrumb} onEditItem={i => openEdit("item", i)} onEditListing={l => openEdit("listing", l)} />}
        {tab === "plan" && <Plan data={data} setCrumb={setCrumb} toast={toast} />}
        {tab === "learn" && <Learn data={data} setCrumb={setCrumb} />}
        {tab === "more" && <More data={data} email={user.email || ""} toast={toast} />}
      </main>
    </div>
    <button type="button" className="fab" aria-label="Add something" onClick={() => setSheet("pick")}>+</button>
    <nav className="tabs" aria-label="Sections">
      {TABS.map(([id, label, icon]) => <button key={id} type="button" className="tab" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>{icon}{label}<span className="dot" /></button>)}
    </nav>
    {sheet === "pick" && <Sheet title="What happened?" onClose={() => setSheet(null)}>
      <div className="quick" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {(Object.keys(KIND_LABEL) as Kind[]).map(k => <button key={k} type="button" onClick={() => setSheet({ kind: k })}>{{ sale: I.tag, item: I.box, expense: I.more, time: I.clock, trip: I.refresh, issue: I.heart, listing: I.hanger }[k]}{KIND_LABEL[k]}</button>)}
      </div>
      <p className="note" style={{ marginTop: 12 }}>Sale: something sold. Inventory item: something new came in. Time: minutes spent on the shop.</p>
    </Sheet>}
    {sheet && sheet !== "pick" && <Sheet title={(sheet.initial?.id ? "Edit " : "Add ") + KIND_LABEL[sheet.kind].toLowerCase()} onClose={() => setSheet(null)}>
      <Form kind={sheet.kind} data={data} initial={sheet.initial} onDone={m => { setSheet(null); toast(m); }} onCancel={() => setSheet(null)} />
    </Sheet>}
    {msg && <div className="toast" role="status">{msg}</div>}
  </>;
}
