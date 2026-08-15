# Mini Store POS — Database Notes

## Purpose

This document defines the intended data model and protects the project from accidental changes to important data relationships.

The **actual application schema remains authoritative**. Whenever this document and the code disagree, inspect the current schema before editing either one.

## Current Local Database

Database name:

```text
miniStorePOS
```

Database library:

```text
Dexie over IndexedDB
```

Current development schema version:

```text
Version 5
```

## Current Tables

```text
products
inventoryMovements
suppliers
procurements
priceHistory
```

## Product

Current fields:

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

Indexed schema:

```text
id, name, categoryId, active
```

`currentStockCache` is a convenience/cache value. Inventory movements remain the audit trail that explains stock changes.

### Product Creation

Product creation is implemented in:

```text
src/services/productService.ts
```

`createProduct(name)`:

- trims the entered name;
- rejects a blank name;
- rejects trimmed/case-insensitive duplicates;
- generates a UUID;
- creates the Product with:
  - `sellingPrice = 0`;
  - `currentStockCache = 0`;
  - `active = true`;
  - `createdAt = now`;
  - `updatedAt = now`.

Creating a Product does not create an Inventory Movement.

No Dexie schema migration was required because the existing Product table already supports the required fields.

The current application still contains a hardcoded `sample-sardines` bootstrap record in `App.tsx`. This is legacy development scaffolding and is separate from the new Product-creation workflow.

## Supplier

Current fields:

```text
id
name
active
createdAt
updatedAt
```

Indexed schema:

```text
id, name, active
```

Supplier names are protected against trimmed/case-insensitive duplicates in the service layer.

Supplier deletion is allowed only when no Procurement references that Supplier ID.

## Procurement

Current fields:

```text
id
productId
supplierId?
procurementDate
quantity
totalCost
unitCost
markupRate
suggestedSellingPrice
status
voidedAt?
voidReason?
createdAt
```

Current status values:

```text
VALID
VOID
```

Indexed schema:

```text
id, productId, supplierId, procurementDate, status, createdAt
```

The persisted `supplierId` remains optional for compatibility with earlier/test records, but the current Procurement service requires a Supplier for all new Procurement entries.

### Procurement Creation

A valid Procurement atomically creates:

```text
Procurement.status = VALID
RESTOCK InventoryMovement (+quantity)
Product.currentStockCache += quantity
```

### Potential Duplicate Check

The local duplicate warning first uses indexed `procurementDate`, then checks:

```text
supplierId
productId
totalCost
```

This is a human-entry warning, not a uniqueness constraint.

### Procurement Void

Voiding does not delete the Procurement or original RESTOCK movement.

A successful void atomically:

```text
Procurement.status = VOID
Procurement.voidedAt = ISO timestamp
Procurement.voidReason = required reason

new InventoryMovement:
type = VOID
quantityDelta = -procurement.quantity
referenceId = procurement.id

Product.currentStockCache -= procurement.quantity
```

## Inventory Movement

Current fields:

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

Indexed schema:

```text
id, productId, type, referenceId, createdAt
```

## Price History

Current fields:

```text
id
productId
previousPrice
newPrice
procurementId?
reason?
changedAt
```

Indexed schema:

```text
id, productId, procurementId, changedAt
```

Price History writes from owner-approved selling-price changes are not yet implemented.

The intended future `Set Price` operation should update `Product.sellingPrice` and create the corresponding Price History record as one coherent business operation.

## Schema Version History

### Version 1

Initial `products` table.

### Version 2

Added `inventoryMovements`.

### Version 3

Added:

```text
suppliers
procurements
priceHistory
```

### Version 4

Added Procurement status/void semantics and indexed `status`.

Existing Procurement records were assigned:

```text
status = ACTIVE
```

### Version 5

Normalized Procurement status terminology:

```text
ACTIVE -> VALID
missing status -> VALID
VOID -> unchanged
```

Version 5 retained the same indexed stores as Version 4.

Development verification confirmed that Products, Suppliers, existing Procurements, and stock values were preserved.

## Migration Rule

Dexie `.upgrade(...)` logic runs when a database installation crosses that schema version.

Once a migration has run on a device, editing that old migration does not rerun it on that already-upgraded database.

Therefore:

- do not rewrite historical migrations as though they will rerun;
- add a new database version when already-persisted records need another transformation;
- do not reset IndexedDB simply to avoid writing a migration.

## Inventory Integrity Rule

```text
Opening Quantity
+ RESTOCK
- SALE
+/- ADJUSTMENT
+ VOID reversal effects
+/- REFUND effects where applicable
= Expected Current Quantity
```

A manually editable stock value must not become an unexplained alternative source of truth.

## Timestamps

Current Procurement distinguishes:

```text
procurementDate  = business date selected by the user
createdAt        = local record-creation timestamp
voidedAt         = timestamp when Procurement was invalidated
```

Future synchronization timestamps must not overwrite these original business/audit times.

## Duplicate Prevention

Current local human-entry duplicate guardrails:

```text
Supplier name:
trimmed + case-insensitive

Product name:
trimmed + case-insensitive

Potential Procurement duplicate:
same date + supplier + product + total cost
```

Synchronization must eventually be idempotent using stable local IDs.

## Deletion and Voids

Business transaction history should not be casually hard-deleted.

Current Procurement correction strategy:

```text
Preserve original Procurement
Preserve original RESTOCK movement
Create reversing VOID movement
Mark Procurement VOID
Record void timestamp and reason
```

Supplier records are different: unused Suppliers may be deleted, but Suppliers referenced by Procurement history must be preserved.

Product deletion behavior has not yet been designed and must not be invented.

## Schema Change Rule

Before changing the database schema:

1. inspect the current schema implementation;
2. identify all code that reads or writes affected data;
3. determine whether existing stored data needs migration;
4. define backward-compatibility behavior;
5. test with existing data;
6. document the decision.

An AI assistant must not casually rename or remove persisted fields simply because a different design looks cleaner.

## Current Data Work Still Pending

- owner-controlled selling-price application;
- Price History writes;
- cleanup/removal of hardcoded `sample-sardines` bootstrap;
- Sale transaction schema;
- business-day/daily-closing schema;
- cash reconciliation schema;
- inventory reconciliation schema;
- synchronization metadata/queue design;
- cloud representation of Procurement VOID events;
- conflict-resolution behavior;
- backup/recovery design.
