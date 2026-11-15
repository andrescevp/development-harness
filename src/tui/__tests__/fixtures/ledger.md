---
title: Checkout Flow — Fast Skipped Checks
slug: checkout-flow
description: Synthetic ledger fixture for the TUI plan data layer.
tags: [plan, fast, checks]
project: fixture-project
created: 2026-11-10
updated: 2026-11-14
---

# Fast Execution — Skipped Checks

| Timestamp | Check | Scope | Reason | Disposition |
|---|---|---|---|---|
| 2026-11-10T10:00:00.000Z | dh-review | Plan | fast mode defers per-task verification | deferred to end-of-plan |
| 2026-11-10T10:00:00.000Z | dh-simplify | Plan | fast mode defers per-task verification | deferred to end-of-plan |
| 2026-11-14T09:00:00.000Z | dh-review | Plan end | deferred check now runs | run: PASS — 721 tests |
| 2026-11-14T09:00:00.000Z | dh-domain-check | Plan | conditional at plan end | conditional at plan end |
| 2026-11-14T09:00:00.000Z | dh-preflight | Plan | no release in this plan | not applicable — release gate |
