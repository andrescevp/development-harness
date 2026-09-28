# Obsidian Push

## Step 5: Obsidian Push

After writing docs, push each file to the project vault at `./docs/`. The vault lives at the project root (auto-detected via `git rev-parse --show-toplevel` or current directory), making learnings and documentation portable with the project.

### 5a. Determine vault path

The vault is resolved in this order:
1. `OBSIDIAN_VAULT` env var (override)
2. `{project_root}/docs/` (auto-detected)

```bash
# Auto-detect project root
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
PROJECT="$(basename "$PROJECT_ROOT")"

# Resolve vault
VAULT="${OBSIDIAN_VAULT:-$PROJECT_ROOT/docs}"
OBSIDIAN_DIR="$VAULT/$PROJECT"
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

Use the `run-notesmd-cli` skill (backed by `notesmd-cli`) when possible. The vault path structure:

```
{vault}/
  {project-name}/
    index.md              ← Main entry with frontmatter
    getting-started.md    ← With frontmatter
    architecture.md       ← With frontmatter
    api/
      index.md            ← With frontmatter
      endpoints.md        ← With frontmatter
```

**Preferred method — use `run-notesmd-cli` (notesmd-cli):**

```bash
# Use the obsidian CLI if available and Obsidian is running
for file in docs/*.md docs/**/*.md; do
  [ -f "$file" ] || continue
  rel="${file#docs/}"
  target_path="$OBSIDIAN_DIR/$rel"
  mkdir -p "$(dirname "$target_path")"

  # Prepend frontmatter
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
  obsidian open path="$OBSIDIAN_DIR/index.md" 2>/dev/null || true
fi
```

**Fallback (Obsidian CLI unavailable):**

If the `obsidian` CLI is not available or Obsidian is not running, write files directly. The user can open Obsidian later to see them:

```bash
for file in docs/*.md docs/**/*.md; do
  [ -f "$file" ] || continue
  rel="${file#docs/}"
  target="$OBSIDIAN_DIR/$rel"
  mkdir -p "$(dirname "$target")"
  cp "$file" "$target"
  echo "Written directly: $target"
done
```

### 5d. Summary

After pushing, report:

```
Documentation created in: ./docs/
Files generated: 5
Pushed to vault: {vault}/{project}/ (5 files)
- {vault}/{project}/index.md
- {vault}/{project}/getting-started.md
- {vault}/{project}/architecture.md
- {vault}/{project}/api/index.md
- {vault}/{project}/api/endpoints.md
```

If Obsidian is running and the CLI is available, also note that the vault is synced. Otherwise, tell the user to open Obsidian to see the new files.
