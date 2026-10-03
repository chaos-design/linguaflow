import type {
  AiModelConfigInput,
  AiModelEndpointKind,
  AiModelProviderId,
} from "../types/learning"

export const aiModelConfigStorageKey = "linguaflow:ai-model-config:v1"

export const aiModelEndpointOptions: Array<{
  value: AiModelEndpointKind
  label: string
  path: string
}> = [
  {
    value: "chat-completions",
    label: "Chat Completions",
    path: "/chat/completions",
  },
  {
    value: "anthropic-messages",
    label: "Anthropic Messages",
    path: "/messages",
  },
]

export const aiModelProviderOptions: Array<{
  value: AiModelProviderId
  label: string
  baseUrl: string
  model: string
  endpointKind: AiModelEndpointKind
}> = [
  {
    value: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    endpointKind: "chat-completions",
  },
  {
    value: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-sonnet-4-5",
    endpointKind: "anthropic-messages",
  },
  {
    value: "custom",
    label: "自定义配置",
    baseUrl: "",
    model: "",
    endpointKind: "chat-completions",
  },
]

export const defaultAiModelConfig: AiModelConfigInput = {
  enabled: false,
  provider: "openai",
  baseUrl: "https://api.openai.com/v1",
  endpointKind: "chat-completions",
  model: "gpt-4.1-mini",
  apiKey: "",
}

export function normalizeAiModelConfig(value: unknown): AiModelConfigInput {
  const record: Record<string, unknown> =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const legacyProvider = record.provider === "deepseek" || record.provider === "agnes"
  const provider = isAiProvider(record.provider)
    ? record.provider
    : legacyProvider
      ? "custom"
      : "openai"
  const providerDefaults =
    aiModelProviderOptions.find((item) => item.value === provider) ??
    aiModelProviderOptions[0]
  const storedAddress =
    typeof record.baseUrl === "string" ? normalizeAddressText(record.baseUrl) : ""
  const baseUrl = legacyProvider
    ? appendEndpointPath(storedAddress, "/chat/completions")
    : storedAddress
  const endpointKind =
    provider === "custom"
      ? "chat-completions"
      : isAiEndpointKind(record.endpointKind)
        ? record.endpointKind
        : providerDefaults.endpointKind

  return {
    enabled: Boolean(record.enabled),
    provider,
    baseUrl: baseUrl || providerDefaults.baseUrl,
    endpointKind,
    model:
      typeof record.model === "string" && record.model.trim()
        ? record.model.trim().slice(0, 120)
        : providerDefaults.model,
    apiKey:
      typeof record.apiKey === "string" ? record.apiKey.trim().slice(0, 4096) : "",
  }
}

export function readStoredAiModelConfig(): AiModelConfigInput {
  if (typeof window === "undefined") {
    return defaultAiModelConfig
  }
  try {
    return normalizeAiModelConfig(
      JSON.parse(window.localStorage.getItem(aiModelConfigStorageKey) ?? "null"),
    )
  } catch {
    return defaultAiModelConfig
  }
}

export function writeStoredAiModelConfig(config: AiModelConfigInput) {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(
    aiModelConfigStorageKey,
    JSON.stringify(normalizeAiModelConfig(config)),
  )
}

export function getAiEndpointPreview(config: AiModelConfigInput): string {
  const baseUrl = normalizeAddressText(config.baseUrl)
  if (config.provider === "custom") {
    return baseUrl
  }
  const endpoint = aiModelEndpointOptions.find(
    (item) => item.value === config.endpointKind,
  )
  return baseUrl && endpoint
    ? appendEndpointPath(baseUrl, endpoint.path)
    : (endpoint?.path ?? "")
}

export function getAiProviderDefaults(provider: AiModelProviderId) {
  return (
    aiModelProviderOptions.find((item) => item.value === provider) ??
    aiModelProviderOptions[0]
  )
}

function normalizeAddressText(value: string): string {
  return value.trim().replace(/\/+$/u, "").slice(0, 500)
}

function appendEndpointPath(address: string, path: string): string {
  if (!address || address.endsWith(path)) {
    return address
  }
  return `${address}${path}`
}

function isAiProvider(value: unknown): value is AiModelProviderId {
  return value === "openai" || value === "anthropic" || value === "custom"
}

function isAiEndpointKind(value: unknown): value is AiModelEndpointKind {
  return value === "chat-completions" || value === "anthropic-messages"
}
