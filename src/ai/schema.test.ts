import { describe, expect, it } from 'vitest'
import { FILTER_PRESETS, STYLE_PACKS, TRANSITION_PRESETS } from '../editor/presets'
import {
  agentPlanSchema,
  FILTER_PRESET_IDS,
  STYLE_PACK_IDS,
  TRANSITION_PRESET_IDS,
} from './schema'

const validPlan = {
  title: 'Tighten the intro',
  summary: 'Trim the first clip and add a title.',
  actions: [
    { type: 'trim_clip', clipId: 'clip-1', duration: 4.5 },
    { type: 'add_text', start: 0.5, duration: 3, content: 'A new story' },
  ],
}

describe('agentPlanSchema', () => {
  it('accepts a valid plan', () => {
    expect(agentPlanSchema.safeParse(validPlan).success).toBe(true)
  })

  it('rejects unknown actions', () => {
    const result = agentPlanSchema.safeParse({
      ...validPlan,
      actions: [{ type: 'delete_project', clipId: 'clip-1' }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than 25 actions', () => {
    const result = agentPlanSchema.safeParse({
      ...validPlan,
      actions: Array.from({ length: 26 }, () => ({
        type: 'add_text',
        start: 0,
        duration: 2,
        content: 'Title',
      })),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid colors and out-of-range speed', () => {
    expect(
      agentPlanSchema.safeParse({
        ...validPlan,
        actions: [{ type: 'set_chroma', clipId: 'clip-1', chroma: { color: 'red' } }],
      }).success,
    ).toBe(false)
    expect(
      agentPlanSchema.safeParse({
        ...validPlan,
        actions: [{ type: 'set_speed', clipId: 'clip-1', speed: 20 }],
      }).success,
    ).toBe(false)
  })

  it('keeps preset ids in sync with the editor presets', () => {
    expect(FILTER_PRESETS.map((item) => item.id)).toEqual([...FILTER_PRESET_IDS])
    expect(TRANSITION_PRESETS.map((item) => item.type)).toEqual([...TRANSITION_PRESET_IDS])
    expect(STYLE_PACKS.map((item) => item.id)).toEqual([...STYLE_PACK_IDS])
  })
})
