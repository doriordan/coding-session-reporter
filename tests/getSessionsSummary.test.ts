import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as transcripts from '../src/transcripts.js'

vi.mock('../src/transcripts.js')

import { buildSessionsSummary } from '../src/tools/getSessionsSummary.js'

const entry = (id: string, created: string, branch = 'main') => ({
  sessionId: id, fullPath: '', firstPrompt: `prompt ${id}`, summary: '',
  messageCount: 5, created, modified: created,
  gitBranch: branch, projectPath: '', isSidechain: false,
})

describe('buildSessionsSummary', () => {
  beforeEach(() => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([
      { name: 'skuber', dirPath: '/projects/skuber' },
      { name: 'other', dirPath: '/projects/other' },
    ])
    vi.mocked(transcripts.loadSessionsIndex).mockImplementation((dir) => {
      if (dir.includes('skuber')) {
        return { version: 1, entries: [
          entry('a', '2026-02-16T10:00:00Z', 'cats'),
          entry('b', '2026-02-10T10:00:00Z', 'main'),
        ]}
      }
      return { version: 1, entries: [entry('c', '2026-02-17T10:00:00Z')] }
    })
    vi.mocked(transcripts.parseSessionsFromIndex).mockImplementation((project, entries) =>
      entries.map(e => ({ sessionId: e.sessionId, project, gitBranch: e.gitBranch, startedAt: e.created, firstPrompt: e.firstPrompt, messageCount: e.messageCount }))
    )
    vi.mocked(transcripts.filterEntriesByDateRange).mockImplementation((entries, from, to) =>
      entries.filter(e => e.created >= from && e.modified <= to + 'T23:59:59Z')
    )
  })

  it('returns summaries for all projects in range', () => {
    const results = buildSessionsSummary({ from: '2026-02-14', to: '2026-02-28' })
    expect(results.map(r => r.sessionId)).toContain('a')
    expect(results.map(r => r.sessionId)).toContain('c')
    expect(results.map(r => r.sessionId)).not.toContain('b') // before range
  })

  it('filters by project name case-insensitively', () => {
    const results = buildSessionsSummary({ from: '2026-02-01', to: '2026-02-28', project: 'SKUBER' })
    expect(results.every(r => r.project === 'skuber')).toBe(true)
  })
})
