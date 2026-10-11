# Threads and Things

Sierra's reseller dashboard: React, TypeScript, Vite, Firebase Google authentication, Firestore, and Firebase Hosting. A previously cached production app can reopen offline, and record changes queue locally until Firestore synchronizes them.

## Features

- Home: profit, sales, fees, current listings, hours, inventory, and tax set-aside. Recent windows end today; sales, costs, and hours share the same range.
- Sales and Closet: searchable records with editing and pagination through all loaded entries.
- Plan: sales run rates, profit projections, inventory estimates, monthly goals, and monthly profit/loss.
- Learn: insights from the shop's records and the seller playbook.
- More: review imports and uncertain sale matches, edit logs, inspect import history, undo recent operations, review duplicate sales, download/restore full backups, clear imported sales, and reset shop records.
- The + button adds any record type. Saving a sale against an inventory SKU marks the item sold in the same atomic batch. Changing its SKU or deleting the sale restores the prior item's status.

See [REVIEW_FIXES.md](REVIEW_FIXES.md) for the review findings, fixes, validation results, and deployment notes.
See [IMPORT_WORKFLOW.md](IMPORT_WORKFLOW.md) for repeat CSV imports, preserving edits, and recovery controls.

## Development

Use Node **22.12 or newer**; GitHub Actions uses Node 24. Firestore emulator tests require **Java 21** and Firebase CLI 15.33.0. On Windows, use `npm.cmd`/`npx.cmd` if PowerShell blocks their script wrappers.

```sh
npm ci
npm run dev:mock                 # in-memory seed data; no Firebase backend; Ask AI gives canned demo answers
# PowerShell: $env:LIVE_AI='1'; npm run dev:mock   # demo data, but Ask AI calls the real Gemini free tier (uses the shop's allowance)
npm run dev                      # real Firebase project; requires .env
npm run check                    # unit/component/hook tests, TypeScript, production build
npm audit --audit-level=moderate
npm install --global firebase-tools@15.33.0
firebase emulators:exec --only firestore --project demo-threads-and-things "npm run test:rules"
npx playwright install chromium
npm run test:browser              # run after the production build
npm run build:preview             # demo preview build; overwrites dist
```

`npm test` excludes emulator tests. The browser suite uses the demo app for CRUD and the production build for offline app-shell reload. `npm run build:preview` aliases Firebase, data access and the AI to in-memory mocks. Changes in a demo tab disappear when it reloads.

For local interactive emulator development, run `npm run emulators`, then `npm run dev:emu` in another terminal. `.env.emulator` uses the local `demo-threads-and-things` project, avoiding production services.

## Firebase setup

1. In project `threads-and-things-e0943`, enable Google authentication and create Firestore in production mode.
2. Copy the web Firebase configuration into `.env` using `.env.example`. `.env.production` supplies the production build identifiers. Missing configuration displays a setup message. These identifiers are [Firebase project configuration, not server credentials](https://firebase.google.com/docs/projects/api-keys).
3. Administratively create `users/{lowercaseGoogleEmail}` with `role: "owner"` and `shops: ["sierra"]`. Add each authorized person separately. Verified members can read their listed shops; only `owner` and `editor` roles can write. The app cannot change membership documents.
4. Create the shop settings document, then deploy the matching rules and app when ready. Existing legacy documents are supported; imports activate a versioned dataset.

```text
users/{email}                                  role, shops
shops/{shopId}                                 settings, revision, lastWrite, dataVersion
shops/{shopId}/{collection}/{id}                legacy records
shops/{shopId}/datasets/{version}/{collection}/{id}  versioned records
shops/{shopId}/history/{operationId}            import/recovery history
```

Collections: `sales`, `listings`, `inventory`, `expenses`, `mileage`, `time`, `issues`. Record shapes are in `src/types.ts`; validation and defaults are in `src/lib/records.ts`. The first listed shop is opened. Optional `dataVersion` selects the active dataset; absent/empty selects legacy collections. Rules reject writes to retired datasets.

## Imports and offline use

More accepts Depop sales exports, saved Depop Active listings pages, and tracker spreadsheets. Imports update matching records and add new records; rows missing from a file remain saved. Match sales by native transaction/product ID where available, inventory by SKU, and listings by product ID/link. Review new, updated, unchanged, and skipped counts, and resolve uncertain sale matches before confirming. Identical sales without IDs cannot always be distinguished.

Imported records store their source values separately from protected app edits. Columns absent from an export cannot clear existing values. Inventory notes and costs already maintained in the app are preserved. Form edits are protected by default; “Use latest imported values” releases protection. Legacy nonempty inventory/local sale details are protected when first matched.

An import validates the file, computes record updates, stages a complete new dataset without deleting live records, and activates it with a history entry in a transaction only if the shop revision is unchanged. Internal record IDs stay stable. A failed upload or concurrent edit leaves current data active. Each operation copies the whole dataset for atomic publication; retained snapshots consume storage and need deliberate administrative cleanup as they accumulate.

More has separate owner controls for clearing imported/unclassified sales, resetting all records, and restoring a full JSON backup. Clear imported sales keeps explicitly tagged manual sales and all inventory/notes, including physical sold statuses. Older unclassified sales are included in the clear count because their original source is unknown. Reset keeps settings, account access and recovery history. Both require a typed confirmation and retain the previous dataset. Undo restores into a fresh version and is blocked after later edits; downloading/restoring a full backup supports deliberate recovery after later changes.

Ordinary forms can save offline after the shop is cached. A queued message means accepted on this device, not confirmed by the server; the header shows pending changes and later failures appear as alerts. Imports require connectivity and synced pending changes. Sign out after synchronization. Offline records remain in browser storage, so use trusted devices. First-time authentication requires connectivity.

## Deployment

```sh
firebase login
npm run deploy                   # validates, builds, deploys Firestore and Hosting
```

Before publishing, run the emulator/browser checks above as well. The local deploy command runs unit tests and the production build; GitHub Actions additionally runs audit, emulator, and browser checks.

Pushing `main` triggers validation and deployment of Firestore rules/indexes plus Hosting. The service account secret `FIREBASE_SERVICE_ACCOUNT_THREADS_AND_THINGS_E0943` needs both Firestore deployment and Hosting permissions. Same-repository PRs receive demo Hosting previews after validation; fork PRs validate without deployment secrets. Preview builds have no live Firebase backend.

Release the matching rules and app together; older cached app versions cannot perform writes that satisfy the new revision rules. Close old tabs and reopen after rollout. Service worker updates wait for old tabs to close rather than reloading open forms.

## Implementation notes

- `src/firebase.ts` initializes authentication; `src/firestore.ts` initializes persistent Firestore caching when the signed-in shop loads.
- `src/hooks/useData.ts` owns subscriptions, validated CRUD, atomic sale writes, local queue acknowledgement, and staged imports. Pages use `add`, `update`, `remove`, `saveSale`, `saveSettings`, and `importData`. Updates supply a complete validated record.
- `src/lib/` contains math, dashboard bounds, import matching, parsing, validation, and sale/inventory planning. Tests cover these helpers and the important failure paths.
- Pages and spreadsheet parsing load lazily. The production service worker caches the complete app for offline reopening; total cached download size is larger than the initial critical JavaScript bundle.
- Buyer-paid shipping is treated as pass-through. Payout subtracts selling/payment/boost fees, seller-paid label cost, and refunds, adding refunded fees. Record seller-paid labels on the sale.
