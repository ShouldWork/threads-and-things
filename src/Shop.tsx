import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { askStore, resetAsk } from "./lib/askStore";
import type { User } from "firebase/auth";
import { demo, logout } from "./firebase";
import { useData } from "./hooks/useData";
import type { Row } from './lib/records';
const Home = lazy(() => import('./pages/Home'));
const Sales = lazy(() => import('./pages/Sales'));
const Closet = lazy(() => import('./pages/Closet'));
const Plan = lazy(() => import('./pages/Plan'));
const Learn = lazy(() => import('./pages/Learn'));
const More = lazy(() => import('./pages/More'));
import Form, { KIND_LABEL, type Kind, type NextSheet } from "./components/Forms";
import { I, Sheet, useToast } from "./components/ui";
import ErrorBoundary from "./components/ErrorBoundary";
import { isActiveListing } from "./lib/listingLinks";

const TABS: [string, string, JSX.Element][] = [["home", "Home", I.home], ["sales", "Sales", I.tag], ["closet", "Closet", I.hanger], ["plan", "Plan", I.chart], ["learn", "Learn", I.spark], ["more", "More", I.more]];
export default function Shop({user}: {user: User}) {
  const { data, ready, error, syncError, pending, fromCache,history,version,revision,role } = useData(user?.email || null);
  const [tab, setTabRaw] = useState(() => { const h = location.hash.slice(1); return TABS.some(t => t[0] === h) ? h : "home"; });
  const setTab = (id: string) => { setTabRaw(id); try { window.history.replaceState(null, "", "#" + id); } catch { /* ignore */ } window.scrollTo(0, 0); };
  const [sheet, setSheet] = useState<NextSheet | "pick" | null>(null);
  const { msg, toast } = useToast();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); addEventListener("online", on); addEventListener("offline", off); return () => { removeEventListener("online", on); removeEventListener("offline", off); }; }, []);

  useEffect(() => { setSheet(null); }, [user?.email]);
  // Ask AI keeps running across tabs; tell her when an answer lands while she's elsewhere. Clear it when this shop closes.
  const tabRef = useRef(tab); tabRef.current = tab;
  useEffect(() => {
    let seen = askStore.get().finished;
    const off = askStore.subscribe(() => {
      const s = askStore.get();
      if (s.finished !== seen) { seen = s.finished; if (tabRef.current !== "home") toast(s.err ? "Your AI question didn't go through. See Home." : "Your AI answer is ready on Home."); }
    });
    return () => { off(); resetAsk(); };
  }, [toast]);

  if (error) return <div className="wrap"><div className="login"><img src="/icon.png" alt="Threads and Things" /><h1>Could not open your shop</h1><p className="sub">{error}<br />Signed in as {user.email}. Ask Blake to add this email to the users list, then reload.</p><button type="button" className="btn" onClick={() => logout().catch(e => toast(e.message))}>Sign out</button></div></div>;
  if (!ready) return <div className="wrap"><p className="note" style={{ paddingTop: 20 }}>Loading your shop…</p></div>;

  const active = data.listings.filter(l => isActiveListing(l)).length;
  const openEdit = (kind: Kind, row: object) => setSheet({ kind, initial: row as Row });

  return <>
    <div className="wrap">
      {demo && <p className="note" role="status">Demo preview — changes stay in this tab.</p>}
      <header className="top">
        <div className="toprow">
          <div className="brand"><img src="/icon.png" alt="" /><span>Threads <i>&amp;</i> Things</span></div>
          <div className="pillstat">{data.sales.length} sold<br />{active} on the rack{(!online || pending || fromCache) && <><br /><span className="offline">{!online ? "offline" : pending ? "syncing changes" : "checking cloud data"}</span></>}</div>
        </div>      </header>
      {syncError && <p className="err" role="alert">{syncError}</p>}
      <main className="fade" key={tab}><ErrorBoundary><Suspense fallback={<p role="status">Opening page...</p>}>
        {tab === "home" && <Home data={data} go={setTab} openForm={kind => setSheet({ kind })} />}
        {tab === "sales" && <Sales data={data} onEdit={s => openEdit("sale", s)} />}
        {tab === "closet" && <Closet data={data} onEditItem={i => openEdit("item", i)} onEditListing={l => openEdit("listing", l)} />}
        {tab === "plan" && <Plan data={data} toast={toast} />}
        {tab === "learn" && <Learn data={data} />}
        {tab === "more" && <More data={data} email={user.email || ""} pending={pending} history={history} version={version} revision={revision} role={role} toast={toast} onEdit={openEdit} />}
      </Suspense></ErrorBoundary></main>
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
    {sheet && sheet !== "pick" && <Sheet key={(sheet.listingId || "") + sheet.kind + String(sheet.initial?.id || "")} title={(sheet.initial?.id ? "Edit " : "Add ") + KIND_LABEL[sheet.kind].toLowerCase()} onClose={() => setSheet(null)}>
      <Form key={(sheet.listingId || "") + sheet.kind + String(sheet.initial?.id || "")} kind={sheet.kind} data={data} initial={sheet.initial} listingId={sheet.listingId} onDone={(m, next) => { setSheet(next || null); if (m) toast(m); }} onCancel={() => setSheet(null)} />
    </Sheet>}
    {msg && <div className="toast" role="status">{msg}</div>}
  </>;
}
