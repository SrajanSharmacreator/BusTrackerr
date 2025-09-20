"use client"

import type React from "react"

import { useState, useEffect, Suspense, lazy } from "react"
import { getNetworkInfo } from "@/lib/network-optimizer"

interface LazyLoaderProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  priority?: "high" | "medium" | "low"
  networkAware?: boolean
}

export default function AdminLazyLoader({
  children,
  fallback = <div className="animate-pulse bg-gray-200 h-32 rounded"></div>,
  priority = "medium",
  networkAware = true,
}: LazyLoaderProps) {
  const [shouldLoad, setShouldLoad] = useState(false)
  const [networkQuality, setNetworkQuality] = useState(getNetworkInfo().quality)

  useEffect(() => {
    if (!networkAware) {
      setShouldLoad(true)
      return
    }

    const networkInfo = getNetworkInfo()
    setNetworkQuality(networkInfo.quality)

    // Delay loading based on network quality and priority
    let delay = 0

    if (networkInfo.quality === "poor") {
      delay = priority === "high" ? 100 : priority === "medium" ? 500 : 1000
    } else if (networkInfo.quality === "good") {
      delay = priority === "high" ? 0 : priority === "medium" ? 100 : 300
    } else {
      delay = 0 // Excellent network - load immediately
    }

    const timer = setTimeout(() => {
      setShouldLoad(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [networkAware, priority])

  if (!shouldLoad) {
    return (
      <div className="space-y-2">
        {fallback}
        {networkQuality === "poor" && (
          <div className="text-xs text-gray-500 text-center">Loading optimized for slow connection...</div>
        )}
      </div>
    )
  }

  return <Suspense fallback={fallback}>{children}</Suspense>
}

// Lazy-loaded admin components for better performance
export const LazyBusManagement = lazy(() => import("@/app/admin/buses/page"))
export const LazyRouteManagement = lazy(() => import("@/app/admin/routes/page"))
export const LazyAdminDashboard = lazy(() => import("@/app/admin/page"))
