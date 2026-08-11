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

Refactoring code must not silently delete, reset, or reinterpret existing sales, inventory, or procurement records.

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

## Rules Still Requiring Confirmation

The following should be copied from the current technical specification or implementation before being treated as authoritative:

- exact suggested retail price (SRP) formula;
- tax treatment, if any;
- rounding rules;
- whether negative stock is allowed;
- whether completed sales can be voided;
- how inventory adjustments are authorized;
- supplier requirements;
- SKU/barcode rules;
- synchronization conflict policy.

Do not invent these values. Verify them from the code or agreed project specification.
