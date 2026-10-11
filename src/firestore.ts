import {initializeFirestore,persistentLocalCache,persistentMultipleTabManager,connectFirestoreEmulator} from 'firebase/firestore';
import {app} from './firebase';
// Loaded with the signed-in shop; the login screen does not download Firestore.
export const db=app?initializeFirestore(app,{localCache:persistentLocalCache({tabManager:persistentMultipleTabManager()})}):null;
if(db && import.meta.env.VITE_USE_EMULATOR === '1')connectFirestoreEmulator(db,'127.0.0.1',8080);
