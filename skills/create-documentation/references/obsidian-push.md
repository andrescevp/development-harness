# Obsidian Push

## Step 5: Obsidian Push

The Obsidian vault IS the project root: `{project_root}` (auto-detected via `git rev-parse --show-toplevel` or the current directory). Documentation is written directly into the root at its designed relative path — there is no `./docs` wrapper and no `{vault}/{project}/` nesting. This step enriches every written document with complete frontmatter so it is discoverable in Obsidian.

### 5a. Determine vault path

The vault is resolved in this order:
1. `OBSIDIAN_VAULT` env var (override — e.g., a dedicated notes vault)
2. `{project_root}` (auto-detected; the default vault is the project root itself)

```bash
# Auto-detect project root (= the Obsidian vault)
VAULT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT="$(basename "$VAULT")"

# Override with a dedicated vault if configured
VAULT="${OBSIDIAN_VAULT:-$VAULT}"
```

`OBSIDIAN_DIR` is not needed — with `VAULT == project root`, documents keep
their designed relative layout under `$VAULT` (e.g. `$VAULT/index.md`,
`$VAULT/api/endpoints.md`).

### 5b. Generate frontmatter

For every document, add YAML frontmatter before pushing:

```yaml
---
tags: [documentation]
project: <project-name>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
stack: <tech-stack>        # e.g. "python,fastapi", "typescript,react"
feature: <feature-area>    # e.g. "api", "authentication", "deployment"
epic: <epic-name>          # e.g. "v2.0-migration", "observability"
---
```

**Field defaults when not specified by user:**
- `tags`: `[documentation]` plus any format-appropriate tags (`api`, `guide`, `reference`, `tutorial`)
- `project`: Current directory name (`basename "$(pwd)"`)
- `created`: Today's date
- `updated`: Today's date
- `stack`: Infer from project (check `package.json`, `requirements.txt`, `go.mod`, etc.)
- `feature`: Topic of the document (first heading, or "general")
- `epic`: Ask user or leave empty

### 5c. Write to vault

Use the `run-notesmd-cli` skill (backed by `notesmd-cli`) when possible. The vault path structure (vault == project root, designed layout):

```
{vault}/
  index.md              ← Main entry with frontmatter
  getting-started.md    ← With frontmatter
  architecture.md       ← With frontmatter
  api/
    index.md            ← With frontmatter
    endpoints.md        ← With frontmatter
```

**Preferred method — use `run-notesmd-cli` (notesmd-cli):**

```bash
# Enrich each generated document with frontmatter in place (vault == project root)
for file in index.md getting-started.md architecture.md api/*.md; do
  [ -f "$file" ] || continue
  target_path="$VAULT/$file"
  mkdir -p "$(dirname "$target_path")"

  # Prepend or merge frontmatter (merge if the file already has a --- block)
  {
    echo "---"
    echo "tags: [documentation]"
    echo "project: $PROJECT"
    echo "created: $(date +%Y-%m-%d)"
    echo "updated: $(date +%Y-%m-%d)"
    echo "stack: ${STACK:-tbd}"
    echo "feature: ${FEATURE:-general}"
    echo "epic: ${EPIC:-}"
    echo "---"
    echo ""
    cat "$file"
  } > "$target_path"

  echo "Pushed to vault: $target_path"
done

# Attempt Obsidian CLI refresh (best-effort)
if command -v obsidian >/dev/null 2>&1; then
  obsidian open path="$VAULT/index.md" 2>/dev/null || true
fi
```

**Fallback (Obsidian CLI unavailable):**

If the `obsidian` CLI is not available or Obsidian is not running, the files
are already in the vault (the vault is the project root) — just ensure the
frontmatter is present and tell the user to open Obsidian to see them:

```bash
# Documents already live in the vault; only frontmatter enrichment is needed.
for file in index.md getting-started.md architecture.md api/*.md; do
  [ -f "$file" ] || continue
  echo "Already in vault: $VAULT/$file (frontmatter ensured above)"
done
```

### 5d. Summary

After pushing, report:

```
Documentation created in: {vault}/   (vault == project root)
Files generated: 5
Frontmatter applied to: {vault}/index.md, {vault}/getting-started.md,
  {vault}/architecture.md, {vault}/api/index.md, {vault}/api/endpoints.md
```

If Obsidian is running and the CLI is available, also note that the vault is synced. Otherwise, tell the user to open Obsidian to see the new files (they are already in the vault — the project root).
