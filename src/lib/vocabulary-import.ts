import type { VocabularyImportItem } from "../types/learning"
import { isValidVocabularyTerm, normalizeVocabularyTerm } from "./vocabulary-term"

export interface VocabularyImportParseResult {
  items: VocabularyImportItem[]
  errors: string[]
  duplicateCount: number
  rowCount: number
}

export const maximumVocabularyImportFileSize = 256_000

const headerAliases = {
  word: ["word", "term", "单词", "词条", "词组", "短语"],
  partOfSpeech: ["part_of_speech", "partofspeech", "pos", "词性"],
  definition: ["definition", "英文释义"],
  definitionTranslation: ["translation", "definition_translation", "中文释义"],
  example: ["example", "例句"],
  exampleTranslation: ["example_translation", "例句翻译"],
} as const

type VocabularyImportKey = keyof typeof headerAliases

export function createVocabularyImportTemplate(): string {
  return serializeVocabularyImportItems([
    {
      word: "dejected",
      partOfSpeech: "adjective",
      definition: "sad and dispirited",
      definitionTranslation: "沮丧的",
      example: "He looked dejected.",
      exampleTranslation: "他看起来很沮丧。",
    },
  ])
}

export function serializeVocabularyImportItems(items: VocabularyImportItem[]): string {
  const rows = [
    [
      "word",
      "part_of_speech",
      "definition",
      "translation",
      "example",
      "example_translation",
    ],
    ...items.map((item) => [
      item.word,
      item.partOfSpeech,
      item.definition,
      item.definitionTranslation,
      item.example,
      item.exampleTranslation,
    ]),
  ]
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n")
}

export function parseVocabularyImportText(source: string): VocabularyImportParseResult {
  const text = source.replace(/^\uFEFF/u, "").trim()
  if (!text) {
    return { items: [], errors: [], duplicateCount: 0, rowCount: 0 }
  }

  const delimiter = detectDelimiter(text)
  const parsedRows = delimiter
    ? parseDelimitedRows(text, delimiter)
    : {
        rows: text.split(/\r?\n/u).map((line) => [line.trim()]),
        hasUnclosedQuote: false,
      }
  const rows = parsedRows.rows
  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.trim()))
  if (nonEmptyRows.length === 0) {
    return { items: [], errors: [], duplicateCount: 0, rowCount: 0 }
  }

  const rowsWithNormalizedHeader = delimiter
    ? mergeWrappedHeaderRows(nonEmptyRows)
    : nonEmptyRows
  const headerMap = createHeaderMap(rowsWithNormalizedHeader[0] ?? [])
  const hasHeader = isVocabularyHeader(rowsWithNormalizedHeader[0] ?? [], headerMap)
  if (!hasHeader || headerMap.size === 1) {
    return parseVocabularyWordList(text)
  }

  const normalizedRows = delimiter
    ? mergeWrappedFinalFields(
        rowsWithNormalizedHeader,
        rowsWithNormalizedHeader[0]?.length ?? 0,
        delimiter,
      )
    : rowsWithNormalizedHeader
  const dataRows = normalizedRows.slice(1)
  const items: VocabularyImportItem[] = []
  const errors = parsedRows.hasUnclosedQuote ? ["CSV 中存在未闭合的双引号。"] : []
  const seen = new Set<string>()
  let duplicateCount = 0

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2
    const maximumColumnCount = normalizedRows[0]?.length ?? 0
    if (delimiter && row.length > maximumColumnCount) {
      errors.push(`第 ${rowNumber} 行列数过多，请为含逗号的内容加双引号。`)
      return
    }
    const item = readMappedItem(row, headerMap)
    const normalizedWord = normalizeVocabularyTerm(item.word)
    if (!normalizedWord) {
      errors.push(`第 ${rowNumber} 行缺少词条。`)
      return
    }
    if (!isValidVocabularyTerm(normalizedWord)) {
      errors.push(`第 ${rowNumber} 行的词条格式无效：${item.word}`)
      return
    }
    if (seen.has(normalizedWord)) {
      duplicateCount += 1
      return
    }
    seen.add(normalizedWord)
    items.push({ ...item, word: normalizedWord })
  })

  return {
    items,
    errors,
    duplicateCount,
    rowCount: dataRows.length,
  }
}

function parseVocabularyWordList(source: string): VocabularyImportParseResult {
  const values = source
    .split(/[,，\t\r\n]+/u)
    .map((value) => value.trim())
    .filter(Boolean)
  const dataValues =
    findHeaderKey(values[0] ?? "") === "word" ? values.slice(1) : values
  const items: VocabularyImportItem[] = []
  const errors: string[] = []
  const seen = new Set<string>()
  let duplicateCount = 0

  dataValues.forEach((value, index) => {
    const word = normalizeVocabularyTerm(value)
    if (!isValidVocabularyTerm(word)) {
      errors.push(`第 ${index + 1} 项的词条格式无效：${value}`)
      return
    }
    if (seen.has(word)) {
      duplicateCount += 1
      return
    }
    seen.add(word)
    items.push({
      word,
      partOfSpeech: "",
      definition: "",
      definitionTranslation: "",
      example: "",
      exampleTranslation: "",
    })
  })

  return {
    items,
    errors,
    duplicateCount,
    rowCount: dataValues.length,
  }
}

function detectDelimiter(value: string): "," | "\t" | null {
  const sample = value
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .slice(0, 5)
    .join("\n")
  const tabCount = countCharacter(sample, "\t")
  const commaCount = countCharacter(sample, ",")
  if (tabCount === 0 && commaCount === 0) {
    return null
  }
  return tabCount > commaCount ? "\t" : ","
}

function countCharacter(value: string, character: string): number {
  let count = 0
  for (const item of value) {
    if (item === character) {
      count += 1
    }
  }
  return count
}

function parseDelimitedRows(
  value: string,
  delimiter: "," | "\t",
): { rows: string[][]; hasUnclosedQuote: boolean } {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let quoted = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? ""
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && character === delimiter) {
      row.push(field.trim())
      field = ""
      continue
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && value[index + 1] === "\n") {
        index += 1
      }
      row.push(field.trim())
      rows.push(row)
      row = []
      field = ""
      continue
    }
    field += character
  }

  row.push(field.trim())
  rows.push(row)
  return { rows, hasUnclosedQuote: quoted }
}

function mergeWrappedHeaderRows(rows: string[][]): string[][] {
  const firstRow = rows[0] ?? []
  const headerMap = createHeaderMap(firstRow)
  if (!headerMap.has("word") || headerMap.size === Object.keys(headerAliases).length) {
    return rows
  }

  const header = firstRow.filter((cell) => cell.trim())
  let consumedRows = 1
  for (const row of rows.slice(1)) {
    const keys = row.map(findHeaderKey).filter((key) => key !== null)
    const nonEmptyCellCount = row.filter((cell) => cell.trim()).length
    const contributesNewHeader =
      keys.length > 0 &&
      keys.length === nonEmptyCellCount &&
      keys.some((key) => !headerMap.has(key))
    if (!contributesNewHeader) {
      break
    }

    for (const cell of row) {
      const key = findHeaderKey(cell)
      if (key && !headerMap.has(key)) {
        headerMap.set(key, header.length)
        header.push(cell.trim())
      }
    }
    consumedRows += 1
  }

  return consumedRows > 1 ? [header, ...rows.slice(consumedRows)] : rows
}

function mergeWrappedFinalFields(
  rows: string[][],
  columnCount: number,
  delimiter: "," | "\t",
): string[][] {
  if (rows.length < 2 || columnCount < 2) {
    return rows
  }

  const mergedRows = [rows[0]?.slice() ?? []]
  for (const row of rows.slice(1)) {
    const previousRow = mergedRows.at(-1)
    const continuation = row.join(delimiter).trim()
    const shouldMerge =
      previousRow &&
      previousRow !== mergedRows[0] &&
      previousRow.length >= columnCount &&
      row.length < columnCount &&
      isValidVocabularyTerm(previousRow[0] ?? "") &&
      !isValidVocabularyTerm(row[0] ?? "") &&
      continuation

    if (shouldMerge) {
      const finalColumnIndex = columnCount - 1
      previousRow[finalColumnIndex] = joinWrappedField(
        previousRow[finalColumnIndex] ?? "",
        continuation,
      )
      continue
    }
    mergedRows.push(row.slice())
  }
  return mergedRows
}

function joinWrappedField(current: string, continuation: string): string {
  const separator =
    /[a-z0-9]$/iu.test(current) && /^[a-z0-9]/iu.test(continuation) ? " " : ""
  return `${current}${separator}${continuation}`
}

function findHeaderKey(value: string): VocabularyImportKey | null {
  const normalized = value.trim().toLocaleLowerCase("en")
  for (const [key, aliases] of Object.entries(headerAliases) as Array<
    [VocabularyImportKey, readonly string[]]
  >) {
    if (aliases.includes(normalized)) {
      return key
    }
  }
  return null
}

function createHeaderMap(row: string[]): Map<VocabularyImportKey, number> {
  const map = new Map<VocabularyImportKey, number>()
  row.forEach((cell, index) => {
    const key = findHeaderKey(cell)
    if (key) {
      map.set(key, index)
    }
  })
  return map
}

function isVocabularyHeader(
  row: string[],
  headerMap: Map<VocabularyImportKey, number>,
): boolean {
  const nonEmptyCells = row.filter((cell) => cell.trim())
  return (
    headerMap.has("word") &&
    nonEmptyCells.length > 0 &&
    nonEmptyCells.every((cell) => findHeaderKey(cell) !== null)
  )
}

function readMappedItem(
  row: string[],
  headerMap: Map<VocabularyImportKey, number>,
): VocabularyImportItem {
  return {
    word: readMappedValue(row, headerMap, "word"),
    partOfSpeech: readMappedValue(row, headerMap, "partOfSpeech"),
    definition: readMappedValue(row, headerMap, "definition"),
    definitionTranslation: readMappedValue(row, headerMap, "definitionTranslation"),
    example: readMappedValue(row, headerMap, "example"),
    exampleTranslation: readMappedValue(row, headerMap, "exampleTranslation"),
  }
}

function readMappedValue(
  row: string[],
  headerMap: Map<VocabularyImportKey, number>,
  key: VocabularyImportKey,
): string {
  const index = headerMap.get(key)
  return index === undefined ? "" : (row[index]?.trim() ?? "")
}

function escapeCsvCell(value: string): string {
  if (!/[",\r\n]/u.test(value)) {
    return value
  }
  return `"${value.replaceAll('"', '""')}"`
}
