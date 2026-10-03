"use client"

import {
  CaptionsIcon,
  CheckIcon,
  FileUpIcon,
  FolderIcon,
  FolderPenIcon,
  FolderPlusIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { type FormEvent, useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu"
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Spinner } from "../../components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip"
import { removeLocalVideoAsset } from "../../lib/local-video-store"
import {
  addVideoToPlaylist,
  createVideoCategory,
  deleteLearningCategory,
  deleteVideo,
  renameLearningCategory,
  setVideoCategory,
} from "../../server/learning/actions"
import type {
  LearningCategory,
  PlaylistSummary,
  VideoSummary,
} from "../../types/learning"
import { CreatePlaylistDialog } from "../playlists/create-playlist-dialog"
import { SubtitleImportSheet } from "../subtitles/subtitle-import-sheet"

export function VideoActionsMenu({
  video,
  categories,
  playlists,
  onCategoryChange,
  onTranscriptImported,
}: {
  video: Pick<
    VideoSummary,
    "id" | "title" | "category" | "transcriptCueCount" | "sourceType" | "localFileKey"
  >
  categories: LearningCategory[]
  playlists: PlaylistSummary[]
  onCategoryChange?: (category: LearningCategory | null) => void
  onTranscriptImported?: (cueCount: number) => void
}) {
  const router = useRouter()
  const categoryNameId = useId()
  const renameCategoryNameId = useId()
  const [subtitleSheetOpen, setSubtitleSheetOpen] = useState(false)
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false)
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false)
  const [renameCategoryOpen, setRenameCategoryOpen] = useState(false)
  const [deleteCategoryOpen, setDeleteCategoryOpen] = useState(false)
  const [deleteVideoOpen, setDeleteVideoOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [renamedCategoryName, setRenamedCategoryName] = useState(
    video.category?.name ?? "",
  )
  const [addedPlaylistIds, setAddedPlaylistIds] = useState(() => new Set<string>())
  const [isPending, startTransition] = useTransition()

  function assignCategory(categoryId: string | null) {
    startTransition(async () => {
      const result = await setVideoCategory({ videoId: video.id, categoryId })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      onCategoryChange?.(
        categoryId
          ? (categories.find((category) => category.id === categoryId) ?? null)
          : null,
      )
      toast.success(result.message)
      router.refresh()
    })
  }

  function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    startTransition(async () => {
      const result = await createVideoCategory({
        videoId: video.id,
        name: newCategoryName,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      const categoryId = result.data?.categoryId
      if (categoryId) {
        onCategoryChange?.(
          categories.find((category) => category.id === categoryId) ?? {
            id: categoryId,
            name: newCategoryName.trim(),
            color: "neutral",
          },
        )
      }
      setNewCategoryName("")
      setCreateCategoryOpen(false)
      toast.success(result.message)
      router.refresh()
    })
  }

  function renameCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const currentCategory = video.category
    if (!currentCategory) {
      return
    }
    startTransition(async () => {
      const result = await renameLearningCategory({
        categoryId: video.category?.id ?? "",
        name: renamedCategoryName,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      onCategoryChange?.({
        ...currentCategory,
        name: renamedCategoryName.trim(),
      })
      setRenameCategoryOpen(false)
      toast.success(result.message)
      router.refresh()
    })
  }

  function deleteCategory() {
    if (!video.category) {
      return
    }
    startTransition(async () => {
      const result = await deleteLearningCategory(video.category?.id ?? "")
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      onCategoryChange?.(null)
      setDeleteCategoryOpen(false)
      toast.success(result.message)
      router.refresh()
    })
  }

  function handleDeleteVideo() {
    startTransition(async () => {
      const result = await deleteVideo(video.id)
      if (!result.ok) {
        toast.error(result.message)
        return
      }

      let localCacheRemoved = true
      if (video.sourceType === "local" && video.localFileKey) {
        try {
          await removeLocalVideoAsset(video.localFileKey)
        } catch {
          localCacheRemoved = false
        }
      }
      setDeleteVideoOpen(false)
      if (localCacheRemoved) {
        toast.success(result.message)
      } else {
        toast.warning("视频已删除，但本地文件授权缓存未能清理。")
      }
      router.refresh()
    })
  }

  function addToPlaylist(playlistId: string) {
    startTransition(async () => {
      const result = await addVideoToPlaylist({
        playlistId,
        videoId: video.id,
      })
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      setAddedPlaylistIds((current) => new Set(current).add(playlistId))
      toast.success(result.message)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="视频操作"
                    disabled={isPending}
                  />
                }
              />
            }
          >
            {isPending ? <Spinner /> : <MoreHorizontalIcon aria-hidden="true" />}
          </TooltipTrigger>
          <TooltipContent>视频操作</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>资源管理</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setSubtitleSheetOpen(true)}>
              {video.transcriptCueCount > 0 ? (
                <CaptionsIcon aria-hidden="true" />
              ) : (
                <FileUpIcon aria-hidden="true" />
              )}
              {video.transcriptCueCount > 0 ? "更新字幕" : "导入字幕"}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderPenIcon aria-hidden="true" />
                分类
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>分配到分类</DropdownMenuLabel>
                  <DropdownMenuItem
                    disabled={!video.category}
                    onClick={() => assignCategory(null)}
                  >
                    {!video.category ? (
                      <CheckIcon aria-hidden="true" />
                    ) : (
                      <FolderIcon aria-hidden="true" />
                    )}
                    未分类
                  </DropdownMenuItem>
                  {categories.map((category) => {
                    const selected = video.category?.id === category.id
                    return (
                      <DropdownMenuItem
                        key={category.id}
                        disabled={selected}
                        onClick={() => assignCategory(category.id)}
                      >
                        {selected ? (
                          <CheckIcon aria-hidden="true" />
                        ) : (
                          <FolderIcon aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{category.name}</span>
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setCreateCategoryOpen(true)}>
                    <FolderPlusIcon aria-hidden="true" />
                    新建分类并应用
                  </DropdownMenuItem>
                  {video.category ? (
                    <>
                      <DropdownMenuItem
                        onClick={() => {
                          setRenamedCategoryName(video.category?.name ?? "")
                          setRenameCategoryOpen(true)
                        }}
                      >
                        <PencilIcon aria-hidden="true" />
                        重命名当前分类
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setDeleteCategoryOpen(true)}
                      >
                        <Trash2Icon aria-hidden="true" />
                        删除当前分类
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>加入播放列表</DropdownMenuLabel>
            {playlists.map((playlist) => {
              const added =
                addedPlaylistIds.has(playlist.id) ||
                playlist.videos.some((item) => item.id === video.id)
              return (
                <DropdownMenuItem
                  key={playlist.id}
                  disabled={added}
                  onClick={() => addToPlaylist(playlist.id)}
                >
                  {added ? (
                    <CheckIcon aria-hidden="true" />
                  ) : (
                    <ListPlusIcon aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{playlist.name}</span>
                  {added ? (
                    <span className="text-xs text-muted-foreground">已加入</span>
                  ) : null}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuItem onClick={() => setCreatePlaylistOpen(true)}>
              <PlusIcon aria-hidden="true" />
              新建播放列表并加入
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteVideoOpen(true)}
            >
              <Trash2Icon aria-hidden="true" />
              删除视频
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <SubtitleImportSheet
        open={subtitleSheetOpen}
        videoId={video.id}
        videoTitle={video.title}
        currentCueCount={video.transcriptCueCount}
        onOpenChange={setSubtitleSheetOpen}
        onImported={(cues) => {
          onTranscriptImported?.(cues.length)
          setSubtitleSheetOpen(false)
          router.refresh()
        }}
      />

      <CreatePlaylistDialog
        videoId={video.id}
        open={createPlaylistOpen}
        onOpenChange={(open) => {
          setCreatePlaylistOpen(open)
          if (!open) {
            router.refresh()
          }
        }}
        showTrigger={false}
      />

      <Dialog
        open={createCategoryOpen}
        onOpenChange={(open) => {
          setCreateCategoryOpen(open)
          if (!open) {
            setNewCategoryName("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建分类</DialogTitle>
            <DialogDescription>
              创建后会立即应用到当前视频，之后可继续分配给其他资源。
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={createCategory}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={categoryNameId}>分类名称</FieldLabel>
                <Input
                  id={categoryNameId}
                  value={newCategoryName}
                  maxLength={60}
                  placeholder="例如：人工智能课程"
                  autoFocus
                  onChange={(event) => setNewCategoryName(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setCreateCategoryOpen(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending || !newCategoryName.trim()}>
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FolderPlusIcon data-icon="inline-start" aria-hidden="true" />
                )}
                创建并应用
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={renameCategoryOpen} onOpenChange={setRenameCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名分类</DialogTitle>
            <DialogDescription>
              分类名称会同步更新到使用该分类的所有资源。
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={renameCategory}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={renameCategoryNameId}>分类名称</FieldLabel>
                <Input
                  id={renameCategoryNameId}
                  value={renamedCategoryName}
                  maxLength={60}
                  autoFocus
                  onChange={(event) => setRenamedCategoryName(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => setRenameCategoryOpen(false)}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={
                  isPending ||
                  !renamedCategoryName.trim() ||
                  renamedCategoryName.trim() === video.category?.name
                }
              >
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                )}
                保存名称
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteCategoryOpen} onOpenChange={setDeleteCategoryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除分类“{video.category?.name}”？</DialogTitle>
            <DialogDescription>
              删除后，所有使用此分类的视频都会变为未分类，视频本身不会被删除。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteCategoryOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={deleteCategory}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              )}
              删除分类
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteVideoOpen}
        onOpenChange={(open) => {
          if (!isPending) {
            setDeleteVideoOpen(open)
          }
        }}
      >
        <DialogContent showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>删除视频“{video.title}”？</DialogTitle>
            <DialogDescription>
              视频会从资源库永久删除，关联的进度、笔记、字幕和播放列表关系也会一并删除。生词会保留，但不再关联此视频。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteVideoOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleDeleteVideo}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Trash2Icon data-icon="inline-start" aria-hidden="true" />
              )}
              删除视频
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
