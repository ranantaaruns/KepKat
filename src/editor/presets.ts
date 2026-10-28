import type { ColorGrade, TransitionType } from './types'
import { DEFAULT_GRADE } from './defaults'

export interface FilterPreset {
  id: string
  name: string
  note: string
  grade: Partial<ColorGrade>
  swatch: [string, string, string]
}

export interface TransitionPreset {
  type: TransitionType
  name: string
  note: string
}

export interface StylePack {
  id: string
  name: string
  note: string
  filterId: string
  transition: TransitionType
}

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'none',
    name: 'Netral',
    note: 'Tanpa perubahan warna',
    grade: {},
    swatch: ['#3b4148', '#777f87', '#c7cdd3'],
  },
  {
    id: 'cinema',
    name: 'Sinema',
    note: 'Kontras dalam, bayangan hangat',
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
    name: 'Hangat',
    note: 'Kulit lebih hidup',
    grade: { temperature: 0.2, saturation: 0.1, contrast: 0.06, shadows: 0.1 },
    swatch: ['#2a1d18', '#8f5c3d', '#e5b98d'],
  },
  {
    id: 'cool',
    name: 'Dingin',
    note: 'Biru tenang, kontras bersih',
    grade: { temperature: -0.2, tint: -0.04, saturation: -0.04, contrast: 0.08 },
    swatch: ['#172127', '#3d6475', '#b5d4df'],
  },
  {
    id: 'film',
    name: 'Film',
    note: 'Highlight lembut, grain halus',
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
    name: 'Monokrom',
    note: 'Hitam putih tegas',
    grade: { saturation: -1, contrast: 0.15 },
    swatch: ['#141414', '#747474', '#e7e7e7'],
  },
  {
    id: 'vhs',
    name: 'Kaset',
    note: 'Grain dan warna pudar',
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
    name: 'Lembut',
    note: 'Bayangan terangkat',
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
    name: 'Punch',
    note: 'Kontras dan warna kuat',
    grade: { contrast: 0.28, saturation: 0.16, vibrance: 0.18 },
    swatch: ['#1b1719', '#8b3b3b', '#e59a51'],
  },
  {
    id: 'night',
    name: 'Malam',
    note: 'Gelap, dingin, tegang',
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
    name: 'Pagi',
    note: 'Terang dan bersih',
    grade: { temperature: 0.14, exposure: 0.1, shadows: 0.18, saturation: 0.05 },
    swatch: ['#222326', '#7c858a', '#e7e0cf'],
  },
  {
    id: 'retro',
    name: 'Retro',
    note: 'Warna pudar dan vignette',
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
  { type: 'dissolve', name: 'Lumer', note: 'Campuran halus' },
  { type: 'fade', name: 'Fade hitam', note: 'Lewat hitam' },
  { type: 'slide', name: 'Geser', note: 'Dorong ke samping' },
  { type: 'zoom', name: 'Zoom', note: 'Masuk dan keluar' },
  { type: 'wipe', name: 'Tirai', note: 'Sapuan arah' },
  { type: 'blur', name: 'Blur', note: 'Baur di tengah' },
  { type: 'glitch', name: 'Glitch', note: 'Pergeseran RGB' },
  { type: 'whip', name: 'Whip', note: 'Sapuan cepat' },
  { type: 'rotate', name: 'Putar', note: 'Rotasi lembut' },
  { type: 'light', name: 'Cahaya', note: 'Bocor cahaya hangat' },
]

export const STYLE_PACKS: StylePack[] = [
  { id: 'warm-film', name: 'Film Hangat', note: 'Warna kulit dan grain', filterId: 'film', transition: 'dissolve' },
  { id: 'bright-vlog', name: 'Vlog Cerah', note: 'Bersih dan terbuka', filterId: 'dawn', transition: 'slide' },
  { id: 'night-neon', name: 'Malam Neon', note: 'Kontras dingin', filterId: 'night', transition: 'glitch' },
  { id: 'tape-retro', name: 'Kaset Retro', note: 'Pudar dan bertekstur', filterId: 'retro', transition: 'wipe' },
  { id: 'soft-portrait', name: 'Potret Lembut', note: 'Bayangan terangkat', filterId: 'dream', transition: 'fade' },
]

export const gradeForFilter = (id: string): ColorGrade => {
  const preset = FILTER_PRESETS.find((item) => item.id === id)
  return { ...DEFAULT_GRADE, ...(preset?.grade ?? {}) }
}

export const filterName = (id: string): string => {
  if (id === 'custom') return 'Kustom'
  return FILTER_PRESETS.find((item) => item.id === id)?.name ?? 'Netral'
}

export const transitionName = (type: TransitionType): string =>
  TRANSITION_PRESETS.find((item) => item.type === type)?.name ?? 'Transisi'
