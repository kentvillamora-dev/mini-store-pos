# Mini Store POS — Project Context

## Purpose

Build a low-cost, offline-first Point of Sale (POS) web application for a small family-operated mini-store in the Davao Region.

The system is intended to replace or reduce manual store processes while keeping ongoing operating costs as close to zero as practical.

## Primary Operating Environment

- The store is family-operated and has no regular staff.
- The POS runs on one dedicated Android tablet.
- The selected POS device is an HONOR Pad X8a-class tablet configuration discussed for the project.
- The system should behave like an installed app on the tablet.
- A receipt printer is not part of the initial scope.
- Internet connectivity may be intermittent.
- Core selling and inventory functions must remain usable while offline.
- Data should synchronize to Google Sheets when internet connectivity becomes available.
- The developer must be able to deploy fixes and updates remotely.

## Development Environment

The developer primarily works from a Samsung tablet using browser-based tools.

Preferred development tools:

- GitHub
- GitHub Codespaces
- Browser-based AI tools
- Google Apps Script
- Google AI Studio / Gemini
- ChatGPT
- Claude when useful

No workflow should depend on a permanently available local desktop development environment.

## Product Direction

The POS is intended to be:

- simple enough for a small family store;
- reliable during internet interruptions;
- maintainable by a solo developer;
- inexpensive to host and operate;
- suitable for remote updates;
- structured well enough that the project can later grow without requiring a complete rewrite.

## Core Architectural Principle

The repository is the source of truth for the project.

AI assistants must not rely on conversation memory when repository code or repository documentation is available.

If repository documentation conflicts with current code, the current implementation must be inspected and the inconsistency documented before making further changes.

## Current High-Level Scope

The project currently centers on:

- product management;
- inventory tracking;
- restocking / procurement;
- sales transactions;
- inventory movements;
- local offline storage;
- eventual synchronization to Google Sheets;
- a browser-based PWA user interface.

## Out of Scope for Initial Release

Unless explicitly added later:

- receipt printing;
- multi-branch operation;
- multiple simultaneous POS terminals;
- enterprise accounting;
- employee scheduling;
- complex user-role administration.

## AI Development Rule

Before implementing a feature, an AI assistant should:

1. Read this file.
2. Read `ARCHITECTURE.md`.
3. Read `DATABASE.md`.
4. Read `BUSINESS_RULES.md`.
5. Read `AI_HANDOFF.md`.
6. Inspect the actual files related to the task.
7. Explain the current implementation before proposing changes.

The repository always takes precedence over remembered conversation context.
