"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import SharedNav from "@/components/shared-nav"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Lightbulb,
  Plus,
  Zap,
  Sparkles,
  LogOut,
  Home,
  Archive,
  Trophy,
  ChevronRight,
  Layout,
  Paperclip,
  RotateCcw,
  BookOpen,
  Trash2,
  Heart,
  Award,
} from "lucide-react"
import FileUpload from "./file-upload"
import ComparativeJudgment from "./comparative-judgment"
import IslandOfMisfits from "./island-of-misfits"

interface UploadedFile {
  url: string
  name: string
  size: number
  type: string
  uploadedAt: Date
}

interface StrategyCard {
  id: string
  text: string
  category: string
  difficulty: "easy" | "medium" | "hard"
}

interface IdeaEntry {
  id: string
  content: string
  cardId: string
  cardText: string
  notes: string
  timestamp: Date
  status: "active" | "discarded" | "selected"
  attachedFiles?: UploadedFile[]
  wins?: number // For comparative judgment
  score?: number // For comparative judgment
  thurstoneScore?: number // Added Thurstone Case V score
}

interface UserLocal {
  id: string
  email: string
  name: string
}

interface IdeationSession {
  id: string
  title: string
  description: string
  createdAt: Date
  ideas: IdeaEntry[]
  timer: number
  isTimerRunning: boolean
  uploadedFiles: UploadedFile[]
  isComplete?: boolean
  lastView?: "ideate" | "compare" | "ranked" | "review"
}

const STRATEGY_CARDS: StrategyCard[] = [
  { id: "1", text: "Remove something", category: "constraint", difficulty: "easy" },
  { id: "2", text: "Emphasize the flaws", category: "reframe", difficulty: "medium" },
  { id: "3", text: "What would your closest friend say?", category: "perspective", difficulty: "medium" },
  { id: "4", text: "Use an old idea", category: "remix", difficulty: "easy" },
  { id: "5", text: "Accept advice", category: "openness", difficulty: "hard" },
  { id: "6", text: "Break it in half", category: "constraint", difficulty: "medium" },
  { id: "7", text: "What are you not saying?", category: "reflection", difficulty: "hard" },
  { id: "8", text: "Repetition is a form of change", category: "iteration", difficulty: "medium" },
  { id: "9", text: "Honour thy error as a hidden intention", category: "reframe", difficulty: "hard" },
  { id: "10", text: "Question the very thing you're trying to do", category: "meta", difficulty: "hard" },
  { id: "11", text: "Use an unusual color", category: "constraint", difficulty: "easy" },
  { id: "12", text: "Change nothing and notice everything", category: "observation", difficulty: "medium" },
  { id: "13", text: "Don't be afraid of things because they're lost", category: "perspective", difficulty: "medium" },
  { id: "14", text: "Look at the order in which you do things", category: "process", difficulty: "medium" },
  { id: "15", text: "Describe the landscape without looking at it", category: "challenge", difficulty: "hard" },
  { id: "16", text: "Consult oracles", category: "random", difficulty: "medium" },
  {
    id: "17",
    text: "List the characteristics of the most beautiful thing you know",
    category: "inspiration",
    difficulty: "easy",
  },
  { id: "18", text: "Make something hollow", category: "constraint", difficulty: "medium" },
  { id: "19", text: "Only one element of each kind", category: "constraint", difficulty: "hard" },
  {
    id: "20",
    text: "Make a blank valuable by putting it in an exquisite frame",
    category: "constraint",
    difficulty: "hard",
  },
  { id: "21", text: "Remove the most important element", category: "constraint", difficulty: "hard" },
  { id: "22", text: "Work with the opposite constraint", category: "constraint", difficulty: "medium" },
  { id: "23", text: "What would this look like in a different medium?", category: "perspective", difficulty: "medium" },
  { id: "24", text: "Make it 10x bigger/smaller", category: "constraint", difficulty: "easy" },
  { id: "25", text: "Let death guide you.", category: "reframe", difficulty: "hard" },
  { id: "26", text: "What would a two year old ask?", category: "perspective", difficulty: "easy" },
  { id: "27", text: "Horizontal not vertical", category: "constraint", difficulty: "medium" },
  { id: "28", text: "A new word, a new definition", category: "constraint", difficulty: "medium" },
  { id: "29", text: "The complete opposite.", category: "reframe", difficulty: "medium" },
  { id: "30", text: "No words allowed.", category: "constraint", difficulty: "hard" },
  { id: "31", text: "Touch it.", category: "challenge", difficulty: "easy" },
  { id: "32", text: "The tree house of your childhood dreams", category: "inspiration", difficulty: "easy" },
  { id: "33", text: "Blanket fort", category: "inspiration", difficulty: "easy" },
  { id: "34", text: "Make yourself laugh.", category: "challenge", difficulty: "medium" },
  { id: "35", text: "Roll down the hill", category: "challenge", difficulty: "easy" },
  { id: "36", text: "Tower of objects near you", category: "constraint", difficulty: "medium" },
  { id: "37", text: "Quick. Type random keys. Interpret.", category: "random", difficulty: "medium" },
  { id: "38", text: "Dance in the kitchen", category: "challenge", difficulty: "easy" },
  { id: "39", text: "Hybrid hobbies", category: "remix", difficulty: "medium" },
  { id: "40", text: "No capes, darling - Edna Mode", category: "reframe", difficulty: "medium" },
  { id: "41", text: "Put the thing down, flip it, and reverse it - Missy Elliot", category: "remix", difficulty: "medium" },
  { id: "42", text: "How does the caterpillar turn into a butterfly?", category: "perspective", difficulty: "medium" },
  { id: "43", text: "Hardcover and publish", category: "constraint", difficulty: "medium" },
  { id: "44", text: "5$ budget", category: "constraint", difficulty: "medium" },
  { id: "45", text: "Jump off the cliff", category: "reframe", difficulty: "hard" },
  { id: "46", text: "If it were a silent film", category: "constraint", difficulty: "medium" },
  { id: "47", text: "Elevator music.", category: "constraint", difficulty: "medium" },
  { id: "48", text: "Blindfolded", category: "challenge", difficulty: "hard" },
  { id: "49", text: "Cut in two and swap", category: "remix", difficulty: "medium" },
  { id: "50", text: "Collaborate with your imaginary friend", category: "perspective", difficulty: "medium" },
  { id: "51", text: "Change the language", category: "constraint", difficulty: "medium" },
  { id: "52", text: "Write me a beautiful lie", category: "reframe", difficulty: "hard" },
]

export default function PreWritingIdeation({
  user,
  onLogout,
  onBack,
}: {
  user: User | null
  onLogout: () => void
  onBack: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewFromUrl = (searchParams.get("view") as "dashboard" | "setup" | "ideate" | "compare" | "ranked" | "island-of-misfits" | "review") || "ideate" // Default to ideate like prototype
  const sessionIdFromUrl = searchParams.get("session")

  const [session, setSession] = useState<IdeationSession | null>(null)
  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionDescription, setSessionDescription] = useState("")
  // If sessionIdFromUrl is present but viewFromUrl is dashboard, default to ranked
  // Otherwise use the view from URL (which could be ideate, compare, ranked, review)
  // If viewFromUrl is "ideate" and no sessionIdFromUrl, we'll auto-create a session
  // Default to "ideate" if viewFromUrl is "ideate" (like prototype - immediate start)
  const initialView = sessionIdFromUrl && viewFromUrl === "dashboard" 
    ? "ranked" 
    : viewFromUrl === "ideate" 
      ? "ideate" 
      : viewFromUrl || "ideate" // Default to ideate if no view specified
  const [currentView, setCurrentView] = useState(initialView)
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionIdFromUrl)
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [promptTextVisible, setPromptTextVisible] = useState(true)
  const [currentIdea, setCurrentIdea] = useState("")
  const [currentNotes, setCurrentNotes] = useState("")
  const [activeTab, setActiveTab] = useState("ideas")
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [sessionUploadedFiles, setSessionUploadedFiles] = useState<UploadedFile[]>([])
  const [fileUploadKey, setFileUploadKey] = useState(0)

  const [allSessions, setAllSessions] = useState<IdeationSession[]>([])
  const justNavigatedRef = useRef(false)
  const pendingSessionIdRef = useRef<string | null>(null)
  const hasAutoCreatedSession = useRef(false)
  const isLoadingSessionsRef = useRef(false)
  const allSessionsRef = useRef<IdeationSession[]>([])
  const isLoadingFromUrlRef = useRef(false)

  // Load sessions from Supabase
  const loadSessionsFromSupabase = async () => {
    if (!user?.id) {
      console.log("No user ID, skipping session load")
      return
    }

    try {
      console.log(`Loading sessions for user ${user.id}`)
      const { data: sessionsData, error } = await supabase
        .from("ideation_sessions")
        .select("*, ideas(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100) // Limit to most recent 100 sessions to prevent performance issues

      if (error) {
        console.error("Error loading sessions:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))
        return
      }

      console.log(`Raw sessions data from Supabase:`, sessionsData)

      if (sessionsData && sessionsData.length > 0) {
        console.log(`Loaded ${sessionsData.length} sessions from Supabase`)
        const formattedSessions: IdeationSession[] = sessionsData.map((s: any) => {
          const ideas = (s.ideas || []).map((idea: any) => ({
            id: idea.id,
            content: idea.content || "",
            cardId: idea.card_id || "",
            cardText: idea.card_text || "",
            notes: idea.notes || "",
            timestamp: new Date(idea.timestamp),
            status: (idea.status || "active") as "active" | "discarded" | "selected",
            attachedFiles: idea.attached_files || undefined,
            wins: idea.wins || undefined,
            score: idea.score || undefined,
            thurstoneScore: idea.thurstone_score ? Number(idea.thurstone_score) : undefined,
          }))
          
          // Removed excessive logging - only log if there are ideas
          // console.log(`Session ${s.id} (${s.title}) has ${ideas.length} ideas`)
          
          return {
            id: s.id,
            title: s.title,
            description: s.description,
            createdAt: new Date(s.created_at),
            ideas: ideas,
            timer: s.timer,
            isTimerRunning: s.is_timer_running,
            uploadedFiles: s.uploaded_files || [],
            isComplete: s.is_complete,
            lastView: s.last_view || undefined,
          }
        })

        // Only log if there are sessions with ideas
        const sessionsWithIdeas = formattedSessions.filter(s => s.ideas.length > 0)
        if (sessionsWithIdeas.length > 0) {
          console.log(`Loaded ${formattedSessions.length} sessions (${sessionsWithIdeas.length} with ideas)`)
        }
        setAllSessions(formattedSessions)
      } else {
        console.log("No sessions found in database")
        setAllSessions([])
      }
    } catch (error) {
      console.error("Error loading sessions:", error)
    }
  }

  const exitToDashboard = async () => {
    if (session && ["ideate", "compare", "ranked", "review"].includes(currentView)) {
      const sessionWithLastView = { ...session, lastView: currentView as IdeationSession["lastView"] }
      setSession(sessionWithLastView)
      setAllSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === session.id)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = sessionWithLastView
          return updated
        }
        return prev
      })
      await saveSessionToSupabase(sessionWithLastView)
    }
    // Navigate to unified dashboard
    router.push("/dashboard")
  }

  const navigateToView = (view: typeof currentView, sessionId?: string) => {
    justNavigatedRef.current = true
    pendingSessionIdRef.current = sessionId ?? null
    setCurrentView(view)
    const params = new URLSearchParams()
    params.set("view", view)
    if (sessionId) params.set("session", sessionId)
    router.replace(`/pre-writing?${params.toString()}`)
    // Reset refs after URL has had time to update - prevents sync effect from overwriting
    setTimeout(() => {
      justNavigatedRef.current = false
      pendingSessionIdRef.current = null
    }, 150)
  }

  // Sync view from URL when it changes (e.g. browser back/forward)
  // Skip when we've just called navigateToView - avoids race where stale URL overwrites our navigation
  useEffect(() => {
    if (justNavigatedRef.current) return
    // Don't overwrite session view with non-session view when we have session (stale URL race)
    const sessionViews = ["ideate", "compare", "ranked", "review"]
    // If we have a sessionIdFromUrl but viewFromUrl is dashboard, don't change to dashboard
    // This allows the session loading effect to set the appropriate view
    if (
      sessionIdFromUrl &&
      viewFromUrl === "dashboard" &&
      session &&
      sessionViews.includes(currentView)
    ) {
      return
    }
    if (
      session &&
      sessionViews.includes(currentView) &&
      !sessionViews.includes(viewFromUrl) &&
      !sessionIdFromUrl
    ) {
      return
    }
    // Only set view from URL if it's not dashboard when we have a session from URL
    if (!(sessionIdFromUrl && viewFromUrl === "dashboard" && session)) {
      setCurrentView(viewFromUrl)
    }
    if (!sessionIdFromUrl) {
      pendingSessionIdRef.current = null
    }
  }, [viewFromUrl, sessionIdFromUrl, currentView, session])

  // Remove auto-create session logic - session will be created when first idea is added

  // Load session from allSessions when sessionId is in URL
  // Use a ref to track when allSessions updates so we can load the session
  // This prevents circular dependencies
  useEffect(() => {
    allSessionsRef.current = allSessions
  }, [allSessions])

  // Ensure sessions are loaded when sessionIdFromUrl is present
  useEffect(() => {
    if (sessionIdFromUrl && allSessions.length === 0 && !isLoadingSessionsRef.current && user?.id) {
      // Force load sessions if we have a sessionId but no sessions loaded
      isLoadingSessionsRef.current = true
      loadSessionsFromSupabase().finally(() => {
        isLoadingSessionsRef.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl, allSessions.length, user?.id])

  // Update ref when allSessions changes (for other use cases)
  useEffect(() => {
    allSessionsRef.current = allSessions
  }, [allSessions])

  useEffect(() => {
    // ONLY update session from allSessions if we're loading from URL
    if (sessionIdFromUrl && allSessions.length > 0) {
      isLoadingFromUrlRef.current = true
      pendingSessionIdRef.current = null
      const found = allSessions.find((s) => s.id === sessionIdFromUrl)
      if (found) {
        // Only update if we don't have a session OR the session ID doesn't match
        // This prevents overwriting the active session when allSessions updates from auto-save
        if (!session || session.id !== sessionIdFromUrl) {
          setSession(found)
          setIsLoadingSession(false)
          // Use the view from URL if it's a valid session view, otherwise use session's lastView or default
          const sessionViews = ["ideate", "compare", "ranked", "review"]
          const targetView = sessionViews.includes(viewFromUrl) 
            ? viewFromUrl 
            : (found.lastView || (found.isComplete ? "ranked" : "ideate"))
          
          if (targetView !== currentView) {
            setCurrentView(targetView as typeof currentView)
          }
        } else {
          // Session already matches - just clear loading state
          setIsLoadingSession(false)
        }
        isLoadingFromUrlRef.current = false
      } else if (
        ["ideate", "compare", "ranked", "review"].includes(viewFromUrl) &&
        (!session || session.id !== sessionIdFromUrl)
      ) {
        // Session not found after loading - redirect
        setIsLoadingSession(false)
        isLoadingFromUrlRef.current = false
        router.replace("/pre-writing")
      }
    } else if (sessionIdFromUrl && allSessions.length === 0) {
      // Sessions are still loading - keep loading state true
      // The session will be loaded once allSessions is populated
      if (!isLoadingSessionsRef.current) {
        // If we're not loading, trigger a load
        isLoadingSessionsRef.current = true
        loadSessionsFromSupabase().finally(() => {
          isLoadingSessionsRef.current = false
        })
      }
    } else if (!sessionIdFromUrl && !pendingSessionIdRef.current) {
      isLoadingFromUrlRef.current = false
      // Don't clear session here - let the effect above handle it
      setIsLoadingSession(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl, viewFromUrl, router, currentView, allSessions.length])

  // Only load sessions when needed: dashboard view or loading specific session
  // Don't load on every mount - only when explicitly needed
  useEffect(() => {
    if (!user?.id) {
      // Clear sessions if no user
      setAllSessions([])
      return
    }
    
    // Only load if:
    // 1. Viewing dashboard, OR
    // 2. Loading a specific session from URL (even if sessions are already loaded, reload to ensure we have the latest)
    const shouldLoad = currentView === "dashboard" || (sessionIdFromUrl && (!isLoadingSessionsRef.current))
    
    if (shouldLoad && !isLoadingSessionsRef.current) {
      isLoadingSessionsRef.current = true
      loadSessionsFromSupabase().finally(() => {
        isLoadingSessionsRef.current = false
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView, sessionIdFromUrl, user?.id])

  // Dashboard loading is now handled in the main session loading useEffect above

  // Auto-save session to Supabase when it changes (but not if it's already complete)
  useEffect(() => {
    if (session && user?.id && !session.isComplete) {
      // Debounce saves to avoid too many database calls
      const timeoutId = setTimeout(async () => {
        try {
          await saveSessionToSupabase(session)
          // Also update allSessions to keep it in sync
          setAllSessions((prev) => {
            const existingIndex = prev.findIndex((s) => s.id === session.id)
            if (existingIndex >= 0) {
              const updated = [...prev]
              updated[existingIndex] = session
              return updated
            } else {
              return [session, ...prev]
            }
          })
        } catch (error) {
          console.error("Error auto-saving session:", error)
        }
      }, 1000) // Save 1 second after last change

      return () => clearTimeout(timeoutId)
    }
  }, [session, user?.id])

  // Save session to Supabase
  const saveSessionToSupabase = async (session: IdeationSession) => {
    if (!user?.id) return
    
    // Don't save empty sessions - only save if there's at least one idea
    if (!session.ideas || session.ideas.length === 0) {
      console.log(`Skipping save for empty session ${session.id}`)
      return
    }

    try {
      // Upsert session
      const { error: sessionError } = await supabase
        .from("ideation_sessions")
        .upsert(
          {
            id: session.id,
            user_id: user.id,
            title: session.title,
            description: session.description,
            timer: session.timer,
            is_timer_running: session.isTimerRunning,
            is_complete: session.isComplete || false,
            uploaded_files: session.uploadedFiles || [],
            last_view: session.lastView || null,
            created_at: session.createdAt.toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )

      if (sessionError) {
        console.error("Error saving session:", sessionError)
        return
      }

      // Delete existing ideas for this session
      const { error: deleteError } = await supabase.from("ideas").delete().eq("session_id", session.id)
      
      if (deleteError) {
        console.error("Error deleting existing ideas:", deleteError)
      }

      // Insert all ideas
      if (session.ideas.length > 0) {
        const ideasToInsert = session.ideas.map((idea) => ({
          id: idea.id,
          session_id: session.id,
          content: idea.content || "",
          card_id: idea.cardId || "",
          card_text: idea.cardText || "",
          notes: idea.notes || "",
          status: idea.status || "active",
          attached_files: idea.attachedFiles || [],
          wins: idea.wins || null,
          score: idea.score || null,
          thurstone_score: idea.thurstoneScore || null,
          timestamp: idea.timestamp.toISOString(),
          created_at: idea.timestamp.toISOString(),
        }))

        const { data: insertedIdeas, error: ideasError } = await supabase.from("ideas").insert(ideasToInsert).select()

        if (ideasError) {
          console.error("Error saving ideas:", ideasError)
          console.error("Ideas that failed to save:", ideasToInsert)
        } else {
          console.log(`Successfully saved ${insertedIdeas?.length || 0} ideas for session ${session.id}`)
        }
      } else {
        console.log(`No ideas to save for session ${session.id}`)
      }
    } catch (error) {
      console.error("Error saving session:", error)
    }
  }

  const saveSessions = async (sessions: IdeationSession[]) => {
    setAllSessions(sessions)
    // Save each session to Supabase
    for (const session of sessions) {
      await saveSessionToSupabase(session)
    }
  }

  // DON'T auto-create sessions - only create when user adds first idea (like threading)
  // This prevents creating thousands of empty sessions


  const addIdea = () => {
    if (!currentIdea.trim()) {
      return
    }

    // Auto-create session ONLY when user adds their first idea (like threading)
    // Don't save to Supabase until there's at least one idea
    if (!session) {
      const newSession: IdeationSession = {
        id: crypto.randomUUID(),
        title: "",
        description: "",
        createdAt: new Date(),
        ideas: [],
        timer: 0,
        isTimerRunning: false,
        uploadedFiles: [],
        isComplete: false,
      }
      setSession(newSession)
      // Don't save to Supabase yet - wait until idea is added
      setAllSessions((prev) => [newSession, ...prev])
      // Continue to add the idea after session is created
      setTimeout(() => {
        if (currentIdea.trim()) {
          addIdeaToSession(newSession)
        }
      }, 0)
      return
    }
    
    addIdeaToSession(session)
  }

  const addIdeaToSession = (sessionToUse: IdeationSession) => {
    if (!currentIdea.trim()) return

    const newIdea: IdeaEntry = {
      id: crypto.randomUUID(),
      content: currentIdea,
      cardId: STRATEGY_CARDS[currentCardIndex].id,
      cardText: STRATEGY_CARDS[currentCardIndex].text,
      notes: currentNotes,
      timestamp: new Date(),
      status: "active",
      attachedFiles: sessionUploadedFiles.length > 0 ? [...sessionUploadedFiles] : undefined,
    }

    setSession({
      ...sessionToUse,
      ideas: [...(sessionToUse.ideas || []), newIdea],
    })

    setCurrentIdea("")
    setCurrentNotes("")
    setSessionUploadedFiles([])
    // Reset FileUpload component by changing key
    setFileUploadKey(prev => prev + 1)
  }

  const newCard = () => {
    // Cycle to next card (not random, just increment)
    setCurrentCardIndex((prev) => (prev + 1) % STRATEGY_CARDS.length)
    setCurrentIdea("")
    setCurrentNotes("")
  }

  const discardIdea = async (ideaId: string) => {
    if (!session) return
    const idea = session.ideas.find((i) => i.id === ideaId)
    if (idea) {
      // Send to misfits and mark as discarded
      await sendToMisfits(idea)
    }
  }

  const selectIdea = (ideaId: string) => {
    if (!session) return
    setSession({
      ...session,
      ideas: session.ideas.map((idea) => (idea.id === ideaId ? { ...idea, status: "selected" } : idea)),
    })
  }

  const handleFileUpload = (file: UploadedFile) => {
    setSessionUploadedFiles((prev) => [...prev, file])
    if (session) {
      setSession({
        ...session,
        uploadedFiles: [...session.uploadedFiles, file],
      })
    }
  }

  const completeSession = async (sessionToComplete?: IdeationSession) => {
    const sessionToSave = sessionToComplete || session
    if (!sessionToSave) return
    const completedSession = { ...sessionToSave, isComplete: true, isTimerRunning: false }
    setSession(completedSession)
    const existingSessions = allSessions.filter((s) => s.id !== sessionToSave.id)
    
    // Ensure the completed session is saved to Supabase
    await saveSessionToSupabase(completedSession)
    
    // Update local state
    setAllSessions([completedSession, ...existingSessions])
  }

  const handleRankingComplete = (rankedIdeas: IdeaEntry[]) => {
    if (!session) return

    console.log(
      "[v0] Ranking complete, received ideas:",
      rankedIdeas.map((i) => ({
        content: i.content,
        wins: i.wins,
        thurstoneScore: i.thurstoneScore,
      })),
    )

    const updatedSession = { ...session, ideas: rankedIdeas }
    setSession(updatedSession)
    navigateToView("ranked", session.id)
    completeSession(updatedSession)
  }

  const sendToMisfits = async (idea: IdeaEntry) => {
    if (!user?.id || !session) return

    try {
      // Save to misfit_ideas table (idea_id links back for restore)
      const misfitIdea = {
        id: crypto.randomUUID(),
        user_id: user.id,
        idea_id: idea.id,
        content: idea.content,
        notes: idea.notes || "",
        tags: [],
        reason_discarded: "Sent from comparative judgment",
        original_session_title: session.title || null,
        discarded_at: new Date().toISOString(),
        attached_files: idea.attachedFiles || [],
        created_at: new Date().toISOString(),
      }

      const { error: misfitError } = await supabase.from("misfit_ideas").insert(misfitIdea)

      if (misfitError) {
        console.error("Error saving misfit idea:", misfitError)
        return
      }

      // Mark the idea as discarded in the session and move to bottom
      const updatedIdeas = session.ideas.map((i) => 
        i.id === idea.id ? { ...i, status: "discarded" as const } : i
      )
      
      // Sort: active/selected first, then discarded at the bottom
      const sortedIdeas = [
        ...updatedIdeas.filter((i) => i.status !== "discarded"),
        ...updatedIdeas.filter((i) => i.status === "discarded")
      ]

      const updatedSession = { ...session, ideas: sortedIdeas }
      setSession(updatedSession)
      
      // Update allSessions
      setAllSessions((prev) => {
        const existingIndex = prev.findIndex((s) => s.id === session.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = updatedSession
          return updated
        }
        return [updatedSession, ...prev]
      })

      // Save the updated session to Supabase
      await saveSessionToSupabase(updatedSession)
    } catch (error) {
      console.error("Error sending idea to misfits:", error)
    }
  }

  const restoreFromMisfits = async (ideaId: string) => {
    if (!session || !user?.id) return

    try {
      // Remove from misfit_ideas table (if idea_id column exists)
      await supabase.from("misfit_ideas").delete().eq("idea_id", ideaId).eq("user_id", user.id)

      // Mark the idea as active again
      const updatedIdeas = session.ideas.map((i) => 
        i.id === ideaId ? { ...i, status: "active" as const } : i
      )
      
      // Sort: active/selected first, then discarded at the bottom
      const sortedIdeas = [
        ...updatedIdeas.filter((i) => i.status !== "discarded"),
        ...updatedIdeas.filter((i) => i.status === "discarded")
      ]

      const updatedSession = { ...session, ideas: sortedIdeas }
      setSession(updatedSession)
      
      // Update allSessions
      setAllSessions((prev) => {
        const existingIndex = prev.findIndex((s) => s.id === session.id)
        if (existingIndex >= 0) {
          const updated = [...prev]
          updated[existingIndex] = updatedSession
          return updated
        }
        return [updatedSession, ...prev]
      })

      // Save the updated session to Supabase
      await saveSessionToSupabase(updatedSession)
    } catch (error) {
      console.error("Error restoring idea from misfits:", error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-100 text-green-800"
      case "medium":
        return "bg-yellow-100 text-yellow-800"
      case "hard":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "constraint":
        return "🔒"
      case "reframe":
        return "🔄"
      case "perspective":
        return "👁️"
      case "remix":
        return "🎨"
      case "openness":
        return "🪟"
      case "reflection":
        return "💭"
      case "iteration":
        return "🔁"
      case "meta":
        return "🎯"
      case "observation":
        return "🔍"
      case "process":
        return "⚙️"
      case "challenge":
        return "⛰️"
      case "random":
        return "🎲"
      case "inspiration":
        return "✨"
      default:
        return "💡"
    }
  }

  // Show loading state if we're loading a session from URL
  if (isLoadingSession && sessionIdFromUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-gray-500">Loading session...</div>
      </div>
    )
  }

  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="ideation" onLogout={onLogout} />

        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* New Session Card */}
          <Card className="bg-gradient-to-r from-amber-500 to-orange-500 border-none text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Start a New Ideation Session</h2>
                  <p className="text-amber-100">
                    Use strategy cards to unlock creative thinking and capture your best ideas
                  </p>
                </div>
                <Button
                  onClick={() => navigateToView("setup")}
                  size="lg"
                  className="bg-white text-amber-600 hover:bg-amber-50"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  New Session
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Island of Misfit Ideas Card */}
          <Card
            className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200 cursor-pointer hover:shadow-lg transition-all"
            onClick={() => navigateToView("island-of-misfits")}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 bg-purple-500 rounded-lg flex items-center justify-center">
                    <Archive className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Island of Misfit Ideas</h3>
                    <p className="text-sm text-gray-600">Browse discarded ideas for inspiration</p>
                  </div>
                </div>
                <ChevronRight className="h-6 w-6 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          {/* Past Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Layout className="h-5 w-5" />
                <span>Your Ideation Sessions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {allSessions.length === 0 ? (
                <div className="text-center py-12">
                  <Lightbulb className="h-12 w-12 text-amber-300 mx-auto mb-3" />
                  <p className="text-gray-600">No sessions yet. Start your first ideation session!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allSessions.map((s) => (
                    <Card
                      key={s.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => {
                        let sessionToOpen = s
                        let targetView: typeof currentView = s.lastView || (s.isComplete ? "ranked" : "ideate")
                        // If returning to compare, clear thurstone/wins so comparative judgement restarts
                        if (targetView === "compare") {
                          sessionToOpen = {
                            ...s,
                            ideas: (s.ideas ?? []).map((i) => ({
                              ...i,
                              thurstoneScore: undefined,
                              wins: undefined,
                              score: undefined,
                            })),
                          }
                          setAllSessions((prev) =>
                            prev.map((p) => (p.id === s.id ? sessionToOpen : p))
                          )
                        }
                        setSession(sessionToOpen)
                        navigateToView(targetView, s.id)
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h3 className="font-semibold text-gray-800">{s.title}</h3>
                              <Badge variant={s.isComplete ? "default" : "outline"}>
                                {s.isComplete ? "Complete" : "In Progress"}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{s.description}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>{(s.ideas ?? []).length} ideas</span>
                              <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (currentView === "island-of-misfits") {
    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="island" onLogout={onLogout} />
        <div className="max-w-6xl mx-auto p-6">
          <IslandOfMisfits
            user={user}
            onMisfitImport={(idea) => {
              // Could implement restoring to current session if needed
              console.log("[v0] Restoring misfit idea:", idea)
            }}
          />
        </div>
      </div>
    )
  }

  // Setup view - redirect to ideate if no session (session will be auto-created on first idea)
  if (!session && currentView === "setup") {
    setCurrentView("ideate")
    return null
  }

  // Ideation view - session should be created by useEffect if needed
  if (currentView === "ideate") {
    // If no session and we're not in ideate view from URL, redirect to dashboard
    if (!session && viewFromUrl !== "ideate") {
      navigateToView("dashboard")
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }
    // Use session if it exists, otherwise use empty state (session will be created by useEffect)
    const currentCard = STRATEGY_CARDS[currentCardIndex]
    const activeIdeas = session ? (session.ideas ?? []).filter((idea) => idea.status === "active") : []
    const showRankTrigger = activeIdeas.length >= 3

    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="ideation" onLogout={onLogout} />

        {/* Main Content - matching prototype exactly */}
        <div className="max-w-[600px] mx-auto px-6 py-12">
          <h2 
            className="mb-1"
            style={{ 
              fontFamily: 'var(--font-serif)',
              fontSize: '2.2rem',
              fontWeight: 300,
              color: 'var(--ink)'
            }}
          >
            <em>What's on your mind?</em>
          </h2>
          <p 
            className="mb-10"
            style={{ 
              fontSize: '0.7rem',
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              fontFamily: 'var(--font-mono)'
            }}
          >
            drop every thought — no filter, no order
          </p>

          {/* Session name row */}
          <div className="flex items-center gap-3 mb-8">
            <span 
              className="uppercase whitespace-nowrap"
              style={{ 
                fontSize: '0.75rem',
                color: 'var(--muted)',
                letterSpacing: '0.1em',
                fontFamily: 'var(--font-mono)'
              }}
            >
              Session
            </span>
            <input
              type="text"
              value={session?.title || ""}
              onChange={(e) => {
                // Allow typing even if session doesn't exist yet - it will be created when first idea is added
                if (!session) {
                  // Create a temporary session for the title
                  const tempSession: IdeationSession = {
                    id: crypto.randomUUID(),
                    title: e.target.value,
                    description: "",
                    createdAt: new Date(),
                    ideas: [],
                    timer: 0,
                    isTimerRunning: false,
                    uploadedFiles: [],
                    isComplete: false,
                  }
                  setSession(tempSession)
                  return
                }
                const updatedSession = { ...session, title: e.target.value }
                setSession(updatedSession)
                if (user?.id && updatedSession.ideas.length > 0) {
                  saveSessionToSupabase(updatedSession)
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter") {
                  e.preventDefault()
                  e.nativeEvent.stopImmediatePropagation()
                  return false
                }
              }}
              onKeyPress={(e) => {
                e.stopPropagation()
              }}
              placeholder="Untitled ideation…"
              className="flex-1 bg-transparent border-none border-b outline-none px-0 pb-1 transition-colors"
              style={{ 
                fontFamily: 'var(--font-serif)',
                fontSize: '1.1rem',
                color: 'var(--ink)',
                borderBottomColor: 'var(--border)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderBottomColor = 'var(--border2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderBottomColor = 'var(--border)'
              }}
            />
          </div>

          {/* Prompt card */}
          <div 
            className="rounded-2xl p-7 mb-6 cursor-pointer transition-transform relative overflow-hidden"
            onClick={(e) => {
              // Only trigger on mouse clicks, not keyboard events
              if (e.detail === 0) return // Keyboard-triggered click
              // Only trigger if clicking directly on the card, not on child elements
              if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.prompt-card-content')) {
                newCard()
                setPromptTextVisible(false)
                setTimeout(() => setPromptTextVisible(true), 200)
              }
            }}
            onKeyDown={(e) => {
              // Prevent keyboard events from triggering card switch
              e.stopPropagation()
            }}
            onKeyDown={(e) => {
              // Prevent keyboard events from triggering card switch
              e.stopPropagation()
            }}
            style={{
              background: 'var(--ink)',
              color: 'var(--bg)',
              borderRadius: '14px',
              minHeight: '110px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
            }}
          >
            <div 
              className="text-xs uppercase mb-3"
              style={{ 
                fontSize: '0.58rem',
                letterSpacing: '0.14em',
                opacity: 0.4,
                fontFamily: 'var(--font-mono)'
              }}
            >
              Divergent thinking card — click for a new one
            </div>
            <div 
              className="mb-2 transition-opacity duration-300 prompt-card-content"
              style={{ 
                fontFamily: 'var(--font-serif)',
                fontStyle: 'italic',
                fontSize: '1.25rem',
                fontWeight: 300,
                lineHeight: 1.4,
                opacity: promptTextVisible ? 1 : 0
              }}
            >
              {currentCard.text}
            </div>
            <div 
              className="text-xs self-end"
              style={{ 
                fontSize: '0.6rem',
                opacity: 0.3,
                fontFamily: 'var(--font-mono)'
              }}
            >
              click for next →
            </div>
            <div 
              className="absolute -bottom-8 -right-8 w-30 h-30 rounded-full pointer-events-none"
              style={{
                width: '120px',
                height: '120px',
                background: 'rgba(255,255,255,0.04)'
              }}
            />
          </div>

          {/* Idea input row */}
          <div className="flex gap-3 mb-5">
            <input
              type="text"
              value={currentIdea}
              onChange={(e) => setCurrentIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  e.stopPropagation()
                  e.nativeEvent.stopImmediatePropagation()
                  if (currentIdea.trim()) {
                    addIdea()
                  }
                  return false
                }
              }}
              placeholder="write an idea, any idea…"
              className="flex-1 rounded-lg px-4 py-3 outline-none transition-colors"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.9rem',
                color: 'var(--ink)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--border2)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            />
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                addIdea()
              }}
              disabled={!currentIdea.trim()}
              className="rounded-lg px-5 py-3 whitespace-nowrap transition-opacity disabled:opacity-50"
              style={{
                background: 'var(--ink)',
                color: 'var(--bg)',
                border: 'none',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem'
              }}
              onMouseEnter={(e) => {
                if (!e.currentTarget.disabled) {
                  e.currentTarget.style.opacity = '0.8'
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
              }}
            >
              Add {sessionUploadedFiles.length > 0 && `(${sessionUploadedFiles.length} file${sessionUploadedFiles.length !== 1 ? 's' : ''})`} →
            </button>
          </div>

          {/* File upload option (multimedia) */}
          {showFileUpload && (
            <div className="mb-5">
              <FileUpload key={fileUploadKey} onFileUpload={handleFileUpload} />
            </div>
          )}
          {!showFileUpload && (
            <button
              onClick={() => setShowFileUpload(true)}
              className="mb-5 text-xs text-muted hover:text-ink transition-colors"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--muted)' }}
            >
              + Add multimedia
            </button>
          )}

          {/* Ideas stack */}
          {activeIdeas.length > 0 && (
            <div className="flex flex-col gap-2 mb-6">
              {activeIdeas.map((idea, i) => (
                <div
                  key={idea.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg animate-popIn"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    fontSize: '0.88rem',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  <span 
                    className="text-xs min-w-[18px]"
                    style={{ 
                      fontSize: '0.58rem',
                      color: 'var(--muted)'
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">{idea.content}</span>
                  <button
                    onClick={() => {
                      if (!session) return
                      const updatedIdeas = session.ideas.filter((i) => i.id !== idea.id)
                      const updatedSession = { ...session, ideas: updatedIdeas }
                      setSession(updatedSession)
                      if (user?.id && updatedIdeas.length > 0) {
                        saveSessionToSupabase(updatedSession)
                      }
                    }}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--muted)',
                      fontSize: '0.7rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--red)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--muted)'
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Rank trigger - show when 3+ ideas */}
          {showRankTrigger && (
            <div 
              className="rounded-xl p-5 mb-6 flex items-center justify-between gap-4 transition-all"
              style={{
                background: 'var(--gold-bg)',
                border: '1px solid var(--gold-bdr)',
                borderRadius: '10px',
                animation: 'fadeSlideUp 0.5s ease'
              }}
            >
              <div>
                <div 
                  className="mb-1"
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontStyle: 'italic',
                    fontSize: '1rem',
                    color: 'var(--gold)',
                    lineHeight: 1.4
                  }}
                >
                  {activeIdeas.length === 3 
                    ? "You have 3 ideas. Let's find out which is strongest."
                    : `You have ${activeIdeas.length} ideas. Let's find out which ones matter.`}
                </div>
                <div 
                  className="text-xs"
                  style={{ 
                    fontSize: '0.62rem',
                    color: '#a07820',
                    fontFamily: 'var(--font-mono)'
                  }}
                >
                  comparative judgement — pairwise ranking
                </div>
              </div>
              <button
                onClick={() => {
                  if (!session) return
                  if (activeIdeas.length >= 2) {
                    navigateToView("compare", session.id)
                  } else {
                    alert("You need at least 2 active ideas to start ranking")
                  }
                }}
                className="rounded-lg px-5 py-3 whitespace-nowrap transition-transform flex-shrink-0"
                style={{
                  background: 'var(--gold)',
                  color: 'white',
                  border: 'none',
                  fontFamily: 'var(--font-serif)',
                  fontStyle: 'italic',
                  fontSize: '0.95rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                Rank them →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Review view
  if (currentView === "review") {
    if (!session) {
      navigateToView("dashboard")
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }
    const activeIdeas = (session.ideas ?? []).filter((idea) => idea.status === "active")
    const selectedIdeas = (session.ideas ?? []).filter((idea) => idea.status === "selected")
    const discardedIdeas = (session.ideas ?? []).filter((idea) => idea.status === "discarded")

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-medium text-gray-800">{session.title}</h1>
              <Badge variant="outline">{(session.ideas ?? []).length} total ideas</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => router.push("/dashboard")} variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                My Projects
              </Button>
              <Button onClick={() => navigateToView("ideate", session.id)} variant="outline" size="sm">
                Continue Ideating
              </Button>
              <Button onClick={() => { setSession(null); navigateToView("setup"); }} variant="outline" size="sm">
                New Session
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ideas">Active ({activeIdeas.length})</TabsTrigger>
              <TabsTrigger value="selected">Favorites ({selectedIdeas.length})</TabsTrigger>
              <TabsTrigger value="discarded">Discarded ({discardedIdeas.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="ideas" className="space-y-4 mt-6">
              {activeIdeas.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-600">No active ideas yet. Start ideating!</p>
                </Card>
              ) : (
                activeIdeas.map((idea) => (
                  <Card key={idea.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xl">
                            {getCategoryIcon(STRATEGY_CARDS.find((c) => c.id === idea.cardId)?.category || "")}
                          </span>
                          <div>
                            <p className="text-xs text-gray-500">From "{idea.cardText}"</p>
                            <p className="text-xs text-gray-400">{new Date(idea.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => selectIdea(idea.id)}>
                            <Heart className="h-4 w-4 text-gray-400 hover:text-red-500" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => discardIdea(idea.id)}>
                            <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-gray-800 mb-2">{idea.content}</p>
                      {idea.notes && (
                        <p className="text-sm text-gray-600 italic border-l-2 border-amber-300 pl-3">{idea.notes}</p>
                      )}
                      {idea.attachedFiles && idea.attachedFiles.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <p className="text-xs text-gray-600 font-medium mb-2">Attachments:</p>
                          <div className="space-y-1">
                            {idea.attachedFiles.map((file) => (
                              <a
                                key={file.url}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {file.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="selected" className="space-y-4 mt-6">
              {selectedIdeas.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-600">Mark your favorite ideas with the heart icon!</p>
                </Card>
              ) : (
                selectedIdeas.map((idea) => (
                  <Card key={idea.id} className="border-2 border-red-200 bg-red-50 hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Heart className="h-5 w-5 text-red-500" />
                          <div>
                            <p className="text-xs text-gray-600">Favorite from "{idea.cardText}"</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-800 font-medium">{idea.content}</p>
                      {idea.notes && <p className="text-sm text-gray-600 italic mt-2">{idea.notes}</p>}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="discarded" className="space-y-4 mt-6">
              {discardedIdeas.length === 0 ? (
                <Card className="text-center py-8">
                  <p className="text-gray-600">No discarded ideas yet.</p>
                </Card>
              ) : (
                discardedIdeas.map((idea) => (
                  <Card key={idea.id} className="bg-gray-50 border-gray-200 opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Archive className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Discarded from "{idea.cardText}"</p>
                            <p className="text-xs text-gray-400">{new Date(idea.timestamp).toLocaleString()}</p>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => restoreFromMisfits(idea.id)} className="text-green-600 hover:bg-green-50">
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Restore Idea
                        </Button>
                      </div>
                      <p className="text-gray-600 line-through mb-2">{idea.content}</p>
                      {idea.notes && (
                        <p className="text-sm text-gray-500 italic border-l-2 border-gray-300 pl-3 line-through">{idea.notes}</p>
                      )}
                      {idea.attachedFiles && idea.attachedFiles.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-300">
                          <p className="text-xs text-gray-500 font-medium mb-2">Attachments:</p>
                          <div className="space-y-1">
                            {idea.attachedFiles.map((file) => (
                              <a
                                key={file.url}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline"
                              >
                                {file.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  if (currentView === "compare") {
    if (!session) {
      navigateToView("dashboard")
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }
    const activeIdeas = (session.ideas ?? []).filter((idea) => idea.status === "active")

    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="ideation" onLogout={onLogout} />
        <ComparativeJudgment ideas={activeIdeas} onRankingComplete={handleRankingComplete} />
      </div>
    )
  }

  if (currentView === "ranked") {
    if (!session) {
      navigateToView("dashboard")
      return (
        <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      )
    }
    // Sort ideas: if they have thurstone scores, sort by score; otherwise sort by timestamp (order added)
    const rankedIdeas = [...(session.ideas ?? [])].sort((a, b) => {
      // If both have thurstone scores, sort by score
      if (a.thurstoneScore !== undefined && b.thurstoneScore !== undefined) {
        return (b.thurstoneScore || 0) - (a.thurstoneScore || 0)
      }
      // If neither has scores, sort by timestamp (order they were added)
      if (a.thurstoneScore === undefined && b.thurstoneScore === undefined) {
        return a.timestamp.getTime() - b.timestamp.getTime()
      }
      // If one has a score and one doesn't, put the one with score first
      return (b.thurstoneScore !== undefined ? 1 : 0) - (a.thurstoneScore !== undefined ? 1 : 0)
    })

    console.log(
      "[v0] Rendering ranked view:",
      rankedIdeas.map((i) => ({
        content: i.content,
        wins: i.wins,
        thurstoneScore: i.thurstoneScore,
      })),
    )

    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="ideation" onLogout={onLogout} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "3rem 1.5rem",
          }}
        >
          <div style={{ width: "100%", maxWidth: "560px" }}>
            {/* Title */}
            <div
              style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "1.8rem",
                color: "var(--ink)",
                marginBottom: ".3rem",
              }}
            >
              Your ideas, ranked.
            </div>

            {/* Sub */}
            <div
              style={{
                fontSize: ".68rem",
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: ".12em",
                marginBottom: "2rem",
              }}
            >
              send the weak ones to the island — or keep them all
            </div>

            {/* Ranked list */}
            <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", marginBottom: "2rem" }}>
              {rankedIdeas.map((idea, idx) => {
                const isDiscarded = idea.status === "discarded"
                return (
                  <div
                    key={idea.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      padding: ".85rem 1.1rem",
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      opacity: isDiscarded ? 0.35 : 1,
                      animationDelay: `${idx * 0.07}s`,
                    }}
                  >
                    {/* Position */}
                    <span
                      style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: "1.3rem",
                        fontWeight: 600,
                        color: "var(--gold)",
                        minWidth: "28px",
                      }}
                    >
                      {idx + 1}
                    </span>

                    {/* Text */}
                    <span
                      style={{
                        flex: 1,
                        fontSize: ".9rem",
                        textDecoration: isDiscarded ? "line-through" : "none",
                        color: isDiscarded ? "var(--muted)" : "var(--ink)",
                      }}
                    >
                      {idea.content}
                    </span>

                    {/* Score */}
                    {idea.wins !== undefined && idea.wins > 0 && (
                      <span
                        style={{
                          fontSize: ".62rem",
                          color: "var(--muted)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {idea.wins}W
                      </span>
                    )}

                    {/* Exile / Restore button */}
                    {isDiscarded ? (
                      <button
                        onClick={() => restoreFromMisfits(idea.id)}
                        style={{
                          background: "none",
                          border: "1px solid var(--border)",
                          borderRadius: "5px",
                          padding: ".25rem .6rem",
                          fontFamily: "var(--font-mono)",
                          fontSize: ".62rem",
                          color: "var(--muted)",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "all .15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "var(--green-bdr)"
                          e.currentTarget.style.color = "var(--green)"
                          e.currentTarget.style.background = "var(--green-bg)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border)"
                          e.currentTarget.style.color = "var(--muted)"
                          e.currentTarget.style.background = "none"
                        }}
                      >
                        restore →
                      </button>
                    ) : (
                      <button
                        onClick={() => sendToMisfits(idea)}
                        style={{
                          background: "none",
                          border: "1px solid #d4b4b4",
                          borderRadius: "5px",
                          padding: ".25rem .6rem",
                          fontFamily: "var(--font-mono)",
                          fontSize: ".62rem",
                          color: "#8b4040",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "all .15s",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#fdf0f0"
                          e.currentTarget.style.borderColor = "var(--red)"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "none"
                          e.currentTarget.style.borderColor = "#d4b4b4"
                        }}
                      >
                        exile →
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Save session button */}
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                width: "100%",
                background: "var(--ink)",
                color: "var(--bg)",
                border: "none",
                borderRadius: "8px",
                padding: "1rem",
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: "1.1rem",
                cursor: "pointer",
                transition: "opacity .2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = ".88" }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1" }}
            >
              Back to my projects →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
