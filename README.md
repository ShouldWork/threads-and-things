# Threads and Things

Sierra's reseller dashboard. React + TypeScript + Vite on the front, Firebase Auth (Google sign-in with a users list) and Firestore behind it, deployed to Firebase Hosting. Works as a phone web app (add to home screen) and keeps working offline until the connection returns.

## What it does

- Home: net profit, items sold, average sale, fees, to-do list built from her data, sales by month, best days, on-the-rack summary, behind-the-scenes numbers (hours, profit per hour, inventory, tax set-aside).
- Sales: every sale, searchable, tap to edit.
- Closet: active Depop listings (with age tags) and the inventory log.
- Plan: projections. Profit for the next 30 and 90 days and year end from a run rate (last 30 days, last 90 days, or since the start), what the current rack should pay out and how long it lasts, a monthly profit target turned into sales, listings, inventory cash and hours needed, and a month-by-month profit and loss table.
- Learn: insights computed from her numbers, plus the seller playbook.
- More: imports (Depop sales export, saved Depop listings page, the old tracker spreadsheet), settings, CSV download, sign out.
- The + button logs a sale, inventory item, expense, time, mileage, issue, or listing. Logging a sale against a SKU marks that inventory item sold and pulls in its cost.

## How the data is laid out

```
users/{email}                       { role: "owner", shops: ["sierra"] }   who may sign in, which shop they see
shops/{shopId}                      settings: name, mileageRate, taxPct, snapshot, shopStart, goalMonthly
shops/{shopId}/sales/{id}
shops/{shopId}/listings/{id}
shops/{shopId}/inventory/{id}
shops/{shopId}/expenses/{id}
shops/{shopId}/mileage/{id}
shops/{shopId}/time/{id}
shops/{shopId}/issues/{id}
```

Field names match `src/types.ts`. A person opens the first shop on their `users` document. A second shop (another seller, another platform account, a test shop) is a new `shops/{id}` document and a second entry in that array; nothing else changes. The rules in `firestore.rules` let a person read only their own `users` document and read or write only the shops listed on it. Nothing in the app can write to `users`.

## One-time setup

1. Firebase console (https://console.firebase.google.com), project `threads-and-things-e0943`:
   - Build > Authentication > Sign-in method > Google > Enable.
   - Build > Firestore Database > Create database > production mode > a US region.
   - Project settings > Your apps > Web > copy the `firebaseConfig` values into `.env` (see `.env.example`) for local `npm run dev`. The same values are committed in `.env.production` so that `npm run build` works on GitHub Actions; Firebase documents these as identifiers, not secrets (https://firebase.google.com/docs/projects/api-keys). `.firebaserc` already names the project.

2. Let Sierra and yourself in. In Firestore, Start collection `users`:
   - Document ID = her Google email, all lowercase. Fields: `role` (string) `owner`, `shops` (array) `sierra`.
   - A second document for your own email, same fields.
   - Nobody else can read or write anything, even if they find the URL and sign in.

3. Install, test, run locally, deploy
   ```
   npm install
   npm test                                     # unit tests for the math (calc, projections)
   npm run dev:mock                             # the UI on seed data, no Firebase: http://localhost:5173
   npm run dev                                  # against the real project (needs .env)
   npm install -g firebase-tools
   firebase login
   npm run deploy:rules                         # publishes firestore.rules
   npm run deploy                               # builds and publishes to Firebase Hosting
   ```
   The deploy prints the URL (`https://threads-and-things-e0943.web.app`). On her phone: open it in Safari or Chrome, Share, Add to Home Screen.

   GitHub Actions also deploys: every push to `main` builds and publishes to the live site, and every pull request gets a preview URL (`.github/workflows/`, created by `firebase init hosting:github`). The service account key lives in the repo's GitHub secrets.

4. Bring her data over
   - More > Import the tracker spreadsheet, choose `Sierra_Depop_Tracker.xlsx`. The tracker's Sales, Active Listings, Expenses and Mileage tabs load. Buyer shipping is read from the Sales tab.
   - From then on she adds things with the + button, and imports a Depop sales export whenever she likes (duplicates are skipped).

## Day to day

- Something sold: + > Sale. Type the SKU if the item is in inventory. Tap "Estimate Depop fees" and the fee math is done.
- Something new came in: + > Inventory item. Write the SKU on the tag.
- Time, gas, supplies, problems: + > Time / Mileage / Expense / Issue.
- Refresh the listings list every week or two: on a computer, Depop Selling hub > Active, click Load more until it is gone, save the page (Ctrl+S, "Webpage, Complete"), then More > Import your Depop listings page.
- Set a monthly profit goal on the Plan tab and it tells her what that takes.

## Development notes

- `src/lib/` is pure math and parsing with no React or Firebase (`calc.ts`, `projections.ts`, `parse.ts`, `depopHtml.ts`). Tests in `test/*.test.ts` cover `calc` and `projections`.
- `src/hooks/useData.ts` is the only file that talks to Firestore. Pages and forms go through its `add`, `update`, `remove`, `addMany`, `replaceAll`, `saveSettings`.
- `npm run dev:mock` swaps `firebase.ts` and `useData.ts` for in-memory mocks (`test/*.mock.ts`) seeded from `test/seed.json`.
- `npm run emulators` then `npm run dev:emu` runs against local Firebase emulators (needs Java for the Firestore emulator).
- Net payout treats buyer-paid shipping as pass-through to the Depop label (payout = price minus fees minus any label cost you paid yourself minus refunds plus fees refunded). Shipping is stored on each sale but not added to payout. If Sierra buys her own labels, enter the label cost on the sale.
- Costs: Firebase's free tier covers this comfortably (one or two users, a few thousand documents).
