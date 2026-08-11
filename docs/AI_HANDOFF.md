# Mini Store POS — AI Handoff

## Purpose

This is the short session-start file for any AI assistant working on the repository.

It should describe the **current state**, not the complete history of the project.

Keep this file concise.

---

## Project

Offline-first mini-store POS for a family-operated store.

Primary runtime:

- dedicated Android tablet;
- browser/PWA;
- intermittent internet expected.

Primary development workflow:

- Samsung tablet;
- GitHub Codespaces;
- GitHub repository.

## Source of Truth

Priority order:

1. current repository code;
2. repository documentation;
3. Git history;
4. AI conversation history.

Never assume an earlier AI conversation reflects the current codebase.

## Current Architecture

- Offline-first PWA.
- Local browser database for operational data.
- Inventory changes should be traceable through inventory movements.
- Google Sheets is intended as a synchronized cloud/reporting destination.
- Google Apps Script is the planned/likely bridge for synchronization.
- GitHub is the source of truth.

## AI Instructions

Before making changes:

1. Read:
   - `PROJECT_CONTEXT.md`
   - `ARCHITECTURE.md`
   - `DATABASE.md`
   - `BUSINESS_RULES.md`
2. Inspect the files directly related to the requested task.
3. Explain how the current implementation works.
4. Identify the files that would need modification.
5. Point out any risk to stored data or existing behavior.
6. Make the smallest practical change.
7. Do not redesign unrelated areas.
8. Test before considering the task complete.

## Current Task

Update this section at the beginning of each development session.

```text
Current task:
[Describe one concrete task.]
```

## Last Completed Work

```text
[Replace with the most recent meaningful completed feature/fix.]
```

## Known Issues

```text
[Record known bugs or write "None known".]
```

## Files Currently Relevant

```text
[List only the important files for the current task.]
```

## Expected Behavior

```text
[What should happen when the current task is complete?]
```

## Current Failure / Error

If debugging:

```text
Expected:
Actual:
Error:
Steps to reproduce:
Last known working commit:
Files changed since:
```

## Session-End Checklist

Before ending an AI-assisted development session:

- [ ] Application was tested.
- [ ] Working changes were committed.
- [ ] Commit message describes the actual change.
- [ ] Architectural changes were added to `ARCHITECTURE.md`.
- [ ] Schema changes were added to `DATABASE.md`.
- [ ] New or changed business rules were added to `BUSINESS_RULES.md`.
- [ ] This handoff file was updated for the next session.

## Handoff Rule

The next AI should not be asked to continue from another model's explanation alone.

It should verify the current repository state itself.
