import { getProjectDirs, loadSessionsIndex } from '../transcripts.js'
import type { ProjectInfo } from '../types.js'

export function buildListProjects(): ProjectInfo[] {
  const projects = getProjectDirs()
  const results: ProjectInfo[] = []

  for (const { name, dirPath } of projects) {
    const index = loadSessionsIndex(dirPath)
    if (!index || index.entries.length === 0) continue

    const nonSidechain = index.entries.filter(e => !e.isSidechain)
    if (nonSidechain.length === 0) continue

    const lastActive = nonSidechain
      .map(e => e.modified)
      .sort()
      .at(-1) ?? ''

    results.push({
      name,
      path: dirPath,
      sessionCount: nonSidechain.length,
      lastActive,
    })
  }

  return results.sort((a, b) => b.lastActive.localeCompare(a.lastActive))
}
