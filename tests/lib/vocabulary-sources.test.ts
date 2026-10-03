import { describe, expect, it } from "vitest"
import { getVocabularySourceValues } from "@/lib/vocabulary-sources"

describe("vocabulary sources", () => {
  it("keeps regular vocabulary sources separate from tags", () => {
    expect(
      getVocabularySourceValues({
        sourceTitle: "English Podcast",
        tags: [{ name: "重点" }],
      }),
    ).toEqual(["English Podcast"])
  })

  it("exposes historical custom import tags as built-in source aliases", () => {
    expect(
      getVocabularySourceValues({
        sourceTitle: "内置词库 · B1",
        tags: [{ name: "B1" }, { name: "大学英语" }],
      }),
    ).toEqual(["B1", "大学英语"])
  })

  it("does not duplicate the built-in pack label as a source alias", () => {
    expect(
      getVocabularySourceValues({
        sourceTitle: "内置词库 · 常用词组",
        tags: [{ name: "常用词组" }],
      }),
    ).toEqual(["常用词组"])
  })
})
