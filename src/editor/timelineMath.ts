import { t, type TranslationKey } from '../i18n'
import type { Clip, MediaAsset, Project, Track, TrackKind } from './types'

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const clipEnd = (clip: Clip): number => clip.start + clip.duration

export const projectDuration = (project: Project): number =>
  project.clips.reduce((max, clip) => Math.max(max, clipEnd(clip)), 0)

export const track = (project: Project, trackId: string): Track | undefined =>
  project.tracks.find((item) => item.id === trackId)

export const clip = (project: Project, clipId: string | null): Clip | undefined =>
  clipId ? project.clips.find((item) => item.id === clipId) : undefined

export const media = (project: Project, mediaId?: string): MediaAsset | undefined =>
  mediaId ? project.media.find((item) => item.id === mediaId) : undefined

export const clipsOnTrack = (project: Project, trackId: string): Clip[] =>
  project.clips
    .filter((item) => item.trackId === trackId)
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))

export const activeClipsOnTrack = (project: Project, trackId: string, time: number): Clip[] =>
  clipsOnTrack(project, trackId).filter(
    (item) => time >= item.start - 0.0001 && time < clipEnd(item) - 0.0001,
  )

export const visualTracks = (project: Project): Track[] =>
  [...project.tracks]
    .reverse()
    .filter((item) => item.kind !== 'audio' && !item.hidden)

export const audioTracks = (project: Project): Track[] =>
  project.tracks.filter((item) => item.kind === 'audio')

export const getTrackForKind = (project: Project, kind: TrackKind): Track | undefined =>
  project.tracks.find((item) => item.kind === kind)

export const sourceTimeFor = (clip: Clip, localTime: number): number => {
  if (clip.type === 'image' || clip.type === 'text') return localTime
  return clip.sourceIn + localTime * clip.speed
}

export const sourceDuration = (clip: Clip): number =>
  Math.max(0, clip.sourceOut - clip.sourceIn)

export const canHaveSpeed = (clip: Clip): boolean => clip.type === 'video' || clip.type === 'audio'

export const hasAudio = (clip: Clip, project: Project): boolean => {
  if (clip.type === 'audio') return true
  if (clip.type !== 'video') return false
  return media(project, clip.mediaId)?.hasAudio ?? false
}

export const isMediaClip = (clip: Clip): boolean => clip.type !== 'text'

export const clipAt = (project: Project, trackId: string, time: number): Clip | undefined =>
  clipsOnTrack(project, trackId).find(
    (item) => time >= item.start && time < clipEnd(item),
  )

export const previousClip = (project: Project, target: Clip): Clip | undefined =>
  clipsOnTrack(project, target.trackId)
    .filter((item) => item.id !== target.id && item.start < target.start - 0.001)
    .sort((a, b) => clipEnd(b) - clipEnd(a))[0]

export const nextClip = (project: Project, target: Clip): Clip | undefined =>
  clipsOnTrack(project, target.trackId)
    .filter((item) => item.id !== target.id && item.start > target.start + 0.001)
    .sort((a, b) => a.start - b.start)[0]

export const transitionProgress = (clip: Clip, time: number): number | null => {
  if (!clip.transitionIn || clip.transitionIn.duration <= 0) return null
  const end = clip.start + clip.transitionIn.duration
  if (time < clip.start || time >= end) return null
  return clamp((time - clip.start) / clip.transitionIn.duration, 0, 1)
}

export const findSnap = (value: number, targets: number[], threshold: number): number => {
  let best = value
  let bestDistance = threshold
  for (const target of targets) {
    const distance = Math.abs(target - value)
    if (distance <= bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best
}

export const snapTargets = (
  project: Project,
  playhead: number,
  excludeClipId?: string,
): number[] => {
  const targets = [0, playhead, projectDuration(project)]
  for (const item of project.clips) {
    if (item.id === excludeClipId) continue
    targets.push(item.start, clipEnd(item))
  }
  return targets
}

export const findFreeStart = (
  project: Project,
  trackId: string,
  desired: number,
  duration: number,
): number => {
  const items = clipsOnTrack(project, trackId)
  let start = Math.max(0, desired)
  let changed = true
  while (changed) {
    changed = false
    for (const item of items) {
      const overlaps = start < clipEnd(item) - 0.0001 && start + duration > item.start + 0.0001
      if (overlaps) {
        start = clipEnd(item)
        changed = true
      }
    }
  }
  return start
}

export const formatTimecode = (seconds: number, fps = 30): string => {
  const safe = Math.max(0, seconds)
  const totalFrames = Math.round(safe * fps)
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const secs = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const mins = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`
}

export const formatShortTime = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = Math.floor(safe % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export const formatRulerTime = (seconds: number): string => {
  const safe = Math.max(0, seconds)
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  if (secs === 0) return `${mins}:00`
  return `${mins}:${secs.toFixed(1).replace('.0', '')}`
}

export const rulerStep = (pxPerSecond: number): number => {
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  return steps.find((step) => step * pxPerSecond >= 76) ?? 600
}

export const projectAspect = (project: Project): number => project.width / project.height

const TRACK_KIND_KEYS: Record<TrackKind, TranslationKey> = {
  video: 'trackKind.video',
  overlay: 'trackKind.overlay',
  text: 'trackKind.text',
  audio: 'trackKind.audio',
}

export const trackKindLabel = (kind: TrackKind): string => t(TRACK_KIND_KEYS[kind])
