import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
  testDir:'./test/browser',fullyParallel:true,timeout:30000,
  use:{trace:'retain-on-failure'},
  projects:[
    // Full suite on Chromium at phone size.
    {name:'chromium',use:{browserName:'chromium',viewport:{width:390,height:844}}},
    // Sierra uses an iPhone: run the phone-focused checks on WebKit (Safari's engine) with iPhone 14 emulation.
    // WebKit emulation is much slower than Chromium, especially on a busy machine or CI runner: allow 60s per test.
    {name:'iphone-webkit',testMatch:/phone\.spec\.ts/,timeout:60000,use:{...devices['iPhone 14']}},
  ],
  webServer:[
    {command:'npm run dev:mock -- --host 127.0.0.1 --port 5173 --strictPort',url:'http://127.0.0.1:5173',reuseExistingServer:false},
    {command:'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:false},
  ],
});
