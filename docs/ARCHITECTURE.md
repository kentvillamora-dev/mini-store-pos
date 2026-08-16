# Mini Store POS — Architecture

## Architecture Goal

The application must remain usable when the store temporarily loses internet access. The system follows an **offline-first** design with IndexedDB/Dexie as the local transaction store.

## High-Level Architecture

```text
Android POS Tablet
       |
       v
Offline-First PWA
       |
       v
IndexedDB / Dexie
       |
       +--------------------+
       |                    |
       v                    v
Local Transactions      Future Sync Queue / State
                            |
                      Internet available
                            |
                            v
                   Google Apps Script
                            |
                            v
                      Google Sheets
```

Google Sheets remains the intended reporting/analytics destination. The tablet UI is optimized for operational actions rather than exposing every normalized audit table.

## Frontend

The application uses three top-level pages:

1. POS
2. Procurement
3. Ledgers

Avoid additional top-level pages unless a future requirement clearly justifies the navigation cost.

### POS Page

Primary daily workspace for Product selection, Cart management, checkout, and stock visibility.

Current behavior:

- active Products are grouped by Category;
- Product names are alphabetical within each Category;
- each Product card shows name, selling price, and available stock;
- adding an item to the Cart reduces the **displayed** available stock immediately without committing a database stock change;
- Cart quantity can be increased, decreased, or removed;
- Cart layout keeps Product details and action buttons aligned;
- attempts to exceed available stock show the warning beside the affected Cart item;
- Checkout supports `CASH` and `GCASH`;
- `CASH` is the default payment method;
- GCash is a marker only; no payment gateway is involved;
- Cash Received supports manual entry and tablet-oriented incremental buttons:
  - Exact
  - +₱5
  - +₱10
  - +₱20
  - +₱50
  - +₱100
  - +₱500
  - Clear
- cash checkout displays Remaining when tender is insufficient and Change when sufficient;
- completing a Sale commits the transaction atomically and permanently reduces stock.

### Procurement Page

Operational workspace for stock acquisition and related setup.

Landing order:

```text
New Procurement
Add Product
Add Supplier
Set Price
```

New Procurement remains a staged in-memory draft until final save.

A successful save is one atomic Dexie transaction creating the Procurement header, ProcurementItems, RESTOCK movements, stock-cache changes, and any approved price-history changes.

### Ledgers Page

The in-app Data Viewer is an **operational ledger**, not a complete analytics surface.

Visible tables, in operational priority order:

```text
Sales
Procurements
Products
Suppliers
```

Sales is expanded by default. Procurements, Products, and Suppliers are collapsed by default.

Each section has an independent Expand/Collapse control. Global `Expand All` and `Collapse All` controls appear in the upper-right of the Data Viewer header.

Normalized supporting tables such as Sale Items, Inventory Movements, and Price History remain persisted in IndexedDB but are intentionally not displayed in the operational Ledger. They are intended to remain available for audit/synchronization and later Google Sheets analytics.

Operational actions:

- Sales: Void or Refund while status is VALID;
- Procurements: Void while status is VALID;
- Products: master-data correction;
- Suppliers: deletion subject to reference guardrails.

## Sales Architecture

Dexie Version 8 introduced normalized Sales:

```text
Sale
payment + totals + status + timestamp
       |
       | 1 : many
       v
SaleItem
Product + Quantity + Unit Price + Line Total
```

A completed Sale is persisted by `src/services/saleService.ts`.

The Sale service validates the Cart and rechecks persisted Product stock immediately before writing.

A successful Sale is one Dexie transaction across:

```text
sales
saleItems
inventoryMovements
products
```

For each Sale:

```text
1 Sale header
N SaleItems
N SALE inventory movements
N stock-cache decreases
```

If any required write or final stock validation fails, the transaction rolls back.

### Payment Architecture

Supported methods:

```text
CASH
GCASH
```

Cash is the default operational choice.

For Cash, the Sale stores `cashReceived` and `changeDue`.

For GCash, the Sale stores the `GCASH` payment marker without gateway integration.

Split payments are not implemented.

## Sale Reversal Architecture

Dexie Version 9 expanded Sale status to:

```text
VALID
VOID
REFUNDED
```

Void and Refund are intentionally distinct:

- **Void** — the Sale itself was entered in error.
- **Refund** — the original Sale was valid but is later reversed.

Neither action deletes the Sale or SaleItems.

Both require a reason and execute atomically across Sale, Product, and Inventory Movement state.

```text
VALID Sale
   |
   +--> Void
   |      +--> status = VOID
   |      +--> voidedAt + voidReason
   |      +--> positive VOID movement per SaleItem
   |      +--> restore Product stock
   |
   +--> Refund
          +--> status = REFUNDED
          +--> refundedAt + refundReason
          +--> positive REFUND movement per SaleItem
          +--> restore Product stock
```

Only a VALID Sale can be reversed, preventing double reversal.

## Inventory Model

Inventory changes must remain explainable through Inventory Movements.

Movement types:

```text
SALE
RESTOCK
ADJUSTMENT
VOID
REFUND
```

`Product.currentStockCache` is the fast operational cache.

The Cart's temporary displayed-stock reduction is UI state only. Persisted stock changes occur only when the Sale successfully completes.

## Procurement Architecture

Version 6 normalized Procurement into one header with one or more ProcurementItems.

Procurement creation and voiding remain atomic and audit-preserving.

Suggested SRP is advisory. Existing retail price remains the default Final Price unless deliberately changed.

Voiding a Procurement reverses stock through VOID movements but does not automatically rewind selling-price history.

## Product and Category Architecture

Version 7 introduced first-class Categories.

Product UUID is the durable identity. Product name and Category can be corrected without recreating the Product.

Default Categories are initialized idempotently and duplicate canonical categories are repaired without orphaning Product relationships.

## Database Evolution

Current local database: **Dexie Version 9**.

Version history:

- Version 1 — Products
- Version 2 — Inventory Movements
- Version 3 — Suppliers, Procurements, Price History
- Version 4 — Procurement status/void semantics
- Version 5 — Procurement status normalized to `VALID | VOID`
- Version 6 — normalized Procurement header/items and `procurementItems`
- Version 7 — first-class Product Categories
- Version 8 — normalized `sales` and `saleItems`
- Version 9 — Sale reversal metadata/status supporting Void and Refund

Version 8 and Version 9 preserve existing stores and do not intentionally clear prior records.

The pre-Version-6 test-data reset remains a one-time development exception and must not be reused once real business data exists.

## PWA Update Management

The application uses `vite-plugin-pwa` prompt mode.

A new version must not force-refresh an active running POS session.

The application version doubles as the manual update-check control. Applying an available update remains explicit.

Persisted IndexedDB business records must survive application-shell updates.

## UI Design Principles

- tablet-first;
- large touch targets for operational controls;
- minimal top-level navigation;
- category-based Product browsing;
- aligned Cart controls;
- Cash checkout optimized for taps rather than keyboard entry;
- operational Ledgers kept compact through collapse/expand;
- technical/audit-only tables kept out of the tablet workflow when no user action is required.

## Cloud Synchronization

Google Sheets remains the intended reporting/synchronization destination through Google Apps Script.

Future synchronization must preserve stable local IDs, original transaction times, Sale/Procurement status, and reversal records rather than deleting historical cloud data.

Sale Items, Inventory Movements, and Price History are expected to be especially useful in Sheets for pivot-table analytics even though they are hidden from the operational tablet Ledger.

## Current Architecture Status

Confirmed/implemented:

- offline-first PWA and IndexedDB/Dexie persistence;
- three top-level pages;
- Version 9 local schema;
- Categories and categorized POS Product display;
- Cart with temporary displayed-stock reservation;
- Cart quantity controls and inline stock-limit warning;
- Cash/GCash checkout with Cash default;
- tablet-oriented incremental Cash Received controls;
- atomic Sale persistence;
- SaleItems and SALE Inventory Movements;
- permanent stock deduction only on completed Sale;
- Sale Void and Refund with required reason;
- atomic stock restoration and reversal movements;
- operational Sales ledger;
- operational Ledger order: Sales, Procurements, Products, Suppliers;
- independent and global collapse/expand controls;
- normalized audit tables retained even when hidden from Data Viewer;
- multi-item Procurement and audit-preserving Procurement void;
- Product and Supplier maintenance guardrails;
- PWA update prompt/manual check.

Still pending:

- business-day opening/closing schema and workflow;
- EOD cash reconciliation;
- periodic inventory reconciliation;
- Google Sheets synchronization and sync queue;
- cloud representation of Sale/Procurement reversals;
- authentication/authorization;
- backup/recovery;
- stronger active-transaction PWA update safeguard.
