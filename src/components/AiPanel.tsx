import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import clsx from 'clsx'
import { Icon } from './Icon'
import { AiPlanCard } from './AiPlanCard'
import { useT, type TranslationKey } from '../i18n'
import { useEditorStore } from '../editor/store'
import { createProjectSnapshot } from '../ai/snapshot'
import { agentPlanSchema } from '../ai/schema'
import type { AgentPlan, AiChatMessage, AiMode } from '../ai/schema'
import {
  AgentPlanError,
  type AgentPlanErrorCode,
  type AiChatEntry,
  type AiChatResponse,
  type AiErrorCode,
  type AiErrorResponse,
  type AiNotice,
} from '../ai/types'
import { loadTurnstile, turnstileSiteKey } from '../ai/turnstile'

interface AiPanelProps {
  open: boolean
  onClose: () => void
  onNotice: AiNotice
}

const errorKeys: Record<AiErrorCode, TranslationKey> = {
  invalid_request: 'ai.error.invalidRequest',
  invalid_plan: 'ai.error.invalidPlan',
  not_configured: 'ai.error.notConfigured',
  rate_limited: 'ai.error.rateLimited',
  turnstile: 'ai.error.turnstile',
  forbidden: 'ai.error.forbidden',
  payload_too_large: 'ai.error.tooLarge',
  provider_error: 'ai.error.provider',
  service_unavailable: 'ai.error.unavailable',
  timeout: 'ai.error.timeout',
  unknown: 'ai.error.unknown',
}

const planErrorKeys: Record<AgentPlanErrorCode, TranslationKey> = {
  missing_clip: 'ai.planError.missingClip',
  missing_track: 'ai.planError.missingTrack',
  locked_track: 'ai.planError.lockedTrack',
  no_text_track: 'ai.planError.noTextTrack',
  invalid_text_clip: 'ai.planError.invalidTextClip',
  invalid_trim: 'ai.planError.invalidTrim',
  invalid_split: 'ai.planError.invalidSplit',
  missing_style: 'ai.planError.missingStyle',
  missing_previous_clip: 'ai.planError.missingPreviousClip',
  no_changes: 'ai.planError.noChanges',
  unsupported: 'ai.planError.unsupported',
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `entry-${Date.now()}-${Math.random().toString(16).slice(2)}`

const isErrorCode = (value: unknown): value is AiErrorCode =>
  typeof value === 'string' && value in errorKeys

export const AiPanel = ({ open, onClose, onNotice }: AiPanelProps): ReactNode => {
  const t = useT()
  const tRef = useRef(t)
  const project = useEditorStore((state) => state.project)
  const selectedClipId = useEditorStore((state) => state.selectedClipId)
  const projectUpdatedAt = project.updatedAt
  const [entries, setEntries] = useState<AiChatEntry[]>([])
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<AiMode>('confirm')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidget = useRef<string | null>(null)
  const requestRef = useRef<AbortController | null>(null)
  const siteKey = turnstileSiteKey()
  const selectedClip = project.clips.find((item) => item.id === selectedClipId)

  useEffect(() => {
    tRef.current = t
  }, [t])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [entries, busy])

  useEffect(() => {
    if (!open || !siteKey || !turnstileRef.current) return
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled || !turnstileRef.current) return
        turnstileWidget.current = api.render(turnstileRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          appearance: 'interaction-only',
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        })
      })
      .catch(() => {
        if (!cancelled) setError(tRef.current('ai.error.turnstile'))
      })
    return () => {
      cancelled = true
      setTurnstileToken('')
      if (turnstileWidget.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidget.current)
        } catch {
          return
        }
        turnstileWidget.current = null
      }
    }
  }, [open, siteKey])

  useEffect(() => {
    return () => requestRef.current?.abort()
  }, [])

  const resetChallenge = useCallback(() => {
    setTurnstileToken('')
    if (turnstileWidget.current && window.turnstile) {
      try {
        window.turnstile.reset(turnstileWidget.current)
      } catch {
        return
      }
    }
  }, [])

  const chatHistory = useMemo<AiChatMessage[]>(
    () =>
      entries
        .filter((entry) => entry.content.trim())
        .slice(-10)
        .map<AiChatMessage>((entry) => ({ role: entry.role, content: entry.content.slice(0, 4000) })),
    [entries],
  )

  const suggestions = useMemo(() => {
    const items = [t('ai.suggestion.title'), t('ai.suggestion.plan')]
    items.push(
      selectedClip
        ? t('ai.suggestion.style', { name: selectedClip.name })
        : t('ai.suggestion.styleGeneric'),
    )
    return items
  }, [t, selectedClip])

  const send = useCallback(async (): Promise<void> => {
    const text = draft.trim()
    if (!text || busy) return
    if (siteKey && !turnstileToken) {
      setError(t('ai.error.turnstileWaiting'))
      return
    }

    const editor = useEditorStore.getState()
    const snapshot = createProjectSnapshot(editor.project, editor.selectedClipId, editor.playhead)
    const userEntry: AiChatEntry = { id: newId(), role: 'user', content: text }
    const nextEntries = [...entries, userEntry]
    const userMessage: AiChatMessage = { role: 'user', content: text.slice(0, 4000) }
    const messages: AiChatMessage[] = [...chatHistory, userMessage].slice(-12)

    setEntries(nextEntries)
    setDraft('')
    setError('')
    setBusy(true)

    const controller = new AbortController()
    let timedOut = false
    requestRef.current = controller
    const timer = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, 65_000)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          messages,
          snapshot,
          turnstileToken: turnstileToken || undefined,
        }),
        signal: controller.signal,
      })
      const payload = (await response.json().catch(() => ({}))) as Partial<
        AiChatResponse & AiErrorResponse
      >
      if (!response.ok) {
        const code = isErrorCode(payload.code) ? payload.code : 'unknown'
        setError(t(errorKeys[code]))
        return
      }

      let plan: AgentPlan | undefined
      if (mode === 'confirm' && payload.plan) {
        const parsed = agentPlanSchema.safeParse(payload.plan)
        if (!parsed.success) {
          setError(t('ai.error.invalidPlan'))
          return
        }
        plan = parsed.data
      }

      const assistant: AiChatEntry = {
        id: newId(),
        role: 'assistant',
        content:
          typeof payload.message === 'string' && payload.message.trim()
            ? payload.message.trim()
            : plan?.summary || t('ai.planReady'),
        plan,
        planStatus: plan ? 'ready' : undefined,
        baseUpdatedAt: plan ? snapshot.project.updatedAt : undefined,
      }
      setEntries((current) => [...current, assistant])
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') {
        setError(timedOut ? t('ai.error.timeout') : t('ai.error.network'))
      } else {
        setError(t('ai.error.network'))
      }
    } finally {
      window.clearTimeout(timer)
      requestRef.current = null
      setBusy(false)
      if (siteKey) resetChallenge()
    }
  }, [busy, chatHistory, draft, entries, mode, resetChallenge, siteKey, t, turnstileToken])

  const updateEntry = useCallback((id: string, patch: Partial<AiChatEntry>): void => {
    setEntries((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }, [])

  const applyPlan = useCallback(
    (id: string): void => {
      const entry = entries.find((item) => item.id === id)
      if (!entry?.plan) return
      const editor = useEditorStore.getState()
      if (editor.project.updatedAt !== entry.baseUpdatedAt) {
        updateEntry(id, { planStatus: 'stale' })
        setError(t('ai.stale'))
        return
      }
      try {
        const result = editor.applyAgentPlan(entry.plan)
        updateEntry(id, {
          planStatus: 'applied',
          appliedUpdatedAt: result.project.updatedAt,
          planError: undefined,
        })
        setError('')
        onNotice(t('ai.applied', { count: result.applied }))
      } catch (reason) {
        const message =
          reason instanceof AgentPlanError
            ? t(planErrorKeys[reason.code])
            : t('ai.error.invalidPlan')
        updateEntry(id, { planStatus: 'failed', planError: message })
      }
    },
    [entries, onNotice, t, updateEntry],
  )

  const cancelPlan = useCallback(
    (id: string): void => {
      updateEntry(id, { planStatus: 'cancelled' })
    },
    [updateEntry],
  )

  const undoPlan = useCallback(
    (id: string): void => {
      const entry = entries.find((item) => item.id === id)
      if (!entry) return
      const editor = useEditorStore.getState()
      if (entry.appliedUpdatedAt !== editor.project.updatedAt) {
        setError(t('ai.undoUnavailable'))
        return
      }
      editor.undo()
      updateEntry(id, { planStatus: 'undone' })
      setError('')
      onNotice(t('ai.undone'))
    },
    [entries, onNotice, t, updateEntry],
  )

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  if (!open) return null

  return (
    <aside className="ai-panel" role="dialog" aria-label={t('ai.title')}>
      <header className="ai-head">
        <div className="ai-head-title">
          <span className="ai-mark">
            <Icon name="sparkle" size={16} />
          </span>
          <div>
            <strong>{t('ai.title')}</strong>
            <span>{t('ai.subtitle')}</span>
          </div>
        </div>
        <button type="button" className="icon-btn" aria-label={t('common.close')} onClick={onClose}>
          <Icon name="close" size={16} />
        </button>
      </header>

      <div className="ai-mode" role="group" aria-label={t('ai.mode.label')}>
        <button
          type="button"
          className={clsx(mode === 'confirm' && 'is-active')}
          aria-pressed={mode === 'confirm'}
          onClick={() => setMode('confirm')}
        >
          {t('ai.mode.confirm')}
        </button>
        <button
          type="button"
          className={clsx(mode === 'plan' && 'is-active')}
          aria-pressed={mode === 'plan'}
          onClick={() => setMode('plan')}
        >
          {t('ai.mode.plan')}
        </button>
        <span>{mode === 'confirm' ? t('ai.mode.confirmHint') : t('ai.mode.planHint')}</span>
      </div>

      <div className="ai-messages" ref={listRef} aria-live="polite">
        {entries.length === 0 ? (
          <div className="ai-empty">
            <span className="ai-empty-mark">
              <Icon name="sparkle" size={22} />
            </span>
            <h3>{t('ai.emptyTitle')}</h3>
            <p>{t('ai.emptyBody')}</p>
            <div className="ai-suggestions">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setDraft(suggestion)
                    inputRef.current?.focus()
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {entries.map((entry) => (
          <article
            key={entry.id}
            className={clsx('ai-message', `is-${entry.role}`, entry.plan && 'has-plan')}
          >
            <div className="ai-bubble">
              <p>{entry.content}</p>
              {entry.plan ? (
                <AiPlanCard
                  entry={entry}
                  project={project}
                  projectUpdatedAt={projectUpdatedAt}
                  t={t}
                  onApply={applyPlan}
                  onCancel={cancelPlan}
                  onUndo={undoPlan}
                />
              ) : null}
            </div>
          </article>
        ))}

        {busy ? (
          <div className="ai-thinking" role="status">
            <span />
            <span />
            <span />
            {t('ai.thinking')}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="ai-error" role="alert">
          <Icon name="alert" size={14} />
          <span>{error}</span>
          <button type="button" aria-label={t('common.close')} onClick={() => setError('')}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : null}

      <div className="ai-composer">
        {siteKey ? <div ref={turnstileRef} className="ai-turnstile" /> : null}
        <div className="ai-input-row">
          <textarea
            ref={inputRef}
            value={draft}
            rows={2}
            placeholder={mode === 'confirm' ? t('ai.placeholder') : t('ai.planPlaceholder')}
            aria-label={t('ai.placeholder')}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            className="ai-send"
            disabled={busy || !draft.trim()}
            aria-label={t('ai.send')}
            onClick={() => void send()}
          >
            <Icon name={busy ? 'sparkle' : 'forward'} size={17} />
          </button>
        </div>
        <div className="ai-composer-foot">
          <span>{t('ai.privacy')}</span>
          <span>{t('ai.hint')}</span>
        </div>
      </div>
    </aside>
  )
}
