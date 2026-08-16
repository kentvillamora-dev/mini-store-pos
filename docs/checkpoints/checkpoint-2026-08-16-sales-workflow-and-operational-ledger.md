# Mini Store POS — Sales Workflow and Operational Ledger Milestone

Checkpoint date: 2026-08-16  
Repository: `kentvillamora-dev/mini-store-pos`  
Branch: `main`  
Development milestone: Sales transaction workflow, Sale reversal, and operational Ledger refinement  
Resume point: Begin design of business-day / EOD cash workflow, unless another priority is selected after grounding  
Last verified source commit: `2d0dbb5` — `Add sales workflow and operational ledgers`

## Instructions for the Next AI

1. Read `docs/AI_HANDOFF.md` and all permanent docs.
2. Inspect the live source before modifying anything.
3. Treat commit `2d0dbb5` as the verified Sales milestone.
4. Do not reconstruct `App.tsx`, `saleService.ts`, `database.ts`, or `DataViewer.tsx` from this checkpoint.
5. Preserve existing IndexedDB business data. Current schema is Version 9.
6. Sale Void and Refund are audit-preserving reversals, not deletion.
7. The operational Ledger intentionally hides Sale Items, Inventory Movements, and Price History; do not re-add them merely because they exist in IndexedDB.

## Verified Working State

Confirmed by user testing and build/deployment:

- POS Product cards add Products to Cart.
- Cart stock display decreases with Cart quantity without immediately changing persisted stock.
- Cart supports increase, decrease, and Remove controls.
- Stock-limit/OOS warning appears beside the affected Cart item.
- Cash and GCash checkout are available.
- Cash is the default Payment Method.
- Cash Received supports manual entry plus Exact, incremental denomination buttons, and Clear.
- Change/Remaining behavior works.
- Sale completion persists Sales data and permanently deducts stock.
- SaleItems and SALE Inventory Movements are created.
- Sale persistence is atomic.
- Sales appear in the operational Ledger.
- Sale Void works and restores stock through positive VOID movements.
- Sale Refund works and restores stock through positive REFUND movements.
- Reversed Sales preserve the original transaction and reason.
- Data Viewer supports per-section collapse/expand.
- Global Expand All/Collapse All controls are in the upper-right.
- Operational Ledger order is Sales, Procurements, Products, Suppliers.
- Sales is expanded by default; the other three are collapsed.
- Hidden normalized tables remain persisted.
- Production build passed before commit.
- GitHub commit `2d0dbb5` was pushed to `main`.
- GitHub Pages workflow run for the commit completed successfully for both `build` and `deploy`.

## Build State

Last local production build reported:

```text
vite v8.2.1
31 modules transformed
✓ built in 361ms

PWA v1.3.0
mode generateSW
precache 5 entries (339.94 KiB)
dist/sw.js generated
dist/workbox-2fbc6a65.js generated
```

No compiler/build error was reported at checkpoint.

## Current Schema Relevant to Sales

Current Dexie schema version: **9**

Version 8 added:

```text
sales
saleItems
```

Sale:

```text
id
totalAmount
paymentMethod: CASH | GCASH
cashReceived?
changeDue?
status: VALID | VOID | REFUNDED
voidedAt?
voidReason?
refundedAt?
refundReason?
createdAt
```

SaleItem:

```text
id
saleId
productId
quantity
unitPrice
lineTotal
```

Version 9 supports Sale reversal state/metadata.

## Current Sales Transaction Architecture

```text
Cart
  |
  v
Complete Sale
  |
  v
validate input + recheck persisted Product stock
  |
  v
ONE Dexie transaction
  |
  +--> Sale
  +--> SaleItems
  +--> SALE Inventory Movements
  +--> Product.currentStockCache deductions
```

Cash stores tender/change. GCash is a payment marker only and does not invoke a gateway.

## Sale Reversal Architecture

Only `VALID` Sales may be reversed.

```text
Void:
VALID -> VOID
required void reason
positive VOID movement per SaleItem
restore Product stock

Refund:
VALID -> REFUNDED
required refund reason
positive REFUND movement per SaleItem
restore Product stock
```

Both are atomic and preserve original Sale/SaleItems/SALE movements.

## Important Decisions Made

- Cash is the default checkout method.
- GCash is supported for EOD reconciliation without payment-gateway integration.
- Split payment is not implemented.
- Cart stock reservation is visual/in-memory only until Sale completion.
- Cash-entry UX is optimized for a tablet.
- Void and Refund are separate concepts.
- Sales are not hard-deleted.
- Operational Data Viewer should show only tables with meaningful day-to-day review/action:
  1. Sales
  2. Procurements
  3. Products
  4. Suppliers
- Sale Items, Inventory Movements, and Price History remain persisted for audit/sync/analytics and are expected to become useful in Google Sheets/Pivot Tables.
- Ledger navigation uses collapse/expand to reduce tablet scrolling.

## Files Relevant to This Milestone

```text
src/App.tsx
src/db/database.ts
src/services/saleService.ts
src/features/dataViewer/DataViewer.tsx
src/services/procurementService.ts
src/services/productService.ts
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/BUSINESS_RULES.md
```

## Current Errors / Known Issues

No blocking compiler/runtime error is documented at this checkpoint.

Known unfinished areas are product roadmap items rather than current Sales defects.

## Documentation Integrity Review

At source commit `2d0dbb5`, permanent documentation still described Version 7 and Sales as pending.

This checkpoint milestone therefore requires the accompanying permanent-document updates to:

- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/BUSINESS_RULES.md`

`docs/AI_HANDOFF.md` does **not** require modification because the AI workflow/protocol itself did not change.

## Not Yet Implemented

- business-day opening cash workflow;
- daily closing / EOD record;
- EOD expected-cash reconciliation;
- periodic inventory reconciliation;
- sync queue / Google Apps Script synchronization;
- Google Sheets analytics/export implementation;
- cloud representation of Sale/Procurement reversals;
- authentication/authorization;
- backup/recovery.

## Exact Next Action

After the documentation files and this checkpoint are committed and pushed, ground against the repository again and design the **business-day / EOD cash workflow**, specifically how Opening Cash, Cash Sales, GCash Sales, Refunds/Voids, and Closing Cash should be represented without conflating revenue with reconciliation.

Do not add schema yet until the business rules and intended EOD workflow are agreed.

## Subsequent Roadmap

1. Define business-day opening/closing behavior.
2. Define expected-cash formula and how Cash vs GCash affects it.
3. Design the required persisted schema.
4. Implement business-day UI and atomic writes.
5. Design periodic inventory reconciliation.
6. Design Google Sheets synchronization and analytics representation.

## FINAL RESUME MARKER

```text
Build status:
PASS — local production build and GitHub Pages build/deploy verified.

Database/schema version:
Dexie Version 9.

Last verified feature:
Sales checkout + Cash/GCash + atomic Sale persistence + stock deduction +
Sale Void/Refund + operational collapsible Ledger.

Current unfinished work:
Business-day / EOD cash workflow is not yet designed/implemented.

Known blocking error:
None.

Relevant files:
src/App.tsx
src/db/database.ts
src/services/saleService.ts
src/features/dataViewer/DataViewer.tsx
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/BUSINESS_RULES.md

NEXT ACTION:
Design and agree on the business-day / EOD cash workflow before making
another persisted-schema change.
```
