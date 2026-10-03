"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip"

const themeItems = [
  { label: "跟随系统", value: "system", icon: MonitorIcon },
  { label: "浅色", value: "light", icon: SunIcon },
  { label: "深色", value: "dark", icon: MoonIcon },
] as const

type ThemeValue = (typeof themeItems)[number]["value"]

function isThemeValue(value: string | undefined): value is ThemeValue {
  return themeItems.some((item) => item.value === value)
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const currentTheme = mounted && isThemeValue(theme) ? theme : "system"
  const currentItem =
    themeItems.find((item) => item.value === currentTheme) ?? themeItems[0]
  const CurrentIcon = currentItem.icon
  const trigger = (
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="icon"
          type="button"
          aria-label={`界面主题：${currentItem.label}`}
        />
      }
    >
      <CurrentIcon aria-hidden="true" />
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger render={trigger} />
        <TooltipContent>{`主题：${currentItem.label}`}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuGroup>
          <DropdownMenuLabel>界面主题</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={currentTheme} onValueChange={setTheme}>
            {themeItems.map(({ label, value, icon: Icon }) => (
              <DropdownMenuRadioItem key={value} value={value}>
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
