import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    // 'autoUpdate': a new version installs, takes over immediately and the page reloads once into it. The old 'prompt'
    // mode waited for every tab to close (iPhone Safari rarely does), so phones kept running old versions. Reloading,
    // rather than swapping silently, avoids an old page asking for page chunks the new deploy no longer has.
    // src/lib/pwa.ts registers the worker and checks for updates on open, on return to the tab, and hourly.
    registerType: 'autoUpdate', injectRegister: false, manifest: false,
    includeAssets: ['icon.png','apple-touch-icon.png','icon-192.png','icon-512.png','manifest.json'],
    workbox: { skipWaiting: true, clientsClaim: true, globPatterns: ['**/*.{js,css,html,png,json}'], maximumFileSizeToCacheInBytes: 2*1024*1024, navigateFallback: '/index.html' },
  })],
  build: { target: 'es2020' },
  optimizeDeps: { entries: ['src/main.tsx'] },
  server: { watch: { ignored: ['**/.tools/**'] } },
});
