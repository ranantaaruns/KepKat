import type {
  ChromaKey,
  Clip,
  ColorGrade,
  MediaAsset,
  Project,
  TextConfig,
  Track,
  Transform,
} from './types'

export const uid = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const DEFAULT_GRADE: ColorGrade = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  sharpness: 0,
  vignette: 0,
  grain: 0,
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  fit: 'contain',
}

export const DEFAULT_CHROMA: ChromaKey = {
  enabled: false,
  color: '#00ff00',
  similarity: 0.36,
  smoothness: 0.08,
  spill: 0.2,
  matte: false,
}

export const DEFAULT_TEXT: TextConfig = {
  content: 'Teks baru',
  fontFamily: 'Archivo Variable',
  fontSize: 96,
  fontWeight: 700,
  color: '#f0ede6',
  align: 'center',
  strokeColor: '#0b0d0f',
  strokeWidth: 0,
  backgroundColor: '#0b0d0f',
  backgroundOpacity: 0,
  padding: 24,
}

const makeTracks = (): Track[] => [
  { id: uid(), name: 'Teks', kind: 'text', muted: false, hidden: false, locked: false, volume: 1 },
  {
    id: uid(),
    name: 'Overlay',
    kind: 'overlay',
    muted: false,
    hidden: false,
    locked: false,
    volume: 1,
  },
  { id: uid(), name: 'Video', kind: 'video', muted: false, hidden: false, locked: false, volume: 1 },
  { id: uid(), name: 'Audio', kind: 'audio', muted: false, hidden: false, locked: false, volume: 1 },
]

export const createEmptyProject = (): Project => ({
  id: uid(),
  name: 'Proyek tanpa judul',
  width: 1920,
  height: 1080,
  fps: 30,
  background: '#000000',
  tracks: makeTracks(),
  clips: [],
  media: [],
  updatedAt: Date.now(),
})

const baseClip = (trackId: string, type: Clip['type'], name: string, duration: number): Clip => ({
  id: uid(),
  trackId,
  type,
  name,
  start: 0,
  duration,
  sourceIn: 0,
  sourceOut: duration,
  speed: 1,
  preservePitch: true,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  muted: false,
  transform: { ...DEFAULT_TRANSFORM },
  grade: { ...DEFAULT_GRADE },
  filterId: 'none',
  chroma: { ...DEFAULT_CHROMA },
  keyframes: {},
})

export const createMediaClip = (asset: MediaAsset, trackId: string, start: number): Clip => {
  const duration = asset.kind === 'image' ? 5 : Math.max(0.1, asset.duration)
  const type: Clip['type'] =
    asset.kind === 'video' ? 'video' : asset.kind === 'audio' ? 'audio' : 'image'
  return {
    ...baseClip(trackId, type, asset.name, duration),
    mediaId: asset.id,
    start,
    sourceIn: 0,
    sourceOut: duration,
  }
}

export const createTextClip = (trackId: string, start: number, content = 'Teks baru'): Clip => ({
  ...baseClip(trackId, 'text', content || 'Teks baru', 4),
  start,
  sourceOut: 4,
  text: { ...DEFAULT_TEXT, content },
})

export const projectDimensions = (
  aspect: '16:9' | '9:16' | '1:1' | '4:5',
  quality: '720p' | '1080p' | '1440p' | '4k' = '1080p',
): { width: number; height: number } => {
  const base =
    quality === '720p' ? 720 : quality === '1440p' ? 1440 : quality === '4k' ? 2160 : 1080
  switch (aspect) {
    case '9:16':
      return { width: base, height: Math.round((base * 16) / 9) }
    case '1:1':
      return { width: base, height: base }
    case '4:5':
      return { width: base, height: Math.round((base * 5) / 4) }
    default:
      return { width: Math.round((base * 16) / 9), height: base }
  }
}

export const aspectFromDimensions = (width: number, height: number): string => {
  const ratio = width / height
  if (Math.abs(ratio - 16 / 9) < 0.03) return '16:9'
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16'
  if (Math.abs(ratio - 1) < 0.03) return '1:1'
  if (Math.abs(ratio - 4 / 5) < 0.03) return '4:5'
  return `${width}:${height}`
}
