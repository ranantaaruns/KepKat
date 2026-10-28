import { useCallback, useSyncExternalStore } from 'react'
import { en, type TranslationKey } from './locales/en'
import { id } from './locales/id'

export type Language = 'id' | 'en'
export type TranslationValues = Record<string, string | number>
export type Translate = (key: TranslationKey, values?: TranslationValues) => string
export type { TranslationKey }

const dictionaries: Record<Language, Record<TranslationKey, string>> = { en, id }
const STORAGE_KEY = 'kepkat.language'
const listeners = new Set<() => void>()

const readLanguage = (): Language => {
  if (typeof window === 'undefined') return 'en'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'id' ? 'id' : 'en'
  } catch {
    return 'en'
  }
}

let language = readLanguage()

const applyDocumentLanguage = (): void => {
  if (typeof document === 'undefined') return
  document.documentElement.lang = language
  document.title = dictionaries[language]['meta.title']
  const description = document.querySelector('meta[name="description"]')
  if (description) description.setAttribute('content', dictionaries[language]['meta.description'])
}

export const getLanguage = (): Language => language

const persistLanguage = (next: Language): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    return
  }
}

export const setLanguage = (next: Language): void => {
  if (next === language) return
  language = next
  persistLanguage(next)
  applyDocumentLanguage()
  for (const listener of listeners) listener()
}

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const translate = (
  target: Language,
  key: TranslationKey,
  values?: TranslationValues,
): string => {
  const template = dictionaries[target][key] ?? en[key]
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    values[name] === undefined ? match : String(values[name]),
  )
}

export const t: Translate = (key, values) => translate(language, key, values)

export const useLanguage = (): Language =>
  useSyncExternalStore(subscribe, getLanguage, getLanguage)

export const useT = (): Translate => {
  const current = useLanguage()
  return useCallback((key, values) => translate(current, key, values), [current])
}

applyDocumentLanguage()
