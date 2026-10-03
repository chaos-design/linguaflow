import {
  BookOpenIcon,
  CaptionsIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleXIcon,
  InfoIcon,
  PauseIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  TriangleAlertIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import { PageHeading } from "../../components/page-heading"
import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "../../components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui/input-group"
import { Progress } from "../../components/ui/progress"
import { Skeleton } from "../../components/ui/skeleton"
import { Switch } from "../../components/ui/switch"
import { ReferenceSection } from "./reference-section"

const captions = [
  { time: "00:12", text: "We need to build a robust pipeline for the data." },
  {
    time: "00:15",
    text: "The gradient descent converges after several epochs.",
    active: true,
  },
  {
    time: "00:18",
    text: "This part has already been played.",
    dimmed: true,
  },
  {
    time: "00:21",
    text: "Please review the annotation before the meeting.",
    vocabulary: true,
  },
]

export function ComponentStatesReference() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 pb-8">
      <PageHeading
        eyebrow="DESIGN SYSTEM / STATES"
        title="场景与状态规范"
        description="播放器、字幕、查词、生词与设置控件的交互状态和边界场景。"
      />

      <ReferenceSection index="01" title="字幕行状态">
        <Card>
          <CardContent className="flex flex-col gap-1">
            {captions.map((caption) => (
              <div
                key={caption.time}
                className={[
                  "flex items-start gap-3 rounded-md px-3 py-2.5",
                  caption.active ? "border-l-2 border-primary bg-accent" : "",
                  caption.dimmed ? "text-muted-foreground" : "",
                ].join(" ")}
              >
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {caption.time}
                </span>
                <p className="text-sm leading-relaxed">
                  {caption.vocabulary ? (
                    <>
                      Please review the{" "}
                      <mark className="rounded bg-primary/15 px-1 text-foreground underline decoration-primary">
                        annotation
                      </mark>{" "}
                      before the meeting.
                    </>
                  ) : (
                    caption.text
                  )}
                </p>
                {caption.active ? (
                  <Badge className="ml-auto shrink-0">
                    <Volume2Icon aria-hidden="true" />
                    正在播放
                  </Badge>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </ReferenceSection>

      <ReferenceSection index="02" title="单词交互态">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-6">
            <WordState word="converge" label="默认" />
            <WordState word="gradient" label="悬停" className="bg-primary/15" />
            <WordState
              word="epoch"
              label="选中"
              className="bg-primary text-primary-foreground"
            />
            <WordState
              word="robust"
              label="已收藏"
              suffix={<CheckIcon className="size-3 text-success-foreground" />}
            />
            <WordState
              word="pipeline"
              label="查询中"
              className="bg-muted text-muted-foreground"
              suffix={
                <span className="size-1.5 animate-pulse rounded-full bg-current" />
              }
            />
          </CardContent>
        </Card>
      </ReferenceSection>

      <ReferenceSection index="03" title="词典加载与错误">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>加载中</CardTitle>
              <CardDescription>释义请求期间使用稳定尺寸的骨架。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>查询失败</CardTitle>
              <CardDescription>保留上下文并提供明确恢复动作。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              <CircleAlertIcon className="size-8 text-destructive" aria-hidden="true" />
              <p className="text-sm font-medium">未找到该词的释义</p>
              <Button variant="outline" size="sm">
                <RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
                重试
              </Button>
            </CardContent>
          </Card>
        </div>
      </ReferenceSection>

      <ReferenceSection index="04" title="空状态">
        <div className="grid gap-4 md:grid-cols-2">
          <Empty className="min-h-64 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>生词本还是空的</EmptyTitle>
              <EmptyDescription>在字幕中点击单词即可加入。</EmptyDescription>
            </EmptyHeader>
          </Empty>
          <Empty className="min-h-64 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>未找到匹配字幕</EmptyTitle>
              <EmptyDescription>换个关键词再试一次。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      </ReferenceSection>

      <ReferenceSection index="05" title="字幕搜索">
        <Card>
          <CardContent className="flex flex-col gap-4">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput value="gradient" readOnly aria-label="字幕搜索示例" />
            </InputGroup>
            <p className="text-xs text-muted-foreground">找到 3 处</p>
            {["00:15", "01:42", "03:07"].map((time) => (
              <div
                key={time}
                className="flex gap-3 rounded-md px-3 py-2 hover:bg-muted"
              >
                <span className="font-mono text-xs text-muted-foreground">{time}</span>
                <p className="text-sm">
                  We compute the{" "}
                  <mark className="rounded bg-primary/15 px-1 text-foreground">
                    gradient
                  </mark>{" "}
                  at each step.
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </ReferenceSection>

      <ReferenceSection index="06" title="通知">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert>
            <CheckCircleIcon className="text-success-foreground" aria-hidden="true" />
            <AlertTitle>已加入生词本</AlertTitle>
            <AlertDescription>卡片会进入明天的复习队列。</AlertDescription>
          </Alert>
          <Alert>
            <InfoIcon className="text-info-foreground" aria-hidden="true" />
            <AlertTitle>字幕已同步</AlertTitle>
            <AlertDescription>已定位到当前播放句。</AlertDescription>
          </Alert>
          <Alert>
            <TriangleAlertIcon className="text-warning-foreground" aria-hidden="true" />
            <AlertTitle>网络较慢</AlertTitle>
            <AlertDescription>字幕仍在后台加载。</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <CircleXIcon aria-hidden="true" />
            <AlertTitle>视频源加载失败</AlertTitle>
            <AlertDescription>检查链接后重新解析。</AlertDescription>
          </Alert>
        </div>
      </ReferenceSection>

      <ReferenceSection index="07" title="播放器控制态">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>播放与字幕</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button size="icon" aria-label="播放">
                <PlayIcon aria-hidden="true" />
              </Button>
              <Button size="icon" aria-label="暂停">
                <PauseIcon aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" aria-label="静音">
                <VolumeXIcon aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" aria-label="有声">
                <Volume2Icon aria-hidden="true" />
              </Button>
              <Button>
                <CaptionsIcon data-icon="inline-start" aria-hidden="true" />
                CC
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>倍速菜单</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              {["0.5x", "0.75x", "1.0x", "1.25x", "1.5x", "2.0x"].map((speed) => (
                <Button
                  key={speed}
                  variant={speed === "1.0x" ? "secondary" : "ghost"}
                  size="sm"
                >
                  {speed}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </ReferenceSection>

      <ReferenceSection index="08" title="设置控件">
        <Card className="max-w-xl">
          <CardContent className="divide-y">
            <SettingRow label="双语字幕">
              <Switch defaultChecked aria-label="双语字幕" />
            </SettingRow>
            <SettingRow label="自动暂停生词">
              <Switch aria-label="自动暂停生词" />
            </SettingRow>
            <SettingRow label="显示音标">
              <Switch defaultChecked aria-label="显示音标" />
            </SettingRow>
            <SettingRow label="生词高亮强度">
              <div className="w-40">
                <Progress value={60} />
              </div>
            </SettingRow>
          </CardContent>
        </Card>
      </ReferenceSection>

      <ReferenceSection index="09" title="徽章与等级">
        <Card>
          <CardContent className="flex flex-wrap gap-2">
            {["CET-4", "CET-6", "GRE", "TOEFL", "雅思", "专八"].map((level) => (
              <Badge key={level} variant="secondary">
                {level}
              </Badge>
            ))}
            <Badge variant="outline">新词</Badge>
            <Badge variant="outline" className="border-info/30 text-info-foreground">
              学习中
            </Badge>
            <Badge
              variant="outline"
              className="border-success/30 text-success-foreground"
            >
              已掌握
            </Badge>
          </CardContent>
        </Card>
      </ReferenceSection>
    </div>
  )
}

function WordState({
  word,
  label,
  className = "",
  suffix,
}: {
  word: string
  label: string
  className?: string
  suffix?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={`inline-flex min-h-8 items-center gap-1 rounded px-2 text-sm ${className}`}
      >
        {word}
        {suffix}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}
