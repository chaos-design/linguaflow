import { afterEach, describe, expect, it, vi } from "vitest"
import {
  buildAiRequestEndpoint,
  normalizeAiBaseUrl,
  parseAiJsonObject,
  readAiResponseContent,
  validateAiModelConnection,
  validateAiVocabularyAnalysisConsistency,
} from "@/server/learning/ai-vocabulary"
import { getAiProviderDefaults } from "@/shared/ai-model-config"
import type { AiVocabularyAnalysis } from "@/types/learning"

describe("AI vocabulary endpoint normalization", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("builds the request URL from base URL and endpoint option", () => {
    expect(
      buildAiRequestEndpoint({
        enabled: true,
        provider: "openai",
        baseUrl: "https://api.openai.com/v1/",
        endpointKind: "chat-completions",
        model: "gpt-4.1-mini",
        apiKey: "sk-test-key",
      }),
    ).toBe("https://api.openai.com/v1/chat/completions")
  })

  it("builds the Anthropic Messages endpoint", () => {
    const anthropic = getAiProviderDefaults("anthropic")

    expect(
      buildAiRequestEndpoint({
        enabled: true,
        provider: "anthropic",
        baseUrl: anthropic.baseUrl,
        endpointKind: "anthropic-messages",
        model: anthropic.model,
        apiKey: "sk-test-key",
      }),
    ).toBe("https://api.anthropic.com/v1/messages")
  })

  it("uses the custom interface address without appending a path", () => {
    vi.stubEnv("AI_ALLOWED_HOSTS", "example.com")

    expect(
      buildAiRequestEndpoint({
        enabled: true,
        provider: "custom",
        baseUrl: "https://example.com/gateway/generate?version=2",
        endpointKind: "chat-completions",
        model: "custom-model",
        apiKey: "sk-test-key",
      }),
    ).toBe("https://example.com/gateway/generate?version=2")
  })

  it("rejects fully configured chat completions URLs as base URLs", () => {
    expect(() =>
      normalizeAiBaseUrl("https://api.openai.com/v1/chat/completions"),
    ).toThrow("接口地址不要包含具体请求路径")
  })

  it("uses Anthropic headers and message payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: [{ type: "text", text: "OK" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )
    vi.stubGlobal("fetch", fetchMock)

    await validateAiModelConnection({
      enabled: true,
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      endpointKind: "anthropic-messages",
      model: "claude-sonnet-4-5",
      apiKey: "anthropic-test-key",
    })

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe("https://api.anthropic.com/v1/messages")
    expect(init?.headers).toMatchObject({
      "anthropic-version": "2023-06-01",
      "x-api-key": "anthropic-test-key",
    })
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: "claude-sonnet-4-5",
      messages: [{ role: "user", content: "Reply with only the letters OK." }],
    })
  })

  it("rejects private network endpoints", () => {
    expect(() => normalizeAiBaseUrl("https://127.0.0.1/v1")).toThrow(
      "AI 接口不能指向本机或私有网络。",
    )
    expect(() => normalizeAiBaseUrl("https://[::ffff:127.0.0.1]/v1")).toThrow(
      "AI 接口不能指向本机或私有网络。",
    )
  })

  it("rejects AI hosts outside the server allowlist", () => {
    expect(() => normalizeAiBaseUrl("https://example.com/v1")).toThrow(
      "AI 接口域名未在服务端允许列表中。",
    )
    expect(() => normalizeAiBaseUrl("https://api.openai.com.example.test/v1")).toThrow(
      "AI 接口域名未在服务端允许列表中。",
    )
  })

  it("allows an exact hostname configured by the server", () => {
    vi.stubEnv("AI_ALLOWED_HOSTS", "gateway.example.com, second.example.com")

    expect(normalizeAiBaseUrl("https://gateway.example.com/v1")).toBe(
      "https://gateway.example.com/v1",
    )
  })

  it("reads common AI response content formats", () => {
    expect(
      readAiResponseContent({
        choices: [{ message: { content: "OK" } }],
      }),
    ).toBe("OK")
    expect(
      readAiResponseContent({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "Response API text" }],
          },
        ],
      }),
    ).toBe("Response API text")
    expect(
      readAiResponseContent({
        type: "message",
        content: [{ type: "text", text: "Messages API text" }],
      }),
    ).toBe("Messages API text")
  })

  it("parses JSON objects from common model response wrappers", () => {
    expect(
      parseAiJsonObject('```json\n{"explanation":{"en":"ok","zh":"好"}}\n```'),
    ).toEqual({ explanation: { en: "ok", zh: "好" } })
    expect(
      parseAiJsonObject('"{\\"explanation\\":{\\"en\\":\\"ok\\",\\"zh\\":\\"好\\"}}"'),
    ).toEqual({ explanation: { en: "ok", zh: "好" } })
    expect(
      parseAiJsonObject('{"explanation":{"en":"line one\nline two","zh":"好",},}'),
    ).toEqual({ explanation: { en: "line one\nline two", zh: "好" } })
  })
})

describe("AI vocabulary regeneration consistency", () => {
  it("accepts reworded analysis when stable facts still overlap", () => {
    const previousAnalysis = makeAnalysis({
      wordParts: [
        makeItem("prefix: de-"),
        makeItem("root: ject"),
        makeItem("suffix: -ed"),
      ],
      etymologyTree: [
        {
          label: "Latin iacere",
          en: "The verb means to throw.",
          zh: "意为投掷。",
          children: [],
        },
      ],
    })
    const analysis = makeAnalysis({
      wordParts: [
        makeItem("de- (prefix)"),
        makeItem("ject (root)"),
        makeItem("-ed (suffix)"),
      ],
      etymologyTree: [
        {
          label: "Latin iacere",
          en: "A Latin verb for throwing.",
          zh: "拉丁语动词。",
          children: [],
        },
      ],
    })

    expect(
      validateAiVocabularyAnalysisConsistency(analysis, {
        ...analysisContext,
        previousAnalysis,
      }),
    ).toBeNull()
  })

  it("rejects regenerated word parts that conflict with existing facts", () => {
    const previousAnalysis = makeAnalysis({
      wordParts: [makeItem("prefix: de-"), makeItem("root: ject")],
    })
    const analysis = makeAnalysis({
      wordParts: [makeItem("prefix: un-"), makeItem("root: happy")],
    })

    expect(
      validateAiVocabularyAnalysisConsistency(analysis, {
        ...analysisContext,
        previousAnalysis,
      }),
    ).toContain("词根词缀")
  })

  it("rejects regenerated etymology with no shared verifiable facts", () => {
    const previousAnalysis = makeAnalysis({
      etymologyTree: [
        {
          label: "Latin iacere",
          en: "A verb meaning to throw or cast.",
          zh: "意为投掷。",
          children: [],
        },
      ],
    })
    const analysis = makeAnalysis({
      etymologyTree: [
        {
          label: "Greek graphein",
          en: "A verb meaning to write or draw.",
          zh: "意为书写。",
          children: [],
        },
      ],
    })

    expect(
      validateAiVocabularyAnalysisConsistency(analysis, {
        ...analysisContext,
        previousAnalysis,
      }),
    ).toContain("词源脉络")
  })
})

const analysisContext = {
  word: "dejected",
  partOfSpeech: "adjective",
  definition: "sad and dispirited",
  definitionTranslation: "沮丧的",
  examples: [],
  sourceSentence: "He looked dejected.",
  wordAnalysis: {},
}

function makeItem(term: string) {
  return {
    term,
    en: `${term} explanation`,
    zh: `${term} 解释`,
    source: "",
    phrase: "",
    phraseTranslation: "",
    example: "",
    exampleTranslation: "",
  }
}

function makeAnalysis(
  overrides: Partial<AiVocabularyAnalysis> = {},
): AiVocabularyAnalysis {
  return {
    generatedAt: "2026-08-20T00:00:00.000Z",
    cefrLevel: "B1",
    examLabels: [],
    meanings: [],
    inflections: [],
    explanation: {
      en: "Feeling sad after a setback.",
      zh: "遭遇挫折后感到悲伤。",
    },
    partsOfSpeech: [makeItem("adjective")],
    tenses: [],
    etymology: { en: "", zh: "" },
    etymologyTree: [],
    wordParts: [],
    wordPartMemory: { en: "", zh: "" },
    derivatives: [],
    examples: [],
    collocations: [],
    phrases: [],
    idioms: [],
    synonyms: [],
    antonyms: [],
    replacements: [],
    newMeanings: [],
    ...overrides,
  }
}
