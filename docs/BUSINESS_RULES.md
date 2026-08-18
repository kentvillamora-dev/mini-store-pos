# Mini Store POS --- Business Rules

## Purpose
Stable business behavior that must survive refactoring.

## Core
- Offline Sales must work.
- Stock-changing events must be traceable.
- Existing business data must not be silently deleted or reinterpreted.
- MVP assumes one dedicated POS tablet.
- Low/no recurring operating cost is a design constraint.
- Top-level navigation remains POS, Procurement, Ledgers unless scope clearly requires otherwise.

## Shared Product Category Navigation
### BR-CAT-001 — Operational Category Order Is Explicit
Product Category navigation across operational workflows follows this order:

1. Snacks
2. Beverages
3. Milk and Coffee
4. Cooking Essentials
5. Canned Goods
6. Instant Noodles
7. Household Cleaning
8. Personal Care
9. Cigarettes
10. Miscellaneous

This is an operational navigation rule based on demand and relational sequence, not alphabetical Category order.

### BR-CAT-002 — Products Remain Alphabetical Within Category
Where a workflow displays Products grouped by Category, Products should be sorted alphabetically within their Category unless a future workflow explicitly establishes a different product-prioritization rule.

## Business Day / EOD
### BR-EOD-001 — EOD Is Optional
Daily Opening & Closing is disabled by default.

### BR-EOD-002 — Setting Persists
The EOD setting persists locally.

### BR-EOD-003 — One Open Day
Only one Business Day may be OPEN at a time.

### BR-EOD-004 — Opening Cash Required
Opening Cash is required when opening a Business Day and may be zero. It is not revenue.

### BR-EOD-005 — Open Day Required for Sales
When EOD is enabled, Sale completion requires an OPEN Business Day.

### BR-EOD-006 — Disabled EOD Preserves Normal Sales
When EOD is disabled, Sales do not require a Business Day.

### BR-EOD-007 — Cannot Disable an Open Day
EOD cannot be disabled while a Business Day remains OPEN.

### BR-EOD-008 — Actual Closing Cash Required
Closing requires Actual Closing Cash; zero is valid.

### BR-EOD-009 — Closing Note Optional
A Business Day may close without a note.

### BR-EOD-010 — Cash and GCash Stay Separate
GCash contributes to revenue but not physical drawer cash.

### BR-EOD-011 — Expected Cash Formula
Expected Closing Cash = Opening Cash + Cash Sales - Cash Refunds.

### BR-EOD-012 — Net Sales Formula
Net Sales = Cash Sales + GCash Sales - Cash Refunds - GCash Refunds.

### BR-EOD-013 — Variance Is Preserved
Cash Variance = Actual Closing Cash - Expected Closing Cash. Non-zero variance is recorded rather than rewriting Sales or automatically blocking closure.

### BR-EOD-014 — Void Protects Closed Days
With EOD enabled, a Sale may be voided only while its original Business Day remains OPEN.

### BR-EOD-015 — Refund Belongs to Processing Day
With EOD enabled, a Refund is associated with the currently OPEN Business Day.

### BR-EOD-016 — Closed Days Are Audit Records
Closed Business Days must not be silently overwritten or reopened merely to remove discrepancies.

## Inventory Reconciliation
### BR-REC-001 — Partial Reconciliation Is Valid
A reconciliation includes only the Products actually selected and physically counted. The user is not required to count the entire inventory.

### BR-REC-002 — Draft Counts Are Not Business Events
Selecting Products, entering physical counts, editing counts, removing Products, searching, and reviewing the draft do not change persisted inventory and do not create reconciliation records.

### BR-REC-003 — Counting Does Not Lock POS
Physical inventory counting may be interrupted by normal store activity. The POS and inventory are not locked while a draft count is being prepared.

### BR-REC-004 — Current Persisted Stock Is Authoritative at Confirmation
The confirmed variance is based on the Product's current persisted stock, not on a stale quantity captured when physical counting began.

### BR-REC-005 — Physical Count Can Be Corrected Before Confirmation
The user may edit a draft physical count during Review to account for operational events discovered after the Product was counted. This edit is not itself a reconciliation event.

### BR-REC-006 — Zero Is a Valid Physical Count
Physical quantity must be a whole number zero or greater. Zero means the Product was counted and none were physically present.

### BR-REC-007 — Every Counted Product Is Recorded
Every Product included in a confirmed reconciliation receives a permanent reconciliation-item record, including Products whose variance is zero.

### BR-REC-008 — Only Non-Zero Variance Adjusts Stock
A zero-variance item creates no ADJUSTMENT movement and does not rewrite stock. A non-zero variance creates an ADJUSTMENT movement and updates `currentStockCache` to the confirmed physical quantity.

### BR-REC-009 — Variance Formula
`Variance = Physical Quantity - Current Persisted Stock`.

### BR-REC-010 — Reason Required, Note Optional
A confirmed reconciliation requires a reconciliation-level Reason. Note remains optional.

### BR-REC-011 — Reconciliation Commit Is Atomic
The reconciliation header, all counted-item records, required ADJUSTMENT movements, and Product stock-cache changes must succeed or fail together.

### BR-REC-012 — Duplicate Products Are Not Allowed
A Product may appear only once within one reconciliation event.

### BR-REC-013 — Only Active Products May Be Reconciled
Confirmation must reject a Product that no longer exists or is inactive.

### BR-REC-014 — Product Selection Must Scale Operationally
The reconciliation selector supports search, shared Category ordering, alphabetical Products within Category, multi-select, category-level selection/clearing, and explicit completion of selection. Product selection collapses after Done Selecting while existing selections remain available when reopened.

## Procurement
### BR-PROC-001 — Procurement Is Multi-Item
A Procurement is one header with one or more Product items and preserves Supplier, date, status, item, cost, and pricing history.

### BR-PROC-002 — Draft Changes Are Not Business Events
Searching, selecting a Product, entering/editing Quantity or Total Cost, adding/updating/removing draft items, and editing draft Final Price do not change inventory or create Procurement records until Save Procurement succeeds.

### BR-PROC-003 — Procurement Entry Is Receipt-Line Driven
The normal Procurement workflow processes supplier receipts one Product line at a time. The Product list supports Quick Search, Category grouping using the shared operational Category order, and alphabetical Products within Category.

### BR-PROC-004 — Quantity and Cost Are Entered Inline
Selecting a Product exposes Quantity and Total Cost entry directly below that Product. Quantity must be a whole number greater than zero and Total Cost must be greater than zero before the line can be added to the draft.

### BR-PROC-005 — Added Product Lines Become the Review
After Add/Update, the Product line appears immediately in the Procurement Review table. A separate Review stage/button is not required.

### BR-PROC-006 — Draft Product Lines May Be Edited or Removed
Before Save Procurement, an existing draft Product may be reopened to update Quantity/Total Cost or removed entirely without changing Product master data or persisted inventory.

### BR-PROC-007 — Duplicate Draft Product Lines Are Avoided
Selecting a Product already present in the draft edits/updates that existing line rather than creating a second line for the same Product.

### BR-PROC-008 — Procurement Review Shows Pricing Context
The live Procurement Review displays Unit Cost, Current Price, Recommended Price, and Final Price for each draft Product. `Current Price` refers to the Product's current persisted retail/selling price.

### BR-PROC-009 — Final Price Uses Explicit Edit Mode
Final Price is not permanently presented as an open text field. The user explicitly chooses Edit to expose a numeric field, then Save or Cancel. Save Procurement must not proceed while a Final Price edit remains unfinished.

### BR-PROC-010 — Suggested SRP Is Advisory
Suggested SRP is advisory; existing retail price is the default Final Price. Actual selling-price changes create Price History.

### BR-PROC-011 — Procurement Save Is Atomic
Procurement header/items, RESTOCK movements, Product stock-cache changes, and applicable Price History must succeed or fail together.

### BR-PROC-012 — Invalid Procurements Are Voided, Not Deleted
A committed invalid Procurement is voided rather than hard-deleted. Void is atomic, cannot occur twice, cannot produce negative stock, and requires a visible reason.

### BR-PROC-013 — Procurement Void Does Not Rewind Selling Price
Voiding a Procurement does not automatically rewind a Product's selling price.

### BR-PROC-014 — Duplicate Guardrails Remain
Supplier and Product duplicate guardrails remain in force.

## Product Master Data
### BR-PROD-001 — Category Selection Uses Existing Active Categories
Product creation assigns an existing active Category ID; the Category-selection UI may optimize repeated entry without changing Product identity or Category persistence.

### BR-PROD-002 — Repeated Same-Category Entry May Retain Selection
After successful Product creation, Product Name may clear while the selected Category remains selected so multiple Products in the same Category can be entered efficiently.

### BR-PROD-003 — Product Creation Uses Shared Category Order
The Add Product Category radio tiles follow the shared operational Category order.

## PWA
Updates must not force-refresh an active session; IndexedDB records survive shell updates.

## Sales
- Cash is default; GCash is a marker without gateway integration.
- Split payment is not implemented.
- Cart stock reservation is display-only until Sale completion.
- Categorized and Uncategorized Product cards use the same Cart-adjusted displayed-stock calculation.
- Cart quantity cannot exceed available persisted stock.
- Cash tender must cover the Sale total.
- Sale save and final stock revalidation are atomic/coherent.
- Sales are not hard-deleted.
- Status is VALID, VOID, or REFUNDED.
- Void and Refund have distinct meanings.
- Void/Refund requires a reason, restores stock transparently, is atomic, and cannot occur twice.
- Operational Ledger prioritizes Sales, Procurements, Products, Suppliers and supports compact collapse/expand.
- On tablet/desktop POS layouts, the Cart remains visible/sticky while the Product catalog is scrolled; narrow/mobile stacked layout may use normal document flow.

## Still Requiring Confirmation
- tax treatment;
- rounding beyond current Suggested-SRP behavior;
- non-reconciliation Adjustment authorization;
- SKU/barcode rules;
- sync conflict policy;
- cloud representation of Business Days, reversals, and Inventory Reconciliations;
- external-customer release/critical-update governance.
