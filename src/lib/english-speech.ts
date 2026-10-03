export type EnglishAccent = "uk" | "us"

export interface EnglishSpeechVoice {
  default: boolean
  lang: string
  localService: boolean
  name: string
  voiceURI: string
}

const accentLocales: Record<EnglishAccent, string> = {
  uk: "en-GB",
  us: "en-US",
}

const preferredVoicePatterns: Record<EnglishAccent, readonly RegExp[]> = {
  uk: [
    /google uk english female/iu,
    /microsoft sonia/iu,
    /\bserena\b/iu,
    /\bkate\b/iu,
    /\blibby\b/iu,
    /\bstephanie\b/iu,
    /\bamy\b/iu,
  ],
  us: [
    /google us english/iu,
    /microsoft jenny/iu,
    /\bava\b/iu,
    /\ballison\b/iu,
    /\bsamantha\b/iu,
    /\baria\b/iu,
    /\bjoanna\b/iu,
  ],
}

function normalizeLocale(locale: string): string {
  return locale.replaceAll("_", "-").toLowerCase()
}

function getVoiceScore(voice: EnglishSpeechVoice, accent: EnglishAccent): number {
  const preferredIndex = preferredVoicePatterns[accent].findIndex((pattern) =>
    pattern.test(voice.name),
  )
  const preferredScore =
    preferredIndex === -1
      ? 0
      : (preferredVoicePatterns[accent].length - preferredIndex) * 100
  const qualityScore = /\b(?:natural|neural|enhanced|premium)\b/iu.test(voice.name)
    ? 20
    : 0
  const nonDefaultScore = voice.default ? 0 : 10

  return preferredScore + qualityScore + nonDefaultScore
}

export function selectEnglishSpeechVoice<T extends EnglishSpeechVoice>(
  voices: readonly T[],
  accent: EnglishAccent,
): T | null {
  const targetLocale = normalizeLocale(accentLocales[accent])
  const matchingVoices = voices.filter(
    (voice) => normalizeLocale(voice.lang) === targetLocale,
  )

  return (
    matchingVoices
      .map((voice, index) => ({
        index,
        score: getVoiceScore(voice, accent),
        voice,
      }))
      .toSorted(
        (left, right) => right.score - left.score || left.index - right.index,
      )[0]?.voice ?? null
  )
}

function readAvailableVoices(
  speechSynthesis: SpeechSynthesis,
): Promise<SpeechSynthesisVoice[]> {
  const availableVoices = speechSynthesis.getVoices()
  if (availableVoices.length > 0) {
    return Promise.resolve(availableVoices)
  }

  return new Promise((resolve) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    function finish() {
      if (timeoutId !== null) {
        clearTimeout(timeoutId)
      }
      speechSynthesis.removeEventListener("voiceschanged", finish)
      resolve(speechSynthesis.getVoices())
    }

    speechSynthesis.addEventListener("voiceschanged", finish, { once: true })
    timeoutId = setTimeout(finish, 300)
  })
}

export async function speakEnglish(
  text: string,
  accent: EnglishAccent,
): Promise<boolean> {
  const normalizedText = text.trim()
  if (
    !normalizedText ||
    typeof window === "undefined" ||
    typeof SpeechSynthesisUtterance === "undefined" ||
    !("speechSynthesis" in window)
  ) {
    return false
  }

  const speechSynthesis = window.speechSynthesis
  const voices = await readAvailableVoices(speechSynthesis)
  const utterance = new SpeechSynthesisUtterance(normalizedText)
  const voice = selectEnglishSpeechVoice(voices, accent)

  utterance.lang = accentLocales[accent]
  utterance.rate = 0.9
  utterance.pitch = 1
  if (voice) {
    utterance.voice = voice
  }

  try {
    speechSynthesis.cancel()
    speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}
