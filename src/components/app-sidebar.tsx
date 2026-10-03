"use client"

import {
  BarChart3Icon,
  BookMarkedIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  ListVideoIcon,
  LogOutIcon,
  MenuIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
  UploadIcon,
  UserRoundIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { getInitials } from "../lib/format"
import { createClient } from "../lib/supabase/client"
import { cn } from "../lib/utils"
import { Brand } from "./brand"
import { Avatar, AvatarFallback } from "./ui/avatar"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet"
import { Spinner } from "./ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const navigationSections = [
  {
    label: "视频学习",
    items: [
      {
        href: "/workspace",
        label: "学习概览",
        icon: LayoutDashboardIcon,
      },
      {
        href: "/workspace/import",
        label: "导入视频",
        icon: UploadIcon,
      },
      {
        href: "/workspace/library",
        label: "视频资源库",
        icon: LibraryIcon,
      },
      {
        href: "/workspace/playlists",
        label: "播放列表",
        icon: ListVideoIcon,
      },
    ],
  },
  {
    label: "学习巩固",
    items: [
      {
        href: "/workspace/vocabulary",
        label: "生词本",
        icon: BookMarkedIcon,
      },
      {
        href: "/workspace/review",
        label: "复习闪卡",
        icon: LayersIcon,
      },
      {
        href: "/workspace/stats",
        label: "学习统计",
        icon: BarChart3Icon,
      },
    ],
  },
  {
    label: "系统",
    items: [
      {
        href: "/workspace/settings",
        label: "设置",
        icon: SettingsIcon,
      },
    ],
  },
] as const

function SidebarNavigation({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-5" aria-label="学习空间导航">
      {navigationSections.map((section) => (
        <div key={section.label}>
          <p
            className={cn(
              "mb-1.5 px-3 text-xs font-medium text-muted-foreground",
              collapsed && "sr-only",
            )}
          >
            {section.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active =
                href === "/workspace"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`)
              const navigationLink = (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-9 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "min-h-11 justify-center px-0",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className={cn(collapsed && "sr-only")}>{label}</span>
                </Link>
              )

              return collapsed ? (
                <Tooltip key={href}>
                  <TooltipTrigger render={navigationLink} />
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
              ) : (
                navigationLink
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function SidebarAccount({
  email,
  collapsed = false,
}: {
  email: string
  collapsed?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleSignOut() {
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()
      if (error) {
        toast.error(error.message)
        return
      }
      router.replace("/login")
      router.refresh()
    })
  }

  const trigger = (
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className={cn(!collapsed && "w-full justify-start px-2")}
          aria-label="打开账户菜单"
        />
      }
    >
      <Avatar>
        <AvatarFallback>{getInitials(email)}</AvatarFallback>
      </Avatar>
      <span className={cn("min-w-0 flex-1 truncate text-left", collapsed && "sr-only")}>
        {email}
      </span>
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger render={trigger} />
          <TooltipContent side="right">账户</TooltipContent>
        </Tooltip>
      ) : (
        trigger
      )}
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align="start"
        className="min-w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel>当前账户</DropdownMenuLabel>
          <DropdownMenuItem disabled>
            <UserRoundIcon aria-hidden="true" />
            <span className="truncate">{email}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push("/workspace/settings")}>
            <SettingsIcon aria-hidden="true" />
            设置
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isPending} onClick={handleSignOut}>
            {isPending ? <Spinner /> : <LogOutIcon aria-hidden="true" />}
            退出登录
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DesktopSidebar({
  email,
  collapsed,
  onCollapsedChange,
}: {
  email: string
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}) {
  return (
    <aside
      className={cn(
        "fixed top-14 bottom-0 left-0 z-40 hidden w-60 flex-col bg-sidebar px-3 py-3 shadow-sm transition-[width] duration-200 lg:flex",
        collapsed && "w-20",
      )}
    >
      <div
        className={cn(
          "flex h-10 items-center justify-between px-2",
          collapsed && "justify-center px-0",
        )}
      >
        <span
          className={cn(
            "font-mono text-[11px] font-medium text-muted-foreground",
            collapsed && "sr-only",
          )}
        >
          学习空间
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                type="button"
                aria-label={collapsed ? "展开菜单" : "收起菜单"}
                onClick={() => onCollapsedChange(!collapsed)}
              />
            }
          >
            {collapsed ? (
              <PanelLeftOpenIcon aria-hidden="true" />
            ) : (
              <PanelLeftCloseIcon aria-hidden="true" />
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "展开菜单" : "收起菜单"}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
        <div className="pb-4">
          <SidebarNavigation collapsed={collapsed} />
        </div>
      </div>
      <div className="pt-2">
        <SidebarAccount email={email} collapsed={collapsed} />
      </div>
    </aside>
  )
}

export function MobileSidebar({ email }: { email: string }) {
  return (
    <Sheet>
      <Tooltip>
        <TooltipTrigger
          render={
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="打开导航"
                  className="lg:hidden"
                />
              }
            />
          }
        >
          <MenuIcon aria-hidden="true" />
        </TooltipTrigger>
        <TooltipContent>打开导航</TooltipContent>
      </Tooltip>
      <SheetContent side="left" className="w-72 p-4">
        <SheetHeader className="sr-only">
          <SheetTitle>学习空间导航</SheetTitle>
          <SheetDescription>前往视频学习、复习与设置页面。</SheetDescription>
        </SheetHeader>
        <Brand href="/workspace" />
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto">
          <SidebarNavigation />
        </div>
        <div className="pt-3">
          <SidebarAccount email={email} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
