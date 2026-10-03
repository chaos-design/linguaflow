import { describe, expect, it } from "vitest"
import {
  maximumLearningTagCount,
  maximumLearningTagNameLength,
  normalizeLearningTagNames,
} from "@/lib/learning-tags"

describe("learning tags", () => {
  it("normalizes comma-separated names and removes case-insensitive duplicates", () => {
    expect(
      normalizeLearningTagNames([" 商务英语， 写作 ", "business", "BUSINESS"]),
    ).toEqual(["商务英语", "写作", "business"])
  })

  it("limits the number and length of tags", () => {
    const tags = Array.from(
      { length: maximumLearningTagCount + 2 },
      (_, index) => `${index}-${"x".repeat(maximumLearningTagNameLength + 5)}`,
    )
    const result = normalizeLearningTagNames(tags)

    expect(result).toHaveLength(maximumLearningTagCount)
    expect(result.every((tag) => tag.length <= maximumLearningTagNameLength)).toBe(true)
  })

  it("ignores unsupported values and empty names", () => {
    expect(normalizeLearningTagNames([null, " , ， ", 42, "听力"])).toEqual(["听力"])
  })
})
