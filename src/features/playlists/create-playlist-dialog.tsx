"use client"

import { ListPlusIcon, PlusIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "../../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "../../components/ui/field"
import { Input } from "../../components/ui/input"
import { Spinner } from "../../components/ui/spinner"
import { Textarea } from "../../components/ui/textarea"
import { createPlaylist } from "../../server/learning/actions"

export function CreatePlaylistDialog({
  videoId,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  triggerLabel = "新建列表",
}: {
  videoId?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  showTrigger?: boolean
  triggerLabel?: string
} = {}) {
  const router = useRouter()
  const fieldId = useId()
  const [internalOpen, setInternalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const open = controlledOpen ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
        <DialogTrigger render={<Button variant="outline" />}>
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          {triggerLabel}
        </DialogTrigger>
      ) : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {videoId ? "新建播放列表并加入视频" : "新建播放列表"}
          </DialogTitle>
          <DialogDescription>
            按课程、目标或学习阶段组织视频，列表顺序就是学习路径。
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const formData = new FormData(form)
            startTransition(async () => {
              const result = await createPlaylist(formData)
              if (!result.ok) {
                toast.error(result.message)
                return
              }
              toast.success(result.message)
              form.reset()
              setOpen(false)
              router.refresh()
            })
          }}
        >
          {videoId ? <input type="hidden" name="videoId" value={videoId} /> : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-name`}>名称</FieldLabel>
              <Input
                id={`${fieldId}-name`}
                name="name"
                maxLength={100}
                placeholder="例如：AI 系统进阶"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${fieldId}-description`}>简介</FieldLabel>
              <Textarea
                id={`${fieldId}-description`}
                name="description"
                maxLength={500}
                placeholder="说明这个列表的学习目标"
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <ListPlusIcon data-icon="inline-start" aria-hidden="true" />
              )}
              创建列表
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
