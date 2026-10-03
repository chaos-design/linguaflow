"use client"

import {
  AccessibilityIcon,
  CheckIcon,
  CircleAlertIcon,
  ContrastIcon,
  CopyIcon,
  EyeIcon,
  FocusIcon,
  InfoIcon,
  PaletteIcon,
  PlusIcon,
  ShapesIcon,
  SunMoonIcon,
  TriangleAlertIcon,
  TypeIcon,
  Volume2Icon,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeading } from "../../components/page-heading"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table"
import { ReferenceSection } from "./reference-section"

interface Swatch {
  token: string
  use: string
  light: string
  dark: string
}

const palette: Swatch[] = [
  {
    token: "--background",
    use: "页面背景",
    light: "oklch(0.985 0.002 250)",
    dark: "oklch(0.145 0.01 255)",
  },
  {
    token: "--card",
    use: "卡片与面板",
    light: "oklch(1 0 0)",
    dark: "oklch(0.19 0.012 255)",
  },
  {
    token: "--foreground",
    use: "主文本",
    light: "oklch(0.18 0.012 255)",
    dark: "oklch(0.95 0.006 250)",
  },
  {
    token: "--muted",
    use: "弱背景",
    light: "oklch(0.96 0.005 250)",
    dark: "oklch(0.235 0.012 255)",
  },
  {
    token: "--muted-foreground",
    use: "辅助文本",
    light: "oklch(0.49 0.018 255)",
    dark: "oklch(0.69 0.018 250)",
  },
  {
    token: "--primary",
    use: "主操作",
    light: "oklch(0.48 0.2 257)",
    dark: "oklch(0.7 0.15 253)",
  },
  {
    token: "--accent",
    use: "选中与悬停",
    light: "oklch(0.93 0.022 253)",
    dark: "oklch(0.29 0.045 253)",
  },
  {
    token: "--border",
    use: "结构边框",
    light: "oklch(0.9 0.008 250)",
    dark: "oklch(0.3 0.014 255)",
  },
  {
    token: "--ring",
    use: "键盘焦点",
    light: "oklch(0.54 0.19 257)",
    dark: "oklch(0.68 0.14 253)",
  },
]

const principles = [
  {
    title: "中性层级优先",
    description: "背景、卡片、边框和文本主要依赖中性层级，颜色集中服务于操作与状态。",
    icon: ContrastIcon,
  },
  {
    title: "语义克制",
    description: "成功、警告、错误和信息色只表达真实状态，不承担纯装饰作用。",
    icon: ShapesIcon,
  },
  {
    title: "双主题对等",
    description: "深浅主题共享同一组语义名称，组件无需判断主题即可保持一致含义。",
    icon: SunMoonIcon,
  },
  {
    title: "对比度优先",
    description: "正文、字幕与高亮都先满足可读性，再考虑视觉强调。",
    icon: EyeIcon,
  },
]

const semanticColors = [
  {
    name: "Success",
    token: "--success",
    color: "#3cae70",
    description: "解析成功、已掌握",
    icon: CheckIcon,
    className: "text-success-foreground",
  },
  {
    name: "Warning",
    token: "--warning",
    color: "#d5a92f",
    description: "网络较慢、需要注意",
    icon: TriangleAlertIcon,
    className: "text-warning-foreground",
  },
  {
    name: "Destructive",
    token: "--destructive",
    color: "#dc3f45",
    description: "解析失败、删除操作",
    icon: CircleAlertIcon,
    className: "text-destructive",
  },
  {
    name: "Info",
    token: "--info",
    color: "#4f8fd8",
    description: "处理中、功能提示",
    icon: InfoIcon,
    className: "text-info-foreground",
  },
]

export function ColorSystemReference() {
  function copyToken(value: string) {
    void navigator.clipboard.writeText(value)
    toast.success(`已复制 ${value}`)
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 pb-8">
      <PageHeading
        eyebrow="DESIGN TOKENS / COLOR SYSTEM"
        title="配色与主题规范"
        description="LinguaFlow 的语义令牌、状态色、排版层级和无障碍约束。"
        icon={PaletteIcon}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              <SunMoonIcon aria-hidden="true" />
              Dark + Light
            </Badge>
            <Badge variant="outline">
              <AccessibilityIcon aria-hidden="true" />
              WCAG AA
            </Badge>
            <Badge variant="outline">
              <TypeIcon aria-hidden="true" />
              Avenir Next
            </Badge>
          </div>
        }
      />

      <ReferenceSection index="01" title="设计原则">
        <div className="grid gap-4 md:grid-cols-2">
          {principles.map(({ title, description, icon: Icon }) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon className="size-4" aria-hidden="true" />
                  {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </ReferenceSection>

      <ReferenceSection
        index="02"
        title="核心色板"
        description="每个语义 token 都有对等的浅色和深色取值。"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {palette.map((swatch) => (
            <Card key={swatch.token} className="overflow-hidden">
              <div className="grid h-20 grid-cols-2">
                <div style={{ background: swatch.light }} />
                <div style={{ background: swatch.dark }} />
              </div>
              <CardHeader>
                <CardTitle className="font-mono text-sm">{swatch.token}</CardTitle>
                <CardDescription>{swatch.use}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-xs">
                <button
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted"
                  onClick={() => copyToken(swatch.light)}
                >
                  <span className="truncate font-mono">{swatch.light}</span>
                  <CopyIcon className="size-3.5 shrink-0" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-muted-foreground hover:bg-muted"
                  onClick={() => copyToken(swatch.dark)}
                >
                  <span className="truncate font-mono">{swatch.dark}</span>
                  <CopyIcon className="size-3.5 shrink-0" aria-hidden="true" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </ReferenceSection>

      <ReferenceSection
        index="03"
        title="中性灰阶"
        description="结构层级从亮文本到深背景连续过渡。"
      >
        <div className="overflow-hidden rounded-md border">
          <div className="grid h-20 grid-cols-11">
            {[
              "#fafafa",
              "#e5e5e5",
              "#c7c7c7",
              "#a1a1a1",
              "#737373",
              "#525252",
              "#404040",
              "#343434",
              "#282828",
              "#171717",
              "#0a0a0a",
            ].map((color) => (
              <div key={color} style={{ background: color }} title={color} />
            ))}
          </div>
        </div>
      </ReferenceSection>

      <ReferenceSection index="04" title="语义状态色">
        <div className="grid gap-4 md:grid-cols-2">
          {semanticColors.map(
            ({ name, token, color, description, icon: Icon, className }) => (
              <Card key={name}>
                <div className="h-14" style={{ background: color }} />
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Icon className={`size-4 ${className}`} aria-hidden="true" />
                      {name}
                    </span>
                    <code className="text-xs text-muted-foreground">{token}</code>
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ),
          )}
        </div>
      </ReferenceSection>

      <ReferenceSection index="05" title="语义映射表">
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>浅色</TableHead>
                <TableHead>深色</TableHead>
                <TableHead>用途</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {palette.map((swatch) => (
                <TableRow key={swatch.token}>
                  <TableCell className="font-mono text-xs">{swatch.token}</TableCell>
                  <TableCell className="font-mono text-xs">{swatch.light}</TableCell>
                  <TableCell className="font-mono text-xs">{swatch.dark}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {swatch.use}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ReferenceSection>

      <ReferenceSection index="06" title="组件应用示例">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>操作层级</CardTitle>
              <CardDescription>主操作与次操作保持稳定对比。</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button>
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                加入生词本
              </Button>
              <Button variant="outline">
                <Volume2Icon data-icon="inline-start" aria-hidden="true" />
                朗读
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>字幕高亮</CardTitle>
              <CardDescription>高亮不降低正文的可读性。</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-md bg-muted p-4 text-sm leading-relaxed">
                The{" "}
                <mark className="rounded bg-accent px-1 text-accent-foreground">
                  ubiquitous
                </mark>{" "}
                nature of the internet.
              </p>
            </CardContent>
          </Card>
        </div>
      </ReferenceSection>

      <ReferenceSection index="07" title="其他令牌">
        <div className="grid gap-4 md:grid-cols-3">
          <TokenCard title="圆角" value="8px" detail="卡片与工具面板上限" />
          <TokenCard title="基础间距" value="4px" detail="4 / 8 / 12 / 16 / 24 / 32" />
          <TokenCard title="正文行高" value="1.55" detail="长时间字幕阅读" />
        </div>
      </ReferenceSection>

      <ReferenceSection index="08" title="无障碍">
        <Card>
          <CardContent className="divide-y">
            {[
              [EyeIcon, "正文与背景至少满足 WCAG AA 4.5:1。"],
              [FocusIcon, "键盘导航使用 ring token 显示清晰焦点。"],
              [ShapesIcon, "状态不只依赖颜色，同时提供图标和文字。"],
              [SunMoonIcon, "深浅主题保持相同语义和交互层级。"],
            ].map(([Icon, description]) => {
              const ItemIcon = Icon as typeof EyeIcon
              return (
                <div key={description as string} className="flex gap-3 py-4">
                  <ItemIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {description as string}
                  </p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </ReferenceSection>
    </div>
  )
}

function TokenCard({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="font-mono text-2xl">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}
