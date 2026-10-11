import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
export default defineConfig({ plugins: [react()], root: path.resolve(__dirname, ".."), resolve: { alias: [
  { find: /^\.\/firebase$/, replacement: path.resolve(__dirname, "firebase.mock.ts") },
  { find: /^\.\.\/firebase$/, replacement: path.resolve(__dirname, "firebase.mock.ts") },
  { find: /^\.\/hooks\/useData$/, replacement: path.resolve(__dirname, "useData.mock.ts") },
  { find: /^\.\.\/hooks\/useData$/, replacement: path.resolve(__dirname, "useData.mock.ts") },
] } });
