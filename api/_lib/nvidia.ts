import { agentPlanSchema, agentPlanToolSchema } from '../../src/ai/schema.js'
import type { AgentPlan, AiChatMessage, AiMode, ProjectSnapshot } from '../../src/ai/schema.js'
import { AI_TOOL_NAME, buildProviderMessages } from '../../src/ai/prompt.js'
import { ApiError } from './errors.js'

interface NvidiaToolCall {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

interface NvidiaMessage {
  content?: string | null
  reasoning_content?: string | null
  tool_calls?: NvidiaToolCall[]
}

interface NvidiaResponse {
  choices?: {
    message?: NvidiaMessage
    finish_reason?: string
  }[]
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  error?: {
    message?: string
  }
}

export interface ProviderResult {
  message: string
  plan?: AgentPlan
  usage: {
    inputTokens?: number
    outputTokens?: number
  }
}

const providerUrl = (): string => {
  const base = (process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '')
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
}

const maxOutputTokens = (): number => {
  const parsed = Number(process.env.AI_MAX_OUTPUT_TOKENS)
  if (!Number.isFinite(parsed)) return 4096
  return Math.max(512, Math.min(8192, Math.round(parsed)))
}

const parseArguments = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    throw new ApiError(502, 'invalid_plan', 'The AI returned malformed plan data.')
  }
}

export const requestAgent = async (
  mode: AiMode,
  messages: AiChatMessage[],
  snapshot: ProjectSnapshot,
): Promise<ProviderResult> => {
  const apiKey = process.env.NVIDIA_API_KEY?.trim()
  if (!apiKey) {
    throw new ApiError(503, 'not_configured', 'The AI provider is not configured.')
  }

  const model = process.env.AI_MODEL?.trim() || 'nvidia/nemotron-3.5-lightning-30b-a3b'
  const fallbackModel = process.env.AI_FALLBACK_MODEL?.trim() ?? ''
  const models = [...new Set([model, fallbackModel].filter(Boolean))]
  const reasoningEffort = process.env.AI_REASONING_EFFORT?.trim() ?? 'none'
  const body: Record<string, unknown> = {
    messages: buildProviderMessages(mode, messages, snapshot),
    temperature: 0.3,
    top_p: 0.95,
    max_tokens: maxOutputTokens(),
  }

  if (reasoningEffort && reasoningEffort !== 'off') {
    body.reasoning_effort = reasoningEffort
  }

  if (mode === 'confirm') {
    body.tools = [
      {
        type: 'function',
        function: {
          name: AI_TOOL_NAME,
          description:
            'Propose an ordered set of timeline edits for the user to review. Never apply edits directly.',
          parameters: agentPlanToolSchema,
        },
      },
    ]
    body.tool_choice = 'auto'
  }

  let response: Response | undefined
  for (const [index, candidate] of models.entries()) {
    try {
      const attempt = await fetch(providerUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ ...body, model: candidate }),
        signal: AbortSignal.timeout(55_000),
      })
      if (attempt.ok) {
        response = attempt
        break
      }
      const detail = (await attempt.text().catch(() => '')).slice(0, 300)
      const canFallback = (attempt.status === 404 || attempt.status === 410) && index < models.length - 1
      console.error('NVIDIA request failed', candidate, attempt.status, detail)
      if (!canFallback) {
        throw new ApiError(
          502,
          'provider_error',
          `The AI provider returned status ${attempt.status}.`,
        )
      }
    } catch (reason) {
      if (reason instanceof ApiError) throw reason
      if (reason instanceof Error && (reason.name === 'TimeoutError' || reason.name === 'AbortError')) {
        throw new ApiError(504, 'timeout', 'The AI provider took too long to respond.')
      }
      throw new ApiError(502, 'provider_error', 'The AI provider could not be reached.')
    }
  }

  if (!response) {
    throw new ApiError(502, 'provider_error', 'The AI provider returned no response.')
  }

  let data: NvidiaResponse
  try {
    data = (await response.json()) as NvidiaResponse
  } catch {
    throw new ApiError(502, 'provider_error', 'The AI provider returned invalid JSON.')
  }

  const choice = data.choices?.[0]
  const message = choice?.message
  if (!message) {
    throw new ApiError(502, 'provider_error', 'The AI provider returned an empty response.')
  }

  const text = typeof message.content === 'string' ? message.content.trim() : ''
  const usage = {
    inputTokens: data.usage?.prompt_tokens,
    outputTokens: data.usage?.completion_tokens,
  }

  if (mode === 'plan') {
    if (!text) {
      throw new ApiError(502, 'provider_error', 'The AI provider returned an empty response.')
    }
    return { message: text, usage }
  }

  const toolCall = message.tool_calls?.find((item) => item.function?.name === AI_TOOL_NAME)
  if (!toolCall) {
    if (!text) {
      throw new ApiError(502, 'provider_error', 'The AI provider returned an empty response.')
    }
    return { message: text, usage }
  }

  const parsed = agentPlanSchema.safeParse(parseArguments(toolCall.function?.arguments))
  if (!parsed.success) {
    console.error('Invalid AI plan', parsed.error.issues.slice(0, 5))
    throw new ApiError(502, 'invalid_plan', 'The AI returned a plan that failed validation.')
  }

  return {
    message: text || parsed.data.summary,
    plan: parsed.data,
    usage,
  }
}
