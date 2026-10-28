import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ExportDialog } from './components/ExportDialog'
import { Icon } from './components/Icon'
import { Inspector } from './components/Inspector'
import { LeftPanel } from './components/LeftPanel'
import { Preview } from './components/Preview'
import { Timeline } from './components/Timeline'
import { TopBar } from './components/TopBar'
import { useT, t as translate } from './i18n'
import { useEditorStore } from './editor/store'
import { projectDuration } from './editor/timelineMath'
import { audioEngine } from './services/audioEngine'
import { createAssetWithWaveform, mediaKind } from './services/media'
import { mediaPool } from './services/mediaPool'
import {
  deleteMediaBlob,
  loadMediaBlobs,
  loadProject,
  saveMediaBlob,
  saveProject,
} from './services/projectDb'

type Tone = 'normal' | 'error'

interface Toast {
  id: number
  message: string
  tone: Tone
}

export default function App(): ReactNode {
  const [ready, setReady] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const t = useT()
  const [importing, setImporting] = useState(false)
  const [importingName, setImportingName] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [bootError, setBootError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const saveTimer = useRef<number | undefined>(undefined)
  const importLabel = importingName
    ? t('app.importingFile', { name: importingName })
    : t('app.importingMedia')
  const isPlaying = useEditorStore((state) => state.isPlaying)
  const mobilePanel = useEditorStore((state) => state.mobilePanel)
  const setMobilePanel = useEditorStore((state) => state.setMobilePanel)

  const notify = useCallback((message: string, tone: Tone = 'normal'): void => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, tone })
    toastTimer.current = window.setTimeout(() => setToast(null), tone === 'error' ? 6000 : 3600)
  }, [])

  useEffect(() => {
    let cancelled = false
    const boot = async (): Promise<void> => {
      try {
        const project = await loadProject()
        if (project) {
          const blobs = await loadMediaBlobs(project.media.map((item) => item.id))
          for (const [id, blob] of blobs) mediaPool.setBlob(id, blob)
          if (!cancelled) {
            useEditorStore.getState().restoreProject(project)
            if (blobs.size < project.media.length) {
              notify(translate('app.partialMedia'), 'error')
            }
          }
        }
      } catch (reason) {
        if (!cancelled) {
          setBootError(
            reason instanceof Error ? reason.message : translate('app.storageOpenError'),
          )
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    void boot()
    return () => {
      cancelled = true
    }
  }, [notify])

  useEffect(() => {
    if (!ready) return
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (state.project === previous.project) return
      useEditorStore.getState().setSaveState('saving')
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        const current = useEditorStore.getState()
        void saveProject(current.project)
          .then(() => current.setSaveState('saved'))
          .catch((reason: unknown) => {
            current.setSaveState(
              'error',
              reason instanceof Error ? reason.message : translate('app.saveError'),
            )
          })
      }, 650)
    })
    return () => {
      unsubscribe()
      window.clearTimeout(saveTimer.current)
    }
  }, [ready])

  useEffect(() => {
    if (!ready) return
    let raf = 0
    let previous = performance.now()
    let lastAudio = 0
    const loop = (now: number): void => {
      const state = useEditorStore.getState()
      const delta = Math.max(0, (now - previous) / 1000)
      previous = now
      if (state.isPlaying) {
        const duration = projectDuration(state.project)
        const next = state.playhead + delta
        if (next >= duration) {
          state.pause()
          state.setPlayhead(duration)
        } else {
          state.setPlayhead(next)
        }
      }
      if (now - lastAudio > 50) {
        const audioState = useEditorStore.getState()
        audioEngine.sync(audioState.project, audioState.playhead, audioState.isPlaying)
        lastAudio = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  useEffect(() => {
    if (isPlaying) audioEngine.resume()
  }, [isPlaying])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }
      const state = useEditorStore.getState()
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) state.redo()
        else state.undo()
        return
      }
      if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        state.redo()
        return
      }
      if (mod && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        state.splitClip()
        return
      }
      if (mod && event.key.toLowerCase() === 'e') {
        event.preventDefault()
        setExportOpen(true)
        return
      }
      if (event.code === 'Space') {
        event.preventDefault()
        state.togglePlay()
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selectedClipId) {
          event.preventDefault()
          state.deleteClip()
        }
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const step = event.shiftKey ? 1 : 1 / state.project.fps
        const direction = event.key === 'ArrowLeft' ? -1 : 1
        state.pause()
        state.setPlayhead(state.playhead + step * direction)
        return
      }
      if (event.key === 'Escape') {
        setMobilePanel(null)
        setExportOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setMobilePanel])

  useEffect(() => {
    return () => {
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(saveTimer.current)
      audioEngine.dispose()
      mediaPool.clear()
    }
  }, [])

  const importFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const valid = files.filter((file) => mediaKind(file))
      if (valid.length === 0) {
        notify(t('service.unsupportedFile'), 'error')
        return
      }
      setImporting(true)
      let imported = 0
      for (const file of valid) {
        setImportingName(file.name)
        try {
          const { asset } = await createAssetWithWaveform(file)
          await saveMediaBlob(asset.id, file)
          mediaPool.setBlob(asset.id, file)
          useEditorStore.getState().addMedia(asset)
          imported += 1
        } catch (reason) {
          notify(reason instanceof Error ? reason.message : t('app.importFailed', { name: file.name }), 'error')
        }
      }
      setImporting(false)
      setImportingName(null)
      if (imported > 0) notify(t('app.imported', { count: imported }))
    },
    [notify, t],
  )

  const removeMedia = useCallback(
    async (assetId: string): Promise<void> => {
      const project = useEditorStore.getState().project
      const asset = project.media.find((item) => item.id === assetId)
      if (!asset) return
      if (!window.confirm(t('app.removeConfirm', { name: asset.name }))) return
      mediaPool.release(assetId)
      useEditorStore.getState().removeMedia(assetId)
      await deleteMediaBlob(assetId).catch(() => undefined)
      notify(t('app.removed'))
    },
    [notify, t],
  )

  if (!ready) {
    return (
      <div className="boot-screen">
        <div>
          <strong>Kepkat<span>.</span></strong>
          <span>{t('app.booting')}</span>
        </div>
        <span className="boot-line" />
      </div>
    )
  }

  return (
    <div className="app-shell">
      <TopBar onExport={() => setExportOpen(true)} />
      <main className="workspace">
        <LeftPanel
          onImportFiles={(files) => void importFiles(files)}
          importing={importing}
          importLabel={importLabel}
          onRemoveMedia={(id) => void removeMedia(id)}
        />
        <Preview
          onImportClick={() => fileInputRef.current?.click()}
          onNotice={notify}
        />
        <Inspector />
      </main>
      <Timeline onImportClick={() => fileInputRef.current?.click()} />
      {mobilePanel ? (
        <button
          type="button"
          className="mobile-scrim"
          aria-label={t('app.closePanel')}
          onClick={() => setMobilePanel(null)}
        />
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          if (files.length) void importFiles(files)
          event.target.value = ''
        }}
      />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} onNotice={notify} />
      {bootError ? <div className="boot-error">{bootError}</div> : null}
      {toast ? (
        <div key={toast.id} className={clsx('toast', toast.tone === 'error' && 'is-error')} role="status">
          <Icon name={toast.tone === 'error' ? 'alert' : 'check'} size={16} />
          <span>{toast.message}</span>
          <button type="button" aria-label={t('topbar.closeNotification')} onClick={() => setToast(null)}>
            <Icon name="close" size={13} />
          </button>
        </div>
      ) : null}
    </div>
  )
}
