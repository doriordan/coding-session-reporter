import {
  defaultDateRange, filterEntriesByDateRange, getProjectDirs,
  loadSessionsIndex, loadSubagentSummaries,
} from '../transcripts.js'
import type { SubagentSummary } from '../types.js'

interface Params {
  from?: string
  to?: string
  project?: string
}

export async function buildListSubagents(params: Params): Promise<Record<string, SubagentSummary[]>> {
  const { from, to } = { ...defaultDateRange(), ...params }
  const projectFilter = params.project?.toLowerCase()

  const projects = getProjectDirs()
    .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter))

  const grouped: Record<string, SubagentSummary[]> = {}

  for (const { name, dirPath } of projects) {
    const index = loadSessionsIndex(dirPath)
    if (!index) continue

    const entries = filterEntriesByDateRange(index.entries, from, to)
      .filter(e => !e.isSidechain)

    const results = await Promise.all(entries.map(async entry => {
      const sessionDir = entry.fullPath.replace(/\.jsonl$/, '')
      return loadSubagentSummaries(sessionDir)
    }))
    const allSubagents = results.flat()

    if (allSubagents.length > 0) {
      grouped[name] = allSubagents
    }
  }

  return grouped
}
