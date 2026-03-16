"use client"

import type React from "react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, FileText, Lightbulb, LogIn, LogOut, UserPlus } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"

export default function HomePage() {
  const { user, loading, signOut } = useAuth()
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [authError, setAuthError] = useState("")
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [confirmationPending, setConfirmationPending] = useState(false)
  const [resendSent, setResendSent] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const isStrongPassword = (p: string) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(p)

  const startCooldown = () => {
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    setResendCooldown(60)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!)
          cooldownRef.current = null
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const clearConfirmation = () => {
    setConfirmationPending(false)
    setResendSent(false)
    setResendCooldown(0)
    if (cooldownRef.current) { clearInterval(cooldownRef.current); cooldownRef.current = null }
  }

  const handleResendConfirmation = async () => {
    setAuthError("")
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
      },
    })
    if (error) {
      setAuthError(error.message)
      return
    }
    setResendSent(true)
    startCooldown()
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    if (authMode === "signup") {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setAuthError("Please fill in all fields")
        return
      }
      if (!isStrongPassword(password)) {
        setAuthError("Password must be at least 8 characters with a number and capital letter")
        return
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
        },
      })
      if (error) {
        setAuthError(
          error.message.toLowerCase().includes("already") ? "User with this email already exists" : error.message
        )
        return
      }
      if (data.user) {
        // Keep email in state for the resend screen. Clear the rest.
        setPassword("")
        setName("")
        setConfirmationPending(true)
        startCooldown() // Initial confirmation email already sent — enforce 60s before resend
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setAuthError("Please fill in all fields")
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.toLowerCase().includes("email not confirmed")) {
          // Whether the link is expired or not, resend() always issues a fresh one
          setConfirmationPending(true)
        } else {
          setAuthError(error.message || "Invalid email or password")
        }
        return
      }
      if (data.user) {
        setEmail("")
        setPassword("")
      }
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")
    setResetEmailSent(false)
    if (!email.trim()) {
      setAuthError("Please enter your email address")
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback`,
    })
    if (error) {
      setAuthError(error.message)
      return
    }
    setResetEmailSent(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    if (confirmationPending) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
          <Card className="w-full max-w-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-light" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
                Check your inbox
              </CardTitle>
              <p className="mt-2" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
                We sent a confirmation link to
              </p>
              <p className="mt-1" style={{ color: 'var(--ink)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', fontWeight: 600 }}>
                {email}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              {authError && (
                <div className="text-sm" style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{authError}</div>
              )}
              {resendSent ? (
                <div className="text-sm rounded p-3" style={{ color: 'var(--green)', background: 'var(--green-bg)', border: '1px solid var(--green-bdr)', fontFamily: 'var(--font-mono)' }}>
                  Confirmation email sent again!
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  Click the link in the email to confirm your account. Not in your inbox? Check spam, or resend below.
                </p>
              )}
              {resendCooldown > 0 ? (
                <p className="text-sm" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                  Resend available in {resendCooldown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.875rem',
                    color: 'var(--bg)',
                    background: 'var(--ink)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1.25rem',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  {resendSent ? "Resend again" : "Resend confirmation email"}
                </button>
              )}
              <button
                type="button"
                onClick={() => { clearConfirmation(); setAuthMode("login"); setAuthError("") }}
                className="text-sm block w-full"
                style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Back to login
              </button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
        <Card className="w-full max-w-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-light" style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink)' }}>
              {authMode === "login"
                ? "Welcome Back"
                : authMode === "reset"
                  ? "Reset Password"
                  : "Create Account"}
            </CardTitle>
            <p className="mt-2" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
              {authMode === "login"
                ? "Sign in to your writing coach account"
                : authMode === "reset"
                  ? "Enter your email to receive a password reset link"
                  : "Join the writing coach community"}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={authMode === "reset" ? handleResetPassword : handleAuth} className="space-y-4">
              {authMode === "signup" && (
                <div>
                  <Label htmlFor="name" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-1"
                    style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', borderColor: 'var(--border)' }}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1"
                  style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', borderColor: 'var(--border)' }}
                />
              </div>
              {authMode !== "reset" && (
                <div>
                  <Label htmlFor="password" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-1"
                    style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface)', borderColor: 'var(--border)' }}
                  />
                  {authMode === "signup" && (
                    <p className="text-xs mt-1" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                      Must be at least 8 characters with a number and capital letter
                    </p>
                  )}
                </div>
              )}
              {authError && <div className="text-sm text-center" style={{ color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>{authError}</div>}
              {resetEmailSent && (
                <div className="text-sm text-center rounded p-3" style={{ color: 'var(--green)', background: 'var(--green-bg)', borderColor: 'var(--green-bdr)', border: '1px solid', fontFamily: 'var(--font-mono)' }}>
                  Password reset email sent! Check your inbox.
                </div>
              )}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                style={{ 
                  background: 'var(--ink)', 
                  color: 'var(--bg)', 
                  border: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.875rem'
                }}
              >
                {authMode === "login" ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign In
                  </>
                ) : authMode === "reset" ? (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Send Reset Link
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </form>
            <div className="mt-4 space-y-2 text-center">
              {authMode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("reset")
                    setAuthError("")
                    setResetEmailSent(false)
                  }}
                  className="text-sm block w-full"
                  style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}
                >
                  Forgot password?
                </button>
              )}
              {authMode === "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login")
                    setAuthError("")
                    setResetEmailSent(false)
                  }}
                  className="text-sm block w-full"
                  style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}
                >
                  Back to login
                </button>
              )}
              {authMode !== "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "signup" : "login")
                    setAuthError("")
                    setResetEmailSent(false)
                  }}
                  className="text-sm"
                  style={{ color: 'var(--blue)', fontFamily: 'var(--font-mono)' }}
                >
                  {authMode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ 
        background: '#0c0b09',
        padding: '3rem 1.5rem'
      }}
    >
      {/* Radial gradient effect */}
      <div 
        className="absolute top-0 left-1/2 transform -translate-x-1/2 pointer-events-none"
        style={{
          width: '900px',
          height: '500px',
          background: 'radial-gradient(ellipse, #1f1a0e 0%, transparent 68%)',
          marginTop: '-100px'
        }}
      />
      
      <div className="max-w-[860px] w-full relative z-10">
        <div className="text-center mb-12">
          <div className="text-xs uppercase tracking-wider mb-3" style={{ color: '#5a5650', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em' }}>
            A writing toolkit
          </div>
          <h1 
            className="text-center mb-2"
            style={{ 
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.8rem, 7vw, 5rem)',
              fontWeight: 300,
              color: '#f5f0e8',
              letterSpacing: '-0.02em',
              lineHeight: 1
            }}
          >
            <em>Emberling</em>
          </h1>
          <p 
            className="text-center mb-12"
            style={{ 
              fontSize: '0.8rem',
              color: '#5a5650',
              letterSpacing: '0.04em',
              fontFamily: 'var(--font-mono)'
            }}
          >
            Think it. Order it. Write it.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Ideation Card */}
          <Link href="/pre-writing" className="group cursor-pointer block">
            <div 
              className="rounded-2xl p-7 transition-all flex flex-col relative overflow-hidden h-full"
              style={{
                background: '#141310',
                border: '1px solid #2a2720',
                borderRadius: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 50px rgba(0,0,0,.6)'
                e.currentTarget.style.borderColor = '#6b5820'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#2a2720'
              }}
            >
              <div 
                className="mb-5"
                style={{ 
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '1.15rem',
                  color: '#7a7268',
                  lineHeight: 1.4,
                  minHeight: '3.5rem'
                }}
              >
                "I have a blank page and no idea where to start."
              </div>
              <div className="w-6 h-px mb-5" style={{ background: '#c9a84c' }} />
              <div 
                className="mb-2"
                style={{ 
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#c9a84c',
                  lineHeight: 1.1
                }}
              >
                💡 Ideation
              </div>
              <div 
                className="mb-5 flex-1"
                style={{ 
                  fontSize: '0.75rem',
                  color: '#5a5650',
                  lineHeight: 1.55,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Divergent thinking cards push you past the obvious. Dump every thought, then let pairwise comparison surface your strongest ideas.
              </div>
              <div 
                className="flex items-center gap-2 mt-5"
                style={{ 
                  fontSize: '0.72rem',
                  color: '#c9a84c',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  transition: 'gap 0.2s'
                }}
              >
                Start thinking <span>→</span>
              </div>
            </div>
          </Link>

          {/* Threader Card */}
          <Link href="/threader" className="group cursor-pointer block">
            <div 
              className="rounded-2xl p-7 transition-all flex flex-col relative overflow-hidden h-full"
              style={{
                background: '#141310',
                border: '1px solid #2a2720',
                borderRadius: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 50px rgba(0,0,0,.6)'
                e.currentTarget.style.borderColor = '#2d5a7a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#2a2720'
              }}
            >
              <div 
                className="mb-5"
                style={{ 
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '1.15rem',
                  color: '#7a7268',
                  lineHeight: 1.4,
                  minHeight: '3.5rem'
                }}
              >
                "I know what I want to say — just not in what order."
              </div>
              <div className="w-6 h-px mb-5" style={{ background: '#6ab0d4' }} />
              <div 
                className="mb-2"
                style={{ 
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#6ab0d4',
                  lineHeight: 1.1
                }}
              >
                🧵 Threader
              </div>
              <div 
                className="mb-5 flex-1"
                style={{ 
                  fontSize: '0.75rem',
                  color: '#5a5650',
                  lineHeight: 1.55,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Type the points you need to cover. The Threader gives you the sequence that flows — and tells you why that order works.
              </div>
              <div 
                className="flex items-center gap-2 mt-5"
                style={{ 
                  fontSize: '0.72rem',
                  color: '#6ab0d4',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  transition: 'gap 0.2s'
                }}
              >
                Find the order <span>→</span>
              </div>
            </div>
          </Link>

          {/* Writing Coach Card */}
          <Link href="/writing-coach" className="group cursor-pointer block">
            <div 
              className="rounded-2xl p-7 transition-all flex flex-col relative overflow-hidden h-full"
              style={{
                background: '#141310',
                border: '1px solid #2a2720',
                borderRadius: '16px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 20px 50px rgba(0,0,0,.6)'
                e.currentTarget.style.borderColor = '#27693a'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderColor = '#2a2720'
              }}
            >
              <div 
                className="mb-5"
                style={{ 
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '1.15rem',
                  color: '#7a7268',
                  lineHeight: 1.4,
                  minHeight: '3.5rem'
                }}
              >
                "I have a whole thing to write and need to go from zero to done."
              </div>
              <div className="w-6 h-px mb-5" style={{ background: '#6ecf9a' }} />
              <div 
                className="mb-2"
                style={{ 
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.5rem',
                  fontWeight: 600,
                  color: '#6ecf9a',
                  lineHeight: 1.1
                }}
              >
                ✍️ Writing Coach
              </div>
              <div 
                className="mb-5 flex-1"
                style={{ 
                  fontSize: '0.75rem',
                  color: '#5a5650',
                  lineHeight: 1.55,
                  fontFamily: 'var(--font-mono)'
                }}
              >
                Set your project, get a task breakdown. The Coach brings in the other two tools exactly when you need them.
              </div>
              <div className="flex gap-2 mb-5 flex-wrap items-center">
                <span 
                  className="text-xs uppercase"
                  style={{ 
                    fontSize: '0.58rem',
                    letterSpacing: '0.12em',
                    color: '#5a5650',
                    fontFamily: 'var(--font-mono)',
                    alignSelf: 'center'
                  }}
                >
                  includes
                </span>
                <span 
                  className="px-3 py-1 rounded-full text-xs border"
                  style={{ 
                    fontSize: '0.68rem',
                    padding: '0.22rem 0.65rem',
                    borderRadius: '50px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    background: '#1a1608',
                    borderColor: '#6b5820',
                    color: '#c9a84c'
                  }}
                >
                  💡 Ideation
                </span>
                <span 
                  className="px-3 py-1 rounded-full text-xs border"
                  style={{ 
                    fontSize: '0.68rem',
                    padding: '0.22rem 0.65rem',
                    borderRadius: '50px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 500,
                    background: '#0d1520',
                    borderColor: '#2d5a7a',
                    color: '#6ab0d4'
                  }}
                >
                  🧵 Threader
                </span>
              </div>
              <div 
                className="flex items-center gap-2 mt-5"
                style={{ 
                  fontSize: '0.72rem',
                  color: '#6ecf9a',
                  fontWeight: 500,
                  fontFamily: 'var(--font-mono)',
                  transition: 'gap 0.2s'
                }}
              >
                Start your project <span>→</span>
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-12 flex items-center justify-center">
          <Button
            onClick={signOut}
            variant="outline"
            style={{ 
              borderColor: 'var(--border)',
              color: 'var(--muted)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem'
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
