# Mini Store POS — Google Sheets Sync Foundation

Checkpoint date: 2026-08-17  
Repository: `kentvillamora-dev/mini-store-pos`  
Branch: `main`  
Development milestone: Google Sheets synchronization foundation  
Resume point: Dexie Version 12 sync queue and Google Apps Script receiver are implemented and verified; PWA transport service is next.  
Last verified source commit: `b9315db` — `Add sync queue foundation`

## Instructions for the Next AI
Read `docs/AI_HANDOFF.md`, all permanent project documentation, this checkpoint, and the live source before proposing code.

Live repository code is authoritative.

Do not reconstruct sync implementation from this checkpoint or conversation history.

Preserve:
- existing IndexedDB business data;
- Dexie Version 1–12 migration history;
- offline-first transaction behavior;
- the rule that sync must never block or roll back operational business transactions.

## Verified Working State
Confirmed:
- Dexie Version 12 was implemented.
- `syncQueue` exists as a persistent Dexie table.
- `SyncEntityType` covers all current durable application-data entity types intended for Google Sheets replication.
- `SyncQueueItem` stores entity reference, status, retry count, and failure metadata.
- `[entityType+entityId]` is a unique compound index.
- `src/services/syncQueueService.ts` exists.
- duplicate enqueue requests reuse the existing queue record instead of creating another row.
- successful acknowledgement handling removes acknowledged queue items and persists `sync.lastSuccessfulAt` in `appSettings`.
- failed queue items remain locally with retry/error metadata.
- Version 12 build passed before commit.
- commit `b9315db` was pushed to remote `main`.

Google-side verified state:
- Google Spreadsheet created as `Mini-Store POS Database Replica`.
- Apps Script project renamed `Mini-Store POS Sync`.
- unused default `Sheet1` was removed.
- schema setup created the expected 13 replica tabs.
- Apps Script local Product upsert test passed.
- repeating the local Product upsert reused the same Product row.
- batch request validation test passed.
- Apps Script was deployed as a Web App using the `/exec` endpoint.
- direct browser `doGet()` test returned the expected sync service/protocol response.
- real Codespaces HTTP POST created `TEST-PRODUCT-HTTP-001`.
- repeating the same POST updated the existing row instead of creating a duplicate.
- explicit acknowledgement response returned the expected `queueItemId`, entity type, entity ID, and action.

## Current Build / Error State
Build status: **PASS** at the last verified local source step.

No known blocking TypeScript/compiler error.

The Apps Script endpoint is deployed and responding correctly.

No PWA-to-Google network code exists yet.

## Current Database
Current Dexie schema: **Version 12**.

Version 12 adds:

```text
syncQueue
```

Conceptual model:

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

Unique index:

```text
&[entityType+entityId]
```

Existing business data is not rewritten during the V11 -> V12 migration.

## Synchronization Architecture Decision
The synchronization path is intentionally separated from the operational transaction path:

```text
Business action
      |
      v
IndexedDB transaction succeeds
      |
      v
Business action is complete
      |
      v
queue entity for sync
      |
      v
background/non-blocking network attempt
      |
      v
Google Apps Script
      |
      v
Google Sheets
```

The user must never wait for Google Sheets before a Sale, Procurement, Reconciliation, Business Day action, Void, or Refund is considered locally successful.

Network failure must not roll back the local transaction.

## Google Sheets Role
Google Sheets is a replica, not the operational database.

It is intended to contain all durable application/business records from IndexedDB so it can provide:
- reporting;
- long-range historical review;
- reconciliation history;
- potential disaster recovery after catastrophic local data loss.

The in-app Ledgers page remains action-oriented.

A dedicated Inventory Reconciliation history section is not required in Ledgers because historical reporting will be handled in Google Sheets.

Future Ledger scalability should use pagination/filtering rather than rendering unlimited transaction history.

## Sync Status Decision
The future client UI should show:
- Synced / Pending / Sync Issue;
- number of unsynced records;
- last successful sync timestamp.

`sync.lastSuccessfulAt` is stored in Dexie `appSettings`, so it survives app closure and device restart.

The queue itself does not retain permanent SYNCED history.

A future `sync.lastFullSyncAt` may be added for full-database verification/recovery.

## Queue Rules
### Pending
A record requiring replication is represented once by `entityType + entityId`.

### Re-enqueue
If the same entity changes again before synchronization, reuse the existing queue item and reset it to PENDING.

### Failure
Keep the queue item and store retry/failure metadata.

### Success
Delete only queue item IDs explicitly acknowledged by Google.

### Payload
The queue stores entity references, not stale copies of business payloads.

The future sync transport will reread the current IndexedDB record immediately before transmission.

## Google Apps Script Protocol
Current protocol:

```text
SYNC_PROTOCOL_VERSION = 1
MAX_BATCH_SIZE = 50
```

Request record:

```text
queueItemId
entityType
entityId
data
```

Response acknowledgement:

```text
queueItemId
entityType
entityId
action: CREATED | UPDATED
```

Server validation currently checks:
- valid protocol version;
- non-empty record array;
- maximum batch size;
- duplicate queueItemId inside one request;
- supported entity type;
- valid entity ID;
- object payload;
- payload ID matches request entity ID.

Apps Script uses `LockService.getScriptLock()` during writes.

## Relevant Source Files
```text
src/db/database.ts
src/services/syncQueueService.ts
```

Current related business services that are **not yet integrated with sync**:

```text
src/services/saleService.ts
src/services/procurementService.ts
src/services/inventoryReconciliationService.ts
src/services/businessDayService.ts
src/services/productService.ts
src/services/categoryService.ts
src/services/supplierService.ts
src/services/priceService.ts
```

## Important Decisions Made
- Google Sheets should mirror all durable IndexedDB application/business records.
- `syncQueue` itself is infrastructure and is not part of the remote business-data replica.
- Sync must be non-blocking.
- No network request belongs inside the critical Dexie business transaction.
- Stable IDs provide idempotent retry behavior.
- Google acknowledgement is required before local queue deletion.
- Persistent queue states remain `PENDING | FAILED`; `SYNCING` should be runtime-only.
- `sync.lastSuccessfulAt` lives in `appSettings`.
- Full-database bootstrap was intentionally deferred because production currently has no business history requiring migration/import.
- Initial master-data replication is still required before real store go-live.
- Ledger history should remain operational/action-oriented; Google Sheets handles deep history/reporting.

## Known Issues / Risks
No known blocking implementation error.

Security limitation:
- the Apps Script Web App is intentionally reachable without requiring the POS tablet to authenticate with a Google account;
- the public web-app URL must not be treated as a secret credential;
- stronger authentication should be added before distributing this architecture broadly to unrelated external clients.

Operational limitation:
- browser/Android background execution cannot be assumed to run continuously while the PWA is fully closed;
- future sync triggering should use multiple safe opportunities such as post-transaction fire-and-forget attempts, app startup/resume, online events, and supported background mechanisms without blocking transactions.

## Not Yet Implemented
- `googleSheetsSyncService.ts`;
- client-side resolution of queue references to current Dexie records;
- PWA batch POST transport;
- acknowledgement validation in the PWA;
- automatic retry scheduling;
- transaction-service queue integration;
- automatic non-blocking sync trigger after successful business events;
- application-shell Sync Status UI;
- initial master-data replication before store go-live;
- full-sync/repair-sync workflow;
- formal Google Sheets restore procedure;
- stronger endpoint authentication;
- Ledger pagination/filtering.

## Exact Next Action
Create the PWA-side Google Sheets transport service.

The next service should:
1. read up to 50 queue items;
2. resolve each queue reference to its current IndexedDB record;
3. construct protocol-version-1 batch records;
4. POST the batch to the deployed Apps Script `/exec` endpoint;
5. validate the server response;
6. remove only explicitly acknowledged queue items through `markSyncBatchSuccessful()`;
7. mark unacknowledged/failed queue items through `markSyncAttemptFailed()`;
8. contain no business-transaction logic.

Do not yet modify Sale, Procurement, Reconciliation, Business Day, Product, Category, Supplier, or Price services in the same step.

## Subsequent Roadmap
After the transport service is independently verified:
1. queue new/changed records from business services;
2. ensure queue writes do not delay or invalidate completed business transactions;
3. trigger non-blocking sync attempts after successful operations;
4. add reconnect/startup retry behavior;
5. add visible Sync Status / pending count / Last Successful Sync;
6. perform initial master-data synchronization;
7. add repair/full-sync capability;
8. add Ledger pagination/filtering.

## FINAL RESUME MARKER

```text
Build status:
PASS

Database/schema version:
Dexie Version 12

Last verified source commit:
b9315db — Add sync queue foundation

Last verified feature:
Persistent sync queue foundation plus deployed/idempotent
Google Apps Script batch receiver.

Current unfinished work:
PWA-side Google Sheets transport service is not implemented.

Known blocking error:
None

Relevant files:
src/db/database.ts
src/services/syncQueueService.ts

NEXT ACTION:
Create src/services/googleSheetsSyncService.ts to resolve queued
entities, send protocol-version-1 batches to the deployed Apps Script
endpoint, validate acknowledgements, clear acknowledged queue items,
and retain/mark failures without modifying operational transaction
services yet.
```
