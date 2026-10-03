"use client"

import {
  ArrowRightIcon,
  CaptionsIcon,
  CheckIcon,
  CirclePlayIcon,
  ClipboardPasteIcon,
  FileTextIcon,
  FileVideoIcon,
  HistoryIcon,
  LayersIcon,
  LibraryIcon,
  Link2Icon,
  LoaderCircleIcon,
  PlayIcon,
  ScanSearchIcon,
  TvIcon,
  VideoIcon,
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { PageHeading } from "../../components/page-heading"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button, buttonVariants } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { Checkbox } from "../../components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "../../components/ui/input-group"
import { Progress } from "../../components/ui/progress"
import { Spinner } from "../../components/ui/spinner"
import { Textarea } from "../../components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { parseSubtitleFile } from "../../lib/subtitles"
import { importVideoFromUrl, inspectVideoLink } from "../../server/learning/actions"
import type {
  LearningCategory,
  LearningTag,
  VideoInspectionResult,
  VideoSummary,
} from "../../types/learning"
import { CategoryInput } from "../library/category-input"
import { ImportVideoDialog } from "../library/import-video-dialog"

const platforms = [
  { label: "YouTube", icon: CirclePlayIcon },
  { label: "Bilibili", icon: TvIcon },
  { label: "Vimeo", icon: VideoIcon },
  { label: "直链视频", icon: FileVideoIcon },
]

export function ImportWorkspace({
  recentVideos,
  categories,
  tags,
}: {
  recentVideos: VideoSummary[]
  categories: LearningCategory[]
  tags: LearningTag[]
}) {
  const router = useRouter()
  const subtitleInputRef = useRef<HTMLInputElement>(null)
  const defaultTagValue = tags
    .filter((tag) => tag.isDefault)
    .map((tag) => tag.name)
    .join(", ")
  const [url, setUrl] = useState("")
  const [inspectedVideo, setInspectedVideo] = useState<VideoInspectionResult | null>(
    null,
  )
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState("")
  const [tagValue, setTagValue] = useState(defaultTagValue)
  const [saveTagsAsDefault, setSaveTagsAsDefault] = useState(false)
  const [subtitle, setSubtitle] = useState<{
    name: string
    content: string
    cueCount: number
  } | null>(null)
  const [stage, setStage] = useState<"idle" | "inspecting" | "ready">("idle")
  const [refreshConfirmationOpen, setRefreshConfirmationOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function inspectUrl(nextUrl = url, forceRefresh = false) {
    const normalizedUrl = nextUrl.trim()
    if (!normalizedUrl) {
      toast.error("请先粘贴视频链接。")
      return
    }
    setStage("inspecting")
    setInspectedVideo(null)
    setSubtitle(null)
    startTransition(async () => {
      const result = await inspectVideoLink(normalizedUrl, { forceRefresh })
      if (!result.ok || !result.data) {
        setStage("idle")
        toast.error(result.message)
        return
      }
      setInspectedVideo(result.data)
      setTitle(result.data.title)
      setDescription(`从 ${result.data.provider} 导入`)
      setCategory(result.data.existingCategoryName ?? "")
      setUrl(result.data.sourceUrl)
      setStage("ready")
      if (result.data.cached && !forceRefresh) {
        setRefreshConfirmationOpen(true)
        toast.info(result.message)
      } else {
        setRefreshConfirmationOpen(false)
        toast.success(result.message)
      }
    })
  }

  async function readClipboard() {
    try {
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) {
        toast.error("剪贴板中没有可解析的链接。")
        return
      }
      setUrl(text)
      toast.success("链接已粘贴，请确认后再解析。")
    } catch {
      toast.error("无法读取剪贴板，请手动粘贴链接。")
    }
  }

  function importInspectedVideo() {
    if (!inspectedVideo) {
      return
    }
    startTransition(async () => {
      const result = await importVideoFromUrl(inspectedVideo.sourceUrl, {
        title,
        description,
        categoryName: category.trim() || undefined,
        tagNames: tagValue
          .split(/[,，]/u)
          .map((tag) => tag.trim())
          .filter(Boolean),
        saveTagsAsDefault,
        transcriptContent: subtitle?.content,
      })
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      toast.success(result.message)
      router.push(`/workspace/videos/${result.data.videoId}`)
      router.refresh()
    })
  }

  const progress = stage === "idle" ? 0 : stage === "inspecting" ? 55 : 100

  return (
    <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8">
      <PageHeading
        eyebrow="IMPORT / PARSE"
        title="导入视频"
        description="解析在线视频元数据与字幕，或关联不上传的本地视频文件。"
        icon={ScanSearchIcon}
        actions={
          <>
            <Link
              href="/workspace/import/batch"
              className={buttonVariants({ variant: "outline" })}
            >
              <LayersIcon data-icon="inline-start" aria-hidden="true" />
              批量导入
            </Link>
            <Link
              href="/workspace/library"
              className={buttonVariants({ variant: "outline" })}
            >
              <LibraryIcon data-icon="inline-start" aria-hidden="true" />
              打开资源库
            </Link>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card id="link-import">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2Icon className="size-4" aria-hidden="true" />
                链接导入
              </CardTitle>
              <CardDescription>
                YouTube、Bilibili、Vimeo 会读取公开元数据并探测可用字幕。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="video-url">视频链接 URL</FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <InputGroup className="flex-1">
                      <InputGroupInput
                        id="video-url"
                        type="url"
                        value={url}
                        placeholder="https://..."
                        onChange={(event) => setUrl(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            inspectUrl()
                          }
                        }}
                      />
                      <InputGroupAddon>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <InputGroupButton
                                size="icon-sm"
                                aria-label="读取剪贴板并粘贴"
                                disabled={isPending}
                                onClick={readClipboard}
                              />
                            }
                          >
                            <ClipboardPasteIcon aria-hidden="true" />
                          </TooltipTrigger>
                          <TooltipContent>读取剪贴板并粘贴</TooltipContent>
                        </Tooltip>
                      </InputGroupAddon>
                    </InputGroup>
                    <Button
                      type="button"
                      disabled={isPending}
                      onClick={() => inspectUrl()}
                    >
                      {stage === "inspecting" ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <ArrowRightIcon data-icon="inline-start" aria-hidden="true" />
                      )}
                      解析
                    </Button>
                  </div>
                  <FieldDescription>
                    解析阶段不会上传视频或创建资源记录；已存字幕会优先读取。
                  </FieldDescription>
                </Field>
              </FieldGroup>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                <span className="text-xs text-muted-foreground">支持来源</span>
                {platforms.map(({ label, icon: Icon }) => (
                  <Badge key={label} variant="secondary">
                    <Icon aria-hidden="true" />
                    {label}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {inspectedVideo ? (
            <Card>
              <CardHeader>
                <CardTitle>解析结果</CardTitle>
                <CardDescription>确认元数据后加入个人资源库。</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black sm:w-40">
                    <Image
                      src={
                        inspectedVideo.thumbnailUrl ??
                        "/images/linguaflow-course-cover.jpg"
                      }
                      alt=""
                      fill
                      sizes="160px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex min-w-0 flex-col justify-center gap-3">
                    <p className="truncate text-xs text-muted-foreground">
                      {inspectedVideo.sourceUrl}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{inspectedVideo.provider}</Badge>
                      {inspectedVideo.metadataLimited ? (
                        <Badge
                          variant="outline"
                          className="border-warning/40 bg-warning/15 text-warning-foreground"
                        >
                          元数据受限
                        </Badge>
                      ) : null}
                      {inspectedVideo.cached ? (
                        <Badge variant="secondary">已存解析</Badge>
                      ) : null}
                      {inspectedVideo.existingVideoId ? (
                        <Badge variant="outline">
                          <CheckIcon aria-hidden="true" />
                          已加入学习
                        </Badge>
                      ) : null}
                      {inspectedVideo.existingCategoryName ? (
                        <Badge variant="secondary">
                          {inspectedVideo.existingCategoryName}
                        </Badge>
                      ) : null}
                      {inspectedVideo.durationSeconds > 0 ? (
                        <Badge variant="outline">
                          {Math.round(inspectedVideo.durationSeconds / 60)} 分钟
                        </Badge>
                      ) : null}
                      {subtitle ? (
                        <Badge variant="secondary">
                          <CaptionsIcon aria-hidden="true" />
                          {subtitle.cueCount} 条字幕
                        </Badge>
                      ) : inspectedVideo.detectedCaptions ? (
                        <Badge variant="secondary">
                          <CaptionsIcon aria-hidden="true" />
                          自动解析 {inspectedVideo.detectedCaptions.cueCount} 条
                        </Badge>
                      ) : (
                        <Badge variant="outline">未检测到公开字幕</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="inspected-title">标题</FieldLabel>
                    <Input
                      id="inspected-title"
                      value={title}
                      maxLength={200}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="inspected-description">简介</FieldLabel>
                    <Textarea
                      id="inspected-description"
                      value={description}
                      maxLength={5000}
                      placeholder="记录来源、学习目标或内容概要"
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="inspected-category">分类</FieldLabel>
                      <CategoryInput
                        id="inspected-category"
                        categories={categories}
                        value={category}
                        maxLength={60}
                        placeholder="选择已有分类或输入新分类"
                        onValueChange={setCategory}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="inspected-tags">标签</FieldLabel>
                      <Input
                        id="inspected-tags"
                        value={tagValue}
                        maxLength={500}
                        placeholder="课程, 英语, 待复习"
                        onChange={(event) => setTagValue(event.target.value)}
                      />
                      <FieldDescription>逗号分隔，最多 12 个。</FieldDescription>
                    </Field>
                  </div>
                  <Field orientation="horizontal">
                    <Checkbox
                      id="save-default-tags"
                      checked={saveTagsAsDefault}
                      onCheckedChange={setSaveTagsAsDefault}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor="save-default-tags">
                        设为后续导入的默认标签
                      </FieldLabel>
                      <FieldDescription>
                        批量导入也会自动应用账户默认标签。
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldGroup>

                <div className="flex w-full min-w-0 flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <CaptionsIcon className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {subtitle?.name ??
                          (inspectedVideo.detectedCaptions
                            ? `${inspectedVideo.detectedCaptions.language} · 平台字幕`
                            : "可选：附加字幕或表格数据")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {subtitle
                          ? `${subtitle.cueCount} 条时间轴已就绪`
                          : inspectedVideo.detectedCaptions
                            ? `${inspectedVideo.detectedCaptions.cueCount} 条时间轴已保存，入库时会优先同步`
                            : "平台未公开字幕时，可手动附加或稍后补充"}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={() => subtitleInputRef.current?.click()}
                    >
                      <FileTextIcon data-icon="inline-start" aria-hidden="true" />
                      {subtitle || inspectedVideo.detectedCaptions
                        ? "替换字幕"
                        : "附加字幕"}
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 sm:flex-none"
                      disabled={isPending}
                      onClick={importInspectedVideo}
                    >
                      {isPending ? (
                        <Spinner data-icon="inline-start" />
                      ) : (
                        <PlayIcon data-icon="inline-start" aria-hidden="true" />
                      )}
                      {inspectedVideo.existingVideoId ? "更新并学习" : "加入并学习"}
                    </Button>
                  </div>
                </div>
                <input
                  ref={subtitleInputRef}
                  type="file"
                  accept=".srt,.vtt,.json,.csv,.tsv,.txt,text/vtt,application/x-subrip,application/json,text/csv,text/tab-separated-values,text/plain"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) {
                      return
                    }
                    if (file.size > 2_000_000) {
                      toast.error("字幕文件不能超过 2MB。")
                      return
                    }
                    void file.text().then((content) => {
                      const cueCount = parseSubtitleFile(content).length
                      if (cueCount === 0) {
                        setSubtitle(null)
                        toast.error("没有从字幕文件中解析出有效时间轴。")
                        return
                      }
                      setSubtitle({ name: file.name, content, cueCount })
                      toast.success(`已解析 ${cueCount} 条字幕。`)
                    })
                  }}
                />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileVideoIcon className="size-4" aria-hidden="true" />
                本地视频文件
              </CardTitle>
              <CardDescription>
                直接读取当前设备中的视频，不上传文件，也不限制单文件大小。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ImportVideoDialog categories={categories} tags={tags} />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {stage === "inspecting" ? (
                  <LoaderCircleIcon
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckIcon className="size-4" aria-hidden="true" />
                )}
                解析状态
              </CardTitle>
              <CardDescription>
                {stage === "idle"
                  ? "等待视频链接。"
                  : stage === "inspecting"
                    ? "正在读取元数据并探测公开字幕..."
                    : "视频信息与字幕状态已就绪。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Progress value={progress} />
              <div className="flex flex-col gap-3 text-sm">
                {[
                  ["校验公网 URL", stage !== "idle"],
                  ["识别视频平台", stage !== "idle"],
                  ["读取公开元数据", stage === "ready"],
                  ["探测平台字幕", stage === "ready"],
                  ["等待确认入库", stage === "ready"],
                ].map(([label, complete]) => (
                  <div key={label as string} className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-full border">
                      {complete ? (
                        <CheckIcon className="size-3.5" aria-hidden="true" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-muted-foreground" />
                      )}
                    </span>
                    <span>{label as string}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Alert>
            <CaptionsIcon aria-hidden="true" />
            <AlertTitle>字幕解析策略</AlertTitle>
            <AlertDescription>
              优先使用手动附加的字幕或表格数据；未附加时自动解析平台公开字幕。平台未公开字幕时不会生成伪造内容。
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="size-4" aria-hidden="true" />
                最近导入
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {recentVideos.slice(0, 4).map((video) => (
                <Link
                  key={video.id}
                  href={`/workspace/videos/${video.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted"
                >
                  <span className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-black">
                    <Image
                      src={video.thumbnailUrl ?? "/images/linguaflow-course-cover.jpg"}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{video.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {video.sourceType === "local"
                        ? "本地文件"
                        : video.sourceType === "upload"
                          ? "历史私有上传"
                          : "链接导入"}
                    </span>
                  </span>
                </Link>
              ))}
              {recentVideos.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  还没有导入记录
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={refreshConfirmationOpen} onOpenChange={setRefreshConfirmationOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>已存在解析结果</DialogTitle>
            <DialogDescription>
              默认继续使用 Supabase
              中保存的元数据和字幕。重新解析会访问视频平台，并仅更新缓存
              {inspectedVideo?.existingVideoId ? "和资源库中的原视频" : ""}
              ，不会创建重复视频。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefreshConfirmationOpen(false)}
            >
              使用已存结果
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => inspectUrl(inspectedVideo?.sourceUrl ?? url, true)}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              重新解析并更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
