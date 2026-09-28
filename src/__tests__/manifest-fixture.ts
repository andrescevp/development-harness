/**
 * manifest-fixture.ts — shared manifest expectations for the ST6 suite.
 *
 * Mirrors scripts/manifest.json + plan.md "Primary agent/skill manifest":
 * exactly 6 agents and 12 skills, and the plugin's skill-name regex.
 * Test-only module (never imported by src/ runtime code).
 */

export const MANIFEST_AGENTS = [
  "software-architect",
  "software-engineer",
  "reviewer",
  "final-reviewer",
  "executor",
  "explorer",
] as const

export const MANIFEST_SKILLS = [
  "artifact-check",
  "simplify",
  "domain-check",
  "coding",
  "code-review",
  "execute-plan",
  "execute-plan-task",
  "final-review",
  "planning",
  "preflight",
  "review",
  "create-documentation",
] as const

export const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/