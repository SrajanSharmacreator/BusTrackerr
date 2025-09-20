export type DriverSession = {
  driverId: string
  busId: string
}

const KEY = "driver.session"

export function getDriverSession(): DriverSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as DriverSession
  } catch {
    return null
  }
}

export function setDriverSession(s: DriverSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearDriverSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(KEY)
}
