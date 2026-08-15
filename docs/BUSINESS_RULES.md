# Mini Store POS — Business Rules

## Purpose

This file contains business behavior that must remain stable even when the code is refactored.

AI assistants should read this file before changing business logic.

## BR-001 — Offline Sales Must Be Possible

The POS must continue to record valid local sales when internet connectivity is unavailable. Loss of connection to Google Sheets or Google Apps Script must not make the core POS unusable.

## BR-002 — Inventory Changes Must Be Traceable

Stock-changing events should create or correspond to an auditable inventory movement. The system must be able to explain why the expected inventory quantity changed.

## BR-003 — Sale Reduces Inventory

A valid completed sale reduces inventory for the products and quantities sold. The implementation must avoid creating the same stock deduction more than once for the same transaction.

## BR-004 — Restocking Increases Inventory

A valid restocking/procurement transaction increases inventory by the accepted quantity. The restocking event should preserve the underlying transaction details rather than only modifying a stock counter.

## BR-005 — Synchronization Must Not Duplicate Transactions

Retrying synchronization must not create duplicate cloud records. Local stable IDs should be used to identify previously synchronized transactions.

## BR-006 — Original Business Time Must Be Preserved

A transaction created offline must retain its actual business-event timestamp. The later synchronization time must not replace the original transaction time.

## BR-007 — Existing Business Data Must Be Protected

Refactoring code must not silently delete, reset, or reinterpret existing sales, inventory, procurement, business-day, or reconciliation records. Any schema migration that affects persisted data must be explicitly planned and tested.

## BR-008 — Single POS Device Assumption

The initial system is designed around one dedicated store tablet. Do not introduce multi-device synchronization complexity unless the project scope explicitly changes.

## BR-009 — Zero/Low Operating Cost Is a Design Constraint

Prefer free-tier or no-recurring-cost infrastructure when it can meet the required reliability and security. Correctness and recoverability should not be sacrificed merely to preserve a technically zero hosting bill.

## BR-010 — Simplicity Is a Feature

The application is for a small family-operated store. Avoid adding enterprise-level workflows that make routine selling or restocking harder without a clear business benefit. Top-level navigation should remain limited to POS, Procurement, and Ledgers unless a future requirement clearly justifies another page.

## BR-011 — A Business Day Has an Explicit Opening Cash Amount

The POS workflow should allow the store to open a business day with a recorded opening cash amount. The opening cash amount represents the physical cash available at the beginning of that business day and is not sales revenue.

## BR-012 — Daily Revenue Must Be Preserved

Closing a business day should create a durable daily closing or revenue summary. The exact schema may evolve, but daily revenue history must remain auditable.

## BR-013 — Daily Closing Must Not Replace Individual Sales

A daily closing record is a summary of business activity. Individual sale transactions remain the transaction-level source of truth and must not be deleted, collapsed, or replaced by the daily summary.

## BR-014 — Revenue Tracking and Reconciliation Are Separate Processes

Closing the business day and preserving daily revenue must not depend on completing a physical cash or inventory reconciliation at the same time.

## BR-015 — Reconciliation May Be Periodic

Cash and inventory reconciliation may be performed weekly, fortnightly, monthly, or another explicitly selected period. Reconciliation management belongs under the Ledgers area.

## BR-016 — Cash Reconciliation Must Preserve Discrepancies

Cash reconciliation should compare expected cash against an actual physical cash count. A discrepancy must be recorded and must not silently rewrite historical sales or daily closing records.

## BR-017 — Inventory Carries Forward Through Movements

Expected inventory carries forward through the inventory movement history.

```text
Previous Inventory
+ Restocks
- Sales
+/- Adjustments
= Expected Inventory
```

The movement ledger remains the audit trail even when a cached current-stock value is maintained.

## BR-018 — Inventory Reconciliation Must Be Auditable

If a physical count differs from expected inventory, an accepted correction should create an auditable inventory adjustment rather than silently replacing the expected stock balance.

## BR-019 — Procurement Must Preserve Cost History

A procurement transaction should preserve the supplier, product, procurement date, quantity, total cost, calculated unit cost, suggested SRP, validity status, and other relevant details. Recording a new procurement must not erase historical cost information.

## BR-020 — Selling-Price Changes Must Be Traceable

A suggested selling price does not automatically become the active selling price. When the active selling price changes, the system should preserve an auditable Price History record.

## BR-021 — Supplier Names Must Not Be Duplicated

Supplier names should be compared after trimming surrounding whitespace and without treating letter case as significant. Duplicate prevention belongs in the supplier service/business layer.

## BR-022 — Referenced Suppliers Must Not Be Deleted

A Supplier may be deleted only when it is not referenced by Procurement history. Once referenced, it must be preserved so historical Procurement records remain interpretable.

## BR-023 — Supplier Changes Must Be Reflected Across Operational Views

Supplier changes made through Ledgers should be reflected in the Procurement supplier selector during the same running application session without requiring an app reload.

## BR-024 — PWA Updates Must Not Force-Refresh an Active Session

A newer PWA version must not silently force-refresh an actively running POS session.

`Later` defers the update for the current running session; a waiting update may activate naturally after the application is fully closed and relaunched.

Persisted IndexedDB business records must survive application-shell updates.

Automatic update detection may coexist with an explicit manual `Check for Update` control.

The manual check must only request an update check; it must not automatically apply/reload the update.

## BR-025 — New Procurements Must Be Complete

A new Procurement may not be saved unless these required fields are present:

```text
Supplier
Product
Procurement Date
Quantity
Procurement Cost
```

Quantity and Procurement Cost must both be greater than zero.

## BR-026 — Potential Duplicate Procurements Must Require Deliberate Confirmation

Before saving a Procurement, check for a potential duplicate using:

```text
same Procurement Date
same Supplier
same Product
same Total Cost
```

A match must not automatically block the transaction because two legitimate procurements may share those values. The user must be warned and given an explicit opportunity to cancel or deliberately save the second transaction.

## BR-027 — Procurement Records Must Not Be Hard-Deleted

Once recorded as a business transaction, a Procurement should remain in the ledger. If later determined invalid, it should be voided rather than hard-deleted. The original Procurement and original RESTOCK inventory movement must remain available for audit.

## BR-028 — Procurement Status Is VALID or VOID

A Procurement has one of two validity states:

```text
VALID
VOID
```

## BR-029 — Voiding a Procurement Must Reverse Inventory Transparently

Voiding a valid Procurement must atomically:

1. preserve the original Procurement;
2. preserve the original RESTOCK Inventory Movement;
3. create a new `VOID` Inventory Movement with the opposite quantity effect;
4. reduce the Product's cached current stock by the Procurement quantity;
5. record `voidedAt`;
6. record a non-blank `voidReason`;
7. change status from `VALID` to `VOID`.

## BR-030 — A Procurement Cannot Be Voided Twice

A Procurement already marked `VOID` must reject another void operation. The ledger should no longer offer the Void action for an already-voided record.

## BR-031 — Procurement Void Must Not Produce Negative Cached Stock

The application must reject a Procurement void when subtracting the Procurement quantity would make `currentStockCache` negative.

## BR-032 — Procurement Void Reason Must Be Visible

The Ledgers page should display the reason associated with a voided Procurement. A valid Procurement should display no void reason.

## BR-033 — Product Names Must Not Be Duplicated

Product names should be compared after trimming surrounding whitespace and without treating letter case as significant.

Duplicate prevention belongs in the Product service/business layer.

Examples treated as duplicates:

```text
Milo
milo
 MILO
```

## BR-034 — Creating a Product Does Not Create Stock

Adding a Product establishes that the item exists in the product master.

A newly created Product begins with:

```text
currentStockCache = 0
sellingPrice = 0
active = true
```

Product creation alone must not create an Inventory Movement.

Stock enters the system only through a stock-changing business event such as Procurement.

## BR-035 — Procurement Is the Primary Operational Area for Product Setup and Pricing

The Procurement page is the operational workspace for:

```text
Restock Product
Add Product
Add Supplier
Set Price
```

Restock Product should be presented first because it is the primary expected user task.

Add Product and Add Supplier are supporting setup actions used when required records do not yet exist.

`Set Price` is intended for future implementation after Product creation is fully established.

Ledgers remain primarily record-keeping/audit views.

## Rules Still Requiring Confirmation

The following remain unconfirmed:

- tax treatment, if any;
- monetary rounding rules beyond the current suggested-SRP rule;
- whether negative stock is allowed for sales or other transaction types;
- supported payment methods;
- whether split payments are allowed;
- whether completed sales can be voided;
- refund workflow;
- exact expected-cash formula;
- exact business-day closing schema;
- whether a business day can be reopened after closing;
- whether more than one business-day session may exist for the same calendar date;
- reconciliation approval/authorization rules;
- default reconciliation frequency;
- how non-procurement inventory adjustments are authorized;
- broader supplier requirements beyond current uniqueness and deletion rules;
- SKU/barcode rules;
- synchronization conflict policy;
- how Procurement voids synchronize to cloud storage;
- external-customer release-consent and critical-update governance.

Do not invent these values. Verify them from code, agreed specification, or explicit business decision.
