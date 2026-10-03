import type {
  SubtitleTranslationLanguage,
  SubtitleTranslationOption,
} from "../types/learning"

export const subtitleTranslationLanguages: Array<{
  label: string
  value: SubtitleTranslationLanguage
}> = [
  { label: "简体中文", value: "zh-CN" },
  { label: "繁體中文", value: "zh-TW" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Português", value: "pt" },
  { label: "Русский", value: "ru" },
]

export const subtitleTranslationOptions: Array<{
  label: string
  value: SubtitleTranslationOption
}> = [{ label: "不翻译", value: "none" }, ...subtitleTranslationLanguages]

export function isSubtitleTranslationLanguage(
  value: unknown,
): value is SubtitleTranslationLanguage {
  return subtitleTranslationLanguages.some((language) => language.value === value)
}

export function isSubtitleTranslationOption(
  value: unknown,
): value is SubtitleTranslationOption {
  return value === "none" || isSubtitleTranslationLanguage(value)
}

export function getSubtitleTranslationLanguageLabel(
  value: SubtitleTranslationOption,
): string {
  if (value === "none") {
    return "不翻译"
  }
  return (
    subtitleTranslationLanguages.find((language) => language.value === value)?.label ??
    value
  )
}
