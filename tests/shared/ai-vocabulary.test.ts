import { describe, expect, it } from "vitest"
import { parseAiVocabularyAnalysis } from "@/shared/ai-vocabulary"

describe("parseAiVocabularyAnalysis", () => {
  it("normalizes bilingual lists and etymology nodes", () => {
    const result = parseAiVocabularyAnalysis(
      {
        cefrLevel: "b2",
        model: "stored-model",
        examLabels: ["CET6", "IELTS"],
        meanings: [
          {
            term: "v.",
            en: "to form an idea; to become pregnant",
            zh: "构思，设想；怀孕",
          },
        ],
        inflections: [
          { term: "third-person singular", en: "conceives", zh: "第三人称单数" },
        ],
        explanation: { en: "A careful explanation.", zh: "清晰解释。" },
        partsOfSpeech: [{ term: "verb", en: "Used as an action.", zh: "用作动词。" }],
        tenses: [],
        etymology: { en: "From Latin.", zh: "源自拉丁语。" },
        etymologyTree: [
          {
            label: "Latin",
            en: "The earliest form.",
            zh: "最早形式。",
            children: [],
          },
        ],
        wordPartMemory: {
          en: "The parts combine into a clear mental picture.",
          zh: "各部分组合成清晰的字面图景。",
        },
        wordParts: [
          {
            term: "prefix: con-",
            en: "together",
            zh: "一起",
            source: "Latin con- / cum",
            phrase: "conceive an idea",
            phraseTranslation: "构思一个想法",
            example: "She conceived an idea for the lesson.",
            exampleTranslation: "她为这节课构思了一个想法。",
          },
        ],
        examples: [
          {
            term: "The example is clear.",
            translation: "这个例句很清楚。",
            en: "Uses clear as a predicative adjective.",
            zh: "clear 在这里作表语形容词。",
          },
        ],
        synonyms: [{ term: "clarify", en: "More precise.", zh: "更强调澄清。" }],
      },
      {
        generatedAt: "2026-08-19T12:00:00.000Z",
      },
    )

    expect(result).not.toHaveProperty("model")
    expect(result?.cefrLevel).toBe("B2")
    expect(result?.examLabels).toEqual(["CET6", "IELTS"])
    expect(result?.meanings[0]?.zh).toContain("怀孕")
    expect(result?.inflections[0]?.en).toBe("conceives")
    expect(result?.partsOfSpeech[0]?.term).toBe("verb")
    expect(result?.etymologyTree[0]?.children).toEqual([])
    expect(result?.wordPartMemory.zh).toBe("各部分组合成清晰的字面图景。")
    expect(result?.wordParts[0]?.source).toBe("Latin con- / cum")
    expect(result?.examples[0]?.translation).toBe("这个例句很清楚。")
    expect(result?.synonyms[0]?.zh).toBe("更强调澄清。")
    expect(result?.antonyms).toEqual([])
  })

  it("rejects empty or malformed payloads", () => {
    expect(parseAiVocabularyAnalysis(null)).toBeNull()
    expect(parseAiVocabularyAnalysis({ explanation: {} })).toBeNull()
    expect(parseAiVocabularyAnalysis({ synonyms: [{ term: 42 }] })).toBeNull()
  })

  it("keeps older stored analyses compatible when word-part memory is absent", () => {
    const result = parseAiVocabularyAnalysis({
      explanation: { en: "Existing analysis.", zh: "已有解析。" },
      examples: [{ term: "An old example.", en: "Usage.", zh: "用法。" }],
    })

    expect(result?.wordPartMemory).toEqual({ en: "", zh: "" })
    expect(result?.examples[0]?.translation).toBe("")
  })
})
