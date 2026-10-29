import type { ReactNode } from 'react'
import { Icon } from './Icon'
import type { Project } from '../editor/types'
import type { Translate } from '../i18n'
import { actionLabel, describeAction } from '../ai/describe'
import type { AiChatEntry } from '../ai/types'

interface AiPlanCardProps {
  entry: AiChatEntry
  project: Project
  projectUpdatedAt: number
  t: Translate
  onApply: (id: string) => void
  onCancel: (id: string) => void
  onUndo: (id: string) => void
}

export const AiPlanCard = ({
  entry,
  project,
  projectUpdatedAt,
  t,
  onApply,
  onCancel,
  onUndo,
}: AiPlanCardProps): ReactNode => {
  const plan = entry.plan
  if (!plan) return null
  const stale = entry.planStatus === 'ready' && entry.baseUpdatedAt !== projectUpdatedAt
  const canUndo =
    entry.planStatus === 'applied' && entry.appliedUpdatedAt === projectUpdatedAt
  const hasResult =
    entry.planStatus === 'applied' ||
    entry.planStatus === 'undone' ||
    entry.planStatus === 'cancelled' ||
    entry.planStatus === 'failed'

  return (
    <section className="ai-plan" aria-label={plan.title}>
      <div className="ai-plan-head">
        <span className="ai-plan-icon">
          <Icon name="sparkle" size={14} />
        </span>
        <div>
          <strong>{plan.title}</strong>
          <p>{plan.summary}</p>
        </div>
      </div>

      <ol className="ai-plan-actions">
        {plan.actions.map((action, index) => (
          <li key={`${entry.id}-${index}-${action.type}`}>
            <span className="ai-plan-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="ai-plan-copy">
              <strong>{actionLabel(action, t)}</strong>
              <em>{describeAction(action, project, t)}</em>
            </span>
          </li>
        ))}
      </ol>

      {stale ? (
        <p className="ai-plan-note is-warning">
          <Icon name="alert" size={13} />
          {t('ai.stale')}
        </p>
      ) : null}

      {entry.planStatus === 'failed' && entry.planError ? (
        <p className="ai-plan-note is-error">
          <Icon name="alert" size={13} />
          {entry.planError}
        </p>
      ) : null}

      {entry.planStatus === 'applied' ? (
        <p className="ai-plan-note is-success">
          <Icon name="check" size={13} />
          {t('ai.planApplied')}
        </p>
      ) : null}

      {entry.planStatus === 'undone' ? (
        <p className="ai-plan-note">{t('ai.planUndone')}</p>
      ) : null}

      {entry.planStatus === 'cancelled' ? (
        <p className="ai-plan-note">{t('ai.planCancelled')}</p>
      ) : null}

      <div className="ai-plan-footer">
        <span className="ai-plan-count">
          {t('ai.actionCount', { count: plan.actions.length })}
        </span>
        {!hasResult ? (
          <div className="ai-plan-buttons">
            <button type="button" className="button compact" onClick={() => onCancel(entry.id)}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="button compact primary"
              disabled={stale}
              onClick={() => onApply(entry.id)}
            >
              {t('ai.apply')}
            </button>
          </div>
        ) : null}
        {canUndo ? (
          <button type="button" className="button compact" onClick={() => onUndo(entry.id)}>
            <Icon name="undo" size={13} />
            {t('ai.undoPlan')}
          </button>
        ) : null}
      </div>

      <details className="ai-plan-details">
        <summary>{t('ai.details')}</summary>
        <pre>{JSON.stringify(plan.actions, null, 2)}</pre>
      </details>
    </section>
  )
}
