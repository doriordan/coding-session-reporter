import { describe, it, expect, vi } from 'vitest'
import * as transcripts from '../src/transcripts.js'

vi.mock('../src/transcripts.js')

import { buildListSubagents } from '../src/tools/listSubagents.js'

describe('buildListSubagents', () => {
  it('returns subagent summaries grouped by project', async () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([
      { name: 'skuber', dirPath: '/projects/skuber' },
    ])
    vi.mocked(transcripts.loadSessionsIndex).mockReturnValue({
      version: 1,
      entries: [{
        sessionId: 'sess-1', fullPath: '/projects/skuber/sess-1.jsonl',
        firstPrompt: 'build thing', summary: '', messageCount: 5,
        created: '2026-02-28T10:00:00Z', modified: '2026-02-28T11:00:00Z',
        gitBranch: 'main', projectPath: '', isSidechain: false,
      }],
    })
    vi.mocked(transcripts.filterEntriesByDateRange).mockImplementation(entries => entries)
    vi.mocked(transcripts.loadSubagentSummaries).mockResolvedValue([{
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1',
      firstPrompt: 'Do the thing', messageCount: 12, toolsUsed: ['Bash', 'Read'],
    }])

    const result = await buildListSubagents({ from: '2026-02-28', to: '2026-02-28' })
    expect(result).toHaveProperty('skuber')
    expect(result['skuber']).toHaveLength(1)
    expect(result['skuber'][0]).toMatchObject({
      agentId: 'abc123',
      slug: 'cool-agent',
      sessionId: 'sess-1',
      firstPrompt: 'Do the thing',
      messageCount: 12,
      toolsUsed: ['Bash', 'Read'],
    })
  })

  it('returns empty object when no subagents exist', async () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([
      { name: 'skuber', dirPath: '/projects/skuber' },
    ])
    vi.mocked(transcripts.loadSessionsIndex).mockReturnValue({
      version: 1,
      entries: [{
        sessionId: 'sess-1', fullPath: '/projects/skuber/sess-1.jsonl',
        firstPrompt: 'build thing', summary: '', messageCount: 5,
        created: '2026-02-28T10:00:00Z', modified: '2026-02-28T11:00:00Z',
        gitBranch: 'main', projectPath: '', isSidechain: false,
      }],
    })
    vi.mocked(transcripts.filterEntriesByDateRange).mockImplementation(entries => entries)
    vi.mocked(transcripts.loadSubagentSummaries).mockResolvedValue([])

    const result = await buildListSubagents({ from: '2026-02-28', to: '2026-02-28' })
    expect(result).toEqual({})
  })
})
