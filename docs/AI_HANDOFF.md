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

If they disagree, stop before modifying the affected area, identify the discrepancy, inspect Git history when useful, explain it to the user, and establish the actual current state.

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

The user is learning development by building this project. Development instructions must therefore support both **correct implementation** and **practical learning**, without slowing the build with theory that is not materially useful to the Mini Store POS.

The instruction format depends on the size and nature of the change.

## A. Localized Code Changes

When a change affects a specific function, code block, component section, or other localized area **without materially restructuring the entire file**, provide the edit as a focused snippet.

Use this structure:

```text
Short description of the update:
[One concise description of what is changing.]

Reason why we need to update:
[Explain why this change is necessary for the current feature, fix, or requirement.]

Code section to Update:
[file name] >> [function/component name] >> [exact anchor or section identifier]

[Exact code that the user needs to add, replace, or remove.]

Details on what the new code does:
[Explain what the code does and why it is being added or modified in that exact location.]
```

The location reference must be specific enough that a beginner can find the edit without guessing.

Good examples:

```text
src/App.tsx >> function App() >> state declarations immediately after supplierMessage
```

```text
src/App.tsx >> renderCurrentPage() >> Procurement branch >> Restock Product section >> Supplier <select>
```

```text
src/services/procurementService.ts >> createProcurement() >> validation block before the Dexie transaction
```

Avoid vague directions such as:

```text
Update the Restock Product section.
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
4. Give a clear file, function/component, and anchor/section reference.
5. Explain why the change belongs in that exact location when placement matters.
6. Preserve surrounding working code unless it must change.
7. Do not provide unrelated cleanup or refactoring in the same tutorial step.
8. Warn the user when an intermediate edit is expected to create a temporary TypeScript/compiler warning that will be resolved by the immediately following step.

The purpose is not merely to provide code. The user should understand the practical role of the code being added while continuing to make visible progress on the application.

## B. Architectural or Whole-File Code Changes

When an edit materially changes the architecture or overall structure of a source file, prefer providing the **complete updated source file** rather than a long sequence of interdependent snippets.

Examples include:

* restructuring a single-screen application into multiple top-level pages;
* substantially reorganizing a component;
* replacing an implementation pattern across most of a file;
* changes where applying isolated snippets would create unnecessary risk of misplaced code or inconsistent intermediate states.

Before providing the complete file:

1. explain why the change is large enough to justify whole-file replacement;
2. identify the file being replaced;
3. summarize the important architectural changes;
4. preserve unrelated working behavior; and
5. tell the user what to test after replacement.

Do not use whole-file replacement merely because it is easier for the AI. Use it when it is safer and clearer for the user.

## C. Documentation Artifact Changes

Documentation is not a code-learning exercise.

When a permanent Markdown document or checkpoint needs substantial updating, provide the **entire updated document as a downloadable `.md` artifact** rather than asking the user to apply multiple section-level snippets.

Examples include:

```text
docs/AI_HANDOFF.md
docs/ARCHITECTURE.md
docs/BUSINESS_RULES.md
docs/DATABASE.md
docs/PROJECT_CONTEXT.md
docs/checkpoints/*.md
```

The downloadable document should be complete and ready to replace or add to the repository.

Avoid wrapping an entire Markdown document inside a chat code fence when a downloadable artifact can be provided, because nested code fences can break formatting and make copying unreliable.

If only a trivial documentation correction is required and the user specifically prefers a small edit, a localized instruction may be used.

## D. Teaching Depth

Explanations should focus on concepts that materially help the user build, debug, maintain, or reason about this POS application.

Useful teaching includes:

* why state is stored in a particular component;
* why a database transaction is atomic;
* why an ID is stored instead of a display name;
* why validation occurs before a database write;
* why a specific table or service owns a piece of data;
* how a code change affects offline behavior or persisted records.

Avoid unnecessary theoretical detours that do not affect the implementation decision or the user's ability to maintain the project.

The standard is:

> Teach enough to make the implementation understandable and maintainable, while keeping development moving.

---

# 7. Creating a Checkpoint

Create a checkpoint when development needs to stop and sufficient work has occurred that another AI session should not have to reconstruct the development state manually.

A checkpoint should optimize for this question:

> Could another competent AI assistant read this checkpoint, inspect the repository, and know exactly where to continue without relying on the previous conversation?

If the answer is no, the checkpoint is incomplete.

---

# 8. Required Checkpoint Structure

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

---

## B. Instructions for the Next AI

Briefly record any session-specific instructions necessary to continue safely.

Do not duplicate all permanent rules from `AI_HANDOFF.md`.

---

## C. Verified Working State

Document what has actually been confirmed working.

Distinguish clearly between implemented and verified working.

---

## D. Current Architecture or Schema Relevant to the Task

Record only architecture/schema information needed to understand the current development area.

Do not duplicate the entire permanent architecture documentation.

---

## E. Important Decisions Made

Record decisions that future AI assistants could otherwise accidentally reverse.

Permanent decisions should eventually also be reflected in the appropriate permanent document.

---

## F. Files Relevant to Current Work

List the important files involved in the current development area.

Do not list the entire repository.

---

## G. Current Implementation State

Explain what has already been implemented in the feature currently under development.

Code inside a checkpoint is historical reference only. The next AI must inspect the actual repository file before modifying it.

---

## H. Current Errors / Known Issues

Record compiler errors, runtime errors, known bugs, or unfinished behavior.

For compiler diagnostics, preserve the error code, message, relevant file, and known reason.

---

## I. Changes Proposed but NOT Applied

If a change was discussed or drafted but not implemented, label it clearly:

```text
PROPOSED — NOT APPLIED
```

Never describe proposed code as completed work.

---

## J. Not Yet Implemented

List significant related functionality that might otherwise be mistaken for completed work.

---

## K. Exact Next Action

Finish every checkpoint with one clear next action.

The next AI should be able to identify the first development action without interpreting a long narrative.

---

## L. Subsequent Roadmap

After the exact next action, optionally record the next few intended steps.

This section provides direction but does not override the exact next action.

---

## M. Final Resume Marker

End the checkpoint with a compact machine-readable-style summary:

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

---

# 10. Permanent Documentation vs. Checkpoints

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

the rules governing how AI assistants should work on the repository, teach the user, or present development changes are modified.

### Create a new checkpoint when:

development progress needs to be preserved for another session.

Do not use checkpoints as replacements for permanent documentation.

If a development session establishes a new permanent rule, update the appropriate permanent document **and** record the decision in the checkpoint.

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
8. Record the current repository/commit state when available.
9. Clearly identify anything unfinished.
10. End the checkpoint with one exact `NEXT ACTION`.
11. Commit the checkpoint to the repository.

Do not create a checkpoint that claims uncommitted or untested work is complete.

---

# 12. Core Continuity Principle

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
