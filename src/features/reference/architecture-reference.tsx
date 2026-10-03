import type { LucideIcon } from "lucide-react"
import {
  AudioLinesIcon,
  BookMarkedIcon,
  CaptionsIcon,
  CloudIcon,
  Code2Icon,
  CpuIcon,
  DatabaseIcon,
  GitForkIcon,
  MousePointerClickIcon,
  PanelRightIcon,
  PlayIcon,
  RepeatIcon,
  ScanSearchIcon,
  ShieldIcon,
  TrendingUpIcon,
} from "lucide-react"
import { PageHeading } from "../../components/page-heading"
import { Badge } from "../../components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import { ReferenceSection } from "./reference-section"

const architectureLayers = [
  {
    title: "内容脚本 · Content Script",
    description: "探测视频与字幕，捕获点词上下文并与页面播放器同步。",
    icon: Code2Icon,
  },
  {
    title: "后台服务 · Service Worker",
    description: "处理跨域字幕、音频抽取、Whisper 识别与词典缓存。",
    icon: CpuIcon,
  },
  {
    title: "学习界面 · Next UI",
    description: "渲染字幕、词典、生词本与 SM-2 复习工作流。",
    icon: PanelRightIcon,
  },
]

const parseSteps = [
  { label: "检测页面视频", detail: "video / source URL", icon: ScanSearchIcon },
  { label: "识别平台", detail: "host + source type", icon: GitForkIcon },
  { label: "获取字幕", detail: "WebVTT / TextTrack", icon: CaptionsIcon },
  { label: "ASR 回退", detail: "Whisper timestamp", icon: AudioLinesIcon },
  { label: "分词与比对", detail: "tokenize + vocabulary", icon: BookMarkedIcon },
  { label: "渲染学习面板", detail: "transcript + dictionary", icon: PanelRightIcon },
]

const sequence = [
  ["01", "页面加载后探测视频与来源", "detectVideo()"],
  ["02", "选择官方字幕、上传字幕或 ASR 策略", "resolveCaptionSource()"],
  ["03", "解析为带时间戳的 cue", "parseVtt()"],
  ["04", "分词并与生词本做本地比对", "annotateVocabulary()"],
  ["05", "点词时优先查询 IndexedDB", "lookupCache()"],
  ["06", "未命中时调用词典与翻译服务", "fetchDictionary()"],
  ["07", "收藏后进入间隔重复队列", "scheduleReview()"],
]

export function ArchitectureReference() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 pb-8">
      <PageHeading
        eyebrow="LINGUAFLOW / SYSTEM ARCHITECTURE"
        title="技术流程与数据流"
        description="从视频检测、字幕解析到点词查义与间隔重复的端到端技术模型。"
        icon={GitForkIcon}
        actions={
          <div className="flex flex-wrap gap-2">
            {["Content Script", "Background", "Whisper ASR", "Dictionary API"].map(
              (item) => (
                <Badge key={item} variant="outline" className="font-mono">
                  {item}
                </Badge>
              ),
            )}
          </div>
        }
      />

      <ReferenceSection
        index="01"
        title="系统总览"
        description="浏览器采集、后台处理和学习界面通过明确的数据边界协同。"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {architectureLayers.map(({ title, description, icon: Icon }) => (
            <Card key={title}>
              <CardHeader>
                <span className="mb-2 grid size-9 place-items-center rounded-md bg-muted">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </ReferenceSection>

      <ReferenceSection
        index="02"
        title="视频与字幕解析流程"
        description="主路径优先获取现有字幕，无字幕时进入 ASR 回退分支。"
      >
        <div className="overflow-x-auto rounded-lg border bg-card p-5">
          <div className="grid min-w-[960px] grid-cols-6 gap-3">
            {parseSteps.map(({ label, detail, icon: Icon }, index) => (
              <div key={label} className="relative">
                <div className="flex min-h-28 flex-col justify-between rounded-md border bg-background p-3">
                  <span className="grid size-8 place-items-center rounded-md bg-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {String(index + 1).padStart(2, "0")} · {label}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      {detail}
                    </p>
                  </div>
                </div>
                {index < parseSteps.length - 1 ? (
                  <span
                    className="absolute top-1/2 -right-3 w-3 border-t"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <AudioLinesIcon
              className="size-4 text-info-foreground"
              aria-hidden="true"
            />
            ASR 节点只在官方字幕和本地字幕均不可用时启用。
          </div>
        </div>
      </ReferenceSection>

      <ReferenceSection
        index="03"
        title="点词查义数据流"
        description="上下文、缓存与远端服务组合成低延迟查询管线。"
      >
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
          <FlowNode
            icon={MousePointerClickIcon}
            title="点击字幕单词"
            detail="word + sentence"
          />
          <FlowConnector />
          <FlowNode icon={DatabaseIcon} title="查询本地缓存" detail="IndexedDB" />
          <FlowConnector />
          <FlowNode icon={CloudIcon} title="远端回退" detail="Dictionary + Translate" />
        </div>
      </ReferenceSection>

      <ReferenceSection
        index="04"
        title="学习闭环"
        description="观看、查词、收藏、复习和掌握度提升构成持续反馈。"
      >
        <div className="grid gap-3 sm:grid-cols-5">
          {[
            [PlayIcon, "看视频"],
            [MousePointerClickIcon, "点词 / 句"],
            [BookMarkedIcon, "加入生词本"],
            [RepeatIcon, "间隔复习"],
            [TrendingUpIcon, "掌握度提升"],
          ].map(([Icon, label], index) => {
            const StepIcon = Icon as typeof PlayIcon
            return (
              <div
                key={label as string}
                className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border bg-card p-3 text-center"
              >
                <StepIcon className="size-4" aria-hidden="true" />
                <span className="text-sm font-medium">{label as string}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
            )
          })}
        </div>
      </ReferenceSection>

      <ReferenceSection index="05" title="权限与技术栈">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldIcon className="size-4" aria-hidden="true" />
                浏览器权限
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {[
                ["activeTab", "读取当前页面视频"],
                ["scripting", "注入探测与点词脚本"],
                ["storage", "保存生词与学习状态"],
                ["tabs", "同步页面与学习面板"],
              ].map(([permission, use]) => (
                <div key={permission} className="flex justify-between gap-4 py-3">
                  <code className="text-xs">{permission}</code>
                  <span className="text-right text-xs text-muted-foreground">
                    {use}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>技术栈</CardTitle>
              <CardDescription>前端、本地处理与云端数据层。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {[
                "Next.js 16",
                "React 19",
                "Manifest V3",
                "WebVTT",
                "Whisper",
                "IndexedDB",
                "Supabase",
                "SM-2",
              ].map((technology) => (
                <Badge key={technology} variant="secondary" className="font-mono">
                  {technology}
                </Badge>
              ))}
            </CardContent>
          </Card>
        </div>
      </ReferenceSection>

      <ReferenceSection index="06" title="时序简述">
        <Card>
          <CardContent className="divide-y p-0">
            {sequence.map(([index, description, code]) => (
              <div
                key={index}
                className="grid gap-2 px-5 py-3 sm:grid-cols-[32px_minmax(0,1fr)_auto]"
              >
                <span className="font-mono text-xs text-muted-foreground">{index}</span>
                <span className="text-sm">{description}</span>
                <code className="text-xs text-muted-foreground">{code}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </ReferenceSection>
    </div>
  )
}

function FlowNode({
  icon: Icon,
  title,
  detail,
}: {
  icon: LucideIcon
  title: string
  detail: string
}) {
  return (
    <Card>
      <CardHeader>
        <Icon className="size-4" aria-hidden="true" />
        <CardTitle>{title}</CardTitle>
        <CardDescription className="font-mono">{detail}</CardDescription>
      </CardHeader>
    </Card>
  )
}

function FlowConnector() {
  return (
    <span className="hidden w-8 border-t md:block" aria-hidden="true">
      <span className="sr-only">然后</span>
    </span>
  )
}
