"use server"

import { revalidatePath } from "next/cache"
import { normalizeLearningTagNames } from "../../lib/learning-tags"
import { scheduleReview } from "../../lib/sm2"
import {
  compareSubtitleCues,
  groupSubtitleCuesBySentence,
  parseSubtitleFile,
  subtitleCuesToVtt,
} from "../../lib/subtitles"
import { createClient } from "../../lib/supabase/server"
import {
  getVocabularyChineseDefinition,
  getVocabularyMeanings,
} from "../../lib/vocabulary-display"
import {
  isValidVocabularyTerm,
  maximumVocabularyTermLength,
  maximumVocabularyTermWords,
  normalizeVocabularyTerm,
} from "../../lib/vocabulary-term"
import { normalizeLearningPreferences } from "../../shared/learning-preferences"
import { isSubtitleTranslationLanguage } from "../../shared/translation-languages"
import {
  isVocabularyPackId,
  type VocabularyPackImportResult,
} from "../../shared/vocabulary-packs"
import type { Database, Json } from "../../types/database"
import type {
  ActionResult,
  AiModelConfigInput,
  DictionaryEntry,
  InspectedVideo,
  LearningPreferences,
  LearningTag,
  SubtitleTranslationLanguage,
  TranscriptCue,
  VideoImportOptions,
  VideoInspectionResult,
  VocabularyCleanupResult,
  VocabularyImportFailure,
  VocabularyImportItem,
  VocabularyImportResult,
  VocabularyReviewProgress,
  VocabularyWord,
} from "../../types/learning"
import { getOptionalAuthUser } from "../auth/auth-user"
import {
  generateAiVocabularyAnalysis,
  validateAiModelConnection,
  validateAiVocabularyAnalysisConsistency,
} from "./ai-vocabulary"
import { queryDictionary } from "./dictionary"
import { getVocabularyWordById, getVocabularyWordsByIds } from "./queries"
import { translateEnglishTexts } from "./translation"
import {
  type InspectedVideoResource,
  inspectVideoResource,
  normalizeVideoSource,
} from "./video-inspector"
import {
  hasCurrentVocabularyEnrichment,
  prepareVocabularyEnrichment,
  vocabularyEnrichmentVersion,
} from "./vocabulary-enrichment"
import {
  getVocabularyPack,
  getVocabularyPackBatch,
  isVocabularyPackOffset,
} from "./vocabulary-packs"

const maximumSubtitleTranslationsPerRequest = 24
const legacyLocalVideoSourcePrefix = "linguaflow-local:"
const vocabularyCleanupBatchSize = 6
const maximumVocabularyBatchItems = 500
const vocabularyImportInsertBatchSize = 200

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message
  }
  return "操作失败，请稍后重试。"
}

function isMissingSourceKeyColumn(error: unknown): boolean {
  const message = getErrorMessage(error).toLocaleLowerCase("en")
  return (
    message.includes("source_key") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  )
}

function isMissingVocabularyEnrichmentColumn(error: unknown): boolean {
  const message = getErrorMessage(error).toLocaleLowerCase("en")
  return (
    ["part_of_speech", "definition_translation", "ai_analysis"].some((column) =>
      message.includes(column),
    ) &&
    (message.includes("schema cache") || message.includes("does not exist"))
  )
}

function isMissingVocabularyTagsTable(error: unknown): boolean {
  const message = getErrorMessage(error).toLocaleLowerCase("en")
  return (
    message.includes("vocabulary_tags") &&
    (message.includes("schema cache") || message.includes("does not exist"))
  )
}

function normalizeText(value: FormDataEntryValue | null, maximum: number): string {
  return String(value ?? "")
    .trim()
    .slice(0, maximum)
}

function refreshLearningPages(videoId?: string) {
  revalidatePath("/workspace")
  revalidatePath("/workspace/library")
  revalidatePath("/workspace/playlists")
  revalidatePath("/workspace/stats")
  if (videoId) {
    revalidatePath(`/workspace/videos/${videoId}`)
  }
}

function refreshVocabularyPages(videoId?: string) {
  revalidatePath("/workspace/vocabulary")
  revalidatePath("/workspace/review")
  if (videoId) {
    revalidatePath(`/workspace/videos/${videoId}`)
  }
}

async function requireUser() {
  const user = await getOptionalAuthUser()
  if (!user) {
    throw new Error("登录状态已失效，请重新登录。")
  }
  return user
}

async function persistInspectedVideo(
  user: Awaited<ReturnType<typeof requireUser>>,
  video: InspectedVideo,
): Promise<{ videoId: string; existing: boolean }> {
  const supabase = await createClient()
  const existingVideo = await findExistingVideo(user.id, video)

  if (existingVideo) {
    let updateResult = await supabase
      .from("videos")
      .update({
        source_key: video.sourceKey,
        source_url: video.sourceUrl,
        thumbnail_url: video.thumbnailUrl,
        duration_seconds: Math.max(0, Math.floor(video.durationSeconds)),
        status: "ready",
      })
      .eq("id", existingVideo.id)
      .eq("user_id", user.id)
    if (updateResult.error && isMissingSourceKeyColumn(updateResult.error)) {
      updateResult = await supabase
        .from("videos")
        .update({
          source_url: video.sourceUrl,
          thumbnail_url: video.thumbnailUrl,
          duration_seconds: Math.max(0, Math.floor(video.durationSeconds)),
          status: "ready",
        })
        .eq("id", existingVideo.id)
        .eq("user_id", user.id)
    }
    if (updateResult.error) {
      throw updateResult.error
    }
    return { videoId: existingVideo.id, existing: true }
  }

  let result = await supabase
    .from("videos")
    .insert({
      user_id: user.id,
      title: video.title.slice(0, 200),
      description: `从 ${video.provider} 导入`,
      source_type: "link",
      source_url: video.sourceUrl,
      source_key: video.sourceKey,
      thumbnail_url: video.thumbnailUrl,
      duration_seconds: Math.max(0, Math.floor(video.durationSeconds)),
      status: "ready",
    })
    .select("id")
    .single()
  if (result.error && isMissingSourceKeyColumn(result.error)) {
    result = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        title: video.title.slice(0, 200),
        description: `从 ${video.provider} 导入`,
        source_type: "link",
        source_url: video.sourceUrl,
        thumbnail_url: video.thumbnailUrl,
        duration_seconds: Math.max(0, Math.floor(video.durationSeconds)),
        status: "ready",
      })
      .select("id")
      .single()
  }
  if (result.error) {
    throw result.error
  }
  return { videoId: result.data.id, existing: false }
}

interface ResolvedVideoInspection {
  resource: InspectedVideoResource
  inspection: VideoInspectionResult
}

interface ExistingVideoReference {
  id: string
  categoryId: string | null
}

async function findExistingVideo(
  userId: string,
  video: Pick<InspectedVideo, "sourceKey" | "sourceUrl">,
): Promise<ExistingVideoReference | null> {
  const supabase = await createClient()
  const sourceKeyResult = await supabase
    .from("videos")
    .select("id, category_id")
    .eq("user_id", userId)
    .eq("source_key", video.sourceKey)
    .maybeSingle()
  const sourceKeyUnavailable =
    sourceKeyResult.error && isMissingSourceKeyColumn(sourceKeyResult.error)
  if (sourceKeyResult.error && !sourceKeyUnavailable) {
    throw sourceKeyResult.error
  }
  if (sourceKeyResult.data) {
    return {
      id: sourceKeyResult.data.id,
      categoryId: sourceKeyResult.data.category_id,
    }
  }

  const sourceUrlResult = await supabase
    .from("videos")
    .select("id, category_id")
    .eq("user_id", userId)
    .eq("source_url", video.sourceUrl)
    .maybeSingle()
  if (sourceUrlResult.error) {
    throw sourceUrlResult.error
  }
  if (sourceUrlResult.data) {
    return {
      id: sourceUrlResult.data.id,
      categoryId: sourceUrlResult.data.category_id,
    }
  }

  const legacyResult = await supabase
    .from("videos")
    .select("id, category_id, source_url")
    .eq("user_id", userId)
    .eq("source_type", "link")
  if (legacyResult.error) {
    throw legacyResult.error
  }
  for (const legacyVideo of legacyResult.data) {
    if (!legacyVideo.source_url) {
      continue
    }
    try {
      if (normalizeVideoSource(legacyVideo.source_url).sourceKey === video.sourceKey) {
        return {
          id: legacyVideo.id,
          categoryId: legacyVideo.category_id,
        }
      }
    } catch {
      // Ignore legacy rows with invalid source URLs.
    }
  }
  return null
}

async function readExistingCategoryName(
  userId: string,
  categoryId: string | null,
): Promise<string | null> {
  if (!categoryId) {
    return null
  }
  const supabase = await createClient()
  const result = await supabase
    .from("categories")
    .select("name")
    .eq("id", categoryId)
    .eq("user_id", userId)
    .maybeSingle()
  if (result.error) {
    throw result.error
  }
  return result.data?.name ?? null
}

async function saveVideoParseCache(
  userId: string,
  resource: InspectedVideoResource,
  transcriptOverride?: {
    content: string
    language: string
    generated: boolean
  },
  storedTranscript?: {
    content: string
    cueCount: number
    language: string | null
    generated: boolean
  },
): Promise<string> {
  const supabase = await createClient()
  const rawTranscript = transcriptOverride?.content ?? resource.transcriptContent ?? ""
  const transcriptWithinLimit =
    rawTranscript.length > 0 &&
    new TextEncoder().encode(rawTranscript).byteLength <= 2_000_000
  const parsedCues = transcriptWithinLimit ? parseSubtitleFile(rawTranscript) : []
  const transcriptContent =
    parsedCues.length > 0 ? rawTranscript : (storedTranscript?.content ?? null)
  const detectedCaptions = transcriptContent
    ? {
        cueCount: parsedCues.length || storedTranscript?.cueCount || 0,
        language:
          transcriptOverride?.language ??
          resource.video.detectedCaptions?.language ??
          storedTranscript?.language ??
          "平台字幕",
        generated:
          transcriptOverride?.generated ??
          resource.video.detectedCaptions?.generated ??
          storedTranscript?.generated ??
          false,
      }
    : null
  const parsedAt = new Date().toISOString()
  const result = await supabase.from("video_parse_cache").upsert(
    {
      user_id: userId,
      source_key: resource.video.sourceKey,
      source_url: resource.video.sourceUrl,
      provider: resource.video.provider,
      title: resource.video.title.slice(0, 200),
      thumbnail_url: resource.video.thumbnailUrl,
      duration_seconds: Math.max(0, Math.floor(resource.video.durationSeconds)),
      transcript_content: transcriptContent,
      transcript_cue_count: detectedCaptions?.cueCount ?? 0,
      transcript_language: detectedCaptions?.language ?? null,
      transcript_generated: detectedCaptions?.generated ?? false,
      parsed_at: parsedAt,
    },
    { onConflict: "user_id,source_key" },
  )
  if (result.error) {
    throw result.error
  }
  return parsedAt
}

async function updateExistingVideoFromInspection(
  userId: string,
  videoId: string,
  resource: InspectedVideoResource,
) {
  const supabase = await createClient()
  let updateResult = await supabase
    .from("videos")
    .update({
      source_key: resource.video.sourceKey,
      source_url: resource.video.sourceUrl,
      thumbnail_url: resource.video.thumbnailUrl,
      duration_seconds: Math.max(0, Math.floor(resource.video.durationSeconds)),
      status: "ready",
    })
    .eq("id", videoId)
    .eq("user_id", userId)
  if (updateResult.error && isMissingSourceKeyColumn(updateResult.error)) {
    updateResult = await supabase
      .from("videos")
      .update({
        source_url: resource.video.sourceUrl,
        thumbnail_url: resource.video.thumbnailUrl,
        duration_seconds: Math.max(0, Math.floor(resource.video.durationSeconds)),
        status: "ready",
      })
      .eq("id", videoId)
      .eq("user_id", userId)
  }
  if (updateResult.error) {
    throw updateResult.error
  }
  if (resource.transcriptContent) {
    await syncVideoTranscript(userId, videoId, resource.transcriptContent)
  }
}

function getProviderFromSourceKey(sourceKey: string): InspectedVideo["provider"] {
  if (sourceKey.startsWith("youtube:")) {
    return "YouTube"
  }
  if (sourceKey.startsWith("bilibili:")) {
    return "Bilibili"
  }
  if (sourceKey.startsWith("vimeo:")) {
    return "Vimeo"
  }
  return /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/iu.test(sourceKey) ? "直链视频" : "网页视频"
}

async function loadExistingVideoResource(
  userId: string,
  videoId: string,
  sourceKey: string,
  sourceUrl: string,
): Promise<InspectedVideoResource | null> {
  const supabase = await createClient()
  const [videoResult, cuesResult] = await Promise.all([
    supabase
      .from("videos")
      .select("title, thumbnail_url, duration_seconds")
      .eq("id", videoId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("transcript_cues")
      .select("start_seconds, end_seconds, text, translation")
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .order("start_seconds"),
  ])
  if (videoResult.error || cuesResult.error) {
    throw videoResult.error ?? cuesResult.error
  }
  if (!videoResult.data) {
    return null
  }

  const transcriptContent = subtitleCuesToVtt(
    cuesResult.data.map((cue) => ({
      startSeconds: cue.start_seconds,
      endSeconds: cue.end_seconds,
      text: cue.text,
      translation: cue.translation ?? "",
    })),
  )
  const detectedCaptions =
    transcriptContent && cuesResult.data.length > 0
      ? {
          cueCount: cuesResult.data.length,
          language: "已存字幕",
          generated: false,
        }
      : null
  return {
    video: {
      sourceKey,
      sourceUrl,
      provider: getProviderFromSourceKey(sourceKey),
      title: videoResult.data.title,
      thumbnailUrl: videoResult.data.thumbnail_url,
      durationSeconds: videoResult.data.duration_seconds,
      detectedCaptions,
    },
    transcriptContent: transcriptContent || null,
  }
}

async function resolveVideoInspection(
  userId: string,
  sourceUrl: string,
  forceRefresh = false,
): Promise<ResolvedVideoInspection> {
  const normalizedSource = normalizeVideoSource(sourceUrl)
  const supabase = await createClient()
  const [cacheResult, existingVideo] = await Promise.all([
    supabase
      .from("video_parse_cache")
      .select(
        "source_key, source_url, provider, title, thumbnail_url, duration_seconds, transcript_content, transcript_cue_count, transcript_language, transcript_generated, parsed_at",
      )
      .eq("user_id", userId)
      .eq("source_key", normalizedSource.sourceKey)
      .maybeSingle(),
    findExistingVideo(userId, {
      sourceKey: normalizedSource.sourceKey,
      sourceUrl: normalizedSource.sourceUrl,
    }),
  ])
  if (cacheResult.error) {
    throw cacheResult.error
  }
  const existingVideoId = existingVideo?.id ?? null
  const existingCategoryName = await readExistingCategoryName(
    userId,
    existingVideo?.categoryId ?? null,
  )

  if (cacheResult.data && !forceRefresh) {
    const cached = cacheResult.data
    const detectedCaptions =
      cached.transcript_content && cached.transcript_cue_count > 0
        ? {
            cueCount: cached.transcript_cue_count,
            language: cached.transcript_language ?? "已存字幕",
            generated: cached.transcript_generated,
          }
        : null
    const video: InspectedVideo = {
      sourceKey: cached.source_key,
      sourceUrl: cached.source_url,
      provider: cached.provider,
      title: cached.title,
      thumbnailUrl: cached.thumbnail_url,
      durationSeconds: cached.duration_seconds,
      detectedCaptions,
    }
    return {
      resource: {
        video,
        transcriptContent: cached.transcript_content,
      },
      inspection: {
        ...video,
        cached: true,
        parsedAt: cached.parsed_at,
        existingVideoId,
        existingCategoryName,
      },
    }
  }

  if (existingVideoId && !forceRefresh) {
    const existingResource = await loadExistingVideoResource(
      userId,
      existingVideoId,
      normalizedSource.sourceKey,
      normalizedSource.sourceUrl,
    )
    if (existingResource) {
      const parsedAt = await saveVideoParseCache(userId, existingResource)
      return {
        resource: existingResource,
        inspection: {
          ...existingResource.video,
          cached: true,
          parsedAt,
          existingVideoId,
          existingCategoryName,
        },
      }
    }
  }

  const resource = await inspectVideoResource(normalizedSource.sourceUrl)
  const effectiveResource: InspectedVideoResource =
    !resource.transcriptContent && cacheResult.data?.transcript_content
      ? {
          video: {
            ...resource.video,
            detectedCaptions: {
              cueCount: cacheResult.data.transcript_cue_count,
              language: cacheResult.data.transcript_language ?? "已存字幕",
              generated: cacheResult.data.transcript_generated,
            },
          },
          transcriptContent: cacheResult.data.transcript_content,
        }
      : resource
  const parsedAt = await saveVideoParseCache(
    userId,
    effectiveResource,
    undefined,
    cacheResult.data?.transcript_content
      ? {
          content: cacheResult.data.transcript_content,
          cueCount: cacheResult.data.transcript_cue_count,
          language: cacheResult.data.transcript_language,
          generated: cacheResult.data.transcript_generated,
        }
      : undefined,
  )
  if (existingVideoId) {
    await updateExistingVideoFromInspection(userId, existingVideoId, effectiveResource)
  }
  return {
    resource: effectiveResource,
    inspection: {
      ...effectiveResource.video,
      cached: false,
      parsedAt,
      existingVideoId,
      existingCategoryName,
    },
  }
}

function normalizeImportOptions(options?: VideoImportOptions) {
  return {
    title: options?.title?.trim().slice(0, 200) ?? "",
    description: options?.description?.trim().slice(0, 5000) ?? "",
    categoryName: options?.categoryName?.trim().slice(0, 60) ?? "",
    tagNames: normalizeLearningTagNames(options?.tagNames ?? []),
    saveTagsAsDefault: options?.saveTagsAsDefault === true,
    transcriptContent: options?.transcriptContent ?? "",
  }
}

function getTranscriptError(content: string): string | null {
  if (!content) {
    return null
  }
  if (content.length > 2_000_000) {
    return "字幕文件不能超过 2MB。"
  }
  if (parseSubtitleFile(content).length === 0) {
    return "没有从字幕文件中解析出有效时间轴。"
  }
  return null
}

export async function inspectVideoLink(
  sourceUrl: string,
  options?: { forceRefresh?: boolean },
): Promise<ActionResult<VideoInspectionResult>> {
  try {
    const user = await requireUser()
    const { inspection } = await resolveVideoInspection(
      user.id,
      sourceUrl,
      options?.forceRefresh === true,
    )
    return {
      ok: true,
      message: inspection.metadataLimited
        ? inspection.detectedCaptions
          ? `平台限制了元数据读取，已使用备用信息并保存 ${inspection.detectedCaptions.cueCount} 条字幕。`
          : "平台限制了元数据读取，已使用备用信息继续解析；请确认标题并按需附加字幕。"
        : inspection.cached
          ? "已使用 Supabase 中保存的解析结果。"
          : inspection.detectedCaptions
            ? `已读取视频信息，并保存 ${inspection.detectedCaptions.cueCount} 条字幕。`
            : "已读取视频信息，未检测到公开字幕。",
      data: inspection,
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function inspectVideoLinks(sourceUrls: string[]): Promise<
  ActionResult<{
    videos: VideoInspectionResult[]
    failures: Array<{ sourceUrl: string; message: string }>
  }>
> {
  try {
    const user = await requireUser()
    const uniqueUrls = Array.from(
      new Set(sourceUrls.map((url) => url.trim()).filter(Boolean)),
    ).slice(0, 50)
    if (uniqueUrls.length === 0) {
      return { ok: false, message: "请先粘贴至少一个视频链接。" }
    }

    const results = await Promise.allSettled(
      uniqueUrls.map((sourceUrl) =>
        resolveVideoInspection(user.id, sourceUrl).then(({ inspection }) => inspection),
      ),
    )
    const videos: VideoInspectionResult[] = []
    const failures: Array<{ sourceUrl: string; message: string }> = []
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        videos.push(result.value)
      } else {
        failures.push({
          sourceUrl: uniqueUrls[index],
          message: getErrorMessage(result.reason),
        })
      }
    })

    const cachedCount = videos.filter((video) => video.cached).length
    return {
      ok: true,
      message:
        cachedCount > 0
          ? `已处理 ${videos.length} 个链接，其中 ${cachedCount} 个使用已存解析，${failures.length} 个失败。`
          : `已解析 ${videos.length} 个链接，${failures.length} 个失败。`,
      data: { videos, failures },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function importVideoFromUrl(
  sourceUrl: string,
  options?: VideoImportOptions,
): Promise<ActionResult<{ videoId: string }>> {
  try {
    const user = await requireUser()
    const normalized = normalizeImportOptions(options)
    const transcriptError = getTranscriptError(normalized.transcriptContent)
    if (transcriptError) {
      return { ok: false, message: transcriptError }
    }
    const { resource } = await resolveVideoInspection(user.id, sourceUrl)
    const video = resource.video
    const persistedVideo = await persistInspectedVideo(user, video)
    const videoId = persistedVideo.videoId
    const supabase = await createClient()
    const updates: {
      title?: string
      description?: string | null
      category_id?: string | null
    } = {}
    if (options?.title !== undefined) {
      updates.title = normalized.title || video.title.slice(0, 200)
    }
    if (options?.description !== undefined) {
      updates.description = normalized.description || null
    }
    if (options?.categoryName !== undefined) {
      updates.category_id = await findOrCreateCategory(user.id, normalized.categoryName)
    }
    if (Object.keys(updates).length > 0) {
      const updateResult = await supabase
        .from("videos")
        .update(updates)
        .eq("id", videoId)
        .eq("user_id", user.id)
      if (updateResult.error) {
        throw updateResult.error
      }
    }

    const defaultTagNames = await getDefaultTagNames(user.id)
    const effectiveTagNames = normalized.saveTagsAsDefault
      ? normalized.tagNames
      : mergeTagNames(defaultTagNames, normalized.tagNames)
    if (normalized.saveTagsAsDefault) {
      await syncDefaultTags(user.id, normalized.tagNames)
    }
    await attachTags(user.id, videoId, effectiveTagNames)
    const transcriptContent =
      normalized.transcriptContent || resource.transcriptContent || ""
    if (normalized.transcriptContent) {
      await saveVideoParseCache(
        user.id,
        { ...resource, transcriptContent: normalized.transcriptContent },
        {
          content: normalized.transcriptContent,
          language: "手动字幕",
          generated: false,
        },
      )
    }
    const cueCount = transcriptContent
      ? await syncVideoTranscript(user.id, videoId, transcriptContent)
      : 0
    refreshLearningPages(videoId)
    refreshVocabularyPages(videoId)
    return {
      ok: true,
      message:
        cueCount > 0
          ? persistedVideo.existing
            ? `已更新原视频，并同步 ${cueCount} 条字幕。`
            : `视频已加入资源库，并导入 ${cueCount} 条字幕。`
          : persistedVideo.existing
            ? "已更新原视频，没有创建重复资源。"
            : "视频已加入资源库。",
      data: { videoId },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function importVideoLinks(
  sourceUrls: string[],
): Promise<ActionResult<{ videoIds: string[] }>> {
  try {
    const user = await requireUser()
    const uniqueUrls = Array.from(
      new Set(sourceUrls.map((url) => url.trim()).filter(Boolean)),
    ).slice(0, 50)
    const inspectedResults = await Promise.allSettled(
      uniqueUrls.map((sourceUrl) =>
        resolveVideoInspection(user.id, sourceUrl).then(({ resource }) => resource),
      ),
    )
    const resources = inspectedResults.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    )
    if (resources.length === 0) {
      return { ok: false, message: "没有可导入的视频，请先处理失败链接。" }
    }

    const defaultTagNames = await getDefaultTagNames(user.id)
    const videoIds: string[] = []
    let cueCount = 0
    let updatedCount = 0
    for (const resource of resources) {
      const persistedVideo = await persistInspectedVideo(user, resource.video)
      const videoId = persistedVideo.videoId
      if (persistedVideo.existing) {
        updatedCount += 1
      }
      await attachTags(user.id, videoId, defaultTagNames)
      if (resource.transcriptContent) {
        cueCount += await syncVideoTranscript(
          user.id,
          videoId,
          resource.transcriptContent,
        )
      }
      videoIds.push(videoId)
    }
    refreshLearningPages()
    refreshVocabularyPages()
    return {
      ok: true,
      message:
        cueCount > 0
          ? `已处理 ${videoIds.length} 个视频，更新 ${updatedCount} 个已有资源，并同步 ${cueCount} 条字幕。`
          : `已处理 ${videoIds.length} 个视频，更新 ${updatedCount} 个已有资源。`,
      data: { videoIds },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

async function findOrCreateCategory(userId: string, name: string) {
  if (!name) {
    return null
  }
  const supabase = await createClient()
  const existingResult = await supabase
    .from("categories")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle()

  if (existingResult.error) {
    throw existingResult.error
  }
  if (existingResult.data) {
    return existingResult.data.id
  }

  const insertResult = await supabase
    .from("categories")
    .insert({ user_id: userId, name })
    .select("id")
    .single()
  if (insertResult.error) {
    throw insertResult.error
  }
  return insertResult.data.id
}

export async function setVideoCategory(input: {
  videoId: string
  categoryId: string | null
}): Promise<ActionResult<{ categoryId: string | null }>> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    let categoryId: string | null = null

    if (input.categoryId) {
      const categoryResult = await supabase
        .from("categories")
        .select("id")
        .eq("id", input.categoryId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (categoryResult.error) {
        throw categoryResult.error
      }
      if (!categoryResult.data) {
        return { ok: false, message: "分类不存在或已被删除。" }
      }
      categoryId = categoryResult.data.id
    }

    const updateResult = await supabase
      .from("videos")
      .update({ category_id: categoryId })
      .eq("id", input.videoId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()
    if (updateResult.error) {
      throw updateResult.error
    }
    if (!updateResult.data) {
      return { ok: false, message: "视频不存在或无权修改。" }
    }

    refreshLearningPages(input.videoId)
    return {
      ok: true,
      message: categoryId ? "视频分类已更新。" : "视频已设为未分类。",
      data: { categoryId },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function createVideoCategory(input: {
  videoId: string
  name: string
}): Promise<ActionResult<{ categoryId: string }>> {
  try {
    const user = await requireUser()
    const name = input.name.trim().slice(0, 60)
    if (!name) {
      return { ok: false, message: "请输入分类名称。" }
    }

    const supabase = await createClient()
    const videoResult = await supabase
      .from("videos")
      .select("id")
      .eq("id", input.videoId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (videoResult.error) {
      throw videoResult.error
    }
    if (!videoResult.data) {
      return { ok: false, message: "视频不存在或无权修改。" }
    }

    const categoryId = await findOrCreateCategory(user.id, name)
    if (!categoryId) {
      return { ok: false, message: "分类创建失败，请稍后重试。" }
    }
    const updateResult = await supabase
      .from("videos")
      .update({ category_id: categoryId })
      .eq("id", input.videoId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()
    if (updateResult.error) {
      throw updateResult.error
    }
    if (!updateResult.data) {
      return { ok: false, message: "视频已被删除，分类没有应用。" }
    }

    refreshLearningPages(input.videoId)
    revalidatePath("/workspace/import")
    return {
      ok: true,
      message: "分类已创建并应用到视频。",
      data: { categoryId },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function renameLearningCategory(input: {
  categoryId: string
  name: string
}): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const name = input.name.trim().slice(0, 60)
    if (!name) {
      return { ok: false, message: "请输入分类名称。" }
    }

    const supabase = await createClient()
    const categoriesResult = await supabase
      .from("categories")
      .select("id, name")
      .eq("user_id", user.id)
    if (categoriesResult.error) {
      throw categoriesResult.error
    }
    const category = categoriesResult.data.find((item) => item.id === input.categoryId)
    if (!category) {
      return { ok: false, message: "分类不存在或已被删除。" }
    }
    const normalizedName = name.toLocaleLowerCase("zh-CN")
    const duplicate = categoriesResult.data.some(
      (item) =>
        item.id !== input.categoryId &&
        item.name.toLocaleLowerCase("zh-CN") === normalizedName,
    )
    if (duplicate) {
      return { ok: false, message: "已存在同名分类。" }
    }

    const updateResult = await supabase
      .from("categories")
      .update({ name })
      .eq("id", input.categoryId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()
    if (updateResult.error) {
      throw updateResult.error
    }
    if (!updateResult.data) {
      return { ok: false, message: "分类不存在或无权修改。" }
    }

    refreshLearningPages()
    revalidatePath("/workspace/import")
    revalidatePath("/workspace/videos/[video-id]", "page")
    return { ok: true, message: "分类名称已更新。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteLearningCategory(
  categoryId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const deleteResult = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()
    if (deleteResult.error) {
      throw deleteResult.error
    }
    if (!deleteResult.data) {
      return { ok: false, message: "分类不存在或无权删除。" }
    }

    refreshLearningPages()
    revalidatePath("/workspace/import")
    revalidatePath("/workspace/videos/[video-id]", "page")
    return {
      ok: true,
      message: "分类已删除，原有关联视频已设为未分类。",
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

async function findOrCreateTags(userId: string, names: string[]) {
  const supabase = await createClient()
  const tags: Array<{ id: string; name: string }> = []
  for (const name of names) {
    const existingResult = await supabase
      .from("tags")
      .select("id, name")
      .eq("user_id", userId)
      .ilike("name", name)
      .maybeSingle()
    if (existingResult.error) {
      throw existingResult.error
    }

    if (existingResult.data) {
      tags.push(existingResult.data)
      continue
    }

    const insertResult = await supabase
      .from("tags")
      .insert({ user_id: userId, name })
      .select("id, name")
      .single()
    if (insertResult.error) {
      throw insertResult.error
    }
    tags.push(insertResult.data)
  }
  return tags
}

async function attachTags(userId: string, videoId: string, names: string[]) {
  if (names.length === 0) {
    return
  }
  const supabase = await createClient()
  const tags = await findOrCreateTags(userId, names)
  const relationResult = await supabase.from("video_tags").upsert(
    tags.map((tag) => ({
      user_id: userId,
      video_id: videoId,
      tag_id: tag.id,
    })),
    { onConflict: "video_id,tag_id", ignoreDuplicates: true },
  )
  if (relationResult.error) {
    throw relationResult.error
  }
}

async function ensureVocabularyTagStorage(userId: string) {
  const supabase = await createClient()
  const result = await supabase
    .from("vocabulary_tags")
    .select("tag_id")
    .eq("user_id", userId)
    .limit(1)
  if (result.error) {
    throw result.error
  }
}

async function attachVocabularyTags(
  userId: string,
  vocabularyIds: string[],
  names: string[],
): Promise<LearningTag[]> {
  if (vocabularyIds.length === 0 || names.length === 0) {
    return []
  }
  const supabase = await createClient()
  const tags = await findOrCreateTags(userId, names)
  const relations = vocabularyIds.flatMap((vocabularyId) =>
    tags.map((tag) => ({
      user_id: userId,
      vocabulary_id: vocabularyId,
      tag_id: tag.id,
    })),
  )
  for (let offset = 0; offset < relations.length; offset += 500) {
    const result = await supabase
      .from("vocabulary_tags")
      .upsert(relations.slice(offset, offset + 500), {
        onConflict: "vocabulary_id,tag_id",
        ignoreDuplicates: true,
      })
    if (result.error) {
      throw result.error
    }
  }
  return tags
    .map(
      (tag): LearningTag => ({
        id: tag.id,
        name: tag.name,
        isDefault: false,
      }),
    )
    .toSorted((left, right) => left.name.localeCompare(right.name, "zh-CN"))
}

async function getDefaultTagNames(userId: string): Promise<string[]> {
  const supabase = await createClient()
  const result = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle()
  if (result.error) {
    throw result.error
  }
  return normalizeLearningPreferences(result.data?.preferences).defaultVideoTags
}

async function syncDefaultTags(userId: string, names: string[]) {
  const supabase = await createClient()
  await findOrCreateTags(userId, names)
  const profileResult = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle()
  if (profileResult.error) {
    throw profileResult.error
  }
  const preferences = normalizeLearningPreferences(profileResult.data?.preferences)
  await saveProfilePreferences(userId, {
    ...preferences,
    defaultVideoTags: names,
  })
}

export async function renameLearningTag(input: {
  tagId: string
  name: string
}): Promise<ActionResult<{ tag: LearningTag; preferences: LearningPreferences }>> {
  try {
    const user = await requireUser()
    const tagNames = normalizeLearningTagNames([input.name])
    const [name] = tagNames
    if (!name) {
      return { ok: false, message: "请输入标签名称。" }
    }
    if (tagNames.length > 1) {
      return { ok: false, message: "一次只能重命名为一个标签。" }
    }

    const supabase = await createClient()
    const [tagsResult, profileResult] = await Promise.all([
      supabase.from("tags").select("id, name").eq("user_id", user.id),
      supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle(),
    ])
    if (tagsResult.error || profileResult.error) {
      throw tagsResult.error ?? profileResult.error
    }

    const tag = tagsResult.data.find((item) => item.id === input.tagId)
    if (!tag) {
      return { ok: false, message: "标签不存在或已被删除。" }
    }

    const normalizedName = name.toLocaleLowerCase("zh-CN")
    const duplicate = tagsResult.data.some(
      (item) =>
        item.id !== input.tagId &&
        item.name.toLocaleLowerCase("zh-CN") === normalizedName,
    )
    if (duplicate) {
      return { ok: false, message: "已存在同名标签。" }
    }

    const updateResult = await supabase
      .from("tags")
      .update({ name })
      .eq("id", input.tagId)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle()
    if (updateResult.error) {
      throw updateResult.error
    }
    if (!updateResult.data) {
      return { ok: false, message: "标签不存在或无权修改。" }
    }

    const preferences = normalizeLearningPreferences(profileResult.data?.preferences)
    const previousName = tag.name.toLocaleLowerCase("zh-CN")
    const nextDefaultVideoTags = normalizeLearningTagNames(
      preferences.defaultVideoTags.map((tagName) =>
        tagName.toLocaleLowerCase("zh-CN") === previousName ? name : tagName,
      ),
    )
    const nextPreferences = {
      ...preferences,
      defaultVideoTags: nextDefaultVideoTags,
    }
    if (
      nextDefaultVideoTags.join("\u0000") !==
      preferences.defaultVideoTags.join("\u0000")
    ) {
      await saveProfilePreferences(user.id, nextPreferences)
    }

    refreshLearningPages()
    refreshVocabularyPages()
    revalidatePath("/workspace/settings")
    revalidatePath("/workspace/import")
    revalidatePath("/workspace/videos/[video-id]", "page")
    return {
      ok: true,
      message: "标签名称已更新。",
      data: {
        tag: {
          id: input.tagId,
          name,
          isDefault: nextDefaultVideoTags.some(
            (tagName) => tagName.toLocaleLowerCase("zh-CN") === normalizedName,
          ),
        },
        preferences: nextPreferences,
      },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

async function saveProfilePreferences(
  userId: string,
  preferences: LearningPreferences,
) {
  const supabase = await createClient()
  const preferencesJson = normalizeLearningPreferences(preferences) as unknown as Json
  const updateResult = await supabase
    .from("profiles")
    .update({ preferences: preferencesJson })
    .eq("id", userId)
    .select("id")
    .maybeSingle()
  if (updateResult.error) {
    throw updateResult.error
  }
  if (updateResult.data) {
    return
  }

  const insertResult = await supabase.from("profiles").insert({
    id: userId,
    preferences: preferencesJson,
  })
  if (insertResult.error) {
    throw insertResult.error
  }
}

function mergeTagNames(...groups: string[][]): string[] {
  return normalizeLearningTagNames(groups.flat())
}

async function syncVideoTranscript(
  userId: string,
  videoId: string,
  content: string,
): Promise<number> {
  const incomingCues = parseSubtitleFile(content)
  const supabase = await createClient()
  const currentResult = await supabase
    .from("transcript_cues")
    .select("id, start_seconds, end_seconds, text, translation, translation_language")
    .eq("video_id", videoId)
    .eq("user_id", userId)
    .order("start_seconds")
  if (currentResult.error) {
    throw currentResult.error
  }

  const differences = compareSubtitleCues(
    currentResult.data.map((cue) => ({
      id: cue.id,
      startSeconds: Number(cue.start_seconds),
      endSeconds: Number(cue.end_seconds),
      text: cue.text,
      translation: cue.translation ?? "",
    })),
    incomingCues,
  )
  const deletedIds = differences.flatMap((difference) =>
    difference.status !== "unchanged" && difference.original
      ? [difference.original.id]
      : [],
  )
  const insertedCues = differences.flatMap((difference) =>
    difference.status !== "unchanged" && difference.incoming
      ? [difference.incoming]
      : [],
  )

  for (let index = 0; index < deletedIds.length; index += 500) {
    const deleteResult = await supabase
      .from("transcript_cues")
      .delete()
      .eq("video_id", videoId)
      .eq("user_id", userId)
      .in("id", deletedIds.slice(index, index + 500))
    if (deleteResult.error) {
      throw deleteResult.error
    }
  }

  for (let index = 0; index < insertedCues.length; index += 500) {
    const insertResult = await supabase.from("transcript_cues").insert(
      insertedCues.slice(index, index + 500).map((cue) => ({
        user_id: userId,
        video_id: videoId,
        start_seconds: cue.startSeconds,
        end_seconds: cue.endSeconds,
        text: cue.text,
        translation: cue.translation || null,
        translation_language: cue.translation ? "imported" : null,
      })),
    )
    if (insertResult.error) {
      throw insertResult.error
    }
  }
  return incomingCues.length
}

export async function registerLocalVideo(input: {
  localFileKey: string
  title: string
  description: string
  categoryName: string
  tagNames: string[]
  saveTagsAsDefault: boolean
  transcriptContent: string
  durationSeconds: number
}): Promise<ActionResult<{ videoId: string }>> {
  try {
    const user = await requireUser()
    const localFileKey = input.localFileKey.trim()
    const title = input.title.trim().slice(0, 200)
    const description = input.description.trim().slice(0, 5000)
    const categoryName = input.categoryName.trim().slice(0, 60)
    const tags = normalizeLearningTagNames(input.tagNames)
    const transcriptContent = input.transcriptContent

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
        localFileKey,
      )
    ) {
      return { ok: false, message: "本地视频资源键无效，请重新选择文件。" }
    }
    if (!title) {
      return { ok: false, message: "请输入视频标题。" }
    }
    const transcriptError = getTranscriptError(transcriptContent)
    if (transcriptError) {
      return { ok: false, message: transcriptError }
    }

    const supabase = await createClient()
    const categoryId = await findOrCreateCategory(user.id, categoryName)
    let videoResult = await supabase
      .from("videos")
      .insert({
        user_id: user.id,
        category_id: categoryId,
        title,
        description: description || null,
        source_type: "local",
        source_key: localFileKey,
        duration_seconds: Math.max(0, Math.floor(input.durationSeconds)),
        status: "ready",
      })
      .select("id")
      .single()
    if (videoResult.error && isMissingSourceKeyColumn(videoResult.error)) {
      videoResult = await supabase
        .from("videos")
        .insert({
          user_id: user.id,
          category_id: categoryId,
          title,
          description: description || null,
          source_type: "link",
          source_url: `${legacyLocalVideoSourcePrefix}${localFileKey}`,
          duration_seconds: Math.max(0, Math.floor(input.durationSeconds)),
          status: "ready",
        })
        .select("id")
        .single()
    }
    if (videoResult.error) {
      throw videoResult.error
    }

    try {
      const defaultTagNames = await getDefaultTagNames(user.id)
      const effectiveTagNames = input.saveTagsAsDefault
        ? tags
        : mergeTagNames(defaultTagNames, tags)
      if (input.saveTagsAsDefault) {
        await syncDefaultTags(user.id, tags)
      }
      await attachTags(user.id, videoResult.data.id, effectiveTagNames)
      const cueCount = transcriptContent
        ? await syncVideoTranscript(user.id, videoResult.data.id, transcriptContent)
        : 0
      refreshLearningPages(videoResult.data.id)
      refreshVocabularyPages(videoResult.data.id)
      return {
        ok: true,
        message:
          cueCount > 0
            ? `本地视频已关联，并导入 ${cueCount} 条字幕。`
            : "本地视频已关联到资源库。",
        data: { videoId: videoResult.data.id },
      }
    } catch (error) {
      await supabase
        .from("videos")
        .delete()
        .eq("id", videoResult.data.id)
        .eq("user_id", user.id)
      throw error
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function saveVideoProgress(input: {
  videoId: string
  positionSeconds: number
  durationSeconds: number
  watchedSeconds: number
}): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const positionSeconds = Math.max(0, Math.floor(input.positionSeconds))
    const durationSeconds = Math.max(0, Math.floor(input.durationSeconds))
    const completionPercent =
      durationSeconds > 0 ? Math.min(100, (positionSeconds / durationSeconds) * 100) : 0
    const completed = completionPercent >= 95
    const supabase = await createClient()
    const progressResult = await supabase.from("video_progress").upsert(
      {
        user_id: user.id,
        video_id: input.videoId,
        position_seconds: positionSeconds,
        completion_percent: completionPercent,
        completed,
        last_watched_at: new Date().toISOString(),
      },
      { onConflict: "video_id,user_id" },
    )
    if (progressResult.error) {
      throw progressResult.error
    }

    const watchedSeconds = Math.min(3600, Math.max(0, Math.floor(input.watchedSeconds)))
    if (watchedSeconds >= 5) {
      const endedAt = new Date()
      const sessionResult = await supabase.from("study_sessions").insert({
        user_id: user.id,
        video_id: input.videoId,
        started_at: new Date(endedAt.getTime() - watchedSeconds * 1000).toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: watchedSeconds,
      })
      if (sessionResult.error) {
        throw sessionResult.error
      }
    }

    refreshLearningPages(input.videoId)
    return { ok: true, message: "进度已保存。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function createVideoNote(input: {
  videoId: string
  timestampSeconds: number
  content: string
}): Promise<ActionResult<{ noteId: string }>> {
  try {
    const user = await requireUser()
    const content = input.content.trim().slice(0, 4000)
    if (!content) {
      return { ok: false, message: "笔记内容不能为空。" }
    }

    const supabase = await createClient()
    const result = await supabase
      .from("notes")
      .insert({
        user_id: user.id,
        video_id: input.videoId,
        timestamp_seconds: Math.max(0, Math.floor(input.timestampSeconds)),
        content,
      })
      .select("id")
      .single()
    if (result.error) {
      throw result.error
    }
    refreshLearningPages(input.videoId)
    return {
      ok: true,
      message: "笔记已添加。",
      data: { noteId: result.data.id },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function updateVideoNote(input: {
  noteId: string
  videoId: string
  content: string
}): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const content = input.content.trim().slice(0, 4000)
    if (!content) {
      return { ok: false, message: "笔记内容不能为空。" }
    }
    const supabase = await createClient()
    const result = await supabase
      .from("notes")
      .update({ content })
      .eq("id", input.noteId)
      .eq("user_id", user.id)
    if (result.error) {
      throw result.error
    }
    refreshLearningPages(input.videoId)
    return { ok: true, message: "笔记已更新。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteVideoNote(input: {
  noteId: string
  videoId: string
}): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const result = await supabase
      .from("notes")
      .delete()
      .eq("id", input.noteId)
      .eq("user_id", user.id)
    if (result.error) {
      throw result.error
    }
    refreshLearningPages(input.videoId)
    return { ok: true, message: "笔记已删除。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function readVideoTranscript(
  videoId: string,
): Promise<ActionResult<{ content: string; cueCount: number }>> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const [videoResult, cuesResult] = await Promise.all([
      supabase
        .from("videos")
        .select("id")
        .eq("id", videoId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("transcript_cues")
        .select("start_seconds, end_seconds, text, translation")
        .eq("video_id", videoId)
        .eq("user_id", user.id)
        .order("start_seconds"),
    ])
    if (videoResult.error || cuesResult.error) {
      throw videoResult.error ?? cuesResult.error
    }
    if (!videoResult.data) {
      return { ok: false, message: "视频不存在或无权读取字幕。" }
    }

    const content = subtitleCuesToVtt(
      cuesResult.data.map((cue) => ({
        startSeconds: cue.start_seconds,
        endSeconds: cue.end_seconds,
        text: cue.text,
        translation: cue.translation ?? "",
      })),
    )
    return {
      ok: true,
      message: `已读取 ${cuesResult.data.length} 条字幕。`,
      data: { content, cueCount: cuesResult.data.length },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function importVideoTranscript(input: {
  videoId: string
  content: string
}): Promise<ActionResult<{ cueCount: number; cues: TranscriptCue[] }>> {
  try {
    const user = await requireUser()
    if (!input.content.trim()) {
      return { ok: false, message: "字幕内容不能为空。" }
    }
    const transcriptError = getTranscriptError(input.content)
    if (transcriptError) {
      return { ok: false, message: transcriptError }
    }

    const supabase = await createClient()
    const videoResult = await supabase
      .from("videos")
      .select("id, status")
      .eq("id", input.videoId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (videoResult.error) {
      throw videoResult.error
    }
    if (!videoResult.data) {
      return { ok: false, message: "视频不存在或无权修改。" }
    }

    const cueCount = await syncVideoTranscript(user.id, input.videoId, input.content)
    if (videoResult.data.status !== "ready") {
      const statusResult = await supabase
        .from("videos")
        .update({ status: "ready" })
        .eq("id", input.videoId)
        .eq("user_id", user.id)
      if (statusResult.error) {
        throw statusResult.error
      }
    }
    const cuesResult = await supabase
      .from("transcript_cues")
      .select(
        "id, video_id, start_seconds, end_seconds, text, translation, translation_language",
      )
      .eq("video_id", input.videoId)
      .eq("user_id", user.id)
      .order("start_seconds")
    if (cuesResult.error) {
      throw cuesResult.error
    }
    const cues = cuesResult.data.map((cue) => ({
      id: cue.id,
      videoId: cue.video_id,
      startSeconds: cue.start_seconds,
      endSeconds: cue.end_seconds,
      text: cue.text,
      translation: cue.translation ?? "",
      translationLanguage: cue.translation_language,
    }))

    refreshLearningPages(input.videoId)
    refreshVocabularyPages(input.videoId)
    return {
      ok: true,
      message: `已导入 ${cueCount} 条字幕。`,
      data: { cueCount, cues },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function translateVideoTranscript(input: {
  videoId: string
  targetLanguage: SubtitleTranslationLanguage
  cueIds: string[]
}): Promise<
  ActionResult<{
    translations: Array<{
      id: string
      translation: string
      translationLanguage: SubtitleTranslationLanguage
    }>
  }>
> {
  try {
    const user = await requireUser()
    if (!isSubtitleTranslationLanguage(input.targetLanguage)) {
      return { ok: false, message: "不支持所选的字幕翻译语言。" }
    }
    const cueIds = Array.from(
      new Set(
        input.cueIds.filter(
          (id) =>
            typeof id === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
              id,
            ),
        ),
      ),
    ).slice(0, maximumSubtitleTranslationsPerRequest)
    if (cueIds.length === 0) {
      return { ok: false, message: "没有需要翻译的可见字幕。" }
    }

    const supabase = await createClient()
    const cuesResult = await supabase
      .from("transcript_cues")
      .select("id, start_seconds, end_seconds, text, translation, translation_language")
      .eq("video_id", input.videoId)
      .eq("user_id", user.id)
      .in("id", cueIds)
      .order("start_seconds")
    if (cuesResult.error) {
      throw cuesResult.error
    }
    if (cuesResult.data.length === 0) {
      return { ok: false, message: "字幕不存在或无权翻译。" }
    }

    const sentenceGroups = groupSubtitleCuesBySentence(
      cuesResult.data.map((cue) => ({
        id: cue.id,
        startSeconds: cue.start_seconds,
        endSeconds: cue.end_seconds,
        text: cue.text,
      })),
    )
    const cuesById = new Map(cuesResult.data.map((cue) => [cue.id, cue]))
    const cachedGroups = sentenceGroups.filter((group) =>
      group.cues.every(
        (cue) => cuesById.get(cue.id)?.translation_language === input.targetLanguage,
      ),
    )
    const groupsToTranslate = sentenceGroups.filter(
      (group) =>
        !group.cues.every(
          (cue) => cuesById.get(cue.id)?.translation_language === input.targetLanguage,
        ),
    )
    const cachedCues = cachedGroups.flatMap((group) =>
      group.cues.flatMap((cue) => {
        const storedCue = cuesById.get(cue.id)
        return storedCue ? [storedCue] : []
      }),
    )
    const translatedTexts = await translateEnglishTexts(
      groupsToTranslate.map((group) => group.text),
      input.targetLanguage,
    )
    const translatedCues = groupsToTranslate.flatMap((group, index) => {
      const translation = translatedTexts[index]?.trim()
      if (!translation) {
        return []
      }
      return group.cues.flatMap((cue, cueIndex) => {
        const storedCue = cuesById.get(cue.id)
        return storedCue
          ? [
              {
                ...storedCue,
                translation: cueIndex === 0 ? translation : "",
              },
            ]
          : []
      })
    })
    if (translatedCues.length === 0 && cachedCues.length === 0) {
      return { ok: false, message: "字幕翻译服务暂时不可用，请稍后重试。" }
    }

    if (translatedCues.length > 0) {
      const saveResult = await supabase.from("transcript_cues").upsert(
        translatedCues.map((cue) => ({
          id: cue.id,
          user_id: user.id,
          video_id: input.videoId,
          start_seconds: cue.start_seconds,
          end_seconds: cue.end_seconds,
          text: cue.text,
          translation: cue.translation,
          translation_language: input.targetLanguage,
        })),
        { onConflict: "id" },
      )
      if (saveResult.error) {
        throw saveResult.error
      }
    }

    revalidatePath(`/workspace/videos/${input.videoId}`)
    const allTranslations = [...cachedCues, ...translatedCues]
    return {
      ok: true,
      message: `已按完整句子准备 ${allTranslations.length} 条字幕译文。`,
      data: {
        translations: allTranslations.map((cue) => ({
          id: cue.id,
          translation: cue.translation ?? "",
          translationLanguage: input.targetLanguage,
        })),
      },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function lookupDictionary(
  word: string,
): Promise<ActionResult<DictionaryEntry>> {
  try {
    await requireUser()
    const entry = await queryDictionary(word)
    return { ok: true, message: "已找到词典释义。", data: entry }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function addVocabularyWord(input: {
  entry: DictionaryEntry
  videoId: string
  sourceTitle: string
  timestampSeconds: number
  sourceSentence: string
  translation: string
}): Promise<ActionResult<{ vocabularyId: string }>> {
  try {
    const user = await requireUser()
    const word = normalizeVocabularyTerm(input.entry.word)
    if (!isValidVocabularyTerm(word)) {
      return {
        ok: false,
        message: "请输入由英文单词、空格、连字符或撇号组成的有效词条。",
      }
    }
    const entry = await queryDictionary(word)
    const enrichment = prepareVocabularyEnrichment(entry, input.sourceSentence)

    const supabase = await createClient()
    const existingResult = await supabase
      .from("vocabulary_words")
      .select("id")
      .eq("user_id", user.id)
      .eq("video_id", input.videoId)
      .ilike("word", word)
      .maybeSingle()
    if (existingResult.error) {
      throw existingResult.error
    }
    if (existingResult.data) {
      return {
        ok: true,
        message: "这个词条已在生词本中。",
        data: { vocabularyId: existingResult.data.id },
      }
    }

    let result = await supabase
      .from("vocabulary_words")
      .insert({
        user_id: user.id,
        video_id: input.videoId,
        word: enrichment.word,
        phonetic: enrichment.phonetic || null,
        phonetic_uk: enrichment.phoneticUk || null,
        phonetic_us: enrichment.phoneticUs || null,
        part_of_speech: enrichment.partOfSpeech || null,
        definition: enrichment.definition,
        definition_translation: enrichment.definitionTranslation || null,
        examples: enrichment.examples as unknown as Json,
        example_translations: enrichment.exampleTranslations as unknown as Json,
        common_phrases: enrichment.commonPhrases as unknown as Json,
        word_analysis: enrichment.wordAnalysis as unknown as Json,
        dictionary_sources: enrichment.dictionarySources as unknown as Json,
        source_title: input.sourceTitle.trim().slice(0, 200) || "未命名视频",
        source_timestamp_seconds: Math.max(0, Math.floor(input.timestampSeconds)),
        source_sentence: input.sourceSentence.trim().slice(0, 4000) || null,
        translation: input.translation.trim().slice(0, 4000) || null,
      })
      .select("id")
      .single()
    if (result.error && "code" in result.error && result.error.code === "PGRST204") {
      result = await supabase
        .from("vocabulary_words")
        .insert({
          user_id: user.id,
          video_id: input.videoId,
          word: enrichment.word,
          phonetic: enrichment.phonetic || null,
          definition: enrichment.definition,
          source_title: input.sourceTitle.trim().slice(0, 200) || "未命名视频",
          source_timestamp_seconds: Math.max(0, Math.floor(input.timestampSeconds)),
          source_sentence: input.sourceSentence.trim().slice(0, 4000) || null,
          translation: input.translation.trim().slice(0, 4000) || null,
        })
        .select("id")
        .single()
    }
    if (result.error) {
      throw result.error
    }
    revalidatePath("/workspace/vocabulary")
    revalidatePath("/workspace/review")
    return {
      ok: true,
      message: "已加入生词本。",
      data: { vocabularyId: result.data.id },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

type VocabularyWordInsert = Database["public"]["Tables"]["vocabulary_words"]["Insert"]

interface PreparedVocabularyImport {
  row: VocabularyWordInsert
}

export async function importVocabularyWords(input: {
  items: VocabularyImportItem[]
  source: "manual" | "batch"
  tagNames?: string[]
}): Promise<ActionResult<VocabularyImportResult>> {
  try {
    const user = await requireUser()
    const source = input.source === "batch" ? "batch" : "manual"
    const tagNames = normalizeLearningTagNames(input.tagNames ?? [])
    const normalizedItems: VocabularyImportItem[] = []
    const failures: VocabularyImportFailure[] = []
    const seen = new Set<string>()

    const inputItems = Array.isArray(input.items) ? input.items : []
    for (const item of inputItems) {
      const normalized = normalizeVocabularyImportItem(item)
      if (!normalized) {
        failures.push({
          word:
            readVocabularyImportValue(item, "word", maximumVocabularyTermLength + 1) ||
            "未命名词条",
          message: `仅支持最多 ${maximumVocabularyTermWords} 个英文单词组成的词条，可包含连字符或撇号。`,
        })
        continue
      }
      if (seen.has(normalized.word)) {
        continue
      }
      seen.add(normalized.word)
      normalizedItems.push(normalized)
    }
    if (normalizedItems.length === 0) {
      return {
        ok: false,
        message: failures[0]?.message ?? "请至少提供一个有效的英文词条。",
      }
    }

    const supabase = await createClient()
    if (tagNames.length > 0) {
      await ensureVocabularyTagStorage(user.id)
    }
    const existingWords = new Set<string>()
    for (
      let offset = 0;
      offset < normalizedItems.length;
      offset += maximumVocabularyBatchItems
    ) {
      const existingResult = await supabase
        .from("vocabulary_words")
        .select("word")
        .eq("user_id", user.id)
        .in(
          "word",
          normalizedItems
            .slice(offset, offset + maximumVocabularyBatchItems)
            .map((item) => item.word),
        )
      if (existingResult.error) {
        throw existingResult.error
      }
      for (const item of existingResult.data ?? []) {
        existingWords.add(item.word.toLocaleLowerCase("en"))
      }
    }

    const skipped = normalizedItems
      .filter((item) => existingWords.has(item.word))
      .map((item) => item.word)
    const candidates = normalizedItems.filter((item) => !existingWords.has(item.word))

    const prepared = await mapWithConcurrency(
      candidates,
      4,
      async (item): Promise<PreparedVocabularyImport | VocabularyImportFailure> => {
        try {
          return {
            row: await createImportedVocabularyRow(
              user.id,
              item,
              source === "batch" ? "批量导入" : "手动添加",
            ),
          }
        } catch (error) {
          return {
            word: item.word,
            message: getErrorMessage(error),
          }
        }
      },
    )
    const rows: PreparedVocabularyImport[] = []
    for (const result of prepared) {
      if ("row" in result) {
        rows.push(result)
      } else {
        failures.push(result)
      }
    }

    if (rows.length === 0) {
      const result: VocabularyImportResult = {
        words: [],
        skipped,
        failures,
      }
      return {
        ok: skipped.length > 0 && failures.length === 0,
        message:
          skipped.length > 0 && failures.length === 0
            ? "这些词条已在生词本中。"
            : (failures[0]?.message ?? "没有可导入的词条。"),
        data: result,
      }
    }

    const insertedIds: string[] = []
    for (
      let offset = 0;
      offset < rows.length;
      offset += vocabularyImportInsertBatchSize
    ) {
      const insertResult = await supabase
        .from("vocabulary_words")
        .insert(
          rows
            .slice(offset, offset + vocabularyImportInsertBatchSize)
            .map((item) => item.row),
        )
        .select("id")
      if (insertResult.error) {
        throw insertResult.error
      }
      insertedIds.push(...(insertResult.data ?? []).map((item) => item.id))
    }
    if (tagNames.length > 0) {
      try {
        await attachVocabularyTags(user.id, insertedIds, tagNames)
      } catch (error) {
        for (
          let offset = 0;
          offset < insertedIds.length;
          offset += maximumVocabularyBatchItems
        ) {
          await supabase
            .from("vocabulary_words")
            .delete()
            .eq("user_id", user.id)
            .in("id", insertedIds.slice(offset, offset + maximumVocabularyBatchItems))
        }
        throw error
      }
    }
    const words = await getVocabularyWordsByIds(user.id, insertedIds)
    refreshVocabularyPages()

    const details = [
      `已导入 ${words.length} 个词条`,
      skipped.length > 0 ? `${skipped.length} 个重复项已跳过` : "",
      failures.length > 0 ? `${failures.length} 个项目未导入` : "",
    ].filter(Boolean)
    return {
      ok: true,
      message: `${details.join("，")}。`,
      data: { words, skipped, failures },
    }
  } catch (error) {
    if (isMissingVocabularyTagsTable(error)) {
      return {
        ok: false,
        message: "生词标签尚未启用，请先在 Supabase 中执行 updated.sql。",
      }
    }
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function importVocabularyPackBatch(input: {
  packId: unknown
  offset: number
  sourceTitle?: string
}): Promise<ActionResult<VocabularyPackImportResult>> {
  try {
    const user = await requireUser()
    if (!isVocabularyPackId(input.packId)) {
      return { ok: false, message: "请选择有效的内置词库。" }
    }
    if (!isVocabularyPackOffset(input.offset)) {
      return { ok: false, message: "内置词库导入进度无效，请重新开始导入。" }
    }
    const offset = input.offset
    const sourceTitle =
      input.sourceTitle?.trim().replace(/\s+/gu, " ").slice(0, 200) ?? ""
    const pack = getVocabularyPack(input.packId)
    const packBatch = getVocabularyPackBatch(pack.id, offset)
    if (packBatch.entries.length === 0) {
      return {
        ok: true,
        message: `${pack.label} 已全部处理。`,
        data: {
          packId: pack.id,
          words: [],
          processedCount: 0,
          insertedCount: 0,
          existingCount: 0,
          nextOffset: null,
          totalCount: packBatch.totalCount,
        },
      }
    }

    const batch = packBatch.entries
    const supabase = await createClient()
    await ensureVocabularyTagStorage(user.id)
    const [existingResult, profileResult, dailyCountResult] = await Promise.all([
      supabase
        .from("vocabulary_words")
        .select("id, word")
        .eq("user_id", user.id)
        .in(
          "word",
          batch.map((entry) => entry.word),
        ),
      supabase.from("profiles").select("preferences").eq("id", user.id).maybeSingle(),
      supabase
        .from("vocabulary_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", startOfToday().toISOString()),
    ])
    if (existingResult.error || profileResult.error || dailyCountResult.error) {
      throw existingResult.error ?? profileResult.error ?? dailyCountResult.error
    }

    const existingWords = new Set(
      (existingResult.data ?? []).map((item) => item.word.toLocaleLowerCase("en")),
    )
    const newEntries = batch.filter((entry) => !existingWords.has(entry.word))
    const preferences = normalizeLearningPreferences(profileResult.data?.preferences)
    const scheduledBefore = dailyCountResult.count ?? 0
    const now = Date.now()
    const rows: VocabularyWordInsert[] = newEntries.map((entry, index) => {
      const reviewDayOffset = Math.floor(
        (scheduledBefore + index) / preferences.dailyNewLimit,
      )
      const dueAt = new Date(now + reviewDayOffset * 24 * 60 * 60 * 1000)
      const examLabels = [
        entry.cefrLevel ? `CEFR ${entry.cefrLevel}` : "",
        entry.cefrLevel === "B2" ? "IELTS 6" : "",
      ].filter(Boolean)
      return {
        user_id: user.id,
        video_id: null,
        word: entry.word,
        phonetic: entry.phonetic || null,
        phonetic_uk: entry.phonetic || null,
        phonetic_us: entry.phonetic || null,
        part_of_speech: entry.partOfSpeech || null,
        definition: entry.definition,
        definition_translation: entry.definitionTranslation || null,
        examples: entry.example ? [entry.example] : [],
        example_translations: entry.example
          ? [{ text: entry.example, translation: entry.exampleTranslation }]
          : [],
        common_phrases: [],
        word_analysis: {
          etymology: "",
          etymologyTranslation: "",
          examLabels,
          inflections: [],
          parts: [],
          relatedWords: [],
          vocabularyEnrichmentVersion,
        },
        dictionary_sources: [],
        ai_analysis: {},
        source_title: sourceTitle || `内置词库 · ${pack.label}`,
        source_timestamp_seconds: 0,
        source_sentence: entry.example || null,
        translation: entry.exampleTranslation || null,
        due_at: dueAt.toISOString(),
      }
    })

    let insertedIds: string[] = []
    if (rows.length > 0) {
      const insertResult = await supabase
        .from("vocabulary_words")
        .insert(rows)
        .select("id")
      if (insertResult.error) {
        throw insertResult.error
      }
      insertedIds = (insertResult.data ?? []).map((item) => item.id)
    }

    const existingIds = (existingResult.data ?? []).map((item) => item.id)
    const affectedIds = [...existingIds, ...insertedIds]
    try {
      await attachVocabularyTags(user.id, existingIds, pack.tagNames)
      await attachVocabularyTags(user.id, insertedIds, pack.tagNames)
    } catch (error) {
      if (insertedIds.length > 0) {
        await supabase
          .from("vocabulary_words")
          .delete()
          .eq("user_id", user.id)
          .in("id", insertedIds)
      }
      throw error
    }

    const nextOffsetValue = offset + batch.length
    const words = await getVocabularyWordsByIds(user.id, affectedIds)
    refreshVocabularyPages()
    return {
      ok: true,
      message:
        packBatch.nextOffset === null
          ? `${pack.label} 已全部导入。`
          : `${pack.label} 已处理 ${nextOffsetValue}/${packBatch.totalCount}。`,
      data: {
        packId: pack.id,
        words,
        processedCount: batch.length,
        insertedCount: insertedIds.length,
        existingCount: existingIds.length,
        nextOffset: packBatch.nextOffset,
        totalCount: packBatch.totalCount,
      },
    }
  } catch (error) {
    if (isMissingVocabularyTagsTable(error)) {
      return {
        ok: false,
        message: "生词标签尚未启用，请先在 Supabase 中执行 updated.sql。",
      }
    }
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function cleanVocabularyData(input?: {
  skipIds?: string[]
}): Promise<ActionResult<VocabularyCleanupResult>> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const rowsResult = await supabase
      .from("vocabulary_words")
      .select("id, word, source_sentence, word_analysis")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
    if (rowsResult.error) {
      throw rowsResult.error
    }

    const skippedIds = new Set(
      (input?.skipIds ?? []).filter((id) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
          id,
        ),
      ),
    )
    const candidates = (rowsResult.data ?? []).filter(
      (row) =>
        !skippedIds.has(row.id) && !hasCurrentVocabularyEnrichment(row.word_analysis),
    )
    const batch = candidates.slice(0, vocabularyCleanupBatchSize)
    const results = await mapWithConcurrency(batch, 2, async (row) => {
      try {
        const entry = await queryDictionary(row.word)
        const enrichment = prepareVocabularyEnrichment(entry, row.source_sentence ?? "")
        const existingWordAnalysis =
          row.word_analysis &&
          typeof row.word_analysis === "object" &&
          !Array.isArray(row.word_analysis)
            ? row.word_analysis
            : {}
        const wordAnalysis = {
          ...existingWordAnalysis,
          ...enrichment.wordAnalysis,
          etymology:
            enrichment.wordAnalysis.etymology || existingWordAnalysis.etymology || "",
          etymologyTranslation:
            enrichment.wordAnalysis.etymologyTranslation ||
            existingWordAnalysis.etymologyTranslation ||
            "",
          examLabels:
            enrichment.wordAnalysis.examLabels.length > 0
              ? enrichment.wordAnalysis.examLabels
              : existingWordAnalysis.examLabels || [],
          inflections:
            enrichment.wordAnalysis.inflections.length > 0
              ? enrichment.wordAnalysis.inflections
              : existingWordAnalysis.inflections || [],
          parts:
            enrichment.wordAnalysis.parts.length > 0
              ? enrichment.wordAnalysis.parts
              : existingWordAnalysis.parts || [],
          relatedWords:
            enrichment.wordAnalysis.relatedWords.length > 0
              ? enrichment.wordAnalysis.relatedWords
              : existingWordAnalysis.relatedWords || [],
        }
        const updateResult = await supabase
          .from("vocabulary_words")
          .update({
            word: enrichment.word,
            phonetic: enrichment.phonetic || null,
            phonetic_uk: enrichment.phoneticUk || null,
            phonetic_us: enrichment.phoneticUs || null,
            part_of_speech: enrichment.partOfSpeech || null,
            definition: enrichment.definition,
            definition_translation: enrichment.definitionTranslation || null,
            examples: enrichment.examples as unknown as Json,
            example_translations: enrichment.exampleTranslations as unknown as Json,
            common_phrases: enrichment.commonPhrases as unknown as Json,
            word_analysis: wordAnalysis as Json,
            dictionary_sources: enrichment.dictionarySources as unknown as Json,
          })
          .eq("id", row.id)
          .eq("user_id", user.id)
        if (updateResult.error) {
          throw updateResult.error
        }
        return { id: row.id, failure: null }
      } catch (error) {
        return {
          id: row.id,
          failure: {
            word: row.word,
            message: getErrorMessage(error),
          },
        }
      }
    })
    const updatedIds = results.flatMap((result) => (result.failure ? [] : [result.id]))
    const failures = results.flatMap((result) =>
      result.failure ? [result.failure] : [],
    )
    const words = await getVocabularyWordsByIds(user.id, updatedIds)
    if (updatedIds.length > 0) {
      revalidatePath("/workspace/review")
    }

    return {
      ok: true,
      message:
        updatedIds.length > 0
          ? `已清洗 ${updatedIds.length} 条生词数据。`
          : failures.length > 0
            ? "部分生词暂时无法从公开词典更新。"
            : "生词数据已是最新。",
      data: {
        words,
        cleanedCount: updatedIds.length,
        failedIds: results.flatMap((result) => (result.failure ? [result.id] : [])),
        hasMore: candidates.length > batch.length,
        failures,
      },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

function normalizeVocabularyImportItem(item: unknown): VocabularyImportItem | null {
  const word = normalizeVocabularyTerm(
    readVocabularyImportValue(item, "word", maximumVocabularyTermLength + 1),
  )
  if (!isValidVocabularyTerm(word)) {
    return null
  }
  return {
    word,
    partOfSpeech: readVocabularyImportValue(item, "partOfSpeech", 80),
    definition: readVocabularyImportValue(item, "definition", 4000),
    definitionTranslation: readVocabularyImportValue(
      item,
      "definitionTranslation",
      4000,
    ),
    example: readVocabularyImportValue(item, "example", 500),
    exampleTranslation: readVocabularyImportValue(item, "exampleTranslation", 500),
  }
}

function readVocabularyImportValue(
  item: unknown,
  key: keyof VocabularyImportItem,
  maximum: number,
): string {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return ""
  }
  const value = (item as Record<string, unknown>)[key]
  return typeof value === "string" ? value.trim().slice(0, maximum) : ""
}

async function createImportedVocabularyRow(
  userId: string,
  item: VocabularyImportItem,
  sourceTitle: string,
): Promise<VocabularyWordInsert> {
  let entry: DictionaryEntry | null = null
  try {
    entry = await queryDictionary(item.word)
  } catch (error) {
    if (!item.definition) {
      throw error
    }
  }
  const enrichment = entry ? prepareVocabularyEnrichment(entry, item.example) : null
  const definition = item.definition || enrichment?.definition || ""
  if (!definition) {
    throw new Error(`没有找到 “${item.word}” 的有效释义。`)
  }

  const textsToTranslate: string[] = []
  const definitionTranslationIndex =
    !item.definitionTranslation &&
    (item.definition || !enrichment?.definitionTranslation)
      ? textsToTranslate.push(definition) - 1
      : -1
  const exampleTranslationIndex =
    item.example && !item.exampleTranslation
      ? textsToTranslate.push(item.example) - 1
      : -1
  const translations =
    textsToTranslate.length > 0
      ? await translateEnglishTexts(textsToTranslate, "zh-CN")
      : []
  const definitionTranslation =
    item.definitionTranslation ||
    (item.definition ? "" : enrichment?.definitionTranslation) ||
    translations[definitionTranslationIndex] ||
    ""
  const exampleTranslation =
    item.exampleTranslation || translations[exampleTranslationIndex] || ""

  return {
    user_id: userId,
    video_id: null,
    word: item.word,
    phonetic: enrichment?.phonetic || null,
    phonetic_uk: enrichment?.phoneticUk || null,
    phonetic_us: enrichment?.phoneticUs || null,
    part_of_speech:
      (item.partOfSpeech || enrichment?.partOfSpeech || "").slice(0, 80) || null,
    definition: definition.slice(0, 4000),
    definition_translation: definitionTranslation.slice(0, 4000) || null,
    examples: (enrichment?.examples ?? []) as unknown as Json,
    example_translations: (enrichment?.exampleTranslations ?? []) as unknown as Json,
    common_phrases: (enrichment?.commonPhrases ?? []) as unknown as Json,
    word_analysis: (enrichment?.wordAnalysis ?? {
      etymology: "",
      etymologyTranslation: "",
      examLabels: [],
      inflections: [],
      parts: [],
      relatedWords: [],
      vocabularyEnrichmentVersion,
    }) as unknown as Json,
    dictionary_sources: (enrichment?.dictionarySources ?? []) as unknown as Json,
    source_title: sourceTitle,
    source_timestamp_seconds: 0,
    source_sentence: item.example || null,
    translation: exampleTranslation || null,
  }
}

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

async function mapWithConcurrency<Input, Output>(
  items: Input[],
  concurrency: number,
  callback: (item: Input) => Promise<Output>,
): Promise<Output[]> {
  const results = Array<Output>(items.length)
  let nextIndex = 0

  async function runNext() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item !== undefined) {
        results[index] = await callback(item)
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  )
  return results
}

export async function setVocabularyWordTags(input: {
  vocabularyId: string
  tagNames: string[]
}): Promise<ActionResult<{ tags: LearningTag[] }>> {
  try {
    const user = await requireUser()
    const tagNames = normalizeLearningTagNames(input.tagNames)
    const supabase = await createClient()
    const wordResult = await supabase
      .from("vocabulary_words")
      .select("id")
      .eq("id", input.vocabularyId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (wordResult.error) {
      throw wordResult.error
    }
    if (!wordResult.data) {
      return { ok: false, message: "生词不存在或无权修改。" }
    }

    const tags = await findOrCreateTags(user.id, tagNames)
    const relationResult = await supabase
      .from("vocabulary_tags")
      .select("tag_id")
      .eq("vocabulary_id", input.vocabularyId)
      .eq("user_id", user.id)
    if (relationResult.error) {
      throw relationResult.error
    }

    const targetTagIds = new Set(tags.map((tag) => tag.id))
    const currentTagIds = new Set(
      (relationResult.data ?? []).map((relation) => relation.tag_id),
    )
    const additions = tags.filter((tag) => !currentTagIds.has(tag.id))
    if (additions.length > 0) {
      const insertResult = await supabase.from("vocabulary_tags").insert(
        additions.map((tag) => ({
          user_id: user.id,
          vocabulary_id: input.vocabularyId,
          tag_id: tag.id,
        })),
      )
      if (insertResult.error) {
        throw insertResult.error
      }
    }

    const removals = Array.from(currentTagIds).filter(
      (tagId) => !targetTagIds.has(tagId),
    )
    if (removals.length > 0) {
      const deleteResult = await supabase
        .from("vocabulary_tags")
        .delete()
        .eq("vocabulary_id", input.vocabularyId)
        .eq("user_id", user.id)
        .in("tag_id", removals)
      if (deleteResult.error) {
        throw deleteResult.error
      }
    }

    const assignedTags = tags
      .map(
        (tag): LearningTag => ({
          id: tag.id,
          name: tag.name,
          isDefault: false,
        }),
      )
      .toSorted((left, right) => left.name.localeCompare(right.name, "zh-CN"))
    refreshVocabularyPages()
    return {
      ok: true,
      message: assignedTags.length > 0 ? "生词标签已更新。" : "生词标签已清空。",
      data: { tags: assignedTags },
    }
  } catch (error) {
    if (isMissingVocabularyTagsTable(error)) {
      return {
        ok: false,
        message: "生词标签尚未启用，请先在 Supabase 中执行 updated.sql。",
      }
    }
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function addTagsToVocabularyWords(input: {
  vocabularyIds: string[]
  tagNames: string[]
}): Promise<ActionResult<{ updatedIds: string[]; tags: LearningTag[] }>> {
  try {
    const user = await requireUser()
    const vocabularyIds = Array.from(
      new Set(
        input.vocabularyIds.filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            id,
          ),
        ),
      ),
    )
    const tagNames = normalizeLearningTagNames(input.tagNames)
    if (vocabularyIds.length === 0) {
      return { ok: false, message: "请选择要添加标签的生词。" }
    }
    if (vocabularyIds.length > maximumVocabularyBatchItems) {
      return {
        ok: false,
        message: `每次最多为 ${maximumVocabularyBatchItems} 个生词添加标签。`,
      }
    }
    if (tagNames.length === 0) {
      return { ok: false, message: "请至少选择或输入一个标签。" }
    }

    const supabase = await createClient()
    const [wordResult] = await Promise.all([
      supabase
        .from("vocabulary_words")
        .select("id")
        .eq("user_id", user.id)
        .in("id", vocabularyIds),
      ensureVocabularyTagStorage(user.id),
    ])
    if (wordResult.error) {
      throw wordResult.error
    }
    const updatedIds = (wordResult.data ?? []).map((word) => word.id)
    if (updatedIds.length === 0) {
      return { ok: false, message: "所选生词不存在或已被删除。" }
    }

    const tags = await attachVocabularyTags(user.id, updatedIds, tagNames)
    refreshVocabularyPages()
    return {
      ok: true,
      message: `已为 ${updatedIds.length} 个生词添加标签。`,
      data: { updatedIds, tags },
    }
  } catch (error) {
    if (isMissingVocabularyTagsTable(error)) {
      return {
        ok: false,
        message: "生词标签尚未启用，请先在 Supabase 中执行 updated.sql。",
      }
    }
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteVocabularyWord(
  vocabularyId: string,
): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const result = await supabase
      .from("vocabulary_words")
      .delete()
      .eq("id", vocabularyId)
      .eq("user_id", user.id)
    if (result.error) {
      throw result.error
    }
    refreshVocabularyPages()
    return { ok: true, message: "生词已删除。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteVocabularyWords(
  vocabularyIds: string[],
): Promise<ActionResult<{ deletedIds: string[] }>> {
  try {
    const user = await requireUser()
    const ids = Array.from(
      new Set(
        vocabularyIds.filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            id,
          ),
        ),
      ),
    )
    if (ids.length === 0) {
      return { ok: false, message: "请选择要删除的生词。" }
    }
    if (ids.length > maximumVocabularyBatchItems) {
      return {
        ok: false,
        message: `每次最多删除 ${maximumVocabularyBatchItems} 个生词。`,
      }
    }

    const supabase = await createClient()
    const result = await supabase
      .from("vocabulary_words")
      .delete()
      .eq("user_id", user.id)
      .in("id", ids)
      .select("id")
    if (result.error) {
      throw result.error
    }
    const deletedIds = result.data.map((word) => word.id)
    if (deletedIds.length === 0) {
      return { ok: false, message: "所选生词不存在或已被删除。" }
    }
    refreshVocabularyPages()
    return {
      ok: true,
      message: `已删除 ${deletedIds.length} 个生词。`,
      data: { deletedIds },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

function createVocabularyAnalysisContext(word: VocabularyWord) {
  return {
    word: word.word,
    partOfSpeech: word.partOfSpeech,
    definition: word.definition,
    definitionTranslation: word.definitionTranslation,
    examples:
      word.exampleTranslations.length > 0 ? word.exampleTranslations : word.examples,
    sourceSentence: word.sourceSentence,
    wordAnalysis: word.wordAnalysis,
  }
}

export async function readVocabularyWordDetail(
  vocabularyId: string,
): Promise<ActionResult<VocabularyWord>> {
  try {
    const user = await requireUser()
    let word = await getVocabularyWordById(user.id, vocabularyId)
    if (!word) {
      return { ok: false, message: "生词不存在或已被删除。" }
    }
    if (word.meanings.length === 0) {
      try {
        const entry = await queryDictionary(word.word)
        word = {
          ...word,
          phonetic: word.phonetic || entry.phonetic,
          phoneticUk: word.phoneticUk || entry.phoneticUk,
          phoneticUs: word.phoneticUs || entry.phoneticUs,
          meanings: entry.meanings,
          examLabels: word.examLabels.length > 0 ? word.examLabels : entry.examLabels,
          inflections:
            word.inflections.length > 0 ? word.inflections : entry.inflections,
          commonPhrases: entry.commonPhrases,
          wordAnalysis:
            word.wordAnalysis.parts.length > 0 ? word.wordAnalysis : entry.wordAnalysis,
          dictionarySources: entry.sources,
        }
      } catch {
        // Keep stored vocabulary detail when public dictionary enrichment fails.
      }
    }
    const analysis = word.aiAnalysis
    const missingExampleTranslations =
      analysis?.examples.filter((example) => !example.translation) ?? []
    if (analysis && missingExampleTranslations.length > 0) {
      const translations = await translateEnglishTexts(
        missingExampleTranslations.map((example) => example.term),
        "zh-CN",
      )
      let translationIndex = 0
      const updatedAnalysis = {
        ...analysis,
        examples: analysis.examples.map((example) => {
          if (example.translation) {
            return example
          }
          return {
            ...example,
            translation: translations[translationIndex++] ?? "",
          }
        }),
      }
      if (updatedAnalysis.examples.some((example) => example.translation)) {
        const supabase = await createClient()
        const updateResult = await supabase
          .from("vocabulary_words")
          .update({ ai_analysis: updatedAnalysis as unknown as Json })
          .eq("id", vocabularyId)
          .eq("user_id", user.id)
        if (!updateResult.error) {
          word = { ...word, aiAnalysis: updatedAnalysis }
        }
      }
    }
    return {
      ok: true,
      message: "生词明细已读取。",
      data: word,
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function generateVocabularyAiAnalysis(input: {
  vocabularyId: string
  config: AiModelConfigInput
}): Promise<ActionResult<VocabularyWord>> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const currentWord = await getVocabularyWordById(user.id, input.vocabularyId)
    if (!currentWord) {
      return { ok: false, message: "生词不存在或已被删除。" }
    }
    if (!input.config.enabled) {
      return {
        ok: false,
        message: "请先在设置页启用本地 AI 模型配置。",
      }
    }

    const analysisContext = createVocabularyAnalysisContext(currentWord)
    const analysis = await generateAiVocabularyAnalysis(input.config, analysisContext)
    const consistencyError = validateAiVocabularyAnalysisConsistency(analysis, {
      ...analysisContext,
      previousAnalysis: currentWord.aiAnalysis,
    })
    if (consistencyError) {
      return { ok: false, message: consistencyError }
    }
    const definitionTranslation = getVocabularyChineseDefinition({
      word: currentWord.word,
      definition: currentWord.definition,
      meanings: currentWord.meanings,
      aiAnalysis: analysis,
      definitionTranslation: currentWord.definitionTranslation,
    })
    const correctedDefinition =
      getVocabularyMeanings({
        word: currentWord.word,
        definition: currentWord.definition,
        meanings: currentWord.meanings,
        aiAnalysis: analysis,
        definitionTranslation: currentWord.definitionTranslation,
      })[0]?.definition.trim() || currentWord.definition
    let updateResult = await supabase
      .from("vocabulary_words")
      .update({
        ai_analysis: analysis as unknown as Json,
        definition: correctedDefinition,
        definition_translation: definitionTranslation || null,
        part_of_speech:
          currentWord.partOfSpeech || analysis.partsOfSpeech[0]?.term || null,
      })
      .eq("id", input.vocabularyId)
      .eq("user_id", user.id)
    if (updateResult.error && isMissingVocabularyEnrichmentColumn(updateResult.error)) {
      updateResult = await supabase
        .from("vocabulary_words")
        .update({
          ai_analysis: analysis as unknown as Json,
          definition: correctedDefinition,
        })
        .eq("id", input.vocabularyId)
        .eq("user_id", user.id)
    }
    if (updateResult.error) {
      if (isMissingVocabularyEnrichmentColumn(updateResult.error)) {
        return {
          ok: true,
          message: "AI 解析已生成；当前数据库仍需执行 updated.sql 后才能持久保存。",
          data: {
            ...currentWord,
            aiAnalysis: analysis,
            definition: correctedDefinition,
            definitionTranslation:
              definitionTranslation || currentWord.definitionTranslation,
            partOfSpeech:
              currentWord.partOfSpeech || analysis.partsOfSpeech[0]?.term || "",
            meanings: analysis.meanings.map((item) => ({
              partOfSpeech: item.term,
              definition: item.en,
              translation: item.zh,
              example: "",
              exampleTranslation: "",
            })),
            examLabels: analysis.examLabels,
            inflections: toAnalysisInflections(analysis),
          },
        }
      }
      throw updateResult.error
    }
    const updatedWord = await getVocabularyWordById(user.id, input.vocabularyId)
    if (!updatedWord) {
      return { ok: false, message: "AI 解析已生成，但生词明细读取失败。" }
    }
    revalidatePath("/workspace/vocabulary")
    revalidatePath("/workspace/review")
    return {
      ok: true,
      message: "AI 双语词汇解析已更新。",
      data: updatedWord,
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

function toAnalysisInflections(
  analysis: Awaited<ReturnType<typeof generateAiVocabularyAnalysis>>,
) {
  return analysis.inflections.flatMap((item) => {
    const label = item.zh || item.term
    return label && item.en ? [{ label, value: item.en }] : []
  })
}

export async function validateAiModelConfig(
  input: AiModelConfigInput,
): Promise<ActionResult<{ model: string }>> {
  try {
    await requireUser()
    if (!input.enabled) {
      return { ok: false, message: "请先启用 AI 解析。" }
    }
    const result = await validateAiModelConnection(input)
    return {
      ok: true,
      message: `AI 模型验证通过：${result.model}`,
      data: result,
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function reviewVocabularyWord(input: {
  vocabularyId: string
  rating: 1 | 2 | 3 | 4
}): Promise<ActionResult<VocabularyReviewProgress>> {
  try {
    const user = await requireUser()
    if (![1, 2, 3, 4].includes(input.rating)) {
      return { ok: false, message: "无效的复习评分。" }
    }

    const supabase = await createClient()
    const wordResult = await supabase
      .from("vocabulary_words")
      .select("ease_factor, interval_days, repetitions")
      .eq("id", input.vocabularyId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (wordResult.error) {
      throw wordResult.error
    }
    if (!wordResult.data) {
      return { ok: false, message: "复习卡片不存在。" }
    }

    const reviewedAt = new Date()
    const schedule = scheduleReview(
      {
        easeFactor: Number(wordResult.data.ease_factor),
        intervalDays: wordResult.data.interval_days,
        repetitions: wordResult.data.repetitions,
      },
      input.rating,
      reviewedAt,
    )
    const updateResult = await supabase
      .from("vocabulary_words")
      .update({
        ease_factor: schedule.easeFactor,
        interval_days: schedule.intervalDays,
        repetitions: schedule.repetitions,
        due_at: schedule.dueAt,
        last_reviewed_at: reviewedAt.toISOString(),
        mastery: schedule.mastery,
      })
      .eq("id", input.vocabularyId)
      .eq("user_id", user.id)
    if (updateResult.error) {
      throw updateResult.error
    }

    const logResult = await supabase.from("review_logs").insert({
      user_id: user.id,
      vocabulary_id: input.vocabularyId,
      rating: input.rating,
      previous_interval_days: wordResult.data.interval_days,
      next_interval_days: schedule.intervalDays,
      reviewed_at: reviewedAt.toISOString(),
    })
    if (logResult.error) {
      throw logResult.error
    }

    revalidatePath("/workspace/vocabulary")
    revalidatePath("/workspace/stats")
    return {
      ok: true,
      message: "复习进度已保存。",
      data: {
        dueAt: schedule.dueAt,
        easeFactor: schedule.easeFactor,
        intervalDays: schedule.intervalDays,
        lastReviewedAt: reviewedAt.toISOString(),
        mastery: schedule.mastery,
        repetitions: schedule.repetitions,
      },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function saveLearningPreferences(
  input: LearningPreferences,
): Promise<ActionResult<LearningPreferences>> {
  try {
    const user = await requireUser()
    const preferences = normalizeLearningPreferences(input)
    await saveProfilePreferences(user.id, preferences)
    revalidatePath("/workspace/settings")
    return {
      ok: true,
      message: "偏好设置已同步。",
      data: preferences,
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function createPlaylist(
  formData: FormData,
): Promise<ActionResult<{ playlistId: string }>> {
  try {
    const user = await requireUser()
    const name = normalizeText(formData.get("name"), 100)
    const description = normalizeText(formData.get("description"), 500)
    const videoId = normalizeText(formData.get("videoId"), 36)
    if (!name) {
      return { ok: false, message: "请输入播放列表名称。" }
    }
    const supabase = await createClient()
    if (videoId) {
      const videoResult = await supabase
        .from("videos")
        .select("id")
        .eq("id", videoId)
        .eq("user_id", user.id)
        .maybeSingle()
      if (videoResult.error) {
        throw videoResult.error
      }
      if (!videoResult.data) {
        return { ok: false, message: "视频不存在或无权添加。" }
      }
    }
    const result = await supabase
      .from("playlists")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
      })
      .select("id")
      .single()
    if (result.error) {
      throw result.error
    }
    if (videoId) {
      const itemResult = await supabase.from("playlist_items").insert({
        user_id: user.id,
        playlist_id: result.data.id,
        video_id: videoId,
        position: 0,
      })
      if (itemResult.error) {
        await supabase
          .from("playlists")
          .delete()
          .eq("id", result.data.id)
          .eq("user_id", user.id)
        throw itemResult.error
      }
    }
    refreshLearningPages()
    return {
      ok: true,
      message: videoId ? "播放列表已创建，视频已加入。" : "播放列表已创建。",
      data: { playlistId: result.data.id },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function addVideoToPlaylist(input: {
  playlistId: string
  videoId: string
}): Promise<ActionResult<{ added: boolean }>> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const [playlistResult, videoResult, existingResult, countResult] =
      await Promise.all([
        supabase
          .from("playlists")
          .select("id")
          .eq("id", input.playlistId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("videos")
          .select("id")
          .eq("id", input.videoId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("playlist_items")
          .select("video_id")
          .eq("playlist_id", input.playlistId)
          .eq("video_id", input.videoId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("playlist_items")
          .select("*", { count: "exact", head: true })
          .eq("playlist_id", input.playlistId)
          .eq("user_id", user.id),
      ])
    const firstError =
      playlistResult.error ??
      videoResult.error ??
      existingResult.error ??
      countResult.error
    if (firstError) {
      throw firstError
    }
    if (!playlistResult.data || !videoResult.data) {
      return { ok: false, message: "播放列表或视频不存在。" }
    }
    if (existingResult.data) {
      return {
        ok: true,
        message: "视频已在这个播放列表中。",
        data: { added: false },
      }
    }
    const [insertResult, updateResult] = await Promise.all([
      supabase.from("playlist_items").insert({
        user_id: user.id,
        playlist_id: input.playlistId,
        video_id: input.videoId,
        position: countResult.count ?? 0,
      }),
      supabase
        .from("playlists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.playlistId)
        .eq("user_id", user.id),
    ])
    if (insertResult.error || updateResult.error) {
      throw insertResult.error ?? updateResult.error
    }
    refreshLearningPages(input.videoId)
    return {
      ok: true,
      message: "已加入播放列表。",
      data: { added: true },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deletePlaylists(
  playlistIds: string[],
): Promise<ActionResult<{ deletedIds: string[] }>> {
  try {
    const user = await requireUser()
    const ids = Array.from(
      new Set(
        playlistIds.filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
            id,
          ),
        ),
      ),
    ).slice(0, 50)
    if (ids.length === 0) {
      return { ok: false, message: "请选择要删除的播放列表。" }
    }

    const supabase = await createClient()
    const result = await supabase
      .from("playlists")
      .delete()
      .eq("user_id", user.id)
      .in("id", ids)
      .select("id")
    if (result.error) {
      throw result.error
    }
    const deletedIds = result.data.map((playlist) => playlist.id)
    refreshLearningPages()
    return {
      ok: true,
      message: `已删除 ${deletedIds.length} 个播放列表。`,
      data: { deletedIds },
    }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function removeVideoFromPlaylist(input: {
  playlistId: string
  videoId: string
}): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const [deleteResult, updateResult] = await Promise.all([
      supabase
        .from("playlist_items")
        .delete()
        .eq("playlist_id", input.playlistId)
        .eq("video_id", input.videoId)
        .eq("user_id", user.id),
      supabase
        .from("playlists")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", input.playlistId)
        .eq("user_id", user.id),
    ])
    if (deleteResult.error || updateResult.error) {
      throw deleteResult.error ?? updateResult.error
    }
    refreshLearningPages(input.videoId)
    return { ok: true, message: "视频已从播放列表移除。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}

export async function deleteVideo(videoId: string): Promise<ActionResult> {
  try {
    const user = await requireUser()
    const supabase = await createClient()
    const videoResult = await supabase
      .from("videos")
      .select("source_type, storage_path")
      .eq("id", videoId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (videoResult.error) {
      throw videoResult.error
    }
    if (!videoResult.data) {
      return { ok: false, message: "视频不存在或无权删除。" }
    }

    const deleteResult = await supabase
      .from("videos")
      .delete()
      .eq("id", videoId)
      .eq("user_id", user.id)
    if (deleteResult.error) {
      throw deleteResult.error
    }
    if (videoResult.data.source_type === "upload" && videoResult.data.storage_path) {
      const storageResult = await supabase.storage
        .from("videos")
        .remove([videoResult.data.storage_path])
      if (storageResult.error) {
        throw storageResult.error
      }
    }
    refreshLearningPages(videoId)
    return { ok: true, message: "视频已从资源库删除。" }
  } catch (error) {
    return { ok: false, message: getErrorMessage(error) }
  }
}
