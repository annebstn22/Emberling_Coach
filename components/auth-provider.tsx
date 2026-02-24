"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Fallback timeout: if loading takes > 5s, show login form anyway (avoids stuck blank/loading)
const LOADING_TIMEOUT_MS = 5000

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false)
      return
    }

    const timeoutId = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn("[Auth] Loading timeout - showing login form")
          return false
        }
        return prev
      })
    }, LOADING_TIMEOUT_MS)

    let subscription: { unsubscribe: () => void } | null = null

    const loadSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user) {
          setUser(session.user)
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error("[Auth] Error loading session:", error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadSession()

    try {
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange((event, session) => {
        console.log("[Logout] Auth state change:", event, "has user:", !!session?.user)
        setUser(session?.user ?? null)
        if (event === "SIGNED_OUT") {
          setUser(null)
        }
      })
      subscription = sub
    } catch (error) {
      console.error("[Auth] Error setting up auth listener:", error)
      setLoading(false)
    }

    return () => {
      clearTimeout(timeoutId)
      subscription?.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    console.log("[Logout] handleLogout called")
    try {
      setUser(null)
      const { error } = await supabase.auth.signOut()
      console.log("[Logout] signOut result:", { error: error?.message ?? null })
      if (error) {
        console.error("[Logout] Error signing out:", error)
      }
      window.location.href = "/"
    } catch (error) {
      console.error("[Logout] Error during logout:", error)
      window.location.href = "/"
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

