"use client"

import { useEffect, useState } from "react"
import { getNetworkInfo, createNetworkMonitor, type NetworkInfo } from "@/lib/network-optimizer"
import { useLanguage } from "@/lib/language-context"
import { WifiOff, Signal, SignalHigh, SignalLow, SignalMedium } from "lucide-react"

export function NetworkStatus() {
  const { t } = useLanguage()
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // Initial network info
    setNetworkInfo(getNetworkInfo())
    setIsOnline(navigator.onLine)

    // Monitor network changes
    const cleanupNetworkMonitor = createNetworkMonitor(setNetworkInfo)
"use client"

    // Monitor online/offline status
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      cleanupNetworkMonitor()
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  if (!networkInfo) return null

  const getSignalIcon = () => {
    if (!isOnline) return <WifiOff className="h-4 w-4" />

    switch (networkInfo.quality) {
      case "poor":
        return <SignalLow className="h-4 w-4" />
      case "good":
        return <SignalMedium className="h-4 w-4" />
      case "excellent":
        return <SignalHigh className="h-4 w-4" />
      default:
        return <Signal className="h-4 w-4" />
    }
  }

  const getStatusColor = () => {
    if (!isOnline) return "text-red-600"

    switch (networkInfo.quality) {
      case "poor":
        return "text-red-600"
      case "good":
        return "text-yellow-600"
      case "excellent":
        return "text-green-600"
      default:
        return "text-gray-600"
    }
  }

  const getStatusText = () => {
    if (!isOnline) return "Offline"

    switch (networkInfo.quality) {
      case "poor":
        return `Slow (${networkInfo.effectiveType.toUpperCase()})`
      case "good":
        return `Good (${networkInfo.effectiveType.toUpperCase()})`
      case "excellent":
        return `Excellent (${networkInfo.effectiveType.toUpperCase()})`
      default:
        return networkInfo.effectiveType.toUpperCase()
    }
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${getStatusColor()}`}>
      {getSignalIcon()}
      <span>{getStatusText()}</span>
      {networkInfo.quality === "poor" && (
        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">Low Bandwidth Mode</span>
      )}
    </div>
  )
}
