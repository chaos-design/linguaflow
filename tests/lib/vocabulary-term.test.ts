import { describe, expect, it } from "vitest"
import { isValidVocabularyTerm, normalizeVocabularyTerm } from "@/lib/vocabulary-term"

describe("vocabulary term", () => {
  it("normalizes words and short phrases", () => {
    expect(normalizeVocabularyTerm("  Look   Forward To ")).toBe("look forward to")
  })

  it("accepts words, hyphenated terms, and phrases up to six words", () => {
    expect(isValidVocabularyTerm("can't")).toBe(true)
    expect(isValidVocabularyTerm("self-improving")).toBe(true)
    expect(isValidVocabularyTerm("as a matter of fact")).toBe(true)
  })

  it("rejects sentences, punctuation, and non-English terms", () => {
    expect(isValidVocabularyTerm("one two three four five six seven")).toBe(false)
    expect(isValidVocabularyTerm("look forward to.")).toBe(false)
    expect(isValidVocabularyTerm("学习英语")).toBe(false)
  })
})
