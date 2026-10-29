import type { AnimatedProperty, Keyframe, Project } from '../editor/types'
import { projectDuration } from '../editor/timelineMath'
import type { ProjectSnapshot } from './schema'

const MAX_CLIPS = 120
const MAX_MEDIA = 60
const MAX_KEYFRAMES = 8
const MAX_NAME = 160

const shortName = (value: string): string =>
  value.length > MAX_NAME ? `${value.slice(0, MAX_NAME - 1)}…` : value

const shortText = (value: string): string =>
  value.length > 2000 ? `${value.slice(0, 1999)}…` : value

const compactKeyframes = (keyframes: Keyframe[] | undefined): Keyframe[] | undefined => {
  if (!keyframes?.length) return undefined
  return keyframes
    .slice()
    .sort((a, b) => a.time - b.time)
    .slice(0, MAX_KEYFRAMES)
    .map((item) => ({
      id: item.id,
      time: Number(item.time.toFixed(2)),
      value: Number(item.value.toFixed(3)),
      easing: item.easing,
    }))
}

const compactProperties = (clip: Project['clips'][number]): ProjectSnapshot['clips'][number]['keyframes'] => {
  const next: ProjectSnapshot['clips'][number]['keyframes'] = {}
  const properties: AnimatedProperty[] = ['x', 'y', 'scale', 'rotation', 'opacity', 'volume']
  for (const property of properties) {
    const value = compactKeyframes(clip.keyframes[property])
    if (value) next[property] = value
  }
  return next
}

export const createProjectSnapshot = (
  project: Project,
  selectedClipId: string | null,
  playhead: number,
): ProjectSnapshot => ({
  project: {
    name: shortName(project.name),
    width: project.width,
    height: project.height,
    fps: project.fps,
    background: project.background,
    updatedAt: project.updatedAt,
    duration: Number(projectDuration(project).toFixed(2)),
  },
  tracks: project.tracks.slice(0, 30).map((item) => ({
    id: item.id,
    name: shortName(item.name),
    kind: item.kind,
    muted: item.muted,
    hidden: item.hidden,
    locked: item.locked,
    volume: Number(item.volume.toFixed(2)),
  })),
  media: project.media.slice(0, MAX_MEDIA).map((item) => ({
    id: item.id,
    name: shortName(item.name),
    kind: item.kind,
    duration: Number(item.duration.toFixed(2)),
    width: item.width,
    height: item.height,
    hasAudio: item.hasAudio,
  })),
  clips: [...project.clips]
    .sort((a, b) => a.start - b.start)
    .slice(0, MAX_CLIPS)
    .map((item) => ({
      id: item.id,
      trackId: item.trackId,
      type: item.type,
      mediaId: item.mediaId,
      name: shortName(item.name),
      start: Number(item.start.toFixed(2)),
      duration: Number(item.duration.toFixed(2)),
      sourceIn: Number(item.sourceIn.toFixed(2)),
      sourceOut: Number(item.sourceOut.toFixed(2)),
      speed: Number(item.speed.toFixed(2)),
      preservePitch: item.preservePitch,
      volume: Number(item.volume.toFixed(2)),
      fadeIn: Number(item.fadeIn.toFixed(2)),
      fadeOut: Number(item.fadeOut.toFixed(2)),
      muted: item.muted,
      filterId: item.filterId,
      transform: {
        x: Number(item.transform.x.toFixed(1)),
        y: Number(item.transform.y.toFixed(1)),
        scale: Number(item.transform.scale.toFixed(3)),
        rotation: Number(item.transform.rotation.toFixed(1)),
        opacity: Number(item.transform.opacity.toFixed(3)),
        fit: item.transform.fit,
      },
      grade: {
        exposure: Number(item.grade.exposure.toFixed(3)),
        contrast: Number(item.grade.contrast.toFixed(3)),
        saturation: Number(item.grade.saturation.toFixed(3)),
        temperature: Number(item.grade.temperature.toFixed(3)),
        tint: Number(item.grade.tint.toFixed(3)),
        highlights: Number(item.grade.highlights.toFixed(3)),
        shadows: Number(item.grade.shadows.toFixed(3)),
        vibrance: Number(item.grade.vibrance.toFixed(3)),
        sharpness: Number(item.grade.sharpness.toFixed(3)),
        vignette: Number(item.grade.vignette.toFixed(3)),
        grain: Number(item.grade.grain.toFixed(3)),
      },
      chroma: {
        enabled: item.chroma.enabled,
        color: item.chroma.color,
        similarity: Number(item.chroma.similarity.toFixed(3)),
        smoothness: Number(item.chroma.smoothness.toFixed(3)),
        spill: Number(item.chroma.spill.toFixed(3)),
        matte: item.chroma.matte,
      },
      keyframes: compactProperties(item),
      transitionIn: item.transitionIn
        ? {
            type: item.transitionIn.type,
            duration: Number(item.transitionIn.duration.toFixed(2)),
            direction: item.transitionIn.direction,
          }
        : undefined,
      text: item.text
        ? {
            content: shortText(item.text.content),
            fontFamily: item.text.fontFamily,
            fontSize: item.text.fontSize,
            fontWeight: item.text.fontWeight,
            color: item.text.color,
            align: item.text.align,
            strokeColor: item.text.strokeColor,
            strokeWidth: item.text.strokeWidth,
            backgroundColor: item.text.backgroundColor,
            backgroundOpacity: item.text.backgroundOpacity,
            padding: item.text.padding,
          }
        : undefined,
    })),
  selectedClipId,
  playhead: Number(playhead.toFixed(2)),
})
