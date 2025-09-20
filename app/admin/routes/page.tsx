"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAdminSession, type AdminSession, PERMISSIONS } from "@/lib/admin-auth"
import { getFirebaseDb } from "@/lib/firebase"
import { ref, push, set, remove, onValue } from "firebase/database"
import AdminSidebar from "@/components/admin-sidebar"
import PermissionGuard, { PermissionCheck } from "@/components/permission-guard"

interface BusStop {
  id: string
  name: string
  latitude: number
  longitude: number
  order: number
}

interface Route {
  id: string
  routeName: string
  startPoint: string
  endPoint: string
  distance: number
  estimatedTime: number
  fare: number
  stops: BusStop[]
  status: "active" | "inactive"
  operatingHours: {
    start: string
    end: string
  }
}

export default function RouteManagementPage() {
  const router = useRouter()
  const [session, setSession] = useState<AdminSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [routes, setRoutes] = useState<Route[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [formData, setFormData] = useState({
    routeName: "",
    startPoint: "",
    endPoint: "",
    distance: "",
    estimatedTime: "",
    fare: "",
    status: "active" as Route["status"],
    operatingStart: "",
    operatingEnd: "",
  })
  const [stops, setStops] = useState<Omit<BusStop, "id">[]>([])

  useEffect(() => {
    const adminSession = getAdminSession()
    if (!adminSession) {
      router.replace("/admin/login")
      return
    }
    setSession(adminSession)
    setLoading(false)

    // Load routes from Firebase
    const db = getFirebaseDb()
    if (db) {
      const routesRef = ref(db, "routes")
      const unsubscribe = onValue(routesRef, (snapshot) => {
        const data = snapshot.val()
        if (data) {
          const routeList = Object.entries(data).map(([id, route]: [string, any]) => ({
            id,
            ...route,
          }))
          setRoutes(routeList)
        } else {
          setRoutes([])
        }
      })

      return () => unsubscribe()
    }
  }, [router])

  function addStop() {
    setStops([...stops, { name: "", latitude: 0, longitude: 0, order: stops.length + 1 }])
  }

  function removeStop(index: number) {
    setStops(stops.filter((_, i) => i !== index))
  }

  function updateStop(index: number, field: keyof Omit<BusStop, "id">, value: string | number) {
    const updatedStops = [...stops]
    updatedStops[index] = { ...updatedStops[index], [field]: value }
    setStops(updatedStops)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const db = getFirebaseDb()
    if (!db) return

    const routeData = {
      routeName: formData.routeName,
      startPoint: formData.startPoint,
      endPoint: formData.endPoint,
      distance: Number.parseFloat(formData.distance),
      estimatedTime: Number.parseInt(formData.estimatedTime),
      fare: Number.parseFloat(formData.fare),
      status: formData.status,
      operatingHours: {
        start: formData.operatingStart,
        end: formData.operatingEnd,
      },
      stops: stops.map((stop, index) => ({
        ...stop,
        id: `stop_${index + 1}`,
        order: index + 1,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    try {
      if (editingRoute) {
        await set(ref(db, `routes/${editingRoute.id}`), {
          ...routeData,
          createdAt: editingRoute.id,
        })
      } else {
        await push(ref(db, "routes"), routeData)
      }

      // Reset form
      setFormData({
        routeName: "",
        startPoint: "",
        endPoint: "",
        distance: "",
        estimatedTime: "",
        fare: "",
        status: "active",
        operatingStart: "",
        operatingEnd: "",
      })
      setStops([])
      setShowAddForm(false)
      setEditingRoute(null)
    } catch (error) {
      console.error("Error saving route:", error)
    }
  }

  async function handleDelete(routeId: string) {
    if (!confirm("Are you sure you want to delete this route?")) return

    const db = getFirebaseDb()
    if (!db) return

    try {
      await remove(ref(db, `routes/${routeId}`))
    } catch (error) {
      console.error("Error deleting route:", error)
    }
  }

  function handleEdit(route: Route) {
    setEditingRoute(route)
    setFormData({
      routeName: route.routeName,
      startPoint: route.startPoint,
      endPoint: route.endPoint,
      distance: route.distance.toString(),
      estimatedTime: route.estimatedTime.toString(),
      fare: route.fare.toString(),
      status: route.status,
      operatingStart: route.operatingHours.start,
      operatingEnd: route.operatingHours.end,
    })
    setStops(
      route.stops.map((stop) => ({
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
        order: stop.order,
      })),
    )
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
    <PermissionGuard permissions={[PERMISSIONS.ROUTE_VIEW]}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
        <AdminSidebar session={session} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Route Management</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Configure bus routes, stops, and schedules</p>
                </div>
                <PermissionCheck permissions={PERMISSIONS.ROUTE_CREATE}>
                  <button
                    onClick={() => {
                      setShowAddForm(true)
                      setEditingRoute(null)
                      setFormData({
                        routeName: "",
                        startPoint: "",
                        endPoint: "",
                        distance: "",
                        estimatedTime: "",
                        fare: "",
                        status: "active",
                        operatingStart: "",
                        operatingEnd: "",
                      })
                      setStops([])
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    <span>Add New Route</span>
                  </button>
                </PermissionCheck>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            {/* Add/Edit Form Modal */}
            {showAddForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editingRoute ? "Edit Route" : "Add New Route"}
                    </h3>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Route Info */}
                    <div className="space-y-4">
                      <h4 className="text-md font-medium text-gray-900 dark:text-white">Route Information</h4>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Route Name
                        </label>
                        <input
                          type="text"
                          value={formData.routeName}
                          onChange={(e) => setFormData({ ...formData, routeName: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="e.g., Jabalpur to Mandla"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Start Point
                          </label>
                          <input
                            type="text"
                            value={formData.startPoint}
                            onChange={(e) => setFormData({ ...formData, startPoint: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Jabalpur Bus Stand"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            End Point
                          </label>
                          <input
                            type="text"
                            value={formData.endPoint}
                            onChange={(e) => setFormData({ ...formData, endPoint: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="Mandla Bus Stand"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Distance (km)
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={formData.distance}
                            onChange={(e) => setFormData({ ...formData, distance: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="85.5"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Est. Time (min)
                          </label>
                          <input
                            type="number"
                            value={formData.estimatedTime}
                            onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="120"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Fare (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.fare}
                            onChange={(e) => setFormData({ ...formData, fare: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            placeholder="45.00"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Status
                          </label>
                          <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as Route["status"] })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={formData.operatingStart}
                            onChange={(e) => setFormData({ ...formData, operatingStart: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={formData.operatingEnd}
                            onChange={(e) => setFormData({ ...formData, operatingEnd: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            required
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bus Stops */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-medium text-gray-900 dark:text-white">Bus Stops</h4>
                        <button
                          type="button"
                          onClick={addStop}
                          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md"
                        >
                          Add Stop
                        </button>
                      </div>

                      {stops.map((stop, index) => (
                        <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-md p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Stop {index + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeStop(index)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Remove
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <input
                                type="text"
                                value={stop.name}
                                onChange={(e) => updateStop(index, "name", e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="Stop name"
                                required
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                step="0.000001"
                                value={stop.latitude}
                                onChange={(e) => updateStop(index, "latitude", Number.parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="Latitude"
                                required
                              />
                            </div>
                            <div>
                              <input
                                type="number"
                                step="0.000001"
                                value={stop.longitude}
                                onChange={(e) => updateStop(index, "longitude", Number.parseFloat(e.target.value) || 0)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                                placeholder="Longitude"
                                required
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {stops.length === 0 && (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <p className="text-sm">No stops added yet. Click "Add Stop" to get started.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false)
                          setEditingRoute(null)
                          setStops([])
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                      >
                        {editingRoute ? "Update Route" : "Add Route"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Routes List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Routes ({routes.length})</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Route
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Distance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Fare
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Stops
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {routes.map((route) => (
                      <tr key={route.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{route.routeName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                              {route.startPoint} → {route.endPoint}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {route.distance} km
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {route.estimatedTime} min
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          ₹{route.fare}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                          {route.stops.length} stops
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              route.status === "active"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}
                          >
                            {route.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <PermissionCheck permissions={PERMISSIONS.ROUTE_EDIT}>
                            <button
                              onClick={() => handleEdit(route)}
                              className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            >
                              Edit
                            </button>
                          </PermissionCheck>
                          <PermissionCheck permissions={PERMISSIONS.ROUTE_DELETE}>
                            <button
                              onClick={() => handleDelete(route.id)}
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

                {routes.length === 0 && (
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
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No routes</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by adding a new route.</p>
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
