// Stand-in for src/ai.ts in the demo (dev:mock, preview builds, browser tests). No network, no AI allowance used.
// Answers are built from the real summary so the screen shows believable numbers. Set LIVE_AI=1 to use the real model.
import type { ShopSummary } from '../src/lib/aiSummary';
export { friendlyError } from '../src/lib/aiErrors';
export type ModelChoice = { model: string; thinkingLevel?: string };
export const DEFAULT_CHOICE: ModelChoice = { model: 'demo' };

export async function askShop(summary: ShopSummary, question: string): Promise<string> {
  // "slow demo" waits until a test calls window.__releaseAsk() (so tests control timing instead of racing a sleep);
  // a 60s fallback keeps a manual demo from hanging forever.
  if (/slow demo/i.test(question)) await new Promise<void>(r => { (globalThis as { __releaseAsk?: () => void }).__releaseAsk = r; setTimeout(r, 60000); });
  else await new Promise(r => setTimeout(r, 400));
  if (/fail demo/i.test(question)) throw new Error('Error fetching from https://example/models/demo:generateContent: [500 Internal Server Error] demo');
  const m = summary.thisMonthSoFar, oldest = summary.longestListed;
  return [
    `Demo answer (no AI was called). This month so far you sold **${m.itemsSold}** items for **$${m.grossSales.toFixed(2)}**.`,
    oldest ? `- Your longest-listed item has been up ${oldest.daysListed ?? 'an unknown number of'} days at $${oldest.price}.` : '- No active listings yet.',
    `- ${summary.activeListings.sitting21PlusDays} listings have sat 21 days or more.`,
    'Suggested Title:',
    'Demo title text',
  ].join('\n');
}
