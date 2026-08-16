# Mini Store POS — Database Notes

## Purpose
Defines persistent data design and integrity rules. `src/db/database.ts` and live service code are authoritative if documentation disagrees.

## Current Database
```text
Database: miniStorePOS
Library: Dexie / IndexedDB
Schema: Version 10
```

Core tables include Products, Categories, Inventory Movements, Suppliers, Procurements, ProcurementItems, Price History, Sales, SaleItems, Business Days, and application settings.

## Existing Transaction Models
Products retain stable UUIDs and `currentStockCache` as an operational cache. Inventory Movements remain the stock audit trail.

Procurement is normalized as one header to many ProcurementItems. Save and Void remain atomic and audit-preserving.

Sales are normalized as one Sale to many SaleItems. Supported payment methods are CASH and GCASH. Status is `VALID | VOID | REFUNDED`. Sale completion, Void, and Refund remain atomic and preserve original records.

## Version 10 — Business Day / EOD
Version 10 introduces durable Business Day and EOD-setting persistence.

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
refundTotal?
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

## Migration Rule
Never rewrite historical migrations expecting them to rerun. Add a new version when stored records require transformation. Do not reset real business IndexedDB to avoid migration work. Preserve stable IDs and original records.

## Integrity Rules
Inventory remains reconcilable through RESTOCK, SALE, VOID, REFUND, and ADJUSTMENT movements.

Opening Cash is not revenue. Business Day summaries are derived audit/reconciliation records and do not replace individual Sales.

Cash discrepancies are stored as variance rather than corrected by changing historical Sales.

Original business timestamps must survive synchronization.

Business transactions are not hard-deleted.

## Pending Data Work
- periodic inventory reconciliation;
- synchronization metadata/queue;
- cloud representation of Sales, Procurements, reversals, and Business Days;
- conflict resolution;
- backup/recovery.
