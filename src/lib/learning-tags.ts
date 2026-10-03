export const maximumLearningTagCount = 12
export const maximumLearningTagNameLength = 40

export function normalizeLearningTagNames(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value]
  const normalizedNames: string[] = []
  const seenNames = new Set<string>()

  for (const item of values) {
    if (typeof item !== "string") {
      continue
    }
    for (const candidate of item.split(/[,，]/u)) {
      const name = candidate
        .trim()
        .replace(/\s+/gu, " ")
        .slice(0, maximumLearningTagNameLength)
      const normalizedName = name.toLocaleLowerCase("zh-CN")
      if (!name || seenNames.has(normalizedName)) {
        continue
      }
      seenNames.add(normalizedName)
      normalizedNames.push(name)
      if (normalizedNames.length === maximumLearningTagCount) {
        return normalizedNames
      }
    }
  }

  return normalizedNames
}
