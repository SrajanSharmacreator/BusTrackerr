// <CHANGE> convert to client page, require driver login, prefill assigned bus
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import DriverLocation from "@/components/driver-location"
import { getFirebaseDb } from "@/lib/firebase"
import { get, ref } from "firebase/database"

export default function DriverPage() {
  const router = useRouter()
  const [driverId, setDriverId] = useState<string | null>(null)
  const [assignedBusId, setAssignedBusId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("driverId") : null
    if (!id) {
      router.replace("/driver/login")
      return
    }
    setDriverId(id)
    const db = getFirebaseDb()
    async function load() {
      try {
        if (!db) return
        const snap = await get(ref(db, `drivers/${id}`))
        if (!snap.exists()) {
          localStorage.removeItem("driverId")
          router.replace("/driver/login")
          return
        }
        const val = snap.val() as { busId?: string } | null
        setAssignedBusId(val?.busId ?? null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [router])

  function logout() {
    localStorage.removeItem("driverId")
    router.replace("/driver/login")
  }

  if (loading) {
    return (
      <main className="p-4">
        <p>Loading…</p>
      </main>
    )
  }

  return (
    <main className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Driver ID: <span className="font-medium">{driverId}</span>
          {assignedBusId ? (
            <>
              {" · "}Assigned Bus: <span className="font-medium">{assignedBusId}</span>
            </>
          ) : null}
        </div>
        <button className="text-sm underline" onClick={logout}>
          Logout
        </button>
      </div>
      <DriverLocation defaultBusId={assignedBusId ?? undefined} />
    </main>
  )
}
