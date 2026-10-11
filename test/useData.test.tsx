// @vitest-environment jsdom
import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {act,cleanup,renderHook,waitFor} from '@testing-library/react';
import {sale,listing,item} from './fixtures';
const fake=vi.hoisted(()=>({
  docs:new Map<string,Record<string,unknown>>(),
  listeners:new Set<{path:string;next:(snapshot:unknown)=>void;error:(e:unknown)=>void;active:boolean}>(),
  user:{email:'alice@example.com'}, stageCount:0,failStage:0,conflict:false,pending:false,
  batches:[] as {kind:string;path:string;data?:Record<string,unknown>;merge?:boolean}[][],
}));
vi.mock('../src/firebase',()=>({auth:{currentUser:fake.user}}));
vi.mock('../src/firestore',()=>({db:{path:''}}));
vi.mock('firebase/firestore',()=>{
  const ref=(base:{path:string},...parts:string[])=>({path:[base.path,...parts].filter(Boolean).join('/')});
  const snapshot=(path:string)=>({data:()=>fake.docs.get(path),exists:()=>fake.docs.has(path),metadata:{hasPendingWrites:fake.pending,fromCache:false},docs:[...fake.docs.entries()].filter(([p])=>p.startsWith(path+'/')&&!p.slice(path.length+1).includes('/')).map(([p,data])=>({id:p.split('/').pop(),data:()=>data}))});
  const emit=()=>{for(const l of [...fake.listeners])if(l.active)l.next(snapshot(l.path));};
  const apply=(ops:typeof fake.batches[number])=>{
    for(const op of ops){if(op.kind==='delete')fake.docs.delete(op.path);else{const old=fake.docs.get(op.path)||{};const row={...op.data};for(const [k,v] of Object.entries(row))if(v&&typeof v==='object'&&'increment' in v)row[k]=Number(old[k]||0)+Number((v as {increment:number}).increment);fake.docs.set(op.path,op.merge?{...old,...row}:row);}}
    emit();
  };
  return {
    collection:ref,doc:ref,increment:(n:number)=>({increment:n}),
    onSnapshot:(r:{path:string},options:unknown,callback?:unknown,error?:unknown)=>{
      const next=(typeof options==='function'?options:callback) as (s:unknown)=>void;
      const fail=(typeof options==='function'?callback:error) as (e:unknown)=>void;
      const l={path:r.path,next,error:fail,active:true};fake.listeners.add(l);
      queueMicrotask(()=>{if(l.active)next(snapshot(r.path));});return()=>{l.active=false;};
    },
    getDocFromServer:async(r:{path:string})=>snapshot(r.path),getDocsFromServer:async(r:{path:string})=>snapshot(r.path),
    writeBatch:()=>{
      const ops:typeof fake.batches[number]=[];
      return {set:(r:{path:string},data:Record<string,unknown>,options?:{merge:boolean})=>ops.push({kind:'set',path:r.path,data,merge:options?.merge}),delete:(r:{path:string})=>ops.push({kind:'delete',path:r.path}),commit:async()=>{
        fake.batches.push(ops);
        if(ops.some(op=>op.path.includes('/datasets/'))){fake.stageCount++;if(fake.failStage===fake.stageCount)throw new Error('staging failed');}
        apply(ops);if(fake.pending)return new Promise<void>(()=>{});
      }};
    },
    runTransaction:async(_db:unknown,fn:(tx:unknown)=>Promise<unknown>)=>{
      const ops:typeof fake.batches[number]=[];
      if(fake.conflict){const old=fake.docs.get('shops/alice')||{};fake.docs.set('shops/alice',{...old,revision:Number(old.revision||0)+1});}
      await fn({get:async(r:{path:string})=>snapshot(r.path),set:(r:{path:string},data:Record<string,unknown>,options?:{merge:boolean})=>ops.push({kind:'set',path:r.path,data,merge:options?.merge})});apply(ops);
    },
  };
});
import {useData,importData,saveSale,add,clearImportedSales,resetShop,undoImport,consolidateSales,restoreBackup} from '../src/hooks/useData';
beforeEach(()=>{
  fake.docs.clear();fake.listeners.clear();fake.user.email='alice@example.com';fake.stageCount=0;fake.failStage=0;fake.conflict=false;fake.pending=false;fake.batches=[];
  fake.docs.set('users/alice@example.com',{role:'owner',shops:['alice']});fake.docs.set('users/bob@example.com',{role:'owner',shops:['bob']});
  fake.docs.set('shops/alice',{name:'Alice',revision:0});fake.docs.set('shops/bob',{name:'Bob',revision:0});
  fake.docs.set('shops/alice/sales/private',{...sale(),desc:'Alice private sale'});
});
afterEach(cleanup);
async function open(){const hook=renderHook(({email})=>useData(email),{initialProps:{email:'alice@example.com' as string|null}});await waitFor(()=>expect(hook.result.current.ready).toBe(true));return hook;}
describe('account and shop isolation',()=>{
  it('hides prior records immediately when the email changes',async()=>{
    const hook=await open();expect(hook.result.current.data.sales[0].desc).toBe('Alice private sale');
    fake.user.email='bob@example.com';hook.rerender({email:'bob@example.com'});
    expect(hook.result.current.data.sales).toEqual([]);await waitFor(()=>expect(hook.result.current.ready).toBe(true));expect(hook.result.current.data.settings.name).toBe('Bob');
  });
  it('clears errors after signing out and back into an allowed account',async()=>{
    fake.docs.delete('users/alice@example.com');const hook=renderHook(({email})=>useData(email),{initialProps:{email:'alice@example.com' as string|null}});
    await waitFor(()=>expect(hook.result.current.error).not.toBe(''));hook.rerender({email:null});expect(hook.result.current.error).toBe('');
    fake.user.email='bob@example.com';hook.rerender({email:'bob@example.com'});await waitFor(()=>expect(hook.result.current.ready).toBe(true));expect(hook.result.current.error).toBe('');
  });
  it('unsubscribes old shop listeners and ignores their late callbacks',async()=>{
    const hook=await open();const old=[...fake.listeners].find(l=>l.path==='shops/alice/sales')!;
    fake.docs.set('users/alice@example.com',{role:'owner',shops:['bob']});
    await act(async()=>{const listener=[...fake.listeners].find(l=>l.path==='users/alice@example.com'&&l.active)!;listener.next({exists:()=>true,data:()=>fake.docs.get(listener.path)});});
    await waitFor(()=>expect(hook.result.current.data.settings.name).toBe('Bob'));expect(old.active).toBe(false);
    act(()=>old.next({docs:[{id:'late',data:()=>sale({desc:'Late private sale'})}],metadata:{hasPendingWrites:false,fromCache:false}}));expect(hook.result.current.data.sales).toEqual([]);
    act(()=>old.error({message:'Late permission error',code:'permission-denied'}));expect(hook.result.current.ready).toBe(true);expect(hook.result.current.error).toBe('');
  });
});
describe('writes and imports',()=>{
  it('queues a complete sale/inventory batch offline without waiting for the server',async()=>{
    fake.docs.set('shops/alice/inventory/i1',{...item(),sku:'TT-0001'});const hook=await open();fake.pending=true;
    let result;await act(async()=>{result=await saveSale(hook.result.current.data,'s1',sale({sku:'TT-0001'}));});expect(result).toEqual({queued:true});
    expect(fake.batches[0].filter(op=>op.path.includes('/sales/')||op.path.includes('/inventory/'))).toHaveLength(2);expect(fake.docs.get('shops/alice/inventory/i1')?.status).toBe('Sold');
  });
  it('uses the same supplied ID when a form retries',async()=>{
    await open();await act(async()=>{await add('sales',sale(),'stable');await add('sales',sale(),'stable');});expect([...fake.docs.keys()].filter(k=>k==='shops/alice/sales/stable')).toHaveLength(1);
  });
  it('preserves the active dataset when a later staging batch fails',async()=>{
    await open();fake.failStage=2;await expect(importData({replace:{listings:Array.from({length:450},(_,i)=>listing({desc:'Item '+i}))}})).rejects.toThrow('staging failed');
    expect(fake.docs.get('shops/alice')?.dataVersion).toBeUndefined();expect(fake.docs.has('shops/alice/sales/private')).toBe(true);expect(fake.batches.flat().some(op=>op.kind==='delete')).toBe(false);
  });
  it('rejects a concurrent change instead of publishing an outdated import',async()=>{
    await open();fake.conflict=true;await expect(importData({replace:{listings:[listing()]}})).rejects.toThrow('Someone changed');expect(fake.docs.get('shops/alice')?.dataVersion).toBeUndefined();
  });
  it('publishes all collections together after staging and retains originals',async()=>{
    const hook=await open();await act(async()=>{await importData({replace:{listings:[listing()]},settings:{snapshot:'2026-10-10'}});});await waitFor(()=>expect(hook.result.current.data.listings).toHaveLength(1));
    const version=fake.docs.get('shops/alice')?.dataVersion;expect(version).toBeTruthy();expect(fake.docs.has('shops/alice/sales/private')).toBe(true);expect(fake.docs.has(`shops/alice/datasets/${version}/sales/private`)).toBe(true);expect(hook.result.current.data.settings.snapshot).toBe('2026-10-10');
  });
  it('records history with the import and can undo it without losing original IDs and notes',async()=>{
    fake.docs.set('shops/alice/inventory/i1',item({notes:'My original note'}));const hook=await open();
    await act(async()=>{await importData({merge:{inventory:[item({notes:'Old spreadsheet note'})]},label:'tracker.xlsx'});});
    await waitFor(()=>expect(hook.result.current.history).toHaveLength(1));const entry=hook.result.current.history[0];
    expect(entry.label).toBe('tracker.xlsx');expect(hook.result.current.data.inventory[0]).toMatchObject({id:'i1',notes:'My original note'});
    await act(async()=>{await undoImport(entry.id);});await waitFor(()=>expect(hook.result.current.history).toHaveLength(2));expect(hook.result.current.version).not.toBe(entry.beforeVersion);expect(hook.result.current.data.inventory[0]).toMatchObject({id:'i1',notes:'My original note'});
  });
  it('blocks undo after a subsequent edit',async()=>{
    const hook=await open();await act(async()=>{await importData({sales:[sale({sourceId:'new',desc:'New sale'})]});});
    await waitFor(()=>expect(hook.result.current.history).toHaveLength(1));const id=hook.result.current.history[0].id;
    await act(async()=>{await add('time',{date:'2026-10-01',activity:'Listing',minutes:30,notes:''});});await expect(undoImport(id)).rejects.toThrow('later changes');
    expect(hook.result.current.data.time).toHaveLength(1);
  });
  it('clears imported sales while preserving explicit manual sales and inventory notes, with undo',async()=>{
    fake.docs.set('shops/alice/sales/manual',sale({origin:'manual',desc:'Manual sale'}));fake.docs.set('shops/alice/inventory/i1',item({notes:'Keep note'}));const hook=await open();
    await act(async()=>{await clearImportedSales();});await waitFor(()=>expect(hook.result.current.data.sales).toHaveLength(1));expect(hook.result.current.data.sales[0].desc).toBe('Manual sale');expect(hook.result.current.data.inventory[0].notes).toBe('Keep note');
    await act(async()=>{await undoImport(hook.result.current.history[0].id);});await waitFor(()=>expect(hook.result.current.data.sales).toHaveLength(2));
  });
  it('resets all records with recovery and preserves shop settings',async()=>{
    const hook=await open();await act(async()=>{await resetShop();});await waitFor(()=>expect(hook.result.current.data.sales).toEqual([]));expect(hook.result.current.data.settings.name).toBe('Alice');
    await act(async()=>{await undoImport(hook.result.current.history[0].id);});await waitFor(()=>expect(hook.result.current.data.sales).toHaveLength(1));
  });
  it('consolidates selected duplicates and restores a full backup through another staged operation',async()=>{
    fake.docs.set('shops/alice/sales/duplicate',sale({desc:'Alice private sale'}));const hook=await open();const backup=structuredClone(hook.result.current.data);
    await act(async()=>{await consolidateSales(['private','duplicate'],'private');});await waitFor(()=>expect(hook.result.current.data.sales).toHaveLength(1));expect(hook.result.current.data.sales[0].id).toBe('private');
    await act(async()=>{await restoreBackup(backup);});await waitFor(()=>expect(hook.result.current.data.sales).toHaveLength(2));
  });
  it('rejects owner-only reset controls for an editor',async()=>{
    fake.docs.set('users/alice@example.com',{role:'editor',shops:['alice']});await open();await expect(resetShop()).rejects.toThrow('owner');expect(fake.docs.has('shops/alice/sales/private')).toBe(true);
  });
});
