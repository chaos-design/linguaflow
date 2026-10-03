import { afterEach, describe, expect, it, vi } from "vitest"
import { convertNarrowToBroadIpa, queryDictionary } from "@/server/learning/dictionary"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("queryDictionary", () => {
  it("returns an English definition with a Chinese translation", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )
      if (url.hostname === "freedictionaryapi.com") {
        expect(url.pathname).toBe("/api/v1/entries/en/flow")
        return Response.json({
          word: "flow",
          entries: [
            {
              partOfSpeech: "noun",
              pronunciations: [
                {
                  type: "ipa",
                  text: "/ˈfləʊ̯/",
                  tags: ["Received Pronunciation"],
                },
                {
                  type: "ipa",
                  text: "/ˈfloʊ̯/",
                  tags: ["General American"],
                },
              ],
              forms: [{ word: "flows", tags: ["plural"] }],
              senses: [
                {
                  definition: "A steady continuous movement.",
                  examples: ["The flow of a river."],
                  quotes: [],
                  synonyms: ["stream"],
                  antonyms: [],
                  subsenses: [],
                },
              ],
              synonyms: [],
              antonyms: [],
            },
            {
              partOfSpeech: "verb",
              pronunciations: [],
              forms: [
                {
                  word: "flows",
                  tags: ["present", "singular", "third-person"],
                },
                { word: "flowing", tags: ["participle", "present"] },
                { word: "flowed", tags: ["past"] },
                { word: "flowed", tags: ["participle", "past"] },
              ],
              senses: [
                {
                  definition: "To move continuously.",
                  examples: ["Water flows downhill."],
                  quotes: [],
                  synonyms: [],
                  antonyms: [],
                  subsenses: [],
                },
              ],
              synonyms: [],
              antonyms: [],
            },
          ],
          source: { url: "https://en.wiktionary.org/wiki/flow" },
        })
      }
      if (url.hostname === "api.datamuse.com") {
        const spelling = url.searchParams.get("sp")
        if (spelling === "flow *") {
          return Response.json([{ word: "flow rate" }])
        }
        if (spelling === "* flow") {
          return Response.json([{ word: "cash flow" }])
        }
        return Response.json([])
      }
      if (url.hostname === "api.mymemory.translated.net") {
        expect(url.searchParams.get("langpair")).toBe("en|zh-CN")
        const translatedText = url.searchParams.get("q")?.startsWith("To move")
          ? "持续流动。"
          : "稳定而连续的运动。"
        return Response.json({
          responseData: { translatedText },
          responseStatus: 200,
        })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(queryDictionary("flow")).resolves.toMatchObject({
      word: "flow",
      phoneticUk: "/ˈfləʊ̯/",
      phoneticUs: "/ˈfloʊ̯/",
      definition: "A steady continuous movement.",
      translation: "稳定而连续的运动。",
      inflections: [
        { label: "复数", value: "flows" },
        { label: "第三人称单数", value: "flows" },
        { label: "现在分词", value: "flowing" },
        { label: "过去式", value: "flowed" },
        { label: "过去分词", value: "flowed" },
      ],
      supplementalExamples: [
        { text: "The flow of a river." },
        { text: "Water flows downhill." },
      ],
      commonPhrases: [{ text: "flow rate" }, { text: "cash flow" }],
      wordAnalysis: { parts: [] },
    })
    await expect(queryDictionary("flow")).resolves.toMatchObject({
      meanings: [
        { definition: "A steady continuous movement." },
        { definition: "To move continuously." },
      ],
    })
  })

  it("keeps the dictionary result when translation is unavailable", async () => {
    const sourcePronunciations = [
      {
        type: "ipa",
        text: "[ˈlɜːn̪]",
        tags: ["Received Pronunciation"],
      },
      {
        type: "ipa",
        text: "[ˈlɝːn̚]",
        tags: ["General American"],
      },
    ]
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )
      if (url.hostname === "freedictionaryapi.com") {
        return Response.json({
          word: "learn",
          entries: [
            {
              partOfSpeech: "verb",
              pronunciations: sourcePronunciations,
              forms: [],
              senses: [
                {
                  definition: "To gain knowledge.",
                  examples: [],
                  quotes: [],
                  synonyms: [],
                  antonyms: [],
                  subsenses: [],
                },
              ],
              synonyms: [],
              antonyms: [],
            },
          ],
          source: { url: "https://en.wiktionary.org/wiki/learn" },
        })
      }
      return new Response(null, { status: 503 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await queryDictionary("learn")

    expect(result).toMatchObject({
      phonetic: "/ˈlɜːn/",
      phoneticUk: "/ˈlɜːn/",
      phoneticUs: "/ˈlɝːn/",
      definition: "To gain knowledge.",
      translation: "",
    })
    expect(sourcePronunciations.map(({ text }) => text)).toEqual(["[ˈlɜːn̪]", "[ˈlɝːn̚]"])
  })

  it("prioritizes modern meanings and excludes dictionary quotations", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )
      if (url.hostname === "freedictionaryapi.com") {
        return Response.json({
          word: "persist",
          entries: [
            {
              partOfSpeech: "verb",
              pronunciations: [],
              forms: [],
              senses: [
                {
                  definition: "(obsolete) To remain in one place.",
                  examples: [],
                  quotes: [{ text: "An old literary quotation." }],
                  synonyms: [],
                  antonyms: [],
                  subsenses: [],
                },
                {
                  definition: "(intransitive) To continue to exist.",
                  examples: ["The problem persisted for years."],
                  quotes: [],
                  synonyms: [],
                  antonyms: [],
                  subsenses: [],
                },
                {
                  definition: "(law) To postpone a proceeding.",
                  examples: [],
                  quotes: [],
                  synonyms: [],
                  antonyms: [],
                  subsenses: [],
                },
              ],
              synonyms: [],
              antonyms: [],
            },
          ],
        })
      }
      if (url.hostname === "api.datamuse.com") {
        return Response.json([])
      }
      if (url.hostname === "api.mymemory.translated.net") {
        return Response.json({
          responseData: { translatedText: "继续发生，不停止。" },
          responseStatus: 200,
        })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await queryDictionary("persist")

    expect(result).toMatchObject({
      definition: "To continue to exist.",
      partOfSpeech: "intransitive verb",
      supplementalExamples: [
        {
          text: "The problem persisted for years.",
        },
      ],
    })
    expect(result.supplementalExamples).not.toContainEqual({
      text: "An old literary quotation.",
      translation: expect.any(String),
    })
    expect(result.meanings.map((meaning) => meaning.definition)).toEqual([
      "To continue to exist.",
      "To postpone a proceeding.",
      "To remain in one place.",
    ])
  })

  it("uses the base word to supplement phrases and examples for a plural", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )
      if (url.hostname === "freedictionaryapi.com") {
        const queriedWord = url.pathname.split("/").at(-1)
        if (queriedWord === "reinforcements") {
          return Response.json({
            word: "reinforcements",
            entries: [
              {
                partOfSpeech: "noun",
                pronunciations: [],
                forms: [],
                senses: [
                  {
                    definition: "plural of reinforcement",
                    tags: ["form of", "plural"],
                    examples: [],
                    synonyms: [],
                    antonyms: [],
                    subsenses: [],
                  },
                ],
                synonyms: [],
                antonyms: [],
              },
            ],
          })
        }
        if (queriedWord === "reinforcement") {
          return Response.json({
            word: "reinforcement",
            entries: [
              {
                partOfSpeech: "noun",
                pronunciations: [],
                forms: [{ word: "reinforcements", tags: ["plural"] }],
                senses: [
                  {
                    definition: "The act of reinforcing.",
                    tags: [],
                    examples: ["Positive reinforcement encourages learning."],
                    synonyms: [],
                    antonyms: [],
                    subsenses: [],
                  },
                ],
                synonyms: [],
                antonyms: [],
              },
            ],
          })
        }
      }
      if (url.hostname === "api.datamuse.com") {
        if (url.searchParams.get("sp") === "reinforcement *") {
          return Response.json([{ word: "reinforcement learning" }])
        }
        if (url.searchParams.get("sp") === "* reinforcement") {
          return Response.json([{ word: "positive reinforcement" }])
        }
        return Response.json([])
      }
      if (url.hostname === "api.mymemory.translated.net") {
        return Response.json({
          responseData: { translatedText: "测试翻译" },
          responseStatus: 200,
        })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await queryDictionary("reinforcements")

    expect(result).toMatchObject({
      word: "reinforcements",
      definition: "plural of reinforcement",
      inflections: [{ label: "复数", value: "reinforcements" }],
      supplementalExamples: [{ text: "Positive reinforcement encourages learning." }],
      commonPhrases: [
        { text: "reinforcement learning" },
        { text: "positive reinforcement" },
      ],
    })
  })

  it("uses Datamuse definitions when looking up a multi-word phrase", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input : input.url,
      )
      if (url.hostname === "freedictionaryapi.com") {
        expect(decodeURIComponent(url.pathname)).toBe(
          "/api/v1/entries/en/look forward to",
        )
        return Response.json({ word: "look forward to", entries: [] })
      }
      if (
        url.hostname === "api.datamuse.com" &&
        url.searchParams.get("sp") === "look forward to"
      ) {
        return Response.json([
          {
            word: "look forward to",
            defs: ["v\tTo anticipate with pleasure."],
          },
        ])
      }
      if (url.hostname === "api.datamuse.com") {
        return Response.json([])
      }
      if (url.hostname === "api.mymemory.translated.net") {
        return Response.json({
          responseData: { translatedText: "高兴地期待。" },
          responseStatus: 200,
        })
      }
      return new Response(null, { status: 404 })
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(queryDictionary("  Look   Forward To ")).resolves.toMatchObject({
      word: "look forward to",
      partOfSpeech: "v",
      definition: "To anticipate with pleasure.",
      translation: "高兴地期待。",
      sources: [{ id: "datamuse" }],
    })
  })
})

describe("convertNarrowToBroadIpa", () => {
  it("returns a broad copy without mutating the narrow transcription", () => {
    const narrow = "[ˈpʰɪn̪]"

    expect(convertNarrowToBroadIpa(narrow)).toBe("/ˈpɪn/")
    expect(narrow).toBe("[ˈpʰɪn̪]")
  })

  it("keeps an existing broad transcription unchanged", () => {
    expect(convertNarrowToBroadIpa("/ˈpɪn/")).toBe("/ˈpɪn/")
  })
})
