"use client"

import { MobileSidebar } from "./app-sidebar"
import { Brand } from "./brand"
import { GlobalSearch } from "./global-search"
import { ThemeToggle } from "./theme-toggle"

export function WorkspaceHeader({
  email,
  showNavigation,
}: {
  email: string
  showNavigation: boolean
}) {
  return (
    <header className="workspace-header sticky top-0 z-50 flex h-14 shrink-0 items-center gap-3 bg-background/95 px-3 shadow-sm backdrop-blur md:px-5">
      <div className="shrink-0">
        <Brand href="/workspace" />
      </div>

      <div className="min-w-0 sm:w-64">
        <GlobalSearch />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <ThemeToggle />
        {showNavigation ? <MobileSidebar email={email} /> : null}
      </div>
    </header>
  )
}
