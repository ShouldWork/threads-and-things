import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt', injectRegister: 'auto', manifest: false,
    includeAssets: ['icon.png','apple-touch-icon.png','icon-192.png','icon-512.png','manifest.json'],
    workbox: { globPatterns: ['**/*.{js,css,html,png,json}'], maximumFileSizeToCacheInBytes: 2*1024*1024, navigateFallback: '/index.html' },
  })],
  build: { target: 'es2020' },
  optimizeDeps: { entries: ['src/main.tsx'] },
  server: { watch: { ignored: ['**/.tools/**'] } },
});
