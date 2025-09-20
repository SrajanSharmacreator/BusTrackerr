"use client"

import { useState, useEffect } from "react"
import { useLanguage } from "@/lib/language-context"
import { searchRoutes, getPopularRoutes, type RouteSearchResult } from "@/lib/route-search"
import { Clock, MapPin, Users, Navigation } from "lucide-react"

type Props = {
  onBusSelect: (busId: string, busData: any) => void
}

export function RouteSearch({ onBusSelect }: Props) {
  const { t } = useLanguage()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<RouteSearchResult[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(true)

  useEffect(() => {
    getPopularRoutes().then(setSuggestions)
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setShowSuggestions(false)

    try {
      const searchResults = await searchRoutes(query)
      setResults(searchResults)
    } catch (error) {
      console.error("[v0] Route search failed:", error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion)
    setShowSuggestions(false)
  }

  const handleBusClick = (bus: any) => {
    onBusSelect(bus.busId, {
      busId: bus.busId,
      lat: bus.lat,
      lon: bus.lon,
      speed: bus.speed,
      heading: bus.heading,
      routeName: bus.routeName,
      status: bus.currentStatus,
      updatedAt: bus.updatedAt,
    })
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          className="flex-1 border rounded px-3 py-2"
          placeholder={t("search.routePlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
        />
        <button
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          onClick={handleSearch}
          disabled={!query.trim() || loading}
        >
          {loading ? "Searching..." : t("search.searchBuses")}
        </button>
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="border rounded p-3">
          <h4 className="text-sm font-medium mb-2">{t("route.suggestions")}</h4>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="text-xs bg-muted hover:bg-muted/80 rounded px-2 py-1"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {results.length === 0 && !loading && !showSuggestions && query && (
        <div className="text-center py-8 text-muted-foreground">
          <Navigation className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t("route.noResults")}</p>
        </div>
      )}

      {results.map((result) => (
        <div key={result.route.routeId} className="border rounded p-4 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{result.route.name}</h3>
              <p className="text-sm text-muted-foreground">
                {result.route.fromCity} → {result.route.toCity}
              </p>
            </div>
            <div className="text-right text-sm">
              <div className="flex items-center gap-1 text-green-600">
                <Users className="h-4 w-4" />
                {result.activeBuses}/{result.totalBuses} {t("route.activeBuses")}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {t("route.distance")}: {result.route.distance}km
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {t("route.duration")}: {formatDuration(result.route.estimatedDuration)}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t("route.operatingHours")}: </span>
              {result.route.operatingHours.start} - {result.route.operatingHours.end}
            </div>
          </div>

          {result.route.stops.length > 0 && (
            <div className="text-sm">
              <span className="text-muted-foreground">{t("route.stops")}: </span>
              {result.route.stops.join(" → ")}
            </div>
          )}

          {result.buses.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">{t("route.availableBuses")}</h4>
              <div className="grid gap-2">
                {result.buses.map((bus) => (
                  <div
                    key={bus.busId}
                    className="border rounded p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleBusClick(bus)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">
                          {t("status.bus")} {bus.busId}
                        </span>
                        <span
                          className={`ml-2 text-xs px-2 py-1 rounded ${
                            bus.currentStatus === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {bus.currentStatus}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{t("route.selectBus")}</div>
                    </div>
                    {bus.nextStop && (
                      <div className="text-sm text-muted-foreground mt-1">
                        Next: {bus.nextStop}
                        {bus.estimatedArrival && (
                          <span className="ml-2">(ETA: {new Date(bus.estimatedArrival).toLocaleTimeString()})</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
