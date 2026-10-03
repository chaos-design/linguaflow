import { describe, expect, it } from "vitest"
import { getAiEndpointPreview, normalizeAiModelConfig } from "@/shared/ai-model-config"

describe("AI model configuration", () => {
  it("uses the provider protocol defaults", () => {
    expect(
      normalizeAiModelConfig({
        enabled: true,
        provider: "anthropic",
        apiKey: "test-key",
      }),
    ).toMatchObject({
      provider: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      endpointKind: "anthropic-messages",
      model: "claude-sonnet-4-5",
    })
  })

  it("uses a custom address directly and locks the protocol to chat completions", () => {
    const config = normalizeAiModelConfig({
      enabled: true,
      provider: "custom",
      baseUrl: "https://example.com/custom/messages",
      endpointKind: "anthropic-messages",
      model: "custom-model",
    })

    expect(config.endpointKind).toBe("chat-completions")
    expect(getAiEndpointPreview(config)).toBe("https://example.com/custom/messages")
  })

  it("migrates legacy compatible providers to a complete custom address", () => {
    const config = normalizeAiModelConfig({
      enabled: true,
      provider: "agnes",
      baseUrl: "https://apihub.agnes-ai.com/v1",
      endpointKind: "chat-completions",
      model: "agnes-2.0-flash",
    })

    expect(config.provider).toBe("custom")
    expect(config.baseUrl).toBe("https://apihub.agnes-ai.com/v1/chat/completions")
  })
})
