export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`
  }
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

export function formatLearningTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours === 0) {
    return `${minutes} 分钟`
  }
  return `${hours} 小时 ${minutes} 分`
}

export function formatRelativeDate(value: string | null): string {
  if (!value) {
    return "尚未开始"
  }

  const difference = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(difference / 60_000)
  const hours = Math.floor(difference / 3_600_000)
  const days = Math.floor(difference / 86_400_000)

  if (minutes < 1) {
    return "刚刚"
  }
  if (minutes < 60) {
    return `${minutes} 分钟前`
  }
  if (hours < 24) {
    return `${hours} 小时前`
  }
  if (days < 7) {
    return `${days} 天前`
  }
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
  }).format(new Date(value))
}

export function getInitials(email: string): string {
  const localPart = email.split("@")[0] ?? "LF"
  return localPart.slice(0, 2).toUpperCase()
}
