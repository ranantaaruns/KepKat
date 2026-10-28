import type { ReactNode } from 'react'
import clsx from 'clsx'
import { setLanguage, useLanguage, useT, type TranslationKey } from '../i18n'
import { useEditorStore } from '../editor/store'
import type { SaveState } from '../editor/types'
import { Icon } from './Icon'

interface TopBarProps {
  onExport: () => void
}

const saveKey: Record<SaveState, TranslationKey> = {
  idle: 'save.idle',
  saving: 'save.saving',
  saved: 'save.saved',
  error: 'save.error',
}

export const TopBar = ({ onExport }: TopBarProps): ReactNode => {
  const t = useT()
  const language = useLanguage()
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
          <em>{t('topbar.tagline')}</em>
        </div>
      </div>

      <div className="project-title">
        <span className="eyebrow">{t('topbar.project')}</span>
        <input
          value={name}
          aria-label={t('topbar.projectName')}
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
            aria-label={t('topbar.undo')}
            title={t('topbar.undoShortcut')}
            onClick={undo}
          >
            <Icon name="undo" size={17} />
          </button>
          <button
            type="button"
            className="icon-btn"
            disabled={!canRedo}
            aria-label={t('topbar.redo')}
            title={t('topbar.redoShortcut')}
            onClick={redo}
          >
            <Icon name="redo" size={17} />
          </button>
        </div>

        <div className={clsx('save-state', saveState)} title={saveMessage || t(saveKey[saveState])}>
          <span className="save-dot" />
          {t(saveKey[saveState])}
        </div>

        <div className="language-switch" role="group" aria-label={t('language.label')}>
          <button
            type="button"
            className={clsx(language === 'id' && 'is-active')}
            aria-pressed={language === 'id'}
            title={t('language.indonesian')}
            onClick={() => setLanguage('id')}
          >
            ID
          </button>
          <button
            type="button"
            className={clsx(language === 'en' && 'is-active')}
            aria-pressed={language === 'en'}
            title={t('language.english')}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
        </div>

        <button
          type="button"
          className="icon-btn mobile-only"
          aria-label={t('topbar.openMedia')}
          onClick={() => setMobilePanel('left')}
        >
          <Icon name="folder" size={18} />
        </button>
        <button
          type="button"
          className="icon-btn mobile-only"
          aria-label={t('topbar.openClipSettings')}
          onClick={() => setMobilePanel(selectedClipId ? 'right' : 'left')}
        >
          <Icon name="settings" size={18} />
        </button>

        <button type="button" className="button export-button" onClick={onExport}>
          <Icon name="export" size={16} />
          <span>{t('topbar.export')}</span>
        </button>
      </div>
    </header>
  )
}
