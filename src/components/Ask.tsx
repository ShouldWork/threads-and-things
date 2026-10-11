import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Data } from "../types";
import { today } from "../lib/calc";
import { shopSummary, scrub } from "../lib/aiSummary";
import { I } from "./ui";

// [button label, question sent to the AI]
const PROMPTS: [string, string][] = [
  ["Help me refresh my oldest listing", "Look at the item that is listed the longest and provide suggestions to bring more attention to the item to sale. Suggest title and description changes."],
  ["How did this month go?", "How did this month go?"],
  ["What should I list more of?", "What should I list more of?"],
  ["What's not selling, and what should I do?", "What's not selling, and what should I do about it?"],
  ["Is boosting worth it for me?", "Is boosting worth it for me?"],
  ["Where is my money tied up?", "Where is my money tied up?"],
];

// Light formatting only (paragraphs, "- " bullets, **bold**), built as React nodes so model text is never injected as HTML.
const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => p.startsWith("**") && p.endsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : p);
export function formatAnswer(text: string): ReactNode[] {
  const out: ReactNode[] = []; let list: string[] = [];
  const flush = () => { if (list.length) out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; };
  for (const raw of text.replace(/[–—]/g, ", ").split("\n")) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) { list.push(line.replace(/^[-*•]\s+/, "")); continue; }
    flush();
    // Strip markdown headings ("## Title") but keep hashtags ("#lizclaiborne"); short "Label:" lines become bold labels.
    const clean = line.replace(/^#{1,6}\s+/, "");
    if (/^[^.!?#]{1,40}:$/.test(clean)) out.push(<p key={out.length} className="ans-label"><b>{clean.replace(/\*\*/g, "")}</b></p>);
    else if (clean) out.push(<p key={out.length}>{inline(clean)}</p>);
  }
  flush();
  return out;
}

export default function Ask({ data }: { data: Data }) {
  const [q, setQ] = useState("");
  const [asked, setAsked] = useState("");
  const [answer, setAnswer] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const asking = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!(busy || answer || err)) return;
    const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.current?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
  }, [busy, answer, err]);
  const formatted = useMemo(() => formatAnswer(answer), [answer]);

  async function ask(question: string, label = question) {
    const text = question.trim();
    if (!text || asking.current) return;
    asking.current = true; setBusy(true); setErr(""); setAnswer(""); setAsked(label.trim());
    try {
      const ai = await import("../ai");
      try { setAnswer(await ai.askShop(shopSummary(data, today()), scrub(text))); }
      catch (e) { setErr(ai.friendlyError(e)); }
    } catch { setErr("Ask needs an internet connection. Try again when you are back online."); }
    finally { asking.current = false; setBusy(false); }
  }

  return <>
    <section className="ask" aria-labelledby="ask-title">
      <div className="ask-head">
        <span className="ask-badge" aria-hidden="true">{I.spark}</span>
        <div><h2 id="ask-title">Ask AI about your shop</h2><p>Tap a question or type your own. It sees your shop totals and your listing text, never your buyer records. Please don't type buyer names.</p></div>
      </div>
      <div className="prompts" role="group" aria-label="Quick questions">
        {PROMPTS.map(([label, question]) => <button key={label} type="button" className="prompt" disabled={busy} onClick={() => { setQ(""); ask(question, label); }}>{I.spark}<span>{label}</span></button>)}
      </div>
      <form className="askbox" onSubmit={e => { e.preventDefault(); ask(q); }}>
        <input type="text" enterKeyHint="send" maxLength={300} value={q} onChange={e => setQ(e.target.value)} placeholder="Or type your own question..." aria-label="Your question" disabled={busy} />
        <button type="submit" className="btn primary" disabled={busy || !q.trim()} aria-label="Ask">{I.send}</button>
      </form>
    </section>
    {(busy || answer || err) && <div ref={card} className="card answer" aria-live="polite">
      {asked && <p className="asked">{asked}</p>}
      {busy && <p className="thinking" role="status"><span className="dots"><i /><i /><i /></span> Looking at your numbers... this can take up to two minutes.</p>}
      {err && <p className="err" role="alert">{err}</p>}
      {answer && <><div className="answer-body">{formatted}</div><p className="note ai-note">AI answer. Double-check numbers against your dashboard before acting on them.</p></>}
    </div>}
  </>;
}
