// Ask AI state lives here, outside the Home page, so a question keeps going and its answer survives
// switching tabs (Home unmounts on every tab change). Cleared when the signed-in shop closes (Shop unmount).
export type AskState = { asked: string; answer: string; err: string; busy: boolean; finished: number };
const initial: AskState = { asked: "", answer: "", err: "", busy: false, finished: 0 };
let state = initial;
let generation = 0; // bumps on reset so a late answer for a previous session is dropped
const subs = new Set<() => void>();
const set = (patch: Partial<AskState>) => { state = { ...state, ...patch }; subs.forEach(f => f()); };

export const askStore = {
  get: () => state,
  subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; },
};

// run resolves to the answer text or throws; toError turns a failure into a message for her.
export async function startAsk(label: string, run: () => Promise<string>, toError: (e: unknown) => string) {
  if (state.busy) return;
  const mine = ++generation;
  set({ busy: true, asked: label, answer: "", err: "" });
  let answer = "", err = "";
  try { answer = await run(); } catch (e) { err = toError(e); }
  if (mine !== generation) return;
  set({ busy: false, answer, err, finished: state.finished + 1 });
}

export function resetAsk() { generation++; state = initial; subs.forEach(f => f()); }
