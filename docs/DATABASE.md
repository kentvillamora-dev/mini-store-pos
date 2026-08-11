# Mini Store POS — Database Notes

## Purpose

This document defines the intended data model and protects the project from accidental changes to important data relationships.

The **actual application schema remains authoritative**. Whenever this document and the code disagree, inspect the current schema before editing either one.

## Core Data Concepts

The application currently revolves around these conceptual entities:

### Product

Represents an item that can be sold.

Typical information may include:

- unique product identifier;
- product name;
- selling price;
- optional cost information;
- active/inactive status;
- other product metadata required by the application.

Exact field names must be verified against the current source code.

### Sale

Represents a completed store sale or sales transaction.

A sale should have a stable unique identifier and a timestamp.

If a transaction contains multiple products, the implementation must preserve enough detail to reconstruct what was sold and in what quantity.

### Restocking / Procurement

Represents stock added to the store.

The record should preserve enough information to understand:

- which product was acquired;
- quantity acquired;
- cost information where applicable;
- when the restocking occurred.

Supplier-related fields should only be added if they are actually required by the current product scope.

### Inventory Movement

Represents a stock-changing event.

The inventory movement ledger is important because it creates an auditable history of why inventory changed.

Conceptual movement types may include:

```text
RESTOCK
SALE
ADJUSTMENT
```

Additional types should be introduced only when there is a clear business need.

## Inventory Integrity Rule

Current inventory should be explainable from transaction history.

Conceptually:

```text
Opening Quantity
+ Stock In
- Stock Out
+/- Valid Adjustments
= Expected Current Quantity
```

A manually editable stock value must not become an unexplained alternative source of truth.

If the implementation uses a cached current-stock field for performance, it should remain reconcilable with the inventory movement history.

## Identifiers

Every record that may later synchronize to Google Sheets should have a stable unique identifier generated locally.

This is important because transactions may be created while offline.

A server-generated identifier cannot be required before a local sale can be saved.

## Timestamps

Important business events should preserve timestamps.

Where possible, distinguish between concepts such as:

- when the business event happened;
- when the local record was created;
- when the record was synchronized.

Do not overwrite the original transaction time merely because synchronization happened later.

## Synchronization Metadata

Records intended for cloud synchronization may eventually require metadata such as:

```text
syncStatus
syncedAt
lastSyncAttempt
```

Exact implementation should be decided as part of the sync design.

A robust design should make it possible to determine whether a record is:

```text
LOCAL_ONLY
PENDING
SYNCED
FAILED
```

These are conceptual states, not mandatory field names.

## Duplicate Prevention

Synchronization must be idempotent.

If the tablet retries the same upload because it did not receive a response, the cloud side should not create a duplicate sale or inventory movement.

Stable record IDs should be used to detect repeated submissions.

## Deletion

Business transaction history should not be casually hard-deleted.

For important records such as sales, procurement, and inventory movements, corrections should preferably remain auditable.

The exact correction/void strategy still needs to be finalized.

## Schema Change Rule

Before changing the database schema:

1. inspect the current schema implementation;
2. identify all code that reads or writes the affected data;
3. determine whether existing stored data needs migration;
4. define backward-compatibility behavior;
5. test with existing data;
6. document the decision.

An AI assistant must not casually rename or remove persisted fields simply because a different design looks cleaner.

## Items Requiring Verification From Current Code

The following should be filled in from the repository rather than guessed:

- exact object store/table names;
- exact primary keys;
- indexes;
- current product fields;
- current sale structure;
- current restocking structure;
- inventory movement fields;
- existing schema version;
- migration logic.
