# Mini-Store POS Tutorial Continuity Handoff

**Purpose:** Give this file to a new ChatGPT/LLM conversation so the tutorial can continue from the exact known state without relying on prior chat history.

**Project:** Offline-First Mini-Store POS  
**Repository:** `kentvillamora-dev/mini-store-pos`  
**Development environment:** GitHub Codespaces in browser  
**Production target:** Installed PWA on HONOR Pad X8a  
**Hosting:** GitHub Pages via GitHub Actions  
**Frontend:** Vite + React + TypeScript  
**Local database:** IndexedDB via Dexie.js  
**Date of handoff:** 2026-08-10

---

## 1. Instructions for the next assistant

Treat this document as a **tutorial checkpoint**, not merely background information.

1. Continue incrementally, one small step at a time.
2. Do not assume a step was completed unless this document says it was confirmed.
3. Do not reset IndexedDB or recreate the project.
4. Preserve existing user data when changing Dexie schemas; use versioned migrations.
5. Before changing code, distinguish between:
   - code confirmed to be in the repository/current working tree;
   - code proposed but **not yet confirmed applied**.
6. The user is a beginner programmer with introductory VBA/GAS experience and learns best by actually building the project.
7. Give one concrete action, wait for the result, then continue.
8. Explain why important architectural decisions are being made, but avoid unnecessary theory.
9. The technical build specification remains the architectural baseline, but the procurement/pricing requirements documented below are an approved extension to it.
10. Before continuing the tutorial, ask the user to run `git status` and, if necessary, inspect the relevant file so the checkpoint can be reconciled with the live Codespace.

---

## 2. What has already been completed and verified

### PWA / GitHub Pages

The project was created successfully with Vite/React/TypeScript.

The PWA plugin was installed and production builds succeed.

A GitHub Pages deployment workflow exists at:

```text
.github/workflows/deploy-pages.yml
```

The repository was initially unable to deploy because GitHub Pages was not enabled for the repository. After the repository/Pages configuration was corrected, both the GitHub Actions **build** and **deploy** jobs became green.

The application was installed as a PWA.

Verified acceptance behavior:

- The deployed page works offline.
- The product button continued to update the temporary cart while offline during the earlier PWA test.
- The installed PWA works after a tablet restart.
- GitHub Pages deployment is functioning.

### Known successful production build

A successful build after Dexie integration produced output similar to:

```text
vite v8.2.1 building client environment for production...
✓ 19 modules transformed.
...
✓ built in 245ms

PWA v1.3.0
mode      generateSW
precache  5 entries (282.02 KiB)
files generated
  dist/sw.js
  dist/workbox-2fbc6a65.js
```

### Dexie installation

Dexie was installed successfully. The npm operation reported:

```text
added 2 packages, and audited 428 packages in 5s
133 packages are looking for funding
found 0 vulnerabilities
```

### Current `src` structure observed during tutorial

```text
App.css
App.tsx
assets
db
index.css
main.tsx
```

`src/db/database.ts` was created.

---

## 3. Important database lesson already encountered

A sample product named **Sardines** was initially seeded using an asynchronous `useEffect()` check with a random UUID.

In React development mode, StrictMode caused the initialization effect to execute in a way that allowed two overlapping runs to create duplicate Sardines records.

The problem was corrected by:

1. Temporarily deleting all Sardines records.
2. Giving the sample product a deterministic ID:
   `sample-sardines`
3. Using that ID to make the seed idempotent.
4. Removing the temporary delete operation.
5. Changing the final seed logic so Sardines is created **only if the deterministic ID does not already exist**.

The result was tested across a Vite server restart and remained exactly **one Sardines**.

Do not reintroduce random UUID generation for this development seed.

---

## 4. Last confirmed `App.tsx` logic

The following is the last code state reconstructable from the tutorial and confirmed through testing.

```tsx
import { useEffect, useState } from 'react'
import { db, type Product } from './db/database'

function App() {
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    async function loadProducts() {
      const existingSardines = await db.products.get('sample-sardines')

      if (!existingSardines) {
        const now = new Date().toISOString()

        await db.products.add({
          id: 'sample-sardines',
          name: 'Sardines',
          sellingPrice: 25,
          currentStockCache: 10,
          active: true,
          createdAt: now,
          updatedAt: now,
        })
      }

      const savedProducts = await db.products.toArray()
      setProducts(savedProducts)
    }

    loadProducts()
  }, [])

  return (
    <main className="pos-layout">
      <section className="products-panel">
        <h1>Products</h1>

        {products.map((product) => (
          <button
            className="product-button"
            key={product.id}
          >
            {product.name}
            <span>₱{product.sellingPrice.toFixed(2)}</span>
          </button>
        ))}
      </section>

      <section className="cart-panel">
        <h1>Cart</h1>
        <p>Cart behavior will be added later.</p>
      </section>
    </main>
  )
}

export default App
```

**Important:** The cart message is intentional at this stage. Earlier temporary cart behavior was replaced while the tutorial moved into the local database milestone.

---

## 5. Last CONFIRMED `database.ts` schema

Database Versions 1 and 2 were implemented and tested.

The Version 2 migration was verified by launching the app after the schema change and confirming that the existing Sardines product survived.

The last **confirmed** database file is:

```ts
import Dexie, { type Table } from 'dexie'

export interface Product {
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

export interface InventoryMovement {
  id: string
  productId: string
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'VOID' | 'REFUND'
  quantityDelta: number
  referenceId?: string
  reason?: string
  createdAt: string
}

export class MiniStoreDatabase extends Dexie {
  products!: Table<Product, string>
  inventoryMovements!: Table<InventoryMovement, string>

  constructor() {
    super('miniStorePOS')

    this.version(1).stores({
      products: 'id, name, categoryId, active',
    })

    this.version(2).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements: 'id, productId, type, referenceId, createdAt',
    })
  }
}

export const db = new MiniStoreDatabase()
```

### Version 2 migration verification

After adding `inventoryMovements` as Version 2:

- `npm run build` succeeded.
- `npm run dev` succeeded.
- The existing Sardines record remained present.

Therefore, Version 1 → Version 2 migration was successful without deleting existing IndexedDB data.

---

## 6. CRITICAL CHECKPOINT: Version 3 was proposed but NOT confirmed

The tutorial reached **Step 71**, where a Version 3 schema was proposed.

The user interrupted **before replying `Done`** because they wanted to discuss the real restocking/procurement requirements first.

Therefore:

> **Do not assume Version 3 has been pasted into `database.ts`.**

At the start of a new conversation, verify the live file before proceeding.

The proposed Version 3 code was:

```ts
import Dexie, { type Table } from 'dexie'

export interface Product {
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

export interface InventoryMovement {
  id: string
  productId: string
  type: 'SALE' | 'RESTOCK' | 'ADJUSTMENT' | 'VOID' | 'REFUND'
  quantityDelta: number
  referenceId?: string
  reason?: string
  createdAt: string
}

export interface Supplier {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Procurement {
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

export interface PriceHistory {
  id: string
  productId: string
  previousPrice: number
  newPrice: number
  procurementId?: string
  reason?: string
  changedAt: string
}

export class MiniStoreDatabase extends Dexie {
  products!: Table<Product, string>
  inventoryMovements!: Table<InventoryMovement, string>
  suppliers!: Table<Supplier, string>
  procurements!: Table<Procurement, string>
  priceHistory!: Table<PriceHistory, string>

  constructor() {
    super('miniStorePOS')

    this.version(1).stores({
      products: 'id, name, categoryId, active',
    })

    this.version(2).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements: 'id, productId, type, referenceId, createdAt',
    })

    this.version(3).stores({
      products: 'id, name, categoryId, active',
      inventoryMovements: 'id, productId, type, referenceId, createdAt',
      suppliers: 'id, name, active',
      procurements: 'id, productId, supplierId, procurementDate, createdAt',
      priceHistory: 'id, productId, procurementId, changedAt',
    })
  }
}

export const db = new MiniStoreDatabase()
```

This code is a **proposal**, not a confirmed checkpoint.

---

## 7. Newly approved business requirements

The original Technical Build Specification provides:

- create/edit product;
- selling price;
- current stock display;
- stock-in/restock;
- manual adjustment with reason;
- authoritative inventory movement ledger.

However, it does **not** sufficiently model procurement analytics or price history.

The user has approved extending the design.

### Inventory movement ledger stays

`inventoryMovements` must remain the authoritative physical-stock ledger.

It answers:

> What happened to stock?

Examples:

```text
RESTOCK       +24
SALE           -2
ADJUSTMENT     -1
REFUND         +1
```

Derived stock remains conceptually:

```text
opening/imported balance
+ restocks
+ adjustments
- sales
+ reversals/refunds
```

`currentStockCache` may exist for fast display, but it is derivative/cache data and must be reconcilable from movements.

### Procurement needs its own records

A restock is not merely a stock quantity change.

The store owner wants to capture:

- procurement date;
- supplier/wholesaler;
- quantity procured;
- procurement cost;
- calculated unit cost;
- suggested selling price;
- historical procurement prices.

This is needed so the system can eventually answer questions such as:

- Which wholesaler offers the best price for a product?
- How has procurement cost changed over time?
- What did the latest batch cost?
- How much should the store charge to maintain its target markup?

The approved conceptual separation is:

```text
PROCUREMENT
"What did we buy, from whom, when, and for how much?"
        |
        | procurement ID
        v
INVENTORY MOVEMENT
"What happened to physical stock?"
        |
        v
CURRENT INVENTORY
```

### Suppliers

A lightweight supplier table is approved.

Conceptually:

```text
suppliers
- id
- name
- active
- createdAt
- updatedAt
```

Do not turn this into supplier CRM/accounts payable/purchase-order software unless requirements change.

### Procurement records

Conceptually:

```text
procurements
- id
- productId
- supplierId
- procurementDate
- quantity
- totalCost
- unitCost
- markupRate
- suggestedSellingPrice
- createdAt
```

A procurement/restock operation should eventually create a linked `RESTOCK` inventory movement whose `referenceId` points to the procurement.

### Price history

The owner must be able to change product selling prices.

`products.sellingPrice` remains the fast/current price used by checkout.

A separate price-history mechanism is approved so historical price changes are not lost.

Conceptually:

```text
priceHistory
- id
- productId
- previousPrice
- newPrice
- procurementId (optional)
- reason (optional)
- changedAt
```

Past sale prices remain protected independently by the future `saleItems.unitPriceSnapshot`.

---

## 8. Pricing rule discussion

The user's old GAS/Sheets POS had a suggested-price formula equivalent to:

```excel
=ROUNDDOWN(UnitCost*125%,0)+1
```

Example:

```text
Unit cost = ₱21.75
21.75 × 1.25 = ₱27.1875
ROUNDDOWN = ₱27
+ 1 = ₱28
```

The tutorial discussion concluded that if the business goal is to preserve **at least a 25% markup**, simply flooring ₱27.1875 to ₱27 would fall below the target.

The preferred direction is therefore:

> Suggested SRP = unit cost × 1.25, rounded upward to a whole peso so the target markup is not undercut.

However, this should be treated as a **guidepost**, not a forced selling price. The owner can choose the actual selling price.

Before implementing the formula, the next assistant should explicitly confirm the exact rounding rule with the user if there is any ambiguity between:
- always ceiling to the next peso; or
- reproducing the exact legacy spreadsheet formula.

---

## 9. Previous GAS/Sheets POS reference

The user supplied an earlier workbook:

```text
Project GAS - Mini Store POS (1).xlsx
```

It represents a rudimentary previous implementation and is useful as a **business-requirements reference**, not as the architecture to copy literally.

Important concepts observed/discussed from the old implementation include:

- Restocking/procurement history
- Procurement quantity and cost
- Unit-cost calculation
- Current/previous retail pricing
- Suggested price based on markup
- Pricing delta
- Profit-margin information
- Inventory derived from stock coming in versus stock sold

The new architecture should preserve the useful business concepts while improving integrity through explicit ledgers and linked records.

---

## 10. Architecture direction now approved

The intended conceptual model is:

```text
products
    |
    +---------------- sales / saleItems
    |
    +---------------- inventoryMovements
    |                       ^
    |                       |
    +---- procurements -----+
    |         |
    |         +---- supplierId ----> suppliers
    |
    +---------------- priceHistory
```

Responsibilities:

### `products`
Current product master data and current selling price.

### `inventoryMovements`
Authoritative physical stock history.

### `procurements`
Historical purchasing/restocking economics.

### `suppliers`
Wholesaler identity for procurement comparison.

### `priceHistory`
Historical changes to retail selling price.

### `saleItems` (future)
Snapshots product name and selling price at the moment of sale so later product/price changes do not rewrite historical sales.

---

## 11. Technical specification principles that remain in force

The project is an offline-first POS for a small family-operated mini-store.

Core architectural rules:

- Selling must remain local/offline.
- Internet must never be required to complete a sale.
- IndexedDB on the POS tablet is the operational source of truth for V1.
- Google Sheets is for replication/reporting/backup visibility, not the checkout transaction database.
- Financially meaningful history must not be silently overwritten.
- Inventory movements are authoritative.
- Cached current stock must be reconcilable from movements.
- GitHub Pages delivers application updates but must not replace/delete IndexedDB business data.
- Schema changes must use explicit Dexie versions/migrations.
- Never reset production IndexedDB as a convenient migration fix.
- Avoid unnecessary enterprise/ERP complexity.

---

## 12. Original implementation milestones

The Technical Build Specification uses these milestones:

```text
M1 – Shell
M2 – Local database
M3 – Checkout kernel
M4 – Inventory
M5 – Cash/day
M6 – Backup
M7 – Sync
M8 – Remote update
M9 – Hardening
```

### Current tutorial position

- M1: substantially completed and verified.
- M2: underway; products + Dexie persistence are working.
- `inventoryMovements` Version 2 schema exists and migration was tested.
- Procurement/supplier/price-history requirements were discovered before adding the first sample restock.
- M3 checkout kernel has **not** been rebuilt yet.
- M4 business design has been refined early because it affects the database schema.

---

## 13. Do NOT perform the old Step 71 sample restock

An earlier step was about to add this simplified development record:

```ts
const existingRestock = await db.inventoryMovements.get('sample-restock-sardines')

if (!existingRestock) {
  await db.inventoryMovements.add({
    id: 'sample-restock-sardines',
    productId: 'sample-sardines',
    type: 'RESTOCK',
    quantityDelta: 10,
    reason: 'Initial stock',
    createdAt: new Date().toISOString(),
  })
}
```

**This was NOT applied.**

Do not add it now.

The user stopped the tutorial because a restock needs procurement details and supplier/pricing history. The schema/design should be settled first.

---

## 14. Product/SKU decision

`sku` remains optional.

The store is small enough that the owner does not need to invent SKU codes for every item.

Keep:

```ts
sku?: string
```

The internal `id` remains required and is the actual database identity.

`categoryId` is still useful for grouping products in the POS UI.

---

## 15. Recommended first action in a new chat

Do not immediately paste more code.

First reconcile this handoff with the live Codespace.

Ask the user to run:

```bash
git status
```

Then ask them to show:

```bash
cat src/db/database.ts
```

or open/copy that file.

Reason: the Version 3 schema was proposed immediately before this continuity document was requested, but the user never confirmed whether they had already pasted it.

Once the live state is confirmed:

1. If `database.ts` is still Version 2, refine/finalize the Version 3 procurement design before applying it.
2. If Version 3 is already present, review it against the approved procurement/pricing requirements before building/running it.
3. Run `npm run build`.
4. Only then launch the app and test the migration while confirming the existing Sardines record survives.
5. Continue incrementally.

---

## 16. Continuity / backup strategy going forward

This markdown file should be treated as a **checkpoint**, not the only backup.

Recommended approach:

1. Keep the actual source code committed to GitHub. GitHub is the authoritative backup for code.
2. Keep the Technical Build Specification as the architectural baseline.
3. Keep this handoff markdown in the repository, ideally under something like:
   `docs/TUTORIAL_CHECKPOINT.md`.
4. At meaningful milestones, update the checkpoint with:
   - latest Git commit hash;
   - current Dexie schema version;
   - files changed;
   - tests passed;
   - current tutorial step;
   - next intended step;
   - unresolved decisions.
5. Before ending a long chat, commit/push the working code and update the checkpoint.
6. In a new chat, provide:
   - this checkpoint;
   - the Technical Build Specification;
   - the previous GAS workbook only when procurement/business-rule comparison is needed.

This division of responsibility is safest:

```text
GitHub repository
    = exact source code / version history

Technical Build Specification
    = architecture and non-negotiable system rules

Tutorial checkpoint
    = learning progress, decisions, test results, and exact resume point

Old GAS workbook
    = legacy business-process reference
```

---

## 17. Resume marker

**Resume immediately before applying/finalizing Dexie Version 3.**

The last fully verified state is:

```text
Dexie Version 2
products table working
inventoryMovements table defined
one persistent sample Sardines product
no sample RESTOCK movement added
PWA works offline
PWA works after restart
GitHub Pages build/deploy working
```

The next design task is:

> Finalize the Version 3 schema for suppliers, procurements, and price history, including the precise SRP calculation rule, then migrate without losing the existing Sardines record.
