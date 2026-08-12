# Mini Store POS — Architecture

## Architecture Goal

The application must remain usable when the store temporarily loses internet access.

The system therefore follows an **offline-first** design rather than treating the network as a requirement for every transaction.

## High-Level Architecture

```text
Android POS Tablet
       |
       v
Offline-First PWA
       |
       v
Local Browser Database
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

The frontend is a browser-based Progressive Web App (PWA) optimized for one dedicated store tablet.

The primary application navigation should remain intentionally small.

The initial application uses **three top-level pages**:

1. POS
2. Procurement
3. Ledgers

This separates the three major operational concerns while minimizing navigation fatigue.

### 1. POS Page

The POS Page is the store's primary daily operating workspace.

Responsibilities:

- display available products;
- add products to the cart;
- manage quantities;
- perform checkout;
- display relevant stock availability;
- open the business day with an opening cash amount;
- display the current business-day/session status;
- close the business day;
- record the daily revenue summary.

Start-of-day and end-of-day controls belong inside the POS workflow rather than separate top-level pages.

### 2. Procurement Page

The Procurement Page handles stock coming into the store.

Responsibilities:

- select or create a supplier;
- select the product being restocked;
- enter procurement date;
- enter quantity;
- enter total procurement cost;
- calculate unit cost;
- calculate suggested selling price;
- record the procurement;
- create the corresponding RESTOCK inventory movement;
- support owner-controlled selling-price changes when implemented.

Procurement remains separate from checkout because stock purchasing and stock selling are different business processes.

### 3. Ledgers Page

The Ledgers Page is the historical, analytical, audit, and reconciliation workspace.

It may use internal sections or tabs while remaining one top-level page.

Expected ledger areas include:

- Products;
- Sales;
- Daily Revenue / Business-Day Closings;
- Suppliers;
- Procurements;
- Inventory Movements;
- Price History;
- Cash Reconciliation;
- Inventory Reconciliation;
- Adjustments and related audit history.

The development Data Viewer is evolving into this page rather than remaining beneath the POS interface.

### Navigation Principle

```text
POS
    Sell and operate the current business day

PROCUREMENT
    Bring inventory into the store

LEDGERS
    Review history, analytics, and reconcile
```

Avoid additional top-level pages unless a future requirement clearly justifies the navigation cost.

## Business-Day Operation

Daily revenue tracking and reconciliation are separate concerns.

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

A daily closing should preserve:

```text
Business Date
Opening Cash
Total Sales
Cash Sales
Other Payment Sales
Refunds / Voids
Expected Closing Cash
Closed At
```

The exact persistent schema must be designed before implementation.

A daily closing is a summary and must **not replace individual sale records** as the transaction-level source of truth.

## Reconciliation

Physical reconciliation does not have to occur every day.

Cash and inventory reconciliation may be performed weekly, fortnightly, monthly, or another selected period.

Reconciliation belongs under Ledgers.

### Cash Reconciliation

Compare expected cash from recorded activity against an actual physical cash count.

Discrepancies should be recorded rather than silently rewriting sales or daily closing history.

### Inventory Reconciliation

Inventory should not normally require a manually entered start-of-day quantity.

```text
Previous Inventory
+ Restocks
- Sales
+/- Adjustments
= Expected Inventory
```

A physical count compares expected vs. physical inventory.

Any accepted discrepancy should create an auditable adjustment rather than silently replacing the inventory balance.

## Local Data Layer

The current implementation uses IndexedDB through Dexie for offline persistence.

The local database must contain the operational records required to continue selling while disconnected.

### Design Principle

Do not make Google Sheets the runtime database for an offline sale.

A network outage must not prevent a valid local transaction.

## Inventory Model

Inventory should be traceable through **inventory movements**, including:

- restock / stock-in;
- sale / stock-out;
- correction or adjustment;
- void;
- refund where applicable.

Any cached current-stock value must not replace movement history as the audit trail.

## PWA Update Management

Application updates are a production-safety concern because the POS may be in the middle of checkout, procurement entry, or another business transaction when a new deployment becomes available.

### Update Policy

The PWA must follow a **detect automatically, apply manually** model.

When a newer deployed application version is detected:

1. the currently running application must remain usable;
2. the new service worker may be downloaded and wait for activation;
3. the application should visibly notify the user that an update is available;
4. the application must not force-refresh merely because a new version exists;
5. the end user must explicitly choose when to apply the update;
6. applying the update may then activate the waiting service worker and reload the application;
7. persisted IndexedDB business data must survive application-shell updates.

The current implementation uses `vite-plugin-pwa` with:

```text
registerType: 'prompt'
```

and a React update prompt based on:

```text
virtual:pwa-register/react
```

The UI currently offers:

```text
Apply Update
Later
```

The intended operating guidance is to apply updates only when no active business transaction could be interrupted.

### Active Transaction Safeguard

When checkout/cart behavior becomes fully implemented, the application should prevent or disable update activation while an in-progress transaction exists.

The system should not rely only on user memory to avoid applying an update mid-checkout.

Similar protection may later be extended to other unsaved transactional forms if necessary.

### Update Verification Requirement

A successful build and deployment do **not** prove the manual-update lifecycle.

Production verification must explicitly test:

```text
Version A running
        |
Version B deployed
        |
Version A detects update
        |
No automatic forced reload
        |
User chooses Later
        |
Version A continues
        |
User later chooses Apply Update
        |
Version B activates/reloads
        |
Existing IndexedDB records remain intact
```

This test should be performed after material changes to PWA update behavior.

## Cloud Synchronization

Google Sheets is intended to receive synchronized data when connectivity becomes available.

Google Apps Script can serve as the integration layer between the PWA and Google Sheets.

Synchronization should eventually support:

- records created offline;
- retry after failure;
- duplicate prevention;
- synchronization status;
- safe partial-failure handling.

The exact synchronization protocol must be documented before production use.

## Hosting

The frontend uses a static HTTPS deployment compatible with PWA service workers.

The repository is hosted in GitHub and the current production frontend is deployed through GitHub Pages.

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
GitHub Pages Deployment
      |
      v
Installed / Browser PWA
```

Deployment of new code and activation of that code on an already-running POS are intentionally separate concepts.

## Version Control

GitHub is the permanent source of truth.

Every meaningful working change should be committed with a descriptive commit message.

Avoid vague messages such as `update`, `changes`, or `fix`.

## Change Safety

For cross-file or architectural changes:

1. inspect the existing implementation;
2. identify affected files;
3. explain the proposed change;
4. make the smallest practical change;
5. test;
6. commit only after the feature is working;
7. update repository documentation when architecture or business rules change.

## Current Architecture Status

Confirmed direction and implementation:

- offline-first PWA;
- IndexedDB/Dexie local browser persistence;
- GitHub as source of truth;
- GitHub Pages production frontend;
- Google Sheets as intended synchronization/reporting destination;
- Google Apps Script as intended synchronization/backend bridge;
- one dedicated POS tablet;
- remote deployment and maintenance;
- three top-level pages: POS, Procurement, and Ledgers;
- start-of-day cash management within POS;
- end-of-day revenue tracking within POS;
- periodic reconciliation within Ledgers;
- inventory based on auditable movements;
- prompt-based PWA update registration;
- visible React update-prompt implementation;
- user-controlled update activation rather than forced automatic reload.

Still requiring implementation or verification:

- production verification of the manual PWA update lifecycle;
- safeguard preventing update activation during an active transaction;
- business-day / daily-closing database schema;
- sales transaction schema;
- payment-method model;
- cash reconciliation schema;
- inventory reconciliation schema;
- sync queue design;
- conflict-resolution policy;
- authentication and authorization requirements;
- backup and recovery procedure.
