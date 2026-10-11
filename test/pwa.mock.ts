// Stand-in for vite-plugin-pwa's virtual:pwa-register in demo/preview builds (no service worker there).
export function registerSW(_options?: unknown) { return async (_reload?: boolean) => {}; }
