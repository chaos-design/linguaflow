import { cache } from "react"
import { createClient } from "../../lib/supabase/server"
import { hasChineseText } from "../../lib/vocabulary-display"
import { parseAiVocabularyAnalysis } from "../../shared/ai-vocabulary"
import { normalizeLearningPreferences } from "../../shared/learning-preferences"
import type { Database } from "../../types/database"
import type {
  DailyActivity,
  DictionaryExample,
  DictionaryInflection,
  DictionaryMeaning,
  DictionaryPhrase,
  DictionarySource,
  DictionaryWordAnalysis,
  DictionaryWordPart,
  LearningCategory,
  LearningPreferences,
  LearningStats,
  LearningTag,
  LearningTaxonomy,
  PlaylistSummary,
  VideoDetail,
  VideoSummary,
  VocabularyWord,
  WorkspaceOverview,
} from "../../types/learning"
import { translateEnglishTexts } from "./translation"

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]
type TagRow = Database["public"]["Tables"]["tags"]["Row"]
type VideoRow = Database["public"]["Tables"]["videos"]["Row"]
type ProgressRow = Database["public"]["Tables"]["video_progress"]["Row"]
type VocabularyRow = Database["public"]["Tables"]["vocabulary_words"]["Row"]
type VocabularyTagRow = Database["public"]["Tables"]["vocabulary_tags"]["Row"]
const legacyLocalVideoSourcePrefix = "linguaflow-local:"
const databaseReadPageSize = 1000

function isMissingVocabularyTagsTable(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false
  }
  const record = error as { code?: unknown; message?: unknown }
  const code = typeof record.code === "string" ? record.code : ""
  const message =
    typeof record.message === "string" ? record.message.toLocaleLowerCase("en") : ""
  return (
    (code === "42P01" || code === "PGRST205") && message.includes("vocabulary_tags")
  )
}

async function ensureVocabularyDefinitionTranslations(
  rows: VocabularyRow[],
): Promise<VocabularyRow[]> {
  const missingRows = rows.filter(
    (row) => !row.definition_translation?.trim() && row.definition.trim(),
  )
  if (missingRows.length === 0) {
    return rows
  }

  const translations = await translateEnglishTexts(
    missingRows.map((row) => row.definition),
    "zh-CN",
  )
  const translationsById = new Map<string, string>()
  missingRows.forEach((row, index) => {
    const translation = translations[index]?.trim() ?? ""
    if (hasChineseText(translation)) {
      translationsById.set(row.id, translation)
    }
  })
  if (translationsById.size === 0) {
    return rows
  }

  return rows.map((row) => {
    const definitionTranslation = translationsById.get(row.id)
    return definitionTranslation
      ? { ...row, definition_translation: definitionTranslation }
      : row
  })
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") {
            return item
          }
          const record = asRecord(item)
          return record ? readString(record, "text") : null
        })
        .filter((item): item is string => typeof item === "string")
    : []
}

function toDictionaryExamples(
  value: unknown,
  fallbackTexts: string[],
): DictionaryExample[] {
  const examples = Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === "string") {
            return { text: item, translation: "" }
          }
          const record = asRecord(item)
          const text = record ? readString(record, "text") : null
          return text
            ? {
                text,
                translation: record ? (readString(record, "translation") ?? "") : "",
              }
            : null
        })
        .filter((item): item is DictionaryExample => item !== null)
    : []
  if (examples.length > 0) {
    return examples.slice(0, 3)
  }
  return fallbackTexts.slice(0, 3).map((text) => ({ text, translation: "" }))
}

function toDictionaryPhrases(value: unknown): DictionaryPhrase[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const record = asRecord(item)
          if (!record) {
            return null
          }
          const text = readString(record, "text")
          return text
            ? {
                text,
                translation: readString(record, "translation") ?? "",
                note: readString(record, "note") ?? "",
                example: readString(record, "example") ?? "",
                exampleTranslation: readString(record, "exampleTranslation") ?? "",
              }
            : null
        })
        .filter((item): item is DictionaryPhrase => item !== null)
        .slice(0, 4)
    : []
}

function toDictionaryMeanings(value: unknown): DictionaryMeaning[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const record = asRecord(item)
          const definition = record ? readString(record, "definition") : null
          if (!record || !definition) {
            return null
          }
          return {
            partOfSpeech: readString(record, "partOfSpeech") ?? "",
            definition,
            translation: readString(record, "translation") ?? "",
            example: readString(record, "example") ?? "",
            exampleTranslation: readString(record, "exampleTranslation") ?? "",
          }
        })
        .filter((item): item is DictionaryMeaning => item !== null)
        .slice(0, 12)
    : []
}

function toDictionarySources(value: unknown): DictionarySource[] {
  return Array.isArray(value)
    ? value
        .map((item) => {
          const record = asRecord(item)
          if (!record) {
            return null
          }
          const id = readString(record, "id")
          const label = readString(record, "label")
          if (id !== "free-dictionary" && id !== "datamuse") {
            return null
          }
          return {
            id,
            label: label ?? id,
            description: readString(record, "description") ?? "",
            url: readString(record, "url") ?? "",
            meanings: toDictionaryMeanings(record.meanings),
          }
        })
        .filter((item): item is DictionarySource => item !== null)
    : []
}

function toAiInflections(word: VocabularyWord["aiAnalysis"]): DictionaryInflection[] {
  return (
    word?.inflections.flatMap((item) => {
      const label = item.zh || item.term
      const value = item.en
      return label && value ? [{ label, value }] : []
    }) ?? []
  )
}

function toWordAnalysis(value: unknown): DictionaryWordAnalysis {
  const record = asRecord(value)
  if (!record) {
    return {
      etymology: "",
      etymologyTranslation: "",
      examLabels: [],
      inflections: [],
      parts: [],
      relatedWords: [],
    }
  }
  const parts = Array.isArray(record.parts)
    ? record.parts
        .map((item) => {
          const part = asRecord(item)
          if (!part) {
            return null
          }
          const kind = readString(part, "kind")
          const text = readString(part, "text")
          if (
            kind !== "prefix" &&
            kind !== "root" &&
            kind !== "suffix" &&
            kind !== "base"
          ) {
            return null
          }
          return text
            ? {
                kind,
                text,
                meaning: readString(part, "meaning") ?? "",
                meaningTranslation: readString(part, "meaningTranslation") ?? "",
                source: readString(part, "source") ?? "",
                phrase: readString(part, "phrase") ?? "",
                phraseTranslation: readString(part, "phraseTranslation") ?? "",
                example: readString(part, "example") ?? "",
                exampleTranslation: readString(part, "exampleTranslation") ?? "",
              }
            : null
        })
        .filter((item): item is DictionaryWordPart => item !== null)
    : []
  return {
    etymology: readString(record, "etymology") ?? "",
    etymologyTranslation: readString(record, "etymologyTranslation") ?? "",
    examLabels: Array.isArray(record.examLabels)
      ? record.examLabels
          .filter((item): item is string => typeof item === "string")
          .slice(0, 12)
      : [],
    inflections: Array.isArray(record.inflections)
      ? record.inflections
          .flatMap((item) => {
            const inflection = asRecord(item)
            const label = inflection ? readString(inflection, "label") : null
            const inflectedValue = inflection ? readString(inflection, "value") : null
            return label && inflectedValue ? [{ label, value: inflectedValue }] : []
          })
          .slice(0, 8)
      : [],
    parts,
    relatedWords: toStringArray(record.relatedWords),
  }
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

function toCategory(row: CategoryRow | undefined): LearningCategory | null {
  if (!row) {
    return null
  }
  return {
    id: row.id,
    name: row.name,
    color: row.color,
  }
}

function toTag(row: TagRow, isDefault = false): LearningTag {
  return {
    id: row.id,
    name: row.name,
    isDefault,
  }
}

function toVocabularyWord(
  row: VocabularyRow,
  tags: LearningTag[] = [],
): VocabularyWord {
  const examples = toStringArray(row.examples)
  const dictionarySources = toDictionarySources(row.dictionary_sources)
  const aiAnalysis = parseAiVocabularyAnalysis(row.ai_analysis)
  const wordAnalysis = toWordAnalysis(row.word_analysis)
  const commonPhrases = toDictionaryPhrases(row.common_phrases)
  return {
    id: row.id,
    word: row.word,
    tags,
    phonetic: row.phonetic ?? "",
    phoneticUk: row.phonetic_uk ?? row.phonetic ?? "",
    phoneticUs: row.phonetic_us ?? row.phonetic ?? "",
    partOfSpeech: row.part_of_speech ?? "",
    definition: row.definition,
    definitionTranslation: row.definition_translation ?? "",
    meanings: dictionarySources.flatMap((source) => source.meanings),
    examLabels: aiAnalysis?.examLabels.length
      ? aiAnalysis.examLabels
      : wordAnalysis.examLabels,
    inflections: aiAnalysis?.inflections.length
      ? toAiInflections(aiAnalysis)
      : wordAnalysis.inflections.length
        ? wordAnalysis.inflections
        : [],
    examples,
    exampleTranslations: toDictionaryExamples(row.example_translations, examples),
    commonPhrases,
    wordAnalysis,
    dictionarySources,
    aiAnalysis,
    sourceTitle: row.source_title,
    sourceVideoId: row.video_id,
    sourceTimestampSeconds: row.source_timestamp_seconds,
    sourceSentence: row.source_sentence ?? "",
    translation: row.translation ?? "",
    addedAt: row.created_at,
    mastery: row.mastery,
    easeFactor: Number(row.ease_factor),
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    dueAt: row.due_at,
    lastReviewedAt: row.last_reviewed_at,
  }
}

function mapVocabularyTags(
  tags: TagRow[],
  vocabularyTags: VocabularyTagRow[],
): Map<string, LearningTag[]> {
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const tagsByVocabulary = new Map<string, LearningTag[]>()

  for (const relation of vocabularyTags) {
    const tag = tagMap.get(relation.tag_id)
    if (!tag) {
      continue
    }
    const currentTags = tagsByVocabulary.get(relation.vocabulary_id) ?? []
    currentTags.push(toTag(tag))
    tagsByVocabulary.set(relation.vocabulary_id, currentTags)
  }
  for (const wordTags of tagsByVocabulary.values()) {
    wordTags.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
  }
  return tagsByVocabulary
}

async function queryAllVocabularyTagRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  vocabularyIds?: string[],
): Promise<VocabularyTagRow[]> {
  const rows: VocabularyTagRow[] = []

  for (let offset = 0; ; offset += databaseReadPageSize) {
    let query = supabase
      .from("vocabulary_tags")
      .select("vocabulary_id, tag_id, user_id")
      .eq("user_id", userId)
      .order("vocabulary_id", { ascending: true })
      .order("tag_id", { ascending: true })
      .range(offset, offset + databaseReadPageSize - 1)
    if (vocabularyIds) {
      query = query.in("vocabulary_id", vocabularyIds)
    }

    const result = await query
    if (result.error) {
      throw result.error
    }
    const pageRows = result.data ?? []
    rows.push(...pageRows)
    if (pageRows.length < databaseReadPageSize) {
      return rows
    }
  }
}

async function queryAllTagRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<TagRow[]> {
  const rows: TagRow[] = []

  for (let offset = 0; ; offset += databaseReadPageSize) {
    const result = await supabase
      .from("tags")
      .select("*")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(offset, offset + databaseReadPageSize - 1)
    if (result.error) {
      throw result.error
    }
    const pageRows = result.data ?? []
    rows.push(...pageRows)
    if (pageRows.length < databaseReadPageSize) {
      return rows
    }
  }
}

async function queryVocabularyTagMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  vocabularyIds?: string[],
): Promise<Map<string, LearningTag[]>> {
  if (vocabularyIds?.length === 0) {
    return new Map()
  }
  try {
    const [tags, vocabularyTags] = await Promise.all([
      queryAllTagRows(supabase, userId),
      queryAllVocabularyTagRows(supabase, userId, vocabularyIds),
    ])
    return mapVocabularyTags(tags, vocabularyTags)
  } catch (error) {
    if (isMissingVocabularyTagsTable(error)) {
      return new Map()
    }
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "未知错误"
    throw new Error(`读取生词标签失败：${message}`)
  }
}

async function queryAllVocabularyRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<VocabularyRow[]> {
  const rows: VocabularyRow[] = []

  for (let offset = 0; ; offset += databaseReadPageSize) {
    const result = await supabase
      .from("vocabulary_words")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + databaseReadPageSize - 1)
    if (result.error) {
      throw new Error(`读取生词本失败：${result.error.message}`)
    }
    const pageRows = result.data ?? []
    rows.push(...pageRows)
    if (pageRows.length < databaseReadPageSize) {
      return rows
    }
  }
}

function mapVideos(
  videos: VideoRow[],
  categories: CategoryRow[],
  tags: TagRow[],
  videoTags: Array<{ video_id: string; tag_id: string }>,
  progressRows: ProgressRow[],
  transcriptRows: Array<{ video_id: string }>,
): VideoSummary[] {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const progressMap = new Map(
    progressRows.map((progress) => [progress.video_id, progress]),
  )
  const tagsByVideo = new Map<string, LearningTag[]>()
  const transcriptCountByVideo = new Map<string, number>()

  for (const relation of videoTags) {
    const tag = tagMap.get(relation.tag_id)
    if (!tag) {
      continue
    }
    const currentTags = tagsByVideo.get(relation.video_id) ?? []
    currentTags.push(toTag(tag))
    tagsByVideo.set(relation.video_id, currentTags)
  }
  for (const cue of transcriptRows) {
    transcriptCountByVideo.set(
      cue.video_id,
      (transcriptCountByVideo.get(cue.video_id) ?? 0) + 1,
    )
  }

  return videos.map((video) => {
    const progress = progressMap.get(video.id)
    const legacyLocalFileKey = video.source_url?.startsWith(
      legacyLocalVideoSourcePrefix,
    )
      ? video.source_url.slice(legacyLocalVideoSourcePrefix.length)
      : null
    const isLocalVideo = video.source_type === "local" || Boolean(legacyLocalFileKey)
    return {
      id: video.id,
      title: video.title,
      description: video.description ?? "",
      sourceType: isLocalVideo ? "local" : video.source_type,
      sourceUrl: isLocalVideo ? null : video.source_url,
      localFileKey: isLocalVideo ? (video.source_key ?? legacyLocalFileKey) : null,
      thumbnailUrl: video.thumbnail_url,
      durationSeconds: video.duration_seconds,
      status: video.status,
      createdAt: video.created_at,
      category: toCategory(
        video.category_id ? categoryMap.get(video.category_id) : undefined,
      ),
      tags: tagsByVideo.get(video.id) ?? [],
      transcriptCueCount: transcriptCountByVideo.get(video.id) ?? 0,
      positionSeconds: progress?.position_seconds ?? 0,
      completionPercent: Number(progress?.completion_percent ?? 0),
      completed: progress?.completed ?? false,
      lastWatchedAt: progress?.last_watched_at ?? null,
    }
  })
}

async function queryVideos(userId: string, searchQuery = ""): Promise<VideoSummary[]> {
  const supabase = await createClient()
  const videoQuery = supabase
    .from("videos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  const [
    videoResult,
    categoryResult,
    tagResult,
    videoTagResult,
    progressResult,
    transcriptResult,
  ] = await Promise.all([
    videoQuery,
    supabase.from("categories").select("*").eq("user_id", userId),
    supabase.from("tags").select("*").eq("user_id", userId),
    supabase.from("video_tags").select("video_id, tag_id").eq("user_id", userId),
    supabase.from("video_progress").select("*").eq("user_id", userId),
    supabase.from("transcript_cues").select("video_id").eq("user_id", userId),
  ])

  const firstError =
    videoResult.error ??
    categoryResult.error ??
    tagResult.error ??
    videoTagResult.error ??
    progressResult.error ??
    transcriptResult.error
  if (firstError) {
    throw new Error(`读取视频资源失败：${firstError.message}`)
  }

  const mappedVideos = mapVideos(
    videoResult.data ?? [],
    categoryResult.data ?? [],
    tagResult.data ?? [],
    videoTagResult.data ?? [],
    progressResult.data ?? [],
    transcriptResult.data ?? [],
  )
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase("zh-CN")
  if (!normalizedQuery) {
    return mappedVideos
  }
  return mappedVideos.filter((video) =>
    [
      video.title,
      video.description,
      video.category?.name ?? "",
      ...video.tags.map((tag) => tag.name),
    ]
      .join(" ")
      .toLocaleLowerCase("zh-CN")
      .includes(normalizedQuery),
  )
}

export const getVideos = cache(queryVideos)

export const getLearningTaxonomy = cache(
  async (userId: string): Promise<LearningTaxonomy> => {
    const supabase = await createClient()
    const [categoryResult, tagResult, profileResult] = await Promise.all([
      supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabase
        .from("tags")
        .select("*")
        .eq("user_id", userId)
        .order("name", { ascending: true }),
      supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle(),
    ])
    const firstError = categoryResult.error ?? tagResult.error ?? profileResult.error
    if (firstError) {
      throw new Error(`读取分类和标签失败：${firstError.message}`)
    }
    const defaultTagNames = new Set(
      normalizeLearningPreferences(
        profileResult.data?.preferences,
      ).defaultVideoTags.map((name) => name.toLocaleLowerCase("zh-CN")),
    )
    return {
      categories: (categoryResult.data ?? [])
        .map(toCategory)
        .filter((category): category is LearningCategory => category !== null),
      tags: (tagResult.data ?? []).map((tag) =>
        toTag(tag, defaultTagNames.has(tag.name.toLocaleLowerCase("zh-CN"))),
      ),
    }
  },
)

async function queryPlaylists(
  userId: string,
  providedVideos?: VideoSummary[],
): Promise<PlaylistSummary[]> {
  const supabase = await createClient()
  const videosPromise = providedVideos
    ? Promise.resolve(providedVideos)
    : getVideos(userId)
  const [videos, playlistResult, itemResult] = await Promise.all([
    videosPromise,
    supabase
      .from("playlists")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("playlist_items")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
  ])

  const firstError = playlistResult.error ?? itemResult.error
  if (firstError) {
    throw new Error(`读取播放列表失败：${firstError.message}`)
  }

  const videoMap = new Map(videos.map((video) => [video.id, video]))
  return (playlistResult.data ?? []).map((playlist) => {
    const playlistVideos = (itemResult.data ?? [])
      .filter((item) => item.playlist_id === playlist.id)
      .flatMap((item) => {
        const video = videoMap.get(item.video_id)
        return video ? [video] : []
      })

    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description ?? "",
      videoCount: playlistVideos.length,
      totalDurationSeconds: playlistVideos.reduce(
        (total, video) => total + video.durationSeconds,
        0,
      ),
      updatedAt: playlist.updated_at,
      videos: playlistVideos,
    }
  })
}

export const getPlaylists = cache(async (userId: string) => queryPlaylists(userId))

function getCurrentStreak(sessionDates: Set<string>): number {
  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (sessionDates.has(formatLocalDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function createDailyActivity(
  sessions: Array<{ started_at: string; duration_seconds: number }>,
  notes: Array<{ created_at: string }>,
  reviews: Array<{ reviewed_at: string }>,
): DailyActivity[] {
  const activityByDate = new Map<
    string,
    {
      seconds: number
      sessionCount: number
      reviewCount: number
      noteCount: number
    }
  >()
  function getActivity(date: string) {
    const current = activityByDate.get(date) ?? {
      seconds: 0,
      sessionCount: 0,
      reviewCount: 0,
      noteCount: 0,
    }
    activityByDate.set(date, current)
    return current
  }

  for (const session of sessions) {
    const date = session.started_at.slice(0, 10)
    const activity = getActivity(date)
    activity.seconds += session.duration_seconds
    activity.sessionCount += 1
  }
  for (const note of notes) {
    getActivity(note.created_at.slice(0, 10)).noteCount += 1
  }
  for (const review of reviews) {
    getActivity(review.reviewed_at.slice(0, 10)).reviewCount += 1
  }

  return Array.from(activityByDate, ([date, values]) => {
    const parsedDate = new Date(`${date}T00:00:00`)
    return {
      date,
      label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(parsedDate),
      ...values,
    }
  }).sort((left, right) => left.date.localeCompare(right.date))
}

function createRecentActivity(
  activity: DailyActivity[],
  dayCount: number,
): DailyActivity[] {
  const activityMap = new Map(activity.map((day) => [day.date, day]))
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - (dayCount - 1 - index))
    const dateKey = formatLocalDateKey(date)
    return (
      activityMap.get(dateKey) ?? {
        date: dateKey,
        label: new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date),
        seconds: 0,
        sessionCount: 0,
        reviewCount: 0,
        noteCount: 0,
      }
    )
  })
}

function formatLocalDateKey(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

async function queryLearningStats(
  userId: string,
  providedVideos?: VideoSummary[],
): Promise<LearningStats> {
  const supabase = await createClient()

  const [videos, sessionResult, noteResult, reviewResult] = await Promise.all([
    providedVideos ? Promise.resolve(providedVideos) : getVideos(userId),
    supabase
      .from("study_sessions")
      .select("started_at, duration_seconds")
      .eq("user_id", userId),
    supabase.from("notes").select("created_at").eq("user_id", userId),
    supabase.from("review_logs").select("reviewed_at").eq("user_id", userId),
  ])

  const firstError = sessionResult.error ?? noteResult.error ?? reviewResult.error
  if (firstError) {
    throw new Error(`读取学习统计失败：${firstError.message}`)
  }

  const sessions = sessionResult.data ?? []
  const notes = noteResult.data ?? []
  const reviews = reviewResult.data ?? []
  const calendarActivity = createDailyActivity(sessions, notes, reviews)
  const sessionDates = new Set(
    sessions.map((session) => session.started_at.slice(0, 10)),
  )
  const groupedCategories = new Map<string, { completed: number; total: number }>()
  for (const video of videos) {
    const categoryName = video.category?.name ?? "未分类"
    const current = groupedCategories.get(categoryName) ?? {
      completed: 0,
      total: 0,
    }
    current.total += 1
    current.completed += video.completed ? 1 : 0
    groupedCategories.set(categoryName, current)
  }

  return {
    totalLearningSeconds: sessions.reduce(
      (total, session) => total + session.duration_seconds,
      0,
    ),
    completedVideos: videos.filter((video) => video.completed).length,
    activeVideos: videos.filter(
      (video) => video.completionPercent > 0 && !video.completed,
    ).length,
    totalNotes: notes.length,
    currentStreakDays: getCurrentStreak(sessionDates),
    recentActivity: createRecentActivity(calendarActivity, 30),
    calendarActivity,
    categoryProgress: Array.from(groupedCategories, ([name, progress]) => ({
      name,
      ...progress,
    })),
  }
}

export const getLearningStats = cache(async (userId: string) =>
  queryLearningStats(userId),
)

export const getWorkspaceOverview = cache(
  async (userId: string): Promise<WorkspaceOverview> => {
    const videos = await getVideos(userId)
    const [playlists, stats] = await Promise.all([
      queryPlaylists(userId, videos),
      queryLearningStats(userId, videos),
    ])

    return {
      continueWatching: videos.filter(
        (video) => video.completionPercent > 0 && !video.completed,
      ),
      recentVideos: videos.slice(0, 6),
      playlists,
      stats,
    }
  },
)

export const getVocabularyWords = cache(
  async (userId: string): Promise<VocabularyWord[]> => {
    const supabase = await createClient()
    const [rows, tagsByVocabulary] = await Promise.all([
      queryAllVocabularyRows(supabase, userId),
      queryVocabularyTagMap(supabase, userId),
    ])
    const translatedRows = await ensureVocabularyDefinitionTranslations(rows)
    return translatedRows.map((row) =>
      toVocabularyWord(row, tagsByVocabulary.get(row.id) ?? []),
    )
  },
)

export async function getVocabularyWordById(
  userId: string,
  vocabularyId: string,
): Promise<VocabularyWord | null> {
  const supabase = await createClient()
  const [result, tagsByVocabulary] = await Promise.all([
    supabase
      .from("vocabulary_words")
      .select("*")
      .eq("id", vocabularyId)
      .eq("user_id", userId)
      .maybeSingle(),
    queryVocabularyTagMap(supabase, userId, [vocabularyId]),
  ])
  if (result.error) {
    throw new Error(`读取生词明细失败：${result.error.message}`)
  }
  if (!result.data) {
    return null
  }
  const [row] = await ensureVocabularyDefinitionTranslations([result.data])
  return row ? toVocabularyWord(row, tagsByVocabulary.get(row.id) ?? []) : null
}

export async function getVocabularyWordsByIds(
  userId: string,
  vocabularyIds: string[],
): Promise<VocabularyWord[]> {
  if (vocabularyIds.length === 0) {
    return []
  }
  const supabase = await createClient()
  const [result, tagsByVocabulary] = await Promise.all([
    supabase
      .from("vocabulary_words")
      .select("*")
      .eq("user_id", userId)
      .in("id", vocabularyIds),
    queryVocabularyTagMap(supabase, userId, vocabularyIds),
  ])
  if (result.error) {
    throw new Error(`读取导入生词失败：${result.error.message}`)
  }
  const rows = await ensureVocabularyDefinitionTranslations(result.data ?? [])
  const wordsById = new Map(
    rows.map((row) => [
      row.id,
      toVocabularyWord(row, tagsByVocabulary.get(row.id) ?? []),
    ]),
  )
  return vocabularyIds.flatMap((id) => {
    const word = wordsById.get(id)
    return word ? [word] : []
  })
}

export const getDueReviewCards = cache(
  async (userId: string, limit = 100): Promise<VocabularyWord[]> => {
    const supabase = await createClient()
    const [result, tagsByVocabulary] = await Promise.all([
      supabase
        .from("vocabulary_words")
        .select("*")
        .eq("user_id", userId)
        .lte("due_at", new Date().toISOString())
        .order("due_at", { ascending: true })
        .limit(Math.min(100, Math.max(1, limit))),
      queryVocabularyTagMap(supabase, userId),
    ])
    if (result.error) {
      throw new Error(`读取复习队列失败：${result.error.message}`)
    }
    return (result.data ?? []).map((row) =>
      toVocabularyWord(row, tagsByVocabulary.get(row.id) ?? []),
    )
  },
)

export const getLearningPreferences = cache(
  async (userId: string): Promise<LearningPreferences> => {
    const supabase = await createClient()
    const result = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .maybeSingle()
    if (result.error) {
      throw new Error(`读取偏好设置失败：${result.error.message}`)
    }
    return normalizeLearningPreferences(result.data?.preferences)
  },
)

export const getVideoDetail = cache(
  async (userId: string, videoId: string): Promise<VideoDetail | null> => {
    const supabase = await createClient()
    const [videos, noteResult, transcriptResult, videoResult] = await Promise.all([
      getVideos(userId),
      supabase
        .from("notes")
        .select("*")
        .eq("user_id", userId)
        .eq("video_id", videoId)
        .order("timestamp_seconds", { ascending: true }),
      supabase
        .from("transcript_cues")
        .select("*")
        .eq("user_id", userId)
        .eq("video_id", videoId)
        .order("start_seconds", { ascending: true }),
      supabase
        .from("videos")
        .select("storage_path")
        .eq("user_id", userId)
        .eq("id", videoId)
        .maybeSingle(),
    ])

    const summary = videos.find((video) => video.id === videoId)
    if (!summary || videoResult.error || noteResult.error || transcriptResult.error) {
      if (videoResult.error || noteResult.error || transcriptResult.error) {
        throw new Error(
          `读取视频详情失败：${
            videoResult.error?.message ??
            noteResult.error?.message ??
            transcriptResult.error?.message
          }`,
        )
      }
      return null
    }

    const storagePath = videoResult.data?.storage_path ?? null
    const signedUrlResult =
      storagePath && summary.sourceType === "upload"
        ? await supabase.storage.from("videos").createSignedUrl(storagePath, 3600)
        : null
    if (signedUrlResult?.error) {
      throw new Error(`创建私有视频播放地址失败：${signedUrlResult.error.message}`)
    }

    return {
      ...summary,
      storagePath,
      signedPlaybackUrl: signedUrlResult?.data?.signedUrl ?? null,
      transcriptCues: (transcriptResult.data ?? []).map((cue) => ({
        id: cue.id,
        videoId: cue.video_id,
        startSeconds: Number(cue.start_seconds),
        endSeconds: Number(cue.end_seconds),
        text: cue.text,
        translation: cue.translation ?? "",
        translationLanguage: cue.translation_language,
      })),
      notes: (noteResult.data ?? []).map((note) => ({
        id: note.id,
        videoId: note.video_id,
        timestampSeconds: note.timestamp_seconds,
        content: note.content,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      })),
    }
  },
)
