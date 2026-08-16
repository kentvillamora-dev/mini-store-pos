# Mini Store POS — Architecture

## Architecture Goal
The app is an offline-first PWA using IndexedDB/Dexie as the local transaction store. Google Sheets remains the intended reporting/analytics destination through future Google Apps Script synchronization.

## Frontend
The application retains three top-level pages: **POS, Procurement, and Ledgers**. Daily Opening & Closing is an application-shell control, not a fourth page.

### POS
- Products are grouped by Category; Uncategorized Products use the same Cart-adjusted displayed-stock calculation.
- Cart stock reduction is temporary UI state until Sale completion.
- Checkout supports CASH and GCASH; CASH is default.
- Sale completion is atomic and permanently reduces stock.
- When EOD is enabled, an OPEN Business Day is required before Sale completion.

### Procurement
Landing order remains:
1. New Procurement
2. Add Product
3. Add Supplier
4. Set Price

Procurement save remains atomic across its header/items, movements, stock cache, and applicable Price History.

### Ledgers
Operational order remains Sales, Procurements, Products, Suppliers. Supporting normalized/audit tables remain persisted without being exposed merely because they exist.

## Sales and Reversals
Sales are normalized into Sale + SaleItems. Sale save revalidates persisted Product state and stock before atomic persistence.

Statuses remain `VALID | VOID | REFUNDED`. Void and Refund preserve original records and restore stock through positive reversal movements.

With EOD enabled:
- a Sale is associated with the currently OPEN Business Day;
- Void is permitted only while the Sale's original Business Day remains OPEN;
- Refund is associated with the currently OPEN Business Day so its financial effect belongs to the day it is processed.

## Business Day / EOD Architecture
Dexie Version 10 adds the optional Business Day workflow and persisted application settings.

EOD is **disabled by default** to reduce operational friction.

When disabled, normal Sales do not require a Business Day.

When enabled:
1. Only one Business Day may be OPEN.
2. Opening Cash is required and may be zero.
3. Sales require the OPEN Business Day.
4. EOD cannot be disabled while a Business Day remains OPEN.
5. Actual Closing Cash is required and may be zero.
6. Closing Note is optional.
7. Closing stores Cash Sales, GCash Sales, Refund totals, Net Sales, Expected Closing Cash, Actual Closing Cash, and Cash Variance.
8. Variance is preserved rather than used to rewrite historical Sales.

Core formulas:

```text
Expected Closing Cash
= Opening Cash + Cash Sales - Cash Refunds

Net Sales
= Cash Sales + GCash Sales - Cash Refunds - GCash Refunds

Cash Variance
= Actual Closing Cash - Expected Closing Cash
```

GCash contributes to revenue but not expected physical drawer cash.

The compact UI is implemented in `src/features/businessDay/BusinessDayPanel.tsx`; persistence/business logic is in `src/services/businessDayService.ts`. It expands only for opening/closing input.

## Inventory Model
Inventory remains explainable through `SALE`, `RESTOCK`, `ADJUSTMENT`, `VOID`, and `REFUND` movements. `Product.currentStockCache` is an operational cache, not the audit trail.

## Database Evolution
Current local database: **Dexie Version 10**.

- V1 Products
- V2 Inventory Movements
- V3 Suppliers, Procurements, Price History
- V4 Procurement void semantics
- V5 Procurement status normalization
- V6 normalized Procurement items
- V7 Categories
- V8 Sales and SaleItems
- V9 Sale Void/Refund state
- V10 Business Days, application settings, and EOD-aware Sale/reversal associations

Existing business data must be preserved through upgrades.

## PWA
Updates must not force-refresh an active session. IndexedDB business data must survive application-shell updates.

## UI Principles
Tablet-first; large touch targets; three-page navigation; compact operational ledgers; compact optional EOD control; technical/audit-only data stays out of routine workflow unless actionable.

## Current Status
Implemented and verified:
- offline-first PWA;
- Dexie Version 10;
- Categories and consistent Cart-adjusted Product stock display;
- Cash/GCash Sales;
- Sale Void/Refund;
- multi-item Procurement and Procurement Void;
- operational Ledger;
- optional EOD disabled by default;
- Business Day opening/closing;
- required Opening Cash and Actual Closing Cash;
- optional Closing Note;
- persisted closing totals, expected cash, and variance;
- EOD-aware Sale/Void/Refund behavior;
- compact EOD UI;
- manual PWA update control.

Pending:
- periodic inventory reconciliation;
- Google Sheets sync/queue;
- cloud representation of reversals and Business Days;
- authentication/authorization;
- backup/recovery;
- stronger active-transaction update safeguards.
