import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,getDoc,setDoc,writeBatch,increment} from 'firebase/firestore';
import {sale,item,listing} from './fixtures';
import {DEFAULT_SETTINGS} from '../src/types';
let env:RulesTestEnvironment;
beforeAll(async()=>{
  if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Run rules tests through the Firestore emulator; no production database is used.');
  const [host,port]=process.env.FIRESTORE_EMULATOR_HOST.split(':');
  env=await initializeTestEnvironment({projectId:'demo-threads-and-things',firestore:{host,port:Number(port),rules:readFileSync('firestore.rules','utf8')}});
});
beforeEach(async()=>{
  await env.clearFirestore();await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();await setDoc(doc(db,'users','owner@example.com'),{role:'owner',shops:['alice']});await setDoc(doc(db,'users','reader@example.com'),{role:'reader',shops:['alice']});await setDoc(doc(db,'shops','alice'),{name:'Alice',revision:0});await setDoc(doc(db,'shops','other'),{name:'Other',revision:0});await setDoc(doc(db,'shops','alice','sales','old'),sale());
  });
});
afterAll(async()=>{await env?.cleanup();});
const owner=()=>env.authenticatedContext('owner',{email:'owner@example.com',email_verified:true}).firestore();
const write=(data:object,c='sales')=>{const db=owner(),b=writeBatch(db);b.set(doc(db,'shops','alice',c,'new'),data);b.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});return b.commit();};
describe('Firestore authorization and validation',()=>{
  const historyRow=(action='import')=>({action,label:'sales.csv',actor:'owner@example.com',createdAt:'2026-10-10T20:00:00.000Z',beforeVersion:'',afterVersion:'v1',revisionBefore:0,revisionAfter:1,beforeSettings:{...DEFAULT_SETTINGS,name:'Alice'},afterSettings:{...DEFAULT_SETTINGS,name:'Alice'},counts:{added:1,updated:0,unchanged:0,skipped:0}});
  it('permits a member to read their shop but denies other shops and user changes',async()=>{
    const db=owner();await assertSucceeds(getDoc(doc(db,'shops','alice')));await assertFails(getDoc(doc(db,'shops','other')));await assertFails(setDoc(doc(db,'users','owner@example.com'),{role:'owner',shops:['other']}));
  });
  it('denies unauthenticated, unlisted and unverified accounts',async()=>{
    for(const db of [env.unauthenticatedContext().firestore(),env.authenticatedContext('stranger',{email:'stranger@example.com',email_verified:true}).firestore(),env.authenticatedContext('unverified',{email:'owner@example.com',email_verified:false}).firestore()])await assertFails(getDoc(doc(db,'shops','alice')));
  });
  it('allows readers to read but prevents writes',async()=>{
    const db=env.authenticatedContext('reader',{email:'reader@example.com',email_verified:true}).firestore();await assertSucceeds(getDoc(doc(db,'shops','alice')));await assertFails(setDoc(doc(db,'shops','alice'),{name:'Changed',revision:1}));
  });
  it('accepts a validated record and rejects blank dates, negative numbers and unexpected fields',async()=>{
    await assertSucceeds(write(sale()));
    for(const row of [{...sale(),date:''},{...sale(),price:-1},{...sale(),price:NaN},{...sale(),desc:null},{...sale(),unexpected:true}])await assertFails(write(row));
  });
  it('validates every collection and rejects unknown collections',async()=>{
    await assertSucceeds(write(item(),'inventory'));await assertSucceeds(write(listing(),'listings'));
    await assertSucceeds(write({...item(),location:'Bin 3'},'inventory'));await assertFails(write({...item(),location:3},'inventory'));
    await assertFails(write({...listing(),link:'javascript:alert(1)'},'listings'));await assertFails(write({date:'2026-10-01',purpose:'trip',miles:-2},'mileage'));await assertFails(write(sale(),'unknown'));
  });
  it('requires a revision increment for normal writes and denies deleting the shop',async()=>{
    const db=owner();await assertFails(setDoc(doc(db,'shops','alice','sales','standalone'),sale()));const b=writeBatch(db);b.delete(doc(db,'shops','alice'));await assertFails(b.commit());
  });
  it('stages an inactive dataset without touching live data, then permits writes after activation',async()=>{
    const db=owner();await assertSucceeds(setDoc(doc(db,'shops','alice','datasets','new-version','sales','staged'),sale()));
    expect((await getDoc(doc(db,'shops','alice','sales','old'))).exists()).toBe(true);
    const activate=writeBatch(db);activate.set(doc(db,'shops','alice'),{dataVersion:'new-version',revision:1},{merge:true});activate.set(doc(db,'shops','alice','history','new-version'),{...historyRow(),afterVersion:'new-version'});await assertSucceeds(activate.commit());
    const b=writeBatch(db);b.set(doc(db,'shops','alice','datasets','new-version','sales','second'),sale());b.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertSucceeds(b.commit());
    await assertFails(write(sale()));
  });
  it('rejects editing a retired dataset even if a stale client increments the revision',async()=>{
    const db=owner();await assertSucceeds(setDoc(doc(db,'shops','alice','datasets','old-version','sales','old'),sale()));
    const activate=writeBatch(db);activate.set(doc(db,'shops','alice'),{dataVersion:'current-version',revision:1},{merge:true});activate.set(doc(db,'shops','alice','history','current-version'),{...historyRow(),afterVersion:'current-version'});await assertSucceeds(activate.commit());
    const b=writeBatch(db);b.set(doc(db,'shops','alice','datasets','old-version','sales','old'),sale({price:30}));b.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertFails(b.commit());
  });
  it('does not partially save a batch when inventory validation fails',async()=>{
    const db=owner(),b=writeBatch(db);b.set(doc(db,'shops','alice','sales','new'),sale());b.set(doc(db,'shops','alice','inventory','bad'),{...item(),cost:-1});b.set(doc(db,'shops','alice'),{revision:1},{merge:true});await assertFails(b.commit());expect((await getDoc(doc(db,'shops','alice','sales','new'))).exists()).toBe(false);
  });
  it('prevents a competing sale or direct inventory edit from taking over a linked item',async()=>{
    const db=owner(),first=writeBatch(db);
    first.set(doc(db,'shops','alice','sales','first'),sale({sku:'TT-0001'}));
    first.set(doc(db,'shops','alice','inventory','i1'),{...item(),status:'Sold',outcome:sale().date,soldBy:'first'});
    first.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertSucceeds(first.commit());
    const competing=writeBatch(db);
    competing.set(doc(db,'shops','alice','sales','second'),sale({sku:'TT-0001'}));
    competing.set(doc(db,'shops','alice','inventory','i1'),{...item(),status:'Sold',outcome:sale().date,soldBy:'second'});
    competing.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertFails(competing.commit());
    expect((await getDoc(doc(db,'shops','alice','sales','second'))).exists()).toBe(false);
    await assertFails(write({...item(),soldBy:'first',status:'Listed',outcome:sale().date},'inventory'));
    const removal=writeBatch(db);removal.delete(doc(db,'shops','alice','inventory','i1'));removal.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertFails(removal.commit());
    const undo=writeBatch(db);undo.delete(doc(db,'shops','alice','sales','first'));undo.set(doc(db,'shops','alice','inventory','i1'),item());undo.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertSucceeds(undo.commit());
  });
  it('can mark existing legacy undated inventory sold without permitting new undated inventory',async()=>{
    await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'shops','alice','inventory','i1'),{...item(),acquired:''});});
    const db=owner(),b=writeBatch(db);b.set(doc(db,'shops','alice','sales','s1'),sale({sku:'TT-0001'}));b.set(doc(db,'shops','alice','inventory','i1'),{...item(),acquired:'',soldBy:'s1',status:'Sold',outcome:sale().date});b.set(doc(db,'shops','alice'),{revision:increment(1)},{merge:true});await assertSucceeds(b.commit());
    await assertFails(write({...item(),acquired:''},'inventory'));
  });
  it('accepts imported-field metadata but rejects invalid origins and metadata types',async()=>{
    await assertSucceeds(write({...sale(),sourceData:'{"price":20}',manualFields:'["cogs"]',origin:'import'}));
    await assertFails(write({...sale(),sourceData:{price:20}}));await assertFails(write({...sale(),origin:'other'}));
  });
  it('requires history to be paired with activation and keeps history immutable',async()=>{
    const db=owner();await assertFails(setDoc(doc(db,'shops','alice','history','standalone'),historyRow()));
    const b=writeBatch(db);b.set(doc(db,'shops','alice'),{dataVersion:'v1',revision:1},{merge:true});b.set(doc(db,'shops','alice','history','v1'),historyRow());await assertSucceeds(b.commit());
    await assertSucceeds(getDoc(doc(db,'shops','alice','history','v1')));await assertFails(setDoc(doc(db,'shops','alice','history','v1'),{...historyRow(),label:'Tampered'}));
    const deletion=writeBatch(db);deletion.delete(doc(db,'shops','alice','history','v1'));await assertFails(deletion.commit());
  });
  it('denies an editor creating a clear/reset/restore history operation',async()=>{
    await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'users','editor@example.com'),{role:'editor',shops:['alice']});});
    const db=env.authenticatedContext('editor',{email:'editor@example.com',email_verified:true}).firestore();
    for(const action of ['clear-sales','reset','restore']){const b=writeBatch(db);b.set(doc(db,'shops','alice'),{dataVersion:'v1',revision:1},{merge:true});b.set(doc(db,'shops','alice','history','v1'),{...historyRow(action),actor:'editor@example.com'});await assertFails(b.commit());}
    expect((await getDoc(doc(db,'shops','alice'))).data()?.revision).toBe(0);
  });
  it('requires a history entry to change the active dataset and never reopens a published version',async()=>{
    const db=owner();
    await assertFails(setDoc(doc(db,'shops','alice'),{dataVersion:'v1',revision:1},{merge:true}));
    const first=writeBatch(db);first.set(doc(db,'shops','alice'),{dataVersion:'v1',revision:1},{merge:true});first.set(doc(db,'shops','alice','history','v1'),historyRow());await assertSucceeds(first.commit());
    const second=writeBatch(db);second.set(doc(db,'shops','alice'),{dataVersion:'v2',revision:2},{merge:true});second.set(doc(db,'shops','alice','history','v2'),{...historyRow(),beforeVersion:'v1',afterVersion:'v2',revisionBefore:1,revisionAfter:2});await assertSucceeds(second.commit());
    await assertFails(setDoc(doc(db,'shops','alice'),{dataVersion:'v1',revision:3},{merge:true}));
    expect((await getDoc(doc(db,'shops','alice'))).data()?.dataVersion).toBe('v2');
  });
  it('denies an editor switching to an empty, never-staged dataset without history',async()=>{
    await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'users','editor@example.com'),{role:'editor',shops:['alice']});});
    const db=env.authenticatedContext('editor',{email:'editor@example.com',email_verified:true}).firestore();
    await assertFails(setDoc(doc(db,'shops','alice'),{dataVersion:'empty-version',revision:1},{merge:true}));
    expect((await getDoc(doc(db,'shops','alice'))).data()?.dataVersion).toBeUndefined();
  });
  it('prevents staging new records into a published recovery snapshot',async()=>{
    const db=owner();await assertSucceeds(setDoc(doc(db,'shops','alice','datasets','v1','sales','saved'),sale()));
    const first=writeBatch(db);first.set(doc(db,'shops','alice'),{dataVersion:'v1',revision:1},{merge:true});first.set(doc(db,'shops','alice','history','v1'),historyRow());await assertSucceeds(first.commit());
    await assertSucceeds(setDoc(doc(db,'shops','alice','datasets','v2','sales','saved'),sale()));
    const second=writeBatch(db);second.set(doc(db,'shops','alice'),{dataVersion:'v2',revision:2},{merge:true});second.set(doc(db,'shops','alice','history','v2'),{...historyRow(),beforeVersion:'v1',afterVersion:'v2',revisionBefore:1,revisionAfter:2});await assertSucceeds(second.commit());
    await assertFails(setDoc(doc(db,'shops','alice','datasets','v1','sales','extra'),sale()));expect((await getDoc(doc(db,'shops','alice','datasets','v1','sales','saved'))).exists()).toBe(true);
  });
});
