---
name: html-coding-report
description: Use when the user explicitly mentions HTML alongside a request about their coding sessions — e.g. "generate an HTML report for this week", "make me an html summary of my sessions", "build an html dashboard of my coding activity", "create an html page showing what I coded". Trigger on any phrasing that pairs 'html' with session or coding activity output. Do NOT trigger for plain-text summaries, markdown, PDFs, standup updates, or any session query that does not explicitly mention HTML.
---

# HTML Report Generator

## Overview

Generate a self-contained HTML report from coding session data retrieved via the `mcp-coding-insights` MCP server. Write the file to `/tmp` and open it in the browser.

## Flow

1. Parse intent → pick MCP tools (minimum needed)
2. Call those tools
3. Compute derived metrics from the raw data
4. Build HTML scaled to the data volume
5. Write to `/tmp/session-report-YYYY-MM-DD-<suffix>.html`
6. Run: `open /tmp/session-report-YYYY-MM-DD-<suffix>.html`

## Step 1: Map Intent to MCP Tools

Call the **minimum tools needed** for the intent — do not call all tools by default.

| User says                                   | MCP tools to call                                                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| "this week" / "today" / "last N days"       | `get_sessions_summary` with `from`/`to` and `fields: ["sessionId","project","startedAt","endedAt","messageCount"]`     |
| "across all projects" / "overview"          | `list_projects` then `get_sessions_summary` per project                                                                |
| "deep dive on [project]" / "full breakdown" | `get_session_logs` with `fields: ["sessionId","project","gitBranch","startedAt","endedAt","userMessages","toolsUsed"]` |
| "subagents" / "agents that ran"             | `list_subagents`                                                                                                       |
| "find sessions about [topic]"               | `search_sessions` with `query`                                                                                         |

**Default date range:** If the user states no date range, default to the last 30 days.

**Date range calculation — be precise:**

- "today" → `from: YYYY-MM-DDT00:00:00.000Z` (start of today), `to: now ISO`
- Use local midnight where possible (e.g. `2026-03-05T00:00:00-08:00`). If local timezone is unknown, use Z and note the assumption.
- "this week" → `from: most recent Monday at midnight ISO`, NOT 7 days ago
- "last 7 days" → `from: 7 days ago ISO`, `to: now ISO`
- Always use ISO 8601 with milliseconds: `2026-03-02T00:00:00.000Z`

**Critical:** "this week" means Monday of the current week, not 7 days ago. To find last Monday: subtract `(today.getDay() + 6) % 7` days from today.
e.g. Wednesday March 5 (day=3): (3+6)%7 = 2 → subtract 2 days → Monday March 3

**Always include `endedAt`** in fields — it is required to compute session durations.

## Context Management: Per-Session Detail

When the report requires activity summaries for each session (not just `firstPrompt`), fetching all session logs in a single `get_session_logs` call for a date range can exceed context limits for busy weeks.

**Use the session-by-session approach:**

1. Call `get_sessions_summary` first to get session IDs and metadata
2. For each session, call `get_session_logs` with `sessionId` filter and `userMessages`/`toolsUsed` fields
3. Extract key activities from that session's messages (3–5 bullet points, see **Activity voice** below)
4. Keep only the compact summary — discard the raw messages
5. Repeat for the next session
6. Build HTML from the accumulated summaries

This keeps context usage flat regardless of how many sessions the week contains.

**When to use session-by-session:**

- Report requires per-session activity summaries (not just first prompt)
- Report includes tool usage analysis per session
- Date range covers more than ~3 days with several sessions

**When a single bulk call is fine:**

- Report only needs `firstPrompt`, duration, message count (use `get_sessions_summary`)
- Small date range with few sessions

**If a session returns a saved file** (result too large for context): use Bash + python/jq to extract only `userMessages[].text` from the saved file rather than loading it whole.

## Step 2: Compute Derived Metrics

Compute these before building HTML. Skip any metric you don't have data for — never invent placeholder values.

- Session duration: `new Date(endedAt) - new Date(startedAt)` → format as `Xh Ym`
- Total hours per day: sum durations for sessions sharing the same date
- Most active day: day with highest total duration
- Most-used tools: count occurrences across all `toolsUsed` arrays

**Note parallel sessions:** If sessions on the same project overlap in time, note it in the report — don't double-count hours silently.

## Step 3: Build HTML — Scale to Data Volume

**Small (1–5 sessions, single day):** Simple `<table>` with one row per session. No charts.

**Medium (1–2 weeks, 1–3 projects):** Sessions grouped by day. Highlights bar (most active day, total time, top tools).

**Large (multiple projects, 2+ weeks):** Cards per project. Consider a Chart.js bar chart for daily activity — load from CDN only if a chart genuinely adds value.

### Sections — include only if you have data:

```html
<header>
  <h1>Coding Session Report</h1>
  <p class="meta">[date range] · [N sessions] · [X total hours]</p>
</header>

<!-- Always include -->
<section id="sessions">
  <!-- table or grouped list of sessions with duration, project, message count -->
</section>

<!-- Include if >3 sessions -->
<section id="highlights">
  <p>Most active day: [day] ([Xh Ym])</p>
  <p>Longest session: [project] on [date] ([Xh Ym])</p>
  <p>Most-used tools: tool1, tool2, tool3</p>
</section>

<!-- Include only if list_subagents was called and returned data -->
<section id="subagents">...</section>

<!-- Include only if search_sessions was called -->
<section id="search-results">...</section>

<!-- Always include — exact text required -->
<footer>Generated by MCP Coding Insights</footer>
```

### HTML quality rules:

- Inline all CSS — no `<link>` tags
- Use semantic elements: `<table>`, `<section>`, `<time datetime="ISO">`, `<header>`, `<footer>`
- CDN only for Chart.js, only when a chart genuinely helps
- Format durations as `2h 14m`, never as raw minutes
- Do not fetch or display `firstPrompt` unless the user explicitly asks for it

### Activity voice

Write activity bullets from the **user's perspective** — what they built, explored, decided, or shipped — not from the assistant's perspective. Unless the user asks otherwise.

| User perspective (preferred)                                        | Assistant perspective (avoid)                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| "Built keyword search for session logs"                             | "Implemented search_sessions tool from plan using executing-plans skill" |
| "Added assistant message support to search"                         | "Extended search to also search assistant messages"                      |
| "Designed the html-reporter skill and wrote an implementation plan" | "Dispatched subagents to implement the skill"                            |
| "Shipped null-handling fixes to master"                             | "Completed TDD cycle; tests passing; merged feature branch"              |

**Rule:** Focus on _what was achieved_, not _how the assistant achieved it_. Omit references to skills invoked, subagents dispatched, or assistant methodology unless they are the actual subject of the work.

**Exception:** If the user explicitly asks for assistant-perspective ("what did you do", "show me your approach"), use assistant voice.

### Prompt text in activity summaries

**Do NOT include copies of prompt text in activity summaries by default.** Activity bullets should describe outcomes and work done — not quote or reproduce the user's messages.

- Do not copy `userMessages[].text` into the report verbatim
- Do not include `firstPrompt` anywhere in the report — omit it from fetched fields entirely
- Synthesize what the session accomplished; do not transcribe what was typed

**Exception:** If the user explicitly asks to include prompts (e.g. "show me the actual prompts", "include the message text"), then reproduce them.

## Step 4: Write and Open

Generate a short random string to make the filename unique, then write and open:

```bash
# Generate a 6-character hex string (macOS/Linux compatible)
SUFFIX=$(openssl rand -hex 3)
REPORT="/tmp/session-report-YYYY-MM-DD-${SUFFIX}.html"

# Write the file using the Write tool with the full path above
# Then open it
open "$REPORT"
```

The unique suffix prevents collisions when multiple reports are generated for the same date (e.g. iterating on a report, running the skill twice in one day).

**Do NOT use browser MCP tools to open the file.** Use the Bash tool with `open <path>`.

## Common Mistakes

| Mistake                                                  | Fix                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "This week" → 7 days ago                                 | "This week" → last Monday at midnight                                                            |
| Writing to project directory                             | Always write to `/tmp/session-report-YYYY-MM-DD-<suffix>.html`                                   |
| Opening with browser MCP tool                            | Use `open <path>` via Bash tool                                                                  |
| Footer text wrong                                        | Must be exactly: `Generated by MCP Coding Insights`                                              |
| Omitting `endedAt` from fields                           | Always include it — needed for duration calculation                                              |
| Including `firstPrompt` in fetched fields                | Omit it by default — only fetch if user explicitly asks                                          |
| Calling all tools by default                             | Call minimum tools for the stated intent                                                         |
| Empty sections                                           | Only render a section if you have data for it                                                    |
| Fetching all session logs at once for activity summaries | Use session-by-session approach: one `sessionId` at a time, summarise, discard raw data          |
| Including verbatim prompt text in activity summaries     | Summarise outcomes; never copy `userMessages[].text` into the report unless user explicitly asks |
