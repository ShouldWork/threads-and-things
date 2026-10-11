import { useEffect, useState } from "react";
import { today } from "./calc";

// Today's local date (YYYY-MM-DD) that updates on its own: at local midnight, and whenever she comes back to the
// tab or app (a phone can sleep through midnight with the page open). Screens that filter by "today" use this.
export function useToday(): string {
  const [date, setDate] = useState(today);
  useEffect(() => {
    const refresh = () => setDate(d => (d === today() ? d : today()));
    const msToMidnight = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1).getTime() - n.getTime() + 1000; };
    let timer = setTimeout(function tick() { refresh(); timer = setTimeout(tick, msToMidnight()); }, msToMidnight());
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible); window.addEventListener("focus", refresh);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", refresh); };
  }, []);
  return date;
}
