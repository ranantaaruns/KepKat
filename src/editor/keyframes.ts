import { t, type TranslationKey } from '../i18n'
import type { AnimatedProperty, Clip, Keyframe, KeyframeMap } from './types'
import { uid } from './defaults'

export type Easing = [number, number, number, number]

export const EASE: Easing = [0.33, 0, 0.2, 1]
export const EASE_IN: Easing = [0.42, 0, 1, 1]
export const EASE_OUT: Easing = [0, 0, 0.58, 1]
export const LINEAR: Easing = [0, 0, 1, 1]
export const SNAP: Easing = [0.34, 1.56, 0.64, 1]

export const EASING_PRESETS: { id: string; nameKey: TranslationKey; easing: Easing }[] = [
  { id: 'linear', nameKey: 'easing.linear', easing: LINEAR },
  { id: 'smooth', nameKey: 'easing.smooth', easing: EASE },
  { id: 'in', nameKey: 'easing.in', easing: EASE_IN },
  { id: 'out', nameKey: 'easing.out', easing: EASE_OUT },
  { id: 'snap', nameKey: 'easing.snap', easing: SNAP },
]

export const ANIMATED_PROPERTIES: AnimatedProperty[] = [
  'x',
  'y',
  'scale',
  'rotation',
  'opacity',
  'volume',
]

const PROPERTY_KEYS: Record<AnimatedProperty, TranslationKey> = {
  x: 'property.x',
  y: 'property.y',
  scale: 'property.scale',
  rotation: 'property.rotation',
  opacity: 'property.opacity',
  volume: 'property.volume',
}

export const propertyLabel = (property: AnimatedProperty): string => t(PROPERTY_KEYS[property])

export const propertyUnit = (property: AnimatedProperty): string => {
  if (property === 'x' || property === 'y') return 'px'
  if (property === 'rotation') return '°'
  if (property === 'scale') return 'x'
  return ''
}

export const defaultEasing = (): Easing => [...EASE]

const cubic = (a: number, b: number, c: number, d: number, t: number): number => {
  const mt = 1 - t
  return mt * mt * mt * a + 3 * mt * mt * t * b + 3 * mt * t * t * c + t * t * t * d
}

const cubicDerivative = (a: number, b: number, c: number, d: number, t: number): number => {
  const mt = 1 - t
  return 3 * mt * mt * (b - a) + 6 * mt * t * (c - b) + 3 * t * t * (d - c)
}

export const evaluateEasing = (easing: Easing, progress: number): number => {
  const x = Math.min(1, Math.max(0, progress))
  if (x === 0 || x === 1) return x
  const [x1, y1, x2, y2] = easing
  let t = x
  for (let i = 0; i < 8; i += 1) {
    const current = cubic(0, x1, x2, 1, t) - x
    if (Math.abs(current) < 0.0001) break
    const slope = cubicDerivative(0, x1, x2, 1, t)
    if (Math.abs(slope) < 0.00001) break
    t -= current / slope
  }
  t = Math.min(1, Math.max(0, t))
  return cubic(0, y1, y2, 1, t)
}

export const evaluateKeyframes = (
  keyframes: Keyframe[] | undefined,
  time: number,
  fallback: number,
): number => {
  if (!keyframes || keyframes.length === 0) return fallback
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  if (sorted.length === 1) return sorted[0].value
  if (time <= sorted[0].time) return sorted[0].value
  const last = sorted[sorted.length - 1]
  if (time >= last.time) return last.value
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const from = sorted[i]
    const to = sorted[i + 1]
    if (time >= from.time && time <= to.time) {
      const span = to.time - from.time
      if (span <= 0) return to.value
      const progress = (time - from.time) / span
      const eased = evaluateEasing(from.easing, progress)
      return from.value + (to.value - from.value) * eased
    }
  }
  return last.value
}

export const keyframeAt = (
  keyframes: Keyframe[] | undefined,
  time: number,
  tolerance = 0.035,
): Keyframe | undefined =>
  keyframes?.find((item) => Math.abs(item.time - time) <= tolerance)

export const addKeyframe = (
  keyframes: Keyframe[] | undefined,
  time: number,
  value: number,
): Keyframe[] => {
  const existing = keyframeAt(keyframes, time)
  if (existing) {
    return (keyframes ?? []).map((item) =>
      item.id === existing.id ? { ...item, value, time } : item,
    )
  }
  return [
    ...(keyframes ?? []),
    { id: uid(), time, value, easing: defaultEasing() },
  ].sort((a, b) => a.time - b.time)
}

export const removeKeyframe = (
  keyframes: Keyframe[] | undefined,
  keyframeId: string,
): Keyframe[] => (keyframes ?? []).filter((item) => item.id !== keyframeId)

export const updateKeyframe = (
  keyframes: Keyframe[] | undefined,
  keyframeId: string,
  patch: Partial<Keyframe>,
): Keyframe[] =>
  (keyframes ?? [])
    .map((item) => (item.id === keyframeId ? { ...item, ...patch } : item))
    .sort((a, b) => a.time - b.time)

export const staticValue = (clip: Clip, property: AnimatedProperty): number => {
  switch (property) {
    case 'x':
      return clip.transform.x
    case 'y':
      return clip.transform.y
    case 'scale':
      return clip.transform.scale
    case 'rotation':
      return clip.transform.rotation
    case 'opacity':
      return clip.transform.opacity
    default:
      return clip.volume
  }
}

export const animatedValue = (
  clip: Clip,
  property: AnimatedProperty,
  localTime: number,
): number =>
  evaluateKeyframes(clip.keyframes[property], localTime, staticValue(clip, property))

export const propertyRange = (property: AnimatedProperty): { min: number; max: number; step: number } => {
  switch (property) {
    case 'x':
    case 'y':
      return { min: -1920, max: 1920, step: 1 }
    case 'scale':
      return { min: 0.05, max: 4, step: 0.01 }
    case 'rotation':
      return { min: -360, max: 360, step: 1 }
    case 'opacity':
      return { min: 0, max: 1, step: 0.01 }
    default:
      return { min: 0, max: 2, step: 0.01 }
  }
}

export const scaleKeyframes = (keyframes: KeyframeMap, factor: number): KeyframeMap => {
  const next: KeyframeMap = {}
  for (const property of ANIMATED_PROPERTIES) {
    const list = keyframes[property]
    if (list) {
      next[property] = list.map((item) => ({ ...item, time: item.time * factor }))
    }
  }
  return next
}

export type TextAnimationPreset = 'fade' | 'slide' | 'pop' | 'zoom'

export const textAnimationKeyframes = (
  preset: TextAnimationPreset,
  duration: number,
): KeyframeMap => {
  const end = Math.max(0.1, duration)
  const fast = Math.min(0.55, end * 0.45)
  const make = (time: number, value: number, easing: Easing): Keyframe => ({
    id: uid(),
    time,
    value,
    easing: [...easing] as Easing,
  })
  switch (preset) {
    case 'slide':
      return {
        y: [make(0, 80, EASE_OUT), make(fast, 0, EASE_OUT)],
        opacity: [make(0, 0, EASE_OUT), make(fast, 1, EASE_OUT)],
      }
    case 'pop':
      return {
        scale: [make(0, 0.82, SNAP), make(fast, 1.04, EASE_OUT), make(Math.min(end, fast + 0.25), 1, EASE_OUT)],
        opacity: [make(0, 0, EASE_OUT), make(Math.min(0.2, fast), 1, EASE_OUT)],
      }
    case 'zoom':
      return {
        scale: [make(0, 1.18, EASE_OUT), make(fast, 1, EASE_OUT)],
        opacity: [make(0, 0, EASE_OUT), make(fast, 1, EASE_OUT)],
      }
    default:
      return {
        opacity: [make(0, 0, EASE_OUT), make(fast, 1, EASE_OUT)],
      }
  }
}
