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

### POS Page

Primary daily operating workspace for product selection, cart/checkout, stock visibility, and future business-day opening/closing.

### Procurement Page

Handles stock coming into the store. Current responsibilities include:

- select/create Supplier;
- select Product;
- enter Procurement Date;
- enter Quantity and Procurement Cost;
- calculate Unit Cost and Suggested SRP;
- save Procurement;
- create linked RESTOCK movement;
- reject incomplete entries;
- warn on potential duplicate entries.

### Ledgers Page

Historical/audit workspace containing Products, Suppliers, Procurements, Inventory Movements, Price History, and future sales/reconciliation records.

Supplier administration allows deletion only for unused Suppliers. Procurement transactions are not hard-deleted; invalid transactions are voided and preserved.

## Inventory Model

Inventory changes must be explainable through Inventory Movements. Current movement types include:

```text
SALE
RESTOCK
ADJUSTMENT
VOID
REFUND
```

`currentStockCache` is a convenience value and must remain reconcilable with movement history.

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

Potential duplicate detection first uses the indexed `procurementDate`, then compares Supplier, Product, and Total Cost. A match warns rather than blocks because a legitimate repeat Procurement can exist.

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

Example:

```text
RESTOCK +10
VOID    -10
------------
Net       0
```

The operation rejects blank reasons, missing Procurement/Product records, already-VOID Procurements, and reversals that would make cached stock negative.

## Procurement Ledger Presentation

Procurements are displayed newest-entry-first using `createdAt`, while the visible business date remains `procurementDate`.

Current column order:

```text
Date
Supplier
Item
Quantity
Total Cost
Unit Cost
SRP
Status
Void Reason
Action
```

Internal Product/Supplier UUID relationships are resolved to names for display.

Status values are:

```text
VALID
VOID
```

## Supplier State Management

Duplicate Supplier names are blocked using trimmed, case-insensitive comparison in the service layer. A Supplier referenced by Procurement history cannot be deleted. Supplier changes propagate back to the Procurement dropdown during the same app session.

## Database Evolution

The local database currently uses Dexie Version 5.

Version 4 introduced Procurement status/void fields and initially migrated existing Procurement records to `ACTIVE`.

Version 5 normalized status terminology:

```text
ACTIVE -> VALID
missing -> VALID
VOID -> unchanged
```

The migrations were verified without clearing IndexedDB and preserved existing Products, Suppliers, Procurements, and stock values.

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

Cash and inventory reconciliation may be periodic rather than daily. Discrepancies should create auditable adjustments rather than silently rewriting transaction history.

## PWA Update Management

The current MVP uses `vite-plugin-pwa` prompt mode. A new version must not force-refresh an active running POS session. `Later` defers for the current session, but a waiting service worker may activate after the PWA is fully closed and relaunched. Existing IndexedDB Products and Suppliers were verified to survive a production PWA update.

Stronger consent-first/critical-update governance is deferred until future external-customer scaling.

## Cloud Synchronization

Google Sheets remains the intended reporting/synchronization destination through Google Apps Script. Future synchronization must preserve original transactions and later VOID reversals rather than deleting historical cloud records.

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
- Supplier duplicate/deletion guardrails;
- Procurement save flow;
- required Supplier/Product/Date/positive Quantity/Cost;
- potential duplicate warning;
- readable and newest-first Procurement ledger;
- Dexie Version 5 migrations;
- Procurement status `VALID | VOID`;
- audit-preserving Void Procurement;
- required/visible Void Reason;
- VOID inventory reversal;
- stock-cache reversal;
- double-void prevention;
- negative-stock void guardrail;
- production PWA update lifecycle verified for current MVP behavior.

Still pending:

- owner-controlled selling-price application;
- Price History writes;
- Sales/cart/checkout schema;
- business-day opening/closing schema;
- cash/inventory reconciliation;
- sync queue and conflict policy;
- cloud representation of Procurement VOID events;
- authentication/authorization;
- backup/recovery;
- active-transaction PWA update safeguard;
- future external-customer release governance.
