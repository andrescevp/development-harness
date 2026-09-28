# Complete Example

**User request:** "Document the API for my FastAPI project"

**Agent response flow:**

1. **Discover**: Project is FastAPI, infer Python stack. The Obsidian vault IS the project root; ALL documentation lives under `{project_root}/docs` — check `./docs/` first (empty). Format: markdown. Location: `{project_root}/docs`.

2. **Design**: Multi-file — API has endpoints, auth, models. Structure under the docs folder of the vault:
   ```
   {project_root}/            ← Obsidian vault
     docs/                    ← ALL documentation goes here
       index.md
       api/
         index.md
         endpoints.md
         authentication.md
         models.md
   ```

3. **Generate**: Write each file with proper structure and cross-references.

4. **Cross-reference**: Link auth to endpoints, models to both.

5. **Frontmatter (in place, under `{vault}/docs`)**:
   ```
   PROJECT="my-fastapi-app"
   STACK="python,fastapi,sqlalchemy"
   ```
   Each file gets frontmatter with `project: my-fastapi-app`, `stack: python,fastapi,sqlalchemy`.

   Files live in the vault at:
   ```
   {project_root}/docs/
     index.md
     api/
       index.md
       endpoints.md
       authentication.md
       models.md
   ```

6. **Report**: Files created, vault location (`{project_root}/docs`), quick links.