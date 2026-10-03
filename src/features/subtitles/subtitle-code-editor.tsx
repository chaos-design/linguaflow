"use client"

import Editor, { type BeforeMount, loader, type OnMount } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import { useTheme } from "next-themes"
import { cn } from "../../lib/utils"

const subtitleLanguageId = "linguaflow-subtitle"

const workerScope = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker: () => Worker
  }
}
workerScope.MonacoEnvironment = {
  getWorker: () =>
    new Worker(new URL("monaco-editor/editor/editor.worker.js", import.meta.url), {
      type: "module",
    }),
}
loader.config({ monaco })

const registerSubtitleLanguage: BeforeMount = (monaco) => {
  if (
    monaco.languages
      .getLanguages()
      .some((language: { id: string }) => language.id === subtitleLanguageId)
  ) {
    return
  }

  monaco.languages.register({ id: subtitleLanguageId })
  monaco.languages.setMonarchTokensProvider(subtitleLanguageId, {
    tokenizer: {
      root: [
        [/^WEBVTT(?:\s.*)?$/u, "keyword"],
        [/^(?:NOTE|STYLE|REGION)(?:\s.*)?$/u, "comment"],
        [
          /^(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?|\d+(?:\.\d+)?s)\s*(?:-->[-\s>]*|[-–—])?.*$/u,
          "number",
        ],
        [/^\s*(?:Time|时间)\s*[\t,|]/iu, "keyword"],
        [/"(?:[^"\\]|\\.)*"(?=\s*:)/u, "type.identifier"],
        [/\b(?:true|false|null)\b/u, "keyword"],
        [/\p{Script=Han}+/u, "string"],
      ],
    },
  })
}

export function SubtitleCodeEditor({
  id,
  labelId,
  value,
  disabled,
  invalid,
  onChange,
}: {
  id: string
  labelId: string
  value: string
  disabled: boolean
  invalid: boolean
  onChange: (value: string) => void
}) {
  const { resolvedTheme } = useTheme()

  const handleMount: OnMount = (editor) => {
    const input = editor.getDomNode()?.querySelector<HTMLElement>('[role="textbox"]')
    input?.setAttribute("id", id)
    input?.setAttribute("aria-labelledby", labelId)
  }

  return (
    <div
      data-slot="subtitle-code-editor"
      data-invalid={invalid || undefined}
      className={cn(
        "h-[min(48svh,34rem)] min-h-72 overflow-hidden rounded-md border border-input bg-background transition-[border-color,box-shadow]",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35",
        disabled && "cursor-not-allowed bg-input/50 opacity-50",
        invalid &&
          "border-destructive ring-2 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <Editor
        height="100%"
        language={subtitleLanguageId}
        theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
        value={value}
        beforeMount={registerSubtitleLanguage}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          accessibilitySupport: "auto",
          ariaLabel: "字幕内容",
          automaticLayout: true,
          bracketPairColorization: { enabled: true },
          contextmenu: true,
          cursorBlinking: "smooth",
          fontFamily:
            '"Geist Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
          fontLigatures: true,
          fontSize: 13,
          lineHeight: 21,
          lineNumbers: "on",
          minimap: { enabled: false },
          overviewRulerLanes: 0,
          padding: { top: 12, bottom: 12 },
          placeholder:
            "粘贴 SRT、WebVTT、JSON，或 Time / Subtitle / Machine Translation 表格",
          readOnly: disabled,
          renderLineHighlight: "line",
          scrollBeyondLastLine: false,
          stickyScroll: { enabled: false },
          tabSize: 2,
          wordWrap: "on",
        }}
      />
    </div>
  )
}
