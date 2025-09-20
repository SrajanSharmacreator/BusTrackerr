"use client"

import * as React from "react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  return (
    <div className="flex items-center gap-2">
      <button
        className={`px-2 py-1 rounded ${theme === "light" ? "bg-blue-600 text-white" : "border"}`}
        onClick={() => setTheme("light")}
        aria-label="Use light theme"
        aria-pressed={theme === "light"}
      >
        Light
      </button>
      <button
        className={`px-2 py-1 rounded ${theme === "dark" ? "bg-blue-600 text-white" : "border"}`}
        onClick={() => setTheme("dark")}
        aria-label="Use dark theme"
        aria-pressed={theme === "dark"}
      >
        Dark
      </button>
      <button
        className={`px-2 py-1 rounded ${theme === "system" ? "bg-blue-600 text-white" : "border"}`}
        onClick={() => setTheme("system")}
        aria-label="Use system theme"
        aria-pressed={theme === "system"}
      >
        System
      </button>
    </div>
  )
}
