---
title: Example Phased Plan
slug: example-phased-plan
description: Canonical phased-plan fixture for the harness parser tests
created: 2026-09-28
updated: 2026-09-28
status: In Progress
active: true
tags: [plan, fixture]
project: dev-harness-skills
---

# Phased Plan — Canonical Fixture

> Canonical sample consumed by ST2's `parsePlan` unit tests as ground truth.
> It mirrors the output of `skills/planning/references/phased-plan-template.md`
> exactly (2 phases, mixed statuses, full field skeletons, at least one
> sub-task with `Related Requirements`). Keep it in sync with the template.

# Plan: Example Phased Plan

## Objective

Validate the phased plan format contract end-to-end.

## Requirements Snapshot

- **R1:** Phases with dual status markers parse correctly.
- **R2:** Sub-task numbering maps to phase numbering (N.M).

## Scope

- Parse the phased structure; no implementation needed.

## Assumptions and Constraints

- Fixture stays byte-stable; change it only together with the template.

## Risks and Areas Requiring Care

- Drift between template and fixture breaks the parser tests.

## Core concepts

Phases group sub-tasks; status lines sit immediately after headers.

## Phases

### Phase 1: Foundation

- **Status:** In Progress

#### Sub-Task 1.1: Define the contract

- **Status:** Completed
- **Objective:** Define the format contract.
- **Related Requirements:** R1
- **Dependencies and Preconditions:** None.
- **In Scope for This Sub-Task:** Contract text.
- **Out of Scope for This Sub-Task:** Parser.
- **Instructions:** Write the contract in the references template.
- **Acceptance Criteria:** Contract unambiguous.
- **Cautionary Points (Risks & Edge Cases):** Marker adjacency.
- **Implementation Suggestions:** Keep markers exact.
- **Testing Suggestions:** Review against the template.
- **Done When:** Contract text exists.

#### Sub-Task 1.2: Ship the fixture

- **Status:** In Progress
- **Objective:** Provide the parser ground truth.
- **Related Requirements:** R1, R2
- **Dependencies and Preconditions:** Sub-Task 1.1.
- **In Scope for This Sub-Task:** This fixture.
- **Out of Scope for This Sub-Task:** Parser implementation.
- **Instructions:** Mirror the template output.
- **Acceptance Criteria:** Fixture parses as 2 phases / 3 sub-tasks.
- **Cautionary Points (Risks & Edge Cases):** Numbering drift.
- **Implementation Suggestions:** Keep statuses mixed (Pending/In Progress/Completed).
- **Testing Suggestions:** Consume with parsePlan in ST2.
- **Done When:** Fixture present and consistent.

### Phase 2: Execution

- **Status:** Pending

#### Sub-Task 2.1: Implement the parser

- **Status:** Pending
- **Objective:** Implement parsePlan.
- **Related Requirements:** R1, R2
- **Dependencies and Preconditions:** Phase 1.
- **In Scope for This Sub-Task:** Parser helper.
- **Out of Scope for This Sub-Task:** Plugin registration.
- **Instructions:** Parse phases and sub-tasks per the marker rules.
- **Acceptance Criteria:** Parser returns structured phases + sub-tasks.
- **Cautionary Points (Risks & Edge Cases):** Mis-numbered sub-tasks.
- **Implementation Suggestions:** Use the fixture as input.
- **Testing Suggestions:** Unit tests over this fixture.
- **Done When:** Parser consumes this fixture without errors.

## Final Integration & Verification

- **System-Wide Test:** parsePlan(fixture) returns 2 phases / 3 sub-tasks.
- **Completion Checklist:** Template + fixture in sync; tests green.