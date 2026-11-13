import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react'
import type { ErrorCode } from '@shared/errors'
import type { Language } from '@shared/types'
import zhTW, { type TranslationKey } from './zh-TW'
import en from './en'

const dictionaries: Record<Language, Record<TranslationKey, string>> = {
  'zh-TW': zhTW,
  en
}

export interface I18nValue {
  language: Language
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  te: (code: ErrorCode) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }): ReactElement {
  const value = useMemo<I18nValue>(() => {
    const dictionary = dictionaries[language]
    const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
      let text = dictionary[key] ?? key
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          text = text.replaceAll(`{${name}}`, String(replacement))
        }
      }
      return text
    }
    return {
      language,
      t,
      te: (code: ErrorCode) => dictionary[`error.${code}` as TranslationKey] ?? code
    }
  }, [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used inside I18nProvider')
  return value
}

export type { TranslationKey }
