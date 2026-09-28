# Complete Example

**User request:** "Document the API for my FastAPI project"

**Agent response flow:**

1. **Discover**: Project is FastAPI, infer Python stack. Check `./docs/` — empty. Format: markdown. Location: `./docs/`.

2. **Design**: Multi-file — API has endpoints, auth, models.
   ```
   docs/
     index.md
     api/
       index.md
       endpoints.md
       authentication.md
       models.md
   ```

3. **Generate**: Write each file with proper structure and cross-references.

4. **Cross-reference**: Link auth to endpoints, models to both.

5. **Push to Obsidian**:
   ```
   PROJECT="my-fastapi-app"
   STACK="python,fastapi,sqlalchemy"
   ```
   Each file gets frontmatter with `project: my-fastapi-app`, `stack: python,fastapi,sqlalchemy`.

   Files land in Obsidian at:
   ```
   ~/vaults/main/my-fastapi-app/
     index.md
     api/
       index.md
       endpoints.md
       authentication.md
       models.md
   ```

6. **Report**: Files created, Obsidian location, quick links.
