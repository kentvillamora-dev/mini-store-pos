# Mini Store POS — Architecture

## Architecture Goal
The app is an offline-first PWA using IndexedDB/Dexie as the local operational transaction store. Google Sheets is the intended reporting, historical-replica, and disaster-recovery destination through Google Apps Script synchronization.

## Frontend
The application retains exactly three top-level pages: **POS, Procurement, and Ledgers**. Daily Opening & Closing is an application-shell control, not a fourth page.

### Shared Product Category Order
Operational workflows use this family-selected Category order rather than alphabetical Category order:

1. Snacks
2. Beverages
3. Milk and Coffee
4. Cooking Essentials
5. Canned Goods
6. Instant Noodles
7. Household Cleaning
8. Personal Care
9. Cigarettes
10. Miscellaneous

Products remain alphabetized within each Category where a product list is displayed. This ordering is intended to reflect demand and relational navigation and applies across POS, Procurement, Product creation, and Inventory Reconciliation.

### POS
- Products are grouped by the shared Category order.
- Products are alphabetized within Category.
- Uncategorized Products use the same Cart-adjusted displayed-stock calculation.
- Cart stock reduction is temporary UI state until Sale completion.
- On tablet/desktop layouts, the Cart remains sticky while the user scrolls the Product catalog; narrow/mobile stacked layouts return the Cart to normal document flow.
- Checkout supports CASH and GCASH; CASH is default.
- Sale completion is atomic and permanently reduces stock.
- When EOD is enabled, an OPEN Business Day is required before Sale completion.

### Procurement
Landing order remains:
1. New Procurement
2. Add Product
3. Add Supplier
4. Set Price

#### Product creation UX
Add Product uses active Categories as large single-select radio tiles rather than a dropdown. Categories follow the shared operational Category order. The selected Category remains selected after a successful Product creation while Product Name is cleared, allowing several Products in the same Category to be entered with fewer repeated taps.

This is a UI/state optimization only. Product persistence and Category IDs remain unchanged.

#### New Procurement workflow
The Procurement workflow is optimized around how the family records actual deliveries from supplier receipts: process the receipt one line at a time rather than selecting a large batch first and entering details in a separate pass.

Current flow:

```text
New Procurement
      |
      v
Date + Supplier
      |
      v
Search / browse Product List
      |
      | Categories use shared operational order
      | Products A-Z within Category
      v
Select one Product
      |
      v
Inline Quantity + Total Cost
      |
      v
Add / Update
      |
      v
Live Procurement Review table
      |
      | repeat receipt lines as needed
      | edit/remove draft items
      | optionally edit Final Price
      v
Save Procurement
```

Rules and behavior:
- Procurement Date defaults to the current local date when a new draft starts.
- Supplier choices are displayed alphabetically.
- Product selection includes Quick Search.
- Category headers are visually distinct from Product rows.
- Categories follow the shared operational Category order; Products are alphabetized within Category.
- Selecting a Product expands inline Quantity and Total Cost fields directly below that Product.
- Add logs the line into the Procurement Review table immediately.
- Selecting an already-added Product loads its existing Quantity and Total Cost for Update rather than creating a duplicate draft line.
- Draft items may be removed before Save.
- The Procurement Review table is part of the same screen; there is no separate Review stage/button.
- The review table displays Product, Qty, Total Cost, Unit Cost, Current Price, Recommended Price, Final Price, and item actions.
- `Current Price` means the Product's current persisted retail/selling price.
- Final Price is displayed as a value with an explicit **Edit** action rather than an always-open text field.
- Editing Final Price opens a focused numeric input with Save/Cancel controls.
- Save Procurement is blocked while a Final Price edit remains active.
- Draft selection, search, Quantity/Cost entry, Add/Update, Remove, and Final Price editing do not change inventory or create persistent Procurement records.
- `ProcurementItemInput[]` remains the UI-to-service contract for the final save.
- Procurement persistence/service architecture was not redesigned by these UX refinements.

Procurement save remains atomic across header/items, RESTOCK movements, Product stock cache, and applicable Price History.

### Ledgers
Operational sections remain Sales, Procurements, Products, Suppliers. Inventory Reconciliation is an operational workflow surfaced within Ledgers rather than a fourth top-level page.

The Ledgers page is intentionally action-oriented, not the long-term historical reporting layer. Google Sheets is the intended complete historical replica/reporting layer. Future Ledger scalability should use pagination and filtering rather than rendering unlimited transaction history in React.

## Sales and Reversals
Sales are normalized into Sale + SaleItems. Sale save revalidates persisted Product state and stock before atomic persistence.

Statuses remain `VALID | VOID | REFUNDED`. Void and Refund preserve original records and restore stock through positive reversal movements.

With EOD enabled:
- a Sale is associated with the currently OPEN Business Day;
- Void is permitted only while the Sale's original Business Day remains OPEN;
- Refund is associated with the currently OPEN Business Day so its financial effect belongs to the day it is processed.

## Business Day / EOD Architecture
Dexie Version 10 added the optional Business Day workflow and persisted application settings.

EOD is disabled by default. When enabled:
1. Only one Business Day may be OPEN.
2. Opening Cash is required and may be zero.
3. Sales require the OPEN Business Day.
4. EOD cannot be disabled while a Business Day remains OPEN.
5. Actual Closing Cash is required and may be zero.
6. Closing Note is optional.
7. Closing stores Cash Sales, GCash Sales, Refund totals, Net Sales, Expected Closing Cash, Actual Closing Cash, and Cash Variance.
8. Variance is preserved rather than used to rewrite historical Sales.

```text
Expected Closing Cash
= Opening Cash + Cash Sales - Cash Refunds

Net Sales
= Cash Sales + GCash Sales - Cash Refunds - GCash Refunds

Cash Variance
= Actual Closing Cash - Expected Closing Cash
```

GCash contributes to revenue but not expected physical drawer cash.

The compact UI is implemented in `src/features/businessDay/BusinessDayPanel.tsx`; persistence/business logic is in `src/services/businessDayService.ts`.

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

The user selects only Products actually being counted. Product selection is searchable, grouped using the shared operational Category order, supports category-level selection/clearing, and collapses after **Done Selecting**. Products remain alphabetized within Category.

Before Review, the app rereads current Product records so System quantity reflects persisted activity that may have occurred while counting. The user can edit physical counts during Review before confirmation.

At confirmation, `src/services/inventoryReconciliationService.ts` rereads each Product again and calculates:

```text
variance = physicalQuantity - currentStockCache
```

Confirmation is atomic across the reconciliation header, every counted-item record, required ADJUSTMENT movements, and Product stock-cache updates. Products not counted are untouched.

## Google Sheets Synchronization Architecture
Dexie Version 12 introduces the local synchronization foundation.

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
- Sync must never block, delay, or roll back a successful operational business transaction.
- Network requests are never part of the critical Dexie business transaction.
- Business records retain stable UUIDs so retries are idempotent.
- Google Sheets upserts records by stable ID instead of blindly appending duplicates.
- The sync queue stores references to records requiring replication, not stale business payload copies.
- The sync worker will reread the current record from IndexedDB immediately before transmission.
- Successful queue items are removed only after explicit acknowledgement from Google.
- Failed queue items remain locally for retry.
- `sync.lastSuccessfulAt` is persisted in `appSettings`.

### Sync Queue
Version 12 adds `SyncQueueItem` with ID, entity type/ID, `PENDING | FAILED` status, attempt count, creation time, and optional failure metadata. The unique `[entityType + entityId]` compound index prevents duplicate queue rows for one logical entity.

Persistent `SYNCING` state is intentionally avoided; runtime UI may show syncing while persisted queue records remain recoverable as PENDING or FAILED.

### Syncable Entity Types
Current model covers Product, Category, Inventory Movement, Supplier, Procurement, Procurement Item, Price History, Sale, Sale Item, Business Day, App Setting, Inventory Reconciliation, and Inventory Reconciliation Item. `syncQueue` itself is infrastructure and is not replicated.

### Google Apps Script Receiver
The Google Sheet **Mini-Store POS Database Replica** and Apps Script project **Mini-Store POS Sync** exist. The deployed `/exec` receiver uses protocol version 1, accepts batches up to 50 records, validates envelope/data IDs, locks overlapping writes, upserts by stable ID, and returns explicit acknowledgements.

Real HTTP POST testing confirmed Product creation and idempotent update behavior. The PWA transport service is **not yet implemented**.

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
Updates must not force-refresh an active session. IndexedDB business data must survive application-shell updates. Synchronization must remain non-blocking and POS must continue operating when the network or Google endpoint is unavailable.

## UI Principles
- Tablet-first with large touch targets and low-friction workflows suitable for older family users.
- Exactly three top-level pages.
- Darker, restrained enterprise-style visual treatment rather than bright controls.
- Shared operational Category order across workflows.
- Alphabetical Products within Category where lists are used.
- Searchable/category-grouped Product discovery for large catalogs.
- Receipt-line-driven Procurement entry to match the family's real process.
- Avoid redundant workflow stages; review information should appear as soon as the draft contains enough data.
- Explicit Edit actions are preferred over permanently open fields when accidental changes would add clutter or risk.
- Sticky POS Cart on tablet/desktop keeps transaction context visible while browsing Products.
- Technical/audit-only data stays out of routine workflows unless actionable.

A compact Sync Status control is planned for the application shell, exposing Synced/Pending/Sync Issue state, pending count, and last successful sync timestamp.

## Current Status
Implemented and verified through source commit `b3e16363` (`Streamline procurement review workflow`):
- offline-first PWA and Dexie Version 12;
- Categories and Cart-adjusted Product stock display;
- Product creation with Category radio tiles and retained Category selection;
- shared family-selected Category order across operational workflows;
- sticky POS Cart on tablet/desktop;
- Cash/GCash Sales and Sale Void/Refund;
- receipt-driven multi-item Procurement;
- inline Qty/Total Cost Product entry;
- live same-screen Procurement Review;
- Current Price / Recommended Price / editable Final Price review;
- Procurement Void;
- operational Ledgers;
- optional EOD and Business Day workflow;
- periodic partial Inventory Reconciliation;
- local persistent sync queue schema/service;
- Google Sheets replica schema and deployed Apps Script receiver;
- real HTTP Product upsert/idempotency test;
- manual PWA update control.

Pending:
- `src/services/googleSheetsSyncService.ts`;
- queue integration into business writes;
- automatic/non-blocking sync triggers;
- visible Sync Status UI;
- initial master-data replication;
- full-sync/repair-sync capability;
- authentication/authorization hardening for wider distribution;
- backup/recovery procedure using the Google Sheets replica;
- stronger active-transaction update safeguards;
- Ledger pagination/filtering.
