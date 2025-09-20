"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { validateAdminCredentials, setAdminSession, getAdminSession } from "@/lib/admin-auth"
import { useLanguage } from "@/lib/language-context"

export default function AdminLoginPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [adminId, setAdminId] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const existingSession = getAdminSession()
    if (existingSession) {
      router.replace("/admin")
    }
  }, [router])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!adminId.trim() || !password.trim()) {
      setError("Please enter both Admin ID and password")
      return
    }

    setLoading(true)
    try {
      const session = await validateAdminCredentials(adminId.trim(), password)
      if (session) {
        setAdminSession(session)
        router.replace("/admin")
      } else {
        setError("Invalid credentials. Please check your Admin ID and password.")
      }
    } catch (err: any) {
      setError(err.message || "Login failed. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Government Admin Portal</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Authorized personnel only</p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <div className="space-y-4">
            <div>
              <label htmlFor="adminId" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Admin ID
              </label>
              <input
                id="adminId"
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="Enter your government admin ID"
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="mt-1 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>

          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            <p>For technical support, contact your IT department</p>
            <p className="mt-1">This system is for authorized government personnel only</p>
          </div>
        </form>
      </div>
    </main>
  )
}
