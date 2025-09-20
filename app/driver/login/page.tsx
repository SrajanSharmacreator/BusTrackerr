"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getFirebaseDb } from "@/lib/firebase"
import { get, ref } from "firebase/database"

export default function DriverLoginPage() {
  const router = useRouter()
  const [busNumber, setBusNumber] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const existing = typeof window !== "undefined" ? localStorage.getItem("busNumber") : null
    if (existing) router.replace("/driver")
  }, [router])

  async function handleLogin() {
    setError(null)
    const busNum = busNumber.trim().toUpperCase()
    if (!busNum) {
      setError("Enter your Bus Number")
      return
    }
    setLoading(true)
    try {
      const db = getFirebaseDb()
      if (!db) {
        setError("Firebase not configured. Add NEXT_PUBLIC_FIREBASE_* env vars.")
        return
      }

      const driversSnap = await get(ref(db, "drivers"))
      if (driversSnap.exists()) {
        const drivers = driversSnap.val()
        let foundDriver = null
        let foundDriverId = null

        for (const [driverId, driverData] of Object.entries(drivers)) {
          if ((driverData as any).busId === busNum) {
            foundDriver = driverData
            foundDriverId = driverId
            break
          }
        }

        if (foundDriver && (foundDriver as any).isActive !== false) {
          localStorage.setItem("busNumber", busNum)
          localStorage.setItem("driverId", foundDriverId!)
          router.replace("/driver")
        } else if (foundDriver) {
          setError("Bus account is deactivated. Contact your transport authority.")
        } else {
          setError("Invalid Bus Number. Please contact your transport authority.")
        }
      } else {
        setError("No drivers found. Contact your transport authority.")
      }
    } catch (e: any) {
      setError(e.message || "Login failed.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Driver Login</h1>
      <div className="space-y-2">
        <label className="block text-sm">Bus Number</label>
        <input
          className="w-full border rounded-md px-3 py-2 bg-background"
          value={busNumber}
          onChange={(e) => setBusNumber(e.target.value)}
          placeholder="Enter your bus number (e.g., BUS001)"
        />
      </div>
      <button onClick={handleLogin} disabled={loading} className="w-full h-10 rounded-md bg-blue-600 text-white">
        {loading ? "Checking..." : "Login"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-muted-foreground">
        Only drivers with a valid bus number can login. Commuters do not need an account.
      </p>
    </main>
  )
}
