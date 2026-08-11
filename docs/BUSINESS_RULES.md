# Mini Store POS — Business Rules

## Purpose

This file contains business behavior that must remain stable even when the code is refactored.

AI assistants should read this file before changing business logic.

## BR-001 — Offline Sales Must Be Possible

The POS must continue to record valid local sales when internet connectivity is unavailable.

Loss of connection to Google Sheets or Google Apps Script must not make the core POS unusable.

## BR-002 — Inventory Changes Must Be Traceable

Stock-changing events should create or correspond to an auditable inventory movement.

The system must be able to explain why the expected inventory quantity changed.

## BR-003 — Sale Reduces Inventory

A valid completed sale reduces inventory for the products and quantities sold.

The implementation must avoid creating the same stock deduction more than once for the same transaction.

## BR-004 — Restocking Increases Inventory

A valid restocking/procurement transaction increases inventory by the accepted quantity.

The restocking event should preserve the underlying transaction details rather than only modifying a stock counter.

## BR-005 — Synchronization Must Not Duplicate Transactions

Retrying synchronization must not create duplicate cloud records.

Local stable IDs should be used to identify previously synchronized transactions.

## BR-006 — Original Business Time Must Be Preserved

A transaction created offline must retain its actual business-event timestamp.

The later synchronization time must not replace the original transaction time.

## BR-007 — Existing Business Data Must Be Protected

Refactoring code must not silently delete, reset, or reinterpret existing sales, inventory, procurement, business-day, or reconciliation records.

Any schema migration that affects persisted data must be explicitly planned and tested.

## BR-008 — Single POS Device Assumption

The initial system is designed around one dedicated store tablet.

Do not introduce multi-device synchronization complexity unless the project scope explicitly changes.

This assumption should be reconsidered before adding a second active POS device.

## BR-009 — Zero/Low Operating Cost Is a Design Constraint

Prefer free-tier or no-recurring-cost infrastructure when it can meet the required reliability and security.

However, correctness and recoverability should not be sacrificed merely to preserve a technically zero hosting bill.

## BR-010 — Simplicity Is a Feature

The application is for a small family-operated store.

Avoid adding enterprise-level workflows that make routine selling or restocking harder without a clear business benefit.

Top-level navigation should remain limited to POS, Procurement, and Ledgers unless a future requirement clearly justifies another page.

## BR-011 — A Business Day Has an Explicit Opening Cash Amount

The POS workflow should allow the store to open a business day with a recorded opening cash amount.

The opening cash amount represents the physical cash available at the beginning of that business day and is not sales revenue.

Start-of-day cash management belongs to the POS operating workflow rather than requiring a separate top-level page.

## BR-012 — Daily Revenue Must Be Preserved

Closing a business day should create a durable daily closing or revenue summary.

The daily closing should preserve the information needed to understand that business day's recorded financial activity, including the business date, opening cash, recorded sales, relevant refunds or voids, expected closing cash, and closing timestamp where applicable.

The exact schema may evolve, but daily revenue history must remain auditable.

## BR-013 — Daily Closing Must Not Replace Individual Sales

A daily closing record is a summary of business activity.

Individual sale transactions remain the transaction-level source of truth and must not be deleted, collapsed, or replaced by the daily summary.

Daily totals should be explainable from their underlying transaction records.

## BR-014 — Revenue Tracking and Reconciliation Are Separate Processes

Closing the business day and preserving daily revenue must not depend on completing a physical cash or inventory reconciliation at the same time.

The store may close and preserve daily revenue even when reconciliation will occur later.

## BR-015 — Reconciliation May Be Periodic

Cash and inventory reconciliation may be performed according to the store's chosen operating schedule rather than being mandatory every day.

Examples include weekly, fortnightly, monthly, or another explicitly selected period.

The system should preserve enough transaction and closing history to reconcile the selected period later.

Reconciliation management belongs under the Ledgers area.

## BR-016 — Cash Reconciliation Must Preserve Discrepancies

Cash reconciliation should compare the system's expected cash position against an actual physical cash count.

A discrepancy must be recorded and explained where possible.

Reconciliation must not silently rewrite historical sales or daily closing records merely to force expected and actual cash to match.

## BR-017 — Inventory Carries Forward Through Movements

The store should not normally be required to manually enter opening inventory every business day.

Expected inventory carries forward through the inventory movement history.

Conceptually:

```text
Previous Inventory
+ Restocks
- Sales
+/- Adjustments
= Expected Inventory
```

The movement ledger remains the audit trail even when a cached current-stock value is maintained for performance or convenience.

## BR-018 — Inventory Reconciliation Must Be Auditable

A physical inventory count may be compared with expected inventory during reconciliation.

If a discrepancy is accepted, the correction should create an auditable inventory adjustment rather than silently replacing the expected stock balance.

The system should preserve enough information to determine what quantity was expected, what quantity was physically counted, the resulting difference, and the adjustment that was authorized.

## BR-019 — Procurement Must Preserve Cost History

A procurement transaction should preserve the quantity purchased, total cost, calculated unit cost, and other relevant procurement details.

Recording a new procurement must not erase the historical cost information from earlier procurements.

## BR-020 — Selling-Price Changes Must Be Traceable

Procurement cost changes may produce a suggested selling price, but the suggested price does not automatically become the active selling price unless the approved workflow explicitly applies it.

When the active selling price changes, the system should preserve an auditable price-history record containing the previous price, new price, and relevant reason or procurement reference where applicable.

## Rules Still Requiring Confirmation

The following should be copied from the current technical specification, implementation, or an explicit business decision before being treated as authoritative:

- exact suggested retail price (SRP) formula;
- tax treatment, if any;
- monetary rounding rules;
- whether negative stock is allowed;
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
- how inventory adjustments are authorized;
- supplier requirements;
- SKU/barcode rules;
- synchronization conflict policy.

Do not invent these values. Verify them from the code, agreed project specification, or an explicit business decision.
