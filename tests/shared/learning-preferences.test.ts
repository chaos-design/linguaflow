import { describe, expect, it } from "vitest"
import {
  defaultLearningPreferences,
  normalizeLearningPreferences,
} from "@/shared/learning-preferences"

describe("normalizeLearningPreferences", () => {
  it("provides an empty default video tag list", () => {
    expect(normalizeLearningPreferences(null)).toEqual(defaultLearningPreferences)
    expect(defaultLearningPreferences.defaultVideoTags).toEqual([])
  })

  it("normalizes, deduplicates, and limits default video tags", () => {
    const tags = [
      " 英语 ",
      "英语",
      "",
      42,
      ...Array.from({ length: 20 }, (_, index) => `标签 ${index}`),
    ]

    const preferences = normalizeLearningPreferences({
      defaultVideoTags: tags,
    })

    expect(preferences.defaultVideoTags).toHaveLength(12)
    expect(preferences.defaultVideoTags[0]).toBe("英语")
    expect(new Set(preferences.defaultVideoTags).size).toBe(12)
  })

  it("normalizes the subtitle translation language", () => {
    expect(defaultLearningPreferences.subtitleTranslationLanguage).toBe("none")
    expect(
      normalizeLearningPreferences({
        subtitleTranslationLanguage: "ja",
      }).subtitleTranslationLanguage,
    ).toBe("ja")
    expect(
      normalizeLearningPreferences({
        subtitleTranslationLanguage: "unsupported",
      }).subtitleTranslationLanguage,
    ).toBe("none")
  })

  it("normalizes the learning calendar color", () => {
    expect(defaultLearningPreferences.calendarColor).toBe("#22c55e")
    expect(
      normalizeLearningPreferences({
        calendarColor: "#3B82F6",
      }).calendarColor,
    ).toBe("#3b82f6")
    expect(
      normalizeLearningPreferences({
        calendarColor: "green",
      }).calendarColor,
    ).toBe("#22c55e")
  })

  it("keeps high daily new word scheduling values", () => {
    expect(
      normalizeLearningPreferences({
        dailyNewLimit: 500,
      }).dailyNewLimit,
    ).toBe(500)
  })

  it("drops model configuration and every unknown database preference field", () => {
    const preferences = normalizeLearningPreferences({
      ...defaultLearningPreferences,
      aiModelConfig: {
        provider: "openai",
        model: "private-model",
        apiKey: "private-key",
      },
      model: "private-model",
      apiKey: "private-key",
      unknownSetting: true,
    })

    expect(preferences).toEqual(defaultLearningPreferences)
    expect(preferences).not.toHaveProperty("aiModelConfig")
    expect(preferences).not.toHaveProperty("model")
    expect(preferences).not.toHaveProperty("apiKey")
    expect(preferences).not.toHaveProperty("unknownSetting")
  })
})
