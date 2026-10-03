"use client"

import { ThemeProvider } from "next-themes"
import { Toaster } from "./ui/sonner"
import { TooltipProvider } from "./ui/tooltip"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delay={250}>
        {children}
        <Toaster position="top-center" className="toaster-center" richColors />
      </TooltipProvider>
    </ThemeProvider>
  )
}
