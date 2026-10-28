export type TrackKind = 'video' | 'overlay' | 'text' | 'audio'
export type ClipType = 'video' | 'image' | 'audio' | 'text'
export type MediaKind = 'video' | 'audio' | 'image'
export type FitMode = 'contain' | 'cover'
export type TransitionType =
  | 'dissolve'
  | 'fade'
  | 'slide'
  | 'zoom'
  | 'wipe'
  | 'blur'
  | 'glitch'
  | 'whip'
  | 'rotate'
  | 'light'
export type AnimatedProperty = 'x' | 'y' | 'scale' | 'rotation' | 'opacity' | 'volume'
export type LeftPanel = 'media' | 'preset' | 'text'
export type InspectorTab = 'clip' | 'color' | 'chroma' | 'motion' | 'audio' | 'speed' | 'text'
export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface MediaAsset {
  id: string
  name: string
  kind: MediaKind
  mime: string
  duration: number
  width: number
  height: number
  hasAudio: boolean
  thumbnail?: string
  waveform?: number[]
  createdAt: number
}

export interface Transform {
  x: number
  y: number
  scale: number
  rotation: number
  opacity: number
  fit: FitMode
}

export interface ColorGrade {
  exposure: number
  contrast: number
  saturation: number
  temperature: number
  tint: number
  highlights: number
  shadows: number
  vibrance: number
  sharpness: number
  vignette: number
  grain: number
}

export interface ChromaKey {
  enabled: boolean
  color: string
  similarity: number
  smoothness: number
  spill: number
  matte: boolean
}

export interface Keyframe {
  id: string
  time: number
  value: number
  easing: [number, number, number, number]
}

export type KeyframeMap = Partial<Record<AnimatedProperty, Keyframe[]>>

export interface Transition {
  type: TransitionType
  duration: number
  direction: 'left' | 'right' | 'up' | 'down'
}

export interface TextConfig {
  content: string
  fontFamily: 'Archivo Variable' | 'IBM Plex Mono'
  fontSize: number
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
  strokeColor: string
  strokeWidth: number
  backgroundColor: string
  backgroundOpacity: number
  padding: number
}

export interface Clip {
  id: string
  trackId: string
  type: ClipType
  mediaId?: string
  name: string
  start: number
  duration: number
  sourceIn: number
  sourceOut: number
  speed: number
  preservePitch: boolean
  volume: number
  fadeIn: number
  fadeOut: number
  muted: boolean
  transform: Transform
  grade: ColorGrade
  filterId: string
  chroma: ChromaKey
  keyframes: KeyframeMap
  transitionIn?: Transition
  text?: TextConfig
}

export interface Track {
  id: string
  name: string
  kind: TrackKind
  muted: boolean
  hidden: boolean
  locked: boolean
  volume: number
}

export interface Project {
  id: string
  name: string
  width: number
  height: number
  fps: number
  background: string
  tracks: Track[]
  clips: Clip[]
  media: MediaAsset[]
  updatedAt: number
}

export interface ExportSettings {
  format: 'webm' | 'mp4'
  resolution: '720p' | '1080p' | '1440p' | '4k'
  fps: 24 | 30 | 60
  quality: 'medium' | 'high'
  fileName: string
}
