import { t, type TranslationKey } from '../i18n'
import type { ColorGrade, TransitionType } from './types'
import { DEFAULT_GRADE } from './defaults'

export interface FilterPreset {
  id: string
  nameKey: TranslationKey
  noteKey: TranslationKey
  grade: Partial<ColorGrade>
  swatch: [string, string, string]
}

export interface TransitionPreset {
  type: TransitionType
  nameKey: TranslationKey
  noteKey: TranslationKey
}

export interface StylePack {
  id: string
  nameKey: TranslationKey
  noteKey: TranslationKey
  filterId: string
  transition: TransitionType
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'none',
    nameKey: 'filter.none.name',
    noteKey: 'filter.none.note',
    grade: {},
    swatch: ['#3b4148', '#777f87', '#c7cdd3'],
  },
  {
    id: 'cinema',
    nameKey: 'filter.cinema.name',
    noteKey: 'filter.cinema.note',
    grade: {
      contrast: 0.18,
      saturation: 0.08,
      temperature: 0.08,
      shadows: 0.12,
      highlights: -0.08,
      vignette: 0.12,
    },
    swatch: ['#241d1b', '#7c5b45', '#d7b78f'],
  },
  {
    id: 'warm',
    nameKey: 'filter.warm.name',
    noteKey: 'filter.warm.note',
    grade: { temperature: 0.2, saturation: 0.1, contrast: 0.06, shadows: 0.1 },
    swatch: ['#2a1d18', '#8f5c3d', '#e5b98d'],
  },
  {
    id: 'cool',
    nameKey: 'filter.cool.name',
    noteKey: 'filter.cool.note',
    grade: { temperature: -0.2, tint: -0.04, saturation: -0.04, contrast: 0.08 },
    swatch: ['#172127', '#3d6475', '#b5d4df'],
  },
  {
    id: 'film',
    nameKey: 'filter.film.name',
    noteKey: 'filter.film.note',
    grade: {
      contrast: 0.12,
      saturation: -0.08,
      shadows: 0.18,
      highlights: -0.12,
      grain: 0.08,
      vignette: 0.15,
    },
    swatch: ['#1e211d', '#656b58', '#cfc6aa'],
  },
  {
    id: 'mono',
    nameKey: 'filter.mono.name',
    noteKey: 'filter.mono.note',
    grade: { saturation: -1, contrast: 0.15 },
    swatch: ['#141414', '#747474', '#e7e7e7'],
  },
  {
    id: 'vhs',
    nameKey: 'filter.vhs.name',
    noteKey: 'filter.vhs.note',
    grade: {
      saturation: 0.18,
      contrast: -0.05,
      grain: 0.22,
      vignette: 0.2,
      temperature: 0.1,
    },
    swatch: ['#211d2a', '#6e546c', '#c6a6a0'],
  },
  {
    id: 'dream',
    nameKey: 'filter.dream.name',
    noteKey: 'filter.dream.note',
    grade: {
      saturation: -0.05,
      shadows: 0.24,
      highlights: -0.18,
      exposure: 0.08,
      vignette: 0.08,
    },
    swatch: ['#2a2b31', '#8f8b9c', '#e6dde5'],
  },
  {
    id: 'punch',
    nameKey: 'filter.punch.name',
    noteKey: 'filter.punch.note',
    grade: { contrast: 0.28, saturation: 0.16, vibrance: 0.18 },
    swatch: ['#1b1719', '#8b3b3b', '#e59a51'],
  },
  {
    id: 'night',
    nameKey: 'filter.night.name',
    noteKey: 'filter.night.note',
    grade: {
      exposure: -0.08,
      temperature: -0.18,
      saturation: -0.12,
      contrast: 0.2,
      shadows: -0.1,
    },
    swatch: ['#10181f', '#2e5264', '#8db4c8'],
  },
  {
    id: 'dawn',
    nameKey: 'filter.dawn.name',
    noteKey: 'filter.dawn.note',
    grade: { temperature: 0.14, exposure: 0.1, shadows: 0.18, saturation: 0.05 },
    swatch: ['#222326', '#7c858a', '#e7e0cf'],
  },
  {
    id: 'retro',
    nameKey: 'filter.retro.name',
    noteKey: 'filter.retro.note',
    grade: {
      temperature: 0.18,
      saturation: -0.12,
      contrast: 0.1,
      grain: 0.12,
      vignette: 0.15,
    },
    swatch: ['#28221b', '#837250', '#d3c29d'],
  },
]

export const TRANSITION_PRESETS: TransitionPreset[] = [
  { type: 'dissolve', nameKey: 'transition.dissolve.name', noteKey: 'transition.dissolve.note' },
  { type: 'fade', nameKey: 'transition.fade.name', noteKey: 'transition.fade.note' },
  { type: 'slide', nameKey: 'transition.slide.name', noteKey: 'transition.slide.note' },
  { type: 'zoom', nameKey: 'transition.zoom.name', noteKey: 'transition.zoom.note' },
  { type: 'wipe', nameKey: 'transition.wipe.name', noteKey: 'transition.wipe.note' },
  { type: 'blur', nameKey: 'transition.blur.name', noteKey: 'transition.blur.note' },
  { type: 'glitch', nameKey: 'transition.glitch.name', noteKey: 'transition.glitch.note' },
  { type: 'whip', nameKey: 'transition.whip.name', noteKey: 'transition.whip.note' },
  { type: 'rotate', nameKey: 'transition.rotate.name', noteKey: 'transition.rotate.note' },
  { type: 'light', nameKey: 'transition.light.name', noteKey: 'transition.light.note' },
]

export const STYLE_PACKS: StylePack[] = [
  {
    id: 'warm-film',
    nameKey: 'style.warm-film.name',
    noteKey: 'style.warm-film.note',
    filterId: 'film',
    transition: 'dissolve',
  },
  {
    id: 'bright-vlog',
    nameKey: 'style.bright-vlog.name',
    noteKey: 'style.bright-vlog.note',
    filterId: 'dawn',
    transition: 'slide',
  },
  {
    id: 'night-neon',
    nameKey: 'style.night-neon.name',
    noteKey: 'style.night-neon.note',
    filterId: 'night',
    transition: 'glitch',
  },
  {
    id: 'tape-retro',
    nameKey: 'style.tape-retro.name',
    noteKey: 'style.tape-retro.note',
    filterId: 'retro',
    transition: 'wipe',
  },
  {
    id: 'soft-portrait',
    nameKey: 'style.soft-portrait.name',
    noteKey: 'style.soft-portrait.note',
    filterId: 'dream',
    transition: 'fade',
  },
]

export const gradeForFilter = (id: string): ColorGrade => {
  const preset = FILTER_PRESETS.find((item) => item.id === id)
  return { ...DEFAULT_GRADE, ...(preset?.grade ?? {}) }
}

export const filterName = (id: string): string => {
  if (id === 'custom') return t('filter.custom')
  const preset = FILTER_PRESETS.find((item) => item.id === id)
  return preset ? t(preset.nameKey) : t('filter.fallback')
}

export const transitionName = (type: TransitionType): string => {
  const preset = TRANSITION_PRESETS.find((item) => item.type === type)
  return preset ? t(preset.nameKey) : t('transition.fallback')
}
