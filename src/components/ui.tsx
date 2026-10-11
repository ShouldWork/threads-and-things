import { useEffect, useState, type ReactNode } from "react";
import { TIPS } from "../lib/tips";

export function Tip({ k }: { k: keyof typeof TIPS }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest?.(".tipwrap")) setOpen(false); }; document.addEventListener("click", h); return () => document.removeEventListener("click", h); }, [open]);
  return <span className="tipwrap"><button type="button" className="tip" aria-label="What does this mean?" aria-expanded={open} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>?</button>{open && <div className="pop" role="tooltip">{TIPS[k]}</div>}</span>;
}

export function Kpi({ label, value, tip, detail, hero, color }: { label: string; value: ReactNode; tip?: keyof typeof TIPS; detail?: string; hero?: boolean; color?: string }) {
  return <div className={"kpi" + (hero ? " hero" : "")}>{tip && <Tip k={tip} />}<div className="l">{label}</div><div className="v" style={color ? { color } : undefined}>{value}</div>{detail && <div className="d">{detail}</div>}</div>;
}

export function Chips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: [T, string][]; label: string }) {
  return <div className="chips" role="group" aria-label={label}>{options.map(([k, l]) => <button key={k} type="button" className="chip" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>;
}

export function Bars({ data, fmt, height = 170, color = "var(--rose)" }: { data: { label: string; value: number; hi?: boolean }[]; fmt: (n: number) => string; height?: number; color?: string }) {
  const W = 340, H = height, pad = 22, top = 16; const max = Math.max(1, ...data.map(d => d.value)); const bw = (W - 8) / Math.max(1, data.length);
  return <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img">
    {[.25, .5, .75, 1].map(f => <line key={f} x1="0" x2={W} y1={H - pad - (H - pad - top) * f} y2={H - pad - (H - pad - top) * f} stroke="var(--line)" strokeDasharray="2 4" />)}
    <line x1="0" x2={W} y1={H - pad} y2={H - pad} stroke="var(--line)" />
    {data.map((d, i) => { const h = (H - pad - top) * d.value / max; const x = 4 + i * bw + bw * .15; return <g key={d.label}><rect x={x} y={H - pad - h} width={bw * .7} height={h} rx="7" fill={d.hi ? "var(--gold)" : color} /><text className="val" x={x + bw * .35} y={H - pad - h - 4} textAnchor="middle">{fmt(d.value)}</text><text x={x + bw * .35} y={H - 6} textAnchor="middle">{d.label}</text></g>; })}
  </svg>;
}
export function HBars({ data, fmt, max: mx }: { data: { label: string; value: number; sub?: string; tone?: string }[]; fmt: (n: number) => string; max?: number }) {
  const max = mx ?? Math.max(1e-9, ...data.map(d => d.value));
  return <div style={{ display: "grid", gap: 9 }}>{data.map(d => <div key={d.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,8.5rem) 1fr auto", gap: 8, alignItems: "center", fontSize: ".85rem", fontWeight: 700 }}>
    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
    <span style={{ background: "var(--rose-soft)", borderRadius: 8, height: 13, overflow: "hidden" }}><span style={{ display: "block", height: "100%", width: `${Math.min(100, 100 * d.value / max)}%`, background: d.tone || "var(--rose)", borderRadius: 8 }} /></span>
    <span style={{ fontFamily: "var(--mono)", fontSize: ".8rem", minWidth: "3.2rem", textAlign: "right", fontWeight: 500 }}>{fmt(d.value)}{d.sub ? <span className="note"> {d.sub}</span> : null}</span></div>)}</div>;
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; document.addEventListener("keydown", h); return () => document.removeEventListener("keydown", h); }, [onClose]);
  return <div className="sheet" onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={{ margin: 0 }}>{title}</h2><button type="button" className="btn small" onClick={onClose}>Close</button></div>{children}</div></div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="field"><label>{label}</label>{children}</div>; }
export function Select({ value, onChange, options, allowBlank }: { value: string; onChange: (v: string) => void; options: string[]; allowBlank?: boolean }) {
  return <select value={value} onChange={e => onChange(e.target.value)}>{allowBlank && <option value="">–</option>}{options.map(o => <option key={o}>{o}</option>)}</select>;
}

export function useToast() { const [msg, setMsg] = useState(""); useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(""), 2600); return () => clearTimeout(t); }, [msg]); return { msg, toast: setMsg }; }

export const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" /></svg>,
  tag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor" /></svg>,
  hanger: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4a2 2 0 0 1 1 3.7V9l8 5v3H3v-3l8-5V8" /></svg>,
  spark: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z" /></svg>,
  more: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="5" cy="12" r="1.6" fill="currentColor" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /><circle cx="19" cy="12" r="1.6" fill="currentColor" /></svg>,
  clock: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>,
  refresh: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" /></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" /></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M3 8l9-4 9 4-9 4zM3 8v8l9 4 9-4V8M12 12v8" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19h16M6 16l4-5 3 3 5-7" /><path d="M15 7h3v3" /></svg>,
};
