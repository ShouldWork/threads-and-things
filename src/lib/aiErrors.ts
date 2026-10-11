// Turn Firebase AI Logic errors into something Sierra can act on.
// Every SDK fetch error embeds the request URL, which ends in ":generateContent", so never match on loose words
// like "rate" (it matched "generate" and blamed the quota for every failure). Decide by connectivity and HTTP status.
export function friendlyError(e: unknown, online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): string {
  const m = e instanceof Error ? e.message : String(e);
  if (!online || /failed to fetch|networkerror|err_internet|load failed|network request failed/i.test(m))
    return 'Ask needs an internet connection. Try again when you are back online.';
  if (/\baborted\b|timed out|timeout/i.test(m)) return 'The AI took too long to answer. Try again in a moment.';
  const status = Number(/\[(\d{3})[\s\]]/.exec(m)?.[1] || 0);
  if (status === 429) return "Google's free AI is busy or today's free allowance is used up. Wait a minute and try again. If it keeps happening, try again tomorrow.";
  if (status === 401 || status === 403) return 'The AI service is not switched on for this shop. Ask Blake to check Firebase AI Logic.';
  if (status >= 500) return "Google's AI service had a problem on its end. Try again in a minute.";
  return 'Something went wrong asking the AI. Try again in a minute.';
}
