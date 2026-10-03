export interface ParsedSubtitleCue {
  startSeconds: number
  endSeconds: number
  text: string
  translation: string
}

export type SubtitleSourceFormat = "srt" | "webvtt" | "json" | "tabular" | "unknown"

export interface ParsedSubtitleDocument {
  cues: ParsedSubtitleCue[]
  format: SubtitleSourceFormat
}

export type SubtitleCueDiffStatus = "added" | "removed" | "changed" | "unchanged"

export interface SubtitleCueDiff<
  TOriginal extends ParsedSubtitleCue = ParsedSubtitleCue,
  TIncoming extends ParsedSubtitleCue = ParsedSubtitleCue,
> {
  key: string
  status: SubtitleCueDiffStatus
  original: TOriginal | null
  incoming: TIncoming | null
}

export interface SubtitleSentenceCue {
  id: string
  startSeconds: number
  endSeconds: number
  text: string
}

export interface SubtitleContextCue extends SubtitleSentenceCue {
  translation?: string
}

export interface SubtitleSentenceGroup {
  cues: SubtitleSentenceCue[]
  text: string
}

export interface SubtitleSentenceContext {
  startSeconds: number
  text: string
  translation: string
}

const timestampPattern =
  /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/u
const looseTimestampPattern = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/u
const secondsTimestampPattern = /^(\d+(?:\.\d+)?)\s*(?:s|sec|secs|second|seconds|秒)$/iu
const cjkPattern = /[\u3400-\u9fff]/u
const sentenceEndingPattern = /[.!?…]["')\]}]*$/u
const maximumSentenceTranslationLength = 420
const maximumSentenceGapSeconds = 2.5

export function parseSubtitleFile(content: string): ParsedSubtitleCue[] {
  return parseSubtitleDocument(content).cues
}

export function parseSubtitleDocument(content: string): ParsedSubtitleDocument {
  const normalized = content
    .replace(/^\uFEFF/u, "")
    .replace(/\r\n?/gu, "\n")
    .trim()

  if (!normalized) {
    return { cues: [], format: "unknown" }
  }

  const timedCues = parseTimedSubtitle(normalized)
  if (timedCues.length > 0) {
    return {
      cues: timedCues,
      format: normalized.startsWith("WEBVTT") ? "webvtt" : "srt",
    }
  }

  const jsonCues = parseSubtitleJson(normalized)
  if (jsonCues.length > 0) {
    return { cues: jsonCues, format: "json" }
  }

  const tabularCues = parseTabularSubtitle(normalized)
  if (tabularCues.length > 0) {
    return { cues: tabularCues, format: "tabular" }
  }

  return { cues: [], format: "unknown" }
}

function parseTimedSubtitle(normalized: string): ParsedSubtitleCue[] {
  const blocks = normalized.split(/\n{2,}/u)
  const cues: ParsedSubtitleCue[] = []

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    if (
      lines.length === 0 ||
      lines[0] === "WEBVTT" ||
      /^(NOTE|STYLE|REGION)(?:\s|$)/u.test(lines[0])
    ) {
      continue
    }

    const timestampIndex = lines.findIndex((line) => line.includes("-->"))
    if (timestampIndex < 0) {
      continue
    }
    const timestamps = parseTimestampLine(lines[timestampIndex])
    if (!timestamps) {
      continue
    }

    const cueLines = lines
      .slice(timestampIndex + 1)
      .map(cleanSubtitleText)
      .filter(Boolean)
    if (cueLines.length === 0) {
      continue
    }

    const translatedLines = cueLines.filter((line) => cjkPattern.test(line))
    const originalLines = cueLines.filter((line) => !cjkPattern.test(line))
    const text =
      originalLines.length > 0 ? originalLines.join(" ") : translatedLines.join(" ")
    const translation =
      originalLines.length > 0 && translatedLines.length > 0
        ? translatedLines.join(" ")
        : ""

    cues.push({
      ...timestamps,
      text: text.slice(0, 4000),
      translation: translation.slice(0, 4000),
    })
  }

  return normalizeCues(cues)
}

function parseSubtitleJson(content: string): ParsedSubtitleCue[] {
  if (!content.startsWith("{") && !content.startsWith("[")) {
    return []
  }

  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    return []
  }

  const root = asRecord(value)
  if (Array.isArray(root?.events)) {
    return parseYouTubeTranscript(value)
  }
  if (Array.isArray(root?.body)) {
    return parseBilibiliTranscript(value)
  }

  const items = Array.isArray(value)
    ? value
    : ["cues", "subtitles", "transcript", "captions", "data"].flatMap((key) => {
        const candidate = root?.[key]
        return Array.isArray(candidate) ? candidate : []
      })
  const cues = items.flatMap((item) => {
    const record = asRecord(item)
    if (!record) {
      return []
    }

    const startSeconds =
      readTimestampValue(record, [
        "startSeconds",
        "start_seconds",
        "startTime",
        "start_time",
        "start",
        "from",
        "time",
      ]) ?? readMillisecondsValue(record, ["startMs", "start_ms", "tStartMs"])
    if (startSeconds === null) {
      return []
    }

    const endSeconds =
      readTimestampValue(record, [
        "endSeconds",
        "end_seconds",
        "endTime",
        "end_time",
        "end",
        "to",
      ]) ?? readMillisecondsValue(record, ["endMs", "end_ms"])
    const durationSeconds =
      readTimestampValue(record, ["durationSeconds", "duration_seconds", "duration"]) ??
      readMillisecondsValue(record, ["durationMs", "duration_ms", "dDurationMs"])
    const text = readFirstString(record, [
      "text",
      "subtitle",
      "caption",
      "content",
      "original",
      "source",
    ])
    if (!text) {
      return []
    }

    return [
      {
        startSeconds,
        endSeconds:
          endSeconds ??
          (durationSeconds === null ? null : startSeconds + durationSeconds),
        text: cleanSubtitleText(text).slice(0, 4000),
        translation: cleanSubtitleText(
          readFirstString(record, [
            "translation",
            "translatedText",
            "translated_text",
            "machineTranslation",
            "machine_translation",
            "zh",
          ]) ?? "",
        ).slice(0, 4000),
      },
    ]
  })

  return finalizeLooseCues(cues)
}

function parseTabularSubtitle(content: string): ParsedSubtitleCue[] {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length < 2) {
    return []
  }

  const stackedCues = parseStackedSubtitleTable(lines)
  if (stackedCues.length > 0) {
    return stackedCues
  }

  const delimiter = detectTableDelimiter(lines)
  const rows = lines
    .filter((line) => !/^\|?\s*:?-{3,}/u.test(line))
    .map((line) =>
      delimiter ? parseDelimitedLine(line, delimiter) : parseSpacedTableLine(line),
    )
    .filter((row) => row.length > 0)
  const headerIndex = rows.findIndex(isSubtitleTableHeader)
  const header =
    headerIndex >= 0 ? createSubtitleColumnMap(rows[headerIndex]) : defaultColumnMap
  const dataRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 0)
  const cues: LooseSubtitleCue[] = []

  for (const row of dataRows) {
    const timeValue = row[header.time] ?? ""
    const timeRange = parseTableTimeRange(timeValue)
    if (!timeRange) {
      const previous = cues.at(-1)
      const continuation = row.filter(Boolean)
      if (previous && continuation.length > 0) {
        const text = continuation[header.text] ?? continuation[0] ?? ""
        const translation =
          continuation[header.translation] ??
          (continuation.length > 1 ? continuation.at(-1) : "")
        if (text && cjkPattern.test(text) && !translation) {
          previous.translation = joinSubtitleText(previous.translation, text)
        } else {
          previous.text = joinSubtitleText(previous.text, text)
          previous.translation = joinSubtitleText(
            previous.translation,
            translation ?? "",
          )
        }
      }
      continue
    }

    const text = cleanSubtitleText(row[header.text] ?? "")
    const translation = cleanSubtitleText(row[header.translation] ?? "")
    if (!text) {
      continue
    }

    cues.push({
      startSeconds: timeRange.startSeconds,
      endSeconds: timeRange.endSeconds ?? parseLooseTimestamp(row[header.end] ?? ""),
      text: text.slice(0, 4000),
      translation: translation.slice(0, 4000),
    })
  }

  return finalizeLooseCues(cues)
}

function parseStackedSubtitleTable(lines: string[]): ParsedSubtitleCue[] {
  const headerKinds = lines.slice(0, 3).map(getSubtitleColumnKind)
  const hasTranslationColumn = headerKinds[2] === "translation"
  if (
    headerKinds[0] !== "time" ||
    headerKinds[1] !== "text" ||
    (headerKinds[2] !== null && !hasTranslationColumn)
  ) {
    return []
  }

  const columnCount = hasTranslationColumn ? 3 : 2
  const cues: LooseSubtitleCue[] = []
  for (let index = columnCount; index < lines.length; index += columnCount) {
    const timeRange = parseTableTimeRange(lines[index] ?? "")
    const text = cleanSubtitleText(lines[index + 1] ?? "")
    if (!timeRange || !text) {
      return []
    }
    cues.push({
      startSeconds: timeRange.startSeconds,
      endSeconds: timeRange.endSeconds,
      text: text.slice(0, 4000),
      translation: cleanSubtitleText(
        hasTranslationColumn ? (lines[index + 2] ?? "") : "",
      ).slice(0, 4000),
    })
  }
  return finalizeLooseCues(cues)
}

interface LooseSubtitleCue {
  startSeconds: number
  endSeconds: number | null
  text: string
  translation: string
}

interface SubtitleColumnMap {
  time: number
  end: number
  text: number
  translation: number
}

const defaultColumnMap: SubtitleColumnMap = {
  time: 0,
  end: -1,
  text: 1,
  translation: 2,
}

function detectTableDelimiter(lines: string[]): "\t" | "|" | "," | ";" | null {
  if (lines.slice(0, 5).some((line) => line.includes("\t"))) {
    return "\t"
  }
  if (lines.slice(0, 5).some((line) => (line.match(/\|/gu) ?? []).length >= 2)) {
    return "|"
  }
  for (const delimiter of [",", ";"] as const) {
    const firstRows = lines
      .slice(0, 3)
      .map((line) => parseDelimitedLine(line, delimiter))
    if (firstRows.some(isSubtitleTableHeader)) {
      return delimiter
    }
  }
  return null
}

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (character === delimiter && !quoted) {
      cells.push(cell.trim())
      cell = ""
      continue
    }
    cell += character
  }
  cells.push(cell.trim())

  if (delimiter === "|") {
    if (!cells[0]) {
      cells.shift()
    }
    if (!cells.at(-1)) {
      cells.pop()
    }
  }
  return cells
}

function parseSpacedTableLine(line: string): string[] {
  if (/^time\s+subtitle\s+machine\s+translation$/iu.test(line)) {
    return ["Time", "Subtitle", "Machine Translation"]
  }
  if (/^时间\s+字幕\s+(?:机器)?翻译$/u.test(line)) {
    return ["时间", "字幕", "机器翻译"]
  }

  const spacedCells = line.split(/\s{2,}/u).map((cell) => cell.trim())
  if (spacedCells.length > 1) {
    return spacedCells
  }

  const timestampPrefix =
    /^((?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?|\d+(?:\.\d+)?\s*(?:s|sec|secs|second|seconds|秒))(?:\s*(?:-->|[-–—])\s*(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?|\d+(?:\.\d+)?\s*(?:s|sec|secs|second|seconds|秒)))?)\s+(.+)$/iu
  const match = timestampPrefix.exec(line)
  if (!match) {
    return [line]
  }

  const bilingualColumns = /^(.*?\S)\s{2,}(\p{Script=Han}.*)$/u.exec(match[2])
  return bilingualColumns
    ? [match[1], bilingualColumns[1], bilingualColumns[2]]
    : [match[1], match[2]]
}

function isSubtitleTableHeader(row: string[]): boolean {
  const columnKinds = row.map(getSubtitleColumnKind)
  return columnKinds.includes("time") && columnKinds.includes("text")
}

function createSubtitleColumnMap(row: string[]): SubtitleColumnMap {
  const columns = { ...defaultColumnMap }
  row.forEach((value, index) => {
    const kind = getSubtitleColumnKind(value)
    if (kind) {
      columns[kind] = index
    }
  })
  return columns
}

function getSubtitleColumnKind(value: string): keyof SubtitleColumnMap | null {
  const normalized = value.toLocaleLowerCase("en").replace(/[\s_-]+/gu, "")
  if (
    ["time", "timestamp", "start", "starttime", "时间", "开始", "开始时间"].includes(
      normalized,
    )
  ) {
    return "time"
  }
  if (["end", "endtime", "结束", "结束时间"].includes(normalized)) {
    return "end"
  }
  if (
    [
      "subtitle",
      "caption",
      "text",
      "source",
      "original",
      "originaltext",
      "字幕",
      "原文",
      "英文",
    ].includes(normalized)
  ) {
    return "text"
  }
  if (
    [
      "translation",
      "translatedtext",
      "machinetranslation",
      "译文",
      "翻译",
      "机器翻译",
      "中文",
    ].includes(normalized)
  ) {
    return "translation"
  }
  return null
}

function parseTableTimeRange(
  value: string,
): { startSeconds: number; endSeconds: number | null } | null {
  const parts = value.split(/\s*(?:-->|[–—]|\s-\s)\s*/u)
  const startSeconds = parseLooseTimestamp(parts[0] ?? "")
  if (startSeconds === null) {
    return null
  }
  return {
    startSeconds,
    endSeconds: parseLooseTimestamp(parts[1] ?? ""),
  }
}

function parseLooseTimestamp(value: string): number | null {
  const normalized = value.trim().replace(/^(?:["']|\[)|(?:["']|\])$/gu, "")
  if (!normalized) {
    return null
  }
  const secondsMatch = secondsTimestampPattern.exec(normalized)
  if (secondsMatch) {
    return Number(secondsMatch[1])
  }
  const timestampMatch = looseTimestampPattern.exec(normalized)
  if (timestampMatch) {
    return toSeconds(
      timestampMatch[1],
      timestampMatch[2],
      timestampMatch[3],
      timestampMatch[4],
    )
  }
  const numericValue = Number(normalized)
  return Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : null
}

function readTimestampValue(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value
    }
    if (typeof value === "string") {
      const timestamp = parseLooseTimestamp(value)
      if (timestamp !== null) {
        return timestamp
      }
    }
  }
  return null
}

function readMillisecondsValue(
  record: Record<string, unknown>,
  keys: string[],
): number | null {
  for (const key of keys) {
    const value = record[key]
    const milliseconds =
      typeof value === "number"
        ? value
        : typeof value === "string"
          ? Number(value)
          : Number.NaN
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      return milliseconds / 1000
    }
  }
  return null
}

function readFirstString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = readString(record, key)
    if (value) {
      return value
    }
  }
  return null
}

function finalizeLooseCues(cues: LooseSubtitleCue[]): ParsedSubtitleCue[] {
  const orderedCues = cues
    .filter(
      (cue) =>
        Number.isFinite(cue.startSeconds) &&
        cue.startSeconds >= 0 &&
        Boolean(cue.text.trim()),
    )
    .toSorted((left, right) => left.startSeconds - right.startSeconds)
  const gaps = orderedCues
    .slice(0, -1)
    .map((cue, index) => orderedCues[index + 1].startSeconds - cue.startSeconds)
    .filter((gap) => gap > 0)
    .toSorted((left, right) => left - right)
  const medianGap = gaps[Math.floor(gaps.length / 2)] ?? 3
  const fallbackDuration = Math.min(8, Math.max(1, medianGap))

  return normalizeCues(
    orderedCues.map((cue, index) => {
      const nextStart = orderedCues[index + 1]?.startSeconds
      const inferredEnd =
        nextStart !== undefined && nextStart > cue.startSeconds
          ? nextStart
          : cue.startSeconds + fallbackDuration
      return {
        ...cue,
        endSeconds:
          cue.endSeconds !== null && cue.endSeconds > cue.startSeconds
            ? cue.endSeconds
            : inferredEnd,
      }
    }),
  )
}

function joinSubtitleText(current: string, addition: string): string {
  return [current, cleanSubtitleText(addition)].filter(Boolean).join(" ").slice(0, 4000)
}

export function parseYouTubeTranscript(value: unknown): ParsedSubtitleCue[] {
  const root = asRecord(value)
  const events = Array.isArray(root?.events) ? root.events : []
  const cues: ParsedSubtitleCue[] = []

  for (const eventValue of events) {
    const event = asRecord(eventValue)
    const startMilliseconds = readFiniteNumber(event, "tStartMs")
    const durationMilliseconds = readFiniteNumber(event, "dDurationMs")
    const segments = Array.isArray(event?.segs) ? event.segs : []
    const text = segments
      .map((segment) => readString(asRecord(segment), "utf8"))
      .filter((segment): segment is string => Boolean(segment))
      .join("")
      .replace(/\s+/gu, " ")
      .trim()

    if (startMilliseconds === null || !text) {
      continue
    }

    const startSeconds = Math.max(0, startMilliseconds / 1000)
    const endSeconds = startSeconds + Math.max(0, durationMilliseconds ?? 0) / 1000
    cues.push({
      startSeconds,
      endSeconds,
      text: cleanSubtitleText(text).slice(0, 4000),
      translation: "",
    })
  }

  return normalizeCues(cues)
}

export function parseBilibiliTranscript(value: unknown): ParsedSubtitleCue[] {
  const root = asRecord(value)
  const body = Array.isArray(root?.body) ? root.body : []
  const cues: ParsedSubtitleCue[] = []

  for (const itemValue of body) {
    const item = asRecord(itemValue)
    const startSeconds = readFiniteNumber(item, "from")
    const endSeconds = readFiniteNumber(item, "to")
    const text = readString(item, "content")?.replace(/\s+/gu, " ").trim()
    if (
      startSeconds === null ||
      endSeconds === null ||
      endSeconds < startSeconds ||
      !text
    ) {
      continue
    }
    cues.push({
      startSeconds: Math.max(0, startSeconds),
      endSeconds: Math.max(0, endSeconds),
      text: cleanSubtitleText(text).slice(0, 4000),
      translation: "",
    })
  }

  return normalizeCues(cues)
}

export function subtitleCuesToVtt(cues: ParsedSubtitleCue[]): string {
  const blocks = normalizeCues(cues).map(
    (cue, index) =>
      `${index + 1}\n${formatSubtitleTimestamp(
        cue.startSeconds,
      )} --> ${formatSubtitleTimestamp(cue.endSeconds)}\n${[cue.text, cue.translation]
        .filter(Boolean)
        .join("\n")}`,
  )
  return blocks.length > 0 ? `WEBVTT\n\n${blocks.join("\n\n")}` : ""
}

export function compareSubtitleCues<
  TOriginal extends ParsedSubtitleCue,
  TIncoming extends ParsedSubtitleCue,
>(
  originalCues: TOriginal[],
  incomingCues: TIncoming[],
): Array<SubtitleCueDiff<TOriginal, TIncoming>> {
  const originalByTimestamp = groupCuesByStartTimestamp(originalCues)
  const incomingByTimestamp = groupCuesByStartTimestamp(incomingCues)
  const timestampKeys = Array.from(
    new Set([...originalByTimestamp.keys(), ...incomingByTimestamp.keys()]),
  ).toSorted((left, right) => Number(left) - Number(right))
  const differences: Array<SubtitleCueDiff<TOriginal, TIncoming>> = []

  for (const key of timestampKeys) {
    const originalAtTimestamp = originalByTimestamp.get(key) ?? []
    const incomingAtTimestamp = incomingByTimestamp.get(key) ?? []
    const rowCount = Math.max(originalAtTimestamp.length, incomingAtTimestamp.length)

    for (let index = 0; index < rowCount; index += 1) {
      const original = originalAtTimestamp[index] ?? null
      const incoming = incomingAtTimestamp[index] ?? null
      differences.push({
        key: `${key}:${index}`,
        status: getSubtitleCueDiffStatus(original, incoming),
        original,
        incoming,
      })
    }
  }

  return differences
}

export function formatSubtitleTimestamp(seconds: number): string {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000))
  const hours = Math.floor(totalMilliseconds / 3_600_000)
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000)
  const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000)
  const milliseconds = totalMilliseconds % 1000
  return [hours, minutes, wholeSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")
    .concat(`.${String(milliseconds).padStart(3, "0")}`)
}

export function groupSubtitleCuesBySentence(
  cues: SubtitleSentenceCue[],
): SubtitleSentenceGroup[] {
  const orderedCues = cues.toSorted(
    (left, right) => left.startSeconds - right.startSeconds,
  )
  const groups: SubtitleSentenceGroup[] = []
  let currentCues: SubtitleSentenceCue[] = []
  let currentLength = 0

  function flushGroup() {
    if (currentCues.length === 0) {
      return
    }
    groups.push({
      cues: currentCues,
      text: currentCues
        .map((cue) => cue.text.trim())
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/gu, " ")
        .trim(),
    })
    currentCues = []
    currentLength = 0
  }

  orderedCues.forEach((cue, index) => {
    const text = cue.text.trim()
    if (!text) {
      return
    }
    const addedLength = text.length + (currentCues.length > 0 ? 1 : 0)
    if (
      currentCues.length > 0 &&
      currentLength + addedLength > maximumSentenceTranslationLength
    ) {
      flushGroup()
    }
    currentCues.push(cue)
    currentLength += addedLength

    const nextCue = orderedCues[index + 1]
    const hasLongGap = nextCue
      ? nextCue.startSeconds - cue.endSeconds > maximumSentenceGapSeconds
      : true
    if (sentenceEndingPattern.test(text) || hasLongGap) {
      flushGroup()
    }
  })
  flushGroup()
  return groups
}

export function selectSubtitleSentenceCueIds(
  cues: SubtitleSentenceCue[],
  visibleCueIds: string[],
  limit: number,
): string[] {
  const visibleIds = new Set(visibleCueIds)
  const selectedIds: string[] = []
  for (const group of groupSubtitleCuesBySentence(cues)) {
    if (!group.cues.some((cue) => visibleIds.has(cue.id))) {
      continue
    }
    if (selectedIds.length > 0 && selectedIds.length + group.cues.length > limit) {
      break
    }
    selectedIds.push(...group.cues.map((cue) => cue.id))
    if (selectedIds.length >= limit) {
      break
    }
  }
  return selectedIds.slice(0, limit)
}

export function placeSubtitleTranslationsAtSentenceStart<
  TCue extends SubtitleContextCue,
>(cues: TCue[]): TCue[] {
  const cuesById = new Map(cues.map((cue) => [cue.id, cue]))
  const translationsByCueId = new Map<string, string>()

  for (const group of groupSubtitleCuesBySentence(cues)) {
    const translation = group.cues
      .map((cue) => cuesById.get(cue.id)?.translation?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim()

    group.cues.forEach((cue, index) => {
      translationsByCueId.set(cue.id, index === 0 ? translation : "")
    })
  }

  return cues.map((cue) => ({
    ...cue,
    translation: translationsByCueId.get(cue.id) ?? cue.translation ?? "",
  }))
}

export function getSubtitleSentenceContext(
  cues: SubtitleContextCue[],
  cueId: string,
): SubtitleSentenceContext | null {
  const group = groupSubtitleCuesBySentence(cues).find((item) =>
    item.cues.some((cue) => cue.id === cueId),
  )
  if (!group) {
    return null
  }

  const cuesById = new Map(cues.map((cue) => [cue.id, cue]))
  return {
    startSeconds: group.cues[0]?.startSeconds ?? 0,
    text: group.text,
    translation: group.cues
      .map((cue) => cuesById.get(cue.id)?.translation?.trim() ?? "")
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim(),
  }
}

function parseTimestampLine(
  value: string,
): Pick<ParsedSubtitleCue, "startSeconds" | "endSeconds"> | null {
  const match = timestampPattern.exec(value)
  if (!match) {
    return null
  }

  return {
    startSeconds: toSeconds(match[1], match[2], match[3], match[4]),
    endSeconds: toSeconds(match[5], match[6], match[7], match[8]),
  }
}

function toSeconds(
  hours: string | undefined,
  minutes: string,
  seconds: string,
  milliseconds: string | undefined,
): number {
  const fraction = milliseconds ? Number(milliseconds.padEnd(3, "0")) / 1000 : 0
  return Number(hours ?? 0) * 3600 + Number(minutes) * 60 + Number(seconds) + fraction
}

export function cleanSubtitleText(value: string): string {
  const normalized = decodeSubtitleEntities(value.replace(/<[^>]+>/gu, ""))
    .replace(/\s+/gu, " ")
    .trim()
  return normalized.replace(/(?:^|\s)>{2,}\s*/gu, " ").trim()
}

function normalizeCues(cues: ParsedSubtitleCue[]): ParsedSubtitleCue[] {
  return cues
    .filter(
      (cue) =>
        Number.isFinite(cue.startSeconds) &&
        Number.isFinite(cue.endSeconds) &&
        cue.startSeconds >= 0 &&
        cue.endSeconds >= cue.startSeconds &&
        Boolean(cue.text.trim()),
    )
    .toSorted((left, right) => left.startSeconds - right.startSeconds)
    .slice(0, 10_000)
}

function groupCuesByStartTimestamp<TCue extends ParsedSubtitleCue>(
  cues: TCue[],
): Map<string, TCue[]> {
  const groups = new Map<string, TCue[]>()
  for (const cue of cues) {
    const key = String(Math.round(cue.startSeconds * 1000))
    groups.set(key, [...(groups.get(key) ?? []), cue])
  }
  return groups
}

function getSubtitleCueDiffStatus(
  original: ParsedSubtitleCue | null,
  incoming: ParsedSubtitleCue | null,
): SubtitleCueDiffStatus {
  if (!original) {
    return "added"
  }
  if (!incoming) {
    return "removed"
  }
  return Math.round(original.endSeconds * 1000) ===
    Math.round(incoming.endSeconds * 1000) &&
    original.text === incoming.text &&
    original.translation === incoming.translation
    ? "unchanged"
    : "changed"
}

function decodeSubtitleEntities(value: string): string {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: Record<string, unknown> | null, key: string): string | null {
  const result = value?.[key]
  return typeof result === "string" && result.trim() ? result : null
}

function readFiniteNumber(
  value: Record<string, unknown> | null,
  key: string,
): number | null {
  const result = value?.[key]
  return typeof result === "number" && Number.isFinite(result) ? result : null
}
