"use client"

import type React from "react"
import Link from "next/link"
import { useState } from "react"
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

  const isStrongPassword = (p: string) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(p)

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
        options: { data: { name } },
      })
      if (error) {
        setAuthError(
          error.message.toLowerCase().includes("already") ? "User with this email already exists" : error.message
        )
        return
      }
      if (data.user) {
        setEmail("")
        setPassword("")
        setName("")
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setAuthError("Please fill in all fields")
        return
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setAuthError(error.message || "Invalid email or password")
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
      redirectTo: `${typeof window !== "undefined" ? window.location.origin : ""}/auth/reset`,
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
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-light text-gray-800">
              {authMode === "login"
                ? "Welcome Back"
                : authMode === "reset"
                  ? "Reset Password"
                  : "Create Account"}
            </CardTitle>
            <p className="text-gray-600 mt-2">
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
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {authMode !== "reset" && (
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  {authMode === "signup" && (
                    <p className="text-xs text-gray-500 mt-1">
                      Must be at least 8 characters with a number and capital letter
                    </p>
                  )}
                </div>
              )}
              {authError && <div className="text-red-600 text-sm text-center">{authError}</div>}
              {resetEmailSent && (
                <div className="text-green-600 text-sm text-center bg-green-50 border border-green-200 rounded p-3">
                  Password reset email sent! Check your inbox.
                </div>
              )}
              <Button type="submit" className="w-full" size="lg">
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
                  className="text-blue-600 hover:text-blue-700 text-sm block w-full"
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
                  className="text-blue-600 hover:text-blue-700 text-sm block w-full"
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
                  className="text-blue-600 hover:text-blue-700 text-sm"
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-light text-white mb-2">
            Welcome, {user.user_metadata?.name || user.email}
          </h1>
          <p className="text-slate-400">Choose your writing tool</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Link href="/pre-writing" className="group cursor-pointer block">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 transition-all hover:bg-white/15 hover:border-white/30 h-full flex flex-col justify-between">
              <div>
                <div className="h-16 w-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Lightbulb className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-light text-white mb-3">Pre-Writing Ideation</h2>
                <p className="text-slate-300 leading-relaxed">
                  Unlock creativity with strategy cards inspired by Oblique Strategies. Explore, refine, and organize
                  your best ideas.
                </p>
              </div>
              <div className="mt-8 flex items-center text-amber-400 font-medium group-hover:translate-x-2 transition-transform">
                Get Started <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </div>
          </Link>

          <Link href="/writing-coach" className="group cursor-pointer block">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-8 transition-all hover:bg-white/15 hover:border-white/30 h-full flex flex-col justify-between">
              <div>
                <div className="h-16 w-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-light text-white mb-3">Writing Coach</h2>
                <p className="text-slate-300 leading-relaxed">
                  Structured writing practice with AI feedback. Break down complex tasks and track your progress with
                  personalized coaching.
                </p>
              </div>
              <div className="mt-8 flex items-center text-blue-400 font-medium group-hover:translate-x-2 transition-transform">
                Get Started <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            </div>
          </Link>
        </div>

        <div className="mt-12 flex items-center justify-center">
          <Button
            onClick={signOut}
            variant="outline"
            className="border-slate-400 text-slate-300 hover:bg-slate-800 bg-transparent"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  )
}
