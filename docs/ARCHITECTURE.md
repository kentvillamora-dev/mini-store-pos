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

The initial application should use **three top-level pages**:

1. POS
2. Procurement
3. Ledgers

This keeps routine navigation simple while separating the three major operational concerns of the store.

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

Start-of-day and end-of-day controls should be integrated into the POS workflow rather than becoming separate top-level pages.

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
- support owner-controlled selling-price changes when that workflow is implemented.

Procurement must remain separate from normal checkout because purchasing stock and selling stock are different business processes.

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

The existing development Data Viewer should evolve toward this page rather than remaining beneath the POS interface.

### Navigation Principle

The intended top-level mental model is:

```text
POS
    Sell and operate the current business day

PROCUREMENT
    Bring inventory into the store

LEDGERS
    Review history, analytics, and reconcile
```

Avoid introducing additional top-level pages unless a future requirement clearly justifies the navigation cost.

## Business-Day Operation

Daily revenue tracking and reconciliation are separate concerns.

The normal operating flow is:

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

Closing the business day should preserve a historical daily summary.

Expected information includes:

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

Daily revenue tracking is part of normal store operation and should occur independently of physical reconciliation.

## Reconciliation

Physical reconciliation does not have to occur every day.

Cash and inventory reconciliation may be performed later according to the store's operating practice, such as:

- weekly;
- fortnightly;
- monthly; or
- another explicitly selected period.

Reconciliation belongs under the Ledgers area rather than being a separate top-level page.

### Cash Reconciliation

The business-day closing provides the expected cash position based on recorded transactions.

A later reconciliation process can compare expected cash against an actual physical cash count.

Any discrepancy should be recorded rather than silently changing historical sales or daily closing records.

### Inventory Reconciliation

Inventory should not normally require a manually entered start-of-day quantity.

Expected inventory should carry forward from the authoritative inventory movement history.

Conceptually:

```text
Previous Inventory
+ Restocks
- Sales
+/- Adjustments
= Expected Inventory
```

A physical inventory count can later compare:

```text
Expected Inventory
vs.
Physical Inventory
```

Any accepted discrepancy should create an auditable inventory adjustment rather than silently replacing the inventory balance.

## Local Data Layer

The current design uses a browser-side local database for offline persistence.

The implementation has been discussed around IndexedDB.

The local database should contain the operational records required to continue selling even while disconnected from the internet.

### Design Principle

Do not make Google Sheets the runtime database for an offline sale.

A network outage must not prevent the local POS from recording a valid transaction.

## Inventory Model

Inventory should be traceable through **inventory movements** rather than relying only on a manually editable stock number.

Examples of movements include:

- restock / stock-in;
- sale / stock-out;
- correction or adjustment;
- void;
- refund where applicable;
- other explicitly defined inventory events.

This makes inventory changes auditable and easier to debug.

Any cached or derived current-stock value must not silently replace the movement history as the audit trail.

## Cloud Synchronization

Google Sheets is intended to receive synchronized data when connectivity becomes available.

Google Apps Script can serve as the integration layer between the PWA and Google Sheets.

The synchronization design should eventually support:

- records created while offline;
- retry after failed synchronization;
- prevention of duplicate uploads;
- identification of synchronization status;
- safe handling of partial failures.

The exact synchronization protocol must be documented before production use.

## Hosting

The frontend should use a low-cost or free static hosting option compatible with a PWA.

GitHub-based hosting has been considered because the repository already lives in GitHub.

The chosen production URL must support HTTPS because PWA features such as service workers require a secure context.

## Deployment Philosophy

Development and deployment should support a tablet-first developer workflow:

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
Deployment
```

## Version Control

GitHub is the permanent source of truth.

Every meaningful working change should be committed with a descriptive commit message.

Recommended pattern:

```text
Add product search
Add restocking transaction
Fix duplicate inventory movement
Add sync status indicator
```

Avoid vague commit messages such as:

```text
update
changes
fix
```

## Change Safety

For cross-file or architectural changes:

1. inspect the existing implementation;
2. identify affected files;
3. explain the proposed change;
4. make the smallest practical change;
5. test;
6. commit only after the feature is working;
7. update repository documentation if architecture or business rules changed.

## Current Architecture Status

Confirmed direction:

- offline-first PWA;
- local browser persistence;
- GitHub as source of truth;
- Google Sheets as synchronization/reporting destination;
- Google Apps Script as a likely synchronization/backend bridge;
- one dedicated POS tablet;
- remote deployment and maintenance;
- three top-level application pages: POS, Procurement, and Ledgers;
- start-of-day cash management within the POS workflow;
- end-of-day revenue tracking within the POS workflow;
- periodic rather than mandatory daily reconciliation;
- cash and inventory reconciliation within the Ledgers area;
- inventory history based on auditable movements rather than daily manual opening balances.

Items that still require implementation-level verification or design:

- business-day / daily-closing database schema;
- sales transaction schema;
- payment-method model;
- cash reconciliation schema;
- inventory reconciliation schema;
- exact local sync queue design;
- exact conflict-resolution policy;
- production hosting provider;
- authentication and authorization requirements;
- backup and recovery procedure.
