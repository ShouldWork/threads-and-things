import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, type DocumentData, type FirestoreError } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_SETTINGS, type Data, type Settings } from "../types";

// Firestore layout (see firestore.rules):
//   users/{email}                      { role, shops: [shopId, ...] }   who may sign in, and which shop they see
//   shops/{shopId}                     the shop's settings (name, mileageRate, taxPct, snapshot, shopStart, goalMonthly)
//   shops/{shopId}/{collection}/{id}   sales, listings, inventory, expenses, mileage, time, issues
// A person's first shop is the one the app opens. Everything below reads and writes inside that shop.

export const COLS = ["sales", "listings", "inventory", "expenses", "mileage", "time", "issues"] as const;
export type ColName = (typeof COLS)[number];

let shopId = "";
export const currentShop = () => shopId;
const shopRef = () => { if (!shopId) throw new Error("No shop is open yet."); return doc(db, "shops", shopId); };
const col = (c: ColName) => collection(shopRef(), c);

const EMPTY: Data = { sales: [], listings: [], inventory: [], expenses: [], mileage: [], time: [], issues: [], settings: DEFAULT_SETTINGS };
const NOT_LISTED = "This Google account is not on the list yet.";

export function useData(email: string | null) {
  const [data, setData] = useState<Data>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>("");
  useEffect(() => {
    if (!email) return;
    const unsubs: (() => void)[] = [];
    const fail = (e: FirestoreError) => setError(e.code === "permission-denied" ? NOT_LISTED : e.message);
    // 1. Find out which shop this person belongs to.
    unsubs.push(onSnapshot(doc(db, "users", email.toLowerCase()), snap => {
      const shops = (snap.data()?.shops as string[] | undefined) || [];
      if (!snap.exists() || !shops.length) { setError(NOT_LISTED); return; }
      if (shopId === shops[0] && unsubs.length > 1) return; // already subscribed to this shop
      shopId = shops[0];
      // 2. Subscribe to the shop document (settings) and every collection under it.
      const loaded = new Set<string>(); const need = COLS.length + 1;
      unsubs.push(onSnapshot(shopRef(), s => {
        setData(prev => ({ ...prev, settings: { ...DEFAULT_SETTINGS, ...(s.data() as Partial<Settings> | undefined) } }));
        loaded.add("settings"); if (loaded.size === need) setReady(true);
      }, fail));
      COLS.forEach(c => unsubs.push(onSnapshot(col(c), s => {
        const rows = s.docs.map(d => ({ id: d.id, ...(d.data() as DocumentData) }));
        setData(prev => ({ ...prev, [c]: rows }));
        loaded.add(c); if (loaded.size === need) setReady(true);
      }, fail)));
    }, fail));
    return () => { unsubs.forEach(u => u()); shopId = ""; };
  }, [email]);
  return { data, ready, error };
}

export const add = (c: ColName, row: object) => addDoc(col(c), strip(row));
export const update = (c: ColName, id: string, row: object) => updateDoc(doc(col(c), id), strip(row));
export const remove = (c: ColName, id: string) => deleteDoc(doc(col(c), id));
export const saveSettings = (s: Partial<Settings>) => setDoc(shopRef(), strip(s), { merge: true });
export async function addMany(c: ColName, rows: object[]) {
  for (let i = 0; i < rows.length; i += 400) {
    const b = writeBatch(db);
    rows.slice(i, i + 400).forEach(r => b.set(doc(col(c)), strip(r)));
    await b.commit();
  }
}
export async function replaceAll(c: ColName, existingIds: string[], rows: object[]) {
  for (let i = 0; i < existingIds.length; i += 400) { const b = writeBatch(db); existingIds.slice(i, i + 400).forEach(id => b.delete(doc(col(c), id))); await b.commit(); }
  await addMany(c, rows);
}
function strip(o: object) { const r: Record<string, unknown> = {}; Object.entries(o).forEach(([k, v]) => { if (k !== "id" && v !== undefined) r[k] = v; }); return r; }
