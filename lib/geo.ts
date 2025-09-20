// Haversine distance in meters
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// ETA in minutes given distance meters and speed m/s (fallback to 8 m/s ~ 28.8 km/h)
export function etaMinutes(distanceMeters: number, speedMps?: number): number | null {
  const speed = speedMps && speedMps > 0.5 ? speedMps : 8
  const minutes = distanceMeters / speed / 60
  return isFinite(minutes) ? Math.round(minutes) : null
}

export function formatLatLon(lat?: number, lon?: number) {
  if (lat == null || lon == null) return "—"
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

// Enhanced geolocation utilities for better user tracking
export function watchUserLocation(
  onLocationUpdate: (position: { lat: number; lon: number; accuracy: number }) => void,
  onError?: (error: GeolocationPositionError) => void,
): number | null {
  if (!("geolocation" in navigator)) {
    onError?.(new Error("Geolocation not supported") as any)
    return null
  }

  return navigator.geolocation.watchPosition(
    (pos) => {
      onLocationUpdate({
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      })
    },
    (error) => {
      onError?.(error)
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000, // 10 seconds
      timeout: 15000,
    },
  )
}

export function getCurrentLocation(): Promise<{ lat: number; lon: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation not supported"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 20000,
        timeout: 15000,
      },
    )
  })
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  } else {
    return `${(meters / 1000).toFixed(2)} km`
  }
}

export function getDistanceCategory(meters: number): "very-close" | "close" | "medium" | "far" {
  if (meters < 100) return "very-close"
  if (meters < 500) return "close"
  if (meters < 2000) return "medium"
  return "far"
}

export const calculateDistance = haversineMeters
