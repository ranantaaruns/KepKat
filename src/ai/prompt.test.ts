import { describe, expect, it } from 'vitest'
import { createEmptyProject } from '../editor/defaults'
import { buildProviderMessages } from './prompt'
import { createProjectSnapshot } from './snapshot'

describe('buildProviderMessages', () => {
  it('uses one leading system message and alternates chat roles', () => {
    const project = createEmptyProject()
    const snapshot = createProjectSnapshot(project, null, 0)
    const messages = buildProviderMessages(
      'confirm',
      [
        { role: 'assistant', content: 'Dropped leading assistant message' },
        { role: 'user', content: 'First' },
        { role: 'user', content: 'Second' },
        { role: 'assistant', content: 'Answer' },
        { role: 'user', content: 'Third' },
      ],
      snapshot,
    )

    expect(messages.filter((item) => item.role === 'system')).toHaveLength(1)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain('<project_snapshot>')
    expect(messages.slice(1).map((item) => item.role)).toEqual(['user', 'assistant', 'user'])
    expect(messages[1].content).toBe('First\n\nSecond')
  })
})
