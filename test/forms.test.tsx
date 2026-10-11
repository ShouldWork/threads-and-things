// @vitest-environment jsdom
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,fireEvent,screen,waitFor} from '@testing-library/react';
import {emptyData,sale,item} from './fixtures';
const api=vi.hoisted(()=>({saveSale:vi.fn(),add:vi.fn(),update:vi.fn(),remove:vi.fn()}));
vi.mock('../src/hooks/useData',()=>({...api,newRecordId:()=> 'stable-form-id'}));
import Form from '../src/components/Forms';
afterEach(()=>{cleanup();vi.clearAllMocks();});
describe('forms',()=>{
  it('retries a failed sale with the same ID and prevents duplicate concurrent submission',async()=>{
    let reject!:(e:Error)=>void;api.saveSale.mockImplementationOnce(()=>new Promise((_,r)=>{reject=r;})).mockResolvedValueOnce({queued:false});const done=vi.fn();
    render(<Form kind="sale" data={emptyData()} initial={sale()} onDone={done} onCancel={()=>{}}/>);
    const form=screen.getByRole('button',{name:'Add',exact:true}).closest('form')!;
    fireEvent.submit(form);fireEvent.submit(form);expect(api.saveSale).toHaveBeenCalledTimes(1);
    reject(new Error('Rejected'));await screen.findByRole('alert');fireEvent.submit(form);await waitFor(()=>expect(done).toHaveBeenCalled());
    expect(api.saveSale.mock.calls.map(call=>call[1])).toEqual(['stable-form-id','stable-form-id']);
  });
  it('closes promptly with an accurate queued message for offline writes',async()=>{
    api.add.mockResolvedValue({queued:true});const done=vi.fn();render(<Form kind="time" data={emptyData()} onDone={done} onCancel={()=>{}}/>);
    fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));await waitFor(()=>expect(done).toHaveBeenCalledWith('Saved on this device; will sync.'));
  });
  it('rejects blank dates and negative amounts before calling the write API',async()=>{
    render(<Form kind="expense" data={emptyData()} onDone={()=>{}} onCancel={()=>{}}/>);fireEvent.change(screen.getByLabelText('Date'),{target:{value:''}});fireEvent.change(screen.getByLabelText('Amount'),{target:{value:'-1'}});
    fireEvent.submit(screen.getByRole('button',{name:'Add',exact:true}).closest('form')!);await screen.findByRole('alert');expect(api.add).not.toHaveBeenCalled();
  });
  it('protects notes edited in the app during subsequent imports',async()=>{
    api.update.mockResolvedValue({queued:false});const initial={...item({id:'i1',notes:'Source note'}),origin:'import',sourceData:JSON.stringify(item({notes:'Source note'}))};
    render(<Form kind="item" data={emptyData()} initial={initial} onDone={()=>{}} onCancel={()=>{}}/>);fireEvent.change(screen.getByLabelText('Notes'),{target:{value:'My note'}});fireEvent.click(screen.getByRole('button',{name:'Save changes'}));
    await waitFor(()=>expect(api.update).toHaveBeenCalled());expect(JSON.parse(api.update.mock.calls[0][2].manualFields)).toContain('notes');
  });
  it('can restore the latest source values and release protected edits',async()=>{
    api.update.mockResolvedValue({queued:false});const initial={...item({id:'i1',notes:'My note'}),origin:'import',manualFields:'["notes"]',sourceData:JSON.stringify(item({notes:'Source note'}))};
    render(<Form kind="item" data={emptyData()} initial={initial} onDone={()=>{}} onCancel={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Use latest imported values'}));expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Source note');
    fireEvent.click(screen.getByRole('button',{name:'Save changes'}));await waitFor(()=>expect(api.update).toHaveBeenCalled());expect(api.update.mock.calls[0][2]).toMatchObject({notes:'Source note',manualFields:'[]'});
  });
  it('preserves an explicitly entered zero item cost instead of replacing it with inventory cost',async()=>{
    api.saveSale.mockResolvedValue({queued:false});const data=emptyData();data.inventory=[item({id:'i1'})];render(<Form kind="sale" data={data} initial={sale()} onDone={()=>{}} onCancel={()=>{}}/>);
    fireEvent.change(screen.getByLabelText('SKU (from inventory)'),{target:{value:'TT-0001'}});fireEvent.change(screen.getByLabelText('Item cost (COGS)'),{target:{value:'1'}});fireEvent.change(screen.getByLabelText('Item cost (COGS)'),{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Add',exact:true}));
    await waitFor(()=>expect(api.saveSale).toHaveBeenCalled());expect(api.saveSale.mock.calls[0][2].cogs).toBe(0);
  });
});
