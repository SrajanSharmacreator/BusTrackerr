// Network optimization utilities for low bandwidth scenarios
export type NetworkType = "slow-2g" | "2g" | "3g" | "4g" | "unknown"
export type ConnectionQuality = "poor" | "good" | "excellent"

export interface NetworkInfo {
  type: NetworkType
  quality: ConnectionQuality
  effectiveType: string
  downlink: number
  rtt: number
}

export interface OptimizationSettings {
  updateInterval: number
  dataCompression: boolean
  reducedPayload: boolean
  batchUpdates: boolean
  maxRetries: number
}

// Detect network connection quality
export function getNetworkInfo(): NetworkInfo {
  if (typeof navigator === "undefined" || !("connection" in navigator)) {
    return {
      type: "unknown",
      quality: "good",
      effectiveType: "unknown",
      downlink: 10,
      rtt: 100,
    }
  }

  const connection = (navigator as any).connection
  const effectiveType = connection.effectiveType || "unknown"
  const downlink = connection.downlink || 10
  const rtt = connection.rtt || 100

  let type: NetworkType = "unknown"
  let quality: ConnectionQuality = "good"

  switch (effectiveType) {
    case "slow-2g":
      type = "slow-2g"
      quality = "poor"
      break
    case "2g":
      type = "2g"
      quality = "poor"
      break
    case "3g":
      type = "3g"
      quality = downlink < 1.5 ? "poor" : "good"
      break
    case "4g":
      type = "4g"
      quality = downlink < 5 ? "good" : "excellent"
      break
    default:
      type = "unknown"
      quality = "good"
  }

  // Adjust quality based on RTT
  if (rtt > 2000) quality = "poor"
  else if (rtt > 1000 && quality !== "poor") quality = "good"

  return { type, quality, effectiveType, downlink, rtt }
}

// Get optimization settings based on network quality
export function getOptimizationSettings(networkInfo: NetworkInfo): OptimizationSettings {
  switch (networkInfo.quality) {
    case "poor":
      return {
        updateInterval: 50000, // 50 seconds for slow networks
        dataCompression: true,
        reducedPayload: true,
        batchUpdates: true,
        maxRetries: 2,
      }
    case "good":
      return {
        updateInterval: 15000, // 15 seconds for good networks
        dataCompression: true,
        reducedPayload: false,
        batchUpdates: false,
        maxRetries: 3,
      }
    case "excellent":
      return {
        updateInterval: 5000, // 5 seconds for excellent networks
        dataCompression: false,
        reducedPayload: false,
        batchUpdates: false,
        maxRetries: 3,
      }
  }
}

// Compress bus data for transmission
export function compressBusData(busData: any): any {
  if (!busData) return null

  // Remove unnecessary fields and round coordinates
  return {
    id: busData.busId,
    lat: Math.round(busData.lat * 1000000) / 1000000, // 6 decimal places
    lon: Math.round(busData.lon * 1000000) / 1000000,
    spd: busData.speed ? Math.round(busData.speed) : null,
    hdg: busData.heading ? Math.round(busData.heading) : null,
    sts: busData.status?.substring(0, 10) || "unknown", // Truncate status
    upd: busData.updatedAt || Date.now(),
  }
}

// Decompress bus data after receiving
export function decompressBusData(compressedData: any): any {
  if (!compressedData) return null

  return {
    busId: compressedData.id,
    lat: compressedData.lat,
    lon: compressedData.lon,
    speed: compressedData.spd,
    heading: compressedData.hdg,
    status: compressedData.sts,
    updatedAt: compressedData.upd,
  }
}

// Retry mechanism with exponential backoff
export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries: number, baseDelay = 1000): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

// Monitor network changes
export function createNetworkMonitor(callback: (networkInfo: NetworkInfo) => void): () => void {
  if (typeof navigator === "undefined" || !("connection" in navigator)) {
    return () => {} // No-op cleanup function
  }

  const connection = (navigator as any).connection

  const handleChange = () => {
    callback(getNetworkInfo())
  }

  connection.addEventListener("change", handleChange)

  // Initial call
  handleChange()

  // Return cleanup function
  return () => {
    connection.removeEventListener("change", handleChange)
  }
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export class DataCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private maxSize: number

  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  set(key: string, data: T, ttl = 300000): void {
    // 5 minutes default TTL
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  size(): number {
    return this.cache.size
  }
}

export function compressAdminData(data: any): any {
  if (!data) return null

  // Compress different types of admin data
  if (Array.isArray(data)) {
    return data.map((item) => compressAdminData(item))
  }

  if (typeof data === "object") {
    const compressed: any = {}

    // Common field mappings for compression
    const fieldMappings: Record<string, string> = {
      busNumber: "bn",
      capacity: "cap",
      model: "mdl",
      year: "yr",
      status: "sts",
      routeName: "rn",
      startPoint: "sp",
      endPoint: "ep",
      distance: "dst",
      estimatedTime: "et",
      fare: "fr",
      operatingHours: "oh",
      stops: "stp",
      latitude: "lat",
      longitude: "lon",
      createdAt: "ca",
      updatedAt: "ua",
      lastMaintenance: "lm",
      nextMaintenance: "nm",
    }

    for (const [key, value] of Object.entries(data)) {
      const compressedKey = fieldMappings[key] || key

      // Skip null/undefined values to reduce payload
      if (value != null) {
        if (typeof value === "string" && value.length > 50) {
          // Truncate long strings for reduced payload
          compressed[compressedKey] = value.substring(0, 50) + "..."
        } else if (typeof value === "number") {
          // Round numbers to reduce precision
          compressed[compressedKey] = Math.round(value * 100) / 100
        } else {
          compressed[compressedKey] = compressAdminData(value)
        }
      }
    }

    return compressed
  }

  return data
}

export function decompressAdminData(compressedData: any): any {
  if (!compressedData) return null

  if (Array.isArray(compressedData)) {
    return compressedData.map((item) => decompressAdminData(item))
  }

  if (typeof compressedData === "object") {
    const decompressed: any = {}

    // Reverse field mappings for decompression
    const fieldMappings: Record<string, string> = {
      bn: "busNumber",
      cap: "capacity",
      mdl: "model",
      yr: "year",
      sts: "status",
      rn: "routeName",
      sp: "startPoint",
      ep: "endPoint",
      dst: "distance",
      et: "estimatedTime",
      fr: "fare",
      oh: "operatingHours",
      stp: "stops",
      lat: "latitude",
      lon: "longitude",
      ca: "createdAt",
      ua: "updatedAt",
      lm: "lastMaintenance",
      nm: "nextMaintenance",
    }

    for (const [key, value] of Object.entries(compressedData)) {
      const originalKey = fieldMappings[key] || key
      decompressed[originalKey] = decompressAdminData(value)
    }

    return decompressed
  }

  return compressedData
}

export class ProgressiveLoader<T> {
  private pageSize: number
  private cache: DataCache<T[]>

  constructor(pageSize = 10) {
    this.pageSize = pageSize
    this.cache = new DataCache<T[]>()
  }

  async loadPage(
    loadFn: (offset: number, limit: number) => Promise<T[]>,
    page: number,
    networkQuality: ConnectionQuality,
  ): Promise<T[]> {
    const cacheKey = `page_${page}`
    const cached = this.cache.get(cacheKey)

    if (cached) {
      return cached
    }

    // Adjust page size based on network quality
    const adjustedPageSize = networkQuality === "poor" ? Math.max(3, Math.floor(this.pageSize / 2)) : this.pageSize

    const offset = page * adjustedPageSize
    const data = await loadFn(offset, adjustedPageSize)

    // Cache with shorter TTL for poor networks
    const ttl = networkQuality === "poor" ? 600000 : 300000 // 10min vs 5min
    this.cache.set(cacheKey, data, ttl)

    return data
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export class BatchUpdateManager {
  private pendingUpdates: Map<string, any> = new Map()
  private batchTimeout: NodeJS.Timeout | null = null
  private batchDelay: number

  constructor(batchDelay = 2000) {
    this.batchDelay = batchDelay
  }

  addUpdate(key: string, data: any): void {
    this.pendingUpdates.set(key, data)

    // Reset batch timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
    }

    this.batchTimeout = setTimeout(() => {
      this.processBatch()
    }, this.batchDelay)
  }

  private async processBatch(): Promise<void> {
    if (this.pendingUpdates.size === 0) return

    const updates = Array.from(this.pendingUpdates.entries())
    this.pendingUpdates.clear()
    this.batchTimeout = null

    try {
      // Process all updates in a single batch
      await this.sendBatchUpdate(updates)
    } catch (error) {
      console.error("Batch update failed:", error)
      // Re-queue failed updates
      updates.forEach(([key, data]) => {
        this.pendingUpdates.set(key, data)
      })
    }
  }

  private async sendBatchUpdate(updates: [string, any][]): Promise<void> {
    // Implementation would send batched updates to server
    console.log(`[v0] Processing batch update with ${updates.length} items`)
  }

  flush(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.processBatch()
    }
  }
}

export class OfflineManager {
  private isOnline: boolean = navigator.onLine
  private offlineQueue: Array<{ key: string; data: any; timestamp: number }> = []
  private maxQueueSize: number

  constructor(maxQueueSize = 50) {
    this.maxQueueSize = maxQueueSize
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    if (typeof window !== "undefined") {
        window.addEventListener("online", () => {
            this.isOnline = true
            this.processOfflineQueue()
        })

        window.addEventListener("offline", () => {
            this.isOnline = false
        })
    }
}


  queueUpdate(key: string, data: any): void {
    if (this.isOnline) return

    // Remove oldest items if queue is full
    while (this.offlineQueue.length >= this.maxQueueSize) {
      this.offlineQueue.shift()
    }

    this.offlineQueue.push({
      key,
      data,
      timestamp: Date.now(),
    })
  }

  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return

    console.log(`[v0] Processing ${this.offlineQueue.length} offline updates`)

    const queue = [...this.offlineQueue]
    this.offlineQueue = []

    try {
      // Process queued updates
      for (const item of queue) {
        // Skip items older than 1 hour
        if (Date.now() - item.timestamp > 3600000) continue

        // Process individual update
        await this.processQueuedUpdate(item)
      }
    } catch (error) {
      console.error("Failed to process offline queue:", error)
      // Re-queue failed items
      this.offlineQueue.unshift(...queue)
    }
  }

  private async processQueuedUpdate(item: { key: string; data: any; timestamp: number }): Promise<void> {
    // Implementation would process individual queued update
    console.log(`[v0] Processing queued update for ${item.key}`)
  }

  getQueueSize(): number {
    return this.offlineQueue.length
  }

  isOffline(): boolean {
    return !this.isOnline
  }
}

export class SmartPrefetcher {
  private accessPatterns: Map<string, number> = new Map()
  private prefetchCache: DataCache<any>

  constructor() {
    this.prefetchCache = new DataCache(50)
  }

  recordAccess(resource: string): void {
    const count = this.accessPatterns.get(resource) || 0
    this.accessPatterns.set(resource, count + 1)
  }

  async prefetchLikelyResources(
    loadFn: (resource: string) => Promise<any>,
    networkQuality: ConnectionQuality,
  ): Promise<void> {
    // Only prefetch on good networks
    if (networkQuality === "poor") return

    // Get most accessed resources
    const sortedResources = Array.from(this.accessPatterns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Top 5 resources

    for (const [resource] of sortedResources) {
      if (!this.prefetchCache.get(resource)) {
        try {
          const data = await loadFn(resource)
          this.prefetchCache.set(resource, data)
        } catch (error) {
          console.warn(`Failed to prefetch ${resource}:`, error)
        }
      }
    }
  }

  getPrefetched(resource: string): any {
    return this.prefetchCache.get(resource)
  }

  clearPrefetchCache(): void {
    this.prefetchCache.clear()
  }
}

export const globalDataCache = new DataCache(200)
export const globalBatchManager = new BatchUpdateManager(3000)
export const globalOfflineManager = new OfflineManager(100)
export const globalPrefetcher = new SmartPrefetcher()
