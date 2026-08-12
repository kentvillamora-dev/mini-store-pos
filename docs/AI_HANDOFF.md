# Mini Store POS — AI Handoff Protocol

## Purpose

This document provides permanent instructions for any AI/LLM assistant working on the Mini Store POS repository.

This file is **not a development-progress log** and should not be updated after every development session.

Its purpose is to define:

* how an AI assistant should orient itself when entering the project;
* which sources of information are authoritative;
* how previous development progress should be recovered;
* how the current codebase should be verified;
* how development sessions should be continued safely;
* how development instructions should be presented to the user; and
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

Defines how an AI assistant should work with this repository, how development instructions should be presented, and how development continuity should be maintained.

---

# 3. Checkpoint Documents

Checkpoint documents are the project's chronological development-continuity records.

They answer:

> What has actually happened during development, where did development stop, and what should happen next?

Checkpoint documents should be stored under:

```text
docs/checkpoints/
```

Recommended filename format:

```text
checkpoint-YYYY-MM-DD-step-XXX.md
```

If numbered tutorial steps are not useful, use a descriptive suffix.

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

Do not reconstruct them from the checkpoint, an earlier AI response, conversation memory, or historical snippets.

## Step 5 — Reconcile checkpoint and code

Verify that the current repository is consistent with the checkpoint.

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

# 6. Tutorial and Code-Editing Instruction Format

The user is learning development by building this project. Instructions must support both **correct implementation** and **practical learning**, without slowing the build with theory that is not materially useful to the Mini Store POS.

The tutorial must be explicit enough that a new intern with basic programming knowledge, but no prior knowledge of this repository, Codespaces workflow, or application, can follow it safely.

## A. Localized Code Changes

When a change affects a specific function, code block, component section, or other localized area **without materially restructuring the entire file**, provide a focused snippet.

Use this structure:

```text
Short description of the update:
[One concise description.]

Reason why we need to update:
[Why the change is required.]

Code section to update:
[file] >> [function/component] >> [branch/section] >> [exact anchor]
```

Then identify an exact existing anchor:

```text
Look for:

[existing code block]
```

Then state the placement explicitly:

```text
Immediately after the closing </label>, insert:
```

or:

```text
Replace the entire block above with:
```

or:

```text
Immediately before [exact anchor], insert:
```

Then provide the exact code.

After the code, include:

```text
Details on what the new code does:
[Explain the practical behavior and why this exact location is appropriate.]
```

### Required location specificity

The hierarchy must be explicit enough to navigate without guessing.

Good example:

```text
src/App.tsx >> function App() >> renderCurrentPage()
>> inside the branch if (currentPage === 'procurement')
>> inside Restock Product section
```

Then:

```text
Look for:

<label>
  Quantity
  ...
</label>

Immediately after the </label> block, insert:
```

Avoid directions such as:

```text
Update Restock Product.
```

or:

```text
Add this somewhere in App.tsx.
```

### Localized Edit Rules

For localized edits:

1. Explain why the code needs to be added, removed, or modified.
2. Explain what the snippet is supposed to do.
3. Modify only one function or tightly related code area at a time where practical.
4. Give a clear file, function/component, branch/section, and anchor reference.
5. Include an exact `Look for:` code block whenever an existing anchor is available.
6. State precisely whether the new code goes before, after, inside, or replaces the anchor.
7. Explain why the change belongs in that exact location when placement matters.
8. Preserve surrounding working code unless it must change.
9. Do not provide unrelated cleanup or refactoring in the same tutorial step.
10. Warn when an intermediate edit is expected to create a temporary compiler warning that the immediately following step will resolve.

## B. Architectural or Whole-File Code Changes

When an edit materially changes the architecture or overall structure of a source file, provide the **complete updated source file** instead of forcing the user to assemble many dependent snippets.

Examples include:

* restructuring a single-screen application into multiple top-level pages;
* substantially reorganizing a component;
* replacing an implementation pattern across most of a file;
* changes where isolated snippets create unnecessary placement risk.

Before providing the complete file:

1. explain why whole-file replacement is safer;
2. identify the file being replaced;
3. summarize the important architectural changes;
4. preserve unrelated working behavior; and
5. state exactly how to verify the replacement.

## C. Documentation Artifact Changes

Documentation is not a code-learning exercise.

When a permanent Markdown document or checkpoint needs substantial updating, provide the **entire updated document as a downloadable `.md` artifact**.

Examples:

```text
docs/AI_HANDOFF.md
docs/ARCHITECTURE.md
docs/BUSINESS_RULES.md
docs/DATABASE.md
docs/PROJECT_CONTEXT.md
docs/checkpoints/*.md
```

Avoid wrapping an entire Markdown document inside a chat code fence when a downloadable artifact can be provided.

## D. Mandatory Verification Instructions

Never assume the user knows how to verify that a change works.

Every meaningful implementation step must include a **How to verify the update** section.

That section must state, as applicable:

1. which file(s) must be saved;
2. whether the development server must be running;
3. the exact terminal command to run, such as `npm run dev` or `npm run build`;
4. how to open the Codespaces forwarded URL when dev testing is required;
5. which top-level page/tab to open;
6. what controls to interact with;
7. exact sample values to enter when useful;
8. the expected visible result;
9. whether database/ledger records should or should not be created;
10. which existing behavior should be regression-tested;
11. what error/output to send back if the expected behavior does not occur.

Do not write only:

```text
Confirm that it works.
```

Instead, provide executable instructions such as:

```text
1. Save src/App.tsx.
2. Run npm run dev if the dev server is not already running.
3. Open the forwarded Vite URL.
4. Select Procurement.
5. Enter Quantity = 0.
6. Expected: "Quantity must be greater than zero."
7. Clear the field.
8. Expected: the warning disappears.
```

Use `npm run build` at meaningful checkpoints, especially before commits and before connecting UI actions to persistent database writes.

## E. Teaching Depth

Explain concepts that materially help the user build, debug, maintain, or reason about this POS.

Useful teaching includes why state is stored in a component, why transactions are atomic, why IDs are stored instead of names, why validation happens before writes, and how changes affect offline persistence.

Avoid theoretical detours that do not affect the implementation or maintenance decision.

The standard is:

> Teach enough to make the implementation understandable and maintainable, while keeping development moving.

---

# 7. Creating a Checkpoint

Create a checkpoint when development needs to stop and sufficient work has occurred that another AI session should not have to reconstruct the state manually.

A checkpoint should answer:

> Could another competent AI assistant read this checkpoint, inspect the repository, and know exactly where to continue without relying on the previous conversation?

If not, the checkpoint is incomplete.

---

# 8. Required Checkpoint Structure

Every checkpoint should contain approximately:

## A. Checkpoint Header

```text
Checkpoint date:
Repository:
Branch:
Development/tutorial step:
Resume point:
Last verified commit:
```

## B. Instructions for the Next AI

Session-specific safety instructions only.

## C. Verified Working State

Distinguish `implemented` from `verified working`.

## D. Current Architecture or Schema Relevant to the Task

Only what is needed to understand the active work.

## E. Important Decisions Made

Record decisions that future assistants could accidentally reverse.

## F. Files Relevant to Current Work

List the important files, not the whole repository.

## G. Current Implementation State

Document what exists now.

Checkpoint code is historical reference only; inspect live source before modifying it.

## H. Current Errors / Known Issues

Record compiler/runtime issues and whether they are expected or unexpected.

## I. Changes Proposed but NOT Applied

Label clearly:

```text
PROPOSED — NOT APPLIED
```

## J. Not Yet Implemented

List related functionality that could otherwise be mistaken as complete.

## K. Exact Next Action

One concrete first action.

## L. Subsequent Roadmap

Optional next few steps.

## M. Final Resume Marker

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

---

# 9. Checkpoint Accuracy Rules

A checkpoint must distinguish:

### Confirmed
Actually implemented, observed, built, or tested.

### Intended
Agreed but not necessarily implemented.

### Proposed
Suggested for a future step.

### Unknown / Requires Verification
Not established from repository or testing.

Never convert an assumption into a confirmed fact.

---

# 10. Permanent Documentation vs. Checkpoints

Update `PROJECT_CONTEXT.md` when product purpose, environment, scope, or major constraints change.

Update `ARCHITECTURE.md` when technical architecture or major component responsibilities change.

Update `DATABASE.md` when persistent data design, schema principles, migration strategy, or integrity rules change.

Update `BUSINESS_RULES.md` when business behavior or calculations change.

Update `AI_HANDOFF.md` when rules governing how AI assistants work, teach, verify changes, or present development instructions change.

Create a new checkpoint when development progress needs to be preserved for another session.

If a session establishes a new permanent rule, update the appropriate permanent document **and** record it in the checkpoint.

---

# 11. Session-End Procedure

When ending a meaningful development session:

1. Stop at a clearly identifiable point.
2. Build/test the current implementation where practical.
3. Resolve accidental compiler errors.
4. Verify which functionality actually works.
5. Commit working source-code changes.
6. Update permanent documentation if stable project rules changed.
7. Create a new checkpoint.
8. Record repository/commit state when available.
9. Clearly identify anything unfinished.
10. End the checkpoint with one exact `NEXT ACTION`.
11. Commit the checkpoint and documentation to the repository.

Do not claim uncommitted or untested work is complete.

---

# 12. Core Continuity Principle

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

A future AI assistant should be able to continue development with **zero access to previous AI conversations**.
