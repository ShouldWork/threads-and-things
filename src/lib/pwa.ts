// Offline app updates (see vite.config.ts): registerType 'autoUpdate' installs a new version, activates it and reloads
// the page once. This registers the worker and checks for a new version when the app opens, when she comes back to
// the tab, and hourly, so a phone that keeps the tab open for days still picks up deploys.
export function startPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => { void registration.update().catch(() => {}); };
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
        setInterval(check, 60 * 60 * 1000);
      },
    });
  }).catch(() => { /* no service worker support: the app still works online */ });
}
