# Mini Store POS --- Business Rules

## Purpose

This file contains business behavior that must remain stable even when the code is refactored.

AI assistants should read this file before changing business logic.

## Core Rules

### BR-001 --- Offline Sales Must Be Possible
Valid local Sales must work without internet connectivity.

### BR-002 --- Inventory Changes Must Be Traceable
Stock-changing business events must create auditable Inventory Movements.

### BR-003 --- Sale Reduces Inventory
A completed VALID Sale reduces inventory exactly once for the quantities sold.

### BR-004 --- Restocking Increases Inventory
A VALID Procurement increases inventory while preserving its header and Product-line details.

### BR-005 --- Synchronization Must Not Duplicate Transactions
Future synchronization must be idempotent using stable local IDs.

### BR-006 --- Original Business Time Must Be Preserved
Offline transactions retain their original business/audit time after later synchronization.

### BR-007 --- Existing Business Data Must Be Protected
Refactoring/schema evolution must not silently delete or reinterpret existing business records.

### BR-008 --- Single POS Device Assumption
The MVP assumes one dedicated store tablet.

### BR-009 --- Zero/Low Operating Cost Is a Design Constraint
Prefer free/no-recurring-cost infrastructure when reliability and integrity remain acceptable.

### BR-010 --- Simplicity Is a Feature
Top-level navigation remains POS, Procurement, and Ledgers unless scope clearly requires more.

## Business Day / Reconciliation

### BR-011 --- A Business Day Has an Explicit Opening Cash Amount
Opening cash is recorded separately and is not Sales revenue.

### BR-012 --- Daily Revenue Must Be Preserved
Closing a business day should create a durable closing/revenue summary.

### BR-013 --- Daily Closing Must Not Replace Individual Sales
Individual Sales remain transaction-level truth.

### BR-014 --- Revenue Tracking and Reconciliation Are Separate
Daily closing need not require simultaneous physical reconciliation.

### BR-015 --- Reconciliation May Be Periodic
Cash/inventory reconciliation may use an explicitly selected period.

### BR-016 --- Cash Reconciliation Must Preserve Discrepancies
Discrepancies must be recorded rather than rewriting historical Sales.

### BR-017 --- Inventory Carries Forward Through Movements
Expected stock is explained by Restocks, Sales, reversals, Refunds, and Adjustments.

### BR-018 --- Inventory Reconciliation Must Be Auditable
Accepted physical-count corrections should create auditable Adjustments.

## Procurement

### BR-019 --- Procurement Must Preserve Cost History
Supplier, business date, status, Product lines, quantity, cost, Unit Cost, SRP, and pricing snapshots are preserved.

### BR-020 --- Selling-Price Changes Must Be Traceable
Suggested SRP is advisory. Actual selling-price changes create Price History.

### BR-021 --- Supplier Names Must Not Be Duplicated
Compare trimmed names case-insensitively.

### BR-022 --- Referenced Suppliers Must Not Be Deleted
Only unused Suppliers may be deleted.

### BR-023 --- Supplier Changes Must Propagate to Operational Views
Supplier changes appear in Procurement selection during the same running session.

### BR-025 --- A New Procurement Is One Header With One or More Product Items
Supplier, Procurement Date, and at least one valid Product item are required.

### BR-026 --- Potential Duplicate Procurements Require Deliberate Confirmation
The duplicate heuristic warns rather than automatically blocks.

### BR-027 --- Procurement Records Must Not Be Hard-Deleted
Invalid Procurements are voided and preserved.

### BR-028 --- Procurement Status Is VALID or VOID

### BR-029 --- Procurement Void Reverses Inventory Transparently
Void preserves original records, creates opposite VOID movements, reverses cached stock, records reason/timestamp, and is atomic.

### BR-030 --- A Procurement Cannot Be Voided Twice

### BR-031 --- Procurement Void Must Not Produce Negative Cached Stock

### BR-032 --- Procurement Void Reason Must Be Visible

### BR-033 --- Product Names Must Not Be Duplicated
Compare trimmed names case-insensitively.

### BR-034 --- Creating a Product Does Not Create Stock
New Product starts with stock 0, selling price 0, active true, and no movement.

### BR-035 --- Procurement Is the Primary Stock-Acquisition Workspace
Landing order remains New Procurement, Add Product, Add Supplier, Set Price.

### BR-036 --- Procurement Draft Must Be Reviewed Before Commit
No partial business records are created while assembling/reviewing the draft.

### BR-037 --- A Product May Appear Only Once in a Procurement

### BR-038 --- Procurement Save Must Be Atomic

### BR-039 --- Procurement Summary Must Show Pricing Context
Show Unit Cost, Previous Retail Price, Suggested SRP, and Final Price.

### BR-040 --- Existing Retail Price Is the Default Final Price
Suggested SRP must not silently overwrite it.

### BR-041 --- A New Product Requires an Explicit First Selling Price

### BR-042 --- Procurement Price Changes Must Create Price History

### BR-043 --- Procurement Void Does Not Automatically Rewind Selling Price

### BR-044 --- Internal IDs Must Not Burden End Users
Resolve IDs to readable names or omit them from operational UI.

## PWA

### BR-024 --- PWA Updates Must Not Force-Refresh an Active Session
Update application/reload remains explicit and persisted IndexedDB records survive shell updates.

## Sales and Checkout

### BR-045 --- Cash Is the Default Payment Method
New checkout defaults to Cash. The cashier should not need to change Payment Method for the normal Cash path.

### BR-046 --- GCash Is a Supported Payment Marker Without Gateway Integration
GCash may be selected for reconciliation/reporting. The MVP does not require an online payment gateway.

### BR-047 --- Split Payment Is Not Implemented
One Sale uses one supported payment method: Cash or GCash.

### BR-048 --- Cart Stock Reservation Is Display-Only Until Sale Completion
Adding/increasing Cart quantity reduces the stock displayed in POS but must not modify persisted stock until Complete Sale succeeds.

### BR-049 --- Cart Quantity Cannot Exceed Available Persisted Stock
The UI should prevent further quantity increase when displayed available stock reaches zero and show the warning near the affected item.

### BR-050 --- Cash Checkout Must Validate Tender
Cash Received must be at least the Sale total before completion. Change is calculated from tender minus total.

### BR-051 --- Cash Entry Must Be Tablet-Friendly
Manual Cash Received entry remains available, with tap-oriented controls for Exact, +₱5, +₱10, +₱20, +₱50, +₱100, +₱500, and Clear.

### BR-052 --- Sale Save Must Be Atomic
Sale header, SaleItems, SALE movements, and Product stock-cache deductions are one coherent Dexie transaction.

### BR-053 --- Final Stock Must Be Revalidated at Sale Commit
Persisted Product existence, active state, and sufficient stock must be checked immediately before Sale writes.

### BR-054 --- Completed Sales Must Not Be Hard-Deleted
Original Sale, SaleItems, and SALE movements are preserved.

### BR-055 --- Sale Status Is VALID, VOID, or REFUNDED

### BR-056 --- Void and Refund Have Different Business Meanings
Void is used when the Sale itself was entered in error. Refund is used when the original Sale was valid but is later reversed.

### BR-057 --- Sale Void/Refund Requires a Reason
A blank reason must not be accepted.

### BR-058 --- Sale Void/Refund Restores Inventory Transparently
For every SaleItem, reversal restores cached stock and creates a positive movement matching the reversal type.

### BR-059 --- Sale Reversal Must Be Atomic
Sale status/metadata, reversal movements, and stock restoration succeed or fail together.

### BR-060 --- A Sale Cannot Be Reversed Twice
Only a VALID Sale may be voided or refunded.

### BR-061 --- Operational Ledger Prioritizes Actionable Tables
Tablet Data Viewer order is Sales, Procurements, Products, Suppliers. Supporting audit tables remain persisted but need not be displayed when no user action is tied to them.

### BR-062 --- Ledger Sections Must Support Compact Navigation
Each operational table can collapse/expand. Sales is expanded by default; other operational sections are collapsed. Global Expand All/Collapse All controls are available.

## Rules Still Requiring Confirmation

- tax treatment, if any;
- monetary rounding rules beyond current Suggested-SRP behavior;
- business-day closing schema;
- exact EOD expected-cash formula;
- whether a business day can be reopened;
- whether multiple business-day sessions can exist on one calendar date;
- reconciliation approval/authorization rules;
- default reconciliation frequency;
- non-procurement inventory-adjustment authorization;
- SKU/barcode rules;
- synchronization conflict policy;
- cloud representation of Sale/Procurement reversals;
- external-customer release-consent and critical-update governance.
