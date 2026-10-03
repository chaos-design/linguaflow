import type { SubtitleTranslationLanguage } from "../../types/learning"

const maximumTranslationLength = 450
const translationConcurrency = 8

export async function translateEnglishTexts(
  values: string[],
  targetLanguage: SubtitleTranslationLanguage,
): Promise<string[]> {
  const translations = Array.from({ length: values.length }, () => "")
  let nextIndex = 0

  async function translateNext() {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      translations[index] = await queryMyMemoryTranslation(
        values[index] ?? "",
        targetLanguage,
      )
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(translationConcurrency, values.length) },
      translateNext,
    ),
  )
  return translations
}

async function queryMyMemoryTranslation(
  value: string,
  targetLanguage: SubtitleTranslationLanguage,
): Promise<string> {
  const text = value.trim().slice(0, maximumTranslationLength)
  if (!text) {
    return ""
  }

  try {
    const params = new URLSearchParams({
      q: text,
      langpair: `en|${targetLanguage}`,
    })
    const response = await fetch(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 604_800 },
        signal: AbortSignal.timeout(8_000),
      },
    )
    if (!response.ok) {
      return ""
    }

    const payload = asRecord(await response.json())
    const responseData = asRecord(payload?.responseData)
    return decodeTranslation(
      responseData ? (readString(responseData, "translatedText") ?? "") : "",
    )
  } catch {
    return ""
  }
}

function decodeTranslation(value: string): string {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .trim()
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const result = value[key]
  return typeof result === "string" && result.trim() ? result.trim() : null
}
