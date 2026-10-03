import { describe, expect, it } from "vitest"
import {
  createVocabularyImportTemplate,
  parseVocabularyImportText,
  serializeVocabularyImportItems,
} from "@/lib/vocabulary-import"

describe("vocabulary import parser", () => {
  it("parses quoted CSV rows with a header", () => {
    const result = parseVocabularyImportText(
      [
        "word,definition,translation,example,example_translation",
        'dejected,"sad, disappointed",沮丧的,"He looked dejected.",他看起来很沮丧。',
      ].join("\n"),
    )

    expect(result.errors).toEqual([])
    expect(result.items).toEqual([
      {
        word: "dejected",
        partOfSpeech: "",
        definition: "sad, disappointed",
        definitionTranslation: "沮丧的",
        example: "He looked dejected.",
        exampleTranslation: "他看起来很沮丧。",
      },
    ])
  })

  it("keeps Chinese commas inside structured CSV fields", () => {
    const result = parseVocabularyImportText(
      "word,translation\ndejected,沮丧的，灰心的",
    )

    expect(result.errors).toEqual([])
    expect(result.items[0]).toMatchObject({
      word: "dejected",
      definitionTranslation: "沮丧的，灰心的",
    })
  })

  it("accepts one word per line, skips the header, and removes duplicates", () => {
    const result = parseVocabularyImportText("word\nFrontier\nfrontier\ncontinue")

    expect(result.errors).toEqual([])
    expect(result.items.map((item) => item.word)).toEqual(["frontier", "continue"])
    expect(result.duplicateCount).toBe(1)
    expect(result.rowCount).toBe(3)
  })

  it("accepts phrases, normalizes spacing, and removes phrase duplicates", () => {
    const result = parseVocabularyImportText(
      "term\nTake Part In\nlook   forward to\ntake part in",
    )

    expect(result.errors).toEqual([])
    expect(result.items.map((item) => item.word)).toEqual([
      "take part in",
      "look forward to",
    ])
    expect(result.duplicateCount).toBe(1)
    expect(result.rowCount).toBe(3)
  })

  it("splits a plain word list with English and Chinese commas", () => {
    const result = parseVocabularyImportText(
      "Consider, continue，Frontier,\ndejected，consider",
    )

    expect(result.errors).toEqual([])
    expect(result.items.map((item) => item.word)).toEqual([
      "consider",
      "continue",
      "frontier",
      "dejected",
    ])
    expect(result.duplicateCount).toBe(1)
    expect(result.rowCount).toBe(5)
  })

  it("does not interpret comma-separated words as positional columns", () => {
    const result = parseVocabularyImportText("apple, banana, orange")

    expect(result.errors).toEqual([])
    expect(result.items).toEqual([
      {
        word: "apple",
        partOfSpeech: "",
        definition: "",
        definitionTranslation: "",
        example: "",
        exampleTranslation: "",
      },
      {
        word: "banana",
        partOfSpeech: "",
        definition: "",
        definitionTranslation: "",
        example: "",
        exampleTranslation: "",
      },
      {
        word: "orange",
        partOfSpeech: "",
        definition: "",
        definitionTranslation: "",
        example: "",
        exampleTranslation: "",
      },
    ])
  })

  it("treats a single word header followed by commas as a word list", () => {
    const result = parseVocabularyImportText("word\napple,banana，orange")

    expect(result.errors).toEqual([])
    expect(result.items.map((item) => item.word)).toEqual(["apple", "banana", "orange"])
  })

  it("reports invalid rows without dropping valid rows", () => {
    const result = parseVocabularyImportText("valid\nnot a word!\n")

    expect(result.items.map((item) => item.word)).toEqual(["valid"])
    expect(result.errors[0]).toContain("not a word!")
  })

  it("provides a parseable CSV template", () => {
    const result = parseVocabularyImportText(createVocabularyImportTemplate())

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.exampleTranslation).toBe("他看起来很沮丧。")
  })

  it("serializes imported items without losing commas or line breaks", () => {
    const source = serializeVocabularyImportItems([
      {
        word: "consider",
        partOfSpeech: "verb",
        definition: "think about, carefully",
        definitionTranslation: "考虑",
        example: "Consider this:\nit may work.",
        exampleTranslation: "考虑一下：这可能可行。",
      },
    ])
    const result = parseVocabularyImportText(source)

    expect(result.errors).toEqual([])
    expect(result.items[0]).toMatchObject({
      word: "consider",
      definition: "think about, carefully",
      example: "Consider this:\nit may work.",
    })
  })

  it("reports unquoted columns instead of silently shifting values", () => {
    const result = parseVocabularyImportText(
      [
        "word,definition,translation,example,example_translation",
        "consider,think about, carefully,考虑,Consider it.,考虑一下。",
      ].join("\n"),
    )

    expect(result.items).toEqual([])
    expect(result.errors[0]).toContain("列数过多")
  })

  it("reports an unclosed CSV quote", () => {
    const result = parseVocabularyImportText(
      'word,definition\nconsider,"think carefully',
    )

    expect(result.errors).toContain("CSV 中存在未闭合的双引号。")
  })

  it("merges an unquoted wrapped final CSV field into the preceding row", () => {
    const result = parseVocabularyImportText(
      [
        "word,part_of_speech,definition,translation,example,example_translation",
        "dejected,adjective,sad and dispirited,沮丧的,He looked dejected.,他看起来很",
        "沮丧。",
      ].join("\n"),
    )

    expect(result.errors).toEqual([])
    expect(result.items).toEqual([
      {
        word: "dejected",
        partOfSpeech: "adjective",
        definition: "sad and dispirited",
        definitionTranslation: "沮丧的",
        example: "He looked dejected.",
        exampleTranslation: "他看起来很沮丧。",
      },
    ])
  })

  it("parses pasted CSV with a wrapped header and final field", () => {
    const result = parseVocabularyImportText(
      [
        "word,",
        "part_of_speech,definition,translation,example,example_translation",
        "dejected,adjective,sad and dispirited,沮丧的,He looked dejected.,他看起来很",
        "沮丧。",
      ].join("\n"),
    )

    expect(result.errors).toEqual([])
    expect(result.items).toEqual([
      {
        word: "dejected",
        partOfSpeech: "adjective",
        definition: "sad and dispirited",
        definitionTranslation: "沮丧的",
        example: "He looked dejected.",
        exampleTranslation: "他看起来很沮丧。",
      },
    ])
  })

  it("keeps all unique words without a fixed item cap", () => {
    const words = Array.from({ length: 125 }, (_, index) => {
      return `word${String.fromCharCode(97 + Math.floor(index / 26))}${String.fromCharCode(
        97 + (index % 26),
      )}`
    })
    const result = parseVocabularyImportText(words.join("\n"))

    expect(result.items).toHaveLength(words.length)
    expect(result.errors).toEqual([])
  })
})
