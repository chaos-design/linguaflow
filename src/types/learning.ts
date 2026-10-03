export type VideoSourceType = "local" | "upload" | "link"
export type VideoStatus = "processing" | "ready" | "failed"

export interface LearningTag {
  id: string
  name: string
  isDefault: boolean
}

export interface LearningCategory {
  id: string
  name: string
  color: "neutral" | "blue" | "green" | "amber" | "red"
}

export interface VideoSummary {
  id: string
  title: string
  description: string
  sourceType: VideoSourceType
  sourceUrl: string | null
  localFileKey: string | null
  thumbnailUrl: string | null
  durationSeconds: number
  status: VideoStatus
  createdAt: string
  category: LearningCategory | null
  tags: LearningTag[]
  transcriptCueCount: number
  positionSeconds: number
  completionPercent: number
  completed: boolean
  lastWatchedAt: string | null
}

export interface LearningTaxonomy {
  categories: LearningCategory[]
  tags: LearningTag[]
}

export interface VideoImportOptions {
  title?: string
  description?: string
  categoryName?: string
  tagNames?: string[]
  saveTagsAsDefault?: boolean
  transcriptContent?: string
}

export interface VideoNote {
  id: string
  videoId: string
  timestampSeconds: number
  content: string
  createdAt: string
  updatedAt: string
}

export interface TranscriptCue {
  id: string
  videoId: string
  startSeconds: number
  endSeconds: number
  text: string
  translation: string
  translationLanguage: string | null
}

export interface VideoDetail extends VideoSummary {
  notes: VideoNote[]
  transcriptCues: TranscriptCue[]
  storagePath: string | null
  signedPlaybackUrl: string | null
}

export type VocabularyMastery = "new" | "learning" | "mastered"
export type EnglishLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"

export interface VocabularyImportItem {
  word: string
  partOfSpeech: string
  definition: string
  definitionTranslation: string
  example: string
  exampleTranslation: string
}

export interface VocabularyImportFailure {
  word: string
  message: string
}

export interface VocabularyImportResult {
  words: VocabularyWord[]
  skipped: string[]
  failures: VocabularyImportFailure[]
}

export interface VocabularyCleanupResult {
  words: VocabularyWord[]
  cleanedCount: number
  failedIds: string[]
  hasMore: boolean
  failures: VocabularyImportFailure[]
}

export interface VocabularyWord {
  id: string
  word: string
  tags: LearningTag[]
  phonetic: string
  phoneticUk: string
  phoneticUs: string
  partOfSpeech: string
  definition: string
  definitionTranslation: string
  meanings: DictionaryMeaning[]
  examLabels: string[]
  inflections: DictionaryInflection[]
  examples: string[]
  exampleTranslations: DictionaryExample[]
  commonPhrases: DictionaryPhrase[]
  wordAnalysis: DictionaryWordAnalysis
  dictionarySources: DictionarySource[]
  aiAnalysis: AiVocabularyAnalysis | null
  sourceTitle: string
  sourceVideoId: string | null
  sourceTimestampSeconds: number
  sourceSentence: string
  translation: string
  addedAt: string
  mastery: VocabularyMastery
  easeFactor: number
  intervalDays: number
  repetitions: number
  dueAt: string
  lastReviewedAt: string | null
}

export interface VocabularyReviewProgress {
  dueAt: string
  easeFactor: number
  intervalDays: number
  lastReviewedAt: string
  mastery: VocabularyMastery
  repetitions: number
}

export interface DictionaryMeaning {
  partOfSpeech: string
  definition: string
  translation: string
  example: string
  exampleTranslation: string
}

export type DictionarySourceId = "free-dictionary" | "datamuse"

export interface DictionarySourceSummary {
  id: DictionarySourceId
  label: string
  description: string
  url: string
}

export interface DictionarySource extends DictionarySourceSummary {
  meanings: DictionaryMeaning[]
}

export interface DictionaryExample {
  text: string
  translation: string
}

export interface DictionaryPhrase {
  text: string
  translation: string
  note: string
  example: string
  exampleTranslation: string
}

export interface DictionaryInflection {
  label: string
  value: string
}

export interface DictionaryWordPart {
  kind: "prefix" | "root" | "suffix" | "base"
  text: string
  meaning: string
  meaningTranslation: string
  source: string
  phrase: string
  phraseTranslation: string
  example: string
  exampleTranslation: string
}

export interface DictionaryWordAnalysis {
  etymology: string
  etymologyTranslation: string
  examLabels: string[]
  inflections: DictionaryInflection[]
  parts: DictionaryWordPart[]
  relatedWords: string[]
}

export interface BilingualText {
  en: string
  zh: string
}

export interface AiVocabularyItem extends BilingualText {
  term: string
}

export interface AiVocabularyWordPart extends AiVocabularyItem {
  source: string
  phrase: string
  phraseTranslation: string
  example: string
  exampleTranslation: string
}

export interface AiVocabularyExample extends AiVocabularyItem {
  translation: string
}

export interface AiEtymologyNode extends BilingualText {
  label: string
  children: AiEtymologyNode[]
}

export interface AiVocabularyAnalysis {
  generatedAt: string
  cefrLevel: EnglishLevel | ""
  examLabels: string[]
  meanings: AiVocabularyItem[]
  inflections: AiVocabularyItem[]
  explanation: BilingualText
  partsOfSpeech: AiVocabularyItem[]
  tenses: AiVocabularyItem[]
  etymology: BilingualText
  etymologyTree: AiEtymologyNode[]
  wordParts: AiVocabularyWordPart[]
  wordPartMemory: BilingualText
  derivatives: AiVocabularyItem[]
  examples: AiVocabularyExample[]
  collocations: AiVocabularyItem[]
  phrases: AiVocabularyItem[]
  idioms: AiVocabularyItem[]
  synonyms: AiVocabularyItem[]
  antonyms: AiVocabularyItem[]
  replacements: AiVocabularyItem[]
  newMeanings: AiVocabularyItem[]
}

export type AiModelProviderId = "openai" | "anthropic" | "custom"

export type AiModelEndpointKind = "chat-completions" | "anthropic-messages"

export interface AiModelConfigInput {
  enabled: boolean
  provider: AiModelProviderId
  baseUrl: string
  endpointKind: AiModelEndpointKind
  model: string
  apiKey: string
}

export interface DictionaryEntry {
  word: string
  phonetic: string
  phoneticUk: string
  phoneticUs: string
  partOfSpeech: string
  definition: string
  translation: string
  examLabels: string[]
  inflections: DictionaryInflection[]
  example: string
  audioUrl: string | null
  audioUrlUk: string | null
  audioUrlUs: string | null
  meanings: DictionaryMeaning[]
  sources: DictionarySource[]
  supplementalExamples: DictionaryExample[]
  commonPhrases: DictionaryPhrase[]
  wordAnalysis: DictionaryWordAnalysis
}

export interface InspectedVideo {
  sourceKey: string
  sourceUrl: string
  provider: "YouTube" | "Bilibili" | "Vimeo" | "直链视频" | "网页视频"
  title: string
  thumbnailUrl: string | null
  durationSeconds: number
  detectedCaptions: {
    cueCount: number
    language: string
    generated: boolean
  } | null
  metadataLimited?: boolean
}

export interface VideoInspectionResult extends InspectedVideo {
  cached: boolean
  parsedAt: string
  existingVideoId: string | null
  existingCategoryName: string | null
}

export type SubtitleTranslationLanguage =
  | "zh-CN"
  | "zh-TW"
  | "ja"
  | "ko"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "ru"

export type SubtitleTranslationOption = "none" | SubtitleTranslationLanguage

export interface LearningPreferences {
  version: 5
  autoOpen: boolean
  bilingualCaptions: boolean
  captionSize: "small" | "medium" | "large"
  subtitleTranslationLanguage: SubtitleTranslationOption
  calendarColor: string
  highlightMastered: boolean
  reviewTarget: number
  dailyNewLimit: number
  autoPause: boolean
  dictionary: "free-dictionary"
  translation: "my-memory"
  phonetic: "us" | "uk" | "both"
  autoPronounce: boolean
  sync: boolean
  weeklySummary: boolean
  resumePlayback: boolean
  defaultVideoTags: string[]
}

export interface PlaylistSummary {
  id: string
  name: string
  description: string
  videoCount: number
  totalDurationSeconds: number
  updatedAt: string
  videos: VideoSummary[]
}

export interface DailyActivity {
  date: string
  label: string
  seconds: number
  sessionCount: number
  reviewCount: number
  noteCount: number
}

export interface LearningStats {
  totalLearningSeconds: number
  completedVideos: number
  activeVideos: number
  totalNotes: number
  currentStreakDays: number
  recentActivity: DailyActivity[]
  calendarActivity: DailyActivity[]
  categoryProgress: Array<{
    name: string
    completed: number
    total: number
  }>
}

export interface WorkspaceOverview {
  continueWatching: VideoSummary[]
  recentVideos: VideoSummary[]
  playlists: PlaylistSummary[]
  stats: LearningStats
}

export interface ActionResult<T = undefined> {
  ok: boolean
  message: string
  data?: T
}
