import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'

// We mock fs so tests don't touch real disk
vi.mock('node:fs')
vi.mock('node:fs/promises')

import {
  decodeProjectName,
  parseSessionsFromIndex,
  filterByDateRange,
  filterEntriesByDateRange,
  loadSubagentSummaries,
  loadSubagentDetail,
  parseDetailFromJsonl,
} from '../src/transcripts.js'

describe('decodeProjectName', () => {
  it('decodes hyphen-separated path to last segment', () => {
    expect(decodeProjectName('-Users-dave-dev-repo-skuber')).toBe('skuber')
  })

  it('handles multi-word last segment', () => {
    expect(decodeProjectName('-Users-dave-dev-repo-my-project')).toBe('my-project')
  })

  it('decodes skuber-operator correctly', () => {
    expect(decodeProjectName('-Users-dave-dev-repo-skuber-operator')).toBe('skuber-operator')
  })
})

describe('parseSessionsFromIndex', () => {
  it('maps index entries to SessionSummary', () => {
    const entries = [{
      sessionId: 'abc-123',
      fullPath: '/some/path.jsonl',
      firstPrompt: 'build me a thing',
      summary: 'Built a thing',
      messageCount: 10,
      created: '2026-02-16T10:00:00.000Z',
      modified: '2026-02-16T11:00:00.000Z',
      gitBranch: 'main',
      projectPath: '/Users/dave/dev/repo/skuber',
      isSidechain: false,
    }]

    const results = parseSessionsFromIndex('skuber', entries)
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      sessionId: 'abc-123',
      project: 'skuber',
      gitBranch: 'main',
      startedAt: '2026-02-16T10:00:00.000Z',
      firstPrompt: 'build me a thing',
      messageCount: 10,
    })
  })

  it('excludes sidechains', () => {
    const entries = [{
      sessionId: 'abc-123',
      fullPath: '/some/path.jsonl',
      firstPrompt: 'build me a thing',
      summary: '',
      messageCount: 5,
      created: '2026-02-16T10:00:00.000Z',
      modified: '2026-02-16T11:00:00.000Z',
      gitBranch: 'main',
      projectPath: '/Users/dave/dev/repo/skuber',
      isSidechain: true,
    }]

    const results = parseSessionsFromIndex('skuber', entries)
    expect(results).toHaveLength(0)
  })
})

describe('filterEntriesByDateRange', () => {
  const makeEntry = (created: string, modified: string, sessionId = 'sess') => ({
    sessionId,
    fullPath: '/path.jsonl',
    firstPrompt: 'test',
    summary: '',
    messageCount: 10,
    created,
    modified,
    gitBranch: 'main',
    projectPath: '/repo',
    isSidechain: false,
  })

  it('includes a session that started before the range but had activity within it', () => {
    const entries = [makeEntry('2026-02-13T14:00:00.000Z', '2026-02-16T16:57:00.000Z')]
    const result = filterEntriesByDateRange(entries, '2026-02-16', '2026-02-16')
    expect(result).toHaveLength(1)
  })

  it('includes a session entirely within the range', () => {
    const entries = [makeEntry('2026-02-16T10:00:00.000Z', '2026-02-16T11:00:00.000Z')]
    const result = filterEntriesByDateRange(entries, '2026-02-16', '2026-02-16')
    expect(result).toHaveLength(1)
  })

  it('excludes a session that ended before the range', () => {
    const entries = [makeEntry('2026-02-10T10:00:00.000Z', '2026-02-10T12:00:00.000Z')]
    const result = filterEntriesByDateRange(entries, '2026-02-16', '2026-02-16')
    expect(result).toHaveLength(0)
  })

  it('excludes a session that started after the range', () => {
    const entries = [makeEntry('2026-02-20T10:00:00.000Z', '2026-02-20T12:00:00.000Z')]
    const result = filterEntriesByDateRange(entries, '2026-02-16', '2026-02-16')
    expect(result).toHaveLength(0)
  })

  it('handles date-only to string with end-of-day boundary', () => {
    const entries = [makeEntry('2026-02-28T23:59:00.000Z', '2026-02-28T23:59:59.000Z')]
    const result = filterEntriesByDateRange(entries, '2026-02-28', '2026-02-28')
    expect(result).toHaveLength(1)
  })
})

describe('filterByDateRange', () => {
  it('filters sessions outside date range', () => {
    const sessions = [
      { startedAt: '2026-02-10T10:00:00Z', sessionId: 'a', project: 'p', gitBranch: 'main', firstPrompt: '', messageCount: 1 },
      { startedAt: '2026-02-20T10:00:00Z', sessionId: 'b', project: 'p', gitBranch: 'main', firstPrompt: '', messageCount: 1 },
    ]
    const result = filterByDateRange(sessions, '2026-02-15', '2026-02-28')
    expect(result).toHaveLength(1)
    expect(result[0].sessionId).toBe('b')
  })

  it('includes sessions on the to date (end-of-day boundary)', () => {
    const sessions = [
      { startedAt: '2026-02-28T14:00:00Z', sessionId: 'c', project: 'p', gitBranch: 'main', firstPrompt: '', messageCount: 1 },
    ]
    const result = filterByDateRange(sessions, '2026-02-14', '2026-02-28')
    expect(result).toHaveLength(1)
    expect(result[0].sessionId).toBe('c')
  })
})

describe('loadSubagentSummaries', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns empty array when subagents dir does not exist', async () => {
    vi.mocked(fsp.readdir as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    const result = await loadSubagentSummaries('/projects/skuber/sess-abc')
    expect(result).toEqual([])
  })

  it('skips files not matching agent-*.jsonl pattern', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fsp.readdir as any).mockResolvedValue(['agent-abc123.jsonl', 'other-file.jsonl', 'README.txt'])
    vi.mocked(fsp.readFile as any).mockResolvedValue(
      JSON.stringify({
        agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1', isSidechain: true,
        timestamp: '2026-02-28T10:00:00Z',
        message: { role: 'user', content: 'Do the thing' }
      }) + '\n'
    )
    const result = await loadSubagentSummaries('/projects/skuber/sess-abc')
    expect(result).toHaveLength(1)
    expect(result[0].agentId).toBe('abc123')
  })

  it('parses agentId, slug, messageCount and toolsUsed from a subagent file', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fsp.readdir as any).mockResolvedValue(['agent-abc123.jsonl'])
    const line1 = JSON.stringify({
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1', isSidechain: true,
      timestamp: '2026-02-28T10:00:00Z',
      message: { role: 'user', content: 'Do the thing' }
    })
    const line2 = JSON.stringify({
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1', isSidechain: true,
      timestamp: '2026-02-28T10:01:00Z',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash' }] }
    })
    vi.mocked(fsp.readFile as any).mockResolvedValue(line1 + '\n' + line2 + '\n')

    const result = await loadSubagentSummaries('/projects/skuber/sess-abc')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      agentId: 'abc123',
      slug: 'cool-agent',
      sessionId: 'sess-1',
      firstPrompt: 'Do the thing',
      messageCount: 2,
      toolsUsed: ['Bash'],
    })
  })
})

describe('loadSubagentDetail', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns full detail for a subagent file', async () => {
    const line1 = JSON.stringify({
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1', isSidechain: true,
      timestamp: '2026-02-28T10:00:00Z',
      message: { role: 'user', content: 'Do the thing' }
    })
    const line2 = JSON.stringify({
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1', isSidechain: true,
      timestamp: '2026-02-28T10:05:00Z',
      message: { role: 'user', content: 'Follow up task' }
    })
    const line3 = JSON.stringify({
      agentId: 'abc123', slug: 'cool-agent', sessionId: 'sess-1', isSidechain: true,
      timestamp: '2026-02-28T10:06:00Z',
      message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] }
    })
    vi.mocked(fsp.readFile as any).mockResolvedValue(line1 + '\n' + line2 + '\n' + line3 + '\n')

    const result = await loadSubagentDetail('/projects/skuber/sess-abc/subagents/agent-abc123.jsonl')
    expect(result).toMatchObject({
      agentId: 'abc123',
      slug: 'cool-agent',
      startedAt: '2026-02-28T10:00:00Z',
      endedAt: '2026-02-28T10:06:00Z',
      firstPrompt: 'Do the thing',
      messageCount: 3,
      userMessages: ['Do the thing', 'Follow up task'],
      toolsUsed: ['Read'],
    })
  })

  it('returns null when file cannot be read', async () => {
    vi.mocked(fsp.readFile as any).mockRejectedValue(new Error('ENOENT'))
    const result = await loadSubagentDetail('/projects/skuber/sess-abc/subagents/agent-missing.jsonl')
    expect(result).toBeNull()
  })
})

describe('parseDetailFromJsonl with subagents', () => {
  beforeEach(() => vi.resetAllMocks())

  it('attaches subagent summaries to session detail', async () => {
    vi.mocked(fsp.readFile as any).mockResolvedValue(
      JSON.stringify({
        sessionId: 'sess-abc', gitBranch: 'main', isSidechain: false,
        timestamp: '2026-02-28T10:00:00Z',
        message: { role: 'user', content: 'do stuff' }
      }) + '\n'
    )
    // subagents dir does not exist → loadSubagentSummaries returns []
    vi.mocked(fsp.readdir as any).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const summary = {
      sessionId: 'sess-abc', project: 'skuber', gitBranch: 'main',
      startedAt: '2026-02-28T10:00:00Z', firstPrompt: 'do stuff', messageCount: 1,
    }
    const result = await parseDetailFromJsonl('skuber', summary, '/projects/skuber/sess-abc.jsonl')
    expect(result).toHaveProperty('subagents')
    expect(Array.isArray(result.subagents)).toBe(true)
    expect(result.subagents).toHaveLength(0)
  })
})
