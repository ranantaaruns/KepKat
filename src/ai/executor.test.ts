import { describe, expect, it } from 'vitest'
import { createEmptyProject, createTextClip } from '../editor/defaults'
import { getTrackForKind } from '../editor/timelineMath'
import { useEditorStore } from '../editor/store'
import type { Project } from '../editor/types'
import { executeAgentPlan } from './executor'
import type { AgentPlan } from './schema'
import { createProjectSnapshot } from './snapshot'
import { AgentPlanError } from './types'

const plan = (actions: AgentPlan['actions']): AgentPlan => ({
  title: 'Test plan',
  summary: 'Test summary',
  actions,
})

const projectWithText = (): { project: Project; clipId: string; trackId: string } => {
  const project = createEmptyProject()
  const track = getTrackForKind(project, 'text')
  if (!track) throw new Error('Missing text track')
  const clip = createTextClip(track.id, 1, 'Original title')
  project.clips.push(clip)
  return { project, clipId: clip.id, trackId: track.id }
}

describe('executeAgentPlan', () => {
  it('adds a text clip and respects the requested duration', () => {
    const project = createEmptyProject()
    const result = executeAgentPlan(
      project,
      plan([{ type: 'add_text', start: 2, duration: 6, content: 'Hello world' }]),
      null,
    )
    expect(result.applied).toBe(1)
    expect(result.project.clips).toHaveLength(1)
    const clip = result.project.clips[0]
    expect(clip.type).toBe('text')
    expect(clip.start).toBe(2)
    expect(clip.duration).toBe(6)
    expect(clip.text?.content).toBe('Hello world')
    expect(result.selectedClipId).toBe(clip.id)
  })

  it('splits a text clip at an absolute timeline time', () => {
    const { project, clipId } = projectWithText()
    const result = executeAgentPlan(project, plan([{ type: 'split_clip', clipId, at: 2 }]), clipId)
    expect(result.project.clips).toHaveLength(2)
    const left = result.project.clips.find((item) => item.id === clipId)
    const right = result.project.clips.find((item) => item.id !== clipId)
    expect(left?.duration).toBe(1)
    expect(right?.start).toBe(2)
    expect(right?.duration).toBe(3)
  })

  it('rejects edits on a locked track without changing the project', () => {
    const { project, clipId, trackId } = projectWithText()
    const track = project.tracks.find((item) => item.id === trackId)
    if (track) track.locked = true
    expect(() =>
      executeAgentPlan(project, plan([{ type: 'move_clip', clipId, start: 8 }]), clipId),
    ).toThrowError(AgentPlanError)
    expect(project.clips[0].start).toBe(1)
  })

  it('clamps keyframe values to the property range', () => {
    const { project, clipId } = projectWithText()
    const result = executeAgentPlan(
      project,
      plan([{ type: 'add_keyframe', clipId, property: 'opacity', time: 99, value: 4 }]),
      clipId,
    )
    const keyframe = result.project.clips[0].keyframes.opacity?.[0]
    expect(keyframe?.time).toBe(4)
    expect(keyframe?.value).toBe(1)
  })

  it('applies a style pack to the first clip without requiring a transition', () => {
    const { project, clipId } = projectWithText()
    const result = executeAgentPlan(
      project,
      plan([{ type: 'apply_style_pack', clipId, styleId: 'warm-film' }]),
      clipId,
    )
    const clip = result.project.clips[0]
    expect(clip.filterId).toBe('film')
    expect(clip.transitionIn).toBeUndefined()
  })

  it('requires a previous clip before adding a transition', () => {
    const { project, clipId } = projectWithText()
    expect(() =>
      executeAgentPlan(
        project,
        plan([{ type: 'set_transition', clipId, transition: 'dissolve' }]),
        clipId,
      ),
    ).toThrowError(AgentPlanError)
  })
})

describe('applyAgentPlan', () => {
  it('stores the whole plan as one undo step', () => {
    const { project, clipId } = projectWithText()
    useEditorStore.getState().restoreProject(project)
    const before = useEditorStore.getState().project

    useEditorStore.getState().applyAgentPlan(
      plan([
        { type: 'move_clip', clipId, start: 5 },
        { type: 'set_audio', clipId, volume: 0.5 },
        { type: 'update_text', clipId, content: 'Changed' },
      ]),
    )
    const after = useEditorStore.getState().project
    expect(after.clips[0].start).toBe(5)
    expect(after.clips[0].volume).toBe(0.5)
    expect(after.clips[0].text?.content).toBe('Changed')
    expect(useEditorStore.getState().historyPast).toHaveLength(1)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().project.clips[0]).toEqual(before.clips[0])
  })

  it('clamps the playhead when a plan shortens the project', () => {
    const { project, clipId } = projectWithText()
    useEditorStore.getState().restoreProject(project)
    useEditorStore.getState().setPlayhead(4.5)

    useEditorStore.getState().applyAgentPlan(plan([{ type: 'delete_clip', clipId }]))
    expect(useEditorStore.getState().playhead).toBe(0)
  })
})

describe('createProjectSnapshot', () => {
  it('omits media blobs, thumbnails, and waveforms', () => {
    const project = createEmptyProject()
    project.media.push({
      id: 'media-1',
      name: 'clip.mp4',
      kind: 'video',
      mime: 'video/mp4',
      duration: 10,
      width: 1920,
      height: 1080,
      hasAudio: true,
      thumbnail: 'data:image/png;base64,large',
      waveform: [0.1, 0.4, 0.9],
      createdAt: 1,
    })
    const snapshot = createProjectSnapshot(project, null, 0)
    const media = snapshot.media[0] as Record<string, unknown>
    expect(media.thumbnail).toBeUndefined()
    expect(media.waveform).toBeUndefined()
    expect(JSON.stringify(snapshot)).not.toContain('base64')
  })
})
