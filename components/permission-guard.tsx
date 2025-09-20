"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAdminSession, hasPermission, hasAnyPermission, type AdminSession } from "@/lib/admin-auth"

interface PermissionGuardProps {
  children: React.ReactNode
  permissions: string | string[]
  requireAll?: boolean
  fallback?: React.ReactNode
  redirectTo?: string
}

export default function PermissionGuard({
  children,
  permissions,
  requireAll = false,
  fallback,
  redirectTo = "/admin",
}: PermissionGuardProps) {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const adminSession = getAdminSession()
    setSession(adminSession)
    setLoading(false)

    if (!adminSession) {
      router.replace("/admin/login")
      return
    }

    const permArray = Array.isArray(permissions) ? permissions : [permissions]
    const hasAccess = requireAll ? hasPermission(adminSession, permArray) : hasAnyPermission(adminSession, permArray)

    if (!hasAccess && redirectTo) {
      router.replace(redirectTo)
    }
  }, [permissions, requireAll, redirectTo, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  const permArray = Array.isArray(permissions) ? permissions : [permissions]
  const hasAccess = requireAll ? hasPermission(session, permArray) : hasAnyPermission(session, permArray)

  if (!hasAccess) {
    return (
      fallback || (
        <div className="text-center p-8">
          <div className="text-red-600 dark:text-red-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Access Denied</h3>
          <p className="text-gray-600 dark:text-gray-400">You don't have permission to access this feature.</p>
        </div>
      )
    )
  }

  return <>{children}</>
}

// Utility component for conditional rendering based on permissions
export function PermissionCheck({
  children,
  permissions,
  requireAll = false,
  fallback = null,
}: {
  children: React.ReactNode
  permissions: string | string[]
  requireAll?: boolean
  fallback?: React.ReactNode
}) {
  const [session, setSession] = useState<AdminSession | null>(null)

  useEffect(() => {
    setSession(getAdminSession())
  }, [])

  if (!session) return fallback

  const permArray = Array.isArray(permissions) ? permissions : [permissions]
  const hasAccess = requireAll ? hasPermission(session, permArray) : hasAnyPermission(session, permArray)

  return hasAccess ? <>{children}</> : <>{fallback}</>
}
