"use client"

import {
  BotIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  MinusIcon,
  PaletteIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "../../components/ui/badge"
import { Button } from "../../components/ui/button"
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { Spinner } from "../../components/ui/spinner"
import { Switch } from "../../components/ui/switch"
import { normalizeLearningTagNames } from "../../lib/learning-tags"
import { cn } from "../../lib/utils"
import {
  renameLearningTag,
  saveLearningPreferences,
  validateAiModelConfig,
} from "../../server/learning/actions"
import {
  aiModelEndpointOptions,
  aiModelProviderOptions,
  defaultAiModelConfig,
  getAiEndpointPreview,
  getAiProviderDefaults,
  normalizeAiModelConfig,
  readStoredAiModelConfig,
  writeStoredAiModelConfig,
} from "../../shared/ai-model-config"
import { subtitleTranslationOptions } from "../../shared/translation-languages"
import type {
  AiModelConfigInput,
  AiModelProviderId,
  LearningPreferences,
  LearningTag,
  VocabularyWord,
} from "../../types/learning"

const themeItems = [
  { label: "跟随系统", value: "system" },
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
]

const captionSizeItems = [
  { label: "小", value: "small" },
  { label: "中", value: "medium" },
  { label: "大", value: "large" },
]

const settingsFieldGroupClassName =
  "gap-0 overflow-hidden rounded-md bg-card px-5 shadow-sm [&>[data-slot=field]]:flex-col [&>[data-slot=field]]:items-stretch [&>[data-slot=field]]:py-4 [&>[data-slot=field]+[data-slot=field]]:border-t sm:[&>[data-slot=field]]:flex-row sm:[&>[data-slot=field]]:items-center"

export function SettingsForm({
  initialPreferences,
  tags: initialTags,
  words,
}: {
  initialPreferences: LearningPreferences
  tags: LearningTag[]
  words: VocabularyWord[]
}) {
  const { theme = "system", setTheme } = useTheme()
  const calendarColorInputRef = useRef<HTMLInputElement>(null)
  const [preferences, setPreferences] =
    useState<LearningPreferences>(initialPreferences)
  const [tags, setTags] = useState<LearningTag[]>(initialTags)
  const [aiModelConfig, setAiModelConfig] =
    useState<AiModelConfigInput>(defaultAiModelConfig)
  const [aiValidationStatus, setAiValidationStatus] = useState<
    "idle" | "success" | "error"
  >("idle")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagName, setEditingTagName] = useState("")
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null)
  const [showAiApiKey, setShowAiApiKey] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isValidationPending, startValidationTransition] = useTransition()
  const [isTagPending, startTagTransition] = useTransition()

  useEffect(() => {
    setAiModelConfig(readStoredAiModelConfig())
    setMounted(true)
  }, [])

  function updatePreference<Key extends keyof LearningPreferences>(
    key: Key,
    value: LearningPreferences[Key],
  ) {
    setPreferences((current) => ({ ...current, [key]: value }))
  }

  function updateAiModelConfig<Key extends keyof AiModelConfigInput>(
    key: Key,
    value: AiModelConfigInput[Key],
  ) {
    setAiValidationStatus("idle")
    setAiModelConfig((current) => ({ ...current, [key]: value }))
  }

  function updateAiProvider(provider: AiModelProviderId) {
    const defaults = getAiProviderDefaults(provider)
    setAiValidationStatus("idle")
    setAiModelConfig((current) => ({
      ...current,
      provider,
      baseUrl: defaults.baseUrl || current.baseUrl,
      model: defaults.model || current.model,
      endpointKind: defaults.endpointKind,
    }))
  }

  function savePreferences() {
    startTransition(async () => {
      const normalizedAiConfig = normalizeAiModelConfig(aiModelConfig)
      writeStoredAiModelConfig(normalizedAiConfig)
      setAiModelConfig(normalizedAiConfig)

      const result = await saveLearningPreferences(preferences)
      if (!result.ok || !result.data) {
        toast.error(result.message)
        return
      }
      setPreferences(result.data)
      toast.success("偏好已同步，AI 配置已保存到本机。")
    })
  }

  function validateAiConfig() {
    const normalizedAiConfig = normalizeAiModelConfig(aiModelConfig)
    setAiModelConfig(normalizedAiConfig)
    setAiValidationStatus("idle")
    startValidationTransition(async () => {
      const result = await validateAiModelConfig(normalizedAiConfig)
      if (!result.ok) {
        setAiValidationStatus("error")
        toast.error(result.message)
        return
      }
      writeStoredAiModelConfig(normalizedAiConfig)
      setAiValidationStatus("success")
      toast.success(result.message)
    })
  }

  function exportCsv() {
    const header = [
      "word",
      "phonetic_uk",
      "phonetic_us",
      "definition",
      "definition_translation",
      "examples",
      "example_translations",
      "common_phrases",
      "etymology",
      "word_parts",
      "source",
      "added_at",
      "mastery",
    ]
    const rows = words.map((word) => [
      word.word,
      word.phoneticUk,
      word.phoneticUs,
      word.definition,
      word.definitionTranslation,
      word.examples.join(" | "),
      word.exampleTranslations
        .map((example) =>
          [example.text, example.translation].filter(Boolean).join(" => "),
        )
        .join(" | "),
      word.commonPhrases
        .map((phrase) =>
          [phrase.text, phrase.translation, phrase.note].filter(Boolean).join(" => "),
        )
        .join(" | "),
      [word.wordAnalysis.etymology, word.wordAnalysis.etymologyTranslation]
        .filter(Boolean)
        .join(" => "),
      word.wordAnalysis.parts
        .map((part) => `${part.kind}:${part.text}:${part.meaning}`)
        .join(" | "),
      word.sourceTitle,
      word.addedAt,
      word.mastery,
    ])
    downloadText(
      "linguaflow-vocabulary.csv",
      "text/csv;charset=utf-8",
      [header, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n"),
    )
    toast.success(`已导出 ${words.length} 个生词。`)
  }

  function exportAnki() {
    const rows = words.map((word) =>
      [
        `${word.word}${word.phoneticUk ? ` [UK] ${word.phoneticUk}` : ""}${
          word.phoneticUs ? ` [US] ${word.phoneticUs}` : ""
        }`,
        [
          word.definition,
          word.definitionTranslation,
          ...(word.exampleTranslations.length > 0
            ? word.exampleTranslations.map((example) =>
                [example.text, example.translation].filter(Boolean).join("<br>"),
              )
            : word.examples),
          ...word.commonPhrases.map((phrase) =>
            [phrase.text, phrase.translation, phrase.note].filter(Boolean).join("<br>"),
          ),
          word.sourceSentence,
          word.translation,
        ]
          .filter(Boolean)
          .join("<br>"),
        word.sourceTitle,
      ]
        .map(escapeTsvCell)
        .join("\t"),
    )
    downloadText(
      "linguaflow-anki.tsv",
      "text/tab-separated-values;charset=utf-8",
      rows.join("\n"),
    )
    toast.success(`已生成 ${words.length} 张 Anki 卡片。`)
  }

  function clearLocalCache() {
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith("linguaflow:cache:"),
    )
    for (const key of keys) {
      window.localStorage.removeItem(key)
    }
    toast.success(
      keys.length > 0 ? `已清除 ${keys.length} 项缓存。` : "没有可清理的缓存。",
    )
  }

  const aiConfigReady = Boolean(
    aiModelConfig.enabled &&
      aiModelConfig.baseUrl.trim() &&
      aiModelConfig.model.trim() &&
      aiModelConfig.apiKey.trim().length >= 8,
  )
  const endpointPreview = getAiEndpointPreview(aiModelConfig)
  const isTagMutationPending = isTagPending || Boolean(renamingTagId)
  const tagUsageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const word of words) {
      for (const tag of word.tags) {
        counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1)
      }
    }
    return counts
  }, [words])

  function beginRenameTag(tag: LearningTag) {
    setEditingTagId(tag.id)
    setEditingTagName(tag.name)
  }

  function cancelRenameTag() {
    setEditingTagId(null)
    setEditingTagName("")
  }

  function saveTagName(tag: LearningTag) {
    const tagNames = normalizeLearningTagNames([editingTagName])
    const [name] = tagNames
    if (!name) {
      toast.error("请输入标签名称。")
      return
    }
    if (tagNames.length > 1) {
      toast.error("一次只能重命名为一个标签。")
      return
    }
    if (name === tag.name) {
      cancelRenameTag()
      return
    }

    setRenamingTagId(tag.id)
    startTagTransition(async () => {
      try {
        const result = await renameLearningTag({ tagId: tag.id, name })
        if (!result.ok || !result.data) {
          toast.error(result.message)
          return
        }
        const nextTag = result.data.tag
        const nextPreferences = result.data.preferences
        setTags((current) =>
          current
            .map((item) => (item.id === nextTag.id ? nextTag : item))
            .toSorted((left, right) => left.name.localeCompare(right.name, "zh-CN")),
        )
        setPreferences((current) => ({
          ...current,
          defaultVideoTags: nextPreferences.defaultVideoTags,
        }))
        cancelRenameTag()
        toast.success(result.message)
      } finally {
        setRenamingTagId(null)
      }
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-8">
      <SettingsSection
        id="appearance"
        title="通用"
        description="界面外观与视频恢复行为。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>界面主题</FieldLabel>
              <FieldDescription>立即切换工作区的明暗外观。</FieldDescription>
            </FieldContent>
            <Select
              items={themeItems}
              value={mounted ? theme : "system"}
              onValueChange={(value) => setTheme(value ?? "system")}
            >
              <SelectTrigger className="w-40" disabled={!mounted}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {themeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>学习日历颜色</FieldLabel>
              <FieldDescription>设置学习活跃度从少到多使用的主色。</FieldDescription>
            </FieldContent>
            <div>
              <Button
                type="button"
                variant="outline"
                className="w-36 justify-start font-mono"
                aria-label={`选择学习日历颜色，当前为 ${preferences.calendarColor.toUpperCase()}`}
                onClick={() => calendarColorInputRef.current?.click()}
              >
                <span
                  className="size-4 rounded-sm ring-1 ring-foreground/15"
                  style={{ backgroundColor: preferences.calendarColor }}
                  aria-hidden="true"
                />
                {preferences.calendarColor.toUpperCase()}
                <PaletteIcon data-icon="inline-end" aria-hidden="true" />
              </Button>
              <input
                ref={calendarColorInputRef}
                type="color"
                value={preferences.calendarColor}
                tabIndex={-1}
                className="sr-only"
                aria-label="学习日历颜色取色盘"
                onChange={(event) =>
                  updatePreference("calendarColor", event.target.value)
                }
              />
            </div>
          </Field>
          <SwitchField
            id="resume-playback"
            label="断点续看"
            description="打开直传或视频直链时从最近位置继续。"
            checked={preferences.resumePlayback}
            onCheckedChange={(checked) => updatePreference("resumePlayback", checked)}
          />
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="captions"
        title="字幕显示"
        description="这些设置会直接作用于视频字幕面板。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>默认翻译语言</FieldLabel>
              <FieldDescription>
                默认不翻译；选择语言后仅翻译滚动到可视区的字幕。
              </FieldDescription>
            </FieldContent>
            <Select
              items={subtitleTranslationOptions}
              value={preferences.subtitleTranslationLanguage}
              onValueChange={(value) =>
                updatePreference("subtitleTranslationLanguage", value ?? "none")
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {subtitleTranslationOptions.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>字幕字号</FieldLabel>
              <FieldDescription>调整字幕面板中的原文字号。</FieldDescription>
            </FieldContent>
            <Select
              items={captionSizeItems}
              value={preferences.captionSize}
              onValueChange={(value) =>
                updatePreference(
                  "captionSize",
                  (value ?? "medium") as LearningPreferences["captionSize"],
                )
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {captionSizeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="learning"
        title="学习与复习"
        description="控制查词行为和每日复习队列。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          <CounterField
            label="每日复习目标"
            description="复习页每天最多载入的到期卡片数。"
            value={preferences.reviewTarget}
            min={5}
            max={100}
            onChange={(value) => updatePreference("reviewTarget", value)}
          />
          <CounterField
            label="新词每日排期"
            description="仅影响内置词库新词的复习日期分布，不限制收藏或导入数量。"
            value={preferences.dailyNewLimit}
            min={1}
            onChange={(value) => updatePreference("dailyNewLimit", value)}
          />
          <SwitchField
            id="auto-pause"
            label="点击生词自动暂停"
            description="使用原生视频播放器时，查词会暂停当前视频。"
            checked={preferences.autoPause}
            onCheckedChange={(checked) => updatePreference("autoPause", checked)}
          />
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="tags"
        title="标签管理"
        description="统一管理视频和生词复用的账户标签。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          {tags.length > 0 ? (
            tags.map((tag) => {
              const isEditing = editingTagId === tag.id
              const isRenaming = renamingTagId === tag.id
              const inputId = `learning-tag-${tag.id}`
              const normalizedEditingName = normalizeLearningTagNames([
                editingTagName,
              ])[0]

              return (
                <Field key={tag.id} orientation="horizontal">
                  <FieldContent>
                    <FieldLabel htmlFor={isEditing ? inputId : undefined}>
                      {isEditing ? (
                        "标签名称"
                      ) : (
                        <span className="flex flex-wrap items-center gap-2">
                          <span>{tag.name}</span>
                          {tag.isDefault ? (
                            <Badge variant="secondary">默认导入</Badge>
                          ) : null}
                        </span>
                      )}
                    </FieldLabel>
                    <FieldDescription>
                      已关联 {tagUsageCounts.get(tag.id) ?? 0}{" "}
                      个生词；重命名会同步影响资源库和生词本。
                    </FieldDescription>
                  </FieldContent>
                  {isEditing ? (
                    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:max-w-md">
                      <Input
                        id={inputId}
                        value={editingTagName}
                        disabled={isRenaming}
                        autoComplete="off"
                        aria-label={`修改标签 ${tag.name} 的名称`}
                        className="min-w-40 flex-1"
                        onChange={(event) => setEditingTagName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            saveTagName(tag)
                          }
                          if (event.key === "Escape") {
                            cancelRenameTag()
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!normalizedEditingName || isRenaming}
                        onClick={() => saveTagName(tag)}
                      >
                        {isRenaming ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <SaveIcon data-icon="inline-start" aria-hidden="true" />
                        )}
                        保存
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isRenaming}
                        onClick={cancelRenameTag}
                      >
                        <XIcon data-icon="inline-start" aria-hidden="true" />
                        取消
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isTagMutationPending}
                      onClick={() => beginRenameTag(tag)}
                    >
                      <PencilIcon data-icon="inline-start" aria-hidden="true" />
                      重命名
                    </Button>
                  )}
                </Field>
              )
            })
          ) : (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel>暂无标签</FieldLabel>
                <FieldDescription>
                  在导入视频或生词时添加标签后，可在这里统一重命名。
                </FieldDescription>
              </FieldContent>
              <Badge variant="outline">0 个标签</Badge>
            </Field>
          )}
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="dictionary"
        title="词典"
        description="当前零配置词典与发音能力。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>释义来源</FieldLabel>
              <FieldDescription>
                使用 FreeDictionaryAPI.com 英文释义，并补充 MyMemory 中文翻译。
              </FieldDescription>
            </FieldContent>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="outline">
                <CheckIcon aria-hidden="true" />
                FreeDictionaryAPI.com
              </Badge>
              <Badge variant="outline">
                <CheckIcon aria-hidden="true" />
                中文释义
              </Badge>
            </div>
          </Field>
          <SwitchField
            id="auto-pronounce"
            label="查词后自动发音"
            description="使用浏览器语音朗读查询到的单词。"
            checked={preferences.autoPronounce}
            onCheckedChange={(checked) => updatePreference("autoPronounce", checked)}
          />
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="ai-model"
        title="AI 词汇解析"
        description="配置保存在本机浏览器，用于生成双语词汇深度解析。"
      >
        <FieldGroup className="gap-4 rounded-md bg-card p-5 shadow-sm">
          <Field orientation="horizontal">
            <FieldContent>
              <div className="flex items-center gap-2">
                <FieldLabel htmlFor="ai-model-enabled">启用 AI 解析</FieldLabel>
                <Badge
                  variant="outline"
                  className={cn(
                    aiConfigReady && "border-success/30 bg-success/15",
                    aiValidationStatus === "error" &&
                      "border-destructive/35 bg-destructive/10 text-destructive",
                  )}
                >
                  {aiValidationStatus === "success" ? (
                    <CircleCheckIcon aria-hidden="true" />
                  ) : aiValidationStatus === "error" ? (
                    <CircleAlertIcon aria-hidden="true" />
                  ) : (
                    <BotIcon aria-hidden="true" />
                  )}
                  {aiValidationStatus === "success"
                    ? "验证通过"
                    : aiConfigReady
                      ? "本机已配置"
                      : "尚未配置"}
                </Badge>
              </div>
              <FieldDescription>
                全部模型配置仅保存在当前浏览器的 localStorage，不会写入数据库。
              </FieldDescription>
            </FieldContent>
            <Switch
              id="ai-model-enabled"
              checked={aiModelConfig.enabled}
              onCheckedChange={(checked) => updateAiModelConfig("enabled", checked)}
            />
          </Field>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="ai-provider">提供商</FieldLabel>
              <Select
                items={aiModelProviderOptions}
                value={aiModelConfig.provider}
                onValueChange={(value) =>
                  updateAiProvider((value ?? "openai") as AiModelProviderId)
                }
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {aiModelProviderOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-endpoint-kind">接口类型</FieldLabel>
              <Select
                items={aiModelEndpointOptions}
                value={aiModelConfig.endpointKind}
                disabled={aiModelConfig.provider === "custom"}
                onValueChange={(value) =>
                  updateAiModelConfig("endpointKind", value ?? "chat-completions")
                }
              >
                <SelectTrigger id="ai-endpoint-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {aiModelEndpointOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="ai-base-url">接口地址</FieldLabel>
              <Input
                id="ai-base-url"
                type="url"
                value={aiModelConfig.baseUrl}
                placeholder={
                  aiModelConfig.provider === "custom"
                    ? "https://example.com/v1/chat/completions"
                    : "https://api.openai.com/v1"
                }
                autoComplete="url"
                onChange={(event) => updateAiModelConfig("baseUrl", event.target.value)}
              />
              <FieldDescription>
                {aiModelConfig.provider === "custom"
                  ? "自定义配置会直接请求该完整地址，域名需由服务端管理员授权。"
                  : "填写服务根地址，系统会按接口类型拼接请求路径。"}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-model-name">模型</FieldLabel>
              <Input
                id="ai-model-name"
                value={aiModelConfig.model}
                placeholder="gpt-4.1-mini"
                autoComplete="off"
                onChange={(event) => updateAiModelConfig("model", event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ai-api-key">
                <KeyRoundIcon className="size-3.5" aria-hidden="true" />
                API 密钥
              </FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="ai-api-key"
                  type={showAiApiKey ? "text" : "password"}
                  value={aiModelConfig.apiKey}
                  placeholder="sk-..."
                  autoComplete="new-password"
                  onChange={(event) =>
                    updateAiModelConfig("apiKey", event.target.value)
                  }
                />
                <InputGroupAddon>
                  <InputGroupButton
                    size="icon-sm"
                    type="button"
                    aria-label={showAiApiKey ? "隐藏密钥" : "显示密钥"}
                    title={showAiApiKey ? "隐藏密钥" : "显示密钥"}
                    aria-pressed={showAiApiKey}
                    onClick={() => setShowAiApiKey((value) => !value)}
                  >
                    {showAiApiKey ? (
                      <EyeOffIcon aria-hidden="true" />
                    ) : (
                      <EyeIcon aria-hidden="true" />
                    )}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
          </FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>实际请求地址</FieldLabel>
              <FieldDescription className="break-all">
                {endpointPreview || "选择提供商并填写接口地址后自动生成。"}
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!aiConfigReady || isValidationPending}
              onClick={validateAiConfig}
            >
              {isValidationPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
              )}
              验证
            </Button>
          </Field>
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="video"
        title="视频源与解析"
        description="当前已实现的视频和字幕来源。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>链接平台</FieldLabel>
              <FieldDescription>读取公开元数据并使用平台嵌入播放器。</FieldDescription>
            </FieldContent>
            <div className="flex max-w-sm flex-wrap justify-end gap-2">
              {["YouTube", "Bilibili", "Vimeo", "视频直链"].map((platform) => (
                <Badge key={platform} variant="outline">
                  <CheckIcon aria-hidden="true" />
                  {platform}
                </Badge>
              ))}
            </div>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>字幕解析</FieldLabel>
              <FieldDescription>
                链接导入会探测平台公开字幕；附加字幕会优先解析并保存时间轴。
              </FieldDescription>
            </FieldContent>
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="secondary">
                <CheckIcon aria-hidden="true" />
                平台字幕
              </Badge>
              <Badge variant="outline">SRT / WebVTT</Badge>
            </div>
          </Field>
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="data"
        title="数据与导出"
        description="账户同步和可直接使用的生词备份。"
      >
        <FieldGroup className={settingsFieldGroupClassName}>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>数据存储</FieldLabel>
              <FieldDescription>
                视频、字幕、生词、复习和偏好由 Supabase 同步。
              </FieldDescription>
            </FieldContent>
            <Badge variant="outline">账户同步</Badge>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>导出生词本</FieldLabel>
              <FieldDescription>CSV 用于备份，TSV 可直接导入 Anki。</FieldDescription>
            </FieldContent>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={words.length === 0}
                onClick={exportCsv}
              >
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                disabled={words.length === 0}
                onClick={exportAnki}
              >
                <DownloadIcon data-icon="inline-start" aria-hidden="true" />
                Anki TSV
              </Button>
            </div>
          </Field>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel>清除本地缓存</FieldLabel>
              <FieldDescription>
                仅删除 `linguaflow:cache:*` 浏览器缓存。
              </FieldDescription>
            </FieldContent>
            <Button variant="outline" size="sm" type="button" onClick={clearLocalCache}>
              <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              清除缓存
            </Button>
          </Field>
        </FieldGroup>
      </SettingsSection>

      <SettingsSection
        id="shortcuts"
        title="快捷键"
        description="当前页面已启用的键盘操作。"
      >
        <ul className="divide-y rounded-md bg-card px-5 shadow-sm">
          {[
            ["复习卡翻面 / 翻译", ["Space"]],
            ["复习评分", ["1", "2", "3", "4"]],
            ["复习卡朗读", ["P"]],
            ["结束本轮复习", ["Esc"]],
            ["查看复习快捷键", ["?"]],
            ["播放器播放 / 暂停", ["Space"]],
          ].map(([label, keys]) => (
            <li
              key={label as string}
              className="flex min-h-14 items-center justify-between gap-4 py-3"
            >
              <span className="text-sm">{label as string}</span>
              <div className="flex gap-1.5">
                {(keys as string[]).map((key) => (
                  <kbd
                    key={key}
                    className="min-w-8 rounded-md border bg-muted px-2 py-1 text-center font-mono text-xs"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <div className="flex justify-end pt-2">
        <Button type="button" disabled={isPending} onClick={savePreferences}>
          {isPending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <SaveIcon data-icon="inline-start" aria-hidden="true" />
          )}
          保存更改
        </Button>
      </div>
    </div>
  )
}

function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-32">
      <header className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </header>
      {children}
    </section>
  )
}

function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </Field>
  )
}

function CounterField({
  label,
  description,
  value,
  min,
  max,
  step = 5,
  onChange,
}: {
  label: string
  description: string
  value: number
  min: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  function normalizeCounterValue(nextValue: number): number {
    const roundedValue = Number.isFinite(nextValue) ? Math.round(nextValue) : min
    const minimumValue = Math.max(min, roundedValue)
    return max === undefined ? minimumValue : Math.min(max, minimumValue)
  }

  return (
    <Field orientation="horizontal">
      <FieldContent>
        <FieldLabel>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <div className="flex items-center rounded-md border">
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={`减少${label}`}
          disabled={value <= min}
          onClick={() => onChange(normalizeCounterValue(value - step))}
        >
          <MinusIcon aria-hidden="true" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          aria-label={label}
          className="h-8 w-20 rounded-none border-y-0 text-center font-mono text-sm"
          onChange={(event) =>
            onChange(normalizeCounterValue(Number(event.target.value)))
          }
        />
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          aria-label={`增加${label}`}
          disabled={max !== undefined && value >= max}
          onClick={() => onChange(normalizeCounterValue(value + step))}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      </div>
    </Field>
  )
}

function escapeCsvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function escapeTsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/gu, " ").trim()
}

function downloadText(filename: string, mimeType: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
