"use client"

import {
  BookOpenIcon,
  CaptionsIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  FileQuestionIcon,
  FileUpIcon,
  FolderOpenIcon,
  HardDriveIcon,
  LanguagesIcon,
  LocateFixedIcon,
  NotebookPenIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  ScanLineIcon,
  SearchIcon,
  Trash2Icon,
  Volume2Icon,
  XIcon,
} from "lucide-react"
import Image from "next/image"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "../../components/ui/resizable"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "../../components/ui/select"
import { Separator } from "../../components/ui/separator"
import { Spinner } from "../../components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Textarea } from "../../components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { VocabularyTermHighlight } from "../../components/vocabulary-term-highlight"
import {
  readCachedDictionaryEntry,
  writeCachedDictionaryEntry,
} from "../../lib/dictionary-cache"
import { formatDuration } from "../../lib/format"
import {
  chooseLocalVideoFile,
  getLocalVideoAsset,
  isFilePickerCancellation,
  isSameLocalVideoFile,
  type LocalVideoAsset,
  saveLocalVideoAsset,
} from "../../lib/local-video-store"
import {
  cleanSubtitleText,
  getSubtitleSentenceContext,
  placeSubtitleTranslationsAtSentenceStart,
  selectSubtitleSentenceCueIds,
} from "../../lib/subtitles"
import { cn } from "../../lib/utils"
import {
  getVocabularyWordForms,
  normalizeVocabularyWordToken,
} from "../../lib/vocabulary-word-forms"
import {
  addVocabularyWord,
  createVideoNote,
  deleteVideoNote,
  lookupDictionary,
  saveVideoProgress,
  translateVideoTranscript,
  updateVideoNote,
} from "../../server/learning/actions"
import {
  getSubtitleTranslationLanguageLabel,
  subtitleTranslationOptions,
} from "../../shared/translation-languages"
import type {
  DictionaryEntry,
  LearningPreferences,
  SubtitleTranslationLanguage,
  SubtitleTranslationOption,
  TranscriptCue,
  VideoDetail,
  VideoNote,
} from "../../types/learning"
import { SubtitleImportSheet } from "../subtitles/subtitle-import-sheet"
import {
  type EmbeddedPlayerHandle,
  PostMessageEmbedPlayer,
} from "./post-message-embed-player"
import { YouTubeEmbedPlayer } from "./youtube-embed-player"

function isDirectVideoUrl(value: string | null): boolean {
  if (!value) {
    return false
  }
  try {
    const pathname = new URL(value).pathname.toLowerCase()
    return [".mp4", ".webm", ".mov", ".m4v"].some((suffix) => pathname.endsWith(suffix))
  } catch {
    return false
  }
}

type EmbedSource =
  | {
      provider: "youtube"
      url: string
      videoId: string
      startSeconds: number
    }
  | {
      provider: "bilibili" | "vimeo"
      url: string
      startSeconds: number
    }

const desktopPlayerLayoutQuery = "(min-width: 1024px)"
const dictionaryNoticeDurationMs = 3_200
const transcriptScrollKeys = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Home",
  "PageDown",
  "PageUp",
])

type DictionaryNoticeTone = "pending" | "success" | "error"
type LocalVideoStatus =
  | "idle"
  | "loading"
  | "ready"
  | "permission"
  | "missing"
  | "changed"
  | "error"

interface DictionaryNotice {
  id: number
  message: string
  tone: DictionaryNoticeTone
}

function isElementVisibleWithin(container: HTMLElement, element: HTMLElement): boolean {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return (
    elementRect.bottom > containerRect.top && elementRect.top < containerRect.bottom
  )
}

function scrollElementToCenter(
  container: HTMLElement,
  element: HTMLElement,
  behavior: ScrollBehavior,
) {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  const centeredTop =
    container.scrollTop +
    elementRect.top -
    containerRect.top -
    (container.clientHeight - elementRect.height) / 2
  container.scrollTo({ top: Math.max(0, centeredTop), behavior })
}

function getWordPartKindLabel(kind: "prefix" | "root" | "suffix" | "base"): string {
  if (kind === "prefix") {
    return "前缀"
  }
  if (kind === "root") {
    return "词根"
  }
  if (kind === "suffix") {
    return "后缀"
  }
  return "词基"
}

function isScrolledToActiveCueStart(
  container: HTMLElement,
  element: HTMLElement,
): boolean {
  const containerRect = container.getBoundingClientRect()
  const elementRect = element.getBoundingClientRect()
  return container.scrollTop <= 2 && elementRect.top <= containerRect.top + 24
}

function shouldResumeAutoScroll(
  container: HTMLElement,
  element: HTMLElement,
  wasOutsideViewport: boolean,
): boolean {
  if (!isElementVisibleWithin(container, element)) {
    return false
  }

  return wasOutsideViewport || isScrolledToActiveCueStart(container, element)
}

function subscribeToDesktopPlayerLayout(callback: () => void) {
  const mediaQuery = window.matchMedia(desktopPlayerLayoutQuery)
  mediaQuery.addEventListener("change", callback)
  return () => mediaQuery.removeEventListener("change", callback)
}

function getDesktopPlayerLayoutSnapshot() {
  return window.matchMedia(desktopPlayerLayoutQuery).matches
}

function getServerDesktopPlayerLayoutSnapshot() {
  return false
}

function getEmbedSource(
  value: string | null,
  startSeconds: number,
): EmbedSource | null {
  if (!value) {
    return null
  }
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const isYouTubeHost =
      host === "youtu.be" ||
      host === "youtube.com" ||
      host.endsWith(".youtube.com") ||
      host === "youtube-nocookie.com" ||
      host.endsWith(".youtube-nocookie.com")
    if (isYouTubeHost) {
      const videoId =
        host === "youtu.be"
          ? url.pathname.split("/").filter(Boolean)[0]
          : (url.searchParams.get("v") ??
            /\/(?:embed|live|shorts|v)\/([^/?]+)/u.exec(url.pathname)?.[1])
      return videoId
        ? {
            provider: "youtube",
            url: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?start=${Math.floor(
              startSeconds,
            )}&rel=0`,
            videoId,
            startSeconds,
          }
        : null
    }
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const videoId = url.pathname
        .split("/")
        .filter(Boolean)
        .find((part) => /^\d+$/u.test(part))
      if (!videoId) {
        return null
      }
      const embedUrl = new URL(`https://player.vimeo.com/video/${videoId}`)
      const privacyHash = url.searchParams.get("h")
      if (privacyHash) {
        embedUrl.searchParams.set("h", privacyHash)
      }
      return {
        provider: "vimeo",
        url: embedUrl.toString(),
        startSeconds,
      }
    }
    if (host === "bilibili.com" || host.endsWith(".bilibili.com")) {
      const bvid = /\/video\/(BV[a-zA-Z0-9]+)/u.exec(url.pathname)?.[1]
      return bvid
        ? {
            provider: "bilibili",
            url: `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(
              bvid,
            )}&t=${Math.max(0, Math.floor(startSeconds))}`,
            startSeconds,
          }
        : null
    }
    return null
  } catch {
    return null
  }
}

function EmbeddedVideoPlayer({
  source,
  title,
  playerRef,
  preferPostMessage,
  onTimeUpdate,
  onDurationChange,
  onPlaybackError,
  onPlaybackStop,
}: {
  source: EmbedSource
  title: string
  playerRef: { current: EmbeddedPlayerHandle | null }
  preferPostMessage: boolean
  onTimeUpdate: (seconds: number) => void
  onDurationChange: (seconds: number) => void
  onPlaybackError: (errorCode: number | null) => void
  onPlaybackStop: (seconds: number) => void
}) {
  if (source.provider === "youtube") {
    if (preferPostMessage) {
      return (
        <PostMessageEmbedPlayer
          source={{ provider: "youtube", videoId: source.videoId }}
          startSeconds={source.startSeconds}
          title={title}
          playerRef={playerRef}
          onTimeUpdate={onTimeUpdate}
          onDurationChange={onDurationChange}
          onPlaybackError={onPlaybackError}
          onPlaybackStop={onPlaybackStop}
        />
      )
    }

    return (
      <YouTubeEmbedPlayer
        key={source.videoId}
        videoId={source.videoId}
        startSeconds={source.startSeconds}
        title={title}
        playerRef={playerRef}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onPlaybackError={onPlaybackError}
        onPlaybackStop={onPlaybackStop}
      />
    )
  }

  if (source.provider === "vimeo") {
    return (
      <PostMessageEmbedPlayer
        source={{ provider: "vimeo", url: source.url }}
        startSeconds={source.startSeconds}
        title={title}
        playerRef={playerRef}
        onTimeUpdate={onTimeUpdate}
        onDurationChange={onDurationChange}
        onPlaybackError={onPlaybackError}
        onPlaybackStop={onPlaybackStop}
      />
    )
  }

  return (
    <iframe
      src={source.url}
      title={title}
      className="size-full border-0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  )
}

function LocalVideoAccessPanel({
  status,
  error,
  onAuthorize,
  onReconnect,
}: {
  status: LocalVideoStatus
  error: string
  onAuthorize: () => void
  onReconnect: () => void
}) {
  const title =
    status === "loading"
      ? "正在读取本地视频"
      : status === "permission"
        ? "需要重新授权本地文件"
        : status === "missing"
          ? "当前浏览器没有此文件的访问记录"
          : status === "changed"
            ? "本地文件已经变化"
            : "本地视频暂时无法读取"
  const description =
    status === "permission"
      ? "文件仍保留在设备中，授权后即可继续上次的学习进度。"
      : status === "missing"
        ? "请重新选择导入时使用的同一视频文件。"
        : status === "changed"
          ? "请选择名称、大小和修改时间与原记录一致的文件。"
          : status === "loading"
            ? "正在从浏览器保存的文件句柄恢复访问。"
            : error || "请重新选择原视频文件。"

  return (
    <div className="flex size-full items-center justify-center bg-black px-6 text-white">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <span className="grid size-14 place-items-center rounded-md bg-white/12 text-white">
          {status === "loading" ? (
            <Spinner className="size-5" />
          ) : (
            <HardDriveIcon className="size-6" aria-hidden="true" />
          )}
        </span>
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/70">{description}</p>
        </div>
        {status === "permission" ? (
          <Button type="button" variant="secondary" onClick={onAuthorize}>
            <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
            授权并继续
          </Button>
        ) : status !== "loading" ? (
          <Button type="button" variant="secondary" onClick={onReconnect}>
            <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
            重新选择原文件
          </Button>
        ) : null}
      </div>
    </div>
  )
}

export function VideoLearningPlayer({
  video,
  preferences,
}: {
  video: VideoDetail
  preferences: LearningPreferences
}) {
  const initialPositionRef = useRef(
    preferences.resumePlayback ? video.positionSeconds : 0,
  )
  const initialPosition = initialPositionRef.current
  const videoRef = useRef<HTMLVideoElement>(null)
  const embedPlayerRef = useRef<EmbeddedPlayerHandle | null>(null)
  const lastPlaybackTimeRef = useRef(initialPosition)
  const watchedSecondsRef = useRef(0)
  const resumeAfterDictionaryCloseRef = useRef(false)
  const [currentTime, setCurrentTime] = useState(initialPosition)
  const [duration, setDuration] = useState(video.durationSeconds)
  const [preferPostMessageEmbed, setPreferPostMessageEmbed] = useState(false)
  const [localVideoFile, setLocalVideoFile] = useState<File | null>(null)
  const [localPlaybackUrl, setLocalPlaybackUrl] = useState<string | null>(null)
  const [localVideoStatus, setLocalVideoStatus] = useState<LocalVideoStatus>(
    video.sourceType === "local" ? "loading" : "idle",
  )
  const [localVideoError, setLocalVideoError] = useState("")
  const isDesktopPlayerLayout = useSyncExternalStore(
    subscribeToDesktopPlayerLayout,
    getDesktopPlayerLayoutSnapshot,
    getServerDesktopPlayerLayoutSnapshot,
  )
  const detectedEmbedSource = getEmbedSource(video.sourceUrl, initialPosition)
  const isYouTubeSource = detectedEmbedSource?.provider === "youtube"
  const remotePlaybackUrl = isYouTubeSource
    ? null
    : (video.signedPlaybackUrl ??
      (isDirectVideoUrl(video.sourceUrl) ? video.sourceUrl : null))
  const playbackUrl =
    video.sourceType === "local" ? localPlaybackUrl : remotePlaybackUrl
  const embedSource = playbackUrl ? null : detectedEmbedSource

  useEffect(() => {
    if (video.sourceType !== "local" || !video.localFileKey) {
      return
    }
    let cancelled = false
    setLocalVideoStatus("loading")
    setLocalVideoError("")

    void getLocalVideoAsset(video.localFileKey)
      .then(async (asset) => {
        if (!asset) {
          if (!cancelled) {
            setLocalVideoStatus("missing")
          }
          return
        }
        const permission = await asset.handle.queryPermission({ mode: "read" })
        if (permission !== "granted") {
          if (!cancelled) {
            setLocalVideoStatus("permission")
          }
          return
        }
        const file = await asset.handle.getFile()
        if (!isSameLocalVideoFile(asset, file)) {
          if (!cancelled) {
            setLocalVideoStatus("changed")
          }
          return
        }
        if (!cancelled) {
          setLocalVideoFile(file)
          setLocalVideoStatus("ready")
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLocalVideoError(
            error instanceof Error ? error.message : "本地视频读取失败。",
          )
          setLocalVideoStatus("error")
        }
      })

    return () => {
      cancelled = true
    }
  }, [video.localFileKey, video.sourceType])

  useEffect(() => {
    if (!localVideoFile) {
      setLocalPlaybackUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(localVideoFile)
    setLocalPlaybackUrl(objectUrl)
    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [localVideoFile])

  async function authorizeLocalVideo() {
    if (!video.localFileKey) {
      return
    }
    setLocalVideoStatus("loading")
    setLocalVideoError("")
    try {
      const asset = await getLocalVideoAsset(video.localFileKey)
      if (!asset) {
        setLocalVideoStatus("missing")
        return
      }
      const permission = await asset.handle.requestPermission({ mode: "read" })
      if (permission !== "granted") {
        setLocalVideoStatus("permission")
        return
      }
      const file = await asset.handle.getFile()
      if (!isSameLocalVideoFile(asset, file)) {
        setLocalVideoStatus("changed")
        return
      }
      setLocalVideoFile(file)
      setLocalVideoStatus("ready")
    } catch (error) {
      setLocalVideoError(error instanceof Error ? error.message : "本地视频授权失败。")
      setLocalVideoStatus("error")
    }
  }

  async function reconnectLocalVideo() {
    if (!video.localFileKey) {
      return
    }
    try {
      const currentAsset = await getLocalVideoAsset(video.localFileKey)
      const selected = await chooseLocalVideoFile()
      if (currentAsset && !isSameLocalVideoFile(currentAsset, selected.file)) {
        setLocalVideoStatus("changed")
        toast.error("所选文件与原视频的名称、大小或修改时间不一致。")
        return
      }
      const asset: LocalVideoAsset = currentAsset ?? {
        key: video.localFileKey,
        fileName: selected.file.name,
        size: selected.file.size,
        type: selected.file.type,
        lastModified: selected.file.lastModified,
        handle: selected.handle,
      }
      await saveLocalVideoAsset({ ...asset, handle: selected.handle })
      setLocalVideoFile(selected.file)
      setLocalVideoStatus("ready")
      setLocalVideoError("")
    } catch (error) {
      if (!isFilePickerCancellation(error)) {
        setLocalVideoError(
          error instanceof Error ? error.message : "重新关联本地视频失败。",
        )
        setLocalVideoStatus("error")
      }
    }
  }

  function handleDictionaryLookupStart() {
    if (!preferences.autoPause) {
      return
    }

    const directVideo = videoRef.current
    const wasPlaying = directVideo
      ? !directVideo.paused && !directVideo.ended
      : (embedPlayerRef.current?.isPlaying() ?? false)
    if (!wasPlaying) {
      return
    }

    resumeAfterDictionaryCloseRef.current = true
    directVideo?.pause()
    embedPlayerRef.current?.pauseVideo()
  }

  function handleDictionaryClose() {
    if (!resumeAfterDictionaryCloseRef.current) {
      return
    }

    resumeAfterDictionaryCloseRef.current = false
    if (videoRef.current) {
      void videoRef.current.play()
    } else {
      embedPlayerRef.current?.playVideo()
    }
  }

  function persistProgress(positionSeconds = currentTime) {
    const watchedSeconds = Math.floor(watchedSecondsRef.current)
    if (watchedSeconds < 5 && positionSeconds === video.positionSeconds) {
      return
    }
    watchedSecondsRef.current = 0
    void saveVideoProgress({
      videoId: video.id,
      positionSeconds,
      durationSeconds: duration,
      watchedSeconds,
    }).then((result) => {
      if (!result.ok) {
        toast.error(result.message)
      }
    })
  }

  function recordPlaybackTime(nextTime: number) {
    const previousTime = lastPlaybackTimeRef.current
    const elapsed = nextTime - previousTime
    if (elapsed > 0 && elapsed < 2) {
      watchedSecondsRef.current += elapsed
    }
    lastPlaybackTimeRef.current = nextTime
    setCurrentTime(nextTime)
    if (watchedSecondsRef.current >= 20) {
      persistProgress(nextTime)
    }
  }

  function seekTo(seconds: number) {
    const nextTime = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds)
    lastPlaybackTimeRef.current = nextTime
    setCurrentTime(nextTime)
    if (videoRef.current) {
      videoRef.current.currentTime = nextTime
      void videoRef.current.play()
    } else if (embedPlayerRef.current) {
      embedPlayerRef.current.seekTo(nextTime, true)
      embedPlayerRef.current.playVideo()
    }
    persistProgress(nextTime)
  }

  return (
    <ResizablePanelGroup
      key={isDesktopPlayerLayout ? "desktop-player" : "mobile-player"}
      orientation={isDesktopPlayerLayout ? "horizontal" : "vertical"}
      className="h-full min-h-0 overflow-hidden bg-card [&>[data-panel]]:h-full [&>[data-panel]]:min-h-0"
    >
      <ResizablePanel
        id="video"
        defaultSize={isDesktopPlayerLayout ? "68%" : 350}
        minSize={isDesktopPlayerLayout ? 480 : 350}
        className="flex h-full min-h-0 overflow-hidden!"
      >
        <section className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="relative isolate flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
            {playbackUrl ? (
              // biome-ignore lint/a11y/useMediaCaption: Imported videos do not always include a caption track.
              <video
                ref={videoRef}
                className="size-full object-contain"
                controls
                preload="metadata"
                poster={video.thumbnailUrl ?? "/images/linguaflow-course-cover.jpg"}
                onLoadedMetadata={(event) => {
                  setDuration(Math.floor(event.currentTarget.duration))
                  event.currentTarget.currentTime = initialPosition
                }}
                onPause={(event) => persistProgress(event.currentTarget.currentTime)}
                onEnded={(event) => persistProgress(event.currentTarget.currentTime)}
                onTimeUpdate={(event) =>
                  recordPlaybackTime(event.currentTarget.currentTime)
                }
              >
                <source src={playbackUrl} />
              </video>
            ) : video.sourceType === "local" ? (
              <LocalVideoAccessPanel
                status={localVideoStatus}
                error={localVideoError}
                onAuthorize={() => void authorizeLocalVideo()}
                onReconnect={() => void reconnectLocalVideo()}
              />
            ) : embedSource ? (
              <EmbeddedVideoPlayer
                source={embedSource}
                title={`播放 ${video.title}`}
                playerRef={embedPlayerRef}
                preferPostMessage={preferPostMessageEmbed}
                onTimeUpdate={recordPlaybackTime}
                onDurationChange={setDuration}
                onPlaybackError={(errorCode) => {
                  if (errorCode !== null && embedSource.provider === "youtube") {
                    setPreferPostMessageEmbed(true)
                  }
                }}
                onPlaybackStop={persistProgress}
              />
            ) : (
              <>
                <Image
                  src={video.thumbnailUrl ?? "/images/linguaflow-course-cover.jpg"}
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 1280px) 100vw, 70vw"
                  className="object-cover opacity-75"
                />
                <span className="absolute inset-0 bg-black/35" />
                <div className="relative z-10 flex max-w-md flex-col items-center gap-4 px-6 text-center text-white">
                  <span className="grid size-14 place-items-center rounded-full bg-white/90 text-black">
                    <FileQuestionIcon className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-medium">这个链接不能在页面内直接播放</p>
                    <p className="mt-1 text-sm text-white/75">
                      前往视频来源观看，返回后仍可继续整理时间戳笔记。
                    </p>
                  </div>
                  {video.sourceUrl ? (
                    <a
                      href={video.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({ variant: "secondary" })}
                    >
                      打开视频来源
                      <ExternalLinkIcon data-icon="inline-end" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </>
            )}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3 border-t bg-card px-4 py-3">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold">{video.title}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{video.category?.name ?? "未分类"}</Badge>
                {video.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>
        </section>
      </ResizablePanel>

      <ResizableHandle
        aria-label={
          isDesktopPlayerLayout ? "调整视频区和功能区宽度" : "调整视频区和功能区高度"
        }
      />

      <ResizablePanel
        id="tools"
        defaultSize={isDesktopPlayerLayout ? "32%" : "58%"}
        minSize={isDesktopPlayerLayout ? 380 : 300}
        className="flex h-full min-h-0 overflow-hidden! lg:min-w-[380px]"
      >
        <NotesPanel
          video={video}
          currentTime={currentTime}
          preferences={preferences}
          onSeek={seekTo}
          onLookupStart={handleDictionaryLookupStart}
          onDictionaryClose={handleDictionaryClose}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function NotesPanel({
  video,
  currentTime,
  preferences,
  onSeek,
  onLookupStart,
  onDictionaryClose,
}: {
  video: VideoDetail
  currentTime: number
  preferences: LearningPreferences
  onSeek: (seconds: number) => void
  onLookupStart: () => void
  onDictionaryClose: () => void
}) {
  const transcriptScrollRef = useRef<HTMLElement>(null)
  const activeCueRef = useRef<HTMLDivElement>(null)
  const cueElementRefs = useRef(new Map<string, HTMLDivElement>())
  const translatingCueIdsRef = useRef(new Set<string>())
  const translationErrorLanguageRef = useRef<SubtitleTranslationLanguage | null>(null)
  const autoScrollRef = useRef(true)
  const autoScrollPauseReasonRef = useRef<"user-scroll" | "user-toggle" | null>(null)
  const activeCueWasOutsideViewportRef = useRef(false)
  const dictionaryLookupRequestRef = useRef(0)
  const addVocabularyRequestRef = useRef(0)
  const dictionaryNoticeIdRef = useRef(0)
  const [notes, setNotes] = useState(video.notes)
  const [transcriptCues, setTranscriptCues] = useState(() =>
    placeSubtitleTranslationsAtSentenceStart(
      video.transcriptCues.map((cue) => ({
        ...cue,
        text: cleanSubtitleText(cue.text),
        translation: cleanSubtitleText(cue.translation),
      })),
    ),
  )
  const [subtitleTranslationLanguage, setSubtitleTranslationLanguage] =
    useState<SubtitleTranslationOption>(preferences.subtitleTranslationLanguage)
  const [draft, setDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [transcriptQuery, setTranscriptQuery] = useState("")
  const [dictionaryWord, setDictionaryWord] = useState<string | null>(null)
  const [dictionaryEntry, setDictionaryEntry] = useState<DictionaryEntry | null>(null)
  const [dictionarySourceTab, setDictionarySourceTab] = useState("free-dictionary")
  const [selectedCue, setSelectedCue] = useState<TranscriptCue | null>(null)
  const [addedVocabularyId, setAddedVocabularyId] = useState<string | null>(null)
  const [dictionaryNotice, setDictionaryNotice] = useState<DictionaryNotice | null>(
    null,
  )
  const [autoScroll, setAutoScroll] = useState(true)
  const [locateRequestId, setLocateRequestId] = useState(0)
  const [activePanel, setActivePanel] = useState("transcript")
  const [subtitleSheetOpen, setSubtitleSheetOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isDictionaryPending, startDictionaryTransition] = useTransition()
  const [isVocabularyPending, startVocabularyTransition] = useTransition()
  const [isTranslationPending, startTranslationTransition] = useTransition()

  useEffect(() => {
    if (!dictionaryNotice) {
      return
    }

    const timeout = window.setTimeout(() => {
      setDictionaryNotice((current) =>
        current?.id === dictionaryNotice.id ? null : current,
      )
    }, dictionaryNoticeDurationMs)
    return () => window.clearTimeout(timeout)
  }, [dictionaryNotice])

  function showDictionaryNotice(message: string, tone: DictionaryNoticeTone) {
    dictionaryNoticeIdRef.current += 1
    setDictionaryNotice({
      id: dictionaryNoticeIdRef.current,
      message,
      tone,
    })
  }

  function locateActiveCue() {
    autoScrollRef.current = true
    autoScrollPauseReasonRef.current = null
    activeCueWasOutsideViewportRef.current = false
    setAutoScroll(true)
    setTranscriptQuery("")
    setLocateRequestId((current) => current + 1)
  }

  function handleCreateNote() {
    const content = draft.trim()
    if (!content) {
      return
    }
    startTransition(async () => {
      const result = await createVideoNote({
        videoId: video.id,
        timestampSeconds: currentTime,
        content,
      })
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      const timestamp = new Date().toISOString()
      const note: VideoNote = {
        id: result.data.noteId,
        videoId: video.id,
        timestampSeconds: Math.floor(currentTime),
        content,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      setNotes((current) =>
        [...current, note].toSorted(
          (left, right) => left.timestampSeconds - right.timestampSeconds,
        ),
      )
      setDraft("")
      toast.success(result.message)
    })
  }

  function handleUpdateNote(note: VideoNote) {
    const content = editingContent.trim()
    if (!content) {
      return
    }
    startTransition(async () => {
      const result = await updateVideoNote({
        noteId: note.id,
        videoId: video.id,
        content,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setNotes((current) =>
        current.map((item) => (item.id === note.id ? { ...item, content } : item)),
      )
      setEditingId(null)
      toast.success(result.message)
    })
  }

  function handleDeleteNote(note: VideoNote) {
    startTransition(async () => {
      const result = await deleteVideoNote({
        noteId: note.id,
        videoId: video.id,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setNotes((current) => current.filter((item) => item.id !== note.id))
      toast.success(result.message)
    })
  }

  function handleDictionaryLookup(word: string, cue: TranscriptCue) {
    const normalizedWord = word.replace(/[^a-z'-]/giu, "").toLocaleLowerCase("en")
    if (!normalizedWord) {
      return
    }
    onLookupStart()
    const requestId = dictionaryLookupRequestRef.current + 1
    dictionaryLookupRequestRef.current = requestId
    setDictionaryWord(normalizedWord)
    setDictionaryEntry(null)
    setDictionarySourceTab("free-dictionary")
    setSelectedCue(cue)
    setAddedVocabularyId(null)
    addVocabularyRequestRef.current += 1

    const cachedEntry = readCachedDictionaryEntry(normalizedWord)
    if (cachedEntry) {
      setDictionaryEntry(cachedEntry)
      setDictionarySourceTab(cachedEntry.sources[0]?.id ?? "free-dictionary")
      showDictionaryNotice(
        `已从缓存读取 ${cachedEntry.meanings.length} 条释义`,
        "success",
      )
      pronounceDictionaryEntry(cachedEntry)
      return
    }

    showDictionaryNotice(`正在查询 ${normalizedWord}...`, "pending")
    startDictionaryTransition(async () => {
      try {
        const result = await lookupDictionary(normalizedWord)
        if (dictionaryLookupRequestRef.current !== requestId) {
          return
        }
        if (!result.ok || !result.data) {
          showDictionaryNotice(result.message, "error")
          return
        }
        writeCachedDictionaryEntry(result.data)
        setDictionaryEntry(result.data)
        setDictionarySourceTab(result.data.sources[0]?.id ?? "free-dictionary")
        showDictionaryNotice(`已找到 ${result.data.meanings.length} 条释义`, "success")
        pronounceDictionaryEntry(result.data)
      } catch {
        if (dictionaryLookupRequestRef.current === requestId) {
          showDictionaryNotice("词典查询失败，请稍后重试。", "error")
        }
      }
    })
  }

  function pronounceDictionaryEntry(entry: DictionaryEntry) {
    if (!preferences.autoPronounce) {
      return
    }
    if (entry.audioUrl) {
      void new Audio(entry.audioUrl).play()
      return
    }
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(entry.word))
    }
  }

  function handleAddVocabulary() {
    if (!dictionaryEntry || !selectedCue) {
      return
    }
    const currentCue =
      transcriptCues.find((cue) => cue.id === selectedCue.id) ?? selectedCue
    const sentenceContext = getSubtitleSentenceContext(
      transcriptCues.map((cue) => ({
        ...cue,
        translation:
          subtitleTranslationLanguage !== "none" &&
          cue.translationLanguage === subtitleTranslationLanguage
            ? cue.translation
            : "",
      })),
      currentCue.id,
    )
    const requestId = addVocabularyRequestRef.current + 1
    addVocabularyRequestRef.current = requestId
    showDictionaryNotice(`正在将 ${dictionaryEntry.word} 加入生词本...`, "pending")
    startVocabularyTransition(async () => {
      try {
        const result = await addVocabularyWord({
          entry: dictionaryEntry,
          videoId: video.id,
          sourceTitle: video.title,
          timestampSeconds: sentenceContext?.startSeconds ?? currentCue.startSeconds,
          sourceSentence: sentenceContext?.text ?? currentCue.text,
          translation: sentenceContext?.translation ?? "",
        })
        if (addVocabularyRequestRef.current !== requestId) {
          return
        }
        if (!result.ok || !result.data) {
          showDictionaryNotice(result.message, "error")
          return
        }
        setAddedVocabularyId(result.data.vocabularyId)
        showDictionaryNotice(result.message, "success")
      } catch {
        if (addVocabularyRequestRef.current === requestId) {
          showDictionaryNotice("加入生词本失败，请检查网络后重试。", "error")
        }
      }
    })
  }

  const normalizedTranscriptQuery = transcriptQuery.trim().toLocaleLowerCase("en")
  const visibleCues = transcriptCues.filter((cue) =>
    normalizedTranscriptQuery
      ? `${cue.text} ${cue.translation}`
          .toLocaleLowerCase("en")
          .includes(normalizedTranscriptQuery)
      : true,
  )
  const highlightedWordForms = useMemo(() => {
    const forms = new Set<string>()
    if (dictionaryWord) {
      for (const form of getVocabularyWordForms(dictionaryWord)) {
        forms.add(form)
      }
    }
    if (dictionaryEntry?.word) {
      for (const form of getVocabularyWordForms(
        dictionaryEntry.word,
        dictionaryEntry.inflections.map((inflection) => inflection.value),
      )) {
        forms.add(form)
      }
    }
    return forms
  }, [dictionaryEntry, dictionaryWord])
  const supplementalExamples = dictionaryEntry?.supplementalExamples ?? []
  const commonPhrases = dictionaryEntry?.commonPhrases ?? []
  const selectedDictionarySource =
    dictionaryEntry?.sources.find((source) => source.id === dictionarySourceTab) ??
    dictionaryEntry?.sources[0] ??
    null
  let activeCueId: string | null = null
  for (const cue of transcriptCues) {
    if (cue.startSeconds > currentTime) {
      break
    }
    activeCueId = cue.id
  }

  useEffect(() => {
    const container = transcriptScrollRef.current
    if (
      activePanel !== "transcript" ||
      subtitleTranslationLanguage === "none" ||
      !container ||
      transcriptCues.length === 0
    ) {
      return
    }

    const targetLanguage = subtitleTranslationLanguage
    const cuesById = new Map(transcriptCues.map((cue) => [cue.id, cue]))
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleCueIds = entries
          .filter((entry) => entry.isIntersecting)
          .map((entry) => (entry.target as HTMLElement).dataset.cueId ?? "")
          .filter(Boolean)
        const cueIds = selectSubtitleSentenceCueIds(transcriptCues, visibleCueIds, 24)
        const requiresTranslation = cueIds.some(
          (cueId) => cuesById.get(cueId)?.translationLanguage !== targetLanguage,
        )
        const alreadyTranslating = cueIds.some((cueId) =>
          translatingCueIdsRef.current.has(cueId),
        )
        if (cueIds.length === 0 || !requiresTranslation || alreadyTranslating) {
          return
        }

        for (const cueId of cueIds) {
          translatingCueIdsRef.current.add(cueId)
        }
        startTranslationTransition(async () => {
          try {
            const result = await translateVideoTranscript({
              videoId: video.id,
              targetLanguage,
              cueIds,
            })
            if (!result.ok || !result.data) {
              if (translationErrorLanguageRef.current !== targetLanguage) {
                translationErrorLanguageRef.current = targetLanguage
                toast.error(result.message)
              }
              return
            }

            translationErrorLanguageRef.current = null
            const translations = new Map(
              result.data.translations.map((item) => [item.id, item]),
            )
            setTranscriptCues((current) =>
              placeSubtitleTranslationsAtSentenceStart(
                current.map((cue) => {
                  const translatedCue = translations.get(cue.id)
                  return translatedCue
                    ? {
                        ...cue,
                        translation: cleanSubtitleText(translatedCue.translation),
                        translationLanguage: translatedCue.translationLanguage,
                      }
                    : cue
                }),
              ),
            )
          } catch {
            if (translationErrorLanguageRef.current !== targetLanguage) {
              translationErrorLanguageRef.current = targetLanguage
              toast.error("字幕翻译请求失败，请稍后重试。")
            }
          } finally {
            for (const cueId of cueIds) {
              translatingCueIdsRef.current.delete(cueId)
            }
          }
        })
      },
      {
        root: container,
        rootMargin: "80px 0px",
        threshold: 0.01,
      },
    )

    for (const element of cueElementRefs.current.values()) {
      observer.observe(element)
    }
    return () => observer.disconnect()
  }, [activePanel, subtitleTranslationLanguage, transcriptCues, video.id])

  useEffect(() => {
    if (activePanel !== "transcript") {
      return
    }

    const container = transcriptScrollRef.current
    if (!container) {
      return
    }

    const handleManualScroll = () => {
      if (!autoScrollRef.current) {
        if (autoScrollPauseReasonRef.current === "user-scroll") {
          const activeCue = activeCueRef.current
          if (
            activeCue &&
            shouldResumeAutoScroll(
              container,
              activeCue,
              activeCueWasOutsideViewportRef.current,
            )
          ) {
            autoScrollRef.current = true
            autoScrollPauseReasonRef.current = null
            activeCueWasOutsideViewportRef.current = false
            setAutoScroll(true)
          }
        }
        return
      }

      autoScrollRef.current = false
      autoScrollPauseReasonRef.current = "user-scroll"
      activeCueWasOutsideViewportRef.current = false
      setAutoScroll(false)
    }
    const handleScroll = () => {
      if (autoScrollPauseReasonRef.current !== "user-scroll") {
        return
      }

      const activeCue = activeCueRef.current
      if (!activeCue) {
        return
      }
      if (!isElementVisibleWithin(container, activeCue)) {
        activeCueWasOutsideViewportRef.current = true
        return
      }
      if (
        !shouldResumeAutoScroll(
          container,
          activeCue,
          activeCueWasOutsideViewportRef.current,
        )
      ) {
        return
      }

      autoScrollRef.current = true
      autoScrollPauseReasonRef.current = null
      activeCueWasOutsideViewportRef.current = false
      setAutoScroll(true)
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target !== container) {
        return
      }
      const bounds = container.getBoundingClientRect()
      const scrollbarHitArea = Math.max(
        12,
        container.offsetWidth - container.clientWidth,
      )
      if (event.clientX >= bounds.right - scrollbarHitArea) {
        handleManualScroll()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (transcriptScrollKeys.has(event.key)) {
        handleManualScroll()
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    container.addEventListener("wheel", handleManualScroll, { passive: true })
    container.addEventListener("touchmove", handleManualScroll, { passive: true })
    container.addEventListener("pointerdown", handlePointerDown, { passive: true })
    container.addEventListener("keydown", handleKeyDown)
    return () => {
      container.removeEventListener("scroll", handleScroll)
      container.removeEventListener("wheel", handleManualScroll)
      container.removeEventListener("touchmove", handleManualScroll)
      container.removeEventListener("pointerdown", handlePointerDown)
      container.removeEventListener("keydown", handleKeyDown)
    }
  }, [activePanel])

  useEffect(() => {
    if (
      activePanel !== "transcript" ||
      autoScrollPauseReasonRef.current !== "user-scroll"
    ) {
      return
    }

    const container = transcriptScrollRef.current
    const activeCue = activeCueRef.current
    if (!activeCueId || !container || !activeCue) {
      return
    }

    if (
      shouldResumeAutoScroll(
        container,
        activeCue,
        activeCueWasOutsideViewportRef.current,
      )
    ) {
      autoScrollRef.current = true
      autoScrollPauseReasonRef.current = null
      activeCueWasOutsideViewportRef.current = false
      setAutoScroll(true)
    } else {
      activeCueWasOutsideViewportRef.current = true
    }
  }, [activeCueId, activePanel])

  useEffect(() => {
    const container = transcriptScrollRef.current
    const activeCue = activeCueRef.current
    if (
      activePanel !== "transcript" ||
      !autoScroll ||
      !activeCueId ||
      !container ||
      !activeCue
    ) {
      return
    }

    scrollElementToCenter(container, activeCue, "smooth")
  }, [activeCueId, activePanel, autoScroll])

  useEffect(() => {
    if (locateRequestId === 0) {
      return
    }

    const container = transcriptScrollRef.current
    const activeCue = activeCueRef.current
    if (!container || !activeCue) {
      return
    }
    scrollElementToCenter(container, activeCue, "smooth")
  }, [locateRequestId])

  return (
    <aside className="flex size-full min-h-0 min-w-0 flex-col overflow-hidden bg-card">
      <Tabs
        value={activePanel}
        onValueChange={(value) => setActivePanel(String(value))}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="sticky top-0 z-20 shrink-0 bg-card px-4 pt-4 shadow-sm">
          <TabsList variant="line" className="w-full justify-start">
            <TabsTrigger value="transcript" className="min-h-11 flex-1">
              字幕
            </TabsTrigger>
            <TabsTrigger value="notes" className="min-h-11 flex-1">
              笔记
              <Badge variant="secondary">{notes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="details" className="min-h-11 flex-1">
              信息
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="transcript" className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-15 flex-nowrap items-center gap-2 border-b p-3">
            <InputGroup className="min-w-0 flex-1">
              <InputGroupAddon className="text-foreground/70">
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="搜索字幕"
                value={transcriptQuery}
                placeholder="搜索字幕"
                onChange={(event) => setTranscriptQuery(event.target.value)}
              />
            </InputGroup>
            <Select
              items={subtitleTranslationOptions}
              value={subtitleTranslationLanguage}
              onValueChange={(value) => setSubtitleTranslationLanguage(value ?? "none")}
            >
              <Tooltip>
                <TooltipTrigger
                  render={
                    <SelectTrigger
                      className="size-9 shrink-0 justify-center rounded-md p-0 [&>svg:last-child]:hidden"
                      aria-label={`字幕翻译语言：${getSubtitleTranslationLanguageLabel(
                        subtitleTranslationLanguage,
                      )}`}
                      aria-busy={isTranslationPending}
                    />
                  }
                >
                  {isTranslationPending ? (
                    <Spinner />
                  ) : (
                    <LanguagesIcon aria-hidden="true" />
                  )}
                </TooltipTrigger>
                <TooltipContent>
                  翻译：
                  {getSubtitleTranslationLanguageLabel(subtitleTranslationLanguage)}
                </TooltipContent>
              </Tooltip>
              <SelectContent align="end" alignItemWithTrigger={false}>
                <SelectGroup>
                  {subtitleTranslationOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {isTranslationPending ? (
              <span className="sr-only" role="status">
                正在翻译可见字幕
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label="定位到当前字幕"
                    disabled={!activeCueId}
                    onClick={locateActiveCue}
                  />
                }
              >
                <LocateFixedIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                {activeCueId ? "定位到当前字幕" : "当前还没有播放字幕"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    type="button"
                    aria-label={transcriptCues.length > 0 ? "更新字幕" : "导入字幕"}
                    className="text-foreground/80"
                    onClick={() => setSubtitleSheetOpen(true)}
                  />
                }
              >
                <FileUpIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                {transcriptCues.length > 0 ? "更新字幕" : "导入字幕"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant={autoScroll ? "default" : "outline"}
                    size="icon"
                    type="button"
                    aria-label="字幕自动跟随"
                    aria-pressed={autoScroll}
                    className={cn(
                      autoScroll &&
                        "shadow-sm ring-2 ring-primary/30 hover:bg-primary/90",
                    )}
                    onClick={() => {
                      const nextAutoScroll = !autoScrollRef.current
                      autoScrollRef.current = nextAutoScroll
                      autoScrollPauseReasonRef.current = nextAutoScroll
                        ? null
                        : "user-toggle"
                      activeCueWasOutsideViewportRef.current = false
                      setAutoScroll(nextAutoScroll)
                    }}
                  />
                }
              >
                <ScanLineIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>
                {autoScroll ? "关闭字幕跟随" : "开启字幕跟随"}
              </TooltipContent>
            </Tooltip>
          </div>

          <section
            ref={transcriptScrollRef}
            aria-label="字幕列表"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          >
            {visibleCues.length > 0 ? (
              <div className="flex flex-col gap-1">
                {visibleCues.map((cue) => {
                  const active = cue.id === activeCueId
                  return (
                    <div
                      key={cue.id}
                      ref={(element) => {
                        if (element) {
                          cueElementRefs.current.set(cue.id, element)
                        } else {
                          cueElementRefs.current.delete(cue.id)
                        }
                        if (active) {
                          activeCueRef.current = element
                        }
                      }}
                      data-cue-id={cue.id}
                      className={cn(
                        "group/cue relative isolate flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted",
                        active && "border-l-2 border-info bg-info/10",
                      )}
                    >
                      <button
                        type="button"
                        className="absolute inset-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                        aria-label={`跳转到 ${formatDuration(cue.startSeconds)}`}
                        onClick={() => onSeek(cue.startSeconds)}
                      />
                      <button
                        type="button"
                        className={cn(
                          "relative z-10 shrink-0 rounded pt-1 font-mono text-xs text-muted-foreground hover:text-foreground",
                          active && "font-medium text-info-foreground",
                        )}
                        onClick={() => onSeek(cue.startSeconds)}
                      >
                        {formatDuration(cue.startSeconds)}
                      </button>
                      <div className="pointer-events-none relative z-10 min-w-0 flex-1">
                        <p
                          className={cn(
                            "leading-relaxed font-medium text-foreground/90",
                            preferences.captionSize === "small" && "text-sm",
                            preferences.captionSize === "medium" && "text-base",
                            preferences.captionSize === "large" && "text-lg",
                            active && "text-info-foreground",
                          )}
                        >
                          <InteractiveTranscriptText
                            cue={cue}
                            highlightedForms={highlightedWordForms}
                            onWordClick={handleDictionaryLookup}
                          />
                        </p>
                        {subtitleTranslationLanguage !== "none" &&
                        cue.translationLanguage === subtitleTranslationLanguage &&
                        cue.translation ? (
                          <p
                            className={cn(
                              "mt-1 text-sm leading-relaxed text-muted-foreground",
                              active && "text-info-foreground/80",
                            )}
                          >
                            {cue.translation}
                          </p>
                        ) : null}
                      </div>
                      {active ? (
                        <Volume2Icon
                          className="pointer-events-none relative z-10 mt-1 size-4 shrink-0 text-info-foreground"
                          aria-label="正在播放"
                        />
                      ) : null}
                    </div>
                  )
                })}
              </div>
            ) : (
              <Empty className="min-h-64">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    {transcriptCues.length === 0 ? <CaptionsIcon /> : <SearchIcon />}
                  </EmptyMedia>
                  <EmptyTitle>
                    {transcriptCues.length === 0 ? "还没有字幕" : "未找到匹配字幕"}
                  </EmptyTitle>
                  <EmptyDescription>
                    {transcriptCues.length === 0
                      ? "导入 SRT 或 VTT 后即可按时间轴查词。"
                      : "换个关键词再试一次。"}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </section>

          {dictionaryWord ? (
            <div className="flex max-h-[min(42svh,24rem)] shrink-0 flex-col overflow-hidden border-t bg-popover xl:max-h-[46%]">
              <div className="shrink-0 bg-popover px-3 py-2 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div
                    className="flex min-w-0 flex-1 items-center gap-2"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <p className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <BookOpenIcon className="size-3.5" aria-hidden="true" />
                      词典卡片
                      {dictionaryEntry ? (
                        <span>· {dictionaryEntry.meanings.length} 条释义</span>
                      ) : null}
                    </p>
                    {dictionaryNotice ? (
                      <p
                        key={dictionaryNotice.id}
                        role="status"
                        title={dictionaryNotice.message}
                        className={cn(
                          "flex min-w-0 max-w-full animate-in items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium fade-in-0 slide-in-from-top-1",
                          dictionaryNotice.tone === "pending" &&
                            "bg-info/15 text-info-foreground",
                          dictionaryNotice.tone === "success" &&
                            "bg-success/20 text-foreground [&>svg]:text-success",
                          dictionaryNotice.tone === "error" &&
                            "bg-destructive/10 text-destructive",
                        )}
                      >
                        {dictionaryNotice.tone === "pending" ? (
                          <Spinner className="size-3.5" />
                        ) : dictionaryNotice.tone === "success" ? (
                          <CircleCheckIcon className="size-3.5" aria-hidden="true" />
                        ) : (
                          <CircleAlertIcon className="size-3.5" aria-hidden="true" />
                        )}
                        <span className="truncate">{dictionaryNotice.message}</span>
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    type="button"
                    aria-label="关闭词典卡片"
                    onClick={() => {
                      dictionaryLookupRequestRef.current += 1
                      addVocabularyRequestRef.current += 1
                      setDictionaryWord(null)
                      setDictionaryEntry(null)
                      setDictionarySourceTab("free-dictionary")
                      setSelectedCue(null)
                      setAddedVocabularyId(null)
                      setDictionaryNotice(null)
                      onDictionaryClose()
                    }}
                  >
                    <XIcon aria-hidden="true" />
                  </Button>
                </div>
                <div className="mt-1.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold">{dictionaryWord}</p>
                    {dictionaryEntry ? (
                      <div className="mt-0.5 flex flex-col gap-0.5 font-mono text-xs leading-snug text-muted-foreground">
                        {dictionaryEntry.phoneticUk ? (
                          <span>
                            <span className="mr-1 font-sans text-foreground">英</span>
                            {dictionaryEntry.phoneticUk}
                          </span>
                        ) : null}
                        {dictionaryEntry.phoneticUs ? (
                          <span>
                            <span className="mr-1 font-sans text-foreground">美</span>
                            {dictionaryEntry.phoneticUs}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {(["uk", "us"] as const).map((region) => (
                      <Button
                        key={region}
                        variant="ghost"
                        size="xs"
                        type="button"
                        aria-label={`${region === "uk" ? "英式" : "美式"}朗读 ${dictionaryWord}`}
                        disabled={!dictionaryEntry}
                        onClick={() => {
                          const audioUrl =
                            region === "uk"
                              ? dictionaryEntry?.audioUrlUk
                              : dictionaryEntry?.audioUrlUs
                          if (audioUrl) {
                            void new Audio(audioUrl).play()
                          } else if ("speechSynthesis" in window) {
                            const utterance = new SpeechSynthesisUtterance(
                              dictionaryWord,
                            )
                            utterance.lang = region === "uk" ? "en-GB" : "en-US"
                            window.speechSynthesis.speak(utterance)
                          }
                        }}
                      >
                        <Volume2Icon data-icon="inline-start" aria-hidden="true" />
                        {region === "uk" ? "英" : "美"}
                      </Button>
                    ))}
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            type="button"
                            aria-label={
                              addedVocabularyId
                                ? `${dictionaryWord} 已在生词本中`
                                : `将 ${dictionaryWord} 加入生词本`
                            }
                            disabled={
                              isVocabularyPending ||
                              !dictionaryEntry ||
                              Boolean(addedVocabularyId)
                            }
                            onClick={handleAddVocabulary}
                          />
                        }
                      >
                        {isVocabularyPending ? (
                          <Spinner />
                        ) : addedVocabularyId ? (
                          <CheckIcon aria-hidden="true" />
                        ) : (
                          <PlusIcon aria-hidden="true" />
                        )}
                      </TooltipTrigger>
                      <TooltipContent>
                        {addedVocabularyId ? "已在生词本中" : "加入生词本"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 [scrollbar-gutter:stable]">
                {dictionaryEntry ? (
                  <div className="flex flex-col gap-3">
                    <Tabs
                      value={selectedDictionarySource?.id ?? dictionarySourceTab}
                      onValueChange={(value) => setDictionarySourceTab(String(value))}
                      className="gap-2"
                    >
                      <TabsList
                        variant="line"
                        className="sticky top-0 z-10 w-full justify-start overflow-x-auto bg-popover py-1 shadow-sm"
                      >
                        {dictionaryEntry.sources.map((source) => (
                          <TabsTrigger
                            key={source.id}
                            value={source.id}
                            className="w-48 flex-none"
                          >
                            {source.label}
                            {source.meanings.length > 0 ? (
                              <Badge variant="outline">{source.meanings.length}</Badge>
                            ) : null}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                      {selectedDictionarySource ? (
                        <TabsContent
                          value={selectedDictionarySource.id}
                          className="flex flex-col gap-2"
                        >
                          <p className="text-xs text-muted-foreground">
                            {selectedDictionarySource.description}
                          </p>
                          {selectedDictionarySource.meanings.length > 0 ? (
                            <ol className="flex flex-col gap-3">
                              {selectedDictionarySource.meanings.map(
                                (meaning, index) => (
                                  <li
                                    key={`${meaning.partOfSpeech}-${meaning.definition}`}
                                    className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2"
                                  >
                                    <span className="pt-0.5 font-mono text-xs text-muted-foreground">
                                      {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {meaning.partOfSpeech ? (
                                          <Badge
                                            variant="outline"
                                            className="border-info/30 bg-info/15 text-info-foreground"
                                          >
                                            {meaning.partOfSpeech}
                                          </Badge>
                                        ) : null}
                                        <p className="text-sm leading-relaxed font-medium">
                                          {meaning.translation || "中文释义暂不可用"}
                                        </p>
                                      </div>
                                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                        {meaning.definition}
                                      </p>
                                      {index < 2 && meaning.example ? (
                                        <div className="mt-1 flex flex-col gap-0.5 text-xs leading-relaxed">
                                          <p className="text-muted-foreground">
                                            <VocabularyTermHighlight
                                              text={meaning.example}
                                              word={dictionaryWord}
                                              inflections={dictionaryEntry.inflections.map(
                                                (inflection) => inflection.value,
                                              )}
                                            />
                                          </p>
                                          {meaning.exampleTranslation ? (
                                            <p className="text-foreground/80">
                                              {meaning.exampleTranslation}
                                            </p>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </li>
                                ),
                              )}
                            </ol>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              该来源提供相关词线索，当前没有额外释义。
                            </p>
                          )}
                        </TabsContent>
                      ) : null}
                    </Tabs>

                    {commonPhrases.length > 0 ? (
                      <>
                        <Separator />
                        <section className="flex flex-col gap-2">
                          <h3 className="text-xs font-medium text-muted-foreground">
                            常用词组
                          </h3>
                          <ul className="flex flex-col gap-2">
                            {commonPhrases.map((phrase) => (
                              <li
                                key={phrase.text}
                                className="rounded-md bg-muted/60 px-3 py-2 text-xs leading-relaxed"
                              >
                                <p className="font-mono text-foreground">
                                  <VocabularyTermHighlight
                                    text={phrase.text}
                                    word={dictionaryWord}
                                    highlightPhrase
                                  />
                                </p>
                                <p className="mt-1 text-foreground/80">
                                  {phrase.translation || "中文释义暂不可用"}
                                </p>
                                {phrase.note ? (
                                  <p className="mt-1 text-muted-foreground">
                                    {phrase.note}
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </section>
                      </>
                    ) : null}

                    {supplementalExamples.length > 0 ? (
                      <>
                        <Separator />
                        <section className="flex flex-col gap-2">
                          <h3 className="text-xs font-medium text-muted-foreground">
                            补充例句
                          </h3>
                          <ul className="flex flex-col gap-2">
                            {supplementalExamples.map((example, index) => (
                              <li
                                key={example.text}
                                className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-xs leading-relaxed"
                              >
                                <span className="font-mono text-muted-foreground/80">
                                  {index + 1}
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-muted-foreground">
                                    <VocabularyTermHighlight
                                      text={example.text}
                                      word={dictionaryWord}
                                      inflections={dictionaryEntry.inflections.map(
                                        (inflection) => inflection.value,
                                      )}
                                    />
                                  </span>
                                  {example.translation ? (
                                    <span className="mt-1 block text-foreground/80">
                                      {example.translation}
                                    </span>
                                  ) : null}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      </>
                    ) : null}

                    {dictionaryEntry.wordAnalysis.etymology ||
                    dictionaryEntry.wordAnalysis.parts.length > 0 ||
                    dictionaryEntry.wordAnalysis.relatedWords.length > 0 ? (
                      <>
                        <Separator />
                        <section className="flex flex-col gap-2">
                          <h3 className="text-xs font-medium text-muted-foreground">
                            词源与构词
                          </h3>
                          {dictionaryEntry.wordAnalysis.etymology ? (
                            <div className="text-xs leading-relaxed">
                              <p className="text-muted-foreground">
                                {dictionaryEntry.wordAnalysis.etymology}
                              </p>
                              {dictionaryEntry.wordAnalysis.etymologyTranslation ? (
                                <p className="mt-1 text-foreground/80">
                                  {dictionaryEntry.wordAnalysis.etymologyTranslation}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {dictionaryEntry.wordAnalysis.parts.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {dictionaryEntry.wordAnalysis.parts.map((part) => (
                                <Badge
                                  key={`${part.kind}-${part.text}`}
                                  variant="outline"
                                  className="h-auto max-w-full justify-start rounded-md py-1 whitespace-normal"
                                >
                                  <span className="font-medium">
                                    {getWordPartKindLabel(part.kind)} {part.text}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {part.meaning}
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {dictionaryEntry.wordAnalysis.relatedWords.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {dictionaryEntry.wordAnalysis.relatedWords.map(
                                (relatedWord) => (
                                  <Badge key={relatedWord} variant="secondary">
                                    {relatedWord}
                                  </Badge>
                                ),
                              )}
                            </div>
                          ) : null}
                        </section>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                    {isDictionaryPending ? (
                      <Spinner />
                    ) : (
                      <BookOpenIcon className="size-4" />
                    )}
                    {isDictionaryPending ? "正在查询公开词典..." : "未找到可用释义"}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col">
          <div className="border-b p-4">
            <FieldGroup>
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="new-note">添加时间戳笔记</FieldLabel>
                  <Badge variant="outline" className="font-mono">
                    {formatDuration(currentTime)}
                  </Badge>
                </div>
                <Textarea
                  id="new-note"
                  value={draft}
                  maxLength={4000}
                  placeholder="记录此刻的重点、问题或待办..."
                  onChange={(event) => setDraft(event.target.value)}
                />
              </Field>
              <Button
                type="button"
                size="sm"
                disabled={isPending || !draft.trim()}
                onClick={handleCreateNote}
              >
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                )}
                添加笔记
              </Button>
            </FieldGroup>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {notes.length > 0 ? (
              <ul className="divide-y">
                {notes.map((note) => (
                  <li key={note.id} className="flex flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Button
                        variant="secondary"
                        size="xs"
                        type="button"
                        className="font-mono"
                        onClick={() => onSeek(note.timestampSeconds)}
                      >
                        <PlayIcon data-icon="inline-start" aria-hidden="true" />
                        {formatDuration(note.timestampSeconds)}
                      </Button>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                type="button"
                                aria-label="编辑笔记"
                                onClick={() => {
                                  setEditingId(note.id)
                                  setEditingContent(note.content)
                                }}
                              />
                            }
                          >
                            <PencilIcon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>编辑笔记</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                type="button"
                                aria-label="删除笔记"
                                onClick={() => handleDeleteNote(note)}
                              />
                            }
                          >
                            <Trash2Icon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>删除笔记</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>

                    {editingId === note.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editingContent}
                          maxLength={4000}
                          onChange={(event) => setEditingContent(event.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => setEditingId(null)}
                          >
                            <XIcon data-icon="inline-start" aria-hidden="true" />
                            取消
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            disabled={isPending}
                            onClick={() => handleUpdateNote(note)}
                          >
                            <CheckIcon data-icon="inline-start" aria-hidden="true" />
                            保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {note.content}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty className="min-h-64">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <NotebookPenIcon />
                  </EmptyMedia>
                  <EmptyTitle>还没有笔记</EmptyTitle>
                  <EmptyDescription>
                    播放到关键位置时添加笔记，时间戳会自动记录。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        </TabsContent>

        <TabsContent
          value="details"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4"
        >
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">来源类型</dt>
              <dd className="mt-1">
                {video.sourceType === "local"
                  ? "本地视频文件"
                  : video.sourceType === "upload"
                    ? "历史私有上传"
                    : "在线视频链接"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">总时长</dt>
              <dd className="mt-1">{formatDuration(video.durationSeconds)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">当前进度</dt>
              <dd className="mt-1">{Math.round(video.completionPercent)}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">分类</dt>
              <dd className="mt-1">{video.category?.name ?? "未分类"}</dd>
            </div>
          </dl>
        </TabsContent>
      </Tabs>
      <SubtitleImportSheet
        open={subtitleSheetOpen}
        videoId={video.id}
        videoTitle={video.title}
        currentCueCount={transcriptCues.length}
        onOpenChange={setSubtitleSheetOpen}
        onImported={(cues) => {
          setTranscriptCues(
            placeSubtitleTranslationsAtSentenceStart(
              cues.map((cue) => ({
                ...cue,
                text: cleanSubtitleText(cue.text),
                translation: cleanSubtitleText(cue.translation),
              })),
            ),
          )
        }}
      />
    </aside>
  )
}

function InteractiveTranscriptText({
  cue,
  highlightedForms,
  onWordClick,
}: {
  cue: TranscriptCue
  highlightedForms: ReadonlySet<string>
  onWordClick: (word: string, cue: TranscriptCue) => void
}) {
  let offset = 0
  return cue.text.split(/([A-Za-z][A-Za-z'-]*)/gu).map((part) => {
    const key = `${offset}-${part}`
    offset += part.length
    if (!/^[A-Za-z][A-Za-z'-]*$/u.test(part)) {
      return <span key={key}>{part}</span>
    }

    const highlighted = highlightedForms.has(normalizeVocabularyWordToken(part))
    return (
      <button
        key={key}
        type="button"
        className={cn(
          "pointer-events-auto rounded px-0.5 transition-colors hover:bg-primary/15 hover:underline hover:decoration-dotted hover:underline-offset-2",
          highlighted &&
            "bg-warning/30 text-warning-foreground underline decoration-warning-foreground/70 underline-offset-2",
        )}
        onClick={() => onWordClick(part, cue)}
      >
        {part}
      </button>
    )
  })
}
