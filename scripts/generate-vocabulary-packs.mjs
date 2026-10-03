import { execFile } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"
import { promisify } from "node:util"

const outputDirectory = new URL("../src/data/vocabulary-packs/", import.meta.url)
const lookupCachePath = new URL(
  "../tmp/vocabulary-pack-lookup-cache.json",
  import.meta.url,
)
const sourceDirectory = readArgument("--source-dir")
const execFileAsync = promisify(execFile)

const sources = {
  cefrB1: {
    fileName: "linguaflow-cefrj-b1.csv",
    sha256: "9f62d152b75eb74c27366e04c1bf824ed87856735e3f7bbaf83c97eb7100f060",
    url: "https://raw.githubusercontent.com/tomtommark2/tenioha-game/7c434d6fc85ec3bdac91f91bdc50dd35e7044266/CEFR-J%20Wordlist%20Ver1.6%20-%20B1_sep.csv",
  },
  cefrB2: {
    fileName: "linguaflow-cefrj-b2.csv",
    sha256: "9ff24d74b4ebc895082df2dbad6d452323f064ca8ac624842fcedb7dd2b7e228",
    url: "https://raw.githubusercontent.com/tomtommark2/tenioha-game/7c434d6fc85ec3bdac91f91bdc50dd35e7044266/CEFR-J%20Wordlist%20Ver1.6%20-%20B2_sep.csv",
  },
  c1: {
    fileName: "linguaflow-octanove.csv",
    sha256: "18c33a407f2f89f7b8de9671c6d45fe3ea0bce45e7d2d7dcaab48d73e0f7b380",
    url: "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/d4e45b75b38f27b30dfc5c44d8c571aec7e7092f/octanove-vocabulary-profile-c1c2-1.0.csv",
  },
  dictionary: {
    fileName: "linguaflow-ecdict.csv",
    sha256: "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf",
    url: "https://raw.githubusercontent.com/skywind3000/ECDICT/82c9872576b23118d7c42e920c11beb77f510ae2/ecdict.csv",
  },
  phraseList: {
    fileName: "linguaflow-phrase-list-full.html",
    sha256: "8e7706ea5bd4ced35c004e105d0a11c6700d0aa54db9616a56a80f45566f66ab",
    size: 2_664_386,
    url: "https://www.lextutor.ca/freq/lists_download/phrase_list_martinez.htm",
  },
  phrasalVerbs: {
    fileName: "linguaflow-phrasal-verbs.json",
    sha256: "880f113bd1ee7983fba81d0ae5bc804a7242e2d1c51b5f34cee202f73bb5f8f6",
    url: "https://raw.githubusercontent.com/WithEnglishWeCan/generated-english-phrasal-verbs/25de2d4421e02e6b58b65ca5f163f3bb3a58e772/phrasal.verbs.build.json",
  },
}

const packDefinitions = {
  b1: {
    label: "B1",
    shortLabel: "B1 中级",
    description: "CEFR-J 1.6 B1 全量有效词条",
    tagNames: ["B1"],
  },
  "b2-ielts-6": {
    label: "B2 / 雅思 6 分",
    shortLabel: "B2 / 雅思 6 分",
    description: "CEFR-J 1.6 B2 全量有效词条，雅思 6 分近似对应 B2",
    tagNames: ["B2 / 雅思 6 分"],
  },
  c1: {
    label: "C1",
    shortLabel: "C1 高级",
    description: "Octanove C1/C2 Profile 的 C1 全量有效词条",
    tagNames: ["C1"],
  },
  "common-phrases": {
    label: "常用词组",
    shortLabel: "常用词组",
    description: "PHRASE List 高频多词表达全量有效词条",
    tagNames: ["常用词组"],
  },
}

const phraseOverrides = new Map([
  ["THERE IS/ARE", ["there is", "there are"]],
  ["A BIT (OF)", ["a bit of"]],
  ["(BE) LIKELY TO", ["be likely to"]],
  ["IN ADDITION (TO)", ["in addition to"]],
  ["A GOOD/GREAT DEAL ('MUCH')", ["a good deal", "a great deal"]],
  ["GET ON/OFF (TRANs)", ["get on", "get off"]],
  ["ON THE BASIS (OF)", ["on the basis of"]],
  ["IN TOUCH (WITH)", ["in touch with"]],
  ["IN THE EVENT (OF)", ["in the event of"]],
  ["(WITH) REGARD TO", ["with regard to"]],
  ["IN CONTRAST (TO)", ["in contrast to"]],
  ["IN RETURN (FOR)", ["in return for"]],
  ["RUN OUT (OF)", ["run out of"]],
  ["MAKE ITS/ONE?S WAY", ["make its way", "make one's way"]],
  ["(AT) THE OUTSET", ["at the outset"]],
])

const phraseDefinitionOverrides = {
  "a case of": ["an instance or situation of a particular kind", "一种特定情况或实例"],
  "a degree of": ["a limited amount or level of something", "某种程度的"],
  "a further": ["an additional one or amount", "另一个；进一步的"],
  "a go": ["an attempt at doing something", "一次尝试"],
  "a long way": ["to a great extent or with a large effect", "在很大程度上；大有帮助"],
  "a mere": ["only the small amount or number stated", "仅仅；只不过"],
  "a question of": ["a matter that depends mainly on something", "是一个……的问题"],
  "afford to": [
    "to have enough time, money, or opportunity to do something",
    "有条件或能力做某事",
  ],
  "backed by": ["supported by a person, group, or resource", "由……支持"],
  "be expected to": [
    "to be required or considered likely to do something",
    "被期望或预计做某事",
  ],
  "bother to": ["to make the effort to do something", "费心去做某事"],
  "can tell": ["to be able to know or recognize something", "能够看出或判断"],
  "care to": ["used to ask whether someone would like to do something", "愿意做某事"],
  "concerned with": [
    "related to or dealing with a particular subject",
    "与……有关；涉及",
  ],
  "could hardly": ["was almost unable to do something", "几乎不能"],
  "do so": ["to perform the action just mentioned", "这样做"],
  "entitled to": ["having the right to receive or do something", "有权享有或做某事"],
  "found to": [
    "discovered or shown to have a particular quality",
    "被发现具有某种情况",
  ],
  "half past": ["thirty minutes after a stated hour", "某点半"],
  "head to": ["to go in the direction of a place", "前往"],
  "held that": ["formally believed, decided, or stated that", "认定；主张"],
  "i'm afraid": ["used politely to introduce unwelcome information", "恐怕；很遗憾"],
  "in which case": ["if that situation is true", "如果是那样的话"],
  "is to": ["is scheduled, expected, or required to", "将要；应当"],
  "it takes": ["it requires a particular amount, effort, or quality", "这需要"],
  "known to": ["recognized or reported as having a quality or habit", "被认为或已知会"],
  "led by": ["guided, influenced, or directed by", "由……带领或驱使"],
  "limited to": ["restricted to a particular group, amount, or area", "仅限于"],
  "make its way": ["to move or progress toward a place or result", "前行；逐步到达"],
  "no sign of": ["no evidence that someone or something is present", "没有……的迹象"],
  "not even": [
    "used to emphasize that the least expected thing is not true",
    "甚至不；连……也不",
  ],
  "of little": [
    "having only a small amount, value, or importance",
    "几乎没有；价值很小",
  ],
  "on the grounds": ["for the reason or justification stated", "基于……的理由"],
  "or two": ["one or a small number more", "一两个；少量"],
  "prove to be": ["to be shown eventually to have a particular quality", "结果证明是"],
  "quite a lot": ["a fairly large amount or frequency", "相当多；经常"],
  "reflected in": ["shown or expressed in something", "反映在……中"],
  "said to be": ["reported or generally believed to be", "据说是"],
  "seek to": ["to try or aim to do something", "试图；力求"],
  "shake one's head": ["to move the head from side to side, often to show no", "摇头"],
  "shown to": ["demonstrated by evidence to have a quality or effect", "已被证明"],
  "sight of": ["the act or experience of seeing someone or something", "看见；见到"],
  "something about": [
    "an unspecified quality connected with someone or something",
    "某种说不清的特质",
  ],
  "something like that": [
    "something similar to what was just mentioned",
    "类似那样的事情",
  ],
  "that sort of thing": ["things similar to those just mentioned", "诸如此类的事情"],
  "that which": ["the thing or things that", "……的事物"],
  "the case": ["the true situation or set of facts", "事实；情况"],
  "the extent to which": [
    "the degree to which something is true or happens",
    "……的程度",
  ],
  "the following": ["the person or thing mentioned next", "以下内容"],
  "the means": [
    "the money, resources, or ability needed for something",
    "所需的钱、资源或能力",
  ],
  "the odd": ["an occasional one", "偶尔的一个"],
  "the sight of": ["the experience of seeing someone or something", "看到……"],
  "the whole thing": ["all of a situation, event, or object", "整件事；全部"],
  "things like that": ["similar things or activities", "诸如此类的事物"],
  "think so": ["to believe that a statement or idea is true", "这样认为"],
  "this stage": ["this point in a process or development", "现阶段"],
  "those who": ["the people who", "那些……的人"],
  "thought of": [
    "regarded, remembered, or considered in a particular way",
    "被认为；被想到",
  ],
  "to do with": ["connected or concerned with something", "与……有关"],
  "to me": ["in my opinion or from my point of view", "对我来说；在我看来"],
  "to the extent": ["to the degree or limit specified", "达到……的程度"],
  "touch of": ["a small amount or slight sign of something", "一点；一丝"],
  "was to": ["was scheduled, expected, or required to", "原定；应当"],
  "way round": [
    "knowledge of how to move through or deal with something",
    "熟悉路线或处理方法",
  ],
  "wealth of": ["a large amount or rich supply of something", "大量；丰富的"],
  "when it comes to": [
    "when considering or dealing with a particular subject",
    "说到；谈及",
  ],
  "worth of": ["an amount of something having the stated value", "价值……的数量"],
  "would appear": ["seems to be true based on available information", "看来；似乎"],
  "would say": ["used to give an estimate or considered opinion", "我会说；据我估计"],
  "would you like": [
    "used to offer something or invite someone politely",
    "你愿意；你想要",
  ],
  "yet to": ["not having happened or been done up to now", "尚未"],
}

const definitionOverrides = {
  "check-in desk": [
    "a counter where passengers register and leave baggage before a flight",
    "机场值机柜台",
  ],
  "well-organised": [
    "planned or arranged efficiently and clearly",
    "组织良好的；安排有序的",
  ],
  personalisation: [
    "the process of adapting something to a particular person's needs",
    "个性化；私人订制",
  ],
  recognisably: ["in a way that is easy to identify or recognize", "可辨认地；明显地"],
  stressfully: [
    "in a way that causes or involves worry and pressure",
    "压力重重地；紧张地",
  ],
  unenviably: ["in a way that is difficult or undesirable", "处境艰难地；不令人羡慕地"],
  unscathing: ["in a way that is not severely critical", "不严厉批评地"],
  unsustainably: [
    "in a way that cannot continue without causing harm or depletion",
    "不可持续地",
  ],
}

const validVocabularyTermPattern = /^[a-z][a-z'-]*(?: [a-z][a-z'-]*){0,5}$/iu

const partOfSpeechLabels = {
  a: "adjective",
  ad: "adverb",
  adv: "adverb",
  art: "article",
  aux: "auxiliary verb",
  c: "conjunction",
  conj: "conjunction",
  det: "determiner",
  int: "interjection",
  n: "noun",
  num: "number",
  prep: "preposition",
  pron: "pronoun",
  v: "verb",
  vi: "intransitive verb",
  vt: "transitive verb",
}

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : null
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

async function readSource(source) {
  let buffer
  if (sourceDirectory) {
    buffer = await readFile(join(sourceDirectory, source.fileName))
  } else if (source.size) {
    const chunkSize = 900_000
    const chunks = []
    for (let start = 0; start < source.size; start += chunkSize) {
      const end = Math.min(source.size - 1, start + chunkSize - 1)
      const response = await fetch(source.url, {
        headers: { Range: `bytes=${start}-${end}` },
        signal: AbortSignal.timeout(120_000),
      })
      if (!response.ok && response.status !== 206) {
        throw new Error(`下载 ${basename(source.fileName)} 失败：${response.status}`)
      }
      chunks.push(Buffer.from(await response.arrayBuffer()))
    }
    buffer = Buffer.concat(chunks)
  } else {
    const response = await fetch(source.url, {
      signal: AbortSignal.timeout(120_000),
    })
    if (!response.ok) {
      throw new Error(`下载 ${basename(source.fileName)} 失败：${response.status}`)
    }
    buffer = Buffer.from(await response.arrayBuffer())
  }

  const checksum = sha256(buffer)
  if (checksum !== source.sha256) {
    throw new Error(
      `${source.fileName} 校验失败：期望 ${source.sha256}，实际 ${checksum}`,
    )
  }
  return buffer
}

function parseCsv(value) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (!quoted && character === ",") {
      row.push(field)
      field = ""
      continue
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && value[index + 1] === "\n") {
        index += 1
      }
      row.push(field)
      if (row.some(Boolean)) {
        rows.push(row)
      }
      row = []
      field = ""
      continue
    }
    field += character
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

function normalizeTerm(value) {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replace(/\s+/gu, " ")
}

function expandHeadword(value) {
  return Array.from(
    new Set(
      value
        .split("/")
        .map(normalizeTerm)
        .filter((term) => validVocabularyTermPattern.test(term)),
    ),
  )
}

function normalizeHtmlText(value) {
  return value
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/&#\d+;/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
}

function normalizePhraseCandidates(rawValue) {
  const overridden = phraseOverrides.get(rawValue)
  if (overridden) {
    return overridden
  }

  const normalized = normalizeTerm(rawValue)
    .replace(/([a-z])\?([a-z])/giu, "$1'$2")
    .replace(/\([^)]*\)/gu, "")
    .replace(/\[[^\]]*\]/gu, "")
    .replace(/[^a-z'/-]+/giu, " ")
    .replace(/\s+/gu, " ")
    .trim()

  return normalized
    .split("/")
    .map((term) => term.trim())
    .filter((term) => validVocabularyTermPattern.test(term))
}

function normalizeDictionaryText(value, maximumLength) {
  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .slice(0, maximumLength)
}

function normalizePhonetic(value) {
  const phonetic = value.trim().slice(0, 196)
  if (!phonetic) {
    return ""
  }
  return /^[/[].*[/\]]$/u.test(phonetic) ? phonetic : `/${phonetic}/`
}

function normalizePartOfSpeech(value) {
  const labels = value
    .split("/")
    .map((item) => item.trim().replace(/\.$/u, ""))
    .map((item) => partOfSpeechLabels[item] ?? item)
    .filter(Boolean)
  return Array.from(new Set(labels)).join(", ").slice(0, 80)
}

function createLevelTerms(rows, level) {
  const terms = new Map()
  for (const row of rows.slice(1)) {
    if (row[2]?.trim() !== level) {
      continue
    }
    for (const word of expandHeadword(row[0] ?? "")) {
      const current = terms.get(word) ?? new Set()
      const partOfSpeech = row[1]?.trim()
      if (partOfSpeech) {
        current.add(partOfSpeech)
      }
      terms.set(word, current)
    }
  }
  return terms
}

function parsePhraseList(value) {
  const rows = []
  for (const match of value.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)) {
    const cells = Array.from(
      match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/giu),
      (cell) => normalizeHtmlText(cell[1]),
    )
    if (
      cells.length < 7 ||
      !/^\d+$/u.test(cells[0] ?? "") ||
      !/^\d+$/u.test(cells[2] ?? "")
    ) {
      continue
    }
    const example = (cells[6] ?? "")
      .replace(/([a-z])\?([a-z])/giu, "$1'$2")
      .replace(/\s+([,.!?])/gu, "$1")
      .trim()
    for (const word of normalizePhraseCandidates(cells[1] ?? "")) {
      rows.push({
        word,
        rank: Number(cells[0]),
        frequency: Number(cells[2]),
        example,
      })
    }
  }

  const phrases = new Map()
  for (const row of rows) {
    const current = phrases.get(row.word)
    if (!current || row.frequency > current.frequency) {
      phrases.set(row.word, row)
    }
  }
  return phrases
}

function createDictionary(rows) {
  const header = rows[0] ?? []
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]))
  const dictionary = new Map()
  for (const row of rows.slice(1)) {
    const word = normalizeTerm(row[indexes.word] ?? "")
    if (!word || dictionary.has(word)) {
      continue
    }
    dictionary.set(word, {
      word,
      phonetic: normalizePhonetic(row[indexes.phonetic] ?? ""),
      definition: normalizeDictionaryText(row[indexes.definition] ?? "", 4000),
      definitionTranslation: normalizeDictionaryText(
        row[indexes.translation] ?? "",
        4000,
      ),
      partOfSpeech: normalizePartOfSpeech(row[indexes.pos] ?? ""),
    })
  }
  return dictionary
}

async function readLookupCache() {
  try {
    return JSON.parse(await readFile(lookupCachePath, "utf8"))
  } catch {
    return { definitions: {}, translations: {} }
  }
}

async function writeLookupCache(cache) {
  await mkdir(new URL("../tmp/", import.meta.url), { recursive: true })
  await writeFile(lookupCachePath, `${JSON.stringify(cache, null, 2)}\n`)
}

async function queryFreeDictionary(word) {
  try {
    const response = await fetch(
      `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (!response.ok) {
      return null
    }
    const payload = await response.json()
    const entries = Array.isArray(payload.entries) ? payload.entries : []
    for (const entry of entries) {
      const senses = Array.isArray(entry?.senses) ? entry.senses : []
      const definition = senses.find(
        (sense) => typeof sense?.definition === "string" && sense.definition.trim(),
      )?.definition
      if (!definition) {
        continue
      }
      const example = senses
        .flatMap((sense) => (Array.isArray(sense?.examples) ? sense.examples : []))
        .find((item) => typeof item === "string" && item.trim())
      const pronunciation = Array.isArray(entry?.pronunciations)
        ? entry.pronunciations.find(
            (item) => item?.type === "ipa" && typeof item?.text === "string",
          )?.text
        : ""
      return {
        definition: String(definition).trim().slice(0, 4000),
        example: typeof example === "string" ? example.trim().slice(0, 500) : "",
        partOfSpeech:
          typeof entry?.partOfSpeech === "string"
            ? entry.partOfSpeech.trim().slice(0, 80)
            : "",
        phonetic: typeof pronunciation === "string" ? pronunciation.slice(0, 200) : "",
      }
    }
  } catch {
    return null
  }
  return null
}

function getTranslationCacheKey(value, sourceLanguage, targetLanguage) {
  return `${sourceLanguage}|${targetLanguage}|${value}`
}

function decodeTranslation(value) {
  return value
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&#39;/gu, "'")
    .replace(/&quot;/gu, '"')
    .trim()
}

async function queryTranslation(value, sourceLanguage, targetLanguage) {
  const text = value.trim().slice(0, 450)
  if (!text) {
    return ""
  }
  try {
    const params = new URLSearchParams({
      q: text,
      langpair: `${sourceLanguage}|${targetLanguage}`,
    })
    const response = await fetch(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      { signal: AbortSignal.timeout(15_000) },
    )
    if (response.ok) {
      const payload = await response.json()
      const translatedText = payload?.responseData?.translatedText
      if (
        typeof translatedText === "string" &&
        !translatedText.includes("MYMEMORY WARNING")
      ) {
        return decodeTranslation(translatedText)
      }
    }
  } catch {
    // Fall through to the secondary endpoint.
  }

  try {
    const params = new URLSearchParams({
      client: "gtx",
      sl: sourceLanguage,
      tl: targetLanguage,
      dt: "t",
      q: text,
    })
    const { stdout } = await execFileAsync("/usr/bin/curl", [
      "-L",
      "--max-time",
      "15",
      "-sS",
      `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    ])
    const payload = JSON.parse(stdout)
    return Array.isArray(payload?.[0])
      ? payload[0]
          .map((item) => (Array.isArray(item) ? item[0] : ""))
          .filter((item) => typeof item === "string")
          .join("")
          .trim()
      : ""
  } catch {
    return ""
  }
}

async function fillLookupCache(words, cache, phrasalVerbs) {
  const missingDefinitions = words.filter(
    (word) =>
      cache.definitions[word] === undefined && !phrasalVerbs[word]?.descriptions?.[0],
  )
  await runInBatches(
    missingDefinitions,
    8,
    async (word) => {
      const result = await queryFreeDictionary(word)
      cache.definitions[word] = result ?? false
    },
    "词典查询",
  )
  await writeLookupCache(cache)
}

async function fillTranslationCache(requests, cache) {
  const requestsByKey = new Map()
  for (const request of requests) {
    if (!request.value) {
      continue
    }
    const key = getTranslationCacheKey(
      request.value,
      request.sourceLanguage,
      request.targetLanguage,
    )
    if (!cache.translations[key]) {
      requestsByKey.set(key, request)
    }
  }
  const missingRequests = Array.from(requestsByKey, ([key, request]) => ({
    key,
    ...request,
  }))
  await runInBatches(
    missingRequests,
    2,
    async (request) => {
      cache.translations[request.key] =
        (await queryTranslation(
          request.value,
          request.sourceLanguage,
          request.targetLanguage,
        )) || false
    },
    "翻译",
  )
  await writeLookupCache(cache)
}

function readCachedTranslation(cache, value, sourceLanguage, targetLanguage) {
  return (
    cache.translations[getTranslationCacheKey(value, sourceLanguage, targetLanguage)] ||
    ""
  )
}

async function runInBatches(items, concurrency, callback, label) {
  let completed = 0
  let nextIndex = 0
  async function runNext() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item !== undefined) {
        await callback(item)
      }
      completed += 1
      if (completed % 50 === 0 || completed === items.length) {
        console.log(`${label}：${completed}/${items.length}`)
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, runNext),
  )
}

function createEntry({
  word,
  partsOfSpeech,
  level,
  dictionary,
  phrase,
  phrasalVerbs,
  cache,
}) {
  const dictionaryEntry = dictionary.get(word)
  const remoteEntry = cache.definitions[word] || null
  const phrasalEntry = phrasalVerbs[word]
  const curatedDefinition = definitionOverrides[word] ?? phraseDefinitionOverrides[word]
  const phrasalDefinition = Array.isArray(phrasalEntry?.descriptions)
    ? phrasalEntry.descriptions.find((item) => typeof item === "string" && item.trim())
    : ""
  const definition =
    dictionaryEntry?.definition ||
    phrasalDefinition ||
    remoteEntry?.definition ||
    curatedDefinition?.[0] ||
    readCachedTranslation(
      cache,
      dictionaryEntry?.definitionTranslation ?? "",
      "zh-CN",
      "en",
    ) ||
    (phrase
      ? "A frequent English expression used in the accompanying example."
      : `A ${level}-level English vocabulary item in the source profile.`)
  const example = phrase?.example || remoteEntry?.example || ""
  return {
    word,
    partOfSpeech:
      Array.from(partsOfSpeech ?? [])
        .join(", ")
        .slice(0, 80) ||
      dictionaryEntry?.partOfSpeech ||
      remoteEntry?.partOfSpeech ||
      (phrase ? "phrase" : ""),
    phonetic: dictionaryEntry?.phonetic || remoteEntry?.phonetic || "",
    definition: definition.slice(0, 4000),
    definitionTranslation:
      dictionaryEntry?.definitionTranslation ||
      curatedDefinition?.[1] ||
      (phrase ? readCachedTranslation(cache, word, "en", "zh-CN") : "") ||
      readCachedTranslation(cache, definition, "en", "zh-CN") ||
      (phrase ? `常用表达：${word}` : `${level} 级词汇：${word}`),
    example: example.slice(0, 500),
    exampleTranslation: example
      ? readCachedTranslation(cache, example, "en", "zh-CN") ||
        `该例句展示“${word}”的常见用法。`
      : "",
    cefrLevel: level,
  }
}

async function main() {
  console.log("读取词库源文件...")
  const [
    cefrB1Buffer,
    cefrB2Buffer,
    c1Buffer,
    dictionaryBuffer,
    phraseBuffer,
    phrasalBuffer,
  ] = await Promise.all([
    readSource(sources.cefrB1),
    readSource(sources.cefrB2),
    readSource(sources.c1),
    readSource(sources.dictionary),
    readSource(sources.phraseList),
    readSource(sources.phrasalVerbs),
  ])

  const cefrB1Rows = parseCsv(cefrB1Buffer.toString("utf8"))
  const cefrB2Rows = parseCsv(cefrB2Buffer.toString("utf8"))
  const c1Rows = parseCsv(c1Buffer.toString("utf8"))
  const dictionary = createDictionary(parseCsv(dictionaryBuffer.toString("utf8")))
  const phraseRows = parsePhraseList(
    new TextDecoder("windows-1252").decode(phraseBuffer),
  )
  const phrasalVerbs = JSON.parse(phrasalBuffer.toString("utf8"))
  const levelTerms = {
    B1: createLevelTerms(cefrB1Rows, "B1"),
    B2: createLevelTerms(cefrB2Rows, "B2"),
    C1: createLevelTerms(c1Rows, "C1"),
  }
  const levelByWord = new Map()
  for (const [level, terms] of Object.entries(levelTerms)) {
    for (const word of terms.keys()) {
      if (!levelByWord.has(word)) {
        levelByWord.set(word, level)
      }
    }
  }

  const cache = await readLookupCache()
  const allWords = Array.from(
    new Set([
      ...Object.values(levelTerms).flatMap((terms) => Array.from(terms.keys())),
      ...phraseRows.keys(),
    ]),
  )
  const wordsMissingDefinitions = allWords.filter(
    (word) =>
      !dictionary.get(word)?.definition &&
      !phrasalVerbs[word]?.descriptions?.some(
        (item) => typeof item === "string" && item.trim(),
      ),
  )
  await fillLookupCache(wordsMissingDefinitions, cache, phrasalVerbs)
  await fillTranslationCache(
    allWords.flatMap((word) => {
      const dictionaryEntry = dictionary.get(word)
      const remoteEntry = cache.definitions[word]
      const hasEnglishDefinition = Boolean(
        dictionaryEntry?.definition ||
          phrasalVerbs[word]?.descriptions?.some(
            (item) => typeof item === "string" && item.trim(),
          ) ||
          remoteEntry?.definition,
      )
      return !hasEnglishDefinition && dictionaryEntry?.definitionTranslation
        ? [
            {
              value: dictionaryEntry.definitionTranslation,
              sourceLanguage: "zh-CN",
              targetLanguage: "en",
            },
          ]
        : []
    }),
    cache,
  )

  const provisionalEntries = [
    ...Object.entries(levelTerms).flatMap(([level, terms]) =>
      Array.from(terms, ([word, partsOfSpeech]) =>
        createEntry({
          word,
          partsOfSpeech,
          level,
          dictionary,
          phrase: null,
          phrasalVerbs,
          cache,
        }),
      ),
    ),
    ...Array.from(phraseRows, ([word, phrase]) =>
      createEntry({
        word,
        partsOfSpeech: new Set(["phrase"]),
        level: levelByWord.get(word) ?? "",
        dictionary,
        phrase,
        phrasalVerbs,
        cache,
      }),
    ),
  ]
  await fillTranslationCache(
    provisionalEntries.flatMap((entry) => [
      ...(entry.definitionTranslation
        ? []
        : [
            {
              value: entry.definition,
              sourceLanguage: "en",
              targetLanguage: "zh-CN",
            },
          ]),
      ...(entry.exampleTranslation || !entry.example
        ? []
        : [
            {
              value: entry.example,
              sourceLanguage: "en",
              targetLanguage: "zh-CN",
            },
          ]),
    ]),
    cache,
  )

  const packs = {
    b1: Array.from(levelTerms.B1, ([word, partsOfSpeech]) =>
      createEntry({
        word,
        partsOfSpeech,
        level: "B1",
        dictionary,
        phrase: null,
        phrasalVerbs,
        cache,
      }),
    ),
    "b2-ielts-6": Array.from(levelTerms.B2, ([word, partsOfSpeech]) =>
      createEntry({
        word,
        partsOfSpeech,
        level: "B2",
        dictionary,
        phrase: null,
        phrasalVerbs,
        cache,
      }),
    ),
    c1: Array.from(levelTerms.C1, ([word, partsOfSpeech]) =>
      createEntry({
        word,
        partsOfSpeech,
        level: "C1",
        dictionary,
        phrase: null,
        phrasalVerbs,
        cache,
      }),
    ),
    "common-phrases": Array.from(phraseRows, ([word, phrase]) =>
      createEntry({
        word,
        partsOfSpeech: new Set(["phrase"]),
        level: levelByWord.get(word) ?? "",
        dictionary,
        phrase,
        phrasalVerbs,
        cache,
      }),
    ),
  }

  await mkdir(outputDirectory, { recursive: true })
  for (const [id, entries] of Object.entries(packs)) {
    entries.sort((left, right) => left.word.localeCompare(right.word, "en"))
    const definition = packDefinitions[id]
    const payload = {
      version: 1,
      id,
      label: definition.label,
      tagNames: definition.tagNames,
      entries,
    }
    await writeFile(
      new URL(`${id}.json`, outputDirectory),
      `${JSON.stringify(payload)}\n`,
    )
  }

  const manifest = Object.entries(packs).map(([id, entries]) => ({
    id,
    ...packDefinitions[id],
    itemCount: entries.length,
  }))
  await writeFile(
    new URL("manifest.json", outputDirectory),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )

  console.log(
    `已生成：${manifest.map((item) => `${item.label} ${item.itemCount}`).join("，")}`,
  )
}

await main()
