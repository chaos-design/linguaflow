import type { LearningPreferences } from "../types/learning"
import { isSubtitleTranslationOption } from "./translation-languages"

export const defaultLearningPreferences: LearningPreferences = {
  version: 5,
  autoOpen: true,
  bilingualCaptions: false,
  captionSize: "medium",
  subtitleTranslationLanguage: "none",
  calendarColor: "#22c55e",
  highlightMastered: false,
  reviewTarget: 20,
  dailyNewLimit: 15,
  autoPause: true,
  dictionary: "free-dictionary",
  translation: "my-memory",
  phonetic: "us",
  autoPronounce: false,
  sync: true,
  weeklySummary: true,
  resumePlayback: true,
  defaultVideoTags: [],
}

export function normalizeLearningPreferences(value: unknown): LearningPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaultLearningPreferences
  }

  const candidate = value as Partial<LearningPreferences>
  return {
    version: 5,
    autoOpen: normalizeBoolean(candidate.autoOpen, defaultLearningPreferences.autoOpen),
    bilingualCaptions: normalizeBoolean(
      candidate.bilingualCaptions,
      defaultLearningPreferences.bilingualCaptions,
    ),
    reviewTarget: clampInteger(candidate.reviewTarget, 5, 100, 20),
    dailyNewLimit: clampInteger(candidate.dailyNewLimit, 1, null, 15),
    captionSize: includesValue(["small", "medium", "large"], candidate.captionSize)
      ? candidate.captionSize
      : "medium",
    subtitleTranslationLanguage: isSubtitleTranslationOption(
      candidate.subtitleTranslationLanguage,
    )
      ? candidate.subtitleTranslationLanguage
      : "none",
    calendarColor:
      typeof candidate.calendarColor === "string" &&
      /^#[\da-f]{6}$/iu.test(candidate.calendarColor)
        ? candidate.calendarColor.toLowerCase()
        : defaultLearningPreferences.calendarColor,
    highlightMastered: normalizeBoolean(
      candidate.highlightMastered,
      defaultLearningPreferences.highlightMastered,
    ),
    autoPause: normalizeBoolean(
      candidate.autoPause,
      defaultLearningPreferences.autoPause,
    ),
    phonetic: includesValue(["us", "uk", "both"], candidate.phonetic)
      ? candidate.phonetic
      : "us",
    dictionary: "free-dictionary",
    translation: "my-memory",
    autoPronounce: normalizeBoolean(
      candidate.autoPronounce,
      defaultLearningPreferences.autoPronounce,
    ),
    sync: normalizeBoolean(candidate.sync, defaultLearningPreferences.sync),
    weeklySummary: normalizeBoolean(
      candidate.weeklySummary,
      defaultLearningPreferences.weeklySummary,
    ),
    resumePlayback: normalizeBoolean(
      candidate.resumePlayback,
      defaultLearningPreferences.resumePlayback,
    ),
    defaultVideoTags: Array.isArray(candidate.defaultVideoTags)
      ? Array.from(
          new Set(
            candidate.defaultVideoTags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.trim().slice(0, 40))
              .filter(Boolean),
          ),
        ).slice(0, 12)
      : [],
  }
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function clampInteger(
  value: number | undefined,
  minimum: number,
  maximum: number | null,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback
  }
  const normalized = Math.max(minimum, Math.round(value ?? fallback))
  return maximum === null ? normalized : Math.min(maximum, normalized)
}

function includesValue<const Value extends string>(
  values: readonly Value[],
  value: unknown,
): value is Value {
  return typeof value === "string" && values.includes(value as Value)
}
