import { Fragment } from "react"
import { cn } from "../lib/utils"
import {
  getVocabularyWordForms,
  normalizeVocabularyWordToken,
} from "../lib/vocabulary-word-forms"

const englishWordPattern = /^[A-Za-z][A-Za-z'-]*$/u

export function VocabularyTermHighlight({
  text,
  word,
  inflections = [],
  highlightPhrase = false,
  className,
}: {
  text: string
  word: string
  inflections?: readonly string[]
  highlightPhrase?: boolean
  className?: string
}) {
  if (!text) {
    return null
  }
  if (highlightPhrase) {
    return <Highlight className={className}>{text}</Highlight>
  }

  const wordForms = getVocabularyWordForms(word, inflections)
  const parts = text.split(/([A-Za-z][A-Za-z'-]*)/gu)
  let offset = 0

  return parts.map((part) => {
    const key = `${offset}-${part}`
    offset += part.length
    if (
      !englishWordPattern.test(part) ||
      !wordForms.has(normalizeVocabularyWordToken(part))
    ) {
      return <Fragment key={key}>{part}</Fragment>
    }
    return (
      <Highlight key={key} className={className}>
        {part}
      </Highlight>
    )
  })
}

function Highlight({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <mark
      className={cn(
        "bg-transparent font-semibold text-warning-foreground underline decoration-warning decoration-2 decoration-dotted underline-offset-4",
        className,
      )}
    >
      {children}
    </mark>
  )
}
