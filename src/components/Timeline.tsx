import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import { useT } from '../i18n'
import { useEditorStore } from '../editor/store'
import {
  clipsOnTrack,
  findSnap,
  formatRulerTime,
  formatShortTime,
  media as findMedia,
  projectDuration,
  rulerStep,
  snapTargets,
  trackKindLabel,
} from '../editor/timelineMath'
import type { Clip, Track } from '../editor/types'
import { Icon, type IconName } from './Icon'

interface TimelineProps {
  onImportClick: () => void
}

type DragMode = 'move' | 'trim-left' | 'trim-right'

interface DragState {
  mode: DragMode
  clipId: string
  startX: number
  origStart: number
  origDuration: number
  origSourceIn: number
  origSourceOut: number
  speed: number
  mediaDuration: number
  isMedia: boolean
  moved: boolean
}

const trackIcon = (kind: Track['kind']): IconName => {
  if (kind === 'text') return 'text'
  if (kind === 'audio') return 'audio'
  if (kind === 'overlay') return 'layers'
  return 'video'
}

const clipIcon = (clip: Clip): IconName => {
  if (clip.type === 'text') return 'text'
  if (clip.type === 'audio') return 'audio'
  if (clip.type === 'image') return 'image'
  return 'video'
}

const waveBars = (clip: Clip): number[] => {
  const state = useEditorStore.getState()
  const asset = findMedia(state.project, clip.mediaId)
  if (asset?.waveform?.length) return asset.waveform
  return Array.from({ length: 42 }, (_, index) => 0.2 + ((index * 13) % 17) / 22)
}

const TrackHeader = ({ track }: { track: Track }): ReactNode => {
  const t = useT()
  const updateTrack = useEditorStore((state) => state.updateTrack)
  return (
    <div className="track-head">
      <span className={clsx('track-icon', `kind-${track.kind}`)}>
        <Icon name={trackIcon(track.kind)} size={15} />
      </span>
      <div className="track-copy">
        <strong>{track.name}</strong>
        <span>{trackKindLabel(track.kind)}</span>
      </div>
      <div className="track-controls">
        <button
          type="button"
          className={clsx('track-control', track.hidden && 'is-off')}
          aria-label={track.hidden ? t('track.show', { name: track.name }) : t('track.hide', { name: track.name })}
          onClick={() => updateTrack(track.id, { hidden: !track.hidden })}
        >
          <Icon name={track.hidden ? 'eyeOff' : 'eye'} size={14} />
        </button>
        <button
          type="button"
          className={clsx('track-control', track.muted && 'is-off')}
          aria-label={track.muted ? t('track.unmute', { name: track.name }) : t('track.mute', { name: track.name })}
          onClick={() => updateTrack(track.id, { muted: !track.muted })}
        >
          <Icon name={track.muted ? 'mute' : 'volume'} size={14} />
        </button>
        <button
          type="button"
          className={clsx('track-control', track.locked && 'is-locked')}
          aria-label={track.locked ? t('track.unlock', { name: track.name }) : t('track.lock', { name: track.name })}
          onClick={() => updateTrack(track.id, { locked: !track.locked })}
        >
          <Icon name={track.locked ? 'lock' : 'unlock'} size={13} />
        </button>
      </div>
    </div>
  )
}

const ClipBlock = ({
  clip,
  pps,
  selected,
  locked,
  onDrag,
}: {
  clip: Clip
  pps: number
  selected: boolean
  locked: boolean
  onDrag: (event: ReactPointerEvent, mode: DragMode, clip: Clip) => void
}): ReactNode => {
  const t = useT()
  const selectClip = useEditorStore((state) => state.selectClip)
  const project = useEditorStore((state) => state.project)
  const asset = findMedia(project, clip.mediaId)
  const width = Math.max(18, clip.duration * pps)
  const isVisual = clip.type === 'video' || clip.type === 'image'
  const bars = clip.type === 'audio' ? waveBars(clip) : []

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${clip.name}, ${formatShortTime(clip.duration)}`}
      aria-pressed={selected}
      className={clsx(
        'clip',
        `type-${clip.type}`,
        selected && 'is-selected',
        locked && 'is-locked',
      )}
      style={{
        left: clip.start * pps,
        width,
        backgroundImage: isVisual && asset?.thumbnail ? `url(${asset.thumbnail})` : undefined,
      }}
      onPointerDown={(event) => {
        if (locked) return
        selectClip(clip.id)
        onDrag(event, 'move', clip)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          selectClip(clip.id)
        }
      }}
      title={`${clip.name} · ${formatShortTime(clip.duration)}`}
    >
      <span className="clip-tint" />
      {clip.type === 'audio' ? (
        <span className="wave clip-wave" aria-hidden="true">
          {bars.map((value, index) => (
            <i key={index} style={{ height: `${Math.round(value * 92)}%` }} />
          ))}
        </span>
      ) : null}
      <span className="clip-label">
        <Icon name={clipIcon(clip)} size={12} />
        <strong>{clip.type === 'text' ? clip.text?.content || clip.name : clip.name}</strong>
      </span>
      <span className="clip-duration">{formatShortTime(clip.duration)}</span>
      {clip.transitionIn ? <span className="clip-transition" title={t('timeline.transitionIn')} /> : null}
      {clip.type === 'video' && clip.muted ? (
        <span className="clip-muted" title={t('timeline.audioMuted')}>
          <Icon name="mute" size={11} />
        </span>
      ) : null}
      {selected ? (
        <>
          <button
            type="button"
            className="trim-handle left"
            aria-label={t('timeline.trimStart')}
            onPointerDown={(event) => {
              event.stopPropagation()
              onDrag(event, 'trim-left', clip)
            }}
          />
          <button
            type="button"
            className="trim-handle right"
            aria-label={t('timeline.trimEnd')}
            onPointerDown={(event) => {
              event.stopPropagation()
              onDrag(event, 'trim-right', clip)
            }}
          />
        </>
      ) : null}
    </div>
  )
}

export const Timeline = ({ onImportClick }: TimelineProps): ReactNode => {
  const t = useT()
  const project = useEditorStore((state) => state.project)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const playhead = useEditorStore((state) => state.playhead)
  const isPlaying = useEditorStore((state) => state.isPlaying)
  const pps = useEditorStore((state) => state.pxPerSecond)
  const snapping = useEditorStore((state) => state.snapping)
  const setPxPerSecond = useEditorStore((state) => state.setPxPerSecond)
  const toggleSnapping = useEditorStore((state) => state.toggleSnapping)
  const setPlayhead = useEditorStore((state) => state.setPlayhead)
  const addTextClip = useEditorStore((state) => state.addTextClip)
  const splitClip = useEditorStore((state) => state.splitClip)
  const deleteClip = useEditorStore((state) => state.deleteClip)
  const duplicateClip = useEditorStore((state) => state.duplicateClip)
  const addTrack = useEditorStore((state) => state.addTrack)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rulerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [trackMenuOpen, setTrackMenuOpen] = useState(false)
  const duration = projectDuration(project)
  const contentEnd = Math.max(24, duration + 4, playhead + 3)
  const rulerWidth = contentEnd * pps
  const step = rulerStep(pps)
  const tickCount = Math.ceil(contentEnd / step) + 1
  const selectedClip = project.clips.find((item) => item.id === selectedClipId)

  const timeAtClientX = (clientX: number): number => {
    const rect = rulerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, (clientX - rect.left) / pps)
  }

  const beginScrub = (event: ReactPointerEvent): void => {
    event.preventDefault()
    setPlayhead(timeAtClientX(event.clientX))
    const move = (moveEvent: PointerEvent): void => {
      setPlayhead(timeAtClientX(moveEvent.clientX))
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const beginDrag = (event: ReactPointerEvent, mode: DragMode, clip: Clip): void => {
    event.preventDefault()
    const asset = findMedia(project, clip.mediaId)
    dragRef.current = {
      mode,
      clipId: clip.id,
      startX: event.clientX,
      origStart: clip.start,
      origDuration: clip.duration,
      origSourceIn: clip.sourceIn,
      origSourceOut: clip.sourceOut,
      speed: clip.speed,
      mediaDuration: asset?.duration ?? clip.sourceOut,
      isMedia: clip.type === 'video' || clip.type === 'audio',
      moved: false,
    }

    const move = (moveEvent: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      const dx = moveEvent.clientX - drag.startX
      if (!drag.moved && Math.abs(dx) < 2) return
      const store = useEditorStore.getState()
      if (!drag.moved) {
        store.pushHistory()
        drag.moved = true
      }
      const dt = dx / pps
      const threshold = 8 / pps
      const targets = snapTargets(store.project, store.playhead, drag.clipId)

      if (drag.mode === 'move') {
        const candidate = Math.max(0, drag.origStart + dt)
        const snappedStart = findSnap(candidate, targets, threshold)
        const snappedEnd = findSnap(candidate + drag.origDuration, targets, threshold) - drag.origDuration
        const start =
          Math.abs(snappedStart - candidate) <= Math.abs(snappedEnd - candidate)
            ? snappedStart
            : snappedEnd
        store.mutateProject(
          (draft) => {
            const target = draft.clips.find((item) => item.id === drag.clipId)
            if (target) target.start = Math.max(0, start)
          },
          { history: false },
        )
        return
      }

      if (drag.mode === 'trim-left') {
        const maxStart = drag.origStart + drag.origDuration - 0.1
        let newStart = Math.min(maxStart, Math.max(0, drag.origStart + dt))
        newStart = findSnap(newStart, targets, threshold)
        if (drag.isMedia && drag.origSourceIn + (newStart - drag.origStart) * drag.speed < 0) {
          newStart = drag.origStart - drag.origSourceIn / drag.speed
        }
        newStart = Math.min(maxStart, Math.max(0, newStart))
        let newSourceIn = drag.origSourceIn
        let newDuration = drag.origDuration - (newStart - drag.origStart)
        if (drag.isMedia) {
          newSourceIn = Math.max(0, drag.origSourceIn + (newStart - drag.origStart) * drag.speed)
          newDuration = Math.max(0.1, drag.origDuration - (newStart - drag.origStart))
        }
        store.mutateProject(
          (draft) => {
            const target = draft.clips.find((item) => item.id === drag.clipId)
            if (!target) return
            target.start = newStart
            target.duration = newDuration
            target.sourceIn = newSourceIn
            if (!drag.isMedia) target.sourceOut = newDuration
          },
          { history: false },
        )
        return
      }

      let candidateEnd = drag.origStart + drag.origDuration + dt
      candidateEnd = findSnap(candidateEnd, targets, threshold)
      let newDuration = Math.max(0.1, candidateEnd - drag.origStart)
      if (drag.isMedia) {
        const maxDuration = Math.max(0.1, (drag.mediaDuration - drag.origSourceIn) / drag.speed)
        newDuration = Math.min(newDuration, maxDuration)
      }
      store.mutateProject(
        (draft) => {
          const target = draft.clips.find((item) => item.id === drag.clipId)
          if (!target) return
          target.duration = newDuration
          target.sourceOut = drag.isMedia
            ? drag.origSourceIn + newDuration * drag.speed
            : newDuration
        },
        { history: false },
      )
    }

    const up = (): void => {
      dragRef.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  useEffect(() => {
    if (!isPlaying) return
    const scroll = scrollRef.current
    if (!scroll) return
    const x = playhead * pps
    if (x > scroll.scrollLeft + scroll.clientWidth - 120) {
      scroll.scrollLeft = x - scroll.clientWidth * 0.4
    }
  }, [playhead, isPlaying, pps])

  return (
    <section className="timeline" aria-label={t('timeline.label')}>
      <div className="timeline-toolbar">
        <div className="toolbar-group">
          <button type="button" className="button compact" onClick={onImportClick}>
            <Icon name="upload" size={15} />
            {t('timeline.media')}
          </button>
          <button type="button" className="button compact" onClick={() => addTextClip(t('common.newText'))}>
            <Icon name="text" size={15} />
            {t('timeline.text')}
          </button>
          <span className="toolbar-divider" />
          <button
            type="button"
            className="icon-btn"
            title={t('timeline.split')}
            aria-label={t('timeline.splitAria')}
            disabled={!selectedClip}
            onClick={splitClip}
          >
            <Icon name="scissors" size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title={t('timeline.duplicate')}
            aria-label={t('timeline.duplicate')}
            disabled={!selectedClip}
            onClick={() => duplicateClip()}
          >
            <Icon name="copy" size={16} />
          </button>
          <button
            type="button"
            className="icon-btn danger-hover"
            title={t('timeline.delete')}
            aria-label={t('timeline.delete')}
            disabled={!selectedClip}
            onClick={() => deleteClip()}
          >
            <Icon name="trash" size={16} />
          </button>
          <DropdownMenu.Root open={trackMenuOpen} onOpenChange={setTrackMenuOpen}>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="icon-btn" aria-label={t('timeline.addTrack')} title={t('timeline.addTrack')}>
                <Icon name="plus" size={17} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="menu-content" sideOffset={8} align="start">
                <DropdownMenu.Item className="menu-item" onSelect={() => addTrack('text')}>
                  <Icon name="text" size={15} /> {t('timeline.trackText')}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="menu-item" onSelect={() => addTrack('overlay')}>
                  <Icon name="layers" size={15} /> {t('timeline.trackOverlay')}
                </DropdownMenu.Item>
                <DropdownMenu.Item className="menu-item" onSelect={() => addTrack('audio')}>
                  <Icon name="audio" size={15} /> {t('timeline.trackAudio')}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="toolbar-group">
          <span className="timeline-duration">{formatShortTime(duration)}</span>
          <button
            type="button"
            className={clsx('icon-btn', snapping && 'is-active')}
            aria-label={snapping ? t('timeline.magnetOff') : t('timeline.magnetOn')}
            title={t('timeline.magnet')}
            onClick={toggleSnapping}
          >
            <Icon name="magnet" size={16} />
          </button>
          <button
            type="button"
            className="icon-btn small"
            aria-label={t('timeline.zoomOut')}
            onClick={() => setPxPerSecond(pps - 12)}
          >
            <Icon name="zoomOut" size={15} />
          </button>
          <input
            className="zoom-range"
            type="range"
            min={18}
            max={180}
            step={1}
            value={pps}
            aria-label={t('timeline.zoom')}
            onChange={(event) => setPxPerSecond(Number(event.target.value))}
          />
          <button
            type="button"
            className="icon-btn small"
            aria-label={t('timeline.zoomIn')}
            onClick={() => setPxPerSecond(pps + 12)}
          >
            <Icon name="zoomIn" size={15} />
          </button>
        </div>
      </div>

      <div className="timeline-scroll" ref={scrollRef}>
        <div className="timeline-content" style={{ width: 132 + rulerWidth }}>
          <div className="ruler-row">
            <div className="ruler-spacer" />
            <div className="ruler-lane" ref={rulerRef} style={{ width: rulerWidth }} onPointerDown={beginScrub}>
              {Array.from({ length: tickCount }).map((_, index) => {
                const time = index * step
                return (
                  <span key={index} className="ruler-tick" style={{ left: time * pps }}>
                    <i />
                    <em>{formatRulerTime(time)}</em>
                  </span>
                )
              })}
            </div>
          </div>

          {project.tracks.map((track) => {
            const items = clipsOnTrack(project, track.id)
            return (
              <div className="track-row" key={track.id}>
                <TrackHeader track={track} />
                <div
                  className={clsx('track-lane', track.hidden && 'is-hidden', track.locked && 'is-locked')}
                  style={{ width: rulerWidth }}
                  onPointerDown={(event) => {
                    if (event.target !== event.currentTarget) return
                    beginScrub(event)
                  }}
                >
                  {items.map((clip) => (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      pps={pps}
                      selected={clip.id === selectedClipId}
                      locked={track.locked || track.hidden}
                      onDrag={beginDrag}
                    />
                  ))}
                  {items.length === 0 ? (
                    <span className="lane-empty">
                      {track.kind === 'text'
                        ? t('timeline.laneText')
                        : track.kind === 'audio'
                          ? t('timeline.laneAudio')
                          : t('timeline.laneMedia')}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          })}

          <div className="playhead" style={{ left: 132 + playhead * pps }}>
            <button
              type="button"
              className="playhead-handle"
              aria-label={t('timeline.playhead')}
              onPointerDown={beginScrub}
            />
            <span className="playhead-line" />
          </div>
        </div>
      </div>
    </section>
  )
}
