import {lazy,Suspense,useEffect,useState} from 'react';
import type {User} from 'firebase/auth';
import {configured,login,watchUser} from './firebase';
import {useToast} from './components/ui';
const Shop=lazy(()=>import('./Shop'));
export default function App(){
  const[user,setUser]=useState<User|null|undefined>(undefined);
  const{msg,toast}=useToast();
  useEffect(()=>watchUser(setUser),[]);
  if(!configured)return <div className="wrap"><div className="login"><img src="/icon.png" alt="Threads and Things"/><h1>Almost there</h1><p className="sub">Firebase is not configured. Copy .env.example to .env, add the Firebase web configuration, and restart. See the README.</p></div></div>;
  if(user===undefined)return <div className="wrap"><p role="status">Opening the shop…</p></div>;
  if(!user)return <div className="wrap"><div className="login"><img src="/icon.png" alt=""/><p className="hello-tag">Threads and Things</p><h1>Welcome back</h1><p className="sub">Sign in with the Google account added to your shop.</p><button type="button" className="btn primary" onClick={()=>login().catch(e=>toast(e.message))}>Sign in with Google</button>{msg&&<div className="toast" role="alert">{msg}</div>}</div></div>;
  return <Suspense fallback={<div className="wrap"><p role="status">Loading your shop…</p></div>}><Shop key={user.uid || user.email || ''} user={user}/></Suspense>;
}
