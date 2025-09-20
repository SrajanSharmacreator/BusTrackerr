"use client"

import { useEffect, useRef, useState } from "react"
import { getFirebaseDb } from "@/lib/firebase"
import { ref, update } from "firebase/database"

type DriverLocationProps = {
  defaultBusId?: string
}

export default function DriverLocation({ defaultBusId }: DriverLocationProps) {
  const [busId, setBusId] = useState(defaultBusId || "")
  const [pnr, setPnr] = useState("")
  const [routeName, setRouteName] = useState("")
  const [sharing, setSharing] = useState(false)
  const [status, setStatus] = useState("Idle")
  const [permissionState, setPermissionState] = useState<"prompt" | "granted" | "denied" | "unknown">("unknown")
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<{ t: number; lat?: number; lon?: number }>({ t: 0 })
"use client"
  const driverIdRef = useRef<string | null>(null)

  useEffect(() => {
    driverIdRef.current = typeof window !== "undefined" ? localStorage.getItem("driverId") : null
  }, [])

  useEffect(() => {
    if (defaultBusId && !busId) setBusId(defaultBusId)
  }, [defaultBusId]) // prefill bus from driver profile

  useEffect(() => {
    if (typeof navigator !== "undefined" && "permissions" in navigator) {
      // @ts-expect-error permissions may not be fully typed
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((res: any) => {
          setPermissionState(res.state ?? "unknown")
          res.onchange = () => setPermissionState(res.state ?? "unknown")
        })
        .catch(() => setPermissionState("unknown"))
    }
  }, [])

  const onBeforeUnload = () => {
    if (sharing && busId) {
      const db = getFirebaseDb()
      if (db) {
        update(ref(db, `buses/${busId}`), { status: "offline", updatedAt: Date.now() }).catch(() => {})
      }
    }
  }

  useEffect(() => {
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload as any)
    }
  }, [sharing, busId])

  function startSharing() {
    if (!busId) {
      setStatus("Enter a Bus No to start sharing.")
      return
    }
    const db = getFirebaseDb()
    if (!db) {
      setStatus("Firebase not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.")
      return
    }

    setStatus("Requesting location…")
    if (!("geolocation" in navigator)) {
      setStatus("Geolocation not supported on this device.")
      return
    }

    const minIntervalMs = 5000
    const minMoveMeters = 15

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon, speed, heading } = pos.coords
        const now = Date.now()

        const last = lastSentRef.current
        const movedEnough =
          !last.lat || !last.lon ? true : distanceApproxMeters(last.lat, last.lon, lat, lon) >= minMoveMeters
        const timeEnough = now - (last.t || 0) >= minIntervalMs

        if (!movedEnough && !timeEnough) {
          setStatus("Location received (throttled)")
          return
        }

        lastSentRef.current = { t: now, lat, lon }

        const payload = {
          busId,
          driverId: driverIdRef.current || null, // include driver ID
          lat,
          lon,
          speed: speed ?? null,
          heading: heading ?? null,
          routeName: routeName || null,
          status: "online",
          updatedAt: now,
        }

        try {
          await update(ref(db, `buses/${busId}`), payload)
          if (pnr) {
            await update(ref(db, `pnrIndex/${sanitizeKey(pnr)}`), { busId, updatedAt: now })
          }
          setStatus(`Shared ${lat.toFixed(5)}, ${lon.toFixed(5)} at ${new Date(now).toLocaleTimeString()}`)
        } catch (e) {
          setStatus("Failed to update location.")
        }
      },
      (err) => {
        setStatus(`Location error: ${err.message}`)
        stopSharing()
      },
      {
        enableHighAccuracy: false,
        maximumAge: 10000,
        timeout: 15000,
      },
    )

    setSharing(true)
    setStatus("Sharing location…")
  }

  function stopSharing() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setSharing(false)
    setStatus("Stopped sharing.")
  }

  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [])

  return (
    <section className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold text-balance">Driver: Share Bus Location</h1>
      <div className="grid gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-muted-foreground">Bus No</span>
          <input
            className="border rounded px-3 py-2"
            placeholder="e.g. 24B"
            value={busId}
            onChange={(e) => setBusId(e.target.value.trim())}
            disabled={!!defaultBusId} // lock when driver is assigned a bus
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted-foreground">PNR (optional)</span>
          <input
            className="border rounded px-3 py-2"
            placeholder="e.g. 839214"
            value={pnr}
            onChange={(e) => setPnr(e.target.value.trim())}
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-muted-foreground">Route Name (optional)</span>
          <input
            className="border rounded px-3 py-2"
            placeholder="e.g. Main Market → Station"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
          />
        </label>
        <div className="text-sm text-muted-foreground">
          Location permission: <span className="font-medium">{permissionState}</span>
        </div>
        <div className="flex items-center gap-2">
          {!sharing ? (
            <button
              className="bg-green-600 text-white rounded px-4 py-2 disabled:opacity-50"
              onClick={startSharing}
              disabled={!busId}
            >
              Start Sharing Location
            </button>
          ) : (
            <button className="bg-gray-700 text-white rounded px-4 py-2" onClick={stopSharing}>
              Stop Sharing
            </button>
          )}
        </div>
        <div className="text-sm">
          Status: <span className="font-medium">{status}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: Keep this page open to continue sharing. For low bandwidth, we throttle updates and use coarse accuracy
          to save data.
        </p>
      </div>
    </section>
  )
}

function sanitizeKey(key: string) {
  return key.replace(/[.#$[\]]/g, "_")
}

function distanceApproxMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dx = (lon2 - lon1) * 111320 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  const dy = (lat2 - lat1) * 110540
  return Math.sqrt(dx * dx + dy * dy)
}
