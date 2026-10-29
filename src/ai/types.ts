import type { AgentPlan } from './schema'

export type AgentPlanErrorCode =
  | 'missing_clip'
  | 'missing_track'
  | 'locked_track'
  | 'no_text_track'
  | 'invalid_text_clip'
  | 'invalid_trim'
  | 'invalid_split'
  | 'missing_style'
  | 'missing_previous_clip'
  | 'no_changes'
  | 'unsupported'

export class AgentPlanError extends Error {
  code: AgentPlanErrorCode

  constructor(code: AgentPlanErrorCode, message: string) {
    super(message)
    this.name = 'AgentPlanError'
    this.code = code
  }
}

export type AiErrorCode =
  | 'invalid_request'
  | 'invalid_plan'
  | 'not_configured'
  | 'rate_limited'
  | 'turnstile'
  | 'forbidden'
  | 'payload_too_large'
  | 'provider_error'
  | 'service_unavailable'
  | 'timeout'
  | 'unknown'

export interface AiChatResponse {
  message: string
  plan?: AgentPlan
  usage?: {
    inputTokens?: number
    outputTokens?: number
  }
}

export interface AiErrorResponse {
  error: string
  code: AiErrorCode
}

export type PlanStatus = 'ready' | 'applied' | 'undone' | 'stale' | 'cancelled' | 'failed'

export interface AiChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  plan?: AgentPlan
  planStatus?: PlanStatus
  baseUpdatedAt?: number
  appliedUpdatedAt?: number
  planError?: string
}

export type AiNoticeTone = 'normal' | 'error'
export type AiNotice = (message: string, tone?: AiNoticeTone) => void
