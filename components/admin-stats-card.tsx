"use client"

import type React from "react"

import { useState, useEffect } from "react"

interface StatsCardProps {
  title: string
  value: number | string
  change?: number
  changeType?: "increase" | "decrease"
  icon: React.ReactNode
  color: "blue" | "green" | "purple" | "orange" | "red"
  loading?: boolean
}

export default function AdminStatsCard({
  title,
  value,
  change,
  changeType,
  icon,
  color,
  loading = false,
}: StatsCardProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (typeof value === "number" && !loading) {
      const timer = setTimeout(() => {
        let start = 0
        const end = value
        const duration = 1000
        const increment = end / (duration / 16)

        const counter = setInterval(() => {
          start += increment
          if (start >= end) {
            setDisplayValue(end)
            clearInterval(counter)
          } else {
            setDisplayValue(Math.floor(start))
          }
        }, 16)

        return () => clearInterval(counter)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [value, loading])

  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400",
    green: "bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-400",
    red: "bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400",
  }

  const textColorClasses = {
    blue: "text-blue-600 dark:text-blue-400",
    green: "text-green-600 dark:text-green-400",
    purple: "text-purple-600 dark:text-purple-400",
    orange: "text-orange-600 dark:text-orange-400",
    red: "text-red-600 dark:text-red-400",
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>{icon}</div>
          <div className="ml-4">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
            <div className="flex items-baseline">
              {loading ? (
                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              ) : (
                <p className={`text-2xl font-bold ${textColorClasses[color]}`}>
                  {typeof value === "number" ? displayValue : value}
                </p>
              )}
              {change !== undefined && !loading && (
                <span
                  className={`ml-2 text-sm font-medium ${
                    changeType === "increase" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {changeType === "increase" ? "+" : "-"}
                  {Math.abs(change)}%
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
