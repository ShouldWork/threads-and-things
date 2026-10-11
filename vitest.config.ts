import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],test:{include:['test/**/*.test.{ts,tsx}'],environment:'node',testTimeout:15000,hookTimeout:30000}});
