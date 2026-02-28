"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import IslandOfMisfits from "@/components/island-of-misfits"
import SharedNav from "@/components/shared-nav"
import { useAuth } from "@/components/auth-provider"

export default function IslandPage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <SharedNav activeTool="island" onLogout={signOut} />

      {/* Main Content */}
      <div className="max-w-[640px] mx-auto px-6 py-12">
        <IslandOfMisfits
          user={user}
          onMisfitImport={(idea) => {
            console.log("Restoring misfit idea:", idea)
          }}
        />
      </div>
    </div>
  )
}

