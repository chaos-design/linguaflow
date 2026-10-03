import {
  parseBilibiliTranscript,
  parseSubtitleFile,
  parseYouTubeTranscript,
  subtitleCuesToVtt,
} from "../../lib/subtitles"
import type { InspectedVideo } from "../../types/learning"

const directVideoPattern = /\.(?:m4v|mov|mp4|webm)(?:$|[?#])/iu
const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
])
const vimeoHosts = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"])
const bilibiliHosts = new Set(["bilibili.com", "www.bilibili.com", "m.bilibili.com"])
const browserHeaders = {
  Accept: "application/json,text/plain,*/*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
}

interface DetectedTranscript {
  content: string
  cueCount: number
  language: string
  generated: boolean
}

class VideoPlatformHttpError extends Error {
  constructor(
    readonly status: number,
    readonly hostname: string,
  ) {
    super(`视频平台返回 ${status}，请检查链接是否公开可访问。`)
    this.name = "VideoPlatformHttpError"
  }
}

export interface InspectedVideoResource {
  video: InspectedVideo
  transcriptContent: string | null
}

export interface NormalizedVideoSource {
  sourceKey: string
  sourceUrl: string
}

export async function inspectVideoUrl(value: string): Promise<InspectedVideo> {
  return (await inspectVideoResource(value)).video
}

export async function inspectVideoResource(
  value: string,
): Promise<InspectedVideoResource> {
  const normalizedSource = normalizeVideoSource(value)
  const sourceUrl = new URL(normalizedSource.sourceUrl)
  const host = sourceUrl.hostname.toLowerCase()

  if (isYouTubeHost(host)) {
    return inspectYouTube(sourceUrl, normalizedSource.sourceKey)
  }
  if (vimeoHosts.has(host)) {
    return inspectVimeo(sourceUrl, normalizedSource.sourceKey)
  }
  if (bilibiliHosts.has(host)) {
    return inspectBilibili(sourceUrl, normalizedSource.sourceKey)
  }

  const direct = directVideoPattern.test(sourceUrl.toString())
  return {
    video: {
      sourceKey: normalizedSource.sourceKey,
      sourceUrl: sourceUrl.toString(),
      provider: direct ? "直链视频" : "网页视频",
      title: getFallbackTitle(sourceUrl),
      thumbnailUrl: null,
      durationSeconds: 0,
      detectedCaptions: null,
    },
    transcriptContent: null,
  }
}

export function normalizeVideoSource(value: string): NormalizedVideoSource {
  const url = parsePublicUrl(value)
  const host = url.hostname.toLowerCase()

  if (isYouTubeHost(host)) {
    const videoId = getYouTubeVideoId(url)
    if (!videoId) {
      throw new Error("无法从 YouTube 链接中识别视频 ID。")
    }
    const sourceUrl = new URL("https://www.youtube.com/watch")
    sourceUrl.searchParams.set("v", videoId)
    return {
      sourceKey: `youtube:${videoId}`,
      sourceUrl: sourceUrl.toString(),
    }
  }

  if (bilibiliHosts.has(host)) {
    const bvid = /\/video\/(BV[a-zA-Z0-9]+)/u.exec(url.pathname)?.[1]
    if (!bvid) {
      throw new Error("无法从 Bilibili 链接中识别 BV 号。")
    }
    return {
      sourceKey: `bilibili:${bvid.toLocaleLowerCase("en")}`,
      sourceUrl: `https://www.bilibili.com/video/${bvid}`,
    }
  }

  if (vimeoHosts.has(host)) {
    const videoId = getVimeoVideoId(url)
    if (!videoId) {
      throw new Error("无法从 Vimeo 链接中识别视频 ID。")
    }
    const sourceUrl = new URL(`https://vimeo.com/${videoId}`)
    const hash = url.searchParams.get("h")
    if (hash) {
      sourceUrl.searchParams.set("h", hash)
    }
    return {
      sourceKey: `vimeo:${videoId}`,
      sourceUrl: sourceUrl.toString(),
    }
  }

  url.hash = ""
  if (url.toString().length > 495) {
    throw new Error("视频链接过长，请使用平台提供的标准分享链接。")
  }
  return {
    sourceKey: `url:${url.toString()}`,
    sourceUrl: url.toString(),
  }
}

function parsePublicUrl(value: string): URL {
  const url = new URL(value.trim())
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("仅支持 HTTP 或 HTTPS 视频链接。")
  }
  if (
    url.hostname === "localhost" ||
    url.hostname.endsWith(".local") ||
    /^(?:127|10|0)\./u.test(url.hostname) ||
    /^192\.168\./u.test(url.hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./u.test(url.hostname) ||
    url.hostname === "::1"
  ) {
    throw new Error("不能导入本地或内网地址。")
  }
  return url
}

async function inspectYouTube(
  url: URL,
  sourceKey: string,
): Promise<InspectedVideoResource> {
  const videoId = getYouTubeVideoId(url)
  const endpoint = new URL("https://www.youtube.com/oembed")
  endpoint.searchParams.set("url", url.toString())
  endpoint.searchParams.set("format", "json")
  const [data, transcript] = await Promise.all([
    fetchMetadataJson(endpoint),
    detectYouTubeTranscript(url),
  ])

  return {
    video: {
      sourceKey,
      sourceUrl: url.toString(),
      provider: "YouTube",
      title:
        readString(data, "title") ??
        (videoId ? `YouTube 视频 ${videoId}` : getFallbackTitle(url)),
      thumbnailUrl:
        readString(data, "thumbnail_url") ??
        (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null),
      durationSeconds: 0,
      detectedCaptions: getDetectedCaptionInfo(transcript),
      metadataLimited: data === null,
    },
    transcriptContent: transcript?.content ?? null,
  }
}

async function inspectVimeo(
  url: URL,
  sourceKey: string,
): Promise<InspectedVideoResource> {
  const videoId = getVimeoVideoId(url)
  const endpoint = new URL("https://vimeo.com/api/oembed.json")
  endpoint.searchParams.set("url", url.toString())
  const [data, transcript] = await Promise.all([
    fetchMetadataJson(endpoint),
    detectVimeoTranscript(url),
  ])

  return {
    video: {
      sourceKey,
      sourceUrl: url.toString(),
      provider: "Vimeo",
      title:
        readString(data, "title") ??
        (videoId ? `Vimeo 视频 ${videoId}` : getFallbackTitle(url)),
      thumbnailUrl: readString(data, "thumbnail_url"),
      durationSeconds: readNumber(data, "duration") ?? 0,
      detectedCaptions: getDetectedCaptionInfo(transcript),
      metadataLimited: data === null,
    },
    transcriptContent: transcript?.content ?? null,
  }
}

async function inspectBilibili(
  url: URL,
  sourceKey: string,
): Promise<InspectedVideoResource> {
  const bvid = /\/video\/(BV[a-zA-Z0-9]+)/u.exec(url.pathname)?.[1]
  if (!bvid) {
    throw new Error("无法从 Bilibili 链接中识别 BV 号。")
  }
  const endpoint = new URL("https://api.bilibili.com/x/web-interface/view")
  endpoint.searchParams.set("bvid", bvid)
  const response = await fetchMetadataJson(endpoint)
  const data = response ? readRecord(response, "data") : null
  if (response && !data) {
    throw new Error("Bilibili 未返回可用的视频信息。")
  }

  const thumbnail = data ? readString(data, "pic") : null
  const transcript = await detectBilibiliTranscript(
    bvid,
    data ? readNumber(data, "cid") : null,
  )
  return {
    video: {
      sourceKey,
      sourceUrl: url.toString(),
      provider: "Bilibili",
      title: (data ? readString(data, "title") : null) ?? `Bilibili 视频 ${bvid}`,
      thumbnailUrl: thumbnail?.replace(/^http:/u, "https:") ?? null,
      durationSeconds: (data ? readNumber(data, "duration") : null) ?? 0,
      detectedCaptions: getDetectedCaptionInfo(transcript),
      metadataLimited: response === null,
    },
    transcriptContent: transcript?.content ?? null,
  }
}

async function detectYouTubeTranscript(url: URL): Promise<DetectedTranscript | null> {
  try {
    const videoId = getYouTubeVideoId(url)
    if (!videoId) {
      return null
    }
    const watchUrl = new URL("https://www.youtube.com/watch")
    watchUrl.searchParams.set("v", videoId)
    const watchPage = await fetchText(watchUrl, { headers: browserHeaders }, 5_000_000)
    const apiKey =
      /"INNERTUBE_API_KEY":"([^"]+)"/u.exec(watchPage)?.[1] ??
      /"innertubeApiKey":"([^"]+)"/u.exec(watchPage)?.[1]

    let playerResponse: Record<string, unknown> | null = null
    if (apiKey) {
      const endpoint = new URL("https://www.youtube.com/youtubei/v1/player")
      endpoint.searchParams.set("key", apiKey)
      endpoint.searchParams.set("prettyPrint", "false")
      try {
        playerResponse = await fetchJson(endpoint, {
          method: "POST",
          headers: {
            ...browserHeaders,
            "Content-Type": "application/json",
            "X-YouTube-Client-Name": "3",
            "X-YouTube-Client-Version": "20.10.38",
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: "ANDROID",
                clientVersion: "20.10.38",
                hl: "en",
                gl: "US",
              },
            },
            videoId,
          }),
        })
      } catch {
        playerResponse = null
      }
    }
    playerResponse ??= extractEmbeddedJson(watchPage, "ytInitialPlayerResponse")
    const tracks = getYouTubeCaptionTracks(playerResponse)
    const track = selectCaptionTrack(tracks)
    if (!track) {
      return null
    }

    const captionUrl = new URL(track.url)
    assertTrustedUrl(captionUrl, ["youtube.com"])
    captionUrl.searchParams.set("fmt", "json3")
    const cues = parseYouTubeTranscript(await fetchJson(captionUrl))
    return createDetectedTranscript(cues, track.language, track.generated)
  } catch {
    return null
  }
}

async function detectBilibiliTranscript(
  bvid: string,
  cid: number | null,
): Promise<DetectedTranscript | null> {
  if (cid === null) {
    return null
  }
  try {
    const endpoint = new URL("https://api.bilibili.com/x/player/v2")
    endpoint.searchParams.set("bvid", bvid)
    endpoint.searchParams.set("cid", String(cid))
    const response = await fetchJson(endpoint, {
      headers: {
        ...browserHeaders,
        Referer: `https://www.bilibili.com/video/${bvid}`,
      },
    })
    const data = readRecord(response, "data")
    const subtitle = data ? readRecord(data, "subtitle") : null
    const tracks = Array.isArray(subtitle?.subtitles)
      ? subtitle.subtitles.flatMap((value) => {
          const track = asRecord(value)
          const trackUrl = readString(track, "subtitle_url")
          if (!trackUrl) {
            return []
          }
          return [
            {
              url: trackUrl.startsWith("//") ? `https:${trackUrl}` : trackUrl,
              language:
                readString(track, "lan_doc") ?? readString(track, "lan") ?? "平台字幕",
              generated:
                (readNumber(track, "ai_status") ?? 0) > 0 ||
                (readString(track, "lan")?.startsWith("ai-") ?? false),
            },
          ]
        })
      : []
    const track = selectCaptionTrack(tracks)
    if (!track) {
      return null
    }

    const subtitleUrl = new URL(track.url)
    assertTrustedUrl(subtitleUrl, ["hdslb.com", "bilibili.com"])
    const cues = parseBilibiliTranscript(
      await fetchJson(subtitleUrl, { headers: browserHeaders }),
    )
    return createDetectedTranscript(cues, track.language, track.generated)
  } catch {
    return null
  }
}

async function detectVimeoTranscript(url: URL): Promise<DetectedTranscript | null> {
  const videoId = getVimeoVideoId(url)
  if (!videoId) {
    return null
  }
  try {
    const endpoint = new URL(`https://player.vimeo.com/video/${videoId}/config`)
    const hash = url.searchParams.get("h")
    if (hash) {
      endpoint.searchParams.set("h", hash)
    }
    const response = await fetchJson(endpoint, { headers: browserHeaders })
    const request = readRecord(response, "request")
    const tracks = Array.isArray(request?.text_tracks)
      ? request.text_tracks.flatMap((value) => {
          const track = asRecord(value)
          const trackUrl = readString(track, "url")
          if (!trackUrl) {
            return []
          }
          return [
            {
              url: new URL(trackUrl, endpoint).toString(),
              language:
                readString(track, "label") ?? readString(track, "lang") ?? "平台字幕",
              generated: false,
            },
          ]
        })
      : []
    const track = selectCaptionTrack(tracks)
    if (!track) {
      return null
    }

    const subtitleUrl = new URL(track.url)
    assertTrustedUrl(subtitleUrl, ["vimeo.com", "vimeocdn.com"])
    const cues = parseSubtitleFile(
      await fetchText(subtitleUrl, { headers: browserHeaders }, 2_000_000),
    )
    return createDetectedTranscript(cues, track.language, false)
  } catch {
    return null
  }
}

function getVimeoVideoId(url: URL): string | null {
  return url.pathname.split("/").find((part) => /^\d+$/u.test(part)) ?? null
}

function createDetectedTranscript(
  cues: ReturnType<typeof parseSubtitleFile>,
  language: string,
  generated: boolean,
): DetectedTranscript | null {
  const content = subtitleCuesToVtt(cues)
  return content && new TextEncoder().encode(content).byteLength <= 2_000_000
    ? { content, cueCount: cues.length, language, generated }
    : null
}

function getDetectedCaptionInfo(transcript: DetectedTranscript | null) {
  return transcript
    ? {
        cueCount: transcript.cueCount,
        language: transcript.language,
        generated: transcript.generated,
      }
    : null
}

interface CaptionTrack {
  url: string
  language: string
  generated: boolean
}

function getYouTubeCaptionTracks(
  response: Record<string, unknown> | null,
): CaptionTrack[] {
  const captions = response ? readRecord(response, "captions") : null
  const renderer = captions
    ? readRecord(captions, "playerCaptionsTracklistRenderer")
    : null
  return Array.isArray(renderer?.captionTracks)
    ? renderer.captionTracks.flatMap((value) => {
        const track = asRecord(value)
        const url = readString(track, "baseUrl")
        if (!url) {
          return []
        }
        const name = readRecord(track, "name")
        return [
          {
            url,
            language:
              readString(name, "simpleText") ??
              readString(track, "languageCode") ??
              "平台字幕",
            generated: readString(track, "kind") === "asr",
          },
        ]
      })
    : []
}

function selectCaptionTrack<T extends CaptionTrack>(tracks: T[]): T | null {
  return (
    tracks.toSorted((left, right) => scoreTrack(right) - scoreTrack(left))[0] ?? null
  )
}

function scoreTrack(track: CaptionTrack): number {
  const language = track.language.toLocaleLowerCase("en")
  const english = /\b(?:en|english|英语|英文)\b/u.test(language) ? 100 : 0
  const manual = track.generated ? 0 : 10
  return english + manual
}

function getYouTubeVideoId(url: URL): string | null {
  if (url.hostname.toLowerCase() === "youtu.be") {
    return url.pathname.split("/").filter(Boolean)[0] ?? null
  }
  const queryId = url.searchParams.get("v")
  if (queryId) {
    return queryId
  }
  const segments = url.pathname.split("/").filter(Boolean)
  return ["embed", "shorts", "live"].includes(segments[0] ?? "")
    ? (segments[1] ?? null)
    : null
}

function isYouTubeHost(host: string): boolean {
  return (
    youtubeHosts.has(host) ||
    host.endsWith(".youtube.com") ||
    host.endsWith(".youtube-nocookie.com")
  )
}

function extractEmbeddedJson(
  source: string,
  marker: string,
): Record<string, unknown> | null {
  const markerIndex = source.indexOf(marker)
  const objectStart = source.indexOf("{", markerIndex + marker.length)
  if (markerIndex < 0 || objectStart < 0) {
    return null
  }

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (character === "\\") {
        escaped = true
      } else if (character === '"') {
        inString = false
      }
      continue
    }
    if (character === '"') {
      inString = true
    } else if (character === "{") {
      depth += 1
    } else if (character === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(objectStart, index + 1)) as Record<
            string,
            unknown
          >
        } catch {
          return null
        }
      }
    }
  }
  return null
}

async function fetchJson(
  url: URL,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const text = await fetchText(url, init, 5_000_000)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("视频平台返回了无法识别的数据。")
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("视频平台返回了无法识别的数据。")
  }
  return data as Record<string, unknown>
}

async function fetchMetadataJson(
  url: URL,
  init?: RequestInit,
): Promise<Record<string, unknown> | null> {
  try {
    return await fetchJson(url, init)
  } catch (error) {
    if (
      error instanceof VideoPlatformHttpError &&
      (error.status === 401 ||
        error.status === 403 ||
        error.status === 429 ||
        error.status >= 500)
    ) {
      return null
    }
    throw error
  }
}

async function fetchText(
  url: URL,
  init: RequestInit | undefined,
  maximumBytes: number,
): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: init?.headers ?? { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  })
  if (!response.ok) {
    throw new VideoPlatformHttpError(response.status, url.hostname)
  }
  const contentLength = Number(response.headers.get("content-length") ?? 0)
  if (contentLength > maximumBytes) {
    throw new Error("视频平台返回的内容过大。")
  }
  const text = await response.text()
  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    throw new Error("视频平台返回的内容过大。")
  }
  return text
}

function assertTrustedUrl(url: URL, allowedDomains: string[]) {
  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== "https:" ||
    !allowedDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    )
  ) {
    throw new Error("字幕地址不属于受信任的视频平台。")
  }
}

function getFallbackTitle(url: URL): string {
  const segment = url.pathname.split("/").filter(Boolean).at(-1)
  if (!segment) {
    return url.hostname
  }
  try {
    return decodeURIComponent(segment)
      .replace(directVideoPattern, "")
      .replace(/[-_]+/gu, " ")
      .trim()
  } catch {
    return segment
  }
}

function readString(value: Record<string, unknown> | null, key: string): string | null {
  const result = value?.[key]
  return typeof result === "string" && result.trim() ? result.trim() : null
}

function readNumber(value: Record<string, unknown> | null, key: string): number | null {
  const result = value?.[key]
  return typeof result === "number" && Number.isFinite(result) ? result : null
}

function readRecord(
  value: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  const result = value?.[key]
  return result && typeof result === "object" && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
