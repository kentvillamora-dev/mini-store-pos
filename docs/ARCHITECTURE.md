# Mini Store POS — Architecture

## Architecture Goal
The app is an offline-first PWA using IndexedDB/Dexie as the local transaction store. Google Sheets is the intended reporting, historical-replica, and disaster-recovery destination through Google Apps Script synchronization.

## Frontend
The application retains three top-level pages: **POS, Procurement, and Ledgers**. Daily Opening & Closing is an application-shell control, not a fourth page.

### POS
- Products are grouped by Category; Uncategorized Products use the same Cart-adjusted displayed-stock calculation.
- Cart stock reduction is temporary UI state until Sale completion.
- Checkout supports CASH and GCASH; CASH is default.
- Sale completion is atomic and permanently reduces stock.
- When EOD is enabled, an OPEN Business Day is required before Sale completion.

### Procurement
Landing order remains:
1. New Procurement
2. Add Product
3. Add Supplier
4. Set Price

Procurement save remains atomic across its header/items, movements, stock cache, and applicable Price History.

### Ledgers
Operational sections remain Sales, Procurements, Products, Suppliers. Inventory Reconciliation is an operational workflow surfaced within Ledgers rather than a fourth top-level page.

The Ledgers page is intentionally **action-oriented**, not the long-term historical reporting layer. It should expose records that may require user action while remaining performant as historical data grows.

Google Sheets is the intended complete historical replica/reporting layer. A dedicated in-app Inventory Reconciliation history view is not required for MVP because historical reconciliation reporting will be handled through Google Sheets.

Future Ledger scalability work should use pagination and filtering rather than rendering unlimited transaction history in React.

## Sales and Reversals
Sales are normalized into Sale + SaleItems. Sale save revalidates persisted Product state and stock before atomic persistence.

Statuses remain `VALID | VOID | REFUNDED`. Void and Refund preserve original records and restore stock through positive reversal movements.

With EOD enabled:
- a Sale is associated with the currently OPEN Business Day;
- Void is permitted only while the Sale's original Business Day remains OPEN;
- Refund is associated with the currently OPEN Business Day so its financial effect belongs to the day it is processed.

## Business Day / EOD Architecture
Dexie Version 10 added the optional Business Day workflow and persisted application settings.

EOD is **disabled by default** to reduce operational friction.

When disabled, normal Sales do not require a Business Day.

When enabled:
1. Only one Business Day may be OPEN.
2. Opening Cash is required and may be zero.
3. Sales require the OPEN Business Day.
4. EOD cannot be disabled while a Business Day remains OPEN.
5. Actual Closing Cash is required and may be zero.
6. Closing Note is optional.
7. Closing stores Cash Sales, GCash Sales, Refund totals, Net Sales, Expected Closing Cash, Actual Closing Cash, and Cash Variance.
8. Variance is preserved rather than used to rewrite historical Sales.

Core formulas:

```text
Expected Closing Cash
= Opening Cash + Cash Sales - Cash Refunds

Net Sales
= Cash Sales + GCash Sales - Cash Refunds - GCash Refunds

Cash Variance
= Actual Closing Cash - Expected Closing Cash
```

GCash contributes to revenue but not expected physical drawer cash.

The compact UI is implemented in `src/features/businessDay/BusinessDayPanel.tsx`; persistence/business logic is in `src/services/businessDayService.ts`. It expands only for opening/closing input.

## Inventory Model
Inventory remains explainable through `SALE`, `RESTOCK`, `ADJUSTMENT`, `VOID`, and `REFUND` movements. `Product.currentStockCache` is an operational cache, not the audit trail.

## Inventory Reconciliation Architecture
Dexie Version 11 adds normalized Inventory Reconciliation persistence:

```text
InventoryReconciliation
        |
        | 1 : many
        v
InventoryReconciliationItem
        |
        | only when variance != 0
        v
InventoryMovement: ADJUSTMENT
```

The workflow is intentionally tolerant of normal mini-store interruptions. Inventory and POS are not locked while physical counting occurs. Draft counts remain UI state and are not business events.

The user selects only the Products actually being counted. Product selection is searchable, grouped by Category, supports category-level selection/clearing, and collapses after **Done Selecting** so the user can focus on entering physical counts.

Before Review, the app rereads current Product records so the System quantity reflects persisted Sales/Procurements that may have occurred while counting. The user can edit physical counts during Review before confirmation.

At confirmation, `src/services/inventoryReconciliationService.ts` rereads each Product again and calculates:

```text
variance = physicalQuantity - currentStockCache
```

Confirmation is atomic across:
- one InventoryReconciliation header;
- one InventoryReconciliationItem for every counted Product, including variance `0`;
- one `ADJUSTMENT` InventoryMovement for each non-zero variance;
- Product `currentStockCache` updates for each non-zero variance.

Products not counted are untouched. Draft selection/count changes create no IndexedDB records until confirmation.

The UI is implemented in `src/features/inventoryReconciliation/InventoryReconciliationPanel.tsx` and mounted inside `src/features/dataViewer/DataViewer.tsx`.

## Google Sheets Synchronization Architecture
Dexie Version 12 introduces the local synchronization foundation.

The sync architecture is:

```text
Operational transaction
        |
        v
IndexedDB / Dexie commit succeeds
        |
        v
Sync Queue
        |
        | non-blocking / background path
        v
Google Apps Script Web App
        |
        v
Google Sheets replica
```

### Core synchronization rules
- IndexedDB remains the live operational source of truth.
- Google Sheets is a replica for reporting, history, and potential disaster recovery.
- Sync must never block, delay, or roll back a successful Sale, Procurement, Reconciliation, Business Day action, or reversal.
- Network requests are never part of the critical Dexie business transaction.
- Business records retain stable UUIDs so retries are idempotent.
- Google Sheets upserts records by stable ID instead of blindly appending duplicates.
- The sync queue stores references to records requiring replication, not stale copies of business payloads.
- The sync worker will reread the current record from IndexedDB immediately before transmission.
- Successful queue items are removed only after explicit acknowledgement from Google.
- Failed queue items remain locally for retry.
- `sync.lastSuccessfulAt` is persisted in `appSettings`, so the last successful sync survives app closure and device restart.
- A future `sync.lastFullSyncAt` may be added for full-database verification/recovery workflows.

### Sync Queue
Version 12 adds:

```text
SyncQueueItem
- id
- entityType
- entityId
- status: PENDING | FAILED
- attemptCount
- createdAt
- lastAttemptAt?
- lastError?
```

The queue uses a unique compound index:

```text
[entityType + entityId]
```

This prevents multiple queue rows for the same logical business entity.

Persistent `SYNCING` state is intentionally avoided. Runtime UI may show a temporary syncing state, but IndexedDB records remain `PENDING` or `FAILED` so an interrupted process cannot become permanently stuck as `SYNCING`.

### Syncable Entity Types
The current synchronization model covers:
- Product
- Category
- Inventory Movement
- Supplier
- Procurement
- Procurement Item
- Price History
- Sale
- Sale Item
- Business Day
- App Setting
- Inventory Reconciliation
- Inventory Reconciliation Item

The `syncQueue` table itself is synchronization infrastructure and is not part of the Google Sheets business-data replica.

### Google Apps Script Receiver
A Google Sheet named **Mini-Store POS Database Replica** and Apps Script project named **Mini-Store POS Sync** have been created.

The Apps Script receiver:
- exposes a deployed `/exec` web-app endpoint;
- uses sync protocol version `1`;
- accepts batches of up to `50` records;
- validates `queueItemId`, `entityType`, `entityId`, and record data;
- verifies that the envelope `entityId` matches the actual record ID;
- uses `LockService.getScriptLock()` to avoid overlapping spreadsheet writes;
- upserts by stable entity ID;
- returns explicit acknowledgement objects for each successful record.

Real HTTP POST testing from Codespaces confirmed:
- the deployed endpoint accepts protocol-version-1 payloads;
- Product records are written successfully;
- repeated POST of the same Product ID updates the existing row rather than creating a duplicate.

The PWA transport service is **not yet implemented**.

## Database Evolution
Current local database: **Dexie Version 12**.

- V1 Products
- V2 Inventory Movements
- V3 Suppliers, Procurements, Price History
- V4 Procurement void semantics
- V5 Procurement status normalization
- V6 normalized Procurement items
- V7 Categories
- V8 Sales and SaleItems
- V9 Sale Void/Refund state
- V10 Business Days, application settings, and EOD-aware Sale/reversal associations
- V11 Inventory Reconciliations and InventoryReconciliationItems
- V12 Sync Queue foundation

Existing business data must be preserved through upgrades.

## PWA
Updates must not force-refresh an active session. IndexedDB business data must survive application-shell updates.

Synchronization must also remain non-blocking. The POS must continue operating even when the network or Google endpoint is unavailable.

## UI Principles
Tablet-first; large touch targets; three-page navigation; compact operational Ledgers; compact optional EOD control; scalable searchable/category-grouped reconciliation Product selection; technical/audit-only data stays out of routine workflow unless actionable.

A compact Sync Status control is planned for the application shell. It should expose:
- Synced / Pending / Sync Issue state;
- unsynced record count;
- last successful sync timestamp.

## Current Status
Implemented and verified:
- offline-first PWA;
- Dexie Version 12;
- Categories and consistent Cart-adjusted Product stock display;
- Cash/GCash Sales;
- Sale Void/Refund;
- multi-item Procurement and Procurement Void;
- operational Ledger;
- optional EOD disabled by default;
- Business Day opening/closing;
- required Opening Cash and Actual Closing Cash;
- optional Closing Note;
- persisted closing totals, expected cash, and variance;
- EOD-aware Sale/Void/Refund behavior;
- compact EOD UI;
- periodic partial Inventory Reconciliation;
- searchable/category-grouped multi-select reconciliation Product picker;
- editable reconciliation Review before atomic confirmation;
- zero-variance counted-item audit records and non-zero ADJUSTMENT movements;
- local persistent sync queue schema;
- sync queue management service;
- persistent last-successful-sync metadata support;
- Google Sheets replica schema;
- deployed Google Apps Script batch receiver;
- real HTTP Product upsert/idempotency test;
- manual PWA update control.

Pending:
- PWA-side Google Sheets transport service;
- queue integration into business writes;
- automatic/non-blocking sync triggers;
- visible Sync Status UI;
- initial master-data replication before store go-live;
- full-sync/repair-sync capability;
- authentication/authorization hardening for wider client distribution;
- backup/recovery procedure using Google Sheets replica;
- stronger active-transaction update safeguards;
- Ledger pagination/filtering for long-term scalability.
