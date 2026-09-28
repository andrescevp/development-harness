/**
 * plan-lifecycle.ts — pure helpers for the phased plan lifecycle (M2).
 *
 * Consumes the authoritative format contract from
 * skills/planning/references/phased-plan-template.md:
 *   - `## Phases` → `### Phase N: <title>` (+ `- **Status:**`)
 *     → `#### Sub-Task N.M: <title>` (+ fields + `- **Status:**`)
 *   - status lines are the first `- **Status:**` bullet in their section;
 *     only blank lines may precede them.
 *
 * Framework-free (string/line operations) so the helpers are unit-testable
 * and the plugin tools stay thin. CRLF-tolerant: all markers accept an
 * optional trailing `\r` and edits preserve the original line ending.
 */
import fs from "node:fs"
import path from "node:path"
import { parse } from "yaml"
import { splitFrontmatter } from "../lib/frontmatter.js"
import { planScaffold } from "./plan-template.js"

export type PhaseStatus = "Pending" | "In Progress" | "Completed"
export const PHASE_STATUSES: readonly PhaseStatus[] = ["Pending", "In Progress", "Completed"]

export interface PlanSubTask {
  /** Canonical "N.M" ref (phase.subtask). */
  index: string
  phase: number
  number: number
  title: string
  status: PhaseStatus
  relatedRequirements: string[]
}

export interface PlanPhase {
  /** 1-based phase number. */
  index: number
  title: string
  status: PhaseStatus
  subTasks: PlanSubTask[]
}

export interface PlanDocument {
  meta: Record<string, unknown>
  title?: string
  phases: PlanPhase[]
}

interface Section {
  kind: "phase" | "subtask"
  ref: string
  headerLine: number // 0-based
  statusLine: number | undefined // 0-based
  endLine: number // 0-based exclusive
}

const HEADINGS = {
  top: /^(#{2,5})\s+/,
  h2: /^##\s+/,
  phase: /^###\s+Phase\s+(\d+):\s+(.+?)\r?$/,
  subtask: /^####\s+Sub-Task\s+(\d+)\.(\d+):\s+(.+?)\r?$/,
} as const

/** Matches status/related bullets with an optional trailing CR. */
const STATUS_RE = /^-\s+\*\*Status:\*\*\s+(.+?)\r?$/
const RELATED_RE = /^-\s+\*\*Related Requirements:\*\*\s+(.+?)\r?$/

function lineAt(contents: string, i: number): string {
  const l = contents.split("\n")[i]
  return l ?? ""
}

/** Return (value, hadCr) for a status line; throws on unknown statuses. */
function readStatusRaw(contents: string, line: number): { raw: string; cr: boolean } {
  const l = contents.split("\n")[line] ?? ""
  const m = l.match(/^-\s+\*\*Status:\*\*\s+(.+?)(\r?)$/)
  if (!m) throw new Error(`plan line ${line + 1}: no status marker`)
  return { raw: m[1]!.trim(), cr: m[2] === "\r" }
}

function statusOf(contents: string, line: number, file = "<plan>"): PhaseStatus {
  const { raw } = readStatusRaw(contents, line)
  if (!(PHASE_STATUSES as readonly string[]).includes(raw)) {
    throw new Error(`${file}: invalid status '${raw}' at line ${line + 1} (expected ${PHASE_STATUSES.join(" | ")})`)
  }
  return raw as PhaseStatus
}

/** Plan frontmatter: missing header → {}; unterminated/malformed → throw. */
function parseMeta(contents: string): Record<string, unknown> {
  const split = splitFrontmatter(contents)
  if (split === null) return {}
  if ("error" in split) throw new Error(`plan frontmatter: ${split.error}`)
  const data = parse(split.fm)
  if (data === null || data === undefined) return {}
  if (typeof data !== "object" || Array.isArray(data)) throw new Error("plan frontmatter must be a YAML mapping")
  return data as Record<string, unknown>
}

/** Split a plan document into section boundaries (phases + sub-tasks). */
function findSections(contents: string): Section[] {
  const lines = contents.split("\n")
  const sections: Section[] = []
  let current: Section | undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const phase = line.match(HEADINGS.phase)
    const sub = line.match(HEADINGS.subtask)
    if (phase) {
      if (current) current.endLine = i - 1
      current = { kind: "phase", ref: phase[1]!, headerLine: i, statusLine: undefined, endLine: lines.length - 1 }
      sections.push(current)
    } else if (sub) {
      // Close the previous section regardless of its kind (siblings, phases).
      if (current) current.endLine = i - 1
      current = { kind: "subtask", ref: `${sub[1]}.${sub[2]}`, headerLine: i, statusLine: undefined, endLine: lines.length - 1 }
      sections.push(current)
    } else if (current && HEADINGS.h2.test(line)) {
      // Top-level `##` closes the current section (e.g., Final Integration).
      current.endLine = i - 1
      current = undefined
    } else if (current && current.statusLine === undefined && STATUS_RE.test(line)) {
      current.statusLine = i
    }
  }
  return sections.filter((s) => s.endLine >= s.headerLine)
}

function requirePhases(contents: string): void {
  const lines = contents.split("\n")
  if (!lines.some((l) => /^##\s+Phases\s*\r?$/.test(l))) {
    throw new Error("not a phased plan: missing `## Phases` section")
  }
  if (!lines.some((l) => /^###\s+Phase\s+\d+/.test(l))) {
    throw new Error("not a phased plan: no `### Phase N:` headers found")
  }
}

/** Parse a phased plan document into structured phases + sub-tasks. */
export function parsePlan(contents: string, file = "<plan>"): PlanDocument {
  const meta = parseMeta(contents)
  requirePhases(contents)
  const sections = findSections(contents)
  const lines = contents.split("\n")
  const phases: PlanPhase[] = []

  for (const sec of sections) {
    if (sec.kind !== "phase") continue
    const title = (lines[sec.headerLine]!.match(HEADINGS.phase) as RegExpMatchArray)[2]!.trim()
    phases.push({ index: Number(sec.ref), title, status: statusOf(contents, sec.statusLine ?? sec.headerLine, file), subTasks: [] })
  }

  for (const sec of sections) {
    if (sec.kind !== "subtask") continue
    const m = lines[sec.headerLine]!.match(HEADINGS.subtask) as RegExpMatchArray
    const phaseIdx = Number(m[1])
    const subNumber = Number(m[2])
    const title = m[3]!.trim()
    const status = statusOf(contents, sec.statusLine ?? sec.headerLine, file)
    const related: string[] = []
    for (let i = sec.headerLine + 1; i <= sec.endLine; i++) {
      const r = lines[i]?.match(RELATED_RE)
      if (r) {
        related.push(...r[1]!.split(",").map((s) => s.trim()).filter(Boolean))
        break
      }
    }
    const phase = phases.find((p) => p.index === phaseIdx)
    if (!phase) throw new Error(`${file}: orphan sub-task ${phaseIdx}.${subNumber} (no phase ${phaseIdx})`)
    phase.subTasks.push({ index: `${phaseIdx}.${subNumber}`, phase: phaseIdx, number: subNumber, title, status, relatedRequirements: related })
  }

  const title = meta.title !== undefined ? String(meta.title) : undefined
  return { meta, title, phases }
}

function sectionEnd(contents: string, headerLine: number): number {
  const lines = contents.split("\n")
  for (let i = headerLine + 1; i < lines.length; i++) {
    if (/^#{2,5}\s+/.test(lines[i]!)) return i - 1
  }
  return lines.length - 1
}

/**
 * Line-aware status edit: locate the section by ref ("N" for phase, "N.M" for
 * sub-task), replace ONLY the first `- **Status:**` line inside it (preserving
 * CRLF), and re-parse. Throws on unknown refs, missing/invalid markers, and
 * the minimal transition violation (phase → Completed with open sub-tasks).
 */
export function setStatus(contents: string, target: "phase" | "subtask", ref: string, status: PhaseStatus): { contents: string; plan: PlanDocument } {
  if (!(PHASE_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`invalid status '${status}' (expected ${PHASE_STATUSES.join(" | ")})`)
  }
  const lines = contents.split("\n")
  const re = target === "phase" ? new RegExp(`^###\\s+Phase\\s+${escapeRegex(ref)}:`) : new RegExp(`^####\\s+Sub-Task\\s+${escapeRegex(ref)}:`)
  const headerIdx = lines.findIndex((l) => re.test(l))
  if (headerIdx === -1) throw new Error(`${target} ref '${ref}' not found`)

  if (target === "phase" && status === "Completed") {
    for (const sub of parsePlan(contents).phases.find((p) => p.index === Number(ref))?.subTasks ?? []) {
      if (sub.status !== "Completed") throw new Error(`phase ${ref} cannot complete: sub-task ${sub.index} is ${sub.status}`)
    }
  }

  const end = sectionEnd(contents, headerIdx)
  for (let i = headerIdx + 1; i <= end; i++) {
    const m = lines[i]?.match(/^(-\s+\*\*Status:\*\*\s+).+?(\r?)$/)
    if (m) {
      lines[i] = `${m[1]}${status}${m[2]}`
      const updated = lines.join("\n")
      return { contents: updated, plan: parsePlan(updated) }
    }
  }
  throw new Error(`${target} '${ref}' has no status marker`)
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export interface PlanScaffold {
  slug: string
  title: string
  objective: string
  phases: { title: string; subTasks: { title: string }[] }[]
}

/** Build the phased plan markdown from a scaffold (all statuses Pending). */
export function buildPlanTemplate(input: PlanScaffold): string {
  return planScaffold(input)
}

/**
 * Resolve a plan file path, anchored under <workspaceRoot>/docs/plans.
 * Rejects `..` escapes, absolute paths outside the anchor, slugs containing
 * path separators, and symlink traversal. Requires a non-empty workspaceRoot
 * (never falls back to the process CWD).
 */
export function resolvePlanPath(workspaceRoot: string, slug?: string, explicitPath?: string): string {
  if (!workspaceRoot) throw new Error("no workspace root available; pass an explicit `path` input")
  const base = path.resolve(workspaceRoot, "docs", "plans")
  const baseWithSep = base + path.sep

  let resolved: string
  if (explicitPath !== undefined) {
    resolved = path.resolve(base, explicitPath)
  } else {
    if (!slug) throw new Error("either slug or path is required")
    if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) throw new Error(`invalid slug: ${slug}`)
    resolved = path.resolve(base, slug, "plan.md")
  }
  if (!resolved.startsWith(baseWithSep)) throw new Error(`path escapes docs/plans: ${explicitPath ?? slug}`)

  assertNoSymlinks(base, resolved)
  return resolved
}

/** Reject symlink components between the anchor and the resolved target. */
function assertNoSymlinks(base: string, target: string): void {
  const rel = path.relative(base, target)
  if (!rel || rel === ".") return
  let current = base
  for (const seg of rel.split(path.sep)) {
    current = path.join(current, seg)
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      throw new Error(`path traverses a symlink: ${current}`)
    }
  }
}