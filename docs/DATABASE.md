# Mini Store POS — Database Notes

## Purpose
Defines persistent data design and integrity rules. `src/db/database.ts` and live service code are authoritative if documentation disagrees.

## Current Database

```text
Database: miniStorePOS
Library: Dexie / IndexedDB
Schema: Version 12
```

Core business/application tables include Products, Categories, Inventory Movements, Suppliers, Procurements, ProcurementItems, Price History, Sales, SaleItems, Business Days, application settings, Inventory Reconciliations, and Inventory Reconciliation Items.

Version 12 additionally introduces `syncQueue` as synchronization infrastructure.

## Existing Transaction Models
Products retain stable UUIDs and `currentStockCache` as an operational cache. Inventory Movements remain the stock audit trail.

Procurement is normalized as one header to many ProcurementItems. Save and Void remain atomic and audit-preserving.

Sales are normalized as one Sale to many SaleItems. Supported payment methods are CASH and GCASH. Status is `VALID | VOID | REFUNDED`. Sale completion, Void, and Refund remain atomic and preserve original records.

## Version 10 — Business Day / EOD
Version 10 introduced durable Business Day and EOD-setting persistence.

Conceptual BusinessDay fields:

```text
id
status: OPEN | CLOSED
openingCash
openedAt
closedAt?
cashSalesTotal?
gcashSalesTotal?
cashRefundTotal?
gcashRefundTotal?
netSalesTotal?
expectedClosingCash?
actualClosingCash?
cashVariance?
closingNote?
```

Closing-only fields are optional because an OPEN Business Day has not yet been closed.

EOD is disabled by default and its setting persists locally.

Rules:
- only one Business Day may be OPEN;
- Opening Cash is required and may be zero;
- EOD cannot be disabled while a Business Day is OPEN;
- when EOD is enabled, Sales require an OPEN Business Day;
- Actual Closing Cash is required and may be zero;
- Closing Note is optional;
- closing stores calculated totals and variance without rewriting individual Sales.

Formulas:

```text
Expected Closing Cash
= Opening Cash + Cash Sales - Cash Refunds

Net Sales
= Cash Sales + GCash Sales - Cash Refunds - GCash Refunds

Cash Variance
= Actual Closing Cash - Expected Closing Cash
```

GCash affects Net Sales but not expected physical drawer cash.

Sale Business Day association is optional because EOD itself is optional and pre-Version-10 Sales must remain valid.

When EOD is enabled:
- Void is allowed only while the Sale's original Business Day remains OPEN.
- Refund is associated with the currently OPEN Business Day.

## Version 11 — Inventory Reconciliation
Version 11 introduces two normalized persistent tables:

```text
InventoryReconciliation
- id
- reconciliationDate
- reason
- note?
- countedItemCount
- adjustedItemCount
- createdAt

InventoryReconciliationItem
- id
- reconciliationId
- productId
- expectedQuantity
- physicalQuantity
- variance
```

Every Product actually counted receives an InventoryReconciliationItem, including when `variance = 0`. This preserves evidence that the Product was physically checked even when no stock correction was required.

Products not selected/counting are not included and are not modified.

Draft counts are not persisted. Selection, count entry, count editing, and Review remain temporary UI state until confirmation.

At confirmation, the service rereads each Product from IndexedDB and uses the current persisted `currentStockCache` as expected quantity.

```text
variance = physicalQuantity - expectedQuantity
```

For `variance = 0`:
- save the InventoryReconciliationItem;
- create no InventoryMovement;
- do not update Product stock.

For non-zero variance:
- save the InventoryReconciliationItem;
- create an `ADJUSTMENT` InventoryMovement with `quantityDelta = variance`;
- reference the reconciliation item through `referenceId`;
- update `Product.currentStockCache` to the confirmed physical quantity.

The reconciliation header, all item records, all required ADJUSTMENT movements, and Product stock updates are committed in one Dexie transaction.

Version 11 adds new stores only; it does not require rewriting existing records.

## Version 12 — Synchronization Queue
Version 12 introduces one synchronization-infrastructure table:

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

The table uses:

```text
id
&[entityType+entityId]
status
createdAt
```

The `&` compound index enforces uniqueness for one logical entity reference.

This means the same entity cannot accumulate multiple independent queue records merely because its state changes several times before synchronization.

### Syncable entity types
Current entity types are:

```text
PRODUCT
CATEGORY
INVENTORY_MOVEMENT
SUPPLIER
PROCUREMENT
PROCUREMENT_ITEM
PRICE_HISTORY
SALE
SALE_ITEM
BUSINESS_DAY
APP_SETTING
INVENTORY_RECONCILIATION
INVENTORY_RECONCILIATION_ITEM
```

### Queue semantics
The queue stores **references**, not copies of business payloads.

A queue record answers:

```text
Which current IndexedDB entity still needs replication?
```

The future sync transport will reread the canonical entity from the appropriate IndexedDB table immediately before transmission.

Persistent status is intentionally limited to:

```text
PENDING
FAILED
```

A runtime `SYNCING` state may be displayed in the UI later, but it is not persisted. This prevents browser/PWA interruption from leaving records permanently stuck as `SYNCING`.

### Enqueue behavior
`src/services/syncQueueService.ts` provides `enqueueEntityForSync()`.

If the entity is not yet queued:
- create a new PENDING queue row.

If the same `entityType + entityId` is already queued:
- reuse the existing queue row;
- reset it to PENDING;
- clear prior failure metadata.

### Failure behavior
`markSyncAttemptFailed()`:
- keeps the queue item;
- sets status to FAILED;
- increments `attemptCount`;
- stores `lastAttemptAt`;
- stores `lastError`.

Operational business transactions must remain unaffected by sync failure.

### Successful acknowledgement behavior
`markSyncBatchSuccessful()`:
- removes only queue item IDs that the remote receiver explicitly acknowledged;
- writes the timestamp to:

```text
appSettings
key = sync.lastSuccessfulAt
```

The queue is therefore not a permanent sync-history table.

`sync.lastSuccessfulAt` persists in IndexedDB and survives app closure/device restart unless local browser storage itself is cleared or lost.

A future setting may track:

```text
sync.lastFullSyncAt
```

for full-database verification/recovery workflows.

## Google Sheets Replica
Google Sheets is intended to mirror all durable business/application records from IndexedDB while remaining secondary to the local operational database.

The replica covers:
- Products;
- Categories;
- Inventory Movements;
- Suppliers;
- Procurements;
- Procurement Items;
- Price History;
- Sales;
- Sale Items;
- Business Days;
- non-sync App Settings;
- Inventory Reconciliations;
- Inventory Reconciliation Items.

The `syncQueue` table itself is not replicated because it is synchronization infrastructure, not business data.

Stable IDs and original timestamps must remain unchanged during replication.

Google Sheets is intended for:
- reporting;
- long-range historical review;
- reconciliation history;
- potential disaster recovery after catastrophic local data loss.

It is not the live checkout database.

## Google Apps Script Sync Protocol
The Google Apps Script receiver currently uses:

```text
Protocol version: 1
Maximum batch size: 50
```

Each request record conceptually includes:

```text
queueItemId
entityType
entityId
data
```

The server validates:
- protocol version;
- non-empty batch;
- batch size;
- unique queueItemId inside the batch;
- supported entityType;
- non-empty entityId;
- object data payload;
- record envelope entityId matches the actual payload ID.

The receiver uses the stable business ID to upsert the corresponding Google Sheets row.

Successful responses contain explicit acknowledgements including the original `queueItemId`.

A local queue item must not be removed unless the client receives a valid explicit acknowledgement for that queue item.

Repeated transmission of the same stable business ID must update the existing Google Sheets row rather than create a duplicate.

Real HTTP testing has confirmed Product upsert idempotency through the deployed Apps Script `/exec` endpoint.

## Schema History
- V1 Products
- V2 Inventory Movements
- V3 Suppliers, Procurements, Price History
- V4 Procurement void semantics
- V5 Procurement status normalization
- V6 normalized Procurement items
- V7 Categories
- V8 Sales/SaleItems
- V9 Sale reversal state/metadata
- V10 Business Day/EOD persistence and associations
- V11 Inventory Reconciliations and InventoryReconciliationItems
- V12 Sync Queue

## Migration Rule
Never rewrite historical migrations expecting them to rerun. Add a new version when stored records require transformation.

Do not reset real business IndexedDB to avoid migration work.

Preserve stable IDs and original records.

Version 12 adds a new store only and does not rewrite existing business data.

## Integrity Rules
Inventory remains reconcilable through RESTOCK, SALE, VOID, REFUND, and ADJUSTMENT movements.

`Product.currentStockCache` is an operational cache. Reconciliation changes it only through a confirmed, traceable reconciliation transaction.

Physical counting does not lock the POS or inventory. Final reconciliation variance is based on current persisted Product stock when confirmation is processed.

A reconciliation records only Products actually counted. Zero-variance counted Products remain part of the permanent reconciliation audit record.

Opening Cash is not revenue. Business Day summaries are derived audit/reconciliation records and do not replace individual Sales.

Cash discrepancies are stored as variance rather than corrected by changing historical Sales.

Original business timestamps must survive synchronization.

Business transactions are not hard-deleted.

Sync failure must never invalidate or roll back an already successful local business transaction.

Google Sheets acknowledgement is required before a queue item may be removed.

The sync queue must remain durable across app closure and offline periods.

## Pending Data Work
- PWA-side Google Sheets transport service;
- queue integration into business writes;
- automatic retry/non-blocking sync triggers;
- visible sync status and pending-count UI;
- initial master-data replication before production use;
- full-sync/repair-sync capability;
- cloud/remote authentication hardening;
- conflict/recovery policy;
- formal restore procedure from Google Sheets.
