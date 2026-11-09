---
name: dh-mermaid
description: >
  Generate Mermaid diagrams for plans and documentation: current state, desired state after the plan, critical changes needing visual explanation, component/architecture graphs, flows, sequences, states, data models, timelines. Use when the user asks to diagram, visualize, map components, or explain a change visually.
license: MIT
compatibility: opencode, copilot, antigravity
allowed-tools: read, write, edit
metadata:
  audience: developers
  workflow: documentation
---

# Mermaid diagrams

Produce Mermaid diagrams that are small, semantic, and linked to the artifact
they explain: a plan (current vs desired state, critical changes, components)
or a project document.

**Attribution:** adapted from WH-2099/mermaid-skill (MIT); see
[`LICENSE`](LICENSE). Upstream syntax references are vendored in
`references/` and keep their original content.

## Workflow

1. **Pick one concern** — each diagram answers a single question (current
   state, target state, critical change, components, sequence, data model,
   timeline).
2. **Select the type** — use the tables below, then read the matching
   reference file before writing syntax.
3. **Draft the diagram** — semantic node IDs, explicit direction, and a legend
   for changed/new/removed elements.
4. **Validate** — use a fenced block with the `mermaid` info string, check the
   syntax and structure, and render it when a Mermaid renderer is available.
5. **Link it** — reference the file from the plan's `## Visual Context` or from
   the document that uses it.

## Diagram type reference

| Type | Reference | Use cases |
| ---- | --------- | --------- |
| Flowchart | [flowchart.md](references/flowchart.md) | Processes, decisions, steps, component graphs |
| Sequence Diagram | [sequenceDiagram.md](references/sequenceDiagram.md) | Interactions, messaging, API calls |
| Class Diagram | [classDiagram.md](references/classDiagram.md) | Class structure, inheritance, associations |
| State Diagram | [stateDiagram.md](references/stateDiagram.md) | State machines, state transitions, lifecycles |
| ER Diagram | [entityRelationshipDiagram.md](references/entityRelationshipDiagram.md) | Database design, entity relationships |
| Gantt Chart | [gantt.md](references/gantt.md) | Project planning, timelines |
| Pie Chart | [pie.md](references/pie.md) | Proportions, distributions |
| Mindmap | [mindmap.md](references/mindmap.md) | Hierarchical structures, knowledge graphs |
| Timeline | [timeline.md](references/timeline.md) | Historical events, milestones |
| Git Graph | [gitgraph.md](references/gitgraph.md) | Branches, merges, versions |
| Quadrant Chart | [quadrantChart.md](references/quadrantChart.md) | Four-quadrant analysis |
| Requirement Diagram | [requirementDiagram.md](references/requirementDiagram.md) | Requirements traceability |
| C4 Diagram | [c4.md](references/c4.md) | System architecture (C4 model) |
| Sankey Diagram | [sankey.md](references/sankey.md) | Flow, conversions |
| XY Chart | [xyChart.md](references/xyChart.md) | Line charts, bar charts |
| Block Diagram | [block.md](references/block.md) | System components, modules |
| Packet Diagram | [packet.md](references/packet.md) | Network protocols, data structures |
| Kanban | [kanban.md](references/kanban.md) | Task management, workflows |
| Architecture Diagram | [architecture.md](references/architecture.md) | System architecture |
| Radar Chart | [radar.md](references/radar.md) | Multi-dimensional comparison |
| Treemap | [treemap.md](references/treemap.md) | Hierarchical data visualization |
| User Journey | [userJourney.md](references/userJourney.md) | User experience flows |
| ZenUML | [zenuml.md](references/zenuml.md) | Sequence diagrams (code style) |

Additional experimental references (support varies by renderer; fall back to a
flowchart when unsupported):

- [Cynefin](references/cynefin.md), [Event Modeling](references/eventmodeling.md),
  [Ishikawa](references/ishikawa.md), [Railroad](references/railroad.md),
  [Swimlanes](references/swimlanes.md), [TreeView](references/treeView.md),
  [Venn](references/venn.md), [Wardley](references/wardley.md),
  [Tidy Tree](references/config-tidy-tree.md).
- [Examples](references/examples.md) — complete sample diagrams.

## Configuration & themes

- [Theming](references/config-theming.md) — custom colors and styles
- [Directives](references/config-directives.md) — diagram-level configuration
- [Layouts](references/config-layouts.md) — layout direction and spacing
- [Configuration](references/config-configuration.md) — global settings
- [Math](references/config-math.md) — LaTeX math support

## Graph input (when indexed)

When `dh-setup` indexed the project, use the `dh-code-query` skill before
drafting component, architecture, sequence, or class diagrams:

- `cgr graph importers` / `callers` for dependency and interaction edges.
- `cgr graph implementors` / `overrides` for inheritance and contract edges.
- `cgr stats` for a quick node/relationship inventory.

Diagram only confirmed edges; verify them in the source and keep the graph's
project name in the diagram notes when it matters. Fall back to code reading
when the project is not indexed or the graph is stale.

## Plan diagrams

Use this skill during planning (and in `dh-planning`) when the plan changes
architecture, data flow, components, or lifecycle, or carries critical /
high-risk modifications.

**When to create:** current state, desired state after the plan completes,
critical changes that need visual explanation, component/architecture graphs,
and sequences/states/data models when the behavior is easier to show than to
describe.

**Output layout** (`./docs/plans/<slug>/diagrams/`):

| File | Purpose |
| --- | --- |
| `index.md` | Diagram index with purpose, type, and links |
| `current-state.md` | How the system works today |
| `desired-state.md` | How the system works after the plan |
| `critical-changes.md` | Before/after of the risky or structural change |
| `components.md` | Component/architecture graph of the plan's surface |
| `sequence.md`, `data-model.md`, `timeline.md` | Optional, when relevant |

`index.md` is an index only: frontmatter plus a
`| Diagram | Purpose | Type | Link |` table — no `diagram_type`, no Mermaid
block. Diagram files carry the frontmatter (`title`, `tags: [diagram, plan, mermaid]`,
`project`, `created`, `updated`, `stack`, `feature`, `epic`, `diagram_type`),
then `## Overview`, one fenced `mermaid` block, `## Notes`, and `## Related`.

Link every plan diagram from `plan.md`'s `## Visual Context` section; write
`None — no structural change` when the plan has no visual impact. `## Related`
points to `../plan.md` and `./index.md` for plan diagrams; for documentation
diagrams it points to the parent document. Templates, the selection matrix,
and the full rules live in
[`references/plan-diagrams.md`](references/plan-diagrams.md).

**For documentation (not plans):** write under `./docs/diagrams/<topic>/` or
alongside the document, and link the diagram from the document that uses it.
The same frontmatter, structure, and `diagram_type` apply.

## Diagram selection

- **Current / desired state:** flowchart, architecture, C4, state, or ER —
  whichever expresses the concern with the fewest nodes.
- **Critical changes:** flowchart with `classDef` classes for changed / added /
  removed elements plus a legend, or a sequence diagram with before/after
  participants.
- **Components:** C4, architecture, block, or a flowchart with subgraphs; fall
  back to a flowchart when an experimental type is unsupported by the target
  renderer.
- **Plan phases / timeline:** gantt or timeline when phase ordering or
  milestones are the point.
- **Behavior / data:** sequence for call flows, state for lifecycle, ER for
  data models.

## Rules

- One concern per diagram; split rather than overload.
- Use semantic node IDs (`apiGateway`, `billingDb`), not `A`, `B`, `C`.
- Keep diagrams readable (~20 nodes max); extract a second diagram instead.
- Legend every diagram that marks changed, new, or removed elements.
- Compare current and desired state with consistent node IDs so changes stand
  out; mark them with `classDef changed`, `classDef new`, `classDef removed`.
- Never include secrets, tokens, credentials, customer data, or full code.
- Validate every fenced block: correct header, balanced subgraphs, no stray
  Mermaid keywords; render when a renderer is available.
- Link each diagram from the plan or document section it explains.

## Output specification

Generated Mermaid code must:

1. Use a fenced code block whose info string is `mermaid`.
2. Render directly (valid syntax, one diagram per block).
3. Use clear indentation and one statement per line for reviewable diffs.
4. Prefer built-in shapes and themes; add styling only to convey meaning.

## Doc search

**Documentation management:** delegate create / update / delete / retrieve of
generated documents (excluding docs/plans) to the best available documentation
agent (bundled documentation capability as fallback) — the main and only
documentation owner (see dh-create-documentation).

Search generated documentation quickly:
`notesmd-cli search-content "<term>" --vault "<project-name>"` or
`obsidian search query="<term>"` (fallback: `rg --glob '*.md' "<term>" docs/`).
