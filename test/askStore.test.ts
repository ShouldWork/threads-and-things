import { describe, it, expect } from 'vitest';
import { askStore, startAsk, resetAsk } from '../src/lib/askStore';

describe('Ask AI store', () => {
  it('keeps the answer after the asking screen is gone, and ignores a second ask while busy', async () => {
    resetAsk();
    let release!: (v: string) => void;
    const first = startAsk('Q1', () => new Promise<string>(r => { release = r; }), () => 'err');
    void startAsk('Q2', async () => 'should not run', () => 'err');
    expect(askStore.get()).toMatchObject({ busy: true, asked: 'Q1' });
    release('A1'); await first;
    expect(askStore.get()).toMatchObject({ busy: false, asked: 'Q1', answer: 'A1', err: '', finished: 1 });
  });
  it('turns failures into her message', async () => {
    resetAsk();
    await startAsk('Q', async () => { throw new Error('x'); }, () => 'Ask needs an internet connection.');
    expect(askStore.get()).toMatchObject({ busy: false, answer: '', err: 'Ask needs an internet connection.' });
  });
  it('drops a late answer after sign-out clears the store', async () => {
    resetAsk();
    let release!: (v: string) => void;
    const p = startAsk('Q', () => new Promise<string>(r => { release = r; }), () => 'err');
    resetAsk(); release('late'); await p;
    expect(askStore.get()).toMatchObject({ busy: false, asked: '', answer: '' });
  });
});
