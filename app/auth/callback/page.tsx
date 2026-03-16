"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    let redirected = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (redirected) return
      if (event === "SIGNED_IN") {
        redirected = true
        router.replace("/writing-coach")
      } else if (event === "PASSWORD_RECOVERY") {
        redirected = true
        router.replace("/auth/reset")
      }
    })

    // Fallback: if Supabase fires no event within 10s, show an error
    const timeout = setTimeout(() => {
      if (!redirected) setIsError(true)
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [router])

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg, #f7f4ee)" }}
    >
      <div className="text-center">
        {isError ? (
          <>
            <p
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "1.5rem",
                color: "var(--ink, #1a1814)",
                marginBottom: "0.75rem",
              }}
            >
              Link expired or invalid
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.85rem",
                color: "var(--muted, #6b6560)",
                marginBottom: "1.5rem",
              }}
            >
              Please request a new link from the login page.
            </p>
            <button
              onClick={() => router.replace("/")}
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.8rem",
                color: "var(--ink, #1a1814)",
                background: "transparent",
                border: "1px solid var(--border, #e0dbd0)",
                borderRadius: "6px",
                padding: "0.5rem 1.25rem",
                cursor: "pointer",
              }}
            >
              Back to login
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                fontFamily: "var(--font-serif, Georgia, serif)",
                fontSize: "1.5rem",
                color: "var(--ink, #1a1814)",
                marginBottom: "0.5rem",
              }}
            >
              Just a moment…
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.85rem",
                color: "var(--muted, #6b6560)",
              }}
            >
              Verifying your link
            </p>
          </>
        )}
      </div>
    </div>
  )
}
