import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as transcripts from '../src/transcripts.js'

vi.mock('../src/transcripts.js')

import { buildSessionLogs } from '../src/tools/getSessionLogs.js'

const mockDetail = {
  sessionId: 'a', project: 'skuber', gitBranch: 'cats',
  startedAt: '2026-02-16T10:00:00Z', endedAt: '2026-02-16T12:00:00Z',
  firstPrompt: 'build thing', messageCount: 3,
  userMessages: ['build thing', 'lgtm'],
  toolsUsed: ['Bash', 'Read'],
}

function setupMocks() {
  vi.mocked(transcripts.getProjectDirs).mockReturnValue([
    { name: 'skuber', dirPath: '/projects/skuber' },
  ])
  vi.mocked(transcripts.loadSessionsIndex).mockReturnValue({
    version: 1,
    entries: [{
      sessionId: 'a', fullPath: '/projects/skuber/a.jsonl', firstPrompt: 'build thing',
      summary: '', messageCount: 3, created: '2026-02-16T10:00:00Z', modified: '2026-02-16T12:00:00Z',
      gitBranch: 'cats', projectPath: '', isSidechain: false,
    }],
  })
  vi.mocked(transcripts.parseSessionsFromIndex).mockReturnValue([{
    sessionId: 'a', project: 'skuber', gitBranch: 'cats',
    startedAt: '2026-02-16T10:00:00Z', firstPrompt: 'build thing', messageCount: 3,
  }])
  vi.mocked(transcripts.filterEntriesByDateRange).mockImplementation(entries => entries)
  vi.mocked(transcripts.parseDetailFromJsonl).mockResolvedValue(mockDetail)
}

describe('buildSessionLogs', () => {
  beforeEach(() => { vi.resetAllMocks(); setupMocks() })

  it('returns session details grouped by project', async () => {
    const result = await buildSessionLogs({ from: '2026-02-14', to: '2026-02-28' })
    expect(result).toHaveProperty('skuber')
    expect(result['skuber']).toHaveLength(1)
    expect(result['skuber'][0].toolsUsed).toEqual(['Bash', 'Read'])
  })

  it('projects only requested fields when fields param is provided', async () => {
    const result = await buildSessionLogs({
      from: '2026-02-14', to: '2026-02-28',
      fields: ['project', 'gitBranch', 'startedAt', 'endedAt', 'firstPrompt', 'userMessages', 'toolsUsed'],
    })
    const session = result['skuber'][0]
    expect(session).toHaveProperty('project', 'skuber')
    expect(session).toHaveProperty('gitBranch', 'cats')
    expect(session).toHaveProperty('userMessages')
    expect(session).toHaveProperty('toolsUsed')
    expect(session).not.toHaveProperty('sessionId')
    expect(session).not.toHaveProperty('messageCount')
    expect(session).not.toHaveProperty('subagents')
  })

  it('returns all fields when fields param is omitted', async () => {
    const result = await buildSessionLogs({ from: '2026-02-14', to: '2026-02-28' })
    const session = result['skuber'][0]
    expect(session).toHaveProperty('sessionId')
    expect(session).toHaveProperty('messageCount')
  })
})
