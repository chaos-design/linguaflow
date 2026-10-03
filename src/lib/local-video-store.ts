"use client"

import { subtitleCuesToVtt } from "./subtitles"

const databaseName = "linguaflow-local-videos"
const databaseVersion = 1
const assetStoreName = "assets"

const allowedVideoExtensions = [".m4v", ".mov", ".mp4", ".webm"]
const pickerAccept = {
  "video/mp4": [".mp4", ".m4v"],
  "video/quicktime": [".mov"],
  "video/webm": [".webm"],
}

export interface LocalVideoFileHandle {
  kind: "file"
  name: string
  getFile: () => Promise<File>
  queryPermission: (options?: { mode: "read" }) => Promise<PermissionState>
  requestPermission: (options?: { mode: "read" }) => Promise<PermissionState>
}

export interface LocalVideoAsset {
  key: string
  fileName: string
  size: number
  type: string
  lastModified: number
  handle: LocalVideoFileHandle
}

export interface LocalVideoInspection {
  durationSeconds: number
  embeddedSubtitle: {
    content: string
    cueCount: number
    language: string
  } | null
}

interface LocalVideoPickerWindow extends Window {
  showOpenFilePicker?: (options: {
    excludeAcceptAllOption: boolean
    multiple: boolean
    types: Array<{
      description: string
      accept: Record<string, string[]>
    }>
  }) => Promise<LocalVideoFileHandle[]>
}

function openLocalVideoDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("当前浏览器不支持本地视频持久访问。"))
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, databaseVersion)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(assetStoreName)) {
        database.createObjectStore(assetStoreName, { keyPath: "key" })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error("无法打开本地视频索引。"))
  })
}

function runAssetRequest<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openLocalVideoDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(assetStoreName, mode)
        const request = operation(transaction.objectStore(assetStoreName))
        let result: T
        request.onsuccess = () => {
          result = request.result
        }
        request.onerror = () =>
          reject(request.error ?? new Error("本地视频索引操作失败。"))
        transaction.oncomplete = () => {
          database.close()
          resolve(result)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error ?? new Error("本地视频索引事务失败。"))
        }
      }),
  )
}

export function supportsPersistentLocalVideoAccess(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as LocalVideoPickerWindow).showOpenFilePicker === "function" &&
    "indexedDB" in window
  )
}

export async function chooseLocalVideoFile(): Promise<{
  file: File
  handle: LocalVideoFileHandle
}> {
  const showOpenFilePicker = (window as LocalVideoPickerWindow).showOpenFilePicker
  if (!showOpenFilePicker) {
    throw new Error("当前浏览器不支持持久读取本地文件，请使用最新版 Chrome 或 Edge。")
  }

  const [handle] = await showOpenFilePicker({
    excludeAcceptAllOption: true,
    multiple: false,
    types: [
      {
        description: "视频文件",
        accept: pickerAccept,
      },
    ],
  })
  if (!handle) {
    throw new Error("没有选择视频文件。")
  }
  const file = await handle.getFile()
  assertSupportedLocalVideo(file)
  return { file, handle }
}

export function assertSupportedLocalVideo(file: File): void {
  const normalizedName = file.name.toLocaleLowerCase("en")
  if (!allowedVideoExtensions.some((extension) => normalizedName.endsWith(extension))) {
    throw new Error("仅支持 MP4、WebM、MOV 与 M4V 视频。")
  }
}

export function getLocalVideoTitle(fileName: string): string {
  return fileName.replace(/\.(?:m4v|mov|mp4|webm)$/iu, "").trim() || fileName
}

export function getLocalVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    const objectUrl = URL.createObjectURL(file)
    const dispose = () => {
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(objectUrl)
    }
    video.preload = "metadata"
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0
      dispose()
      resolve(Math.max(0, duration))
    }
    video.onerror = () => {
      dispose()
      reject(new Error("无法读取该视频的媒体信息。"))
    }
    video.src = objectUrl
  })
}

export function inspectLocalVideoFile(file: File): Promise<LocalVideoInspection> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    const objectUrl = URL.createObjectURL(file)
    let settled = false
    let inspectionTimer = 0

    const dispose = () => {
      window.clearTimeout(inspectionTimer)
      video.removeAttribute("src")
      video.load()
      URL.revokeObjectURL(objectUrl)
    }
    const finish = () => {
      if (settled) {
        return
      }
      settled = true
      const durationSeconds = Number.isFinite(video.duration)
        ? Math.max(0, Math.floor(video.duration))
        : 0
      const tracks = Array.from(video.textTracks)
        .filter((track) => track.kind === "subtitles" || track.kind === "captions")
        .toSorted((left, right) => {
          const leftEnglish = /^en(?:-|$)/iu.test(left.language) ? 1 : 0
          const rightEnglish = /^en(?:-|$)/iu.test(right.language) ? 1 : 0
          return rightEnglish - leftEnglish
        })
      const selectedTrack = tracks.find((track) => (track.cues?.length ?? 0) > 0)
      const cues = selectedTrack?.cues
        ? Array.from(selectedTrack.cues).flatMap((cue) => {
            const text = "text" in cue ? String(cue.text).trim() : ""
            return text
              ? [
                  {
                    startSeconds: cue.startTime,
                    endSeconds: cue.endTime,
                    text,
                    translation: "",
                  },
                ]
              : []
          })
        : []
      const content = subtitleCuesToVtt(cues)
      dispose()
      resolve({
        durationSeconds,
        embeddedSubtitle: content
          ? {
              content,
              cueCount: cues.length,
              language: selectedTrack?.language || selectedTrack?.label || "内嵌字幕",
            }
          : null,
      })
    }

    video.preload = "auto"
    video.onloadedmetadata = () => {
      for (const track of Array.from(video.textTracks)) {
        if (track.kind === "subtitles" || track.kind === "captions") {
          track.mode = "hidden"
        }
      }
      inspectionTimer = window.setTimeout(finish, 900)
    }
    video.onloadeddata = () => {
      inspectionTimer = window.setTimeout(finish, 200)
    }
    video.onerror = () => {
      if (settled) {
        return
      }
      settled = true
      dispose()
      reject(new Error("无法读取该视频的媒体信息。"))
    }
    video.src = objectUrl
    video.load()
  })
}

export async function saveLocalVideoAsset(asset: LocalVideoAsset): Promise<void> {
  await navigator.storage?.persist?.().catch(() => false)
  await runAssetRequest("readwrite", (store) => store.put(asset))
}

export async function getLocalVideoAsset(key: string): Promise<LocalVideoAsset | null> {
  const result = await runAssetRequest<LocalVideoAsset | undefined>(
    "readonly",
    (store) => store.get(key),
  )
  return result ?? null
}

export async function removeLocalVideoAsset(key: string): Promise<void> {
  await runAssetRequest("readwrite", (store) => store.delete(key))
}

export function isSameLocalVideoFile(asset: LocalVideoAsset, file: File): boolean {
  return (
    asset.fileName === file.name &&
    asset.size === file.size &&
    asset.lastModified === file.lastModified
  )
}

export function isFilePickerCancellation(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError"
}
