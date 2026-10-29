export interface TurnstileWidgetOptions {
  sitekey: string
  theme?: 'light' | 'dark' | 'auto'
  size?: 'normal' | 'compact' | 'flexible'
  appearance?: 'always' | 'execute' | 'interaction-only'
  callback?: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileWidgetOptions) => string
  reset: (widgetId?: string) => void
  remove: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export const turnstileSiteKey = (): string =>
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || ''

let loader: Promise<TurnstileApi> | undefined

export const loadTurnstile = (): Promise<TurnstileApi> => {
  if (typeof window === 'undefined') return Promise.reject(new Error('Turnstile is browser-only.'))
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (loader) return loader

  loader = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-kepkat-turnstile]')
    const script = existing ?? document.createElement('script')
    const onLoad = (): void => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile did not load.'))
    }
    const onError = (): void => reject(new Error('Turnstile could not load.'))
    script.addEventListener('load', onLoad, { once: true })
    script.addEventListener('error', onError, { once: true })
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.dataset.kepkatTurnstile = 'true'
      document.head.appendChild(script)
    }
  })

  return loader
}
