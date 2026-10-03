"use client"

import Editor, { type BeforeMount, loader, type OnMount } from "@monaco-editor/react"
import * as monaco from "monaco-editor"
import { useTheme } from "next-themes"
import { cn } from "../../lib/utils"

const vocabularyImportLanguageId = "linguaflow-vocabulary-import"

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

const registerVocabularyImportLanguage: BeforeMount = (monacoApi) => {
  if (
    monacoApi.languages
      .getLanguages()
      .some((language: { id: string }) => language.id === vocabularyImportLanguageId)
  ) {
    return
  }

  monacoApi.languages.register({ id: vocabularyImportLanguageId })
  monacoApi.languages.setMonarchTokensProvider(vocabularyImportLanguageId, {
    tokenizer: {
      root: [
        [
          /^(?:word|term|单词|词条|词组|短语)(?=\s*(?:,|\t|$))|(?:part_of_speech|partofspeech|pos|词性|definition|英文释义|translation|definition_translation|中文释义|example|例句|example_translation|例句翻译)(?=\s*(?:,|\t|$))/iu,
          "keyword",
        ],
        [/^[a-z][a-z'-]*(?: [a-z][a-z'-]*){0,5}(?=\s*(?:,|\t|$))/iu, "type.identifier"],
        [/"(?:[^"]|"")*"/u, "string"],
        [/\p{Script=Han}+/u, "string"],
        [/[,，\t]/u, "delimiter"],
      ],
    },
  })
}

export function VocabularyImportEditor({
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
      data-slot="vocabulary-import-editor"
      data-invalid={invalid || undefined}
      className={cn(
        "h-80 min-h-64 overflow-hidden rounded-md border border-input bg-background transition-[border-color,box-shadow] sm:h-96",
        "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/35",
        disabled && "cursor-not-allowed bg-input/50 opacity-50",
        invalid &&
          "border-destructive ring-2 ring-destructive/20 focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <Editor
        height="100%"
        language={vocabularyImportLanguageId}
        theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
        value={value}
        beforeMount={registerVocabularyImportLanguage}
        onMount={handleMount}
        onChange={(nextValue) => onChange(nextValue ?? "")}
        options={{
          accessibilitySupport: "auto",
          ariaLabel: "批量导入词条内容",
          automaticLayout: true,
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
          placeholder: "apple, take part in，look forward to",
          readOnly: disabled,
          renderLineHighlight: "line",
          scrollBeyondLastLine: false,
          stickyScroll: { enabled: false },
          tabSize: 2,
          wordWrap: "off",
        }}
      />
    </div>
  )
}
