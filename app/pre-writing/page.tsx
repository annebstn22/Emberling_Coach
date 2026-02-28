"use client"

import { Suspense, useEffect } from "react"
import { useRouter } from "next/navigation"
import PreWritingIdeation from "@/components/pre-writing-ideation"
import { useAuth } from "@/components/auth-provider"

function PreWritingPageContent() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <PreWritingIdeation
      user={user}
      onLogout={signOut}
      onBack={() => router.push("/")}
    />
  )
}

export default function PreWritingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <PreWritingPageContent />
    </Suspense>
  )
}

