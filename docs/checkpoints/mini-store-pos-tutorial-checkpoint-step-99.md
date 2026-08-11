# Mini-Store POS — Tutorial Continuity Checkpoint

**Checkpoint date:** 2026-08-11  
**Repository:** `kentvillamora-dev/mini-store-pos`  
**Resume point:** Immediately before Step 100 — complete `createProcurement()` with an atomic Dexie transaction.

## Instructions for the next assistant

This is an incremental beginner tutorial. The user has introductory VBA/GAS experience and learns best by building one small step at a time.

- Do not recreate/reset the project or IndexedDB.
- Preserve data through explicit Dexie schema versions.
- Prefer each coding checkpoint to compile cleanly. Do not intentionally leave unused-variable/type errors between steps.
- GitHub is authoritative for exact code; the Technical Build Specification is the architectural baseline; this file records tutorial state.
- The user prefers visible database ledgers while coding, similar to Google Sheets in their previous GAS POS.
- Verify live files if they differ from this checkpoint.

## Verified infrastructure

- Vite + React + TypeScript project works.
- Dexie.js / IndexedDB is installed and persistent.
- GitHub Pages deployment through GitHub Actions works.
- Installed PWA works offline and after tablet restart.
- Dexie Version 1 → 2 → 3 upgrades preserved the existing Sardines record.
- Version 3 successfully built and opened.
- Recent production builds use Vite 8.2.1 / PWA 1.3.0 and transform 19 modules.

Relevant structure:

```text
src/
├── App.tsx
├── db/database.ts
├── features/dataViewer/DataViewer.tsx
├── services/procurementService.ts
└── utils/pricing.ts
```

## Sample product

The development product has deterministic ID:

```text
sample-sardines
```

There is exactly one Sardines record. Duplicate seeding was previously caused by overlapping React development/StrictMode initialization. The final seed checks `db.products.get('sample-sardines')` before adding it. Do not reintroduce random IDs for this seed.

## Database Version 3

The user confirmed Version 3 was applied, built, opened, and Sardines survived the migration.

Current intended interfaces/tables:

```ts
Product {
  id: string
  sku?: string
  name: string
  categoryId?: string
  sellingPrice: number
  currentStockCache: number
  active: boolean
  createdAt: string
  updatedAt: string
}

InventoryMovement {
  id: string
  productId: string
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'VOID' | 'REFUND'
  quantityDelta: number
  referenceId?: string
  reason?: string
  createdAt: string
}

Supplier {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

Procurement {
  id: string
  productId: string
  supplierId?: string
  procurementDate: string
  quantity: number
  totalCost: number
  unitCost: number
  markupRate: number
  suggestedSellingPrice: number
  createdAt: string
}

PriceHistory {
  id: string
  productId: string
  previousPrice: number
  newPrice: number
  procurementId?: string
  reason?: string
  changedAt: string
}
```

Version 3 stores:

```ts
this.version(3).stores({
  products: 'id, name, categoryId, active',
  inventoryMovements: 'id, productId, type, referenceId, createdAt',
  suppliers: 'id, name, active',
  procurements: 'id, productId, supplierId, procurementDate, createdAt',
  priceHistory: 'id, productId, procurementId, changedAt',
})
```

## Approved architecture

Keep the inventory movement ledger authoritative:

```text
products
    |
    +-------------- inventoryMovements
    |                       ^
    |                       |
    +---- procurements -----+
    |         |
    |         +---- supplierId ---> suppliers
    |
    +-------------- priceHistory
```

- `inventoryMovements`: physical-stock history.
- `procurements`: purchasing economics/history.
- `suppliers`: lightweight wholesaler identity.
- `priceHistory`: actual retail-price changes.
- `currentStockCache`: fast display cache only; must reconcile to movements.
- Suggested SRP is advisory and must never automatically overwrite `products.sellingPrice`.

## Exact SRP rule

The user explicitly chose:

```text
SRP = ROUNDDOWN(unitCost * 1.25) + 1
```

TypeScript:

```ts
Math.floor(unitCost * 1.25) + 1
```

Do NOT replace with `Math.ceil()`.

Verified terminal output for costs `0.8, 1, 19, 20, 21.75`:

```text
2 2 24 26 28
```

`src/utils/pricing.ts`:

```ts
export function calculateSuggestedSellingPrice(unitCost: number): number {
  return Math.floor(unitCost * 1.25) + 1
}
```

## Data Viewer

A read-only UI viewer was added because the user wants to see the ledgers while building.

The user confirmed all four are visible:

```text
Products
Suppliers
Procurements
Inventory Movements
```

At last check:
- Products: Sardines row exists.
- Suppliers: empty.
- Procurements: empty.
- Inventory Movements: empty.

`DataViewer.tsx` reads `db.products`, `db.suppliers`, `db.procurements`, and `db.inventoryMovements` with `toArray()` and renders tables.

Price History is NOT yet shown.
Sales tables are NOT yet implemented.

## Current procurement service

`src/services/procurementService.ts` currently has:

```ts
import { db } from '../db/database'
import { calculateSuggestedSellingPrice } from '../utils/pricing'

export interface ProcurementInput {
  productId: string
  supplierId?: string
  procurementDate: string
  quantity: number
  totalCost: number
}

export function calculateProcurementValues(input: ProcurementInput) {
  const unitCost = input.totalCost / input.quantity
  const suggestedSellingPrice = calculateSuggestedSellingPrice(unitCost)

  return {
    unitCost,
    suggestedSellingPrice,
  }
}

export function validateProcurementInput(input: ProcurementInput) {
  if (!input.productId) {
    throw new Error('Product is required.')
  }

  if (!input.procurementDate) {
    throw new Error('Procurement date is required.')
  }

  if (input.quantity <= 0) {
    throw new Error('Quantity must be greater than zero.')
  }

  if (input.totalCost < 0) {
    throw new Error('Total cost cannot be negative.')
  }
}

export async function createProcurement(input: ProcurementInput) {
  validateProcurementInput(input)

  const product = await db.products.get(input.productId)

  if (!product) {
    throw new Error('Product not found.')
  }

  const { unitCost, suggestedSellingPrice } =
    calculateProcurementValues(input)

  const procurementId = crypto.randomUUID()
  const movementId = crypto.randomUUID()
  const createdAt = new Date().toISOString()
}
```

This is the exact confirmed resume point.

## Current TypeScript diagnostics

Because `createProcurement()` is unfinished, VS Code currently reports:

```text
TS6198: All destructured elements are unused.
TS6133: 'procurementId' is declared but its value is never read.
TS6133: 'movementId' is declared but its value is never read.
TS6133: 'createdAt' is declared but its value is never read.
```

These are expected from the incomplete function. The user did not mistype it. Do not delete the variables merely to silence the diagnostics.

## Step 100 — proposed, NOT applied

The next step was going to add this after `createdAt` and before the final `}`:

```ts
await db.transaction(
  'rw',
  db.procurements,
  db.inventoryMovements,
  db.products,
  async () => {
    await db.procurements.add({
      id: procurementId,
      productId: input.productId,
      supplierId: input.supplierId,
      procurementDate: input.procurementDate,
      quantity: input.quantity,
      totalCost: input.totalCost,
      unitCost,
      markupRate: 0.25,
      suggestedSellingPrice,
      createdAt,
    })

    await db.inventoryMovements.add({
      id: movementId,
      productId: input.productId,
      type: 'RESTOCK',
      quantityDelta: input.quantity,
      referenceId: procurementId,
      reason: 'Procurement',
      createdAt,
    })

    await db.products.update(input.productId, {
      currentStockCache:
        product.currentStockCache + input.quantity,
      updatedAt: createdAt,
    })
  },
)
```

**This transaction has NOT been confirmed applied.**

Its purpose is to atomically commit:

```text
procurement record
+ linked RESTOCK inventory movement
+ product stock-cache update
```

It must NOT automatically change selling price.

After applying it, immediately run:

```bash
npm run build
```

and resolve any errors before proceeding.

## Not yet implemented

- Supplier creation UI/service.
- Any deliberate supplier records.
- Any proper procurement/restock records.
- Price History viewer.
- Owner selling-price update workflow.
- Price-history writes.
- Sales / saleItems tables and checkout kernel.
- Stock reconciliation routine.

## Recommended sequence after Step 100 compiles

1. Add Price History to Data Viewer.
2. Build minimal supplier creation.
3. Build minimal restocking form.
4. Use the UI to create the first proper procurement.
5. Inspect Procurement ledger.
6. Inspect linked RESTOCK movement.
7. Verify Product stock cache changed.
8. Verify movement-derived stock reconciles with cache.
9. Add owner-controlled selling-price update and `priceHistory`.

## Legacy GAS POS reference

The user previously supplied `Project GAS - Mini Store POS (1).xlsx`. It is a business-process reference, not an architecture to copy literally. Useful concepts carried forward include visible ledgers, procurement quantity/cost, unit-cost calculation, suggested pricing, historical pricing, and inventory derived from business events.

## Final resume marker

```text
Development server: STOPPED

Dexie schema: Version 3, migration verified
Sample Sardines: exactly one, persistent
Data Viewer: Products / Suppliers / Procurements / Inventory Movements visible
Pricing utility: implemented and verified
Procurement input/calculation/validation/product lookup: implemented
createProcurement transaction: NOT YET IMPLEMENTED
Current unused-variable diagnostics: expected because Step 100 is incomplete

NEXT ACTION:
Complete Step 100 transaction and immediately run `npm run build`.
```

## Continuity strategy

```text
GitHub repository
= exact code/version history

Technical Build Specification
= architecture/non-negotiable rules

This checkpoint
= tutorial progress, decisions, diagnostics, resume point

Legacy GAS workbook
= prior business-process reference
```
