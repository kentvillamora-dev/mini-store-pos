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

The frontend is a browser-based Progressive Web App (PWA).

Primary responsibilities:

- POS user interface;
- product lookup;
- sales entry;
- restocking entry;
- local validation;
- offline operation;
- viewing stored records;
- triggering or displaying synchronization state.

The UI should remain simple because the application is used on a dedicated tablet.

## Local Data Layer

The current design uses a browser-side local database for offline persistence.

The implementation has been discussed around IndexedDB.

The local database should contain the operational records required to continue selling even while disconnected from the internet.

### Design principle

Do not make Google Sheets the runtime database for an offline sale.

A network outage must not prevent the local POS from recording a valid transaction.

## Inventory Model

Inventory should be traceable through **inventory movements** rather than relying only on a manually editable stock number.

Examples of movements include:

- restock / stock-in;
- sale / stock-out;
- correction or adjustment;
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
- remote deployment and maintenance.

Items that still require implementation-level verification:

- exact local database schema;
- exact sync queue design;
- exact conflict-resolution policy;
- production hosting provider;
- authentication requirements;
- backup and recovery procedure.
