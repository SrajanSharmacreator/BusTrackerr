export type MapBounds = {
  north: number
  south: number
  east: number
  west: number
}

export type RoutePoint = {
  lat: number
  lon: number
  timestamp?: number
  speed?: number
}

export type BusMarkerData = {
  busId: string
  lat: number
  lon: number
  heading?: number
  speed?: number
  status: string
  routeName?: string
  lastUpdate: number
}

export type UserMarkerData = {
  lat: number
  lon: number
  accuracy: number
  timestamp: number
}

// Calculate optimal map bounds to fit all markers
export function calculateMapBounds(points: { lat: number; lon: number }[]): MapBounds | null {
  if (points.length === 0) return null

  let north = points[0].lat
  let south = points[0].lat
  let east = points[0].lon
  let west = points[0].lon

  points.forEach((point) => {
    north = Math.max(north, point.lat)
    south = Math.min(south, point.lat)
    east = Math.max(east, point.lon)
    west = Math.min(west, point.lon)
  })

  // Add padding
  const latPadding = (north - south) * 0.1
  const lonPadding = (east - west) * 0.1

  return {
    north: north + latPadding,
    south: south - latPadding,
    east: east + lonPadding,
    west: west - lonPadding,
  }
}

// Generate route path between two points (simplified)
export function generateRoutePath(start: RoutePoint, end: RoutePoint): RoutePoint[] {
  // For now, return a simple straight line
  // In a real app, this would use a routing service like OSRM or Google Directions
  const steps = 10
  const path: RoutePoint[] = []

  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps
    path.push({
      lat: start.lat + (end.lat - start.lat) * ratio,
      lon: start.lon + (end.lon - start.lon) * ratio,
      timestamp: Date.now(),
    })
  }

  return path
}

// Create bus icon with rotation based on heading
export function createBusIcon(leaflet: any, heading?: number): any {
  const rotation = heading || 0

  return new leaflet.Icon({
    iconUrl: "/images/bus.png",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
    className: `bus-icon ${heading ? "rotated" : ""}`,
    html: heading
      ? `<div style="transform: rotate(${rotation}deg)"><img src="/images/bus.png" width="36" height="36" /></div>`
      : undefined,
  })
}

// Create user location icon
export function createUserIcon(leaflet: any): any {
  return new leaflet.Icon({
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" strokeWidth="3"/>
        <circle cx="12" cy="12" r="3" fill="#ffffff"/>
        <circle cx="12" cy="12" r="10" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3"/>
      </svg>
    `),
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  })
}

// Create bus stop icon
export function createBusStopIcon(leaflet: any): any {
  return new leaflet.Icon({
    iconUrl:
      "data:image/svg+xml;base64," +
      btoa(`
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="4" width="18" height="16" rx="2" fill="#f59e0b" stroke="#ffffff" strokeWidth="2"/>
        <circle cx="12" cy="12" r="3" fill="#ffffff"/>
        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="8">BUS</text>
      </svg>
    `),
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10],
  })
}

// Format popup content for bus marker
export function formatBusPopup(bus: BusMarkerData): string {
  const lastUpdateTime = new Date(bus.lastUpdate).toLocaleTimeString()
  const speedText = bus.speed ? `${Math.round(bus.speed * 3.6)} km/h` : "Unknown"

  return `
    <div class="bus-popup">
      <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">
        🚌 Bus ${bus.busId}
      </h3>
      <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
        <div><strong>Route:</strong> ${bus.routeName || "Unknown"}</div>
        <div><strong>Status:</strong> <span style="color: ${bus.status === "active" ? "#10b981" : "#ef4444"}">${bus.status}</span></div>
        <div><strong>Speed:</strong> ${speedText}</div>
        <div><strong>Last Update:</strong> ${lastUpdateTime}</div>
      </div>
    </div>
  `
}

// Format popup content for user marker
export function formatUserPopup(user: UserMarkerData): string {
  const updateTime = new Date(user.timestamp).toLocaleTimeString()

  return `
    <div class="user-popup">
      <h3 style="margin: 0 0 8px 0; font-weight: bold; color: #1f2937;">
        📍 Your Location
      </h3>
      <div style="font-size: 12px; color: #6b7280; line-height: 1.4;">
        <div><strong>Accuracy:</strong> ±${Math.round(user.accuracy)}m</div>
        <div><strong>Updated:</strong> ${updateTime}</div>
      </div>
    </div>
  `
}

// Animation utilities for smooth marker movement
export function animateMarkerTo(marker: any, newLatLng: [number, number], duration = 1000) {
  if (!marker || !marker.getLatLng) return

  const startLatLng = marker.getLatLng()
  const startTime = Date.now()

  const animate = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)

    // Easing function for smooth animation
    const easeProgress = 1 - Math.pow(1 - progress, 3)

    const currentLat = startLatLng.lat + (newLatLng[0] - startLatLng.lat) * easeProgress
    const currentLng = startLatLng.lng + (newLatLng[1] - startLatLng.lng) * easeProgress

    marker.setLatLng([currentLat, currentLng])

    if (progress < 1) {
      requestAnimationFrame(animate)
    }
  }

  requestAnimationFrame(animate)
}
