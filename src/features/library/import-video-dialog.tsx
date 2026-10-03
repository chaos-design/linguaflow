"use client"

import {
  CaptionsIcon,
  FileCheck2Icon,
  FileVideoIcon,
  FolderOpenIcon,
  HardDriveIcon,
  ScanSearchIcon,
  TagsIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useState,
  useTransition,
} from "react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import { Checkbox } from "../../components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Spinner } from "../../components/ui/spinner"
import { Textarea } from "../../components/ui/textarea"
import {
  chooseLocalVideoFile,
  getLocalVideoTitle,
  inspectLocalVideoFile,
  isFilePickerCancellation,
  type LocalVideoFileHandle,
  removeLocalVideoAsset,
  saveLocalVideoAsset,
  supportsPersistentLocalVideoAccess,
} from "../../lib/local-video-store"
import { parseSubtitleFile } from "../../lib/subtitles"
import { registerLocalVideo } from "../../server/learning/actions"
import type { LearningCategory, LearningTag } from "../../types/learning"
import { CategoryInput } from "./category-input"

const maximumSubtitleBytes = 2_000_000

interface SubtitleAttachment {
  name: string
  content: string
  cueCount: number
  source: "embedded" | "manual"
}

interface SelectedLocalVideo {
  file: File
  handle: LocalVideoFileHandle
  durationSeconds: number
}

interface ImportVideoDialogProps {
  categories?: LearningCategory[]
  tags?: LearningTag[]
}

function parseTagNames(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,，]/u)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 12)
}

function formatLocalFileSize(bytes: number): string {
  const gigabytes = bytes / 1024 / 1024 / 1024
  if (gigabytes >= 1) {
    return `${gigabytes.toFixed(gigabytes >= 10 ? 0 : 1)} GB`
  }
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} MB`
}

async function readSubtitleFile(file: File): Promise<SubtitleAttachment> {
  if (file.size > maximumSubtitleBytes) {
    throw new Error("字幕文件不能超过 2MB。")
  }
  const content = await file.text()
  const cueCount = parseSubtitleFile(content).length
  if (cueCount === 0) {
    throw new Error("没有从字幕文件中解析出有效时间轴。")
  }
  return { name: file.name, content, cueCount, source: "manual" }
}

async function readDroppedVideo(
  event: DragEvent<HTMLElement>,
): Promise<{ file: File; handle: LocalVideoFileHandle }> {
  event.preventDefault()
  const item = Array.from(event.dataTransfer.items).find(
    (candidate) => candidate.kind === "file" && candidate.type.startsWith("video/"),
  )
  if (!item) {
    throw new Error("请拖入 MP4、WebM、MOV 或 M4V 视频。")
  }
  const itemWithHandle = item as DataTransferItem & {
    getAsFileSystemHandle?: () => Promise<LocalVideoFileHandle | null>
  }
  const handle = await itemWithHandle.getAsFileSystemHandle?.()
  if (handle?.kind !== "file") {
    throw new Error("当前浏览器无法持久读取拖入的文件，请点击此区域选择视频。")
  }
  return { file: await handle.getFile(), handle }
}

export function ImportVideoDialog({
  categories = [],
  tags = [],
}: ImportVideoDialogProps) {
  const router = useRouter()
  const defaultTags = tags.filter((tag) => tag.isDefault)
  const initialTags = defaultTags.map((tag) => tag.name).join(", ")
  const [localTags, setLocalTags] = useState(initialTags)
  const [localCategory, setLocalCategory] = useState("")
  const [localSubtitle, setLocalSubtitle] = useState<SubtitleAttachment | null>(null)
  const [selectedLocalVideo, setSelectedLocalVideo] =
    useState<SelectedLocalVideo | null>(null)
  const [localTitle, setLocalTitle] = useState("")
  const [saveLocalTags, setSaveLocalTags] = useState(false)
  const [localFileAccessSupported, setLocalFileAccessSupported] = useState<
    boolean | null
  >(null)
  const [isInspecting, setIsInspecting] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    setLocalFileAccessSupported(supportsPersistentLocalVideoAccess())
  }, [])

  async function inspectSelectedVideo(file: File, handle: LocalVideoFileHandle) {
    setIsInspecting(true)
    setLocalSubtitle(null)
    try {
      const inspection = await inspectLocalVideoFile(file)
      setSelectedLocalVideo({
        file,
        handle,
        durationSeconds: inspection.durationSeconds,
      })
      setLocalTitle((current) => current || getLocalVideoTitle(file.name))
      if (inspection.embeddedSubtitle) {
        setLocalSubtitle({
          name: `${inspection.embeddedSubtitle.language} · 内嵌字幕`,
          content: inspection.embeddedSubtitle.content,
          cueCount: inspection.embeddedSubtitle.cueCount,
          source: "embedded",
        })
        toast.success(`已从视频中解析 ${inspection.embeddedSubtitle.cueCount} 条字幕。`)
      } else {
        toast.info("视频信息已就绪，未检测到内嵌字幕。")
      }
    } finally {
      setIsInspecting(false)
    }
  }

  async function selectLocalVideo() {
    try {
      const selected = await chooseLocalVideoFile()
      await inspectSelectedVideo(selected.file, selected.handle)
    } catch (error) {
      if (!isFilePickerCancellation(error)) {
        toast.error(error instanceof Error ? error.message : "本地视频读取失败。")
      }
    }
  }

  async function dropLocalVideo(event: DragEvent<HTMLElement>) {
    try {
      const selected = await readDroppedVideo(event)
      await inspectSelectedVideo(selected.file, selected.handle)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "本地视频读取失败。")
    }
  }

  function submitLocalVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const localVideo = selectedLocalVideo
    if (!localVideo) {
      toast.error("请先关联本地视频文件。")
      return
    }

    startTransition(async () => {
      const localFileKey = crypto.randomUUID()
      try {
        await saveLocalVideoAsset({
          key: localFileKey,
          fileName: localVideo.file.name,
          size: localVideo.file.size,
          type: localVideo.file.type,
          lastModified: localVideo.file.lastModified,
          handle: localVideo.handle,
        })
        const result = await registerLocalVideo({
          localFileKey,
          title: localTitle,
          description: String(formData.get("description") ?? ""),
          categoryName: String(formData.get("category") ?? ""),
          tagNames: parseTagNames(localTags),
          saveTagsAsDefault: saveLocalTags,
          transcriptContent: localSubtitle?.content ?? "",
          durationSeconds: localVideo.durationSeconds,
        })
        if (!result.ok || !result.data) {
          await removeLocalVideoAsset(localFileKey)
          toast.error(result.message)
          return
        }
        toast.success(result.message)
        form.reset()
        setSelectedLocalVideo(null)
        setLocalTitle("")
        setLocalCategory("")
        setLocalSubtitle(null)
        router.push(`/workspace/videos/${result.data.videoId}`)
        router.refresh()
      } catch (error) {
        await removeLocalVideoAsset(localFileKey).catch(() => undefined)
        toast.error(error instanceof Error ? error.message : "本地视频关联失败。")
      }
    })
  }

  return (
    <form onSubmit={submitLocalVideo}>
      {localFileAccessSupported === false ? (
        <Alert variant="destructive" className="mb-4">
          <HardDriveIcon aria-hidden="true" />
          <AlertTitle>当前浏览器不支持持久读取本地文件</AlertTitle>
          <AlertDescription>请使用最新版 Chrome 或 Edge 打开此页面。</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel>视频文件</FieldLabel>
          <button
            type="button"
            className="flex min-h-24 w-full items-center gap-3 rounded-md border border-dashed border-success/55 bg-success/10 p-4 text-left text-foreground shadow-xs transition-colors hover:border-success hover:bg-success/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            disabled={isInspecting || localFileAccessSupported !== true}
            aria-label="关联本地视频"
            onClick={selectLocalVideo}
            onDragOver={(event) => event.preventDefault()}
            onDrop={dropLocalVideo}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-success/20 text-success">
              {isInspecting ? (
                <Spinner />
              ) : selectedLocalVideo ? (
                <FileCheck2Icon className="size-5" aria-hidden="true" />
              ) : (
                <FileVideoIcon className="size-5" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {isInspecting
                  ? "正在解析视频与内嵌字幕"
                  : (selectedLocalVideo?.file.name ?? "点击或拖入 MP4、WebM、MOV、M4V")}
              </span>
              <span className="block text-xs text-muted-foreground">
                {selectedLocalVideo
                  ? `${formatLocalFileSize(selectedLocalVideo.file.size)} · 文件保持在本机`
                  : "读取媒体信息并优先检测视频内嵌字幕"}
              </span>
            </span>
          </button>
          <FieldDescription>
            文件句柄仅保存在此浏览器；不会上传视频文件。
          </FieldDescription>
        </Field>

        {selectedLocalVideo ? (
          localSubtitle?.source === "embedded" ? (
            <Alert>
              <CaptionsIcon aria-hidden="true" />
              <AlertTitle>{localSubtitle.name}</AlertTitle>
              <AlertDescription>
                已自动解析 {localSubtitle.cueCount} 条时间轴，将随视频一并导入。
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <Alert>
                <ScanSearchIcon aria-hidden="true" />
                <AlertTitle>未检测到内嵌字幕</AlertTitle>
                <AlertDescription>
                  可在下方拖入字幕或表格数据文件，也可以稍后补充。
                </AlertDescription>
              </Alert>
              <SubtitleField
                id="local-subtitle"
                subtitle={localSubtitle}
                onSubtitleChange={setLocalSubtitle}
              />
            </>
          )
        ) : null}

        <Field>
          <FieldLabel htmlFor="local-title">标题</FieldLabel>
          <Input
            id="local-title"
            value={localTitle}
            maxLength={200}
            placeholder="输入清晰、可搜索的视频标题"
            required
            onChange={(event) => setLocalTitle(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="local-description">简介</FieldLabel>
          <Textarea
            id="local-description"
            name="description"
            maxLength={5000}
            placeholder="记录课程来源、学习目标或内容概要"
          />
        </Field>
        <TaxonomyFields
          idPrefix="local"
          categories={categories}
          defaultTags={defaultTags}
          categoryValue={localCategory}
          tagsValue={localTags}
          saveAsDefault={saveLocalTags}
          onCategoryChange={setLocalCategory}
          onTagsChange={setLocalTags}
          onSaveAsDefaultChange={setSaveLocalTags}
        />
      </FieldGroup>
      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          disabled={
            isPending ||
            isInspecting ||
            !selectedLocalVideo ||
            !localTitle.trim() ||
            localFileAccessSupported !== true
          }
        >
          {isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <FolderOpenIcon data-icon="inline-start" aria-hidden="true" />
          )}
          关联并打开
        </Button>
      </div>
    </form>
  )
}

function TaxonomyFields({
  idPrefix,
  categories,
  defaultTags,
  categoryValue,
  tagsValue,
  saveAsDefault,
  onCategoryChange,
  onTagsChange,
  onSaveAsDefaultChange,
}: {
  idPrefix: string
  categories: LearningCategory[]
  defaultTags: LearningTag[]
  categoryValue: string
  tagsValue: string
  saveAsDefault: boolean
  onCategoryChange: (value: string) => void
  onTagsChange: (value: string) => void
  onSaveAsDefaultChange: (checked: boolean) => void
}) {
  const rememberId = `${idPrefix}-remember-tags`

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-category`}>分类</FieldLabel>
          <CategoryInput
            id={`${idPrefix}-category`}
            name="category"
            categories={categories}
            value={categoryValue}
            maxLength={60}
            placeholder="选择现有分类或输入新分类"
            onValueChange={onCategoryChange}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-tags`}>视频标签</FieldLabel>
          <Input
            id={`${idPrefix}-tags`}
            name="tags"
            value={tagsValue}
            maxLength={500}
            placeholder="课程, 英语, 待复习"
            onChange={(event) => onTagsChange(event.target.value)}
          />
          <FieldDescription>逗号分隔，最多 12 个。</FieldDescription>
        </Field>
      </div>
      {defaultTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <TagsIcon className="size-3.5" aria-hidden="true" />
            当前默认
          </span>
          {defaultTags.map((tag) => (
            <Badge key={tag.id} variant="secondary">
              {tag.name}
            </Badge>
          ))}
        </div>
      ) : null}
      <Field orientation="horizontal">
        <Checkbox
          id={rememberId}
          checked={saveAsDefault}
          onCheckedChange={onSaveAsDefaultChange}
        />
        <FieldContent>
          <FieldLabel htmlFor={rememberId}>设为后续导入的默认标签</FieldLabel>
          <FieldDescription>
            勾选后，以当前标签替换账户原有的默认标签。
          </FieldDescription>
        </FieldContent>
      </Field>
    </>
  )
}

function SubtitleField({
  id,
  subtitle,
  onSubtitleChange,
}: {
  id: string
  subtitle: SubtitleAttachment | null
  onSubtitleChange: (subtitle: SubtitleAttachment | null) => void
}) {
  async function loadSubtitle(file: File) {
    try {
      const nextSubtitle = await readSubtitleFile(file)
      onSubtitleChange(nextSubtitle)
      toast.success(`已解析 ${nextSubtitle.cueCount} 条字幕。`)
    } catch (error) {
      onSubtitleChange(null)
      toast.error(error instanceof Error ? error.message : "字幕文件读取失败。")
    }
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>视频字幕</FieldLabel>
      <label
        className="flex min-h-20 cursor-pointer items-center gap-3 rounded-md border border-dashed border-info/50 bg-info/8 p-4 text-foreground shadow-xs transition-colors hover:border-info hover:bg-info/12 focus-within:ring-2 focus-within:ring-ring/40"
        htmlFor={id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (file) {
            void loadSubtitle(file)
          }
        }}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info/15 text-info-foreground">
          {subtitle ? (
            <FileCheck2Icon className="size-5" aria-hidden="true" />
          ) : (
            <CaptionsIcon className="size-5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {subtitle?.name ?? "点击或拖入字幕、JSON 或表格文件"}
          </span>
          <span className="block text-xs text-muted-foreground">
            {subtitle
              ? `${subtitle.cueCount} 条时间轴已就绪`
              : "最大 2MB；字幕文本会随学习记录保存"}
          </span>
        </span>
      </label>
      <Input
        id={id}
        className="sr-only"
        name="subtitleFile"
        type="file"
        accept=".srt,.vtt,.json,.csv,.tsv,.txt,text/vtt,application/x-subrip,application/json,text/csv,text/tab-separated-values,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) {
            void loadSubtitle(file)
          }
        }}
      />
    </Field>
  )
}
