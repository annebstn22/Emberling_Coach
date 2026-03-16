"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { ArrowRight } from "lucide-react"

function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // The callback page establishes a PASSWORD_RECOVERY session before redirecting here.
    // We also listen in case the user lands directly on this URL with a hash fragment.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true)
        setError("")
      }
    })

    // Check for an existing session (set by the callback page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setReady(true)
      } else {
        // No session yet — wait for the auth state change above.
        // If nothing fires in 8s, the link is invalid/expired.
        const timeout = setTimeout(() => {
          setError("This link has expired or is invalid. Please request a new password reset.")
        }, 8000)
        return () => clearTimeout(timeout)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const isStrongPassword = (p: string) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(p)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!password.trim() || !confirmPassword.trim()) {
      setError("Please fill in all fields")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (!isStrongPassword(password)) {
      setError("Password must be at least 8 characters with a number and a capital letter")
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push("/"), 2500)
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.6rem 0.875rem",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.875rem",
    color: "var(--ink, #1a1814)",
    background: "var(--bg, #f7f4ee)",
    border: "1px solid var(--border, #e0dbd0)",
    borderRadius: "6px",
    outline: "none",
    marginTop: "0.35rem",
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: "0.7rem",
    color: "var(--muted, #6b6560)",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "0.1rem",
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "var(--bg, #f7f4ee)" }}
      >
        <div
          className="w-full max-w-sm text-center p-8 rounded-xl"
          style={{ background: "white", border: "1px solid var(--border, #e0dbd0)" }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif, Georgia, serif)",
              fontSize: "1.5rem",
              color: "var(--ink, #1a1814)",
              marginBottom: "0.5rem",
            }}
          >
            Password updated
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.8rem",
              color: "var(--muted, #6b6560)",
            }}
          >
            Redirecting you to login…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg, #f7f4ee)" }}
    >
      <div
        className="w-full max-w-sm p-8 rounded-xl"
        style={{ background: "white", border: "1px solid var(--border, #e0dbd0)" }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif, Georgia, serif)",
            fontSize: "1.6rem",
            fontWeight: 400,
            color: "var(--ink, #1a1814)",
            marginBottom: "0.25rem",
          }}
        >
          Choose a new password
        </p>
        <p
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.8rem",
            color: "var(--muted, #6b6560)",
            marginBottom: "1.75rem",
          }}
        >
          Enter and confirm your new password below.
        </p>

        {error && !ready && (
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.8rem",
              color: "#b85c38",
              background: "#fdf0eb",
              border: "1px solid #f0c4b0",
              borderRadius: "6px",
              padding: "0.65rem 0.875rem",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {!ready && !error && (
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.8rem",
              color: "var(--muted, #6b6560)",
              marginBottom: "1rem",
            }}
          >
            Verifying reset link…
          </p>
        )}

        {ready && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="password" style={labelStyle}>
                New password
              </label>
              <input
                id="password"
                type="password"
                placeholder="At least 8 chars, 1 number, 1 capital"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" style={labelStyle}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Repeat your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {error && (
              <p
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.8rem",
                  color: "#b85c38",
                  textAlign: "center",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "0.7rem 1rem",
                marginTop: "0.5rem",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.875rem",
                color: "var(--bg, #f7f4ee)",
                background: "var(--ink, #1a1814)",
                border: "none",
                borderRadius: "6px",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              <ArrowRight size={15} />
              {loading ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.78rem",
              color: "var(--muted, #6b6560)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{ background: "var(--bg, #f7f4ee)" }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.875rem",
              color: "var(--muted, #6b6560)",
            }}
          >
            Loading…
          </p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
