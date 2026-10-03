import { isIP } from "node:net"
import { aiModelEndpointOptions } from "../../shared/ai-model-config"
import { parseAiVocabularyAnalysis } from "../../shared/ai-vocabulary"
import type {
  AiModelConfigInput,
  AiVocabularyAnalysis,
  AiVocabularyItem,
} from "../../types/learning"

interface VocabularyAnalysisContext {
  word: string
  partOfSpeech: string
  definition: string
  definitionTranslation: string
  examples: unknown
  sourceSentence: string
  wordAnalysis: unknown
}

const lexicographerSystemPrompt =
  "You are a rigorous bilingual English lexicographer. Return only valid JSON, without markdown fences or commentary."
const defaultAllowedAiHostnames = new Set([
  "api.anthropic.com",
  "api.openai.com",
  "apihub.agnes-ai.com",
])

export function normalizeAiBaseUrl(
  value: string,
  allowCompleteEndpoint = false,
): string {
  const normalized = value.trim().slice(0, 500)
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw new Error("请输入有效的 AI 接口地址。")
  }
  if (url.protocol !== "https:") {
    throw new Error("AI 接口必须使用 HTTPS。")
  }
  if (url.username || url.password) {
    throw new Error("AI 接口地址不能包含用户名或密码。")
  }
  const hostname = normalizeAiHostname(url.hostname)
  if (
    !hostname ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isIP(hostname) !== 0
  ) {
    throw new Error("AI 接口不能指向本机或私有网络。")
  }
  if (!isAllowedAiHostname(hostname)) {
    throw new Error("AI 接口域名未在服务端允许列表中。")
  }
  url.hostname = hostname
  url.hash = ""
  if (!allowCompleteEndpoint) {
    url.search = ""
    if (/\/(chat\/completions|responses|messages)\/?$/iu.test(url.pathname)) {
      throw new Error("接口地址不要包含具体请求路径，请通过接口类型自动拼接。")
    }
  }
  return url.toString().replace(/\/+$/u, "")
}

export function buildAiRequestEndpoint(config: AiModelConfigInput): string {
  const baseUrl = normalizeAiBaseUrl(config.baseUrl, config.provider === "custom")
  if (config.provider === "custom") {
    return baseUrl
  }
  const endpoint = aiModelEndpointOptions.find(
    (item) => item.value === config.endpointKind,
  )
  if (!endpoint) {
    throw new Error("请选择有效的 AI 接口类型。")
  }
  return `${baseUrl}${endpoint.path}`
}

export async function generateAiVocabularyAnalysis(
  config: AiModelConfigInput,
  context: VocabularyAnalysisContext,
): Promise<AiVocabularyAnalysis> {
  const endpoint = buildAiRequestEndpoint(config)
  const model = normalizeModel(config.model)
  const apiKey = normalizeApiKey(config.apiKey)
  const request = createAiRequest(
    config,
    apiKey,
    model,
    createAnalysisPrompt(context),
    10_000,
    0.25,
    true,
  )
  const response = await fetch(endpoint, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(45_000),
  })

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = readApiError(payload)
    throw new Error(message ? `AI 模型请求失败：${message}` : "AI 模型请求失败。")
  }

  const content = readAiResponseContent(payload)
  if (!content) {
    throw new Error("AI 模型没有返回可解析的词汇内容。")
  }
  const parsed = parseAiJsonObject(content)
  const analysis = parseAiVocabularyAnalysis(parsed, {
    generatedAt: new Date().toISOString(),
  })
  if (!analysis) {
    throw new Error("AI 模型返回的数据结构不完整，请重试或更换模型。")
  }
  return analysis
}

export async function validateAiModelConnection(
  config: AiModelConfigInput,
): Promise<{ model: string }> {
  const endpoint = buildAiRequestEndpoint(config)
  const model = normalizeModel(config.model)
  const apiKey = normalizeApiKey(config.apiKey)
  const request = createAiRequest(
    config,
    apiKey,
    model,
    "Reply with only the letters OK.",
    64,
    0,
    false,
  )
  const response = await fetch(endpoint, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  })

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const message = readApiError(payload)
    throw new Error(message ? `AI 模型验证失败：${message}` : "AI 模型验证失败。")
  }
  const content = readAiResponseContent(payload)
  if (!content) {
    throw new Error("AI 模型验证失败：没有收到模型回复。")
  }
  return { model }
}

function createAiRequest(
  config: AiModelConfigInput,
  apiKey: string,
  model: string,
  prompt: string,
  maxTokens: number,
  temperature: number,
  includeSystemPrompt: boolean,
): {
  headers: Record<string, string>
  body: Record<string, unknown>
} {
  if (config.provider !== "custom" && config.endpointKind === "anthropic-messages") {
    return {
      headers: {
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: {
        model,
        max_tokens: maxTokens,
        temperature,
        ...(includeSystemPrompt ? { system: lexicographerSystemPrompt } : {}),
        messages: [{ role: "user", content: prompt }],
      },
    }
  }
  return {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        ...(includeSystemPrompt
          ? [{ role: "system", content: lexicographerSystemPrompt }]
          : []),
        { role: "user", content: prompt },
      ],
    },
  }
}

function normalizeModel(value: string): string {
  const model = value.trim().slice(0, 120)
  if (!model) {
    throw new Error("请输入 AI 模型名称。")
  }
  return model
}

function normalizeApiKey(value: string): string {
  const apiKey = value.trim().slice(0, 4096)
  if (apiKey.length < 8) {
    throw new Error("请输入有效的 API 密钥。")
  }
  return apiKey
}

function createAnalysisPrompt(context: VocabularyAnalysisContext): string {
  return `Analyze the English word "${context.word}" for a Chinese-speaking learner.

Known dictionary context:
${JSON.stringify(context)}

Return one JSON object with exactly these keys:
{
  "cefrLevel": "A1 | A2 | B1 | B2 | C1 | C2",
  "examLabels": ["CET4", "CET6", "考研", "IELTS", "TOEFL", "GRE", "GMAT", "商务英语"],
  "meanings": [{
    "term": "v.",
    "en": "complete English definitions for this part of speech",
    "zh": "该词性下完整、去重的中文义项"
  }],
  "inflections": [{
    "term": "第三人称单数",
    "en": "inflected form",
    "zh": "grammatical label in Chinese"
  }],
  "explanation": {"en": "...", "zh": "..."},
  "partsOfSpeech": [{"term": "noun", "en": "...", "zh": "..."}],
  "tenses": [{"term": "past tense: ...", "en": "...", "zh": "..."}],
  "etymology": {"en": "...", "zh": "..."},
  "etymologyTree": [
    {
      "label": "earliest root or source form",
      "en": "English explanation",
      "zh": "中文解释",
      "children": []
    }
  ],
  "wordParts": [{
    "term": "prefix/root/suffix",
    "en": "literal English meaning",
    "zh": "字面中文含义",
    "source": "historical source form and language",
    "phrase": "common phrase containing the headword",
    "phraseTranslation": "词组中文翻译",
    "example": "natural English sentence using the phrase",
    "exampleTranslation": "例句中文翻译"
  }],
  "wordPartMemory": {
    "en": "Explain how the literal meanings of the listed parts combine into the headword meaning and give a concise mnemonic.",
    "zh": "用各词根词缀的字面义解释它们组合后的单词含义，并给出简洁记忆法。"
  },
  "derivatives": [{"term": "derived word", "en": "...", "zh": "..."}],
  "examples": [{
    "term": "English example sentence",
    "translation": "faithful Chinese translation",
    "en": "English usage analysis",
    "zh": "中文用法解析"
  }],
  "collocations": [{"term": "collocation", "en": "...", "zh": "..."}],
  "phrases": [{"term": "phrase", "en": "...", "zh": "..."}],
  "idioms": [{"term": "idiom", "en": "...", "zh": "..."}],
  "synonyms": [{"term": "synonym", "en": "difference in nuance", "zh": "语义差异"}],
  "antonyms": [{"term": "antonym", "en": "...", "zh": "..."}],
  "replacements": [{"term": "replacement", "en": "when it can replace the word", "zh": "替换场景"}],
  "newMeanings": [{"term": "modern or contextual meaning", "en": "...", "zh": "..."}]
}

Requirements:
- Analyze exactly "${context.word}", and do not switch to a related but different headword.
- Treat the known dictionary context as fallible reference material: cross-check it, correct inaccurate definitions or translations, and never copy an error merely to agree with it.
- Use the source sentence only to understand how the word was encountered. Never derive the word's definition, phrases, or example sentences from that source sentence.
- Assign one CEFR level from A1, A2, B1, B2, C1, or C2 based on the most common modern usage.
- In examLabels, include only established exam or learning-domain labels that commonly cover this word. Use an empty array when uncertain.
- In meanings, include every common modern meaning, grouped by part of speech and ordered by frequency. Correct part-of-speech mistakes, omit obsolete or highly specialized senses unless essential, and do not omit a distinct common sense such as conception/pregnancy when it applies.
- In each meaning, make en a concise dictionary definition and zh a concise, accurate Chinese dictionary gloss. Do not put examples, usage advice, or unrelated concepts in either field.
- In inflections, include every applicable inflected form with Chinese labels. Use an empty array for words without inflection.
- Every entry must include useful English and Chinese content.
- Include all inflection or tense information that applies; use an empty array for a non-verb.
- In wordParts, list only real morphemes and format each term as "prefix: ...", "root: ...", "suffix: ...", "base: ...", or "stem: ...". Never use the complete headword as a wordParts item. For every item, explain its historical source, then provide one common headword phrase and one natural bilingual example using that phrase.
- wordPartMemory must begin by naming each real prefix, root, suffix, or base and its literal meaning, then explain how those meanings combine into the headword meaning.
- Turn that combination into one concrete, vivid mental scene that a learner can picture. For example, explain conceive as con- (together/completely, an assimilated form of Latin com-) + ceive (take or grasp, from Latin capere): gathering and grasping something inside the mind, which develops into "form an idea".
- Keep the scene linguistically accurate. Do not force a decomposition when the word has no reliable productive parts; state that limitation clearly instead.
- Keep examples natural and include only two or three common, representative examples.
- For every example, term is the English sentence, translation is its faithful Chinese translation, and en/zh explain grammar, collocation, register, or nuance without repeating the translation.
- Separate collocations, phrases, and idioms accurately.
- Explain synonym and replacement differences instead of listing bare words.
- Keep the etymology tree historically ordered and concise.
- Do not invent uncertain etymology; state uncertainty in both languages when necessary.
- Return raw JSON only. The first character must be "{" and the last character must be "}". Do not wrap the JSON in markdown fences or as a quoted string.`
}

interface VocabularyAnalysisConsistencyContext extends VocabularyAnalysisContext {
  previousAnalysis?: AiVocabularyAnalysis | null
}

const partOfSpeechMatchers = [
  { tag: "noun", pattern: /\b(n|noun|nouns)\b|名词/u },
  { tag: "pronoun", pattern: /\b(pron|pronoun|pronouns)\b|代词/u },
  { tag: "verb", pattern: /\b(v|verb|verbs)\b|动词/u },
  { tag: "adjective", pattern: /\b(adj|adjective|adjectives)\b|形容词/u },
  { tag: "adverb", pattern: /\b(adv|adverb|adverbs)\b|副词/u },
  { tag: "preposition", pattern: /\b(prep|preposition|prepositions)\b|介词/u },
  { tag: "conjunction", pattern: /\b(conj|conjunction|conjunctions)\b|连词/u },
  { tag: "interjection", pattern: /\b(interj|interjection|interjections)\b|感叹词/u },
  {
    tag: "determiner",
    pattern: /\b(det|determiner|determiners|article)\b|冠词|限定词/u,
  },
  { tag: "modal", pattern: /\b(modal|auxiliary)\b|情态|助动词/u },
] as const

export function validateAiVocabularyAnalysisConsistency(
  analysis: AiVocabularyAnalysis,
  context: VocabularyAnalysisConsistencyContext,
): string | null {
  if (!analysis.explanation.en || !analysis.explanation.zh) {
    return "AI 模型返回的核心双语解释不完整，已停止写入，请重试或更换模型。"
  }

  const currentPartsOfSpeech = collectPartOfSpeechTags(analysis.partsOfSpeech)
  if (analysis.partsOfSpeech.length > 0 && currentPartsOfSpeech.size === 0) {
    return "AI 模型返回的词性信息无法校验，已停止写入，请重试或更换模型。"
  }

  const previousPartsOfSpeech = context.previousAnalysis
    ? collectPartOfSpeechTags(context.previousAnalysis.partsOfSpeech)
    : new Set<string>()
  if (
    previousPartsOfSpeech.size > 0 &&
    currentPartsOfSpeech.size > 0 &&
    !setsOverlap(previousPartsOfSpeech, currentPartsOfSpeech)
  ) {
    return "新生成的词性与库中已有 AI 解析差异较大，已停止写入，避免前后内容误导。"
  }

  const previousAnalysis = context.previousAnalysis
  if (!previousAnalysis) {
    return null
  }

  if (
    stableFactsConflict(previousAnalysis.tenses, analysis.tenses, {
      minimumFacts: 1,
      minimumOverlapRatio: 0.25,
    })
  ) {
    return "新生成的时态或词形与已有 AI 解析不一致，已停止写入，避免覆盖稳定事实。"
  }

  if (
    stableFactsConflict(previousAnalysis.wordParts, analysis.wordParts, {
      minimumFacts: 2,
      minimumOverlapRatio: 0.34,
    })
  ) {
    return "新生成的词根词缀与已有 AI 解析差异较大，已停止写入，避免产生误导。"
  }

  if (etymologyFactsConflict(previousAnalysis.etymologyTree, analysis.etymologyTree)) {
    return "新生成的词源脉络与已有 AI 解析缺少可验证的共同事实，已停止写入。"
  }

  return null
}

function collectPartOfSpeechTags(
  items: AiVocabularyAnalysis["partsOfSpeech"],
): Set<string> {
  const tags = new Set<string>()
  for (const item of items) {
    const text = `${item.term} ${item.en} ${item.zh}`.toLocaleLowerCase("en")
    for (const matcher of partOfSpeechMatchers) {
      if (matcher.pattern.test(text)) {
        tags.add(matcher.tag)
      }
    }
  }
  return tags
}

function setsOverlap(left: Set<string>, right: Set<string>): boolean {
  for (const item of left) {
    if (right.has(item)) {
      return true
    }
  }
  return false
}

function stableFactsConflict(
  previousItems: AiVocabularyItem[],
  currentItems: AiVocabularyItem[],
  options: {
    minimumFacts: number
    minimumOverlapRatio: number
  },
): boolean {
  const previousFacts = collectStableTerms(previousItems)
  const currentFacts = collectStableTerms(currentItems)
  if (
    previousFacts.size < options.minimumFacts ||
    currentFacts.size < options.minimumFacts
  ) {
    return false
  }

  let sharedFacts = 0
  for (const fact of previousFacts) {
    if (currentFacts.has(fact)) {
      sharedFacts += 1
    }
  }
  return (
    sharedFacts / Math.min(previousFacts.size, currentFacts.size) <
    options.minimumOverlapRatio
  )
}

function collectStableTerms(items: AiVocabularyItem[]): Set<string> {
  const terms = new Set<string>()
  for (const item of items) {
    const normalized = normalizeStableTerm(item.term)
    if (normalized) {
      terms.add(normalized)
    }
  }
  return terms
}

const stableTermLabels =
  /\b(prefix|root|suffix|base|stem|tense|form|participle|person|singular|plural|past|present|future|infinitive|gerund)\b/giu

function normalizeStableTerm(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(stableTermLabels, " ")
    .replace(/[^\p{L}\p{N}*]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ")
}

const etymologyStopWords = new Set([
  "about",
  "ancient",
  "adjective",
  "english",
  "form",
  "from",
  "greek",
  "indo",
  "language",
  "latin",
  "meaning",
  "means",
  "middle",
  "modern",
  "noun",
  "old",
  "origin",
  "proto",
  "root",
  "source",
  "through",
  "verb",
  "word",
])

function etymologyFactsConflict(
  previousNodes: AiVocabularyAnalysis["etymologyTree"],
  currentNodes: AiVocabularyAnalysis["etymologyTree"],
): boolean {
  const previousFacts = collectEtymologyFacts(previousNodes)
  const currentFacts = collectEtymologyFacts(currentNodes)
  if (previousFacts.size < 2 || currentFacts.size < 2) {
    return false
  }
  return !setsOverlap(previousFacts, currentFacts)
}

function collectEtymologyFacts(
  nodes: AiVocabularyAnalysis["etymologyTree"],
): Set<string> {
  const facts = new Set<string>()
  const queue = [...nodes]
  while (queue.length > 0) {
    const node = queue.shift()
    if (!node) {
      continue
    }
    const tokens = `${node.label} ${node.en}`
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .match(/[\p{L}\p{N}*]{3,}/gu)
    for (const token of tokens ?? []) {
      if (!etymologyStopWords.has(token)) {
        facts.add(token)
      }
    }
    queue.push(...node.children)
  }
  return facts
}

export function readAiResponseContent(value: unknown): string | null {
  const payload = asRecord(value)
  if (!payload) {
    return null
  }

  return (
    readString(payload, "output_text") ??
    readOpenAiChoiceContent(payload) ??
    readResponsesOutputContent(payload) ??
    readTextContent(payload.content) ??
    readString(payload, "text")
  )
}

function readOpenAiChoiceContent(payload: Record<string, unknown>): string | null {
  const choices = Array.isArray(payload.choices) ? payload.choices : []
  for (const choice of choices) {
    const choiceRecord = asRecord(choice)
    if (!choiceRecord) {
      continue
    }
    const message = asRecord(choiceRecord.message)
    const messageContent = message ? readTextContent(message.content) : null
    const content = messageContent ?? readString(choiceRecord, "text")
    if (content) {
      return content
    }
  }
  return null
}

function readResponsesOutputContent(payload: Record<string, unknown>): string | null {
  const output = Array.isArray(payload.output) ? payload.output : []
  for (const item of output) {
    const outputItem = asRecord(item)
    if (!outputItem) {
      continue
    }
    const content =
      readTextContent(outputItem.content) ?? readString(outputItem, "text")
    if (content) {
      return content
    }
  }
  return null
}

function readTextContent(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || null
  }
  if (!Array.isArray(value)) {
    return null
  }
  const texts = value
    .map((item) => {
      const block = asRecord(item)
      return block ? readTextBlock(block) : null
    })
    .filter((item): item is string => item !== null)
  return texts.length > 0 ? texts.join("\n") : null
}

function readTextBlock(block: Record<string, unknown>): string | null {
  const nestedText = asRecord(block.text)
  return (
    readString(block, "text") ??
    readString(block, "output_text") ??
    readString(block, "content") ??
    (nestedText ? readString(nestedText, "value") : null)
  )
}

function readApiError(value: unknown): string | null {
  const payload = asRecord(value)
  const error = asRecord(payload?.error)
  return error
    ? readString(error, "message")
    : payload
      ? (readString(payload, "message") ??
        readString(payload, "detail") ??
        readString(payload, "error_description"))
      : null
}

export function parseAiJsonObject(value: string): unknown {
  const candidates = collectJsonCandidates(value)
  let sawObject = false
  for (const candidate of candidates) {
    const result = parseJsonCandidate(candidate, 0)
    sawObject ||= result.sawObject
    if (asRecord(result.value)) {
      return result.value
    }
  }
  if (!sawObject) {
    throw new Error("AI 模型没有返回 JSON 对象。")
  }
  throw new Error("AI 模型返回的 JSON 无法解析，请重试。")
}

function collectJsonCandidates(value: string): string[] {
  const trimmed = value.trim().replace(/^\uFEFF/u, "")
  const fenced = Array.from(trimmed.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/gu))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
  return Array.from(new Set([trimmed, ...fenced]))
}

function parseJsonCandidate(
  value: string,
  depth: number,
): { value: unknown | null; sawObject: boolean } {
  const trimmed = value.trim()
  if (!trimmed) {
    return { value: null, sawObject: false }
  }

  const direct = tryParseJsonText(trimmed)
  if (direct.ok) {
    if (typeof direct.value === "string" && depth < 2) {
      return parseJsonCandidate(direct.value, depth + 1)
    }
    return { value: direct.value, sawObject: Boolean(asRecord(direct.value)) }
  }

  const objectText = extractBalancedJsonObject(trimmed)
  if (!objectText) {
    return { value: null, sawObject: hasJsonObjectStart(trimmed) }
  }
  const object = tryParseJsonText(objectText)
  if (object.ok) {
    if (typeof object.value === "string" && depth < 2) {
      return parseJsonCandidate(object.value, depth + 1)
    }
    return { value: object.value, sawObject: true }
  }
  return { value: null, sawObject: true }
}

function tryParseJsonText(value: string): { ok: true; value: unknown } | { ok: false } {
  const escaped = escapeInvalidControlCharactersInJsonStrings(value)
  const candidates = Array.from(
    new Set([value, escaped, stripTrailingCommas(value), stripTrailingCommas(escaped)]),
  )
  for (const candidate of candidates) {
    try {
      return { ok: true, value: JSON.parse(candidate) as unknown }
    } catch {}
  }
  return { ok: false }
}

function extractBalancedJsonObject(value: string): string | null {
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === "\\") {
        escaped = true
        continue
      }
      if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char !== "{" && char !== "}") {
      continue
    }
    if (char === "{") {
      if (depth === 0) {
        start = index
      }
      depth += 1
      continue
    }
    if (depth === 0) {
      continue
    }
    depth -= 1
    if (depth === 0 && start >= 0) {
      return value.slice(start, index + 1)
    }
  }
  return null
}

function hasJsonObjectStart(value: string): boolean {
  return extractBalancedJsonObject(`${value}}`) !== null || value.includes("{")
}

function stripTrailingCommas(value: string): string {
  return value.replace(/,\s*([}\]])/gu, "$1")
}

function escapeInvalidControlCharactersInJsonStrings(value: string): string {
  let result = ""
  let inString = false
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? ""
    if (inString) {
      if (escaped) {
        escaped = false
        result += char
        continue
      }
      if (char === "\\") {
        escaped = true
        result += char
        continue
      }
      if (char === '"') {
        inString = false
        result += char
        continue
      }
      const code = char.charCodeAt(0)
      if (code < 0x20) {
        result += controlCharacterEscape(char, code)
        continue
      }
      result += char
      continue
    }
    if (char === '"') {
      inString = true
    }
    result += char
  }
  return result
}

function controlCharacterEscape(char: string, code: number): string {
  if (char === "\n") {
    return "\\n"
  }
  if (char === "\r") {
    return "\\r"
  }
  if (char === "\t") {
    return "\\t"
  }
  return `\\u${code.toString(16).padStart(4, "0")}`
}

function normalizeAiHostname(hostname: string): string {
  return hostname
    .toLocaleLowerCase("en")
    .replace(/^\[|\]$/gu, "")
    .replace(/\.+$/u, "")
}

function isAllowedAiHostname(hostname: string): boolean {
  if (defaultAllowedAiHostnames.has(hostname)) {
    return true
  }
  return (process.env.AI_ALLOWED_HOSTS ?? "")
    .split(",")
    .map(normalizeAiHostname)
    .some((allowedHostname) => allowedHostname === hostname)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: Record<string, unknown>, key: string): string | null {
  const result = value[key]
  return typeof result === "string" && result.trim() ? result.trim() : null
}
