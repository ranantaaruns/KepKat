import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import clsx from 'clsx'
import { useT, t as translate } from '../i18n'
import { useEditorStore } from '../editor/store'
import { formatTimecode, projectDuration } from '../editor/timelineMath'
import { Compositor } from '../services/compositor'
import { Icon } from './Icon'

interface PreviewProps {
  onImportClick: () => void
  onNotice: (message: string, tone?: 'normal' | 'error') => void
}

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`

export const Preview = ({ onImportClick, onNotice }: PreviewProps): ReactNode => {
  const t = useT()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const compositorRef = useRef<Compositor | null>(null)
  const [error, setError] = useState('')
  const aspect = useEditorStore((state) => state.project.width / state.project.height)
  const projectWidth = useEditorStore((state) => state.project.width)
  const projectHeight = useEditorStore((state) => state.project.height)
  const projectName = useEditorStore((state) => state.project.name)
  const clipCount = useEditorStore((state) => state.project.clips.length)
  const playhead = useEditorStore((state) => state.playhead)
  const duration = useEditorStore((state) => projectDuration(state.project))
  const isPlaying = useEditorStore((state) => state.isPlaying)
  const fps = useEditorStore((state) => state.project.fps)
  const togglePlay = useEditorStore((state) => state.togglePlay)
  const setPlayhead = useEditorStore((state) => state.setPlayhead)
  const addTextClip = useEditorStore((state) => state.addTextClip)
  const eyedropper = useEditorStore((state) => state.eyedropper)
  const setEyedropper = useEditorStore((state) => state.setEyedropper)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const updateChroma = useEditorStore((state) => state.updateChroma)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const compositor = new Compositor(canvas)
      compositorRef.current = compositor
      let raf = 0
      const loop = (): void => {
        const state = useEditorStore.getState()
        compositor.render(state.project, state.playhead, state.isPlaying)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => {
        cancelAnimationFrame(raf)
        compositor.dispose()
        compositorRef.current = null
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : translate('preview.errorFallback')
      queueMicrotask(() => setError(message))
      return
    }
  }, [])

  useEffect(() => {
    const stageElement = stageRef.current
    if (!stageElement) return
    const measure = (): void => {
      const rect = stageElement.getBoundingClientRect()
      const availableWidth = Math.max(120, rect.width - 48)
      const availableHeight = Math.max(80, rect.height - 48)
      const width = Math.min(availableWidth, availableHeight * aspect)
      const height = width / aspect
      const shell = shellRef.current
      if (shell) {
        shell.style.width = `${width}px`
        shell.style.height = `${height}px`
      }
      const canvas = canvasRef.current
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        const maxWidth = 1440
        const targetWidth = Math.min(maxWidth, Math.round(width * dpr))
        canvas.width = Math.max(2, targetWidth)
        canvas.height = Math.max(2, Math.round(targetWidth / aspect))
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stageElement)
    return () => observer.disconnect()
  }, [aspect])

  const pickColor = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!eyedropper) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * canvas.width)
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * canvas.height)
    const sample = document.createElement('canvas')
    sample.width = canvas.width
    sample.height = canvas.height
    const context = sample.getContext('2d', { willReadFrequently: true })
    if (!context) return
    context.drawImage(canvas, 0, 0)
    const pixel = context.getImageData(
      Math.max(0, Math.min(canvas.width - 1, x)),
      Math.max(0, Math.min(canvas.height - 1, y)),
      1,
      1,
    ).data
    const hex = rgbToHex(pixel[0], pixel[1], pixel[2])
    if (selectedClipId) {
      updateChroma(selectedClipId, { color: hex, enabled: true })
      onNotice(t('preview.pickNotice', { hex: hex.toUpperCase() }))
    }
    setEyedropper(false)
  }

  const skipToEnd = (): void => {
    useEditorStore.getState().pause()
    setPlayhead(duration)
  }

  return (
    <section className="preview-panel" aria-label={t('preview.panelLabel')}>
      <div className="preview-head">
        <div>
          <span className="eyebrow">{t('preview.eyebrow')}</span>
          <strong>{projectName}</strong>
        </div>
        <div className="preview-meta">
          <span>
            {projectWidth}×{projectHeight}
          </span>
          <span>{fps} fps</span>
          <span className={clsx('live-dot', isPlaying && 'is-playing')} />
        </div>
      </div>

      <div className="preview-stage" ref={stageRef}>
        <div className={clsx('canvas-shell', eyedropper && 'is-picking')} ref={shellRef}>
          <canvas
            ref={canvasRef}
            className="preview-canvas"
            onPointerDown={pickColor}
            onDoubleClick={togglePlay}
            aria-label={t('preview.canvasLabel')}
          />
          {error ? (
            <div className="preview-empty">
              <Icon name="alert" size={24} />
              <strong>{t('preview.failed')}</strong>
              <span>{error}</span>
            </div>
          ) : null}
          {!error && clipCount === 0 ? (
            <div className="preview-empty">
              <span className="empty-kicker">{t('preview.emptyKicker')}</span>
              <strong>{t('preview.emptyTitle')}</strong>
              <p>{t('preview.emptyBody')}</p>
              <div className="empty-actions">
                <button type="button" className="button primary" onClick={onImportClick}>
                  <Icon name="upload" size={16} />
                  {t('preview.import')}
                </button>
                <button type="button" className="button" onClick={() => addTextClip(t('common.newText'))}>
                  <Icon name="text" size={16} />
                  {t('preview.addText')}
                </button>
              </div>
            </div>
          ) : null}
          {eyedropper ? <div className="pick-hint">{t('preview.pickHint')}</div> : null}
          <div className="canvas-corner top-left" />
          <div className="canvas-corner top-right" />
          <div className="canvas-corner bottom-left" />
          <div className="canvas-corner bottom-right" />
        </div>
      </div>

      <div className="transport">
        <div className="transport-side">
          <button
            type="button"
            className="icon-btn"
            aria-label={t('preview.toStart')}
            onClick={() => {
              useEditorStore.getState().pause()
              setPlayhead(0)
            }}
          >
            <Icon name="back" size={17} />
          </button>
          <button type="button" className="play-button" aria-label={isPlaying ? t('preview.pause') : t('preview.play')} onClick={togglePlay}>
            <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
          </button>
          <button type="button" className="icon-btn" aria-label={t('preview.toEnd')} onClick={skipToEnd}>
            <Icon name="forward" size={17} />
          </button>
        </div>
        <div className="timecode" aria-label={t('preview.timecode')}>
          <strong>{formatTimecode(playhead, fps)}</strong>
          <span>/ {formatTimecode(duration, fps)}</span>
        </div>
        <div className="transport-side end">
          <span className="shortcut-hint">{t('preview.shortcut')}</span>
          <span className={clsx('save-indicator', isPlaying && 'is-live')}>
            {isPlaying ? t('preview.playing') : t('preview.ready')}
          </span>
        </div>
      </div>
    </section>
  )
}
