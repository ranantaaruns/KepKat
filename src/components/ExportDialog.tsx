import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
import { useT, type TranslationKey } from '../i18n'
import { useEditorStore } from '../editor/store'
import { projectDuration } from '../editor/timelineMath'
import type { ExportSettings } from '../editor/types'
import { exportProject, exportResolution, type ExportPhase } from '../services/exporter'
import { formatBytes } from '../services/media'
import { Icon } from './Icon'

interface ExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNotice: (message: string, tone?: 'normal' | 'error') => void
}

const defaultName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'kepkat-export'

const phaseKey: Record<ExportPhase, TranslationKey> = {
  prepare: 'export.phase.prepare',
  render: 'export.phase.render',
  transcode: 'export.phase.transcode',
  done: 'export.phase.done',
}

interface ExportFormProps {
  controllerRef: { current: AbortController | null }
  onNotice: (message: string, tone?: 'normal' | 'error') => void
}

export const ExportDialog = ({ open, onOpenChange, onNotice }: ExportDialogProps): ReactNode => {
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) controllerRef.current?.abort()
  }, [open])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) controllerRef.current?.abort()
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {open ? <ExportForm controllerRef={controllerRef} onNotice={onNotice} /> : null}
      </Dialog.Portal>
    </Dialog.Root>
  )
}

const ExportForm = ({ controllerRef, onNotice }: ExportFormProps): ReactNode => {
  const t = useT()
  const project = useEditorStore((state) => state.project)
  const duration = projectDuration(project)
  const [format, setFormat] = useState<ExportSettings['format']>('webm')
  const [resolution, setResolution] = useState<ExportSettings['resolution']>('1080p')
  const [fps, setFps] = useState<ExportSettings['fps']>(
    project.fps === 24 || project.fps === 60 ? project.fps : 30,
  )
  const [quality, setQuality] = useState<ExportSettings['quality']>('high')
  const [fileName, setFileName] = useState(defaultName(project.name))
  const [active, setActive] = useState(false)
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<ExportPhase>('prepare')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ name: string; size: number } | null>(null)
  const [error, setError] = useState('')
  const dimensions = exportResolution(project, resolution)

  const download = (blob: Blob, extension: 'webm' | 'mp4'): void => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${defaultName(fileName || project.name)}.${extension}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
  }

  const start = async (): Promise<void> => {
    if (duration <= 0) {
      setError(t('export.empty'))
      return
    }
    const controller = new AbortController()
    controllerRef.current = controller
    setActive(true)
    setError('')
    setResult(null)
    setProgress(0)
    try {
      const output = await exportProject(
        project,
        {
          format,
          resolution,
          fps,
          quality,
          fileName: defaultName(fileName || project.name),
        },
        (update) => {
          setPhase(update.phase)
          setProgress(update.progress)
          setMessage(update.message)
        },
        controller.signal,
      )
      download(output.blob, output.extension)
      setResult({
        name: `${defaultName(fileName || project.name)}.${output.extension}`,
        size: output.blob.size,
      })
      setPhase('done')
      setProgress(1)
      setMessage(t('export.downloaded'))
      onNotice(t('export.completeNotice', { format: output.extension.toUpperCase() }))
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setMessage(t('export.cancelled'))
        setPhase('prepare')
        setProgress(0)
      } else {
        const text = reason instanceof Error ? reason.message : t('export.failed')
        setError(text)
        onNotice(text, 'error')
      }
    } finally {
      setActive(false)
      controllerRef.current = null
    }
  }

  const cancel = (): void => {
    controllerRef.current?.abort()
  }

  return (
    <Dialog.Content className="dialog-content export-dialog">
          <div className="dialog-head">
            <div>
              <span className="eyebrow">{t('export.eyebrow')}</span>
              <Dialog.Title>{t('export.title')}</Dialog.Title>
              <Dialog.Description>{t('export.description')}</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label={t('export.closeDialog')}>
                <Icon name="close" size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="export-body">
            <div className="export-section">
              <span className="field-label">{t('export.format')}</span>
              <div className="format-grid">
                <button
                  type="button"
                  className={clsx('format-card', format === 'webm' && 'is-active')}
                  disabled={active}
                  onClick={() => setFormat('webm')}
                >
                  <span className="format-icon">W</span>
                  <strong>WebM</strong>
                  <span>{t('export.webmNote')}</span>
                </button>
                <button
                  type="button"
                  className={clsx('format-card', format === 'mp4' && 'is-active')}
                  disabled={active}
                  onClick={() => setFormat('mp4')}
                >
                  <span className="format-icon">M</span>
                  <strong>MP4</strong>
                  <span>{t('export.mp4Note')}</span>
                </button>
              </div>
            </div>

            <div className="export-grid">
              <label className="select-field">
                <span>{t('export.resolution')}</span>
                <span className="select-wrap">
                  <select
                    value={resolution}
                    disabled={active}
                    onChange={(event) =>
                      setResolution(event.target.value as ExportSettings['resolution'])
                    }
                  >
                    <option value="720p">720p</option>
                    <option value="1080p">1080p</option>
                    <option value="1440p">1440p</option>
                    <option value="4k">4K</option>
                  </select>
                </span>
              </label>
              <label className="select-field">
                <span>{t('export.frameRate')}</span>
                <span className="select-wrap">
                  <select
                    value={String(fps)}
                    disabled={active}
                    onChange={(event) =>
                      setFps(Number(event.target.value) === 24 ? 24 : Number(event.target.value) === 60 ? 60 : 30)
                    }
                  >
                    <option value="24">24 fps</option>
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </span>
              </label>
              <label className="select-field">
                <span>{t('export.quality')}</span>
                <span className="select-wrap">
                  <select
                    value={quality}
                    disabled={active}
                    onChange={(event) =>
                      setQuality(event.target.value === 'high' ? 'high' : 'medium')
                    }
                  >
                    <option value="high">{t('export.high')}</option>
                    <option value="medium">{t('export.medium')}</option>
                  </select>
                </span>
              </label>
            </div>

            <label className="filename-field">
              <span>{t('export.fileName')}</span>
              <span className="filename-input">
                <input
                  value={fileName}
                  disabled={active}
                  spellCheck={false}
                  onChange={(event) => setFileName(event.target.value)}
                />
                <em>.{format}</em>
              </span>
            </label>

            <div className="export-summary">
              <div>
                <span>{t('export.frameSize')}</span>
                <strong>
                  {dimensions.width} × {dimensions.height}
                </strong>
              </div>
              <div>
                <span>{t('export.duration')}</span>
                <strong>{t('export.seconds', { count: Math.ceil(duration) })}</strong>
              </div>
              <div>
                <span>{t('export.process')}</span>
                <strong>{format === 'mp4' ? t('export.renderTranscode') : t('export.renderDirect')}</strong>
              </div>
            </div>

            {format === 'webm' ? (
              <div className="note-card">
                <Icon name="alert" size={18} />
                <p>{t('export.webmWarning')}</p>
              </div>
            ) : (
              <div className="note-card">
                <Icon name="alert" size={18} />
                <p>{t('export.mp4Warning')}</p>
              </div>
            )}

            {active || result || error ? (
              <div className={clsx('export-progress', error && 'has-error')}>
                <div className="export-progress-head">
                  <span>{error ? t('export.failedLabel') : result ? t('export.doneLabel') : t(phaseKey[phase])}</span>
                  <strong>{Math.round(progress * 100)}%</strong>
                </div>
                <div className="progress-track">
                  <span style={{ width: `${Math.max(2, progress * 100)}%` }} />
                </div>
                <p>{error || (result ? `${result.name} · ${formatBytes(result.size)}` : message)}</p>
              </div>
            ) : null}
          </div>

          <div className="dialog-actions">
            {active ? (
              <button type="button" className="button danger" onClick={cancel}>
                {t('export.cancel')}
              </button>
            ) : (
              <Dialog.Close asChild>
                <button type="button" className="button">
                  {t('export.close')}
                </button>
              </Dialog.Close>
            )}
            <button
              type="button"
              className="button primary"
              disabled={active || duration <= 0}
              onClick={() => void start()}
            >
              <Icon name={result ? 'check' : 'export'} size={16} />
              {active ? t('export.processing') : result ? t('export.exportAgain') : t('export.exportFormat', { format: format.toUpperCase() })}
            </button>
          </div>
    </Dialog.Content>
  )
}
