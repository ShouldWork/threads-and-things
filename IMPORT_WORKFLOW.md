# Importing and preserving your data

The CSV is an update source. Saved records, inventory notes, and app edits remain in Firestore between imports.

## Repeat Depop sales imports

1. Export the sales CSV from Depop as usual. You can export all sales each time.
2. In More, choose the Depop export file.
3. Review the new, updated, unchanged, and skipped counts.
4. Resolve any uncertain rows: update a particular saved sale, add a genuinely separate sale, or skip the row. You can review your choice again before saving.
5. Import the changes. A history entry records the filename, time, account, counts, and recovery snapshot.

Native sale/transaction and product identifiers are preferred. Order identifiers are combined with product/SKU identifiers when available, so multiple products from one order remain separate. Header matching accepts case/spacing variants and the supported aliases in `src/lib/parse.ts`.

If an older saved record has SKU/brand details that the CSV omits, or a newer export adds an identifier, the importer offers the existing sale as a possible match. Confirm it once; future exports in that format are remembered. Existing exact duplicates create an uncertain match instead of silently choosing a record. Identical real transactions without IDs remain ambiguous and need your decision.

For example: import 20 sales, edit inventory notes, then import a full export with 22 sales. The result should be two new sales, updates to matching source-owned financial fields, and the same saved notes. Reimporting an unchanged file does not add another copy. Columns absent from that file cannot zero out existing fees or costs.

## Notes, costs and manual corrections

- Inventory imports match by SKU and preserve internal IDs. Notes, costs and other fields changed in the app are protected. An inventory item absent from a file remains saved.
- Source-owned values update from later exports. Fields you change in a form are protected by default. Imported source values remain stored separately, even when a protected visible value is retained.
- Tracker tax and mileage settings are offered as unchecked choices in the import preview. They do not silently replace settings entered in the app.
- Open a record and choose **Use latest imported values** to restore the latest source values and release protection. You can also disable **Protect my edits on future imports** before saving.
- Legacy records have no edit/source history. Their nonempty local inventory/details fields are protected when first matched to avoid erasing existing notes, costs or SKUs. Financial fields supplied by the CSV can still update unless explicitly protected.
- A CSV sale links to inventory only through an explicit matching SKU; descriptions are never used to guess inventory links. Missing item costs can be filled from the linked inventory item. Explicit zero costs are respected.
- Listings match by product ID or link. Other logs match their original row identity. Missing rows remain saved; absence alone does not mean deletion or sale. Identical imported log rows without separate identifiers cannot be reliably distinguished; duplicate saved matches block that collection's import for review.

## Cleaning up existing duplicate sales

More shows **Review possible duplicate sales** when it finds candidates. Check the dates, prices, fees, refunds, costs and SKUs. Different native transaction/product IDs remain separate.

Choose the record whose financial values should remain and confirm consolidation by typing `MERGE`. The other selected rows stop contributing to totals. Unambiguous missing local identity fields and remembered import aliases are retained, and inventory links are reconciled. Inventory notes remain saved. Suggestions can include distinct real sales that look alike, so nothing is consolidated automatically.

## Backups, undo and clearing

- **Download full backup** saves all seven collections, IDs, source values, protected edits, notes and settings as a versioned JSON file. Sales CSV alone is not a full backup.
- **Undo this operation** restores records/settings from immediately before an import, consolidation, clear, reset or restore. It copies the old records into a fresh active version so the recovery snapshot stays untouched. Undo is blocked once later edits or operations have occurred, preventing those changes from being erased.
- **Restore JSON backup** explicitly replaces all current records and settings with a full backup. It is available to the owner and requires `RESTORE`. Current records are retained in a pre-restore snapshot. Restore is useful for deliberate recovery after later changes; back up those later changes first if needed.
- **Clear imported sales** requires `CLEAR SALES`. It removes imported and older unclassified sales, preserving explicitly tagged manual sales, inventory, notes, physical sold statuses and other logs. Older records have no reliable origin tag, so inspect/download a backup first. Inventory references to removed sales are cleared.
- **Reset shop data** requires `RESET SHOP`. It clears every record collection and preserves settings, account access and recovery history.

Clear, reset and restore are owner controls. All import/recovery operations require connectivity and synced pending changes. They create a recovery snapshot; no records are deleted from production as part of installing these code changes.

Each operation currently stages a complete dataset copy to publish all collections atomically. Previous/failed versions and operation history consume storage. Cleanup/retention needs a separate administrative policy; no automatic pruning is performed. Historical imports made before this update have no undo entry.

The changes must be deployed together with the matching Firestore rules before the hosted app gains this behavior. Local/demo tests do not update production records.
