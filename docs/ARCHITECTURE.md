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

Supplier administration currently includes deletion of unused supplier records. A supplier that is already referenced by procurement history must not be deleted.

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

## Supplier State Management

Supplier records are stored in IndexedDB and may be used by both Procurement and Ledgers.

The current React implementation keeps supplier data in application state for the Procurement dropdown and separately renders supplier data in the Ledgers/Data Viewer.

When supplier data changes through Ledgers, the application must refresh the supplier state owned by the main application so Procurement reflects the change immediately without requiring a full app reload.

Duplicate supplier names are prevented at the service layer using trimmed, case-insensitive comparison.

Deletion of a supplier is allowed only when no procurement record references that supplier ID.

## PWA Update Management

Application updates are a production-safety concern because the POS may be in the middle of checkout, procurement entry, or another business transaction when a new deployment becomes available.

### Current MVP Update Policy

The current PWA uses a **prompt-based update model that protects the active running session**.

When a newer deployed application version is detected:

1. the currently running application remains usable;
2. the new service worker may be downloaded and wait for activation;
3. the application may visibly notify the user that an update is available;
4. the application does not force-refresh the active running session merely because a newer version exists;
5. `Apply Update` requests immediate activation/reload;
6. `Later` dismisses the prompt and allows the current running version to continue;
7. if the PWA is later completely closed, a waiting service worker may activate naturally before the next launch;
8. persisted IndexedDB business data must survive application-shell updates.

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

### Verified Production Lifecycle

The update lifecycle was verified in production using a harmless Procurement-heading marker.

Observed behavior:

```text
Version A already running
        |
Version B deployed
        |
Version A did not force-refresh
        |
Version A did not immediately show an update prompt
        |
PWA closed and relaunched
        |
Update prompt appeared
        |
User chose Later
        |
Prompt disappeared and Version A continued
        |
PWA later closed and relaunched
        |
Waiting Version B activated naturally
        |
Temporary Version B heading appeared
        |
Existing IndexedDB Products and Suppliers remained intact
```

This establishes that `Later` means **defer for the current running session**, not permanent rejection of that release.

### Active Transaction Safeguard

When checkout/cart behavior becomes fully implemented, the application should prevent or disable explicit update activation while an in-progress transaction exists.

The system should not rely only on user memory to avoid applying an update mid-checkout.

Similar protection may later be extended to other unsaved transactional forms if necessary.

Because a waiting service worker may activate naturally after all old-version clients are closed, future transaction-durability work should also ensure that any in-progress business state that must survive an app shutdown is safely persisted before shutdown.

### Future Release Governance

The current update mechanism is acceptable for the family-store MVP and should not be expanded into a complex release-control system yet.

Before the application is scaled to external customers, reconsider whether stronger release governance is required, including:

- explicit customer consent before production deployment;
- release severity classification such as normal, important, and critical;
- clear critical-security-update messaging;
- recording accepted or deferred update decisions;
- developer visibility into customers running older versions;
- synchronization of update-decision status;
- contractual and legal treatment of update acceptance and deferral.

These features are **future considerations**, not current implementation requirements.

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

Deployment of new code and activation of that code on an already-running POS are related but not identical concepts because browser service-worker lifecycle rules influence when a waiting version becomes active.

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
- verified protection against forced reload of an active running session;
- verified `Later` behavior as current-session deferral;
- verified natural activation of a waiting update after app closure/relaunch;
- verified preservation of IndexedDB Products and Suppliers through a production PWA update;
- supplier duplicate-name prevention;
- safe deletion of unreferenced suppliers;
- prevention of supplier deletion when procurement history references the supplier;
- immediate cross-page supplier-state refresh after deletion.

Still requiring implementation or verification:

- safeguard preventing explicit update activation during an active transaction;
- procurement-form submission through `createProcurement()`;
- first real UI-created procurement transaction;
- business-day / daily-closing database schema;
- sales transaction schema;
- payment-method model;
- cash reconciliation schema;
- inventory reconciliation schema;
- sync queue design;
- conflict-resolution policy;
- authentication and authorization requirements;
- backup and recovery procedure;
- future external-customer release-governance requirements.
