"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { calculateDistance } from "@/lib/geo"

type BusMarkerData = {
  busId: string
  lat: number
  lon: number
  heading?: number
  busNumber: string
  route: string
  status: string
  speed?: number
  lastUpdate: Date
}

type UserMarkerData = {
  lat: number
  lon: number
  accuracy: number
  timestamp: Date
}

type Props = {
  buses: BusMarkerData[]
  userLocation?: UserMarkerData
  selectedBusId?: string
  showRoute?: boolean
  busStops?: { lat: number; lon: number; name: string }[]
  onBusClick?: (busId: string) => void
  className?: string
}

export function LiveMap({
  buses,
  userLocation,
  selectedBusId,
  showRoute = false,
  busStops = [],
  onBusClick,
  className = "h-96 w-full rounded border",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapCenter, setMapCenter] = useState({ lat: 23.2599, lon: 77.4126 }) // India center
  const [zoom, setZoom] = useState(6)
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })

  // Convert lat/lon to canvas coordinates
  const latLonToCanvas = useCallback(
    (lat: number, lon: number, canvasWidth: number, canvasHeight: number) => {
      const zoomFactor = Math.pow(2, zoom - 1)
      const x = (lon - mapCenter.lon) * zoomFactor * 100 + canvasWidth / 2
      const y = (mapCenter.lat - lat) * zoomFactor * 100 + canvasHeight / 2
      return { x, y }
    },
    [mapCenter, zoom],
  )

  // Draw the map
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const { width, height } = canvas

    // Clear canvas
    ctx.fillStyle = "#f8fafc"
    ctx.fillRect(0, 0, width, height)

    // Draw grid lines
    ctx.strokeStyle = "#e2e8f0"
    ctx.lineWidth = 1
    for (let i = 0; i < width; i += 50) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, height)
      ctx.stroke()
    }
    for (let i = 0; i < height; i += 50) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(width, i)
      ctx.stroke()
    }

    // Draw user location if available
    if (userLocation) {
      const userPos = latLonToCanvas(userLocation.lat, userLocation.lon, width, height)

      // Draw accuracy circle
      ctx.fillStyle = "rgba(59, 130, 246, 0.1)"
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(userPos.x, userPos.y, Math.max(20, userLocation.accuracy / 100), 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()

      // Draw user marker
      ctx.fillStyle = "#3b82f6"
      ctx.beginPath()
      ctx.arc(userPos.x, userPos.y, 8, 0, 2 * Math.PI)
      ctx.fill()

      // Draw user icon
      ctx.fillStyle = "white"
      ctx.font = "12px Arial"
      ctx.textAlign = "center"
      ctx.fillText("👤", userPos.x, userPos.y + 4)
    }

    // Draw bus stops
    busStops.forEach((stop) => {
      const stopPos = latLonToCanvas(stop.lat, stop.lon, width, height)

      // Draw stop marker
      ctx.fillStyle = "#6b7280"
      ctx.beginPath()
      ctx.arc(stopPos.x, stopPos.y, 6, 0, 2 * Math.PI)
      ctx.fill()

      // Draw stop icon
      ctx.fillStyle = "white"
      ctx.font = "10px Arial"
      ctx.textAlign = "center"
      ctx.fillText("🚏", stopPos.x, stopPos.y + 3)
    })

    // Draw route line if showing route and user location exists
    if (showRoute && selectedBusId && userLocation) {
      const selectedBus = buses.find((bus) => bus.busId === selectedBusId)
      if (selectedBus) {
        const busPos = latLonToCanvas(selectedBus.lat, selectedBus.lon, width, height)
        const userPos = latLonToCanvas(userLocation.lat, userLocation.lon, width, height)

        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 3
        ctx.setLineDash([10, 10])
        ctx.beginPath()
        ctx.moveTo(busPos.x, busPos.y)
        ctx.lineTo(userPos.x, userPos.y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Draw buses
    buses.forEach((bus) => {
      const busPos = latLonToCanvas(bus.lat, bus.lon, width, height)
      const isSelected = selectedBusId === bus.busId

      // Draw bus shadow/glow for selected bus
      if (isSelected) {
        ctx.shadowColor = "#3b82f6"
        ctx.shadowBlur = 15
      }

      // Draw bus marker background
      ctx.fillStyle = isSelected ? "#3b82f6" : "#ef4444"
      ctx.beginPath()
      ctx.arc(busPos.x, busPos.y, isSelected ? 12 : 10, 0, 2 * Math.PI)
      ctx.fill()

      // Reset shadow
      ctx.shadowBlur = 0

      // Draw bus icon
      ctx.fillStyle = "white"
      ctx.font = isSelected ? "16px Arial" : "14px Arial"
      ctx.textAlign = "center"
      ctx.fillText("🚌", busPos.x, busPos.y + (isSelected ? 5 : 4))

      // Draw bus number
      ctx.fillStyle = "#1f2937"
      ctx.font = "10px Arial"
      ctx.fillText(bus.busNumber, busPos.x, busPos.y + 25)
    })

    console.log("[v0] Map drawn successfully with", buses.length, "buses")
  }, [buses, userLocation, selectedBusId, showRoute, busStops, latLonToCanvas])

  // Handle canvas resize
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = container.getBoundingClientRect()
    canvas.width = rect.width
    canvas.height = rect.height
    drawMap()
  }, [drawMap])

  // Handle mouse events for map interaction
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return

      const deltaX = e.clientX - lastMousePos.x
      const deltaY = e.clientY - lastMousePos.y

      const zoomFactor = Math.pow(2, zoom - 1)
      const lonDelta = -deltaX / (zoomFactor * 100)
      const latDelta = deltaY / (zoomFactor * 100)

      setMapCenter((prev) => ({
        lat: prev.lat + latDelta,
        lon: prev.lon + lonDelta,
      }))

      setLastMousePos({ x: e.clientX, y: e.clientY })
    },
    [isDragging, lastMousePos, zoom],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle bus clicks
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onBusClick || isDragging) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const clickY = e.clientY - rect.top

      // Check if click is near any bus
      for (const bus of buses) {
        const busPos = latLonToCanvas(bus.lat, bus.lon, canvas.width, canvas.height)
        const distance = Math.sqrt(Math.pow(clickX - busPos.x, 2) + Math.pow(clickY - busPos.y, 2))

        if (distance <= 15) {
          // Click tolerance
          onBusClick(bus.busId)
          break
        }
      }
    },
    [buses, onBusClick, isDragging, latLonToCanvas],
  )

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const zoomDelta = e.deltaY > 0 ? -0.5 : 0.5
    setZoom((prev) => Math.max(1, Math.min(15, prev + zoomDelta)))
  }, [])

  // Auto-center map on buses
  const centerOnBuses = useCallback(() => {
    const allPoints = [
      ...buses.map((bus) => ({ lat: bus.lat, lon: bus.lon })),
      ...(userLocation ? [{ lat: userLocation.lat, lon: userLocation.lon }] : []),
    ]

    if (allPoints.length === 0) return

    const avgLat = allPoints.reduce((sum, point) => sum + point.lat, 0) / allPoints.length
    const avgLon = allPoints.reduce((sum, point) => sum + point.lon, 0) / allPoints.length

    setMapCenter({ lat: avgLat, lon: avgLon })
"use client"
    setZoom(12)
  }, [buses, userLocation])

  // Initialize and update map
  useEffect(() => {
    resizeCanvas()
    const handleResize = () => resizeCanvas()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [resizeCanvas])

  useEffect(() => {
    drawMap()
  }, [drawMap])

  // Auto-center when buses first load
  useEffect(() => {
    if (buses.length > 0) {
      centerOnBuses()
    }
  }, [buses.length > 0]) // Only trigger when buses first appear

  return (
    <div ref={containerRef} className={`relative ${className} bg-slate-50 overflow-hidden`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
      />

      {/* Map controls */}
      <div className="absolute top-2 right-2 flex flex-col gap-1">
        <button
          onClick={() => setZoom((prev) => Math.min(15, prev + 1))}
          className="bg-white border rounded px-2 py-1 text-sm hover:bg-gray-50"
        >
          +
        </button>
        <button
          onClick={() => setZoom((prev) => Math.max(1, prev - 1))}
          className="bg-white border rounded px-2 py-1 text-sm hover:bg-gray-50"
        >
          -
        </button>
        <button onClick={centerOnBuses} className="bg-white border rounded px-2 py-1 text-xs hover:bg-gray-50">
          📍
        </button>
      </div>

      {/* Bus info overlay */}
      {selectedBusId && (
        <div className="absolute bottom-2 left-2 bg-white border rounded-lg p-3 shadow-lg max-w-xs">
          {(() => {
            const selectedBus = buses.find((bus) => bus.busId === selectedBusId)
            if (!selectedBus) return null

            const distance = userLocation
              ? calculateDistance(userLocation.lat, userLocation.lon, selectedBus.lat, selectedBus.lon)
              : null

            return (
              <div>
                <div className="font-semibold text-blue-600">🚌 {selectedBus.busNumber}</div>
                <div className="text-sm text-gray-600">{selectedBus.route}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Status: {selectedBus.status}
                  {selectedBus.speed && ` • ${selectedBus.speed} km/h`}
                  {distance && ` • ${distance.toFixed(1)} km away`}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-2 left-2 bg-white border rounded-lg p-2 text-xs">
        <div className="flex items-center gap-1 mb-1">
          <span>🚌</span> <span>Bus</span>
        </div>
        <div className="flex items-center gap-1 mb-1">
          <span>👤</span> <span>You</span>
        </div>
        <div className="flex items-center gap-1">
          <span>🚏</span> <span>Stop</span>
        </div>
      </div>
    </div>
  )
}
