"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase"
import { onValue, ref, get } from "firebase/database"
import {
  formatLatLon,
  haversineMeters,
  etaMinutes,
  watchUserLocation,
  getCurrentLocation,
  formatDistance,
  getDistanceCategory,
} from "@/lib/geo"
import {
  getNetworkInfo,
  getOptimizationSettings,
  compressBusData,
  decompressBusData,
  retryWithBackoff,
  createNetworkMonitor,
  globalDataCache,
  globalBatchManager,
  globalOfflineManager,
  globalPrefetcher,
  type NetworkInfo,
} from "@/lib/network-optimizer"
import { useLanguage } from "@/lib/language-context"
import { LanguageSelector } from "@/components/language-selector"
import { RouteSearch } from "@/components/route-search"
import LiveMap from "@/components/map"
import { NetworkStatus } from "@/components/network-status"
import { MapPin, Navigation, Loader2, Route, Eye, EyeOff, Wifi, Signal } from "lucide-react"
import type { BusMarkerData, UserMarkerData } from "@/lib/map-utils"

declare const L: any // Leaflet global (loaded dynamically)

type BusData = {
  busId?: string
  lat?: number
  lon?: number
  speed?: number | null
  heading?: number | null
  routeName?: string | null
  status?: string
  updatedAt?: number
}

type UserLocation = {
  lat: number
  lon: number
  accuracy: number
  timestamp: number
}

export default function UserTracker() {
  const { t } = useLanguage()
  const [mode, setMode] = useState<"bus" | "pnr" | "route">("bus")
  const [query, setQuery] = useState("")
  const [busId, setBusId] = useState<string | null>(null)
  const [bus, setBus] = useState<BusData | null>(null)
  const [subscribed, setSubscribed] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showRoute, setShowRoute] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [userLoc, setUserLoc] = useState<UserLocation | null>(null)
  const [routeResults, setRouteResults] = useState<BusData[]>([])
  const [isTrackingLocation, setIsTrackingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>(getNetworkInfo())
  const [connectionStatus, setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connected")
  const [lastDataUpdate, setLastDataUpdate] = useState<number>(Date.now())
  const [pendingUpdates, setPendingUpdates] = useState<any[]>([])

  const [offlineQueueSize, setOfflineQueueSize] = useState(0)
  const [cacheHitRate, setCacheHitRate] = useState(0)
  const [dataCompressionRatio, setDataCompressionRatio] = useState(0)
  const [prefetchedResources, setPrefetchedResources] = useState(0)

  const [notifyNear, setNotifyNear] = useState(false)
  const notifiedRef = useRef(false)
  const watchIdRef = useRef<number | null>(null)
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
  const cacheHitsRef = useRef(0)
  const cacheMissesRef = useRef(0)

  const db = getFirebaseDb()
  const unsubRef = useRef<(() => void) | null>(null)

  const optimizationSettings = useMemo(() => {
    return getOptimizationSettings(networkInfo)
  }, [networkInfo])

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
      if (typeof navigator !== "undefined" && watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const cleanupNetworkMonitor = createNetworkMonitor((newNetworkInfo) => {
      setNetworkInfo(newNetworkInfo)
      console.log("[v0] Network changed:", newNetworkInfo.quality, newNetworkInfo.effectiveType)

      if (newNetworkInfo.quality === "excellent" && networkInfo.quality !== "excellent") {
        globalPrefetcher.prefetchLikelyResources(async (resource) => {
          if (db) {
            const snapshot = await get(ref(db, resource))
            return snapshot.val()
          }
          return null
        }, newNetworkInfo.quality)
      }
    })

    return cleanupNetworkMonitor
  }, [db, networkInfo.quality])

  const fetchBusDataOptimized = useCallback(
    async (busId: string) => {
      if (!db) return null

      const cacheKey = `bus_${busId}`

      // Check cache first
      const cachedData = globalDataCache.get(cacheKey)
      if (cachedData && Date.now() - cachedData.timestamp < 30000) {
        // 30 second cache
        cacheHitsRef.current++
        setCacheHitRate(cacheHitsRef.current / (cacheHitsRef.current + cacheMissesRef.current))
        return cachedData
      }

      // Check prefetch cache
      const prefetched = globalPrefetcher.getPrefetched(cacheKey)
      if (prefetched) {
        cacheHitsRef.current++
        setCacheHitRate(cacheHitsRef.current / (cacheHitsRef.current + cacheMissesRef.current))
        return prefetched
      }

      try {
        setConnectionStatus("connecting")
        cacheMissesRef.current++

        const fetchData = async () => {
          const snapshot = await get(ref(db, `buses/${busId}`))
          const rawData = snapshot.val()

          if (optimizationSettings.dataCompression && rawData) {
            // Calculate compression ratio
            const originalSize = JSON.stringify(rawData).length
            const compressed = compressBusData(rawData)
            const compressedSize = JSON.stringify(compressed).length
            setDataCompressionRatio(((originalSize - compressedSize) / originalSize) * 100)

            const decompressed = decompressBusData(compressed)

            // Cache the result
            globalDataCache.set(cacheKey, { ...decompressed, timestamp: Date.now() })

            return decompressed
          }

          // Cache uncompressed data
          const dataWithTimestamp = { ...rawData, timestamp: Date.now() }
          globalDataCache.set(cacheKey, dataWithTimestamp)
          return rawData
        }

        const data = await retryWithBackoff(fetchData, optimizationSettings.maxRetries)

        if (data) {
          setBus({ ...data, busId })
          setLastDataUpdate(Date.now())
          setConnectionStatus("connected")
          retryCountRef.current = 0

          // Record access pattern for prefetching
          globalPrefetcher.recordAccess(cacheKey)

          // Queue for batch update if enabled
          if (optimizationSettings.batchUpdates) {
            globalBatchManager.addUpdate(busId, data)
          }
        }

        setCacheHitRate(cacheHitsRef.current / (cacheHitsRef.current + cacheMissesRef.current))
        return data
      } catch (error) {
        console.error("[v0] Failed to fetch bus data:", error)
        setConnectionStatus("disconnected")
        retryCountRef.current++

        // Queue for offline processing
        globalOfflineManager.queueUpdate(busId, { action: "fetch", timestamp: Date.now() })
        setOfflineQueueSize(globalOfflineManager.getQueueSize())

        return null
      }
    },
    [db, optimizationSettings],
  )

  useEffect(() => {
    const statsInterval = setInterval(() => {
      setOfflineQueueSize(globalOfflineManager.getQueueSize())
      setPrefetchedResources(globalPrefetcher.getPrefetched("stats")?.count || 0)
    }, 5000)

    return () => clearInterval(statsInterval)
  }, [])

  const startLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) return // Already tracking

    setLocationError(null)
    setIsTrackingLocation(true)

    const watchId = watchUserLocation(
      (position) => {
        setUserLoc({
          ...position,
          timestamp: Date.now(),
        })
        setLocationError(null)
      },
      (error) => {
        setLocationError(`Location error: ${error.message}`)
        setIsTrackingLocation(false)
      },
    )

    if (watchId !== null) {
      watchIdRef.current = watchId
    } else {
      setIsTrackingLocation(false)
      setLocationError("Geolocation not supported")
    }
  }, [])

  const stopLocationTracking = useCallback(() => {
    if (typeof navigator !== "undefined" && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setIsTrackingLocation(false)
  }, [])

  const useMyLocation = useCallback(async () => {
    setGettingLocation(true)
    setLocationError(null)

    try {
      const position = await getCurrentLocation()
      setUserLoc({
        ...position,
        timestamp: Date.now(),
      })
    } catch (error: any) {
      setLocationError(`Location error: ${error.message}`)
    } finally {
      setGettingLocation(false)
    }
  }, [])

  const lastUpdated = useMemo(() => {
    if (!bus?.updatedAt) return "—"
    const d = new Date(bus.updatedAt)
    return `${d.toLocaleTimeString()}`
  }, [bus?.updatedAt])

  const distanceAndEta = useMemo(() => {
    if (!userLoc || !bus?.lat || !bus?.lon) return null
    const dist = haversineMeters(userLoc.lat, userLoc.lon, bus.lat, bus.lon)
    const eta = etaMinutes(dist, bus.speed ?? undefined)
    const category = getDistanceCategory(dist)
    return { dist, eta, category, formatted: formatDistance(dist) }
  }, [userLoc, bus?.lat, bus?.lon, bus?.speed])

  // Convert bus data to map format
  const mapBuses: BusMarkerData[] = useMemo(() => {
    if (!bus || !bus.lat || !bus.lon) return []

    return [
      {
        busId: bus.busId || "Unknown",
        lat: bus.lat,
        lon: bus.lon,
        heading: bus.heading,
        speed: bus.speed,
        status: bus.status || "unknown",
        routeName: bus.routeName,
        lastUpdate: bus.updatedAt || Date.now(),
      },
    ]
  }, [bus])

  // Convert user location to map format
  const mapUserLocation: UserMarkerData | undefined = useMemo(() => {
    if (!userLoc) return undefined

    return {
      lat: userLoc.lat,
      lon: userLoc.lon,
      accuracy: userLoc.accuracy,
      timestamp: userLoc.timestamp,
    }
  }, [userLoc])

  useEffect(() => {
    if (!notifyNear || typeof Notification === "undefined") return
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [notifyNear])

  useEffect(() => {
    if (!notifyNear || !userLoc || !bus?.lat || !bus?.lon) return
    const dist = haversineMeters(userLoc.lat, userLoc.lon, bus.lat, bus.lon)
    const threshold = 500 // meters
    const hysteresis = 650 // reset once > 650m away
    if (dist <= threshold && !notifiedRef.current) {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try {
          new Notification(`${t("status.bus")} ${bus.busId ?? ""} ${t("notification.busNearby")}`, {
            body: `~${Math.round(dist)} m away${bus.routeName ? ` · ${bus.routeName}` : ""}`,
          })
        } catch {}
      }
      notifiedRef.current = true
    } else if (dist > hysteresis) {
      notifiedRef.current = false
    }
  }, [notifyNear, userLoc, bus?.lat, bus?.lon, bus?.busId, bus?.routeName, t])

  const subscribe = useCallback(async () => {
    if (!db) return
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
      updateIntervalRef.current = null
    }

    notifiedRef.current = false
    setSubscribed(false)
    setBus(null)
    setBusId(null)
    setRouteResults([])

    let resolvedBusId: string | null = null
    try {
      if (mode === "pnr") {
        const snap = await get(ref(db, `pnrIndex/${sanitizeKey(query)}`))
        resolvedBusId = snap.exists() ? (snap.val()?.busId ?? null) : null
      } else if (mode === "route") {
        return
      } else {
        resolvedBusId = query || null
      }
    } catch {
      resolvedBusId = null
    }

    if (!resolvedBusId) {
      setBusId(null)
      setBus(null)
      return
    }

    setBusId(resolvedBusId)

    const startOptimizedTracking = () => {
      // Initial fetch
      fetchBusDataOptimized(resolvedBusId!)

      // Set up interval based on network quality
      updateIntervalRef.current = setInterval(() => {
        fetchBusDataOptimized(resolvedBusId!)
      }, optimizationSettings.updateInterval)

      console.log(
        "[v0] Started optimized tracking with",
        optimizationSettings.updateInterval / 1000,
        "second intervals",
      )
    }

    startOptimizedTracking()
    setSubscribed(true)

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
        updateIntervalRef.current = null
      }
    }
  }, [db, mode, query, fetchBusDataOptimized, optimizationSettings])

  useEffect(() => {
    if (subscribed && busId && updateIntervalRef.current) {
      // Clear existing interval
      clearInterval(updateIntervalRef.current)

      // Set new interval based on updated network quality
      updateIntervalRef.current = setInterval(() => {
        fetchBusDataOptimized(busId)
      }, optimizationSettings.updateInterval)

      console.log("[v0] Updated tracking interval to", optimizationSettings.updateInterval / 1000, "seconds")
    }
  }, [optimizationSettings.updateInterval, subscribed, busId, fetchBusDataOptimized])

  const handleBusSelect = useCallback(
    (busId: string, busData: any) => {
      setMode("bus")
      setQuery(busId)
      setBus(busData)
      setBusId(busId)
      setSubscribed(true)

      // Set up real-time tracking for the selected bus
      if (db) {
        const busRef = ref(db, `buses/${busId}`)
        const unsubscribe = onValue(busRef, (snapshot) => {
          const val = snapshot.val()
          if (val) {
            setBus({ ...val, busId })
          }
        })

        unsubRef.current = () => {
          try {
            unsubscribe()
          } catch {}
        }
      }
    },
    [db],
  )

  const handleBusClick = useCallback((clickedBusId: string) => {
    console.log("[v0] Bus clicked on map:", clickedBusId)
    // Could show additional info or switch tracking
  }, [])

  return (
    <section className="max-w-4xl mx-auto p-4 space-y-4">
      <header className="space-y-1 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-semibold text-balance">{t("app.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.description")}</p>
          <NetworkStatus />
        </div>
        <LanguageSelector />
      </header>

      {connectionStatus !== "connected" && (
        <div
          className={`flex items-center gap-2 p-3 rounded border ${
            connectionStatus === "connecting"
              ? "bg-yellow-50 border-yellow-200 text-yellow-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <Wifi className="h-4 w-4" />
          <span className="text-sm">
            {connectionStatus === "connecting"
              ? "Connecting to bus data..."
              : `Connection lost. Retrying... (${retryCountRef.current}/${optimizationSettings.maxRetries})`}
          </span>
        </div>
      )}

      {networkInfo.quality === "poor" && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <Signal className="h-4 w-4" />
            <span className="font-medium">Low Bandwidth Mode Active</span>
          </div>
          <div className="text-xs mt-1">
            Updates every {optimizationSettings.updateInterval / 1000} seconds to conserve data
          </div>
          <div className="text-xs mt-2 space-y-1">
            {dataCompressionRatio > 0 && <div>Data Compression: {dataCompressionRatio.toFixed(1)}% saved</div>}
            {offlineQueueSize > 0 && <div>Offline Queue: {offlineQueueSize} items</div>}
            {globalOfflineManager.isOffline() && <div className="text-red-600 font-medium">Offline Mode</div>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-2 rounded ${mode === "bus" ? "bg-blue-600 text-white" : "bg-muted"}`}
          onClick={() => setMode("bus")}
        >
          {t("search.busNo")}
        </button>
        <button
          className={`px-3 py-2 rounded ${mode === "pnr" ? "bg-blue-600 text-white" : "bg-muted"}`}
          onClick={() => setMode("pnr")}
        >
          {t("search.pnr")}
        </button>
        <button
          className={`px-3 py-2 rounded ${mode === "route" ? "bg-blue-600 text-white" : "bg-muted"}`}
          onClick={() => setMode("route")}
        >
          {t("search.routeSearch")}
        </button>
      </div>

      {mode === "route" ? (
        <RouteSearch onBusSelect={handleBusSelect} />
      ) : (
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded px-3 py-2"
            placeholder={
              mode === "bus"
                ? t("search.busPlaceholder")
                : mode === "pnr"
                  ? t("search.pnrPlaceholder")
                  : t("search.routePlaceholder")
            }
            value={query}
            onChange={(e) => setQuery(e.target.value.trim())}
          />
          <button
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
            onClick={() => subscribe()}
            disabled={!query}
          >
            {t("search.track")}
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button
          className={`rounded px-3 py-2 flex items-center gap-2 ${showMap ? "bg-gray-700 text-white" : "bg-muted"}`}
          onClick={() => setShowMap((s) => !s)}
        >
          {showMap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showMap ? t("controls.hideMap") : t("controls.showMap")}
        </button>

        {showMap && (
          <button
            className={`rounded px-3 py-2 flex items-center gap-2 ${showRoute ? "bg-green-600 text-white" : "bg-muted"}`}
            onClick={() => setShowRoute((s) => !s)}
          >
            <Route className="h-4 w-4" />
            {showRoute ? "Hide Route" : "Show Route"}
          </button>
        )}

        <button
          className="rounded px-3 py-2 bg-muted flex items-center gap-2 disabled:opacity-50"
          onClick={useMyLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
          {t("controls.useLocation")}
        </button>

        <button
          className={`rounded px-3 py-2 flex items-center gap-2 ${
            isTrackingLocation ? "bg-green-600 text-white" : "bg-muted"
          }`}
          onClick={isTrackingLocation ? stopLocationTracking : startLocationTracking}
        >
          <Navigation className="h-4 w-4" />
          {isTrackingLocation ? "Stop Tracking" : "Track My Location"}
        </button>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-current"
            checked={notifyNear}
            onChange={(e) => setNotifyNear(e.target.checked)}
          />
          {t("controls.notifyNear")}
        </label>
      </div>

      {locationError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{locationError}</div>
      )}

      {userLoc && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Your Location</span>
            {isTrackingLocation && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Live</span>}
          </div>
          <div className="text-blue-700">
            {formatLatLon(userLoc.lat, userLoc.lon)}
            <span className="text-xs ml-2">±{Math.round(userLoc.accuracy)}m</span>
          </div>
          <div className="text-xs text-blue-600 mt-1">Updated: {new Date(userLoc.timestamp).toLocaleTimeString()}</div>
        </div>
      )}

      {/* Live Map */}
      {showMap && (
        <LiveMap
          lat={bus?.lat || userLoc?.lat || 23.2599}
          lon={bus?.lon || userLoc?.lon || 77.4126}
          userLat={userLoc?.lat}
          userLon={userLoc?.lon}
        />
      )}

      <section className="grid gap-2 border rounded p-3">
        <div className="text-sm">
          {t("status.subscribed")} <span className="font-medium">{subscribed ? t("status.yes") : t("status.no")}</span>
        </div>
        <div className="text-sm">
          {t("status.bus")} <span className="font-medium">{busId ?? "—"}</span>
        </div>
        <div className="text-sm">
          {t("status.route")} <span className="font-medium">{bus?.routeName || "—"}</span>
        </div>
        <div className="text-sm">
          {t("status.status")} <span className="font-medium">{bus?.status || "—"}</span>
        </div>
        <div className="text-sm">
          {t("status.lastUpdate")} <span className="font-medium">{lastUpdated}</span>
        </div>
        <div className="text-sm">
          Data Updates: <span className="font-medium">Every {optimizationSettings.updateInterval / 1000}s</span>
          <span className="text-xs text-muted-foreground ml-2">
            (Last: {new Date(lastDataUpdate).toLocaleTimeString()})
          </span>
        </div>
        <div className="text-sm">
          Network: <span className="font-medium capitalize">{networkInfo.quality}</span>
          <span className="text-xs text-muted-foreground ml-2">
            ({networkInfo.effectiveType}, {networkInfo.downlink}Mbps, {networkInfo.rtt}ms RTT)
          </span>
        </div>
        <div className="text-sm">
        </div>
        {dataCompressionRatio > 0 && (
          <div className="text-sm">
            Compression: <span className="font-medium">{dataCompressionRatio.toFixed(1)}% data saved</span>
          </div>
        )}
        <div className="text-sm">
          {t("status.coordinates")} <span className="font-mono">{formatLatLon(bus?.lat, bus?.lon)}</span>
        </div>
        {userLoc && distanceAndEta && (
          <div className="text-sm">
            <span
              className={`inline-flex items-center gap-1 ${
                distanceAndEta.category === "very-close"
                  ? "text-green-600 font-semibold"
                  : distanceAndEta.category === "close"
                    ? "text-yellow-600 font-medium"
                    : distanceAndEta.category === "medium"
                      ? "text-orange-600"
                      : "text-gray-600"
              }`}
            >
              {t("status.distanceToYou")} {distanceAndEta.formatted}
              {distanceAndEta.category === "very-close" && " 🚌"}
            </span>
            {distanceAndEta.eta && (
              <>
                {" · "}
                {t("status.eta")} <span className="font-medium">{distanceAndEta.eta} min</span>
              </>
            )}
          </div>
        )}
        {!showMap && <p className="text-xs text-muted-foreground">{t("status.textOnlyMode")}</p>}
        {mapError && <p className="text-xs text-red-600">{mapError}</p>}
      </section>

  {/* Footer removed as requested */}
    </section>
  )
}

function sanitizeKey(key: string) {
  return key.replace(/[.#$[\]]/g, "_")
}
