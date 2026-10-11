export const configured = true;
export const demo = true;
let cb: ((u: unknown) => void) | null = null;
const user = { email: "sierra@example.com" };
export const login = async () => { cb?.(user); };
export const logout = async () => { cb?.(null); };
export const watchUser = (f: (u: unknown) => void) => { cb = f; setTimeout(() => f(user), 10); return () => {}; };
export const db = {} as unknown;
