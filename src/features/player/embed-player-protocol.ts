export interface EmbedPlayerMessage {
  currentTime?: number
  duration?: number
  errorCode?: number
  playerState?: number
  ready?: boolean
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null
}

function readFiniteNumber(
  record: Record<string, unknown> | null,
  key: string,
): number | undefined {
  const value = record?.[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function parseMessageRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string") {
    return asRecord(value)
  }

  try {
    return asRecord(JSON.parse(value))
  } catch {
    return null
  }
}

export function createYouTubePostMessageUrl(
  videoId: string,
  startSeconds: number,
  origin: string,
): string {
  const url = new URL(
    `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`,
  )
  url.searchParams.set("controls", "1")
  url.searchParams.set("enablejsapi", "1")
  url.searchParams.set("fs", "1")
  url.searchParams.set("origin", origin)
  url.searchParams.set("playsinline", "1")
  url.searchParams.set("rel", "0")
  url.searchParams.set("start", String(Math.max(0, Math.floor(startSeconds))))
  return url.toString()
}

export function createVimeoPostMessageUrl(
  sourceUrl: string,
  playerId: string,
  startSeconds: number,
): string {
  const url = new URL(sourceUrl)
  url.searchParams.set("api", "1")
  url.searchParams.set("player_id", playerId)
  url.searchParams.set("playsinline", "1")
  url.hash = `t=${Math.max(0, Math.floor(startSeconds))}s`
  return url.toString()
}

export function parseYouTubePlayerMessage(value: unknown): EmbedPlayerMessage | null {
  const message = parseMessageRecord(value)
  if (!message || typeof message.event !== "string") {
    return null
  }

  const info = asRecord(message.info)
  const update: EmbedPlayerMessage = {}
  if (message.event === "onReady" || message.event === "alreadyInitialized") {
    update.ready = true
  }

  if (message.event === "onStateChange" && typeof message.info === "number") {
    update.playerState = message.info
  } else if (message.event === "initialDelivery" || message.event === "infoDelivery") {
    update.currentTime = readFiniteNumber(info, "currentTime")
    update.duration = readFiniteNumber(info, "duration")
    update.playerState = readFiniteNumber(info, "playerState")
  } else if (message.event === "onError" && typeof message.info === "number") {
    update.errorCode = message.info
  }

  return Object.keys(update).length > 0 ? update : null
}

export function parseVimeoPlayerMessage(value: unknown): EmbedPlayerMessage | null {
  const message = parseMessageRecord(value)
  if (!message) {
    return null
  }

  const eventName = typeof message.event === "string" ? message.event : null
  const methodName = typeof message.method === "string" ? message.method : null
  const data = asRecord(message.data)
  const update: EmbedPlayerMessage = {}

  if (eventName === "ready" || methodName === "ping") {
    update.ready = true
  }
  if (eventName === "timeupdate") {
    update.currentTime = readFiniteNumber(data, "seconds")
    update.duration = readFiniteNumber(data, "duration")
  } else if (methodName === "getCurrentTime" && typeof message.value === "number") {
    update.currentTime = message.value
  } else if (methodName === "getDuration" && typeof message.value === "number") {
    update.duration = message.value
  }

  if (eventName === "play" || eventName === "playing") {
    update.playerState = 1
  } else if (eventName === "pause") {
    update.playerState = 2
  } else if (eventName === "ended") {
    update.playerState = 0
  } else if (eventName === "error") {
    update.errorCode = 0
  }

  return Object.keys(update).length > 0 ? update : null
}
