import type { JSX } from 'react'
import { useI18n } from '../i18n'

export function TermsClauses(): JSX.Element {
  const { t } = useI18n()
  const clauses = [
    t('terms.clause1'),
    t('terms.clause2'),
    t('terms.clause3'),
    t('terms.clause4'),
    t('terms.clause5'),
    t('terms.clause6')
  ]
  return (
    <ol className="terms-clauses">
      {clauses.map((clause) => (
        <li key={clause}>{clause}</li>
      ))}
    </ol>
  )
}
