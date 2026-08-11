# Mini Store POS — AI Handoff Protocol

## Purpose

This document provides permanent instructions for any AI/LLM assistant working on the Mini Store POS repository.

This file is **not a development-progress log** and should not be updated after every development session.

Its purpose is to define:

* how an AI assistant should orient itself when entering the project;
* which sources of information are authoritative;
* how previous development progress should be recovered;
* how the current codebase should be verified;
* how development sessions should be continued safely; and
* how checkpoint documents should be created for future AI sessions.

Development progress, current errors, completed steps, and the exact resume point belong in **checkpoint documents**, not in this file.

---

# 1. Source of Truth

Use the following priority order when determining the actual state of the project:

1. **Current repository code**
2. **Repository documentation**
3. **Latest checkpoint document**
4. **Git history**
5. **AI conversation history**

The current repository implementation is authoritative for what actually exists.

Repository documentation describes intended architecture, business rules, and design constraints.

Checkpoint documents describe development history, recent work, known issues, and the intended next action.

AI conversation memory must never override the repository.

If any source conflicts with the current code, inspect the implementation before making changes and explicitly identify the inconsistency.

---

# 2. Required Project Documentation

Before implementing or modifying a feature, read the permanent project documentation:

1. `PROJECT_CONTEXT.md`
2. `ARCHITECTURE.md`
3. `DATABASE.md`
4. `BUSINESS_RULES.md`
5. this `AI_HANDOFF.md`

These documents serve different purposes.

## `PROJECT_CONTEXT.md`

Defines what the project is, its operating environment, scope, constraints, and overall product direction.

## `ARCHITECTURE.md`

Defines the intended technical architecture and major system-design principles.

## `DATABASE.md`

Defines data-model principles, persistence requirements, inventory integrity rules, and schema-change safeguards.

The actual database implementation must still be verified against the source code.

## `BUSINESS_RULES.md`

Defines business behavior that must remain stable even if the implementation is refactored.

Do not modify business logic without checking this document.

## `AI_HANDOFF.md`

Defines how an AI assistant should work with this repository and how development continuity should be maintained.

---

# 3. Checkpoint Documents

Checkpoint documents are the project's chronological development-continuity records.

They answer:

> What has actually happened during development, where did development stop, and what should happen next?

Checkpoint documents may contain temporary or implementation-specific information that does not belong in the permanent project documentation.

Examples include:

* recently completed tutorial steps;
* current build status;
* schema migration results;
* test results;
* current compiler or runtime errors;
* files currently being modified;
* implementation decisions made during the session;
* unfinished functions;
* known bugs;
* proposed code that has not yet been applied;
* exact next development action.

Checkpoint documents should be stored under:

```text
docs/checkpoints/
```

Recommended filename format:

```text
checkpoint-YYYY-MM-DD-step-XXX.md
```

Example:

```text
checkpoint-2026-08-11-step-99.md
```

If development is not being tracked by numbered tutorial steps, use a short descriptive suffix instead:

```text
checkpoint-2026-08-11-procurement-service.md
```

Never overwrite an older checkpoint merely to represent newer progress.

Create a new checkpoint so development history remains chronological and auditable.

---

# 4. Starting a New AI Development Session

When entering the project in a new conversation or AI session:

## Step 1 — Read the permanent documentation

Read:

```text
docs/PROJECT_CONTEXT.md
docs/ARCHITECTURE.md
docs/DATABASE.md
docs/BUSINESS_RULES.md
docs/AI_HANDOFF.md
```

Do not begin implementation based only on conversation memory.

## Step 2 — Locate the latest checkpoint

Inspect:

```text
docs/checkpoints/
```

Identify the most recent applicable checkpoint using the checkpoint date, step number, and contents.

Do not assume that the checkpoint with the largest filename is necessarily authoritative if Git history or repository state indicates otherwise.

## Step 3 — Read the latest checkpoint completely

Determine:

* what was completed;
* what was tested;
* what remains unfinished;
* known errors or risks;
* files involved;
* exact resume point;
* intended next action.

## Step 4 — Inspect the actual source code

Open the files relevant to the current task.

Do not reconstruct them from:

* the checkpoint;
* an earlier AI response;
* conversation memory; or
* code snippets copied into historical documentation.

Checkpoint code snippets describe historical state and may no longer match the repository.

## Step 5 — Reconcile checkpoint and code

Verify that the current repository is consistent with the checkpoint.

If they agree, continue.

If they disagree:

1. stop before modifying the affected area;
2. identify the discrepancy;
3. inspect Git history when useful;
4. explain the discrepancy to the user; and
5. establish the actual current state before continuing.

## Step 6 — Continue from the smallest safe next action

Do not redesign unrelated areas.

Preserve existing working behavior and persisted data.

For tutorial development, continue incrementally and verify each meaningful step before proceeding.

---

# 5. AI Development Rules

Before changing existing code:

1. Inspect the current implementation.
2. Identify the files directly affected.
3. Explain how the relevant implementation currently works.
4. Explain the proposed change.
5. Identify risks to stored data or existing behavior.
6. Make the smallest practical change.
7. Avoid unrelated refactoring.
8. Build/test after the change.
9. Resolve new compiler errors before proceeding unless the checkpoint explicitly documents a deliberate temporary state.
10. Update permanent documentation only when the underlying architecture, database design, business rules, or AI workflow actually changes.

Never reset or recreate persisted application data merely because doing so makes development easier unless the user explicitly approves it.

Schema changes must respect the migration rules documented in `DATABASE.md`.

---

# 6. Creating a Checkpoint

Create a checkpoint when development needs to stop and sufficient work has occurred that another AI session should not have to reconstruct the development state manually.

A checkpoint should optimize for this question:

> Could another competent AI assistant read this checkpoint, inspect the repository, and know exactly where to continue without relying on the previous conversation?

If the answer is no, the checkpoint is incomplete.

---

# 7. Required Checkpoint Structure

Every checkpoint should use approximately the following structure.

## A. Checkpoint Header

Record:

```text
Checkpoint date:
Repository:
Branch:
Development/tutorial step:
Resume point:
```

If the current commit is known, also record:

```text
Last verified commit:
```

The **Resume point** should be one concise sentence identifying exactly where work stopped.

Example:

```text
Resume point:
Immediately before implementing the atomic Dexie transaction inside createProcurement().
```

---

## B. Instructions for the Next AI

Briefly record any session-specific instructions necessary to continue safely.

Do not duplicate all permanent rules from `AI_HANDOFF.md`.

Include only information especially relevant to the current development state.

Examples:

```text
Do not reset IndexedDB.

Verify the existing Version 3 schema before changing it.

Continue the tutorial one small step at a time.

Do not automatically update sellingPrice during procurement.
```

---

## C. Verified Working State

Document what has actually been confirmed working.

Use statements based on tests or observed behavior rather than assumptions.

Example:

```text
Verified:

- Production build succeeds.
- PWA works offline.
- Existing product survives database migration.
- Data Viewer displays Products and Inventory Movements.
```

Distinguish clearly between:

```text
implemented
```

and:

```text
verified working
```

They are not automatically the same.

---

## D. Current Architecture or Schema Relevant to the Task

Record only architecture/schema information needed to understand the current development area.

Do not duplicate the entire permanent architecture documentation.

When database tables or TypeScript interfaces are directly relevant, include their current verified structure.

State which schema/database version is currently active.

---

## E. Important Decisions Made

Record decisions that future AI assistants could otherwise accidentally reverse.

Examples include:

* formulas;
* validation behavior;
* naming decisions;
* data ownership;
* transaction behavior;
* rejected approaches;
* deliberately optional fields.

Where useful, explicitly record:

```text
DO NOT:
```

Example:

```text
DO NOT replace Math.floor() with Math.ceil().
```

Permanent decisions should eventually also be reflected in the appropriate permanent document, especially `BUSINESS_RULES.md`, `DATABASE.md`, or `ARCHITECTURE.md`.

---

## F. Files Relevant to Current Work

List the important files involved in the current development area.

Example:

```text
src/services/procurementService.ts
src/db/database.ts
src/utils/pricing.ts
src/features/dataViewer/DataViewer.tsx
```

Do not list the entire repository.

This section tells the next AI where source-code inspection should begin.

---

## G. Current Implementation State

Explain what has already been implemented in the feature currently under development.

When useful, include short code snippets representing the stopping point.

However:

> Code inside a checkpoint is historical reference only.

The next AI must inspect the actual repository file before modifying it.

---

## H. Current Errors / Known Issues

Record compiler errors, runtime errors, known bugs, or unfinished behavior.

Whenever possible include:

```text
Expected:
Actual:
Error:
Steps to reproduce:
Relevant file:
```

For compiler diagnostics, preserve:

* error code;
* error message;
* relevant file;
* reason the error currently exists, if known.

Distinguish between:

```text
expected because implementation is incomplete
```

and:

```text
unexpected defect requiring investigation
```

---

## I. Changes Proposed but NOT Applied

This section is especially important.

If the previous AI discussed or drafted a change that was **not actually implemented**, state that explicitly.

Use language such as:

```text
PROPOSED — NOT APPLIED
```

Never describe proposed code as completed work.

If useful, include the proposed code or algorithm so the next AI understands the intended direction.

The next AI must still verify whether the repository has changed since the checkpoint.

---

## J. Not Yet Implemented

List significant related functionality that might otherwise be mistaken for completed work.

Example:

```text
Not yet implemented:

- supplier creation UI;
- restocking form;
- price-history writes;
- sales tables;
- checkout transaction.
```

This prevents future AI assistants from assuming that planned architecture already exists.

---

## K. Exact Next Action

This is one of the most important checkpoint sections.

Finish every checkpoint with a clear next action.

Prefer one concrete action rather than a broad roadmap.

Example:

```text
NEXT ACTION:

Complete the createProcurement() Dexie transaction and immediately run:

npm run build
```

The next AI should be able to identify the first development action without interpreting a long narrative.

---

## L. Subsequent Roadmap

After the exact next action, optionally record the next few intended steps.

Example:

```text
After Step 100 succeeds:

1. Add Price History to Data Viewer.
2. Add supplier creation.
3. Build minimal restocking form.
4. Create first real procurement.
5. Verify linked inventory movement.
```

This section provides direction but does not override the exact next action.

---

## M. Final Resume Marker

End the checkpoint with a compact machine-readable-style summary.

Recommended format:

```text
FINAL RESUME MARKER

Build status:
Database/schema version:
Last verified feature:
Current unfinished work:
Known blocking error:
Relevant files:

NEXT ACTION:
[one exact action]
```

This section intentionally repeats the most important information from the checkpoint.

Its purpose is to allow an AI assistant to orient itself quickly before reading the surrounding details.

---

# 8. Checkpoint Accuracy Rules

A checkpoint must distinguish among:

### Confirmed

Something actually implemented, observed, built, or tested.

### Intended

Something agreed upon but not necessarily implemented.

### Proposed

Something suggested for a future step.

### Unknown / Requires Verification

Something the current session could not establish from the repository or testing.

Never convert an assumption into a confirmed fact merely to make the checkpoint look complete.

When uncertain, explicitly write:

```text
Requires verification from current repository.
```

---

# 9. Permanent Documentation vs. Checkpoints

Use permanent documentation for stable project knowledge.

Use checkpoints for chronological development state.

### Update `PROJECT_CONTEXT.md` when:

the product's purpose, environment, scope, or major constraints change.

### Update `ARCHITECTURE.md` when:

the technical architecture or major component responsibilities change.

### Update `DATABASE.md` when:

persistent data design, schema principles, migration strategy, or integrity rules change.

### Update `BUSINESS_RULES.md` when:

business behavior or calculations are added, removed, or changed.

### Update `AI_HANDOFF.md` when:

the rules governing how AI assistants should work on the repository change.

### Create a new checkpoint when:

development progress needs to be preserved for another session.

Do not use checkpoints as replacements for permanent documentation.

If a development session establishes a new permanent rule, update the appropriate permanent document **and** record the decision in the checkpoint.

---

# 10. Session-End Procedure

When ending a meaningful development session:

1. Stop at a clearly identifiable point.
2. Build/test the current implementation where practical.
3. Resolve accidental compiler errors.
4. Verify which functionality actually works.
5. Commit working source-code changes.
6. Update permanent documentation if stable project rules changed.
7. Create a new checkpoint.
8. Record the current repository/commit state when available.
9. Clearly identify anything unfinished.
10. End the checkpoint with one exact `NEXT ACTION`.
11. Commit the checkpoint to the repository.

Do not create a checkpoint that claims uncommitted or untested work is complete.

---

# 11. Core Continuity Principle

The continuity system for this project is:

```text
GitHub repository
        =
actual implementation and version history

Permanent /docs documentation
        =
project rules, architecture, data principles,
business rules, and AI operating protocol

Checkpoint documents
        =
chronological development state,
verified progress, problems, and resume point

AI conversation history
        =
supplementary context only
```

A future AI assistant should be able to continue development even if it has **zero access to previous AI conversations**.

That is the standard every checkpoint should aim to achieve.
