"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getDatabase, ref, get } from "firebase/database"
import { app } from "@/lib/firebase"
import { setDriverSession } from "@/lib/session"

export default function DriverLoginForm() {
  const [busNumber, setBusNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmed = busNumber.trim().toUpperCase()
    if (!trimmed) {
      setError("Please enter your Bus Number.")
      return
    }
    setLoading(true)
    try {
      const db = getDatabase(app, process.env.NEXT_PUBLIC_FIREBASE_DB_URL)
      const driversSnap = await get(ref(db, "drivers"))
      if (!driversSnap.exists()) {
        setError("No drivers found. Contact your transport authority.")
        setLoading(false)
        return
      }

      const driversData = driversSnap.val()
      let foundDriver = null
      let foundDriverId = null

      for (const [driverId, driverData] of Object.entries(driversData)) {
        const driver = driverData as { busId?: string; isActive?: boolean }
        if (driver.busId?.toString().toUpperCase() === trimmed) {
          if (driver.isActive === false) {
            setError("This bus is currently inactive. Contact your transport authority.")
            setLoading(false)
            return
          }
          foundDriver = driver
          foundDriverId = driverId
          break
        }
      }

      if (!foundDriver || !foundDriverId) {
        setError("Bus number not found. Contact your transport authority.")
        setLoading(false)
        return
      }

      setDriverSession({ driverId: foundDriverId, busId: trimmed })
      router.replace("/driver")
    } catch (err: any) {
      setError(err?.message || "Login failed. Please try again.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-sm w-full space-y-4">
      <div className="space-y-2">
        <label htmlFor="busNumber" className="block text-sm font-medium">
          Bus Number
        </label>
        <input
          id="busNumber"
          type="text"
          value={busNumber}
          onChange={(e) => setBusNumber(e.target.value)}
          placeholder="e.g., BUS001"
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
          autoComplete="off"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm disabled:opacity-50"
        aria-busy={loading}
      >
        {loading ? "Checking…" : "Log in"}
      </button>
      <p className="text-xs text-muted-foreground">Enter the bus number assigned to you by your transport authority.</p>
    </form>
  )
}
