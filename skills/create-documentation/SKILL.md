---
name: create-documentation
description: >
  Use this skill when asked to create, generate, write, or produce documentation —
  project docs, API references, architecture overviews, README files, technical
  guides, or any structured document, as single-file or multi-file sets with
  cross-references. Use when the user says "document this",
  "create docs for", "generate documentation", "write a README", "document the API",
  "make docs for", or similar, or after creating substantial code that needs
  documentation. Supports Markdown (default), HTML, and Mermaid diagram formats,
  then pushes a copy to the project vault at `./docs/` with frontmatter metadata
  (tags, project, created, stack, updated, feature, epic).
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: bash, read, write, edit, glob
metadata:
  audience: developers
  workflow: documentation
---

# Documentation Generator

Generate structured, cross-referenced documentation in any format, at any location, then push a copy to Obsidian with complete metadata for vault discoverability.

## Workflow

Follow this sequence for every documentation request:

1. **Discover** — Determine what to document and its scope
2. **Design** — Plan the document structure (single file or multi-file)
3. **Generate** — Write the documents in the requested format
4. **Cross-reference** — Link related documents together
5. **Obsidian push** — Copy to Obsidian with frontmatter metadata

## Step 1: Discovery

Before writing, clarify with the user (or infer from context):

| Question                              | Default                                                           |
|---------------------------------------|-------------------------------------------------------------------|
| What are we documenting?              | Current project, recent changes, or user-specified topic          |
| Output format?                        | `markdown` (also supports `html`, `mermaid`)                     |
| Output location?                      | `./docs/` (relative to client working directory)                  |
| Single file or multi-file?            | Multi-file for >3 sections, single otherwise                      |
| Obsidian vault path?                  | Ask user or infer from `git rev-parse --show-toplevel` + `/docs`  |
| Existing docs to extend?              | Check `./docs/` first, extend if found                            |

Ask if critical info is missing. For simple requests ("document this function"), infer defaults and proceed.

## Step 2: Structure Design

### Single-file structure

For focused topics (one class, one endpoint, one workflow):

```markdown
# Title

## Overview

Brief description of what this documents.

## Details

### Section 1

Content.

### Section 2

Content.

## Related

- [Other doc](./other.md)
```

### Multi-file structure

For broad topics (full API, architecture, project handbook). Always create an index:

```
docs/
  index.md              ← Entry point with links to all sections
  getting-started.md    ← Quickstart guide
  architecture.md       ← System design
  api/
    index.md            ← API overview
    endpoints.md        ← Endpoint reference
    authentication.md   ← Auth flow
  guides/
    deployment.md       ← How to deploy
    troubleshooting.md  ← Common issues
```

**Index file template:**

```markdown
# {Project Name} Documentation

Last updated: {date}

## Sections

- [Getting Started](./getting-started.md) — Quickstart and prerequisites
- [Architecture](./architecture.md) — System design and decisions
- [API Reference](./api/index.md) — Endpoints, auth, and examples
- [Guides](./guides/) — Deployment, troubleshooting, recipes

## Quick Links

- [Installation](./getting-started.md#installation)
- [Configuration](./getting-started.md#configuration)
```

## Reference triggers

Use these detailed references only when the specific sub-task requires them:

| Reference | When to use | File |
|-----------|-------------|------|
| Format guide | User requests HTML or Mermaid output, or detailed Markdown formatting examples | `references/format-guide.md` |
| Obsidian push | Time to push documentation to Obsidian (Step 5 of the workflow) | `references/obsidian-push.md` |
| Complete example | User wants to see a full end-to-end example | `references/complete-example.md` |

## Step 4: Content Standards

### Every document must have

1. **Title** — Clear, specific `# Title` at the top
2. **Overview** — 2-3 sentences explaining what this doc covers
3. **Body** — Structured with `##` headings, no more than 4 levels deep
4. **Related links** — References to other docs in the set

### File naming

| Good                    | Bad                    |
|-------------------------|------------------------|
| `getting-started.md`    | `Getting Started.md`   |
| `api-endpoints.md`      | `API-v2.3-ref.md`      |
| `deployment-guide.md`   | `deploy.md`            |

Use lowercase, hyphens for spaces, descriptive names.

### Cross-references

When generating multi-file docs, link documents together:

```markdown
## Authentication

Before calling endpoints, obtain a token as described in [Authentication](./authentication.md).

All endpoints require the header documented in [API Overview](./index.md#headers).
```

For Obsidian compatibility, also include `[[wikilinks]]` as comments:

```markdown
<!-- obsidian: [[authentication]] [[api-overview]] -->
```

## Gotchas

- **Nested directories**: Create parent directories first (`mkdir -p`) before writing files.
- **Frontmatter conflicts**: If source Markdown already has frontmatter, merge the Obsidian metadata into the existing block — don't create two `---` blocks.
- **Obsidian not running**: The Obsidian push is best-effort. If `obsidian` CLI fails, write files directly to the vault path and tell the user to open Obsidian to see them.
- **Vault path**: Defaults to `{project_root}/docs/`. Override with `OBSIDIAN_VAULT` environment variable. Project root is auto-detected via `git rev-parse --show-toplevel`.
- **Large docs**: For 20+ files, batch the push and report progress per batch.
- **HTML docs in Obsidian**: Obsidian primarily renders Markdown. If HTML is requested, still push a `.md` version with an embedded `<iframe>` or link to the HTML version.
- **Mermaid in Obsidian**: Obsidian renders Mermaid natively inside code blocks. No conversion needed — Mermaid syntax works directly in `.md` files.

## Verification Checklist

After generating documentation:

- [ ] All files exist in `./docs/` (or user-specified location)
- [ ] Index file (`index.md`) links to every document
- [ ] Cross-references between documents resolve correctly
- [ ] Vault copies exist in `./docs/` with correct folder name
- [ ] Every vault file has complete frontmatter (tags, project, created, stack, updated)
- [ ] Mermaid diagrams render correctly (check syntax)
- [ ] HTML files have proper structure with embedded styles
