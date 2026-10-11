import { getApps, initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, type ThinkingLevel } from 'firebase/ai';
import type { ShopSummary } from './lib/aiSummary';

// Gemini Developer API through Firebase AI Logic. The project is on the no-cost Spark plan,
// so this is the Gemini free tier: Google may use what is sent to improve its models.
// That is why only the computed summary (see aiSummary.ts) and her typed question are sent, never raw records.
// Chosen after a side-by-side test (2026-10-10) on a listing-rewrite question: 3.8 Flash on its default thinking used
// her category benchmarks and wrote the strongest title and description. Flash-Lite was faster but generic.
// Response time varies a lot on the free tier (9 to 100 seconds seen), hence the long timeout. Ask.tsx tells her
// "up to two minutes"; keep the two in step.
export const DEFAULT_CHOICE: ModelChoice = { model: 'gemini-3.8-flash' };
const TIMEOUT_MS = 120000;

const SYSTEM = `You are a friendly, practical assistant inside "Threads and Things", a dashboard for one person who resells clothes on Depop.
You will get a JSON summary of her shop that the app computed, then her question.
Rules:
- Use only numbers that appear in the summary. Never invent, estimate or recompute totals. If the summary cannot answer the question, say what is missing.
- Money is US dollars. "sellThrough" is sold divided by (sold plus still listed).
- Be warm and encouraging, but honest. Pair any bad news with one concrete thing to try.
- She reads this on her phone: keep it under 180 words, except when she asks for rewritten listing text; then give the full suggested title and description and keep the rest short. Use short paragraphs, or a few "- " bullets. **Bold** at most a few key numbers. No headings, no tables.
- Do not use em dashes or en dashes.`;

export type ModelChoice = { model: string; thinkingLevel?: ThinkingLevel };
const models = new Map<string, ReturnType<typeof getGenerativeModel>>();
function getModel(choice: ModelChoice) {
  const key = choice.model + '|' + (choice.thinkingLevel || '');
  const cached = models.get(key); if (cached) return cached;
  // Reuse the signed-in app when there is one; the demo preview has none, so start one from the same config.
  const app = getApps()[0] ?? initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY, authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID, appId: import.meta.env.VITE_FIREBASE_APP_ID,
  });
  const m = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), {
    model: choice.model, systemInstruction: SYSTEM,
    ...(choice.thinkingLevel ? { generationConfig: { thinkingConfig: { thinkingLevel: choice.thinkingLevel } } } : {}),
  }, { timeout: TIMEOUT_MS });
  models.set(key, m); return m;
}

export async function askShop(summary: ShopSummary, question: string, choice: ModelChoice = DEFAULT_CHOICE): Promise<string> {
  const result = await getModel(choice).generateContent(`Shop summary:\n${JSON.stringify(summary)}\n\nQuestion: ${question}`);
  const text = result.response.text().trim();
  if (!text) throw new Error('The AI did not send an answer. Try asking again.');
  return text;
}

export { friendlyError } from './lib/aiErrors';
