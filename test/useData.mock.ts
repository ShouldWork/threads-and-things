import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Data, type Settings } from "../src/types";
import seed from "./seed.json";
type ColName = "sales" | "listings" | "inventory" | "expenses" | "mileage" | "time" | "issues";
let store: Data = { ...(seed as unknown as Data), settings: { ...DEFAULT_SETTINGS, snapshot: "2026-10-10" } };
const subs = new Set<(d: Data) => void>(); const emit = () => subs.forEach(f => f({ ...store }));
let n = 1000; const id = () => "m" + (n++);
export const currentShop = () => "mock";
export function useData(email: string | null) { const [data, setData] = useState(store); useEffect(() => { if (!email) return; subs.add(setData); return () => { subs.delete(setData); }; }, [email]); return { data, ready: true, error: "" }; }
export const add = async (c: ColName, r: object) => { (store[c] as object[]).push({ id: id(), ...r }); emit(); };
export const update = async (c: ColName, i: string, r: object) => { store[c] = (store[c] as { id?: string }[]).map(x => x.id === i ? { ...x, ...r } : x) as never; emit(); };
export const remove = async (c: ColName, i: string) => { store[c] = (store[c] as { id?: string }[]).filter(x => x.id !== i) as never; emit(); };
export const saveSettings = async (s: Partial<Settings>) => { store.settings = { ...store.settings, ...s }; emit(); };
export const addMany = async (c: ColName, rows: object[]) => { rows.forEach(r => (store[c] as object[]).push({ id: id(), ...r })); emit(); };
export const replaceAll = async (c: ColName, _ids: string[], rows: object[]) => { store[c] = rows.map(r => ({ id: id(), ...r })) as never; emit(); };
export type { ColName };
