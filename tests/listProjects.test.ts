import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as transcripts from '../src/transcripts.js'

vi.mock('../src/transcripts.js')

import { buildListProjects } from '../src/tools/listProjects.js'

describe('buildListProjects', () => {
  it('returns projects with session counts and last active date', () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([
      { name: 'skuber', dirPath: '/projects/skuber' },
    ])
    vi.mocked(transcripts.loadSessionsIndex).mockReturnValue({
      version: 1,
      entries: [
        {
          sessionId: 'a', fullPath: '', firstPrompt: '', summary: '', messageCount: 5,
          created: '2026-02-16T10:00:00Z', modified: '2026-02-16T12:00:00Z',
          gitBranch: 'main', projectPath: '', isSidechain: false,
        },
        {
          sessionId: 'b', fullPath: '', firstPrompt: '', summary: '', messageCount: 3,
          created: '2026-02-20T10:00:00Z', modified: '2026-02-20T11:00:00Z',
          gitBranch: 'cats', projectPath: '', isSidechain: false,
        },
      ],
    })

    const result = buildListProjects()
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'skuber',
      sessionCount: 2,
      lastActive: '2026-02-20T11:00:00Z',
    })
  })

  it('returns empty array when no projects', () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([])
    expect(buildListProjects()).toHaveLength(0)
  })
})
