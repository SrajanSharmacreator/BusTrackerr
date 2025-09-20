"use client"

import { useEffect, useRef } from "react"
import L, { Map, Marker } from "leaflet"
import "leaflet/dist/leaflet.css"

type Props = {
  lat: number // bus latitude
  lon: number // bus longitude
  userLat?: number // user latitude (optional)
  userLon?: number // user longitude (optional)
  follow?: boolean
}

export default function LiveMap({ lat, lon, userLat, userLon, follow = true }: Props) {
  const mapRef = useRef<Map | null>(null)
  const markerRef = useRef<Marker | null>(null)

  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map("live-map", {
        center: [lat, lon],
        zoom: 15,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(mapRef.current)
    }

    // Bus marker
    if (!markerRef.current) {
      const busIcon = L.icon({
        iconUrl: "/images/bus.png",
        iconSize: [36, 36],
        iconAnchor: [18, 28],
      })
      markerRef.current = L.marker([lat, lon], { icon: busIcon }).addTo(mapRef.current)
    } else {
      markerRef.current.setLatLng([lat, lon])
    }

    // User marker
    let userMarker: Marker | null = null
    if (userLat !== undefined && userLon !== undefined && mapRef.current) {
      const userIcon = L.icon({
        iconUrl: "/placeholder-user.jpg",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })
      userMarker = L.marker([userLat, userLon], { icon: userIcon }).addTo(mapRef.current)
    }

    // Route polyline
    let routeLine: L.Polyline | null = null
    if (
      userLat !== undefined && userLon !== undefined &&
      mapRef.current && (lat !== undefined && lon !== undefined)
    ) {
      const latlngs = [
        [userLat, userLon],
        [lat, lon],
      ]
      routeLine = L.polyline(latlngs, { color: "blue", weight: 4, opacity: 0.7 }).addTo(mapRef.current)
    }

    if (follow && mapRef.current) {
      mapRef.current.setView([lat, lon])
    }

    // Cleanup user marker and route line on unmount or update
    return () => {
      if (userMarker && mapRef.current) {
        mapRef.current.removeLayer(userMarker)
      }
      if (routeLine && mapRef.current) {
        mapRef.current.removeLayer(routeLine)
      }
    }
  }, [lat, lon, userLat, userLon, follow])

  return (
    <div
      id="live-map"
      className="w-full h-64 rounded-md border"
      aria-label="Live bus location map"
    />
  )
}