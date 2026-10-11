import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({ plugins: [react()], root: path.resolve(__dirname, ".."),
  cacheDir: 'node_modules/.vite-mock', optimizeDeps: { entries: ['src/main.tsx'] },
  server: { watch: { ignored: ['**/.tools/**'] } }, resolve: { alias: [
  { find: /^\.\.\/firestore$/, replacement: path.resolve(__dirname, "firebase.mock.ts") },
  { find: /^\.\/firebase$/, replacement: path.resolve(__dirname, "firebase.mock.ts") },
  { find: /^\.\.\/firebase$/, replacement: path.resolve(__dirname, "firebase.mock.ts") },
  { find: /^\.\/hooks\/useData$/, replacement: path.resolve(__dirname, "useData.mock.ts") },
  { find: /^\.\.\/hooks\/useData$/, replacement: path.resolve(__dirname, "useData.mock.ts") },
  // The demo never calls the real AI unless LIVE_AI=1 is set (it would spend the shop's free allowance).
  ...(process.env.LIVE_AI === "1" ? [] : [{ find: /^\.\.\/ai$/, replacement: path.resolve(__dirname, "ai.mock.ts") }]),
] } });
