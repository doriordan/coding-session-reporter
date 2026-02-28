import * as path from 'node:path'
import { getProjectDirs, loadSubagentDetail } from '../transcripts.js'
import type { SubagentDetail } from '../types.js'

interface Params {
  agentId: string
  sessionId: string
  project: string
}

export async function buildSubagentDetail(params: Params): Promise<SubagentDetail | null> {
  const projectFilter = params.project.toLowerCase()
  const projects = getProjectDirs()
    .filter(p => p.name.toLowerCase().includes(projectFilter))

  if (projects.length === 0) return null

  const { dirPath } = projects[0]
  const subagentPath = path.join(dirPath, params.sessionId, 'subagents', `agent-${params.agentId}.jsonl`)
  return loadSubagentDetail(subagentPath)
}
