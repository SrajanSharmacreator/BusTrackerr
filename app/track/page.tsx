import UserTracker from "@/components/user-tracker"

export const metadata = {
  title: "Track | Bus Tracker",
  description:
    "Track city buses in real time by Bus Number or PNR. Optimized for low bandwidth with text-only fallback.",
}

export default function TrackPage() {
  return (
    <main className="min-h-[70vh] p-4">
      <UserTracker />
    </main>
  )
}
