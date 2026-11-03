# Phase 04 - React Vertical Slice

## Goal
Deliver a minimal usable end-to-end UI matching core API.

## Scope
- React login, parent child selection, create request, history/detail, teacher review and decision.
- Small design tokens and reusable Button/Input/StatusBadge/Table.
- Loading/error/empty/success states, accessible labels, responsive layouts.
- No decorative charts or unrelated modules. Use backend authz as source of truth.

## Acceptance criteria
- Parent logs in, submits, sees PENDING.
- Teacher logs in, approves/rejects, parent sees final state.
- Network errors and validation are visible; unauthorized actions cannot be performed server-side.
- React lint/build pass and core UI flow is demonstrated.

## Learning checkpoint
Explain component composition, state ownership, controlled forms, API error handling, UI state hierarchy.
