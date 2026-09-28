/**
 * lib/frontmatter.mjs — zero-dependency YAML-frontmatter splitter + tolerant
 * subset parser, shared by scripts/audit.mjs (ST2), the ST5 asset builder, and
 * the ST6 unit tests.
 *
 * Handles the shapes found in the harness corpus:
 *   - `key: value` scalars (quoted or not, inline lists `[a, b]`)
 *   - `description: >` / `>-` folded blocks and `|` / `|-` literal blocks
 *     (multi-line indented continuation — the classic naive-parser breaker)
 *   - nested maps (`tools:`, `permission:`, `metadata:`) flattened to "k=v ..."
 *   - top-level `- item` lists joined with ", "
 *
 * It is intentionally lenient: exact nested YAML fidelity is not needed for
 * audit/registration; presence + scalar extraction is.
 */

/** Split leading `---` frontmatter block. Returns { fm, body } or null (no FM). */
export function splitFrontmatter(text) {
  if (!/^---(\r?\n)/.test(text)) return null
  const end = text.indexOf('\n---', 4)
  if (end === -1) return { error: 'unterminated frontmatter (no closing ---)' }
  return { fm: text.slice(4, end), body: text.slice(end + 4) }
}

const BLOCK_MARKER = /^(>|>[-+]?|\||\|[-+]?)$/

/** Parse a frontmatter block into a flat { key: scalar } map. Never throws. */
export function parseFrontmatter(fm) {
  const fields = {}
  const errors = []
  const lines = fm.replace(/\r\n/g, '\n').split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim() || /^[ \t]/.test(line)) { i++; continue }
    const m = line.match(/^([A-Za-z0-9_.-]+):(.*)$/)
    if (!m) { errors.push(`unparseable line: "${line.slice(0, 48)}"`); i++; continue }
    const key = m[1]
    const rest = m[2].trim()
    if (rest !== '' && !BLOCK_MARKER.test(rest)) { fields[key] = unquote(rest); i++; continue }
    let j = i + 1
    while (j < lines.length && !lines[j].trim()) j++
    if (j < lines.length && /^[ \t]/.test(lines[j])) {
      let lit = false
      if (BLOCK_MARKER.test(lines[j].trim())) { lit = lines[j].trim().startsWith('|'); j++ }
      const chunks = []
      const items = []
      const isList = /^[ \t]*- /.test(lines[j] || '')
      while (j < lines.length && /^[ \t]/.test(lines[j]) && lines[j].trim()) {
        if (isList && /^[ \t]*- /.test(lines[j])) items.push(lines[j].replace(/^[ \t]*- /, '').trim())
        else chunks.push(lines[j].trim())
        j++
      }
      fields[key] = isList ? items.join(', ') : chunks.join(lit ? '\n' : ' ')
    } else fields[key] = ''
    i = j
  }
  return { fields, errors }
}

function unquote(v) {
  return v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
}