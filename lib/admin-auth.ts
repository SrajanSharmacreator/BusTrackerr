import { getFirebaseDb } from "@/lib/firebase"
import { get, ref } from "firebase/database"

export type AdminRole = "government" | "transport_authority" | "super_admin"

export type AdminSession = {
  adminId: string
  name: string
  role: AdminRole
  department: string
  permissions: string[]
}

const ADMIN_SESSION_KEY = "admin.session"

export function getAdminSession(): AdminSession | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AdminSession
  } catch {
    return null
  }
}

export function setAdminSession(session: AdminSession) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session))
}

export function clearAdminSession() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(ADMIN_SESSION_KEY)
}

export async function validateAdminCredentials(adminId: string, password: string): Promise<AdminSession | null> {
  try {
    const db = getFirebaseDb()
    if (!db) throw new Error("Firebase not configured")

    const adminRef = ref(db, `admins/${adminId}`)
    const snapshot = await get(adminRef)

    if (!snapshot.exists()) {
      return null
    }

    const adminData = snapshot.val()

    // Simple password check (in production, use proper hashing)
    if (adminData.password !== password) {
      return null
    }

    if (adminData.isActive === false) {
      throw new Error("Account is deactivated")
    }

    return {
      adminId: adminId, // Use the key as adminId instead of adminData.adminId
      name: adminData.name,
      role: adminData.role,
      department: adminData.department,
      permissions: adminData.permissions || [],
    }
  } catch (error) {
    console.error("Admin validation error:", error)
    throw error
  }
}

export const PERMISSIONS = {
  // Bus Management
  BUS_VIEW: "bus:view",
  BUS_CREATE: "bus:create",
  BUS_EDIT: "bus:edit",
  BUS_DELETE: "bus:delete",

  // Route Management
  ROUTE_VIEW: "route:view",
  ROUTE_CREATE: "route:create",
  ROUTE_EDIT: "route:edit",
  ROUTE_DELETE: "route:delete",

  // Driver Management
  DRIVER_VIEW: "driver:view",
  DRIVER_CREATE: "driver:create",
  DRIVER_EDIT: "driver:edit",
  DRIVER_DELETE: "driver:delete",

  // Admin Management
  ADMIN_VIEW: "admin:view",
  ADMIN_CREATE: "admin:create",
  ADMIN_EDIT: "admin:edit",
  ADMIN_DELETE: "admin:delete",

  // Analytics & Reports
  ANALYTICS_VIEW: "analytics:view",
  REPORTS_EXPORT: "reports:export",

  // System Settings
  SYSTEM_SETTINGS: "system:settings",
} as const

export const ROLE_PERMISSIONS = {
  government: [
    PERMISSIONS.BUS_VIEW,
    PERMISSIONS.BUS_CREATE,
    PERMISSIONS.BUS_EDIT,
    PERMISSIONS.ROUTE_VIEW,
    PERMISSIONS.ROUTE_CREATE,
    PERMISSIONS.ROUTE_EDIT,
    PERMISSIONS.DRIVER_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  transport_authority: [
    PERMISSIONS.BUS_VIEW,
    PERMISSIONS.BUS_CREATE,
    PERMISSIONS.BUS_EDIT,
    PERMISSIONS.BUS_DELETE,
    PERMISSIONS.ROUTE_VIEW,
    PERMISSIONS.ROUTE_CREATE,
    PERMISSIONS.ROUTE_EDIT,
    PERMISSIONS.ROUTE_DELETE,
    PERMISSIONS.DRIVER_VIEW,
    PERMISSIONS.DRIVER_CREATE,
    PERMISSIONS.DRIVER_EDIT,
    PERMISSIONS.ANALYTICS_VIEW,
    PERMISSIONS.REPORTS_EXPORT,
  ],
  super_admin: Object.values(PERMISSIONS),
} as const

export function hasPermission(session: AdminSession | null, permission: string | string[]): boolean {
  if (!session) return false

  // Super admin has all permissions
  if (session.role === "super_admin") return true

  const permissions = Array.isArray(permission) ? permission : [permission]
  return permissions.every((perm) => session.permissions.includes(perm))
}

export function hasAnyPermission(session: AdminSession | null, permissions: string[]): boolean {
  if (!session) return false
  if (session.role === "super_admin") return true
  return permissions.some((perm) => session.permissions.includes(perm))
}

export function getRolePermissions(role: AdminRole): string[] {
  return ROLE_PERMISSIONS[role] || []
}

export function canAccessPage(session: AdminSession | null, requiredPermissions: string[]): boolean {
  return hasAnyPermission(session, requiredPermissions)
}
