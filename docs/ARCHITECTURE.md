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

A visible application version identifier is rendered in the shared app shell beneath the top navigation so the developer can compare development and production builds quickly.

Current version-ID convention:

```text
YYYY.MM.DD.N
```

Current visible version:

```text
2026.08.15.1
```

### POS Page

Primary daily operating workspace for product selection, cart/checkout, stock visibility, and future business-day opening/closing.

### Procurement Page

Operational workspace for stock acquisition and related setup.

Current implemented responsibilities:

- add Product;
- add Supplier;
- select Product;
- select Supplier;
- enter Procurement Date;
- enter Quantity and Procurement Cost;
- calculate Unit Cost and Suggested SRP;
- save Procurement;
- create linked RESTOCK movement;
- reject incomplete entries;
- warn on potential duplicate Procurement entries.

Current live section order is:

```text
Add Product
Add Supplier
Restock Product
```

The intended next UI refinement is:

```text
Restock Product
Add Product
Add Supplier
Set Price
```

`Set Price` is not yet implemented.

The intended order reflects actual user workflow: restocking is the primary reason to open Procurement; Product/Supplier creation is supporting setup used only when a record does not yet exist.

### Ledgers Page

Historical/audit workspace containing:

- Products;
- Suppliers;
- Procurements;
- Inventory Movements;
- Price History;
- future sales/reconciliation records.

Ledgers are primarily for record keeping and audit visibility. Operational Product creation and future selling-price decisions belong under Procurement.

Supplier administration allows deletion only for unused Suppliers. Procurement transactions are not hard-deleted; invalid transactions are voided and preserved.

## Product Creation Architecture

Product creation is implemented through:

```text
src/services/productService.ts
```

`createProduct(name)`:

1. trims surrounding whitespace;
2. rejects blank names;
3. rejects case-insensitive duplicate Product names;
4. generates a UUID;
5. creates the Product with:
   - `sellingPrice = 0`;
   - `currentStockCache = 0`;
   - `active = true`;
   - creation/update timestamps.

A newly created Product has no stock movement and no Procurement history until a Procurement is recorded.

After successful Product creation, `App.tsx` refreshes Product state so the Product becomes available immediately in the Restock Product selector during the same app session.

The original hardcoded `sample-sardines` bootstrap still exists in `App.tsx` and should be removed in a later cleanup only after the real Product workflow is fully established.

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

Creating a Product does not create an Inventory Movement. Stock changes only when an actual stock-changing business event occurs.

## Procurement Creation Flow

```text
Complete Procurement input
        |
        v
validate input
        |
        v
potential duplicate check
        |
        v
user deliberately continues if warned
        |
        v
Dexie transaction
        |
        +--> Procurement(status = VALID)
        +--> RESTOCK movement(+quantity)
        +--> currentStockCache += quantity
```

Required new-Procurement fields are Supplier, Product, Procurement Date, Quantity > 0, and Procurement Cost > 0.

Potential duplicate detection first uses indexed `procurementDate`, then compares Supplier, Product, and Total Cost. A match warns rather than blocks because a legitimate repeat Procurement can exist.

## Procurement Void Architecture

Hard deletion was rejected in favor of an audit-preserving Void workflow.

```text
VALID Procurement
        |
        v
Void action + required reason
        |
        v
confirm
        |
        v
Dexie transaction
        |
        +--> Procurement status: VALID -> VOID
        +--> store voidedAt
        +--> store voidReason
        +--> create VOID movement(-quantity)
        +--> currentStockCache -= quantity
```

The original Procurement and original RESTOCK movement remain unchanged and visible.

## Procurement Ledger Presentation

Procurements are displayed newest-entry-first using `createdAt`, while the visible business date remains `procurementDate`.

Current live column order:

```text
Date
Supplier
Item
Quantity
Total Cost
Unit Cost
SRP
Status
Action
Void Reason
```

`Void Reason` remains the final column because it may contain longer free text.

Internal Product/Supplier UUID relationships are resolved to names for display.

Status values are:

```text
VALID
VOID
```

## Selling Price Direction

Selling-price control is the next major Procurement feature after Product creation/layout cleanup.

Permanent rule:

- Procurement-calculated SRP is advisory;
- SRP must not automatically overwrite `Product.sellingPrice`;
- when the owner changes the active selling price, a Price History record must be created.

Intended operational flow:

```text
Add Product
    |
    v
Record Procurement
    |
    v
Unit Cost + Suggested SRP known
    |
    v
Owner chooses Set Price
    |
    +--> Product.sellingPrice updated
    +--> Price History record created
```

`Set Price` is not yet implemented.

## Supplier State Management

Duplicate Supplier names are blocked using trimmed, case-insensitive comparison in the service layer.

A Supplier referenced by Procurement history cannot be deleted.

Supplier changes propagate back to the Procurement dropdown during the same running app session.

## Database Evolution

The local database currently uses Dexie Version 5.

Version 4 introduced Procurement status/void fields.

Version 5 normalized Procurement status terminology to:

```text
VALID | VOID
```

No new database version was required for Product creation because the existing Product schema already supports it.

## PWA Update Management

The current MVP uses `vite-plugin-pwa` prompt mode.

A new version must not force-refresh an active running POS session.

Automatic update detection remains enabled through the service-worker lifecycle.

A manual update path is also implemented:

```text
Check for Update
      |
      v
registration.update()
      |
      v
if newer version is detected
      |
      v
existing update prompt appears
```

The manual check does not automatically apply the update.

Applying the update remains a separate explicit action through:

```text
Apply Update
Later
```

The manual update check was verified working in production.

The visible app version identifier gives the developer a quick way to compare the currently running production shell with the expected deployed version.

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
5. test existing data preservation;
6. run the production build;
7. commit only after verification;
8. update permanent docs/checkpoint when architecture or business rules change.

## Current Architecture Status

Confirmed/verified:

- offline-first PWA;
- Dexie/IndexedDB local persistence;
- three top-level pages;
- visible app version identifier;
- automatic PWA update detection;
- manual Check for Update control;
- Product creation service;
- Product duplicate-name guardrail;
- Add Product UI under Procurement;
- newly created Products refresh into the Restock selector;
- Supplier duplicate/deletion guardrails;
- Procurement save flow;
- required Supplier/Product/Date/positive Quantity/Cost;
- potential duplicate warning;
- readable/newest-first Procurement ledger;
- Dexie Version 5;
- Procurement status `VALID | VOID`;
- audit-preserving Procurement void;
- visible Void Reason;
- VOID inventory reversal;
- stock-cache reversal;
- double-void prevention;
- negative-stock void guardrail.

Still pending:

- Procurement UI reorder to Restock Product -> Add Product -> Add Supplier;
- Set Price under Procurement;
- Price History writes from selling-price changes;
- removal of hardcoded `sample-sardines` bootstrap;
- Sales/cart/checkout schema;
- business-day opening/closing schema;
- cash/inventory reconciliation;
- sync queue and conflict policy;
- cloud representation of Procurement VOID events;
- authentication/authorization;
- backup/recovery;
- active-transaction PWA update safeguard;
- future external-customer release governance.
