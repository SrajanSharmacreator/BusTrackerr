import { getFirebaseDb } from "./firebase"
import { ref, get } from "firebase/database"

export type RouteInfo = {
  routeId: string
  name: string
  fromCity: string
  toCity: string
  distance: number
  estimatedDuration: number // in minutes
  stops: string[]
  operatingHours: {
    start: string
    end: string
  }
}

export type BusOnRoute = {
  busId: string
  routeId: string
  routeName: string
  currentStatus: string
  lat?: number
  lon?: number
  speed?: number
  heading?: number
  nextStop?: string
  estimatedArrival?: number
  updatedAt?: number
}

export type RouteSearchResult = {
  route: RouteInfo
  buses: BusOnRoute[]
  totalBuses: number
  activeBuses: number
}

// Parse route query like "Jabalpur to Mandla" or "Mumbai Delhi"
export function parseRouteQuery(query: string): { from: string; to: string } | null {
  const normalized = query.toLowerCase().trim()

  // Handle "from to to" pattern
  const toMatch = normalized.match(/^(.+?)\s+to\s+(.+)$/)
  if (toMatch) {
    return {
      from: toMatch[1].trim(),
      to: toMatch[2].trim(),
    }
  }

  // Handle "from - to" pattern
  const dashMatch = normalized.match(/^(.+?)\s*-\s*(.+)$/)
  if (dashMatch) {
    return {
      from: dashMatch[1].trim(),
      to: dashMatch[2].trim(),
    }
  }

  // Handle space-separated cities (assume first is from, last is to)
  const words = normalized.split(/\s+/).filter((w) => w.length > 2)
  if (words.length >= 2) {
    return {
      from: words[0],
      to: words[words.length - 1],
    }
  }

  return null
}

// Generate route key for database lookup
export function generateRouteKey(from: string, to: string): string {
  const normalize = (city: string) => city.toLowerCase().replace(/[^a-z0-9]/g, "")
  return `${normalize(from)}_${normalize(to)}`
}

// Search for routes between cities
export async function searchRoutes(query: string): Promise<RouteSearchResult[]> {
  const db = getFirebaseDb()
  if (!db) return []

  const parsed = parseRouteQuery(query)
  if (!parsed) return []

  try {
    const results: RouteSearchResult[] = []

    // Search for direct routes
    const directKey = generateRouteKey(parsed.from, parsed.to)
    const directRoute = await searchDirectRoute(directKey)
    if (directRoute) {
      results.push(directRoute)
    }

    // Search for reverse routes
    const reverseKey = generateRouteKey(parsed.to, parsed.from)
    const reverseRoute = await searchDirectRoute(reverseKey)
    if (reverseRoute) {
      results.push(reverseRoute)
    }

    // Search for routes that contain both cities as stops
    const connectingRoutes = await searchConnectingRoutes(parsed.from, parsed.to)
    results.push(...connectingRoutes)

    return results.slice(0, 5) // Limit to top 5 results
  } catch (error) {
    console.error("[v0] Route search error:", error)
    return []
  }
}

async function searchDirectRoute(routeKey: string): Promise<RouteSearchResult | null> {
  const db = getFirebaseDb()
  if (!db) return null

  try {
    const routeRef = ref(db, `routes/${routeKey}`)
    const routeSnap = await get(routeRef)

    if (!routeSnap.exists()) return null

    const routeData = routeSnap.val()
    const route: RouteInfo = {
      routeId: routeKey,
      name: routeData.name || `${routeData.fromCity} to ${routeData.toCity}`,
      fromCity: routeData.fromCity,
      toCity: routeData.toCity,
      distance: routeData.distance || 0,
      estimatedDuration: routeData.estimatedDuration || 0,
      stops: routeData.stops || [],
      operatingHours: routeData.operatingHours || { start: "06:00", end: "22:00" },
    }

    // Get buses on this route
    const buses = await getBusesOnRoute(routeKey)

    return {
      route,
      buses,
      totalBuses: buses.length,
      activeBuses: buses.filter((bus) => bus.currentStatus === "active").length,
    }
  } catch (error) {
    console.error("[v0] Direct route search error:", error)
    return null
  }
}

async function searchConnectingRoutes(from: string, to: string): Promise<RouteSearchResult[]> {
  const db = getFirebaseDb()
  if (!db) return []

  try {
    // This would search through all routes to find ones that have both cities in stops
    // For now, return empty array - this would require more complex database queries
    return []
  } catch (error) {
    console.error("[v0] Connecting routes search error:", error)
    return []
  }
}

async function getBusesOnRoute(routeKey: string): Promise<BusOnRoute[]> {
  const db = getFirebaseDb()
  if (!db) return []

  try {
    const routeBusesRef = ref(db, `routes/${routeKey}/buses`)
    const busesSnap = await get(routeBusesRef)

    if (!busesSnap.exists()) return []

    const busIds = Object.keys(busesSnap.val())
    const buses: BusOnRoute[] = []

    // Get current data for each bus
    for (const busId of busIds) {
      const busRef = ref(db, `buses/${busId}`)
      const busSnap = await get(busRef)

      if (busSnap.exists()) {
        const busData = busSnap.val()
        buses.push({
          busId,
          routeId: routeKey,
          routeName: busData.routeName || "",
          currentStatus: busData.status || "unknown",
          lat: busData.lat,
          lon: busData.lon,
          speed: busData.speed,
          heading: busData.heading,
          nextStop: busData.nextStop,
          estimatedArrival: busData.estimatedArrival,
          updatedAt: busData.updatedAt,
        })
      }
    }

    return buses
  } catch (error) {
    console.error("[v0] Get buses on route error:", error)
    return []
  }
}

// Get popular routes for suggestions
export async function getPopularRoutes(): Promise<string[]> {
  // Return some common Indian city pairs for suggestions
  return [
    "Mumbai to Pune",
    "Delhi to Agra",
    "Bangalore to Mysore",
    "Chennai to Pondicherry",
    "Hyderabad to Vijayawada",
    "Kolkata to Durgapur",
    "Jabalpur to Mandla",
    "Indore to Bhopal",
    "Jaipur to Udaipur",
    "Ahmedabad to Vadodara",
  ]
}

// Create sample route data for testing
export async function createSampleRouteData() {
  const db = getFirebaseDb()
  if (!db) return

  const sampleRoutes = [
    {
      key: "jabalpur_mandla",
      data: {
        name: "Jabalpur to Mandla Express",
        fromCity: "Jabalpur",
        toCity: "Mandla",
        distance: 95,
        estimatedDuration: 180,
        stops: ["Jabalpur", "Shahpura", "Niwas", "Mandla"],
        operatingHours: { start: "06:00", end: "20:00" },
        buses: {
          JBP001: true,
          JBP002: true,
          JBP003: true,
        },
      },
    },
    {
      key: "mumbai_pune",
      data: {
        name: "Mumbai Pune Highway",
        fromCity: "Mumbai",
        toCity: "Pune",
        distance: 150,
        estimatedDuration: 210,
        stops: ["Mumbai", "Lonavala", "Pune"],
        operatingHours: { start: "05:00", end: "23:00" },
        buses: {
          MH001: true,
          MH002: true,
          MH003: true,
          MH004: true,
        },
      },
    },
  ]

  // This would be used to populate the database with sample data
  console.log("[v0] Sample route data ready for database population")
}
