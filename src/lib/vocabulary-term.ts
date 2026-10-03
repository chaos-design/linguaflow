export const maximumVocabularyTermLength = 120
export const maximumVocabularyTermWords = 6

const vocabularyTermPattern = new RegExp(
  `^[a-z][a-z'-]*(?: [a-z][a-z'-]*){0,${maximumVocabularyTermWords - 1}}$`,
  "iu",
)

export function normalizeVocabularyTerm(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en")
}

export function isValidVocabularyTerm(value: string): boolean {
  const normalizedTerm = normalizeVocabularyTerm(value)
  return (
    normalizedTerm.length > 0 &&
    normalizedTerm.length <= maximumVocabularyTermLength &&
    vocabularyTermPattern.test(normalizedTerm)
  )
}
