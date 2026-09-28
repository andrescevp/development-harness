/**
 * manifest-fixture.ts — shared manifest expectations for the ST6 suite.
 *
 * Mirrors scripts/manifest.json + plan.md "Primary agent/skill manifest":
 * exactly 6 agents and 12 skills (dh-prefixed), and the plugin's
 * skill-name regex. Test-only module (never imported by src/ runtime code).
 */

export const MANIFEST_AGENTS = [
  'dh-software-architect',
  'dh-software-engineer',
  'dh-reviewer',
  'dh-final-reviewer',
  'dh-executor',
  'dh-explorer',
] as const;

export const MANIFEST_SKILLS = [
  'dh-artifact-check',
  'dh-simplify',
  'dh-domain-check',
  'dh-coding',
  'dh-code-review',
  'dh-execute-plan',
  'dh-execute-plan-task',
  'dh-final-review',
  'dh-planning',
  'dh-preflight',
  'dh-review',
  'dh-create-documentation',
  'dh-grill-sdd',
] as const;

export const NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Sorted copies for equality assertions against registry/loader output. */
export const SORTED_AGENTS: readonly string[] = [...MANIFEST_AGENTS].sort();
export const SORTED_SKILLS: readonly string[] = [...MANIFEST_SKILLS].sort();
