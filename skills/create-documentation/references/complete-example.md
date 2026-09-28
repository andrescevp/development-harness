# Complete Example

**User request:** "Document the API for my FastAPI project"

**Agent response flow:**

1. **Discover**: Project is FastAPI, infer Python stack. The Obsidian vault IS the project root — check the root (`README.md`, existing folders); no docs yet. Format: markdown. Location: `{project_root}` (vault).

2. **Design**: Multi-file — API has endpoints, auth, models. Structure relative to the vault root (the project root):
   ```
   {project_root}/            ← Obsidian vault
     index.md
     api/
       index.md
       endpoints.md
       authentication.md
       models.md
   ```

3. **Generate**: Write each file with proper structure and cross-references.

4. **Cross-reference**: Link auth to endpoints, models to both.

5. **Frontmatter (vault == project root, in place)**:
   ```
   PROJECT="my-fastapi-app"
   STACK="python,fastapi,sqlalchemy"
   ```
   Each file gets frontmatter with `project: my-fastapi-app`, `stack: python,fastapi,sqlalchemy`.

   Files live in the vault at:
   ```
   {project_root}/
     index.md
     api/
       index.md
       endpoints.md
       authentication.md
       models.md
   ```

6. **Report**: Files created, vault location (the project root), quick links.