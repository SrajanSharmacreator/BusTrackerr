"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAdminSession, type AdminSession, PERMISSIONS } from "@/lib/admin-auth"
import { getFirebaseDb } from "@/lib/firebase"
import { ref, push, set, remove, onValue } from "firebase/database"
import AdminSidebar from "@/components/admin-sidebar"
import PermissionGuard, { PermissionCheck } from "@/components/permission-guard"

interface Bus {
  id: string
  busNumber: string
  capacity: number
  model: string
  year: number
  status: "active" | "maintenance" | "inactive"
  routeId?: string
  driverId?: string
  lastMaintenance: string
  nextMaintenance: string
}

export default function BusManagementPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [buses, setBuses] = useState<Bus[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingBus, setEditingBus] = useState<Bus | null>(null)
  const [formData, setFormData] = useState({
    busNumber: "",
    capacity: "",
    model: "",
    year: "",
    status: "active" as Bus["status"],
    lastMaintenance: "",
    nextMaintenance: "",
  })

  useEffect(() => {
    const adminSession = getAdminSession()
    if (!adminSession) {
      router.replace("/admin/login")
      return
    }
    setSession(adminSession)
    setLoading(false)

    // Load buses from Firebase
    const db = getFirebaseDb()
    if (db) {
      const busesRef = ref(db, "buses")
      const unsubscribe = onValue(busesRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          const busList = Object.entries(data).map(([id, bus]: [string, any]) => ({
            id,
            ...bus,
          }))
          setBuses(busList)
        } else {
          setBuses([])
        }
      })

      return () => unsubscribe()
    }
  }, [router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const db = getFirebaseDb()
    if (!db) return

    const busData = {
      busNumber: formData.busNumber,
      capacity: Number.parseInt(formData.capacity),
      model: formData.model,
      year: Number.parseInt(formData.year),
      status: formData.status,
      lastMaintenance: formData.lastMaintenance,
      nextMaintenance: formData.nextMaintenance,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editingBus) {
        // Update existing bus
        await set(ref(db, `buses/${editingBus.id}`), {
          ...busData,
          createdAt: editingBus.id, // Keep original creation time
        })
      } else {
        // Add new bus
        await push(ref(db, "buses"), busData)
      }

      // Reset form
      setFormData({
        busNumber: "",
        capacity: "",
        model: "",
        year: "",
        status: "active",
        lastMaintenance: "",
        nextMaintenance: "",
      })
      setShowAddForm(false)
      setEditingBus(null)
    } catch (error) {
      console.error("Error saving bus:", error)
    }
  }

  async function handleDelete(busId: string) {
    if (!confirm("Are you sure you want to delete this bus?")) return

    const db = getFirebaseDb()
    if (!db) return

    try {
      await remove(ref(db, `buses/${busId}`))
    } catch (error) {
      console.error("Error deleting bus:", error)
    }
  }

  function handleEdit(bus: Bus) {
    setEditingBus(bus)
    setFormData({
      busNumber: bus.busNumber,
      capacity: bus.capacity.toString(),
      model: bus.model,
      year: bus.year.toString(),
      status: bus.status,
      lastMaintenance: bus.lastMaintenance,
      nextMaintenance: bus.nextMaintenance,
    })
    setShowAddForm(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <PermissionGuard permissions={[PERMISSIONS.BUS_VIEW]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <AdminSidebar session={session} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bus Management</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Manage your bus fleet and vehicle information
                  </p>
                </div>
                <PermissionCheck permissions={PERMISSIONS.BUS_CREATE}>
                  <button
                    onClick={() => {
                      setShowAddForm(true)
                      setEditingBus(null)
                      setFormData({
                        busNumber: "",
                        capacity: "",
                        model: "",
                        year: "",
                        status: "active",
                        lastMaintenance: "",
                        nextMaintenance: "",
                      })
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <span>Add New Bus</span>
                  </button>
                </PermissionCheck>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            {/* Add/Edit Form Modal */}
            {showAddForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingBus ? "Edit Bus" : "Add New Bus"}
                    </h3>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Bus Number
                      </label>
                      <input
                        type="text"
                        value={formData.busNumber}
                        onChange={(e) => setFormData({ ...formData, busNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="e.g., JBP-001"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Capacity
                        </label>
                        <input
                          type="number"
                          value={formData.capacity}
                          onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="50"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year</label>
                        <input
                          type="number"
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="2023"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model</label>
                      <input
                        type="text"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        placeholder="Tata Starbus"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as Bus["status"] })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="active">Active</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Last Maintenance
                        </label>
                        <input
                          type="date"
                          value={formData.lastMaintenance}
                          onChange={(e) => setFormData({ ...formData, lastMaintenance: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Next Maintenance
                        </label>
                        <input
                          type="date"
                          value={formData.nextMaintenance}
                          onChange={(e) => setFormData({ ...formData, nextMaintenance: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false)
                          setEditingBus(null)
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                      >
                        {editingBus ? "Update Bus" : "Add Bus"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Bus List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bus Fleet ({buses.length})</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Bus Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Model
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Capacity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Next Maintenance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {buses.map((bus) => (
                      <tr key={bus.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {bus.busNumber}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {bus.model} ({bus.year})
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {bus.capacity} seats
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              bus.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : bus.status === "maintenance"
                                  ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                  : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}
                          >
                            {bus.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {bus.nextMaintenance || "Not scheduled"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <PermissionCheck permissions={PERMISSIONS.BUS_EDIT}>
                            <button
                              onClick={() => handleEdit(bus)}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              Edit
                            </button>
                          </PermissionCheck>
                          <PermissionCheck permissions={PERMISSIONS.BUS_DELETE}>
                            <button
                              onClick={() => handleDelete(bus.id)}
                              className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </PermissionCheck>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {buses.length === 0 && (
                  <div className="text-center py-12">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2v0a2 2 0 01-2-2v-2a2 2 0 00-2-2H8z"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No buses</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Get started by adding a new bus to your fleet.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </PermissionGuard>
  )
}
