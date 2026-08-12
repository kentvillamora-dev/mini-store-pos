# Mini Store POS — Development Checkpoint

## A. Checkpoint Header

```text
Checkpoint date: 2026-08-11
Repository: kentvillamora-dev/mini-store-pos
Branch: main
Development/tutorial step: Step 103 / Procurement Form + PWA Update Safety
Last verified commit: b7de74b54dd78c4504bca8875aa1e0598bf92a87
Last verified commit message: Add user-controlled PWA update prompt
Resume point: Immediately before performing the controlled production test of the manual PWA update lifecycle.
```

## B. Instructions for the Next AI

Read `docs/AI_HANDOFF.md` and follow its tutorial/editing format exactly.

Before proposing code changes:

1. re-read permanent docs;
2. inspect this checkpoint completely;
3. inspect live source files;
4. treat repository code as authoritative.

Important current safety instructions:

- Do not reset IndexedDB.
- Do not assume a successful PWA build proves update behavior.
- The next action is a production service-worker lifecycle test, not more procurement code.
- Do not connect the procurement form to `createProcurement()` until the update-lifecycle test is finished and the current state is preserved.
- Do not auto-update the PWA. Update detection may be automatic; activation must be user-controlled.
- When checkout/cart becomes a real active transaction, update activation should be blocked/disabled while a transaction is in progress.

## C. Verified Working State

### Repository / build

Confirmed:

- Branch `main` was synchronized with `origin/main` before this checkpoint request.
- Latest verified commit on GitHub is `b7de74b...` — `Add user-controlled PWA update prompt`.
- Production build succeeded after adding PWA React type declarations.
- Vite/PWA generation succeeds.
- Production GitHub Pages deployment succeeded.
- Production PWA displays the current three-page UI and procurement calculations.

### Three-page application structure

Verified in development and visible in production:

- POS tab/page;
- Procurement tab/page;
- Ledgers tab/page;
- active navigation styling;
- Ledgers/Data Viewer no longer sits below POS.

### Ledgers

Verified:

- Products;
- Suppliers;
- Procurements;
- Price History;
- Inventory Movements.

Price History is loaded and rendered in the Data Viewer.

### Supplier workflow

Verified in development:

- supplier creation;
- blank supplier-name validation;
- supplier persistence in IndexedDB;
- new supplier appears in the Suppliers ledger;
- supplier list refreshes immediately after creation;
- newly created supplier appears in the procurement supplier dropdown without browser reload;
- selected supplier ID is stored in React state.

### Procurement form — current verified UI

Verified in development:

- Supplier dropdown;
- Product dropdown;
- Procurement Date input;
- Quantity input;
- visible Quantity validation for `0` or negative values;
- Procurement Cost input;
- visible Procurement Cost validation for `0` or negative values;
- automatic Unit Cost calculation;
- automatic Suggested SRP calculation using the existing pricing utility.

Example verified behavior:

```text
Quantity: 10
Procurement Cost: 100

Unit Cost: ₱10.00
Suggested SRP: ₱13.00
```

Low-cost SRP behavior was also tested through the form.

### Procurement service

Previously implemented and build-verified:

`createProcurement()` performs one Dexie transaction that:

1. creates a procurement record;
2. creates a linked `RESTOCK` inventory movement;
3. increases `product.currentStockCache`.

This service is **not yet connected to a Save Procurement button in the current form**.

### PWA update implementation

Implemented:

- `workbox-window` development dependency;
- `VitePWA({ registerType: 'prompt' })`;
- `src/vite-env.d.ts` with Vite and PWA React type references;
- `src/features/pwa/UpdatePrompt.tsx`;
- `UpdatePrompt` mounted at application root;
- update notification styling;
- `Apply Update` action calls `updateServiceWorker(true)`;
- `Later` dismisses the current visible prompt.

Verified:

- TypeScript initially reported `TS2307` for `virtual:pwa-register/react`.
- Creating `src/vite-env.d.ts` resolved that compiler error.
- Production build then succeeded.
- New update-prompt implementation deployed successfully to GitHub Pages.
- The production PWA now displays the previously developed three-tab UI and procurement calculation features.

NOT YET VERIFIED:

- that an already-running Version A detects deployed Version B;
- that Version A does not automatically reload;
- that `Later` allows Version A to continue;
- that `Apply Update` activates/reloads Version B;
- that existing IndexedDB Products/Suppliers remain intact after activation.

## D. Current Architecture / Schema Relevant to the Task

### Application navigation

```text
POS
Procurement
Ledgers
```

### PWA update architecture

```text
New deployment
      |
      v
Service worker detects newer build
      |
      v
needRefresh = true
      |
      v
UpdatePrompt displayed
      |
      +------------------+
      |                  |
      v                  v
Later              Apply Update
      |                  |
current app        updateServiceWorker(true)
continues                 |
                          v
                     activate + reload
```

The intended policy is **detect automatically, apply manually**.

### Database

Active IndexedDB/Dexie database remains `miniStorePOS`, Version 3.

Relevant tables:

```text
products
inventoryMovements
suppliers
procurements
priceHistory
```

No database migration was required for the PWA update work.

## E. Important Decisions Made

### UI/navigation

Top-level pages remain limited to:

1. POS
2. Procurement
3. Ledgers

### Daily operation

- Start-of-day cash belongs in POS.
- End-of-day revenue/daily closing belongs in POS.
- Reconciliation can occur weekly, fortnightly, monthly, or another chosen period.
- Cash and inventory reconciliation belong in Ledgers.
- Inventory normally carries forward from movement history rather than being manually re-entered each morning.

### Procurement

- Supplier is optional at the service/schema level.
- Procurement Cost represents total procurement cost.
- Unit Cost is derived from `totalCost / quantity`.
- Suggested SRP is derived rather than manually entered.
- Existing pricing utility is `calculateSuggestedSellingPrice`.
- Current formula remains `Math.floor(unitCost * 1.25) + 1`.
- Suggested SRP does not automatically change active `sellingPrice`.
- Recording an actual selling-price change must later be auditable through Price History.

### PWA update safety

Permanent direction:

- New versions may be detected automatically.
- New versions must not force-refresh the active POS merely because they exist.
- The user explicitly chooses when to apply an update.
- Update application should occur when no active transaction can be interrupted.
- When a real cart/checkout transaction exists, `Apply Update` should eventually be disabled or blocked while the transaction is active.
- Application-shell updates must preserve IndexedDB business records.

### Tutorial / AI instruction style

Localized code edits must use:

```text
Short description of the update
Reason why we need to update
Code section to update: file >> function >> branch/section >> exact anchor
Look for: [exact existing code]
Precise placement instruction
Exact replacement/insertion code
Details on what the code does and why it belongs there
How to verify the update
```

Verification instructions must assume no prior knowledge of Codespaces or this repository.

Architectural whole-file changes should use complete source files.

Documentation changes should use complete downloadable Markdown artifacts.

## F. Files Relevant to Current Work

```text
src/App.tsx
src/features/pwa/UpdatePrompt.tsx
src/vite-env.d.ts
src/index.css
vite.config.ts
package.json
package-lock.json

src/services/procurementService.ts
src/services/supplierService.ts
src/utils/pricing.ts
src/db/database.ts
src/features/dataViewer/DataViewer.tsx

docs/AI_HANDOFF.md
docs/ARCHITECTURE.md
docs/BUSINESS_RULES.md
```

## G. Current Implementation State

### `src/App.tsx`

Currently contains:

- product and supplier loading;
- three-page navigation state;
- supplier creation state/handler;
- supplier selection;
- product selection;
- procurement date;
- quantity;
- procurement cost;
- quantity/cost UI validation;
- derived Unit Cost;
- derived Suggested SRP;
- `UpdatePrompt` mounted above navigation.

There is **no Save Procurement action yet**.

### `src/features/pwa/UpdatePrompt.tsx`

Uses:

```text
useRegisterSW()
needRefresh
setNeedRefresh
updateServiceWorker
```

Behavior currently implemented:

```text
needRefresh false -> render nothing
needRefresh true  -> show notice + Apply Update + Later
Apply Update      -> updateServiceWorker(true)
Later             -> setNeedRefresh(false)
```

### `vite.config.ts`

Contains explicit:

```text
registerType: 'prompt'
```

### `src/vite-env.d.ts`

Contains type references for:

```text
vite/client
vite-plugin-pwa/react
```

## H. Current Errors / Known Issues

### Blocking compiler errors

None currently documented.

The previous error:

```text
TS2307
Cannot find module 'virtual:pwa-register/react'
or its corresponding type declarations.
```

was resolved by creating `src/vite-env.d.ts`.

### Known unverified behavior

The PWA manual update lifecycle has **not yet been production-tested end-to-end**.

The current production deployment proves only that the new update code builds and deploys.

### Potential future safeguard

`Apply Update` is not yet programmatically disabled during an active transaction because real checkout/cart transaction state does not yet exist.

## I. Changes Proposed but NOT Applied

### PROPOSED — NOT APPLIED

A harmless visible production change was proposed for the update test, for example:

```text
Procurement
```

temporarily changed to:

```text
Procurement — Update Test
```

This change had **not been applied at the checkpoint stop point**.

### PROPOSED — NOT APPLIED

Block or disable PWA update activation whenever a real checkout transaction/cart is active.

Do not implement this until the cart/transaction model can provide a reliable active-transaction signal.

## J. Not Yet Implemented

- controlled production PWA update-lifecycle verification;
- Save Procurement button/handler;
- connection of current procurement form to `createProcurement()`;
- first real UI-created procurement transaction;
- post-submit refresh of relevant UI/ledger state;
- UI workflow for accepting/changing active selling price;
- Price History writes from real price changes;
- sales transaction tables and checkout;
- business-day opening cash;
- end-of-day closing/revenue records;
- cash reconciliation;
- inventory reconciliation;
- synchronization queue / Google Sheets synchronization.

## K. Exact Next Action

**NEXT ACTION:**

Perform the controlled production PWA update test.

1. Keep the current production PWA/version open.
2. Make one harmless visible source change such as changing the Procurement heading to `Procurement — Update Test`.
3. Run `npm run build`.
4. Commit and push the harmless test change.
5. Confirm the new GitHub Pages deployment succeeds.
6. Return to the already-running older PWA while online.
7. Verify that it detects the new version without silently force-reloading.
8. Test `Later`.
9. Re-trigger/show the update prompt if needed and test `Apply Update`.
10. Confirm the new visible heading appears only after activation.
11. Confirm existing IndexedDB Products and Suppliers survive the update.

Do not proceed to procurement submission until this behavior is documented as either verified or requiring a specific fix.

## L. Subsequent Roadmap

After the update lifecycle is verified:

1. Revert the temporary update-test heading.
2. Build, commit, push, and if useful verify the revert via the same manual update path.
3. Update documentation/checkpoint with actual observed PWA behavior.
4. Connect the procurement form to `createProcurement()`.
5. Create the first real procurement through the UI.
6. Verify Procurement + RESTOCK movement + stock-cache increase in Ledgers.

## M. Final Resume Marker

```text
FINAL RESUME MARKER

Build status:
PASS — latest PWA implementation built successfully.

Database/schema version:
Dexie Version 3.

Last verified feature:
Production deployment of user-controlled PWA update-prompt implementation;
Procurement form through Unit Cost and Suggested SRP preview.

Current unfinished work:
Manual production verification of the PWA update lifecycle.

Known blocking error:
None.

Known unverified behavior:
Need to verify detect-update -> Later -> Apply Update -> IndexedDB preserved.

Relevant files:
vite.config.ts
src/features/pwa/UpdatePrompt.tsx
src/vite-env.d.ts
src/App.tsx
src/index.css

NEXT ACTION:
Perform the controlled production manual-update lifecycle test before resuming procurement submission work.
```
