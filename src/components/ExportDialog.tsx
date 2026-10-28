import { useEffect, useRef, useState, type ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import clsx from 'clsx'
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

const phaseLabel: Record<ExportPhase, string> = {
  prepare: 'Menyiapkan',
  render: 'Merender',
  transcode: 'Transcode',
  done: 'Selesai',
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
      setError('Timeline masih kosong. Tambahkan klip sebelum ekspor.')
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
      setMessage('Berkas sudah diunduh.')
      onNotice(`Ekspor selesai: ${output.extension.toUpperCase()}`)
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') {
        setMessage('Ekspor dibatalkan.')
        setPhase('prepare')
        setProgress(0)
      } else {
        const text = reason instanceof Error ? reason.message : 'Ekspor gagal.'
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
              <span className="eyebrow">Ekspor</span>
              <Dialog.Title>Bawa keluar dari Kepkat.</Dialog.Title>
              <Dialog.Description>
                Render dilakukan di browser. Untuk MP4, berkas WebM akan dikonversi lebih dulu.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="icon-btn" aria-label="Tutup dialog ekspor">
                <Icon name="close" size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="export-body">
            <div className="export-section">
              <span className="field-label">Format</span>
              <div className="format-grid">
                <button
                  type="button"
                  className={clsx('format-card', format === 'webm' && 'is-active')}
                  disabled={active}
                  onClick={() => setFormat('webm')}
                >
                  <span className="format-icon">W</span>
                  <strong>WebM</strong>
                  <span>Cepat, kualitas baik, langsung dari perangkat.</span>
                </button>
                <button
                  type="button"
                  className={clsx('format-card', format === 'mp4' && 'is-active')}
                  disabled={active}
                  onClick={() => setFormat('mp4')}
                >
                  <span className="format-icon">M</span>
                  <strong>MP4</strong>
                  <span>Kompatibel luas. Perlu waktu transcode tambahan.</span>
                </button>
              </div>
            </div>

            <div className="export-grid">
              <label className="select-field">
                <span>Resolusi</span>
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
                <span>Frame rate</span>
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
                <span>Kualitas</span>
                <span className="select-wrap">
                  <select
                    value={quality}
                    disabled={active}
                    onChange={(event) =>
                      setQuality(event.target.value === 'high' ? 'high' : 'medium')
                    }
                  >
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                  </select>
                </span>
              </label>
            </div>

            <label className="filename-field">
              <span>Nama berkas</span>
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
                <span>Ukuran bingkai</span>
                <strong>
                  {dimensions.width} × {dimensions.height}
                </strong>
              </div>
              <div>
                <span>Durasi</span>
                <strong>{Math.ceil(duration)} detik</strong>
              </div>
              <div>
                <span>Proses</span>
                <strong>{format === 'mp4' ? 'Render + transcode' : 'Render langsung'}</strong>
              </div>
            </div>

            {format === 'webm' ? (
              <div className="note-card">
                <Icon name="alert" size={18} />
                <p>
                  WebM direkam secara real-time. Biarkan tab ini tetap aktif selama proses
                  berlangsung; pindah tab bisa membuat frame tersendat.
                </p>
              </div>
            ) : (
              <div className="note-card">
                <Icon name="alert" size={18} />
                <p>
                  MP4 memakai ffmpeg.wasm. Unduhan pertama akan memuat encoder sekitar 30 MB,
                  lalu proses transcode bisa memakan waktu lebih lama dari durasi video.
                </p>
              </div>
            )}

            {active || result || error ? (
              <div className={clsx('export-progress', error && 'has-error')}>
                <div className="export-progress-head">
                  <span>{error ? 'Gagal' : result ? 'Selesai' : phaseLabel[phase]}</span>
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
                Batalkan
              </button>
            ) : (
              <Dialog.Close asChild>
                <button type="button" className="button">
                  Tutup
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
              {active ? 'Memproses…' : result ? 'Ekspor lagi' : `Ekspor ${format.toUpperCase()}`}
            </button>
          </div>
    </Dialog.Content>
  )
}
