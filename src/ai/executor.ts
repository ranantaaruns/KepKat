import { current, produce } from 'immer'
import { t } from '../i18n'
import type { Clip, Keyframe, Project, Track, TrackKind, TransitionType } from '../editor/types'
import { createTextClip, projectDimensions, uid } from '../editor/defaults'
import { addKeyframe, EASING_PRESETS, scaleKeyframes, textAnimationKeyframes } from '../editor/keyframes'
import { gradeForFilter, STYLE_PACKS } from '../editor/presets'
import { clipEnd, getTrackForKind, previousClip, sourceDuration } from '../editor/timelineMath'
import type { AgentAction, AgentPlan } from './schema'
import { AgentPlanError } from './types'

export interface AgentExecutionResult {
  project: Project
  selectedClipId: string | null
  applied: number
}

const findClip = (project: Project, clipId: string): Clip => {
  const target = project.clips.find((item) => item.id === clipId)
  if (!target) throw new AgentPlanError('missing_clip', `Clip ${clipId} was not found.`)
  return target
}

const findTrack = (project: Project, trackId: string): Track => {
  const target = project.tracks.find((item) => item.id === trackId)
  if (!target) throw new AgentPlanError('missing_track', `Track ${trackId} was not found.`)
  return target
}

const assertEditable = (project: Project, target: Clip): void => {
  const targetTrack = project.tracks.find((item) => item.id === target.trackId)
  if (targetTrack?.locked) {
    throw new AgentPlanError('locked_track', `Track ${targetTrack.name} is locked.`)
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

const addTrack = (project: Project, kind: Exclude<TrackKind, 'video'>): void => {
  const count = project.tracks.filter((item) => item.kind === kind).length + 1
  const labels: Record<Exclude<TrackKind, 'video'>, string> = {
    overlay: t('trackKind.overlay'),
    text: t('trackKind.text'),
    audio: t('trackKind.audio'),
  }
  const next: Track = {
    id: uid(),
    name: `${labels[kind]} ${count}`,
    kind,
    muted: false,
    hidden: false,
    locked: false,
    volume: 1,
  }
  if (kind === 'text') {
    project.tracks.unshift(next)
    return
  }
  if (kind === 'overlay') {
    const lastOverlay = project.tracks.map((item) => item.kind).lastIndexOf('overlay')
    project.tracks.splice(lastOverlay + 1, 0, next)
    return
  }
  project.tracks.push(next)
}

const applyTransition = (
  project: Project,
  target: Clip,
  transition: string | null,
  duration?: number,
  required = true,
): void => {
  if (transition === null) {
    if (target.transitionIn) {
      target.start += target.transitionIn.duration
      delete target.transitionIn
    }
    return
  }
  const previous = previousClip(project, target)
  if (!previous) {
    if (!required) return
    throw new AgentPlanError(
      'missing_previous_clip',
      `Clip ${target.name} has no previous clip for a transition.`,
    )
  }
  const base = duration ?? Math.max(0.12, Math.min(1.2, target.duration * 0.45, previous.duration * 0.45))
  const safe = Math.max(0.12, Math.min(base, target.duration * 0.45, previous.duration * 0.45))
  target.transitionIn = { type: transition as TransitionType, duration: safe, direction: 'left' }
  target.start = Math.max(0, clipEnd(previous) - safe)
}

const applyKeyframe = (target: Clip, action: Extract<AgentAction, { type: 'add_keyframe' }>): void => {
  const time = clamp(action.time, 0, target.duration)
  const ranges: Record<typeof action.property, [number, number]> = {
    x: [-1920, 1920],
    y: [-1920, 1920],
    scale: [0.05, 4],
    rotation: [-360, 360],
    opacity: [0, 1],
    volume: [0, 2],
  }
  const [min, max] = ranges[action.property]
  const value = clamp(action.value, min, max)
  const easing = EASING_PRESETS.find((item) => item.id === action.easing)?.easing
  const keyframes = addKeyframe(target.keyframes[action.property], time, value)
  target.keyframes[action.property] = keyframes.map((frame: Keyframe) => {
    if (!easing || Math.abs(frame.time - time) > 0.035) return frame
    return { ...frame, easing: [...easing] as Keyframe['easing'] }
  }) as Keyframe[]
}

const splitClip = (project: Project, target: Clip, at: number): Clip => {
  const local = at - target.start
  if (local <= 0.05 || local >= target.duration - 0.05) {
    throw new AgentPlanError(
      'invalid_split',
      `Split time ${at}s is outside the editable range of ${target.name}.`,
    )
  }
  const next: Clip = {
    ...structuredClone(current(target)),
    id: uid(),
    start: target.start + local,
    duration: target.duration - local,
    sourceIn:
      target.type === 'image' || target.type === 'text'
        ? 0
        : target.sourceIn + local * target.speed,
    sourceOut: target.sourceOut,
    transitionIn: undefined,
    keyframes: {},
  }
  target.duration = local
  target.sourceOut =
    target.type === 'image' || target.type === 'text'
      ? local
      : target.sourceIn + local * target.speed
  project.clips.push(next)
  return next
}

const applyAction = (
  project: Project,
  action: AgentAction,
  selectedClipId: string | null,
): string | null => {
  switch (action.type) {
    case 'add_text': {
      const targetTrack = action.trackId
        ? findTrack(project, action.trackId)
        : getTrackForKind(project, 'text')
      if (!targetTrack) throw new AgentPlanError('no_text_track', 'No text track is available.')
      if (targetTrack.kind !== 'text') {
        throw new AgentPlanError('missing_track', `Track ${targetTrack.name} is not a text track.`)
      }
      if (targetTrack.locked) {
        throw new AgentPlanError('locked_track', `Track ${targetTrack.name} is locked.`)
      }
      const start = Math.max(0, action.start)
      const duration = clamp(action.duration, 0.1, 60)
      const next = createTextClip(targetTrack.id, start, action.content)
      next.duration = duration
      next.sourceOut = duration
      next.name = action.content.slice(0, 120)
      if (next.text) {
        Object.assign(next.text, action.style)
      }
      if (action.animation) {
        next.keyframes = textAnimationKeyframes(action.animation, duration)
      }
      project.clips.push(next)
      return next.id
    }
    case 'update_text': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      if (!target.text) {
        throw new AgentPlanError('invalid_text_clip', `Clip ${target.name} is not a text clip.`)
      }
      if (action.content) {
        target.text.content = action.content
        target.name = action.content.slice(0, 120)
      }
      if (action.style) Object.assign(target.text, action.style)
      return selectedClipId
    }
    case 'move_clip': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      target.start = Math.max(0, action.start)
      return selectedClipId
    }
    case 'trim_clip': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      if (action.start === undefined && action.duration === undefined) {
        throw new AgentPlanError('invalid_trim', 'Trim requires a start or duration.')
      }
      if (action.start !== undefined) target.start = Math.max(0, action.start)
      if (action.duration !== undefined) {
        if (target.type === 'image' || target.type === 'text') {
          target.duration = Math.max(0.1, action.duration)
          target.sourceOut = target.duration
        } else {
          const maxDuration = sourceDuration(target) / target.speed
          target.duration = Math.max(0.1, Math.min(action.duration, maxDuration))
          target.sourceOut = target.sourceIn + target.duration * target.speed
        }
        target.fadeIn = Math.min(target.fadeIn, target.duration / 2)
        target.fadeOut = Math.min(target.fadeOut, target.duration / 2)
      }
      return selectedClipId
    }
    case 'split_clip': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      return splitClip(project, target, action.at).id
    }
    case 'delete_clip': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      project.clips = project.clips.filter((item) => item.id !== target.id)
      return selectedClipId === target.id ? null : selectedClipId
    }
    case 'duplicate_clip': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      const copy: Clip = {
        ...structuredClone(current(target)),
        id: uid(),
        name: t('defaults.copySuffix', { name: target.name }),
        start: clipEnd(target) + 0.1,
        transitionIn: undefined,
        keyframes: structuredClone(current(target).keyframes),
      }
      project.clips.push(copy)
      return copy.id
    }
    case 'set_filter': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      target.filterId = action.filterId
      target.grade = gradeForFilter(action.filterId)
      return selectedClipId
    }
    case 'set_color_grade': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      Object.assign(target.grade, action.grade)
      target.filterId = 'custom'
      return selectedClipId
    }
    case 'set_transform': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      Object.assign(target.transform, action.transform)
      return selectedClipId
    }
    case 'set_chroma': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      Object.assign(target.chroma, action.chroma)
      return selectedClipId
    }
    case 'set_transition': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      applyTransition(project, target, action.transition, action.duration)
      return selectedClipId
    }
    case 'set_speed': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      if (target.type !== 'video' && target.type !== 'audio') return selectedClipId
      const speed = clamp(action.speed, 0.25, 4)
      const source = sourceDuration(target)
      if (source <= 0) return selectedClipId
      const oldDuration = target.duration
      const nextDuration = Math.max(0.1, source / speed)
      const factor = nextDuration / oldDuration
      target.speed = speed
      target.duration = nextDuration
      target.fadeIn = Math.min(target.fadeIn, nextDuration)
      target.fadeOut = Math.min(target.fadeOut, nextDuration)
      target.keyframes = scaleKeyframes(target.keyframes, factor)
      if (action.preservePitch !== undefined) target.preservePitch = action.preservePitch
      return selectedClipId
    }
    case 'set_audio': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      if (action.volume !== undefined) target.volume = clamp(action.volume, 0, 2)
      if (action.muted !== undefined) target.muted = action.muted
      if (action.fadeIn !== undefined) target.fadeIn = clamp(action.fadeIn, 0, target.duration / 2)
      if (action.fadeOut !== undefined) target.fadeOut = clamp(action.fadeOut, 0, target.duration / 2)
      if (action.volume === undefined && action.muted === undefined && action.fadeIn === undefined && action.fadeOut === undefined) {
        throw new AgentPlanError('no_changes', 'Audio action did not include any changes.')
      }
      return selectedClipId
    }
    case 'add_keyframe': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      applyKeyframe(target, action)
      return selectedClipId
    }
    case 'apply_style_pack': {
      const target = findClip(project, action.clipId)
      assertEditable(project, target)
      const style = STYLE_PACKS.find((item) => item.id === action.styleId)
      if (!style) throw new AgentPlanError('missing_style', `Style ${action.styleId} was not found.`)
      target.filterId = style.filterId
      target.grade = gradeForFilter(style.filterId)
      applyTransition(project, target, style.transition, undefined, false)
      return selectedClipId
    }
    case 'add_track': {
      addTrack(project, action.kind)
      return selectedClipId
    }
    case 'set_project_settings': {
      if (action.aspect) {
        const { width, height } = projectDimensions(action.aspect, '1080p')
        project.width = width
        project.height = height
      }
      if (action.fps) project.fps = action.fps
      if (action.background) project.background = action.background
      if (action.name) project.name = action.name
      return selectedClipId
    }
    default:
      throw new AgentPlanError('unsupported', 'The action is not supported.')
  }
}

export const executeAgentPlan = (
  project: Project,
  plan: AgentPlan,
  selectedClipId: string | null,
): AgentExecutionResult => {
  let nextSelected = selectedClipId
  let applied = 0
  const next = produce(project, (draft) => {
    for (const action of plan.actions) {
      nextSelected = applyAction(draft, action, nextSelected)
      applied += 1
    }
  })
  return {
    project: { ...next, updatedAt: Date.now() },
    selectedClipId: nextSelected,
    applied,
  }
}
