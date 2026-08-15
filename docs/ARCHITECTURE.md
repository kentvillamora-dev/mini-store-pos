# Mini Store POS — Architecture

## Architecture Goal

The application must remain usable when the store temporarily loses internet access. The system therefore follows an **offline-first** design.

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
Local Transactions      Sync Queue / State
                            |
                      Internet available
                            |
                            v
                   Google Apps Script
                            |
                            v
                      Google Sheets
```

## Frontend

The application uses three top-level pages:

1. POS
2. Procurement
3. Ledgers

Avoid additional top-level pages unless a future requirement clearly justifies the navigation cost.

The shared application shell includes a discreet application-version control above the main navigation. The version label itself doubles as the manual PWA update-check control for super users.

Current version-ID convention:

```text
YYYY.MM.DD.N
```

Current application version:

```text
2026.08.15.1
```

### POS Page

Primary daily operating workspace for product selection, cart/checkout, stock visibility, and future business-day opening/closing.

Current POS product presentation is category-based rather than one flat alphabetical list.

Category display order:

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

Current POS grouping rules:

- only active Products are shown;
- Products are grouped by `categoryId`;
- category sections follow the defined business display order;
- Product names are sorted alphabetically within each Category;
- empty Category sections are hidden;
- active Products with no valid Category relationship appear under `Uncategorized`;
- each Product card displays Product name, selling price, and current available stock;
- Product cards are currently display-only; Sales/cart behavior has not yet been implemented.

### Procurement Page

Operational workspace for stock acquisition and related setup.

Current landing order:

```text
New Procurement
Add Product
Add Supplier
Set Price
```

The primary Procurement workflow is staged:

```text
New Procurement
      |
      v
Procurement Details
Date + Supplier
      |
      v
Add Products
Product + Quantity + Total Cost
      |
      v
Procurement Summary
Unit Cost + Previous Price + Suggested SRP + Final Price
      |
      v
Save Procurement
      |
      v
Atomic IndexedDB transaction
```

Product and Supplier creation remain supporting setup actions. Standalone Set Price remains available for price decisions outside a new Procurement.

### Ledgers Page

Historical/audit workspace containing Products, Suppliers, Procurements, Inventory Movements, Price History, and future Sales/reconciliation records.

The Product ledger is also the Product master-data correction surface.

Current Product-ledger behavior:

- Category is the first displayed column;
- rows are sorted by Category A-Z, then Product Name A-Z;
- Products without a Category are shown as `Uncategorized`;
- Product name and Category can be edited;
- Product UUID is preserved during corrections;
- historical records continue resolving the Product by stable UUID and therefore display the current corrected Product name/category.

Supplier administration allows deletion only for unused Suppliers. Procurements are not hard-deleted; invalid transactions are voided and preserved.

## Category Architecture

Version 7 introduces first-class Product Categories.

Category persistence is implemented through the `categories` IndexedDB table and `src/services/categoryService.ts`.

Default Category records are initialized at application startup.

The default Category set is:

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

Category initialization is designed to be idempotent and concurrency-safe under React development Strict Mode.

If duplicate default Category rows are detected, initialization:

1. establishes the canonical Category record;
2. remaps affected Products to the canonical Category ID;
3. deletes duplicate Category rows.

This prevents duplicate dropdown entries without orphaning Product relationships.

## Product Creation and Master-Data Architecture

Product creation is implemented through `src/services/productService.ts`.

`createProduct(name, categoryId)`:

- trims whitespace;
- rejects blank Product names;
- requires a Category;
- verifies that the selected Category exists and is active;
- blocks trimmed/case-insensitive duplicate Product names;
- generates a UUID;
- creates the Product with:
  - `sellingPrice = 0`
  - `currentStockCache = 0`
  - `active = true`
  - creation/update timestamps.

Creating a Product creates neither stock nor an Inventory Movement.

The legacy `sample-sardines` bootstrap has been removed. An empty database therefore remains genuinely empty.

`updateProduct(productId, name, categoryId)` supports correction of Product master data while preserving the stable Product UUID.

Allowed correction scope:

```text
same Product UUID
    |
    +--> Product name may be corrected
    |
    +--> Category may be corrected
```

The Product UUID is the durable Product identity. Product name and Category are editable attributes of that identity.

Product editing must not be used to repurpose one Product UUID into a fundamentally different item.

Historical pricing/cost data remains transaction-specific and immutable where appropriate. Historical Product-name snapshots are not required because historical records resolve the current name of the same Product UUID.

## Inventory Model

Inventory changes must be explainable through Inventory Movements.

Current movement types:

```text
SALE
RESTOCK
ADJUSTMENT
VOID
REFUND
```

`currentStockCache` is a convenience value and must remain reconcilable with movement history.

The POS currently displays `currentStockCache` as the available-stock value for fast operational visibility.

## Procurement Data Architecture

Version 6 separated one Procurement business event from its Product lines:

```text
Procurement
Supplier + Date + Status
       |
       | 1 : many
       v
ProcurementItem
Product + Quantity + Cost + Pricing Snapshot
```

`Procurement` is the transaction header. `ProcurementItem` contains Product-specific quantity, cost, and pricing information.

This permits one supplier/date Procurement to contain multiple Products while preserving one coherent business event.

Version 7 adds Categories but does not change the Procurement header/item relationship.

## Procurement Creation Flow

The UI builds an in-memory draft first. No business transaction is persisted while the user is entering details or reviewing the summary.

```text
Date + Supplier
      |
      v
Add one or more Product lines
      |
      v
Review Summary / Final Prices
      |
      v
Potential duplicate warning
      |
      v
Save Procurement
      |
      v
ONE Dexie transaction
      |
      +--> one Procurement header (VALID)
      +--> one ProcurementItem per Product
      +--> one RESTOCK movement per Product
      +--> Product stock-cache updates
      +--> approved Product price updates
      +--> Price History when price changed
```

If any meaningful write fails, the transaction should roll back rather than leave a partial Procurement.

Required fields are Supplier, Procurement Date, and at least one valid Product item. Each item requires Product, Quantity > 0, and Total Cost > 0. The same Product cannot appear twice in one Procurement.

## Procurement Pricing Architecture

Suggested SRP is advisory and must never silently become the active selling price.

For an existing Product:

```text
Previous Retail Price = current Product.sellingPrice
Recommended Price     = calculated Suggested SRP
Final Price           = Previous Retail Price by default
```

If the owner makes no edit, the active price remains unchanged and no Price History record is created.

If the owner changes Final Price, `Product.sellingPrice` is updated and a Price History record is created.

A newly created Product begins with `sellingPrice = 0`. During its first Procurement, the Summary displays the previous price as `Not set` and requires the owner to explicitly enter a valid Final Price before saving.

The standalone Set Price workflow continues to use the latest VALID Product-specific ProcurementItem for Unit Cost and Suggested SRP reference.

## Potential Duplicate Procurement

Version 6+ uses a warning heuristic based on:

```text
same Supplier
same Procurement Date
same number of item lines
same total Procurement cost
```

A match warns rather than blocks because legitimate repeat purchases can exist.

## Procurement Void Architecture

Hard deletion remains rejected in favor of an audit-preserving whole-Procurement Void workflow.

Before a void is committed, every ProcurementItem is checked. If reversing any item would make its Product stock negative, the entire void is rejected.

```text
VALID Procurement
      |
      v
Void + required reason
      |
      v
validate every item
      |
      v
ONE Dexie transaction
      |
      +--> one VOID movement per ProcurementItem
      +--> reverse each Product stock quantity
      +--> Procurement VALID -> VOID
      +--> store voidedAt
      +--> store voidReason
```

Original Procurement, ProcurementItems, and RESTOCK movements remain visible.

Selling-price decisions and Price History are not automatically reversed by a Procurement void because later pricing decisions may exist.

## Procurement Ledger Presentation

Procurements are ordered newest-entry-first by header `createdAt`.

The ledger displays Product-item rows while grouping shared header information.

Product-level columns:

```text
Item
Quantity
Total Cost
Unit Cost
Previous Price
SRP
Applied Price
```

Shared Procurement information:

```text
Date
Supplier
Status
Action
Void Reason
```

Internal UUID/reference relationships are resolved to end-user names or omitted.

## Supplier State Management

Duplicate Supplier names are blocked using trimmed, case-insensitive comparison.

A Supplier referenced by Procurement history cannot be deleted.

Supplier changes propagate to the Procurement selector during the same running app session.

## Database Evolution

The local database currently uses **Dexie Version 7**.

Version history:

- Version 1 — Products
- Version 2 — Inventory Movements
- Version 3 — Suppliers, Procurements, Price History
- Version 4 — Procurement status/void semantics
- Version 5 — status terminology normalized to `VALID | VOID`
- Version 6 — normalized Procurement header/items model and new `procurementItems` table
- Version 7 — first-class `categories` table used by Product creation, Product master-data correction, and categorized POS presentation

Before Version 6, development and production IndexedDB records were intentionally reset once because all records were test-only and no real business transactions existed. This was a one-time development exception, not a normal migration strategy.

Version 7 was introduced without clearing the existing dev database. Build verification passed and prior ledger records remained intact after opening the upgraded database.

Once real business data exists, future schema changes must preserve it through explicit migrations.

## PWA Update Management

The MVP uses `vite-plugin-pwa` prompt mode.

A new version must not force-refresh an active running POS session.

Automatic update detection remains enabled.

Manual update checking is intentionally de-emphasized for ordinary users. The application version itself is rendered as a small control above the main navigation:

```text
vYYYY.MM.DD.N
```

Selecting that version control invokes `registration.update()`.

The control does not automatically apply an update.

Applying an available update remains explicit through:

```text
Apply Update
Later
```

Persisted IndexedDB business records must survive application-shell updates.

## UI Design System

The application now uses a shared enterprise-style CSS design system.

Current design principles:

- restrained dark navy primary color;
- high-contrast light surfaces;
- consistent form controls;
- consistent button sizing by role;
- large touch targets for operational controls;
- fixed-size POS Product cards;
- responsive POS split layout;
- clean card-style Procurement sections;
- dense ledger/admin table presentation;
- tablet-first usability;
- typography and contrast chosen to remain comfortable for older end users.

The small app-version/manual-update control is intentionally visually secondary.

## Business-Day Operation

Future business-day flow remains:

```text
Start Day
    |
    v
Record Opening Cash
    |
    v
Process Sales
    |
    v
End Day
    |
    v
Create Daily Closing / Revenue Record
```

Daily closing must not replace individual Sale records.

## Reconciliation

Cash and inventory reconciliation may be periodic rather than daily.

Discrepancies should create auditable adjustments rather than silently rewriting transaction history.

## Cloud Synchronization

Google Sheets remains the intended reporting/synchronization destination through Google Apps Script.

Future synchronization must preserve original transactions and later VOID reversals rather than deleting historical cloud records.

## Deployment Philosophy

```text
Samsung Tablet
      |
      v
GitHub Codespaces
      |
      v
GitHub Repository
      |
      v
Build / Test
      |
      v
GitHub Pages
      |
      v
Installed / Browser PWA
```

GitHub remains the permanent source of truth.

## Change Safety

For cross-file or persisted-data changes:

1. inspect current implementation;
2. identify affected files/records;
3. define migration requirements;
4. make the smallest practical change;
5. test data preservation/integrity;
6. run the production build;
7. commit only after verification;
8. update permanent docs/checkpoint when architecture or business rules change.

## Current Architecture Status

Confirmed/implemented:

- offline-first PWA;
- Dexie/IndexedDB local persistence;
- three top-level pages;
- discreet version-as-manual-update control above navigation;
- PWA update prompt/manual check;
- Version 7 Categories table;
- ten canonical default Categories;
- idempotent/concurrency-safe Category initialization;
- Category-required Product creation;
- Product name/Category correction while preserving Product UUID;
- Product ledger Category-first display and Category/Product alphabetical sorting;
- categorized POS Product presentation;
- active-only POS Product display;
- POS Product price display;
- POS available-stock display;
- shared enterprise-style responsive CSS system;
- Supplier creation/duplicate/deletion guardrails;
- Version 6 Procurement header/items model;
- staged multi-item Procurement draft;
- Procurement Summary;
- Unit Cost and Suggested SRP calculations;
- owner-controlled Final Price;
- Price History writes when price changes;
- atomic multi-item Procurement save;
- duplicate Product-line prevention;
- potential duplicate Procurement warning;
- multi-item Procurement ledger;
- Procurement status `VALID | VOID`;
- audit-preserving multi-item void implementation;
- negative-stock void guardrail;
- removal of `sample-sardines` bootstrap.

Still pending or requiring later verification/design:

- Sales/cart/checkout schema and workflow;
- Sales ledger;
- stock-decrement behavior for Sales;
- cash payment/change workflow;
- business-day opening/closing schema;
- cash/inventory reconciliation;
- sync queue and conflict policy;
- cloud representation of Procurement VOID events;
- authentication/authorization;
- backup/recovery;
- stronger active-transaction PWA update safeguard;
- future external-customer release governance.
