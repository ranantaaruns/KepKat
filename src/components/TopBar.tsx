import type { ReactNode } from 'react'
import clsx from 'clsx'
import { useEditorStore } from '../editor/store'
import { Icon } from './Icon'

interface TopBarProps {
  onExport: () => void
}

const saveCopy: Record<string, string> = {
  idle: 'Siap',
  saving: 'Menyimpan…',
  saved: 'Tersimpan',
  error: 'Gagal menyimpan',
}

export const TopBar = ({ onExport }: TopBarProps): ReactNode => {
  const name = useEditorStore((state) => state.project.name)
  const setProjectName = useEditorStore((state) => state.setProjectName)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const canUndo = useEditorStore((state) => state.historyPast.length > 0)
  const canRedo = useEditorStore((state) => state.historyFuture.length > 0)
  const saveState = useEditorStore((state) => state.saveState)
  const saveMessage = useEditorStore((state) => state.saveMessage)
  const setMobilePanel = useEditorStore((state) => state.setMobilePanel)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-copy">
          <strong>
            Kepkat<span>.</span>
          </strong>
          <em>studio potong</em>
        </div>
      </div>

      <div className="project-title">
        <span className="eyebrow">Proyek</span>
        <input
          value={name}
          aria-label="Nama proyek"
          spellCheck={false}
          onChange={(event) => setProjectName(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <div className="history-buttons">
          <button
            type="button"
            className="icon-btn"
            disabled={!canUndo}
            aria-label="Urungkan"
            title="Urungkan (Ctrl+Z)"
            onClick={undo}
          >
            <Icon name="undo" size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!canRedo}
            aria-label="Ulangi"
            title="Ulangi (Ctrl+Shift+Z)"
            onClick={redo}
          >
            <Icon name="redo" size={17} />
          </button>
        </div>

        <div className={clsx('save-state', saveState)} title={saveMessage || saveCopy[saveState]}>
          <span className="save-dot" />
          {saveCopy[saveState]}
        </div>

        <button
          type="button"
          className="icon-btn mobile-only"
          aria-label="Buka panel media"
          onClick={() => setMobilePanel('left')}
        >
          <Icon name="folder" size={18} />
        </button>
        <button
          type="button"
          className="icon-btn mobile-only"
          aria-label="Buka pengaturan klip"
          onClick={() => setMobilePanel(selectedClipId ? 'right' : 'left')}
        >
          <Icon name="settings" size={18} />
        </button>

        <button type="button" className="button export-button" onClick={onExport}>
          <Icon name="export" size={16} />
          <span>Ekspor</span>
        </button>
      </div>
    </header>
  )
}
