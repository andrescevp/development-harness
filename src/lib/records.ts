/**
 * records.ts — build plugin registration records from parsed harness
 * frontmatter. Pure functions (no I/O); exported for unit tests (ST6).
 *
 * The frontmatter uses the harness's V1-style agent shape (`tools` +
 * `permission` maps, `model: provider/model`). OpenCode V2 folds those into
 * the agent `permissions` ruleset — this module mirrors the project's own
 * V1→V2 migration semantics (tools → allow/deny rules on `resource: "*"`,
 * `write`/`patch` normalized to `edit`, string permission entries → wildcard
 * rules, map entries → per-resource rules, tools first then permission so the
 * explicit permission map wins for the same action).
 */

import type { ParsedDocument } from './frontmatter.js';

type AgentMode = 'all' | 'subagent' | 'primary';
type RuleEffect = 'allow' | 'deny' | 'ask';
export interface PermissionRule {
  action: string;
  resource: string;
  effect: RuleEffect;
}

export interface AgentRecord {
  name: string;
  description: string;
  mode: AgentMode;
  /** `model` split at the last "/" — e.g. "opencode-go/deepseek-v4-flash". */
  providerId: string | undefined;
  modelId: string | undefined;
  variant: string | undefined;
  /** Raw structured `tools` map (V1 field), kept for provenance/tests. */
  tools: Record<string, boolean> | undefined;
  /** Raw structured `permission` map (V1 field), kept for provenance/tests. */
  permission: Record<string, unknown> | undefined;
  /** V2 ruleset computed from `tools` + `permission` (registration payload). */
  permissions: PermissionRule[];
  /** Markdown body — becomes the agent system prompt. */
  body: string;
}

export interface SkillRecord {
  name: string;
  description: string;
  /** Absolute path of the bundled SKILL.md (provenance for the editor). */
  path: string;
  /** Full SKILL.md markdown body (frontmatter stripped). */
  content: string;
}

const MODES: readonly AgentMode[] = ['all', 'subagent', 'primary'];
const EFFECTS: readonly RuleEffect[] = ['allow', 'deny', 'ask'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function normalizeAction(action: string): string {
  return action === 'write' || action === 'patch' ? 'edit' : action;
}

/** Fold V1 `tools` + `permission` into the V2 ruleset (order matters: last match wins). */
export function buildPermissions(tools: unknown, permission: unknown): PermissionRule[] {
  const rules: PermissionRule[] = [];
  const toolsObj = isRecord(tools) ? tools : {};
  for (const [tool, enabled] of Object.entries(toolsObj)) {
    if (typeof enabled !== 'boolean') continue;
    rules.push({ action: normalizeAction(tool), resource: '*', effect: enabled ? 'allow' : 'deny' });
  }
  const permObj = isRecord(permission) ? permission : {};
  for (const [action, rule] of Object.entries(permObj)) {
    if (typeof rule === 'string') {
      if (EFFECTS.includes(rule as RuleEffect)) rules.push({ action, resource: '*', effect: rule as RuleEffect });
    } else if (isRecord(rule)) {
      for (const [resource, effect] of Object.entries(rule)) {
        if (EFFECTS.includes(effect as RuleEffect)) {
          rules.push({ action, resource, effect: effect as RuleEffect });
        }
      }
    }
  }
  return rules;
}

function requireString(data: Record<string, unknown>, key: string, file: string): string {
  const v = data[key];
  if (typeof v !== 'string' || v.trim() === '') throw new Error(`${file}: missing or non-string '${key}'`);
  return v.trim();
}

/**
 * Build an AgentRecord from parsed frontmatter. Throws on records that cannot
 * register (missing name/description/mode, invalid model shape) — callers
 * decide whether to skip (plugin setup) or fail (tests/fixtures).
 */
export function buildAgentRecord(parsed: ParsedDocument, file = '<agent>'): AgentRecord {
  const { data, body } = parsed;
  const name = requireString(data, 'name', file);
  const description = requireString(data, 'description', file);
  const modeRaw = data['mode'];
  const mode: AgentMode = modeRaw === undefined ? 'subagent' : (modeRaw as AgentMode);
  if (!MODES.includes(mode)) throw new Error(`${file}: invalid mode '${String(modeRaw)}'`);

  const variant = typeof data['variant'] === 'string' ? (data['variant'] as string) : undefined;
  let providerId: string | undefined;
  let modelId: string | undefined;
  const model = data['model'];
  if (model !== undefined) {
    if (typeof model !== 'string') throw new Error(`${file}: 'model' must be a string`);
    const slash = model.lastIndexOf('/');
    if (slash === -1) modelId = model;
    else {
      providerId = model.slice(0, slash);
      modelId = model.slice(slash + 1);
    }
  }

  const tools = isRecord(data['tools']) ? (data['tools'] as Record<string, boolean>) : undefined;
  const permission = isRecord(data['permission']) ? data['permission'] : undefined;

  return {
    name,
    description,
    mode,
    providerId,
    modelId,
    variant,
    tools,
    permission,
    permissions: buildPermissions(tools, permission),
    body,
  };
}

/**
 * Build a SkillRecord from parsed frontmatter + the SKILL.md absolute path.
 * Throws when `name`/`description` are missing (never registers a nameless skill).
 */
export function buildSkillRecord(parsed: ParsedDocument, path: string, file = '<skill>'): SkillRecord {
  const { data, body } = parsed;
  return {
    name: requireString(data, 'name', file),
    description: requireString(data, 'description', file),
    path,
    content: body,
  };
}
