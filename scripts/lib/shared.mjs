/**
 * shared.mjs — repo-root bootstrap, harness audit constants, and the
 * junk-filtered directory listing shared by the pipeline scripts
 * (audit.mjs, copy-assets.mjs). The repo is fully independent: rules live
 * here as plain code and expectations are derived from the corpus itself
 * (jscpd no-duplication between scripts).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Skill/agent name regex: lowercase kebab-case. */
export const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Line limits per artifact kind (warn-only in the audit). */
export const LINE_LIMITS = { skill: 250, agent: 300 };

/** Harness skills-loop membership (runtime contract, repo-authored). */
export const LOOP = {
  skills: [
    'dh-artifact-check',
    'dh-code-review',
    'dh-code-ruler',
    'dh-coding',
    'dh-contingency',
    'dh-create-documentation',
    'dh-domain-check',
    'dh-execute-plan',
    'dh-execute-plan-task',
    'dh-final-review',
    'dh-grill-sdd',
    'dh-planning',
    'dh-preflight',
    'dh-review',
    'dh-setup',
    'dh-simplify',
  ],
  agents: [
    'dh-documentor',
    'dh-executor',
    'dh-explorer',
    'dh-final-reviewer',
    'dh-reviewer',
    'dh-software-architect',
    'dh-software-engineer',
  ],
};

/** Junk classification rules: dependency dirs, secrets, backup/swap/OS junk. */
export const JUNK = {
  anySegmentDirNames: ['node_modules', '.git', '__pycache__', '.pytest_cache'],
  secretsFileNames: ['.env', '.env.'],
  filePatterns: [
    { pattern: '\\.bak(\\.|$)', reason: 'backup file (.bak)' },
    { pattern: '\\.swp$|\\.swo$|~$', reason: 'editor swap file' },
    { pattern: '^\\.DS_Store$', reason: 'OS junk' },
    { pattern: '^org\\.SKILL\\.md$', reason: 'source-side leftover backup of speak/SKILL.md' },
  ],
};

/** Secret-signature scan rules (low-signature prose + high-signature patterns). */
export const SECRETS = {
  lowSignaturePattern: 'api[_-]?key|secret|password|bearer\\s|token',
  highSignaturePatterns: [
    'sk-[A-Za-z0-9]{16,}',
    'AKIA[0-9A-Z]{16}',
    'ghp_[A-Za-z0-9]{20,}',
    'github_pat_[A-Za-z0-9_]{20,}',
    'xox[baprs]-[A-Za-z0-9-]{10,}',
    '-----BEGIN [A-Z ]*PRIVATE KEY',
    'Bearer\\s+[A-Za-z0-9._~+/-]{20,}',
  ],
  proseAllowlist: [
    'max_tokens',
    'total_tokens',
    'prompt_tokens',
    'completion_tokens',
    'input_tokens',
    'output_tokens',
    'NVIDIA_API_KEY',
    'GEMINI_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'COPILOT_GITHUB_TOKEN',
    'GITHUB_TOKEN',
    'HF_TOKEN',
    'sk-...',
    'sk-proj-.',
    'your-key',
    'your_api_key',
    'never expose',
    'redact',
    'placeholder',
  ],
};

/** Cross-reference allowances for the mention scan (prose, tools, examples). */
export const CROSS_REFERENCE = {
  allowedAtMentions: [
    'opencode',
    'opencode-ai',
    'opentui',
    'example',
    'acme',
    'pytest',
    'class',
    'json',
    'html',
    'csv',
    'base64',
    'uri',
    'text',
    'base',
  ],
  allowedKebabProse: [
    'sub-task',
    'sub-tasks',
    'plan-slug',
    'allowed-tools',
    'save-as',
    'allow-all-tools',
    'sign-off',
    'cherry-pick',
    'non-software',
    'claude-plugin',
    'minicpm-v4',
    'self-contained',
    'multi-file',
    'in-scope',
    'z0-9',
    'pure-white',
    'out-of-scope',
    'dangerously-skip-permissions',
    'create-unit',
    'auto-detected',
    'search-content',
    'pytest-playwright',
    'non-interactive',
    'in-depth',
    'getting-started',
    'address-review',
    'skill-name',
    'review-subtask',
    'print-timeout',
    'plan-level',
    'next-subtask',
    'list-vaults',
    'follow-up',
    'done-when',
    'deploy-staging',
    'cross-module',
    'commit-short-hash',
    'comfyui-setup',
    'allow-all',
    'ad-hoc',
    'add-dir',
    'test-patterns',
    'show-toplevel',
    'rev-parse',
    're-run',
    'project-specific',
    'plugin-dir',
    'plugin-development',
    'opencode-acme-plugin',
    'multi-line',
    'kebab-case',
    'frame-prompt',
    'fire-related',
    'end-to-end',
    'commit-hash',
    'codex-plugin',
    'notesmd-cli',
    'stickman-videos',
    'stickman-video',
    'frame-client',
    'matrix-pixel',
    'jetson-monitor',
    'tesla',
    'nanos',
    'pytest',
    'page-get',
    'content-type',
    'max-retries',
    'timeout-ms',
    'no-sandbox',
    'headless',
    'base-url',
    'test-id',
    'data-testid',
    'to-have',
    'not-to-be',
    'to-be',
    'json-server',
    'flatpak',
    'krita',
    'aseprite',
    'sprite-sheet',
    'sprite-sheets',
    'json-metadata',
    'multi-resolution',
    'color-mode',
    'palette-swap',
    'layer',
    'frame-tag',
    'slice-extraction',
    'dithering',
    'command-line',
    'batch-mode',
    'step-by-step',
    'plan-driven',
    'test-first',
    'code-first',
    'red-green',
    'green-refactor',
    'trade-off',
    'trade-offs',
    'plan-b',
    'plan-c',
    'fail-fast',
    'code-review',
    'hand-off',
    'handoff',
    'on-boarding',
    'check-in',
    'check-out',
    'login-flow',
    'sign-in',
    'sign-up',
    'log-out',
    'set-up',
    'triage',
    'work-flow',
    'look-up',
    'clean-up',
    'roll-back',
    'roll-forward',
    'cut-over',
    'go-live',
    'buy-in',
    'run-book',
    'run-books',
    'play-book',
    'how-to',
    'best-practice',
    'best-practices',
    'code-quality',
    'quality-gate',
    'quality-gates',
    'regression-risk',
    'user-facing',
    'end-user',
    'key-value',
    'one-off',
    'two-phase',
    'three-tier',
    'micro-service',
    'micro-services',
    'well-known',
    'state-of-the-art',
    'cutting-edge',
    'long-running',
    'short-lived',
    'high-signal',
    'low-friction',
    'open-source',
    'source-control',
    'version-control',
    'opencode-ai',
    'opencode-ai-plugin',
    'agent-bodies',
    'agent-frontmatter',
    'askpass',
    'phase-aware',
    'phase-completion',
    'repo-root',
  ],
};

/** Repo root derived from a script's import.meta.url (scripts live in <root>/scripts). */
export function projectRoot(importMetaUrl) {
  return path.dirname(path.dirname(fileURLToPath(importMetaUrl)));
}

/**
 * Junk classifier over the JUNK rules above.
 * @returns {function(string, string, boolean): string|null} reason or null if kept.
 */
export function createJunkReason() {
  return (relPath, base, isDir) => {
    const segments = relPath.split('/');
    for (const d of JUNK.anySegmentDirNames) if (segments.includes(d)) return `dependency junk (${d})`;
    for (const s of JUNK.secretsFileNames) if (base === s || base.startsWith(s)) return 'secrets (.env*)';
    if (isDir) return null;
    for (const f of JUNK.filePatterns) if (new RegExp(f.pattern).test(base)) return f.reason;
    return null;
  };
}

/**
 * List directory entries with junk filtering (shared walk head for the
 * recursive copy functions). Kept entries are { entry, rel, reason: null };
 * junk entries are { skipped: true, rel, reason }.
 */
export function listEntries(fs_, junkReason_, srcAbs, relPrefix) {
  const out = [];
  for (const entry of fs_.readdirSync(srcAbs, { withFileTypes: true })) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const reason = junkReason_(rel, entry.name, entry.isDirectory());
    out.push(reason ? { skipped: true, rel, reason } : { entry, rel, reason: null });
  }
  return out;
}
