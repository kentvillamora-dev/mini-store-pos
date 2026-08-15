# Mini Store POS — Database Notes

## Purpose

This document defines the intended data model and protects the project from accidental changes to important data relationships.

The **actual application schema remains authoritative**. Whenever this document and the code disagree, inspect `src/db/database.ts` and the relevant service code before editing either one.

## Current Local Database

Database name:

```text
miniStorePOS
```

Database library:

```text
Dexie over IndexedDB
```

Current schema version:

```text
Version 7
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
```

## Product

Fields:

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

`id` is the stable Product identity.

Product name and Category are editable master-data attributes of the same Product UUID.

`currentStockCache` is a convenience/cache value. Inventory Movements remain the audit trail that explains stock changes.

New Products start with:

```text
sellingPrice = 0
currentStockCache = 0
active = true
```

Creating a Product does not create stock or an Inventory Movement.

The legacy `sample-sardines` bootstrap has been removed.

## Category

Version 7 introduces the `categories` table.

Fields:

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

Relationship:

```text
Category 1 ---- * Product
```

via:

```text
Product.categoryId
```

New Product creation requires a valid active Category.

Existing legacy Product records may still have no Category. Such Products can be corrected through the Product ledger and may temporarily appear as `Uncategorized` in UI presentation.

### Canonical default Categories

The application currently initializes these ten default Categories:

```text
Beverages
Snacks
Canned Goods
Instant Noodles
Cooking Essentials
Milk and Coffee
Personal Care
Household Cleaning
Cigarettes
Miscellaneous
```

Default Categories use stable canonical IDs.

### Category initialization integrity

`initializeDefaultCategories()` runs during app startup.

The initializer is designed to be:

- idempotent;
- safe under React development Strict Mode;
- able to repair duplicate default Category records.

For each canonical default Category, initialization:

1. locates matching records by normalized Category name;
2. ensures the canonical stable-ID record exists;
3. reactivates/normalizes the canonical record when necessary;
4. remaps Products from duplicate Category IDs to the canonical ID;
5. deletes duplicate Category rows.

This avoids orphaning Product `categoryId` references during cleanup.

## Product Master-Data Correction

`updateProduct(productId, name, categoryId)` updates the existing Product row rather than deleting and recreating it.

The update preserves:

```text
Product.id
```

and changes only master-data attributes such as:

```text
name
categoryId
updatedAt
```

This means Procurement, Inventory Movement, Price History, and future Sales relationships that reference the same Product UUID remain intact.

Historical Product-name snapshots are not required. Historical pricing/cost values remain transaction-specific where appropriate.

A Product UUID must not be repurposed to represent a fundamentally different item.

## Supplier

Fields:

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

Supplier names are protected against trimmed/case-insensitive duplicates.

A Supplier referenced by Procurement history cannot be deleted.

## Procurement

Version 6 Procurement is a **header record** for one supplier/date purchasing event.

Fields:

```text
id
supplierId?
procurementDate
status
voidedAt?
voidReason?
createdAt
```

Status values:

```text
VALID
VOID
```

Indexed schema:

```text
id, supplierId, procurementDate, status, createdAt
```

`supplierId` remains optional at the persisted interface level, while the current service requires a Supplier for new Procurement entries.

Product-specific quantity/cost/pricing fields do not belong on the Procurement header.

## ProcurementItem

Version 6 introduced `procurementItems`.

Fields:

```text
id
procurementId
productId
quantity
totalCost
unitCost
markupRate
previousSellingPrice?
suggestedSellingPrice
appliedSellingPrice?
```

Indexed schema:

```text
id, procurementId, productId
```

Relationship:

```text
Procurement 1 ---- * ProcurementItem
```

Each ProcurementItem preserves the Product-specific purchasing and pricing snapshot for that Procurement.

### Pricing snapshot meaning

`previousSellingPrice` records the Product's retail price before the Procurement price review.

`suggestedSellingPrice` records the SRP calculated from that item's Unit Cost.

`appliedSellingPrice` records the Final Price selected/retained during Procurement review.

Suggested SRP is advisory and must not silently overwrite the Product price.

## Procurement Creation

Input contains:

```text
supplierId
procurementDate
items[]
```

Each item contains:

```text
productId
quantity
totalCost
appliedSellingPrice?
```

A successful save is one Dexie transaction across:

```text
procurements
procurementItems
inventoryMovements
products
priceHistory
```

For each business event it creates:

```text
1 Procurement header
N ProcurementItems
N RESTOCK movements
N stock-cache increases
0..N Product price changes
0..N Price History records
```

Price History is written only when the Final Price differs from the previous Product price.

## Potential Duplicate Check

Version 6+ uses a warning heuristic:

```text
same procurementDate
same supplierId
same number of item lines
same total Procurement cost
```

This is a human-entry warning, not a uniqueness constraint.

## Procurement Void

Voiding preserves the original header, items, and RESTOCK movements.

Before mutation, every item is checked to ensure its stock reversal would not make the corresponding Product's `currentStockCache` negative.

A successful void transaction:

```text
Procurement.status = VOID
Procurement.voidedAt = ISO timestamp
Procurement.voidReason = required reason

for each ProcurementItem:
    new InventoryMovement.type = VOID
    quantityDelta = -item.quantity
    referenceId = item.id
    Product.currentStockCache -= item.quantity
```

If any item cannot be reversed safely, the whole void is rejected.

Selling-price changes and Price History are not automatically reversed.

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

Indexed schema:

```text
id, productId, type, referenceId, createdAt
```

For Version 6+ Procurement RESTOCK/VOID movements, `referenceId` identifies the relevant ProcurementItem because each movement corresponds to one Product line.

The POS currently reads `Product.currentStockCache` for fast available-stock display.

Future Sales must decrement stock through auditable `SALE` Inventory Movements rather than directly changing stock without a movement record.

## Price History

Fields:

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

Selling-price changes are implemented.

A Procurement Summary price change writes Price History with the Procurement header ID. The standalone Set Price workflow may also link to the latest relevant Procurement.

No Price History record is needed when the Final Price equals the existing Product price.

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

Added Procurement status/void semantics and indexed `status`. Existing records were assigned `ACTIVE`.

### Version 5

Normalized status terminology:

```text
ACTIVE -> VALID
missing status -> VALID
VOID -> unchanged
```

### Version 6

Introduced the normalized Procurement header/items model:

```text
procurements
procurementItems
```

Product-specific fields were removed from the Procurement header and moved to ProcurementItem.

No Version 5-to-6 row transformation was added because both known development and production databases were intentionally cleared before Version 6 while all records were test-only.

This was a **one-time development exception**. It must not be reused once real business data exists.

### Version 7

Introduced:

```text
categories
```

and continued the existing Product index:

```text
id, name, categoryId, active
```

The Version 7 schema did not require clearing prior dev ledger records.

After migration in dev:

- build passed;
- prior ledger records remained intact;
- default Categories initialized successfully;
- a React Strict Mode duplicate-initialization issue was identified and corrected;
- duplicate Category records were consolidated safely to canonical IDs.

## Migration Rule

Dexie `.upgrade(...)` logic runs when an installation crosses that schema version.

Once a migration has run on a device, editing that old migration does not rerun it on that already-upgraded database.

Therefore:

- do not rewrite historical migrations as though they will rerun;
- add a new database version when persisted records need another transformation;
- do not reset production IndexedDB to avoid writing a migration once real data exists;
- explicitly plan and test migrations that affect business records.

Version 7 currently introduces the `categories` store through `.stores(...)` and relies on startup Category initialization for the canonical default Category data.

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

Procurement distinguishes:

```text
procurementDate = business date selected by user
createdAt       = local header creation timestamp
voidedAt        = timestamp when Procurement was invalidated
```

Inventory Movement and Price History maintain their own audit timestamps.

Product and Category master records maintain:

```text
createdAt
updatedAt
```

Future synchronization timestamps must not overwrite original business/audit times.

## Duplicate Prevention

Current local guardrails:

```text
Supplier name:
trimmed + case-insensitive

Product name:
trimmed + case-insensitive

Category name:
trimmed + case-insensitive

Product inside one Procurement:
same Product cannot be added twice

Potential Procurement duplicate:
same date + supplier + item count + total Procurement cost
```

Default Category initialization additionally protects canonical defaults against duplicate persisted rows.

Synchronization must eventually be idempotent using stable local IDs.

## Deletion, Corrections, and Voids

Business transaction history should not be casually hard-deleted.

Current Procurement correction strategy:

```text
Preserve Procurement header
Preserve ProcurementItems
Preserve RESTOCK movements
Create reversing VOID movements
Mark header VOID
Record void timestamp and reason
```

Unused Suppliers may be deleted; referenced Suppliers must be preserved.

Product master-data correction edits the existing Product row while preserving its UUID.

Category duplicate cleanup remaps Product references before duplicate Category deletion.

Product deletion behavior has not yet been designed and must not be invented.

## Schema Change Rule

Before changing the database schema:

1. inspect current schema implementation;
2. identify all code that reads/writes affected data;
3. determine whether existing stored data needs migration;
4. define backward-compatibility behavior;
5. test with representative existing data;
6. document the decision.

An AI assistant must not casually rename/remove persisted fields simply because another design looks cleaner.

## Current Data Work Still Pending

- Sale transaction schema;
- Sale line-item schema;
- Sales ledger;
- cash-payment/change data requirements;
- business-day/daily-closing schema;
- cash reconciliation schema;
- inventory reconciliation schema;
- synchronization metadata/queue design;
- cloud representation of Procurement VOID events;
- conflict-resolution behavior;
- backup/recovery design.
