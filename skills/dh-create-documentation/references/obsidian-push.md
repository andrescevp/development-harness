# Obsidian Push

## Step 5: Obsidian Push

The Obsidian vault IS the project root: `{project_root}` (auto-detected via `git rev-parse --show-toplevel` or the current directory). **ALL documentation is written under `{project_root}/docs`** — Obsidian sees it as a `docs/` folder inside the vault, and there is no `{vault}/{project}/` nesting. This step enriches every written document with complete frontmatter so it is discoverable in Obsidian.

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

# ALL documentation lives under the docs/ folder of the vault
DOCS_DIR="$VAULT/docs"
mkdir -p "$DOCS_DIR"
```

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

Use the `run-notesmd-cli` skill (backed by `notesmd-cli`) when possible. The vault path structure (vault == project root; documentation under its `docs/` folder):

```
{vault}/
  docs/
    index.md              ← Main entry with frontmatter
    getting-started.md    ← With frontmatter
    architecture.md       ← With frontmatter
    api/
      index.md            ← With frontmatter
      endpoints.md        ← With frontmatter
```

**Preferred method — use `run-notesmd-cli` (notesmd-cli):**

```bash
# Enrich each generated document with frontmatter in place (all under $DOCS_DIR)
for file in index.md getting-started.md architecture.md api/*.md; do
  [ -f "$DOCS_DIR/$file" ] || continue
  target_path="$DOCS_DIR/$file"

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
    cat "$target_path"
  } > "$target_path.tmp" && mv "$target_path.tmp" "$target_path"

  echo "Pushed to vault: $target_path"
done

# Attempt Obsidian CLI refresh (best-effort)
if command -v obsidian >/dev/null 2>&1; then
  obsidian open path="$DOCS_DIR/index.md" 2>/dev/null || true
fi
```

**Fallback (Obsidian CLI unavailable):**

If the `obsidian` CLI is not available or Obsidian is not running, the files
are already in the vault (the vault is the project root; docs under its
`docs/` folder) — just ensure the frontmatter is present and tell the user
to open Obsidian to see them:

```bash
# Documents already live in the vault; only frontmatter enrichment is needed.
for file in index.md getting-started.md architecture.md api/*.md; do
  [ -f "$DOCS_DIR/$file" ] || continue
  echo "Already in vault: $DOCS_DIR/$file (frontmatter ensured above)"
done
```

### 5d. Summary

After pushing, report:

```
Documentation created in: {vault}/docs/   (vault == project root)
Files generated: 5
Frontmatter applied to: {vault}/docs/index.md, {vault}/docs/getting-started.md,
  {vault}/docs/architecture.md, {vault}/docs/api/index.md,
  {vault}/docs/api/endpoints.md
```

If Obsidian is running and the CLI is available, also note that the vault is synced. Otherwise, tell the user to open Obsidian to see the new files (they are already in the vault — `{vault}/docs`).
