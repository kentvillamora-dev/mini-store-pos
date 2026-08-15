# Mini Store POS --- Business Rules

## Purpose

This file contains business behavior that must remain stable even when
the code is refactored.

AI assistants should read this file before changing business logic.

## BR-001 --- Offline Sales Must Be Possible

The POS must continue to record valid local sales when internet
connectivity is unavailable. Loss of connection to Google Sheets or
Google Apps Script must not make the core POS unusable.

## BR-002 --- Inventory Changes Must Be Traceable

Stock-changing events should create or correspond to an auditable
Inventory Movement.

## BR-003 --- Sale Reduces Inventory

A valid completed sale reduces inventory for the Products and quantities
sold. The same transaction must not deduct stock more than once.

## BR-004 --- Restocking Increases Inventory

A VALID Procurement increases inventory by the accepted quantities. The
underlying Procurement and Product-line details must be preserved rather
than only modifying a stock counter.

## BR-005 --- Synchronization Must Not Duplicate Transactions

Retrying synchronization must not create duplicate cloud records. Stable
local IDs should identify previously synchronized transactions.

## BR-006 --- Original Business Time Must Be Preserved

A transaction created offline must retain its actual business-event
time. Later synchronization time must not replace it.

## BR-007 --- Existing Business Data Must Be Protected

Refactoring must not silently delete, reset, or reinterpret existing
business records. Persisted-data migrations must be explicitly planned
and tested.

The pre-Version-6 development/production reset was a one-time exception
because all records were test-only. It must not be repeated once real
transactions exist.

## BR-008 --- Single POS Device Assumption

The initial system is designed around one dedicated store tablet. Do not
introduce multi-device synchronization complexity unless scope changes.

## BR-009 --- Zero/Low Operating Cost Is a Design Constraint

Prefer free-tier/no-recurring-cost infrastructure when it meets
reliability and security requirements. Do not sacrifice correctness or
recoverability merely to keep hosting technically free.

## BR-010 --- Simplicity Is a Feature

The application is for a small family-operated store. Avoid unnecessary
enterprise workflows. Top-level navigation should remain POS,
Procurement, and Ledgers unless a future requirement clearly justifies
another page.

## BR-011 --- A Business Day Has an Explicit Opening Cash Amount

The POS should allow a business day to open with recorded physical
opening cash. Opening cash is not sales revenue.

## BR-012 --- Daily Revenue Must Be Preserved

Closing a business day should create a durable daily closing/revenue
summary.

## BR-013 --- Daily Closing Must Not Replace Individual Sales

Individual Sale transactions remain the transaction-level source of
truth.

## BR-014 --- Revenue Tracking and Reconciliation Are Separate Processes

Daily closing must not depend on completing physical cash/inventory
reconciliation simultaneously.

## BR-015 --- Reconciliation May Be Periodic

Cash/inventory reconciliation may be weekly, fortnightly, monthly, or
another explicitly selected period and belongs under Ledgers.

## BR-016 --- Cash Reconciliation Must Preserve Discrepancies

A cash discrepancy must be recorded and must not silently rewrite
historical sales or closings.

## BR-017 --- Inventory Carries Forward Through Movements

``` text
Previous Inventory
+ Restocks
- Sales
+/- Adjustments
= Expected Inventory
```

Inventory Movements remain the audit trail even when `currentStockCache`
is maintained.

## BR-018 --- Inventory Reconciliation Must Be Auditable

Accepted physical-count corrections should create auditable Inventory
Adjustments.

## BR-019 --- Procurement Must Preserve Cost History

A Procurement must preserve its Supplier, business date, validity state,
and all Product lines. Each Product line must preserve Quantity, Total
Cost, calculated Unit Cost, Suggested SRP, and relevant pricing
snapshot.

New Procurement activity must not erase historical cost information.

## BR-020 --- Selling-Price Changes Must Be Traceable

Suggested SRP does not automatically become the active selling price.

When active selling price changes, an auditable Price History record
must be created.

## BR-021 --- Supplier Names Must Not Be Duplicated

Supplier names are compared after trimming whitespace and without case
significance.

## BR-022 --- Referenced Suppliers Must Not Be Deleted

A Supplier may be deleted only when not referenced by Procurement
history.

## BR-023 --- Supplier Changes Must Be Reflected Across Operational Views

Supplier changes should appear in the Procurement selector during the
same running session without requiring reload.

## BR-024 --- PWA Updates Must Not Force-Refresh an Active Session

A newer PWA must not silently force-refresh an active POS session.

`Later` defers the update for the running session. A manual
`Check for Update` may request an update check but must not
automatically apply/reload it.

Persisted IndexedDB business records must survive application-shell
updates.

## BR-025 --- A New Procurement Is One Header With One or More Product Items

A new Procurement requires:

``` text
Supplier
Procurement Date
at least one Product item
```

Each Product item requires:

``` text
Product
Quantity > 0
Total Cost > 0
```

The complete Procurement is one business event even when it contains
multiple Products.

## BR-026 --- Potential Duplicate Procurements Must Require Deliberate Confirmation

Before saving, check for a potential duplicate using the current Version
6 warning heuristic:

``` text
same Procurement Date
same Supplier
same number of item lines
same total Procurement cost
```

A match must warn rather than automatically block because legitimate
repeated purchases can occur.

## BR-027 --- Procurement Records Must Not Be Hard-Deleted

Recorded Procurements must remain in the ledger. Invalid transactions
should be voided, preserving the original header, Product items, and
RESTOCK movements.

## BR-028 --- Procurement Status Is VALID or VOID

``` text
VALID
VOID
```

## BR-029 --- Voiding a Procurement Must Reverse All Its Inventory Effects Transparently

Voiding a VALID multi-item Procurement must atomically:

1.  preserve the original Procurement;
2.  preserve all ProcurementItems;
3.  preserve original RESTOCK movements;
4.  create one opposite `VOID` Inventory Movement per ProcurementItem;
5.  reduce each affected Product's cached stock by that item's Quantity;
6.  record `voidedAt`;
7.  record a non-blank `voidReason`;
8.  change header status from `VALID` to `VOID`.

The void is an all-or-nothing operation.

## BR-030 --- A Procurement Cannot Be Voided Twice

A Procurement already marked `VOID` must reject another void and the
ledger should no longer offer the Void action.

## BR-031 --- Procurement Void Must Not Produce Negative Cached Stock

Before committing a multi-item void, every affected Product must be
checked.

If reversing any ProcurementItem would make its Product's
`currentStockCache` negative, the entire Procurement void must be
rejected.

## BR-032 --- Procurement Void Reason Must Be Visible

Ledgers should display the reason associated with a VOID Procurement.

## BR-033 --- Product Names Must Not Be Duplicated

Product names are compared after trimming whitespace and without case
significance.

Examples treated as duplicates:

``` text
Milo
milo
 MILO
```

## BR-034 --- Creating a Product Does Not Create Stock

A new Product begins with:

``` text
currentStockCache = 0
sellingPrice = 0
active = true
```

Product creation alone creates no Inventory Movement. Stock enters only
through stock-changing events such as Procurement.

## BR-035 --- Procurement Is the Primary Operational Area for Stock Acquisition and Related Setup

The Procurement landing area is:

``` text
New Procurement
Add Product
Add Supplier
Set Price
```

New Procurement is primary. Product/Supplier creation and standalone
pricing are supporting actions. Ledgers remain primarily
audit/record-keeping views.

## BR-036 --- A Procurement Draft Must Be Reviewed Before It Is Committed

Procurement entry follows:

``` text
Procurement Details
→ Add Product Items
→ Procurement Summary
→ Save Procurement
```

The draft should not create partial business records while the user is
still assembling or reviewing it.

Only final Save Procurement commits the business event.

## BR-037 --- A Product May Appear Only Once in a Procurement

The same Product must not be entered as multiple lines within one
Procurement. The user should correct the existing draft line rather than
create duplicate lines.

## BR-038 --- Procurement Save Must Be Atomic

Saving a Procurement must treat the header, Product items, stock
movements, stock-cache changes, and Procurement-linked price changes as
one coherent transaction.

A failure must not leave a partially recorded Procurement.

## BR-039 --- Procurement Summary Must Show Pricing Context

Before final save, each Product line should show:

``` text
Unit Cost
Previous Retail Price
Recommended Retail Price / Suggested SRP
Final Price
```

This allows the owner to make a deliberate pricing decision using the
latest procurement cost.

## BR-040 --- Existing Retail Price Is the Default Final Price

When a Product already has a valid active selling price, Procurement
Summary should default Final Price to that existing price.

If the user makes no price edit:

-   the Product selling price remains unchanged;
-   no Price History record is created.

Suggested SRP must not automatically overwrite it.

## BR-041 --- A New Product Requires an Explicit First Selling Price

A Product whose current selling price is zero/not set must receive an
explicit Final Price greater than zero before its Procurement can be
saved.

The application must not silently adopt Suggested SRP as the first
retail price.

## BR-042 --- Procurement Price Changes Must Create Price History

If Final Price differs from the Product's previous selling price, the
Product price must be updated and a Price History record must preserve
the change.

Where the price decision occurs during Procurement review, Price History
should retain the Procurement relationship.

## BR-043 --- Voiding Procurement Does Not Automatically Rewind Selling Price

Voiding a Procurement reverses its stock effect but must not
automatically restore a previous Product selling price or delete Price
History.

Pricing is a separately auditable business decision and later price
decisions may already exist.

## BR-044 --- Internal IDs Must Not Burden End Users

Ledgers should resolve Product/Supplier relationships to readable names
and omit UUID/reference IDs when those identifiers have no operational
meaning to the end user.

## Rules Still Requiring Confirmation

The following remain unconfirmed:

-   tax treatment, if any;
-   monetary rounding rules beyond the current Suggested-SRP rule;
-   whether negative stock is allowed for sales or other transaction
    types;
-   supported payment methods;
-   whether split payments are allowed;
-   whether completed sales can be voided;
-   refund workflow;
-   exact expected-cash formula;
-   exact business-day closing schema;
-   whether a business day can be reopened after closing;
-   whether more than one business-day session may exist for the same
    calendar date;
-   reconciliation approval/authorization rules;
-   default reconciliation frequency;
-   how non-procurement inventory adjustments are authorized;
-   broader Supplier requirements beyond current uniqueness/deletion
    rules;
-   SKU/barcode rules;
-   synchronization conflict policy;
-   how Procurement voids synchronize to cloud storage;
-   external-customer release-consent and critical-update governance.

Do not invent these values. Verify them from code, agreed specification,
or explicit business decision.
