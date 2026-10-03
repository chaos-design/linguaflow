"use client"

import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "../lib/utils"
import { DesktopSidebar } from "./app-sidebar"
import { WorkspaceHeader } from "./workspace-header"

export function WorkspaceShell({
  children,
  email,
}: {
  children: React.ReactNode
  email: string
}) {
  const pathname = usePathname()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const isPlayer = pathname.startsWith("/workspace/videos/")
  const isReview = pathname === "/workspace/review"
  const showNavigation = !isPlayer

  return (
    <div
      className={cn(
        "bg-background",
        isPlayer || isReview ? "flex h-dvh flex-col overflow-hidden" : "min-h-svh",
      )}
    >
      <WorkspaceHeader email={email} showNavigation={showNavigation} />
      {showNavigation ? (
        <DesktopSidebar
          email={email}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
      ) : null}
      <div
        className={cn(
          "transition-[padding-left] duration-200",
          isPlayer || isReview
            ? "min-h-0 flex-1 overflow-hidden"
            : "min-h-[calc(100svh-3.5rem)]",
          showNavigation && "lg:pl-60",
          showNavigation && sidebarCollapsed && "lg:pl-20",
        )}
      >
        <main
          className={cn(
            isPlayer
              ? "h-full min-h-0 overflow-hidden p-0"
              : isReview
                ? "h-full min-h-0 overflow-hidden p-0"
                : "min-h-[calc(100svh-3.5rem)] overflow-x-hidden p-4 md:px-8 md:py-8 lg:px-10",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
