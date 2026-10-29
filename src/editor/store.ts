import { create } from 'zustand'
import { t } from '../i18n'
import { produce } from 'immer'
import type {
  AnimatedProperty,
  Clip,
  InspectorTab,
  KeyframeMap,
  LeftPanel,
  MediaAsset,
  Project,
  SaveState,
  TextConfig,
  Track,
  TrackKind,
  TransitionType,
  Transform,
  ColorGrade,
  ChromaKey,
} from './types'
import {
  createEmptyProject,
  createMediaClip,
  createTextClip,
  projectDimensions,
  uid,
} from './defaults'
import {
  addKeyframe,
  animatedValue,
  removeKeyframe,
  scaleKeyframes,
  textAnimationKeyframes,
  updateKeyframe,
  type Easing,
  type TextAnimationPreset,
} from './keyframes'
import { filterName, gradeForFilter, TRANSITION_PRESETS } from './presets'
import { executeAgentPlan, type AgentExecutionResult } from '../ai/executor'
import type { AgentPlan } from '../ai/schema'
import {
  clipEnd,
  clipsOnTrack,
  findFreeStart,
  getTrackForKind,
  media,
  previousClip,
  projectDuration,
  sourceDuration,
  visualTracks,
} from './timelineMath'

type MobilePanel = 'left' | 'right' | null

interface MutateOptions {
  history?: boolean
  coalesceKey?: string
}

interface EditorState {
  project: Project
  selectedClipId: string | null
  leftPanel: LeftPanel
  inspectorTab: InspectorTab
  playhead: number
  isPlaying: boolean
  pxPerSecond: number
  snapping: boolean
  eyedropper: boolean
  mobilePanel: MobilePanel
  historyPast: Project[]
  historyFuture: Project[]
  lastHistoryKey: string | null
  lastHistoryAt: number
  saveState: SaveState
  saveMessage: string

  restoreProject: (project: Project) => void
  setProjectName: (name: string) => void
  setProjectSettings: (settings: Partial<Pick<Project, 'fps' | 'background' | 'width' | 'height'>>) => void
  setAspect: (aspect: '16:9' | '9:16' | '1:1' | '4:5') => void
  clearTimeline: () => void

  addMedia: (asset: MediaAsset) => void
  removeMedia: (mediaId: string) => void
  addClipFromMedia: (mediaId: string) => void
  addTextClip: (content?: string) => void
  selectClip: (clipId: string | null) => void
  setLeftPanel: (panel: LeftPanel) => void
  setInspectorTab: (tab: InspectorTab) => void
  setMobilePanel: (panel: MobilePanel) => void

  setPlayhead: (time: number) => void
  play: () => void
  pause: () => void
  togglePlay: () => void
  setPxPerSecond: (value: number) => void
  toggleSnapping: () => void
  setEyedropper: (value: boolean) => void
  setSaveState: (state: SaveState, message?: string) => void

  pushHistory: () => void
  undo: () => void
  redo: () => void
  mutateProject: (recipe: (draft: Project) => void, options?: MutateOptions) => void
  applyAgentPlan: (plan: AgentPlan) => AgentExecutionResult

  updateClip: (clipId: string, patch: Partial<Clip>, options?: MutateOptions) => void
  updateTransform: (clipId: string, patch: Partial<Transform>, options?: MutateOptions) => void
  updateGrade: (clipId: string, patch: Partial<ColorGrade>, options?: MutateOptions) => void
  updateChroma: (clipId: string, patch: Partial<ChromaKey>, options?: MutateOptions) => void
  updateText: (clipId: string, patch: Partial<TextConfig>, options?: MutateOptions) => void
  setPropertyValue: (clipId: string, property: AnimatedProperty, value: number) => void
  setClipStart: (clipId: string, start: number) => void
  setClipDuration: (clipId: string, duration: number) => void
  setSpeed: (clipId: string, speed: number) => void
  setPreservePitch: (clipId: string, value: boolean) => void
  setVolume: (clipId: string, value: number) => void
  setFade: (clipId: string, side: 'in' | 'out', value: number) => void
  toggleMute: (clipId: string) => void
  applyFilter: (clipId: string, filterId: string) => void
  applyStylePack: (clipId: string, filterId: string, transition: TransitionType) => void
  addTransition: (clipId: string, type: TransitionType, duration?: number) => void
  setTransitionType: (clipId: string, type: TransitionType) => void
  removeTransition: (clipId: string) => void
  detachAudio: (clipId: string) => void
  splitClip: () => void
  deleteClip: (clipId?: string) => void
  duplicateClip: (clipId?: string) => void
  addTrack: (kind: Exclude<TrackKind, 'video'>) => void
  updateTrack: (trackId: string, patch: Partial<Track>) => void
  addKeyframe: (clipId: string, property: AnimatedProperty) => void
  removeKeyframe: (clipId: string, property: AnimatedProperty, keyframeId: string) => void
  setKeyframeEasing: (
    clipId: string,
    property: AnimatedProperty,
    keyframeId: string,
    easing: Easing,
  ) => void
  applyTextAnimation: (clipId: string, preset: TextAnimationPreset) => void
}

const MAX_HISTORY = 60

const historyOptions = (state: EditorState, options?: MutateOptions) => {
  if (options?.history === false) {
    return { past: state.historyPast, future: state.historyFuture, record: false }
  }
  const now = Date.now()
  const coalesced =
    options?.coalesceKey &&
    state.lastHistoryKey === options.coalesceKey &&
    now - state.lastHistoryAt < 520
  if (coalesced) {
    return { past: state.historyPast, future: state.historyFuture, record: false }
  }
  return {
    past: [...state.historyPast, state.project].slice(-MAX_HISTORY),
    future: [] as Project[],
    record: true,
  }
}

const selectableTab = (clip: Clip): InspectorTab => {
  if (clip.type === 'text') return 'text'
  if (clip.type === 'audio') return 'audio'
  return 'clip'
}

const transitionDuration = (clip: Clip, previous: Clip): number =>
  Math.max(0.12, Math.min(1.2, clip.duration * 0.45, previous.duration * 0.45))

const withUpdatedAt = (project: Project): Project => ({
  ...project,
  updatedAt: Date.now(),
})

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  selectedClipId: null,
  leftPanel: 'media',
  inspectorTab: 'clip',
  playhead: 0,
  isPlaying: false,
  pxPerSecond: 58,
  snapping: true,
  eyedropper: false,
  mobilePanel: null,
  historyPast: [],
  historyFuture: [],
  lastHistoryKey: null,
  lastHistoryAt: 0,
  saveState: 'idle',
  saveMessage: '',

  restoreProject: (project) =>
    set({
      project: withUpdatedAt(project),
      selectedClipId: null,
      playhead: 0,
      isPlaying: false,
      historyPast: [],
      historyFuture: [],
      lastHistoryKey: null,
      lastHistoryAt: 0,
      saveState: 'saved',
      saveMessage: '',
    }),

  setProjectName: (name) =>
    get().mutateProject(
      (draft) => {
        draft.name = name.slice(0, 80)
      },
      { coalesceKey: 'project-name' },
    ),

  setProjectSettings: (settings) =>
    get().mutateProject((draft) => {
      Object.assign(draft, settings)
    }),

  setAspect: (aspect) => {
    const { width, height } = projectDimensions(aspect, '1080p')
    get().mutateProject((draft) => {
      draft.width = width
      draft.height = height
    })
  },

  clearTimeline: () => {
    get().mutateProject((draft) => {
      draft.clips = []
      draft.media = []
    })
    set({ playhead: 0, isPlaying: false, selectedClipId: null })
  },

  addMedia: (asset) =>
    get().mutateProject((draft) => {
      draft.media.push(asset)
    }),

  removeMedia: (mediaId) => {
    const state = get()
    const selected = state.project.clips.find((item) => item.id === state.selectedClipId)
    set((current) => {
      const project = withUpdatedAt({
        ...current.project,
        media: current.project.media.filter((item) => item.id !== mediaId),
        clips: current.project.clips.filter((item) => item.mediaId !== mediaId),
      })
      const duration = projectDuration(project)
      return {
        project,
        selectedClipId: selected?.mediaId === mediaId ? null : current.selectedClipId,
        playhead: Math.min(current.playhead, duration),
        isPlaying: duration > 0 && current.isPlaying,
        historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
        historyFuture: [],
      }
    })
  },

  addClipFromMedia: (mediaId) => {
    const state = get()
    const asset = state.project.media.find((item) => item.id === mediaId)
    if (!asset) return
    const trackKind = asset.kind === 'audio' ? 'audio' : asset.kind === 'image' ? 'overlay' : 'video'
    const target = getTrackForKind(state.project, trackKind)
    if (!target) return
    const duration = asset.kind === 'image' ? 5 : Math.max(0.1, asset.duration)
    const start = findFreeStart(state.project, target.id, state.playhead, duration)
    const nextClip = createMediaClip(asset, target.id, start)
    nextClip.id = uid()
    set((current) => ({
      project: withUpdatedAt({ ...current.project, clips: [...current.project.clips, nextClip] }),
      selectedClipId: nextClip.id,
      inspectorTab: selectableTab(nextClip),
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  addTextClip: (content) => {
    const state = get()
    const target = getTrackForKind(state.project, 'text')
    if (!target) return
    const nextClip = createTextClip(target.id, state.playhead, content)
    set((current) => ({
      project: withUpdatedAt({ ...current.project, clips: [...current.project.clips, nextClip] }),
      selectedClipId: nextClip.id,
      inspectorTab: 'text',
      leftPanel: 'text',
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  selectClip: (clipId) => {
    const selected = get().project.clips.find((item) => item.id === clipId)
    set({
      selectedClipId: clipId,
      inspectorTab: selected ? selectableTab(selected) : 'clip',
    })
  },

  setLeftPanel: (panel) => set({ leftPanel: panel }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setMobilePanel: (panel) => set({ mobilePanel: panel }),

  setPlayhead: (time) => {
    const duration = projectDuration(get().project)
    set({ playhead: Math.max(0, Math.min(time, duration || 0)) })
  },

  play: () => {
    const state = get()
    const duration = projectDuration(state.project)
    if (duration <= 0) return
    if (state.playhead >= duration - 0.01) {
      set({ playhead: 0 })
    }
    set({ isPlaying: true })
  },

  pause: () => set({ isPlaying: false }),
  togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

  setPxPerSecond: (value) => set({ pxPerSecond: Math.max(12, Math.min(240, value)) }),
  toggleSnapping: () => set((state) => ({ snapping: !state.snapping })),
  setEyedropper: (value) => set({ eyedropper: value }),
  setSaveState: (saveState, saveMessage = '') => set({ saveState, saveMessage }),

  pushHistory: () =>
    set((state) => ({
      historyPast: [...state.historyPast, state.project].slice(-MAX_HISTORY),
      historyFuture: [],
      lastHistoryKey: null,
    })),

  undo: () =>
    set((state) => {
      const previous = state.historyPast[state.historyPast.length - 1]
      if (!previous) return state
      return {
        project: previous,
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [state.project, ...state.historyFuture].slice(0, MAX_HISTORY),
        selectedClipId: previous.clips.some((item) => item.id === state.selectedClipId)
          ? state.selectedClipId
          : null,
        isPlaying: false,
        lastHistoryKey: null,
      }
    }),

  redo: () =>
    set((state) => {
      const next = state.historyFuture[0]
      if (!next) return state
      return {
        project: next,
        historyPast: [...state.historyPast, state.project].slice(-MAX_HISTORY),
        historyFuture: state.historyFuture.slice(1),
        selectedClipId: next.clips.some((item) => item.id === state.selectedClipId)
          ? state.selectedClipId
          : null,
        isPlaying: false,
        lastHistoryKey: null,
      }
    }),

  mutateProject: (recipe, options) =>
    set((state) => {
      let next: Project
      try {
        next = produce(state.project, (draft) => {
          recipe(draft)
          draft.updatedAt = Date.now()
        })
      } catch {
        return state
      }
      if (next === state.project) return state
      const history = historyOptions(state, options)
      return {
        project: next,
        historyPast: history.past,
        historyFuture: history.future,
        lastHistoryKey: options?.coalesceKey ?? null,
        lastHistoryAt: Date.now(),
      }
    }),

  applyAgentPlan: (plan) => {
    const state = get()
    const result = executeAgentPlan(state.project, plan, state.selectedClipId)
    const selected = result.selectedClipId
      ? result.project.clips.find((item) => item.id === result.selectedClipId)
      : undefined
    set({
      project: result.project,
      selectedClipId: result.selectedClipId,
      inspectorTab: selected ? selectableTab(selected) : state.inspectorTab,
      playhead: Math.min(state.playhead, projectDuration(result.project)),
      isPlaying: false,
      historyPast: [...state.historyPast, state.project].slice(-MAX_HISTORY),
      historyFuture: [],
      lastHistoryKey: null,
      lastHistoryAt: Date.now(),
    })
    return result
  },

  updateClip: (clipId, patch, options) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target) Object.assign(target, patch)
    }, options),

  updateTransform: (clipId, patch, options) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target) Object.assign(target.transform, patch)
    }, { coalesceKey: `transform-${clipId}`, ...options }),

  updateGrade: (clipId, patch, options) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target) {
        Object.assign(target.grade, patch)
        target.filterId = 'custom'
      }
    }, { coalesceKey: `grade-${clipId}`, ...options }),

  updateChroma: (clipId, patch, options) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target) Object.assign(target.chroma, patch)
    }, { coalesceKey: `chroma-${clipId}`, ...options }),

  updateText: (clipId, patch, options) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target?.text) Object.assign(target.text, patch)
    }, { coalesceKey: `text-${clipId}`, ...options }),

  setPropertyValue: (clipId, property, value) => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === clipId)
    if (!target) return
    const local = Math.max(0, Math.min(target.duration, state.playhead - target.start))
    get().mutateProject(
      (draft) => {
        const current = draft.clips.find((item) => item.id === clipId)
        if (!current) return
        const list = current.keyframes[property]
        if (list && list.length > 0) {
          current.keyframes[property] = addKeyframe(list, local, value)
        } else if (property === 'volume') {
          current.volume = value
        } else {
          current.transform[property] = value
        }
      },
      { coalesceKey: `property-${clipId}-${property}` },
    )
  },

  setClipStart: (clipId, start) =>
    get().mutateProject(
      (draft) => {
        const target = draft.clips.find((item) => item.id === clipId)
        if (target) target.start = Math.max(0, start)
      },
      { coalesceKey: `start-${clipId}` },
    ),

  setClipDuration: (clipId, duration) =>
    get().mutateProject(
      (draft) => {
        const target = draft.clips.find((item) => item.id === clipId)
        if (!target) return
        if (target.type === 'image' || target.type === 'text') {
          target.duration = Math.max(0.1, duration)
          target.sourceOut = target.duration
          return
        }
        const maxDuration = sourceDuration(target) / target.speed
        target.duration = Math.max(0.1, Math.min(duration, maxDuration))
        target.sourceOut = target.sourceIn + target.duration * target.speed
      },
      { coalesceKey: `duration-${clipId}` },
    ),

  setSpeed: (clipId, speed) => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === clipId)
    if (!target || (target.type !== 'video' && target.type !== 'audio')) return
    const nextSpeed = Math.max(0.25, Math.min(4, speed))
    const source = sourceDuration(target)
    const oldDuration = target.duration
    const nextDuration = Math.max(0.1, source / nextSpeed)
    const factor = nextDuration / oldDuration
    set((current) => ({
      project: withUpdatedAt({
        ...current.project,
        clips: current.project.clips.map((item) =>
          item.id === clipId
            ? {
                ...item,
                speed: nextSpeed,
                duration: nextDuration,
                fadeIn: Math.min(item.fadeIn, nextDuration),
                fadeOut: Math.min(item.fadeOut, nextDuration),
                keyframes: scaleKeyframes(item.keyframes, factor),
              }
            : item,
        ),
      }),
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  setPreservePitch: (clipId, value) =>
    get().updateClip(clipId, { preservePitch: value }, { coalesceKey: `pitch-${clipId}` }),

  setVolume: (clipId, value) =>
    get().updateClip(clipId, { volume: Math.max(0, Math.min(2, value)) }, {
      coalesceKey: `volume-${clipId}`,
    }),

  setFade: (clipId, side, value) =>
    get().mutateProject(
      (draft) => {
        const target = draft.clips.find((item) => item.id === clipId)
        if (!target) return
        const safe = Math.max(0, Math.min(value, target.duration / 2))
        if (side === 'in') target.fadeIn = safe
        else target.fadeOut = safe
      },
      { coalesceKey: `fade-${side}-${clipId}` },
    ),

  toggleMute: (clipId) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target) target.muted = !target.muted
    }),

  applyFilter: (clipId, filterId) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (!target) return
      target.filterId = filterId
      target.grade = gradeForFilter(filterId)
    }),

  applyStylePack: (clipId, filterId, transition) => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === clipId)
    if (!target) return
    const previous = previousClip(state.project, target)
    const duration = previous ? transitionDuration(target, previous) : 0
    get().mutateProject((draft) => {
      const current = draft.clips.find((item) => item.id === clipId)
      if (!current) return
      current.filterId = filterId
      current.grade = gradeForFilter(filterId)
      if (previous && duration > 0) {
        current.transitionIn = { type: transition, duration, direction: 'left' }
        current.start = Math.max(0, clipEnd(previous) - duration)
      }
    })
    set({ selectedClipId: clipId, inspectorTab: 'clip' })
  },

  addTransition: (clipId, type, duration) => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === clipId)
    if (!target) return
    const previous = previousClip(state.project, target)
    if (!previous) return
    const base = duration ?? transitionDuration(target, previous)
    const safe = Math.max(0.12, Math.min(base, target.duration * 0.45, previous.duration * 0.45))
    get().mutateProject((draft) => {
      const current = draft.clips.find((item) => item.id === clipId)
      if (!current) return
      current.transitionIn = { type, duration: safe, direction: 'left' }
      current.start = Math.max(0, clipEnd(previous) - safe)
    })
  },

  setTransitionType: (clipId, type) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (target?.transitionIn) target.transitionIn.type = type
    }),

  removeTransition: (clipId) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (!target?.transitionIn) return
      target.start += target.transitionIn.duration
      delete target.transitionIn
    }),

  detachAudio: (clipId) => {
    const state = get()
    const sourceClip = state.project.clips.find((item) => item.id === clipId)
    if (!sourceClip || sourceClip.type !== 'video') return
    const asset = media(state.project, sourceClip.mediaId)
    if (!asset?.hasAudio) return
    const audioTrack = getTrackForKind(state.project, 'audio')
    if (!audioTrack) return
    const audioClip: Clip = {
      ...sourceClip,
      id: uid(),
      trackId: audioTrack.id,
      type: 'audio',
      name: `${sourceClip.name} audio`,
      transitionIn: undefined,
      transform: {
        ...sourceClip.transform,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
        opacity: 1,
      },
      chroma: {
        ...sourceClip.chroma,
        enabled: false,
        matte: false,
      },
      grade: gradeForFilter('none'),
      filterId: 'none',
      keyframes: sourceClip.keyframes.volume ? { volume: sourceClip.keyframes.volume } : {},
    }
    set((current) => ({
      project: withUpdatedAt({
        ...current.project,
        clips: [
          ...current.project.clips.map((item) =>
            item.id === clipId ? { ...item, muted: true } : item,
          ),
          audioClip,
        ],
      }),
      selectedClipId: audioClip.id,
      inspectorTab: 'audio',
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  splitClip: () => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === state.selectedClipId)
    if (!target) return
    const local = state.playhead - target.start
    if (local <= 0.05 || local >= target.duration - 0.05) return
    const nextClip: Clip = {
      ...target,
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
    set((current) => ({
      project: withUpdatedAt({
        ...current.project,
        clips: [
          ...current.project.clips.map((item) =>
            item.id === target.id
              ? {
                  ...item,
                  duration: local,
                  sourceOut:
                    item.type === 'image' || item.type === 'text'
                      ? local
                      : item.sourceIn + local * item.speed,
                }
              : item,
          ),
          nextClip,
        ],
      }),
      selectedClipId: nextClip.id,
      inspectorTab: selectableTab(nextClip),
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  deleteClip: (clipId) => {
    const state = get()
    const id = clipId ?? state.selectedClipId
    if (!id) return
    set((current) => {
      const project = withUpdatedAt({
        ...current.project,
        clips: current.project.clips.filter((item) => item.id !== id),
      })
      const duration = projectDuration(project)
      return {
        project,
        selectedClipId: current.selectedClipId === id ? null : current.selectedClipId,
        playhead: Math.min(current.playhead, duration),
        isPlaying: duration > 0 && current.isPlaying,
        historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
        historyFuture: [],
      }
    })
  },

  duplicateClip: (clipId) => {
    const state = get()
    const id = clipId ?? state.selectedClipId
    const target = state.project.clips.find((item) => item.id === id)
    if (!target) return
    const copy: Clip = {
      ...target,
      id: uid(),
      name: t('defaults.copySuffix', { name: target.name }),
      start: clipEnd(target) + 0.1,
      transitionIn: undefined,
      keyframes: structuredClone(target.keyframes),
    }
    set((current) => ({
      project: withUpdatedAt({ ...current.project, clips: [...current.project.clips, copy] }),
      selectedClipId: copy.id,
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  addTrack: (kind) => {
    const state = get()
    const count = state.project.tracks.filter((item) => item.kind === kind).length + 1
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
    const tracks = [...state.project.tracks]
    if (kind === 'text') tracks.unshift(next)
    else if (kind === 'overlay') {
      const lastOverlay = tracks.map((item) => item.kind).lastIndexOf('overlay')
      tracks.splice(lastOverlay + 1, 0, next)
    } else tracks.push(next)
    set((current) => ({
      project: withUpdatedAt({ ...current.project, tracks }),
      historyPast: [...current.historyPast, current.project].slice(-MAX_HISTORY),
      historyFuture: [],
    }))
  },

  updateTrack: (trackId, patch) =>
    get().mutateProject((draft) => {
      const target = draft.tracks.find((item) => item.id === trackId)
      if (target) Object.assign(target, patch)
    }),

  addKeyframe: (clipId, property) => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === clipId)
    if (!target) return
    const local = Math.max(0, Math.min(target.duration, state.playhead - target.start))
    const value = animatedValue(target, property, local)
    get().mutateProject((draft) => {
      const current = draft.clips.find((item) => item.id === clipId)
      if (!current) return
      current.keyframes[property] = addKeyframe(current.keyframes[property], local, value)
    })
  },

  removeKeyframe: (clipId, property, keyframeId) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (!target) return
      const next = removeKeyframe(target.keyframes[property], keyframeId)
      if (next.length === 0) delete target.keyframes[property]
      else target.keyframes[property] = next
    }),

  setKeyframeEasing: (clipId, property, keyframeId, easing) =>
    get().mutateProject((draft) => {
      const target = draft.clips.find((item) => item.id === clipId)
      if (!target) return
      const list = target.keyframes[property]
      if (!list) return
      target.keyframes[property] = updateKeyframe(list, keyframeId, {
        easing: [...easing] as Easing,
      })
    }),

  applyTextAnimation: (clipId, preset) => {
    const state = get()
    const target = state.project.clips.find((item) => item.id === clipId)
    if (!target?.text) return
    const keyframes: KeyframeMap = textAnimationKeyframes(preset, target.duration)
    get().mutateProject((draft) => {
      const current = draft.clips.find((item) => item.id === clipId)
      if (!current) return
      current.keyframes = { ...current.keyframes, ...keyframes }
    })
  },
}))

export const selectedClip = (state: EditorState): Clip | undefined =>
  state.project.clips.find((item) => item.id === state.selectedClipId)

export const projectClipsForTrack = (project: Project, trackId: string): Clip[] =>
  clipsOnTrack(project, trackId)

export const displayFilterName = (clip: Clip): string => filterName(clip.filterId)

export const transitionPresetName = (type: TransitionType): string => {
  const preset = TRANSITION_PRESETS.find((item) => item.type === type)
  return preset ? t(preset.nameKey) : t('transition.fallback')
}

export const trackListForRender = (project: Project): Track[] => visualTracks(project)
