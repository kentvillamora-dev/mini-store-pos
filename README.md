# Mini Store POS

An offline-first Progressive Web App (PWA) for a small family-operated mini-store.

The project is designed around a **single dedicated Android tablet** used as the store's POS device. Core store operations must continue working even when internet connectivity is unavailable. Operational data is persisted locally in the browser and is intended to synchronize to Google Sheets when connectivity becomes available.

## Project Goals

The system is being built to provide a simple, reliable POS suitable for a very small store while keeping infrastructure and operating costs low.

Key design goals include:

- offline-first operation;
- uninterrupted local sales during internet outages;
- persistent local data using IndexedDB/Dexie;
- auditable inventory movements;
- procurement and historical cost tracking;
- simple tablet-friendly workflows;
- synchronization to Google Sheets through a Google Apps Script integration layer;
- remote deployment and maintenance;
- minimal recurring infrastructure cost.

## Technology Direction

The current application uses or is designed around:

- React;
- TypeScript;
- Vite;
- Progressive Web App (PWA) capabilities;
- IndexedDB with Dexie.js for local persistence;
- GitHub for source control and project history;
- GitHub Codespaces for browser-based development;
- Google Apps Script and Google Sheets for planned cloud synchronization/reporting.

The repository code is the authoritative record of what is actually implemented. Planned architecture should not be mistaken for completed functionality.

## Project Documentation

Permanent project documentation is stored under [`docs/`](docs/):

- [`PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — product purpose, environment, scope, and constraints.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — technical architecture and system-design principles.
- [`DATABASE.md`](docs/DATABASE.md) — data-model principles, persistence, migrations, and integrity rules.
- [`BUSINESS_RULES.md`](docs/BUSINESS_RULES.md) — business behavior that must remain stable during implementation and refactoring.
- [`AI_HANDOFF.md`](docs/AI_HANDOFF.md) — permanent operating protocol for AI/LLM assistants working on the repository.

Development-continuity records are stored separately under:

```text
docs/checkpoints/
```

Checkpoint documents record verified progress, current implementation state, known problems, and the exact point from which development should resume.

## Source-of-Truth Hierarchy

When determining the current project state, use this priority order:

1. Current repository code
2. Permanent repository documentation
3. Latest applicable checkpoint
4. Git history
5. AI conversation history

An AI assistant should never reconstruct the current codebase solely from conversation memory or historical code snippets.

## Starting a New LLM Development Session

The repository is structured so that development can continue across different AI assistants or new chat sessions without depending on previous conversation memory.

Before starting a new session, ensure the AI assistant has access to this GitHub repository. Then use the following reusable prompt.

### Session Grounding Prompt

```text
We are continuing development of my Mini-Store POS project.

Repository: kentvillamora-dev/mini-store-pos

Before giving me development instructions or proposing any code changes, ground yourself in the current GitHub repository.

Please follow this startup procedure:

1. Read docs/AI_HANDOFF.md and follow its instructions.
2. Read the permanent project documentation referenced by AI_HANDOFF.md.
3. Inspect docs/checkpoints/ and identify the latest applicable development checkpoint.
4. Read that checkpoint completely to determine:
   - what has been completed;
   - what has been verified working;
   - known issues or errors;
   - where development stopped; and
   - the exact next action.
5. Inspect the actual current source files relevant to that next action.
6. Reconcile the checkpoint against the live code. The repository code is authoritative if there is a discrepancy.
7. Do not reconstruct source code from conversation memory or historical checkpoint snippets.
8. Do not make any code changes yet.

After completing the review, give me a concise Session Grounding Report containing:

- latest checkpoint identified;
- current development state;
- current build/error state, if documented;
- relevant source files you inspected;
- any discrepancy between the checkpoint and current code;
- exact next action specified by the checkpoint; and
- whether you believe it is safe to resume development.

Wait for my confirmation before proceeding with the next development step.
```

This prompt is intentionally independent of the current tutorial step or feature. Current development state belongs in the checkpoint documents, allowing this same startup prompt to remain reusable as the project evolves.

## AI-Assisted Development Workflow

The intended continuity workflow is:

```text
New LLM session
      |
      v
Read AI_HANDOFF.md
      |
      v
Read permanent documentation
      |
      v
Identify latest checkpoint
      |
      v
Inspect actual relevant source code
      |
      v
Reconcile checkpoint with repository
      |
      v
Session Grounding Report
      |
      v
User confirms continuation
      |
      v
Small development step
      |
      v
Build / test / verify
```

When ending a meaningful development session, follow the checkpoint procedure defined in [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md). A future AI assistant should be able to continue the project without access to previous AI conversations.

## Development Philosophy

This project favors:

- small, understandable development steps;
- preservation of existing persisted data;
- explicit database migrations;
- visible and auditable business records;
- testing before treating work as complete;
- descriptive Git commits;
- documentation of permanent decisions;
- checkpoints for development continuity;
- repository-grounded AI assistance rather than reliance on model memory.

Avoid unnecessary architectural complexity. The system is intended for a small family-operated store, so reliability and simplicity take priority over enterprise features that do not serve a clear business need.
