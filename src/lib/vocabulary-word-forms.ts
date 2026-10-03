const irregularVerbInflections: Record<
  string,
  { continuous: string; participle: string; past: string; third: string }
> = {
  be: { continuous: "being", participle: "been", past: "was", third: "is" },
  become: {
    continuous: "becoming",
    participle: "become",
    past: "became",
    third: "becomes",
  },
  begin: {
    continuous: "beginning",
    participle: "begun",
    past: "began",
    third: "begins",
  },
  break: {
    continuous: "breaking",
    participle: "broken",
    past: "broke",
    third: "breaks",
  },
  bring: {
    continuous: "bringing",
    participle: "brought",
    past: "brought",
    third: "brings",
  },
  build: {
    continuous: "building",
    participle: "built",
    past: "built",
    third: "builds",
  },
  buy: {
    continuous: "buying",
    participle: "bought",
    past: "bought",
    third: "buys",
  },
  come: {
    continuous: "coming",
    participle: "come",
    past: "came",
    third: "comes",
  },
  do: { continuous: "doing", participle: "done", past: "did", third: "does" },
  drink: {
    continuous: "drinking",
    participle: "drunk",
    past: "drank",
    third: "drinks",
  },
  eat: {
    continuous: "eating",
    participle: "eaten",
    past: "ate",
    third: "eats",
  },
  feel: {
    continuous: "feeling",
    participle: "felt",
    past: "felt",
    third: "feels",
  },
  find: {
    continuous: "finding",
    participle: "found",
    past: "found",
    third: "finds",
  },
  get: { continuous: "getting", participle: "gotten", past: "got", third: "gets" },
  give: {
    continuous: "giving",
    participle: "given",
    past: "gave",
    third: "gives",
  },
  go: { continuous: "going", participle: "gone", past: "went", third: "goes" },
  have: { continuous: "having", participle: "had", past: "had", third: "has" },
  hear: {
    continuous: "hearing",
    participle: "heard",
    past: "heard",
    third: "hears",
  },
  keep: {
    continuous: "keeping",
    participle: "kept",
    past: "kept",
    third: "keeps",
  },
  know: { continuous: "knowing", participle: "known", past: "knew", third: "knows" },
  leave: {
    continuous: "leaving",
    participle: "left",
    past: "left",
    third: "leaves",
  },
  make: { continuous: "making", participle: "made", past: "made", third: "makes" },
  meet: {
    continuous: "meeting",
    participle: "met",
    past: "met",
    third: "meets",
  },
  pay: { continuous: "paying", participle: "paid", past: "paid", third: "pays" },
  put: { continuous: "putting", participle: "put", past: "put", third: "puts" },
  read: { continuous: "reading", participle: "read", past: "read", third: "reads" },
  run: { continuous: "running", participle: "run", past: "ran", third: "runs" },
  say: { continuous: "saying", participle: "said", past: "said", third: "says" },
  see: { continuous: "seeing", participle: "seen", past: "saw", third: "sees" },
  sell: {
    continuous: "selling",
    participle: "sold",
    past: "sold",
    third: "sells",
  },
  send: {
    continuous: "sending",
    participle: "sent",
    past: "sent",
    third: "sends",
  },
  speak: {
    continuous: "speaking",
    participle: "spoken",
    past: "spoke",
    third: "speaks",
  },
  take: { continuous: "taking", participle: "taken", past: "took", third: "takes" },
  teach: {
    continuous: "teaching",
    participle: "taught",
    past: "taught",
    third: "teaches",
  },
  tell: {
    continuous: "telling",
    participle: "told",
    past: "told",
    third: "tells",
  },
  think: {
    continuous: "thinking",
    participle: "thought",
    past: "thought",
    third: "thinks",
  },
  understand: {
    continuous: "understanding",
    participle: "understood",
    past: "understood",
    third: "understands",
  },
  write: {
    continuous: "writing",
    participle: "written",
    past: "wrote",
    third: "writes",
  },
}

const irregularBaseWords = createIrregularBaseWords()

export function normalizeVocabularyWordToken(value: string): string {
  return value.replace(/^[^a-z]+|[^a-z]+$/giu, "").toLocaleLowerCase("en")
}

export function getVocabularyBaseWordCandidates(value: string): string[] {
  const normalized = normalizeVocabularyWordToken(value)
  if (!normalized) {
    return []
  }

  const candidates = new Set([normalized])
  for (const baseWord of irregularBaseWords.get(normalized) ?? []) {
    candidates.add(baseWord)
  }
  if (normalized.endsWith("ies") && normalized.length > 3) {
    candidates.add(`${normalized.slice(0, -3)}y`)
  }
  if (normalized.endsWith("ied") && normalized.length > 3) {
    candidates.add(`${normalized.slice(0, -3)}y`)
  }
  if (normalized.endsWith("ing") && normalized.length > 4) {
    const root = normalized.slice(0, -3)
    candidates.add(root)
    candidates.add(`${root}e`)
    if (/([bcdfghjklmnpqrstvwxyz])\1$/u.test(root)) {
      candidates.add(root.slice(0, -1))
    }
  }
  if (normalized.endsWith("ed") && normalized.length > 3) {
    const root = normalized.slice(0, -2)
    candidates.add(root)
    candidates.add(`${root}e`)
    if (/([bcdfghjklmnpqrstvwxyz])\1$/u.test(root)) {
      candidates.add(root.slice(0, -1))
    }
  }
  if (normalized.endsWith("es") && normalized.length > 3) {
    candidates.add(normalized.slice(0, -2))
  }
  if (normalized.endsWith("s") && normalized.length > 2 && !normalized.endsWith("ss")) {
    candidates.add(normalized.slice(0, -1))
  }

  return Array.from(candidates).filter((candidate) => candidate.length > 1)
}

export function getVocabularyWordForms(
  value: string,
  additionalForms: readonly string[] = [],
): Set<string> {
  const forms = new Set<string>()
  const candidates = new Set([
    ...getVocabularyBaseWordCandidates(value),
    ...additionalForms.flatMap(getVocabularyBaseWordCandidates),
  ])

  for (const candidate of candidates) {
    forms.add(candidate)
    const inflections =
      irregularVerbInflections[candidate] ?? getRegularVerbInflections(candidate)
    forms.add(inflections.third)
    forms.add(inflections.past)
    forms.add(inflections.participle)
    forms.add(inflections.continuous)
  }
  return forms
}

function getRegularVerbInflections(base: string) {
  const third =
    base.endsWith("y") && !/[aeiou]y$/u.test(base)
      ? `${base.slice(0, -1)}ies`
      : /(s|x|z|ch|sh|o)$/u.test(base)
        ? `${base}es`
        : `${base}s`
  const past =
    base.endsWith("y") && !/[aeiou]y$/u.test(base)
      ? `${base.slice(0, -1)}ied`
      : base.endsWith("e")
        ? `${base}d`
        : `${base}ed`
  const continuous =
    base.endsWith("e") && !/(ee|ye)$/u.test(base)
      ? `${base.slice(0, -1)}ing`
      : `${base}ing`

  return { third, past, participle: past, continuous }
}

function createIrregularBaseWords(): Map<string, string[]> {
  const baseWords = new Map<string, string[]>()
  for (const [baseWord, inflections] of Object.entries(irregularVerbInflections)) {
    for (const form of Object.values(inflections)) {
      const current = baseWords.get(form) ?? []
      if (!current.includes(baseWord)) {
        current.push(baseWord)
        baseWords.set(form, current)
      }
    }
  }
  return baseWords
}
