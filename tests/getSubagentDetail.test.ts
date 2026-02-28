import { describe, it, expect, vi } from 'vitest'
import * as transcripts from '../src/transcripts.js'
import * as path from 'node:path'
import * as os from 'node:os'

vi.mock('../src/transcripts.js')

import { buildSubagentDetail } from '../src/tools/getSubagentDetail.js'

describe('buildSubagentDetail', () => {
  it('returns detail for a matching subagent', async () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([
      { name: 'skuber', dirPath: path.join(os.homedir(), '.claude', 'projects', '-Users-dave-dev-repo-skuber') },
    ])
    vi.mocked(transcripts.loadSubagentDetail).mockResolvedValue({
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1',
      firstPrompt: 'Do the thing', messageCount: 12,
      startedAt: '2026-02-28T10:00:00Z', endedAt: '2026-02-28T10:10:00Z',
      userMessages: ['Do the thing', 'Done?'],
      toolsUsed: ['Bash', 'Read'],
    })

    const result = await buildSubagentDetail({
      agentId: 'abc123', sessionId: 'sess-1', project: 'skuber',
    })
    expect(result).not.toBeNull()
    expect(result?.agentId).toBe('abc123')
    expect(result?.userMessages).toEqual(['Do the thing', 'Done?'])
  })

  it('returns null when project not found', async () => {
    vi.mocked(transcripts.getProjectDirs).mockReturnValue([])
    const result = await buildSubagentDetail({
      agentId: 'abc123', sessionId: 'sess-1', project: 'nonexistent',
    })
    expect(result).toBeNull()
  })
})
