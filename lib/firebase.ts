import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app"
import { getDatabase, type Database } from "firebase/database"

let appInstance: FirebaseApp | null = null
let dbInstance: Database | null = null
let hasLoggedConfig = false

function readFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DB_URL
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID

  const config = { apiKey, authDomain, databaseURL, projectId, appId }
  const flags = {
    apiKey: !!apiKey,
    authDomain: !!authDomain,
    databaseURL: !!databaseURL,
    projectId: !!projectId,
    appId: !!appId,
  }
  const missing = Object.entries(flags)
    .filter(([, ok]) => !ok)
    .map(([k]) => {
      switch (k) {
        case "apiKey":
          return "NEXT_PUBLIC_FIREBASE_API_KEY"
        case "databaseURL":
          return "NEXT_PUBLIC_FIREBASE_DB_URL"
        case "projectId":
          return "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
        case "appId":
          return "NEXT_PUBLIC_FIREBASE_APP_ID"
        case "authDomain":
          return "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
        default:
          return k
      }
    })

  if (!hasLoggedConfig) {
    console.log("[v0] Firebase config check:", {
      apiKey: flags.apiKey,
      authDomain: flags.authDomain,
      databaseURL: flags.databaseURL,
      projectId: flags.projectId,
      appId: flags.appId,
    })
    hasLoggedConfig = true
  }

  return { config, flags, missing }
}

export function getFirebaseApp() {
  if (typeof window === "undefined") return null
  if (appInstance) return appInstance

  if (getApps().length) {
    appInstance = getApp()
    return appInstance
  }

  const { config, missing } = readFirebaseConfig()

  if (missing.length > 0) {
    // Do not throw — log once and return null so the UI can still load.
    console.warn("[v0] Firebase not configured. Add NEXT_PUBLIC_FIREBASE_* env vars. Missing:", missing.join(", "))
    return null
  }

  appInstance = initializeApp({
    apiKey: config.apiKey!,
    authDomain: config.authDomain!, // optional for RTDB-only, safe to include
    databaseURL: config.databaseURL!,
    projectId: config.projectId!,
    appId: config.appId!,
  })

  console.log("[v0] Firebase initialized.")
  return appInstance
}

export function getFirebaseDb() {
  if (typeof window === "undefined") return null
  if (dbInstance) return dbInstance

  const app = getFirebaseApp()
  if (!app) return null

  const { config } = readFirebaseConfig()
  // Pass databaseURL explicitly for clarity.
  dbInstance = getDatabase(app, config.databaseURL!)
  return dbInstance
}

export function firebaseReady() {
  if (typeof window === "undefined") return false
  const { missing } = readFirebaseConfig()
  return missing.length === 0
}

// Export a client-safe Firebase app instance so other modules can import { app }
