import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, connectAuthEmulator, type User } from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const configured = Boolean(cfg.apiKey && cfg.projectId && cfg.authDomain && cfg.appId);
export const demo = false;
export const app = configured ? initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;
if (auth && import.meta.env.VITE_USE_EMULATOR === '1') connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
export const login = () => auth ? signInWithPopup(auth,new GoogleAuthProvider()) : Promise.reject(new Error('Firebase is not configured.'));
export const logout = async () => { if (auth) await signOut(auth); };
export const watchUser = (cb: (u: User | null) => void) => {
  if (!auth) { cb(null); return () => {}; }
  return onAuthStateChanged(auth,cb);
};
