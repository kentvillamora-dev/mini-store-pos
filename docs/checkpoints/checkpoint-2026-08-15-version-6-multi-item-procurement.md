# Development Checkpoint --- 2026-08-15 --- Version 6 Multi-Item Procurement

## Checkpoint Purpose

This checkpoint records the Mini-Store POS state after the approved
one-time test-data reset and implementation of the Version 6 multi-item
Procurement architecture.

Repository: `kentvillamora-dev/mini-store-pos`

Source commit: `8e7612457e9b5cd7d98d13fcda70a6aa81468aa2` ---
`Implement multi-item procurement workflow`

## Completed Work

### One-time database reset

Before Version 6, IndexedDB test data was intentionally cleared in both
development and production. This was approved as a one-time exception
because all records were test data and the Procurement model was being
fundamentally redesigned.

A temporary in-app Export Test Data / Delete Test Database utility was
used because the development environment is a Samsung tablet in DeX mode
without normal desktop Chrome DevTools access.

The Ledgers were confirmed clean after the reset. The temporary
destructive controls were then removed and the build passed.

The legacy `sample-sardines` automatic bootstrap was also removed so an
empty database remains empty.

**Permanent rule:** once real transactions exist, production data must
not be reset to handle schema changes. Future changes must use explicit
Dexie versions/migrations and preserve business/audit data.

## Version 6 Database Architecture

Dexie database: `miniStorePOS`

Schema history remains Versions 1--6.

Version 6 replaces the old one-product-per-Procurement structure with:

``` text
PROCUREMENT
Supplier + Date + Status
        |
        | 1 : many
        v
PROCUREMENT ITEMS
Product + Quantity + Cost + Pricing Snapshot
```

### `Procurement`

Header fields:

-   `id`
-   `supplierId?`
-   `procurementDate`
-   `status: 'VALID' | 'VOID'`
-   `voidedAt?`
-   `voidReason?`
-   `createdAt`

### `ProcurementItem`

New item table fields:

-   `id`
-   `procurementId`
-   `productId`
-   `quantity`
-   `totalCost`
-   `unitCost`
-   `markupRate`
-   `previousSellingPrice?`
-   `suggestedSellingPrice`
-   `appliedSellingPrice?`

Version 6 stores are:

``` text
products
inventoryMovements
suppliers
procurements
procurementItems
priceHistory
```

No Version 5 Procurement-row transformation was added because both known
databases were deliberately cleared before Version 6.

## Procurement Service

`src/services/procurementService.ts` now accepts one Supplier, one
Procurement Date, and an array of Product items.

Validation covers required Supplier/Date, at least one item, valid
Products, positive Quantity/Cost, positive applied selling prices, and
duplicate Products within the same Procurement.

`createProcurement()` uses one Dexie transaction across:

-   `procurements`
-   `procurementItems`
-   `inventoryMovements`
-   `products`
-   `priceHistory`

A successful save creates one Procurement header, one ProcurementItem
and RESTOCK movement per Product, updates stock caches, applies approved
price changes, and creates Price History only when the final price
differs from the previous price.

RESTOCK `referenceId` now points to the relevant ProcurementItem.
Internal IDs remain hidden from end users.

## Pricing Rules

Suggested SRP remains guidance, not an automatic selling-price decision.

For an existing Product:

``` text
Previous Retail = existing Product.sellingPrice
Recommended Retail = calculated Suggested SRP
Final Retail = defaults to Previous Retail
```

If the user makes no edit, the selling price stays unchanged and no
Price History entry is created.

If the user changes the Final Price, the Product price is updated and
Price History records the change.

New Products currently start with `sellingPrice: 0`. Procurement Summary
therefore shows `Not set` and requires an explicit selling price greater
than zero before saving. The app must not silently adopt Suggested SRP.

## Procurement UI Workflow

`src/App.tsx` now uses a staged workflow.

### Landing

``` text
New Procurement
Add Product
Add Supplier
Set Price
```

### Stage 1 --- Details

User selects:

-   Procurement Date
-   Supplier

The date defaults to the device's current local date.

### Stage 2 --- Items

For each Product:

-   Product
-   Quantity
-   Total Cost

Multiple Products can be added. Duplicate Product lines are blocked. The
draft shows accumulated items, total quantity, and total Procurement
cost.

No business transaction is committed while the draft is being assembled.

### Stage 3 --- Summary

The Summary shows:

-   Product
-   Quantity
-   Total Cost
-   Unit Cost
-   Previous Retail Price
-   Recommended Retail Price / Suggested SRP
-   editable Final Price

Only `Save Procurement` commits the complete event.

``` text
Build draft
→ Review
→ Save once
→ Atomic commit
```

## Duplicate Procurement Warning

Version 6 warning heuristic uses:

-   same Supplier
-   same Procurement Date
-   same number of item lines
-   same total Procurement cost

It remains a warning rather than a hard uniqueness rule because
legitimate repeated purchases can occur.

## Latest Valid Procurement Lookup

`getLatestValidProcurementForProduct(productId)` now resolves through
`procurementItems` and returns the VALID Procurement header plus the
matching ProcurementItem.

Ordering remains latest `procurementDate`, then latest `createdAt`.

The standalone Set Price workflow therefore continues to display
Product-specific latest Unit Cost and Suggested SRP.

## Void Behavior

`voidProcurement()` now operates on the complete multi-item Procurement.

Before changing anything, every item is checked to ensure reversal will
not make Product stock negative. If any item cannot be safely reversed,
the entire void is rejected.

A successful void transaction:

-   creates one VOID Inventory Movement per ProcurementItem;
-   reverses each Product's stock quantity;
-   marks the Procurement header `VOID`;
-   stores `voidedAt` and `voidReason`.

Original RESTOCK movements remain for auditability.

Selling prices and Price History are intentionally not automatically
reversed when a Procurement is voided.

## Ledger Changes

`src/features/dataViewer/DataViewer.tsx` now displays the Version 6
header/items structure.

Procurement Product-level columns include:

-   Product
-   Quantity
-   Total Cost
-   Unit Cost
-   Previous Price
-   Suggested SRP
-   Applied Price

Shared header information includes Date, Supplier, Status, Void action,
and Void Reason.

Price History and Inventory Movements continue to show actual Product
names, newest entries first, human-readable timestamps, and no
meaningless UUID/reference columns.

## Verification Completed

The final Version 6 implementation passed:

``` bash
npm run build
```

The development multi-item Procurement functional test passed,
including:

-   Supplier and Product creation;
-   one Procurement with at least two Products;
-   Unit Cost and Suggested SRP calculations;
-   explicit pricing for new Products;
-   final price application;
-   one Procurement header with multiple item rows;
-   correct stock increases;
-   RESTOCK movements per Product;
-   Price History creation where appropriate;
-   duplicate Product-line prevention.

The user confirmed: `All test passed`.

### Multi-item void verification boundary

A dedicated multi-item void regression test was recommended, but this
checkpoint does not contain explicit confirmation that the full void
checklist was completed before the source push. Future sessions must not
infer that end-to-end void behavior is verified solely from this
checkpoint.

## Git State

Version 6 source was pushed as:

``` text
8e7612457e9b5cd7d98d13fcda70a6aa81468aa2
Implement multi-item procurement workflow
```

A prior temporary reset utility commit exists:

``` text
315673cda4a5a70a4e4e3df3b4c21a95c939664e
Add temporary database reset utility
```

The current source removes the temporary destructive reset controls.

## Production Verification Boundary

Production Version 5 test data was cleared before Version 6
implementation.

At this checkpoint, Version 6 source is pushed, but the following are
not yet explicitly confirmed:

-   GitHub Pages deployment completed successfully;
-   production PWA applied Version 6;
-   production IndexedDB opened correctly under Version 6;
-   a controlled Version 6 production smoke test passed.

Do not mark these complete without later verification.

## Relevant Files

-   `src/App.tsx`
-   `src/db/database.ts`
-   `src/features/dataViewer/DataViewer.tsx`
-   `src/services/procurementService.ts`

Also relevant:

-   `src/services/productService.ts`
-   `src/services/priceService.ts`
-   `src/utils/pricing.ts`

## Current Development State

The codebase now has a build-passing Version 6 multi-item Procurement
architecture and staged Procurement workflow.

The previous one-product-per-Procurement model is retired.

Repository code is authoritative. Do not reconstruct old Procurement
logic from conversation history or obsolete checkpoint snippets.

## Exact Next Actions

1.  Confirm GitHub Pages deployment for commit
    `8e7612457e9b5cd7d98d13fcda70a6aa81468aa2`.
2.  Apply/update the production PWA to Version 6.
3.  Confirm production opens with the clean Version 6 database and no
    temporary reset controls.
4.  Perform a minimal controlled production smoke test before real
    transactions.
5.  If not already explicitly completed, run the development multi-item
    void regression:
    -   void a VALID multi-item Procurement with a reason;
    -   confirm the header becomes VOID;
    -   confirm every Product stock balance reverses together;
    -   confirm one VOID movement per item;
    -   confirm original RESTOCK movements remain;
    -   confirm selling prices and Price History remain unchanged;
    -   confirm a second void is unavailable.
6.  Update permanent architecture/business-rule documentation as needed
    for the Version 6 Procurement header/items model and pricing-summary
    workflow.
7.  Only after Version 6 is stable should development proceed toward the
    POS sales/cash workflow.
