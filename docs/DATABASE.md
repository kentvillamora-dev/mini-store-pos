# Mini Store POS — Database Notes

## Purpose

This document defines the intended persistent data model and integrity rules.

The actual implementation in `src/db/database.ts` and the relevant service files is authoritative if this document and code ever disagree.

## Current Local Database

```text
Database: miniStorePOS
Library: Dexie over IndexedDB
Current schema version: 9
```

## Current Tables

```text
products
categories
inventoryMovements
suppliers
procurements
procurementItems
priceHistory
sales
saleItems
```

## Product

Key fields:

```text
id
sku?
name
categoryId?
sellingPrice
currentStockCache
active
createdAt
updatedAt
```

`id` is the stable Product identity.

`currentStockCache` is the fast operational stock cache. Inventory Movements remain the audit trail explaining stock changes.

## Category

Version 7 introduced `categories`.

Products reference Categories through `Product.categoryId`.

Default Categories use stable canonical IDs and startup initialization repairs duplicate canonical records without orphaning Products.

## Supplier

Supplier names are protected against trimmed/case-insensitive duplicates.

A Supplier referenced by Procurement history cannot be deleted.

## Procurement / ProcurementItem

Version 6 normalized Procurement into:

```text
Procurement 1 ---- * ProcurementItem
```

Procurement contains Supplier, business date, status, void metadata, and creation timestamp.

ProcurementItem contains Product-specific quantity, cost, Unit Cost, Suggested SRP, and pricing snapshots.

A successful Procurement save is one Dexie transaction across:

```text
procurements
procurementItems
inventoryMovements
products
priceHistory
```

Procurement status:

```text
VALID
VOID
```

A Procurement Void preserves the original records, creates opposite VOID movements, reduces cached stock, and records required void metadata. The whole operation is atomic and rejects a reversal that would create negative stock.

## Sale

Version 8 introduced the `sales` table.

Fields:

```text
id
totalAmount
paymentMethod
cashReceived?
changeDue?
status
voidedAt?
voidReason?
refundedAt?
refundReason?
createdAt
```

Payment methods:

```text
CASH
GCASH
```

Status values after Version 9:

```text
VALID
VOID
REFUNDED
```

Indexed schema:

```text
id, paymentMethod, status, createdAt
```

Meaning:

- `totalAmount` — total transaction value;
- `paymentMethod` — Cash or GCash marker;
- `cashReceived` — stored for Cash transactions;
- `changeDue` — stored for Cash transactions;
- `voidedAt` / `voidReason` — populated when a Sale is voided;
- `refundedAt` / `refundReason` — populated when a Sale is refunded;
- `createdAt` — original Sale creation timestamp.

GCash currently has no payment-gateway integration.

## SaleItem

Version 8 introduced `saleItems`.

Fields:

```text
id
saleId
productId
quantity
unitPrice
lineTotal
```

Indexed schema:

```text
id, saleId, productId
```

Relationship:

```text
Sale 1 ---- * SaleItem
```

SaleItem snapshots the Product-specific quantity and selling price used for the transaction.

## Sale Creation

Input contains:

```text
paymentMethod
cashReceived?   // Cash only
items[]
```

Each item contains:

```text
productId
quantity
unitPrice
```

Before persistence, the service validates:

- at least one item;
- valid payment method;
- no duplicate Product lines;
- whole-number Quantity > 0;
- Unit Price > 0;
- sufficient Cash Received for Cash;
- each Product still exists and is active;
- persisted stock is still sufficient.

A successful Sale is one Dexie transaction across:

```text
sales
saleItems
inventoryMovements
products
```

It creates:

```text
1 Sale
N SaleItems
N SALE Inventory Movements
N Product stock-cache decreases
```

Each SALE movement uses:

```text
quantityDelta = -SaleItem.quantity
referenceId = SaleItem.id
```

If any validation/write fails, the transaction rolls back.

The Cart's temporary displayed-stock decrease before checkout is UI-only and does not modify IndexedDB.

## Sale Void / Refund

Version 9 supports two audit-preserving reversal types.

### Void

Use when the Sale itself was entered in error.

A successful Void:

```text
Sale.status = VOID
Sale.voidedAt = reversal timestamp
Sale.voidReason = required reason

for each SaleItem:
    new InventoryMovement.type = VOID
    quantityDelta = +item.quantity
    referenceId = item.id
    Product.currentStockCache += item.quantity
```

### Refund

Use when the original Sale was valid but is later reversed.

A successful Refund:

```text
Sale.status = REFUNDED
Sale.refundedAt = reversal timestamp
Sale.refundReason = required reason

for each SaleItem:
    new InventoryMovement.type = REFUND
    quantityDelta = +item.quantity
    referenceId = item.id
    Product.currentStockCache += item.quantity
```

Both operations are atomic.

Only a Sale with status `VALID` may be voided or refunded. This prevents double reversal.

The original Sale and SaleItems are never deleted.

## Inventory Movement

Fields:

```text
id
productId
type
quantityDelta
referenceId?
reason?
createdAt
```

Movement types:

```text
SALE
RESTOCK
ADJUSTMENT
VOID
REFUND
```

For Product-line transactions, `referenceId` identifies the corresponding line-item record.

## Price History

Price History preserves selling-price changes.

Procurement Suggested SRP remains advisory. Price History is created only when an active selling price actually changes.

## Operational Ledger vs. Persisted Tables

The tablet Data Viewer intentionally displays only:

```text
Sales
Procurements
Products
Suppliers
```

The following remain persisted but are not shown as normal operational Ledger sections:

```text
saleItems
inventoryMovements
priceHistory
```

They remain essential for integrity, audit, synchronization, and future Google Sheets analytics.

## Schema Version History

### Version 1
Products.

### Version 2
Inventory Movements.

### Version 3
Suppliers, Procurements, Price History.

### Version 4
Procurement status/void semantics.

### Version 5
Procurement status normalized to `VALID | VOID`.

### Version 6
Normalized Procurement header/items and added `procurementItems`.

### Version 7
Added first-class `categories`.

### Version 8
Added normalized Sales:

```text
sales
saleItems
```

No intentional clearing of prior records.

### Version 9
Expanded Sale state for audit-preserving reversals:

```text
VALID
VOID
REFUNDED
```

and added optional Void/Refund metadata fields at the TypeScript interface level.

The Version 9 `.stores(...)` declaration preserves the existing table/index structure while advancing the schema version.

## Migration Rule

Dexie migration/version logic runs when an installation crosses that version.

Therefore:

- do not rewrite historical migrations expecting them to rerun;
- add a new database version when stored records require another transformation;
- do not reset production IndexedDB to avoid migration work once real data exists;
- test schema upgrades against representative existing data;
- preserve original business records and stable IDs.

## Inventory Integrity Rule

```text
Opening Quantity
+ RESTOCK
- SALE
+ Procurement VOID reversal effects
+ Sale VOID reversal effects
+ REFUND
+/- ADJUSTMENT
= Expected Current Quantity
```

`currentStockCache` must remain reconcilable with Inventory Movement history.

## Business-Time Integrity

Original transaction timestamps must be preserved.

Synchronization timestamps must never replace the original Sale/Procurement business/audit timestamps.

## Deletion and Reversal Rules

Business transactions are not hard-deleted.

Current strategies:

```text
Procurement correction:
preserve header/items/RESTOCK movements
+ reversing VOID movements
+ status VOID

Sale entered in error:
preserve Sale/SaleItems/SALE movements
+ positive VOID movements
+ status VOID

Valid Sale later reversed:
preserve Sale/SaleItems/SALE movements
+ positive REFUND movements
+ status REFUNDED
```

Unused Suppliers may be deleted. Product master-data corrections preserve Product UUID.

## Data Work Still Pending

- business-day/opening-cash schema;
- daily-closing schema;
- cash reconciliation;
- inventory reconciliation/adjustments workflow;
- synchronization metadata and queue;
- cloud representation of Sale and Procurement reversals;
- conflict-resolution behavior;
- backup/recovery.
