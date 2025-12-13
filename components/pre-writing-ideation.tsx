"use client"

import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
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
  const [session, setSession] = useState<IdeationSession | null>(null)
  const [sessionTitle, setSessionTitle] = useState("")
  const [sessionDescription, setSessionDescription] = useState("")
  const [currentView, setCurrentView] = useState<
    "dashboard" | "setup" | "ideate" | "compare" | "ranked" | "island-of-misfits" | "review"
  >("dashboard")
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [currentIdea, setCurrentIdea] = useState("")
  const [currentNotes, setCurrentNotes] = useState("")
  const [timerDuration, setTimerDuration] = useState(25)
  const [activeTab, setActiveTab] = useState("ideas")
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [sessionUploadedFiles, setSessionUploadedFiles] = useState<UploadedFile[]>([])

  const [allSessions, setAllSessions] = useState<IdeationSession[]>([])

  useEffect(() => {
    const savedSessions = localStorage.getItem("ideation-sessions")
    if (savedSessions) {
      setAllSessions(JSON.parse(savedSessions))
    }
  }, [])

  const saveSessions = (sessions: IdeationSession[]) => {
    localStorage.setItem("ideation-sessions", JSON.stringify(sessions))
    setAllSessions(sessions)
  }

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (session?.isTimerRunning && session.timer > 0) {
      interval = setInterval(() => {
        setSession((prev) => {
          if (!prev) return prev
          const newTimer = prev.timer - 1
          if (newTimer === 0) {
            return { ...prev, isTimerRunning: false, timer: 0 }
          }
          return { ...prev, timer: newTimer }
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [session?.isTimerRunning])

  const startSession = () => {
    if (!sessionTitle.trim()) return

    const newSession: IdeationSession = {
      id: Date.now().toString(),
      title: sessionTitle,
      description: sessionDescription,
      createdAt: new Date(),
      ideas: [],
      timer: timerDuration * 60,
      isTimerRunning: true,
      uploadedFiles: [],
      isComplete: false,
    }

    setSession(newSession)
    setCurrentView("ideate")
    setCurrentCardIndex(Math.floor(Math.random() * STRATEGY_CARDS.length))
  }

  const addIdea = () => {
    if (!currentIdea.trim() || !session) return

    const newIdea: IdeaEntry = {
      id: Date.now().toString(),
      content: currentIdea,
      cardId: STRATEGY_CARDS[currentCardIndex].id,
      cardText: STRATEGY_CARDS[currentCardIndex].text,
      notes: currentNotes,
      timestamp: new Date(),
      status: "active",
      attachedFiles: sessionUploadedFiles.length > 0 ? [...sessionUploadedFiles] : undefined,
    }

    setSession({
      ...session,
      ideas: [...session.ideas, newIdea],
    })

    setCurrentIdea("")
    setCurrentNotes("")
    setSessionUploadedFiles([])
  }

  const newCard = () => {
    setCurrentCardIndex(Math.floor(Math.random() * STRATEGY_CARDS.length))
    setCurrentIdea("")
    setCurrentNotes("")
  }

  const discardIdea = (ideaId: string) => {
    if (!session) return
    setSession({
      ...session,
      ideas: session.ideas.map((idea) => (idea.id === ideaId ? { ...idea, status: "discarded" } : idea)),
    })
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

  const completeSession = (sessionToComplete?: IdeationSession) => {
    const sessionToSave = sessionToComplete || session
    if (!sessionToSave) return
    const completedSession = { ...sessionToSave, isComplete: true, isTimerRunning: false }
    setSession(completedSession)
    const existingSessions = allSessions.filter((s) => s.id !== sessionToSave.id)
    saveSessions([completedSession, ...existingSessions])
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
    setCurrentView("ranked")
    completeSession(updatedSession)
  }

  const sendToMisfits = (idea: IdeaEntry) => {
    const misfitIdeas = JSON.parse(localStorage.getItem("misfit-ideas") || "[]")
    const misfitIdea = {
      id: Date.now().toString(),
      content: idea.content,
      notes: idea.notes,
      tags: [],
      reasonDiscarded: "Sent from comparative judgment",
      originalSessionTitle: session?.title,
      discardedAt: new Date(),
      attachedFiles: idea.attachedFiles,
    }
    localStorage.setItem("misfit-ideas", JSON.stringify([...misfitIdeas, misfitIdea]))
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

  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <Home className="h-4 w-4 mr-2" />
                Tool Select
              </Button>
              <h1 className="text-lg font-medium text-gray-800">Pre-Writing Ideation</h1>
            </div>
            <Button variant="outline" size="sm" onClick={onLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

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
                  onClick={() => setCurrentView("setup")}
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
            onClick={() => setCurrentView("island-of-misfits")}
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
                        setSession(s)
                        setCurrentView(s.isComplete ? "ranked" : "ideate")
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
                              <span>{s.ideas.length} ideas</span>
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
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={() => setCurrentView("dashboard")}>
                <Home className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-lg font-medium text-gray-800">Island of Misfit Ideas</h1>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto p-6">
          <IslandOfMisfits
            onMisfitImport={(idea) => {
              // Could implement restoring to current session if needed
              console.log("[v0] Restoring misfit idea:", idea)
            }}
          />
        </div>
      </div>
    )
  }

  // Setup view
  if (!session && currentView === "setup") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Lightbulb className="h-6 w-6 text-amber-600" />
              <h1 className="text-xl font-medium text-gray-800">Pre-Writing Ideation</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setCurrentView("dashboard")} variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={onLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-light text-gray-800">Start a Creative Ideation Session</CardTitle>
              <p className="text-gray-600 mt-2">
                Use strategy cards inspired by Oblique Strategies to unlock new ideas
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Title</label>
                <Input
                  placeholder="e.g., Blog Post Ideas, Novel Chapter Opening"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <Textarea
                  placeholder="What are you trying to write about or explore?"
                  value={sessionDescription}
                  onChange={(e) => setSessionDescription(e.target.value)}
                  className="min-h-24"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Session Duration (minutes)</label>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="5"
                    max="120"
                    step="5"
                    value={timerDuration}
                    onChange={(e) => setTimerDuration(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-2xl font-bold text-amber-600 w-20 text-center">{timerDuration}</span>
                </div>
              </div>

              <Button onClick={startSession} size="lg" className="w-full bg-amber-600 hover:bg-amber-700">
                <Zap className="h-4 w-4 mr-2" />
                Start Ideation Session
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Ideation view
  if (currentView === "ideate") {
    const currentCard = STRATEGY_CARDS[currentCardIndex]
    const activeIdeas = session.ideas.filter((idea) => idea.status === "active")

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-medium text-gray-800">{session.title}</h1>
              <Badge variant="outline">{activeIdeas.length} ideas</Badge>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-amber-600">{formatTime(session.timer)}</div>
                <div className="text-xs text-gray-600">remaining</div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSession({ ...session, isTimerRunning: !session.isTimerRunning })}
              >
                {session.isTimerRunning ? "Pause" : "Resume"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const activeIdeas = session.ideas.filter((idea) => idea.status === "active")
                  if (activeIdeas.length >= 2) {
                    setCurrentView("compare")
                  } else {
                    alert("You need at least 2 active ideas to start ranking")
                  }
                }}
              >
                Review Ideas
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Strategy Card */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-4">
                <Card className="border-2 border-amber-200 bg-amber-50">
                  <CardContent className="p-6">
                    <div className="text-center space-y-4">
                      <div className="text-4xl">{getCategoryIcon(currentCard.category)}</div>
                      <h2 className="text-sm font-medium text-gray-600 uppercase tracking-wide">Strategy Card</h2>
                      <p className="text-xl font-semibold text-gray-800 leading-relaxed">{currentCard.text}</p>
                      <div className="flex items-center justify-center space-x-2">
                        <Badge className={getDifficultyColor(currentCard.difficulty)}>{currentCard.difficulty}</Badge>
                        <Badge variant="outline">{currentCard.category}</Badge>
                      </div>
                      <Button onClick={newCard} variant="outline" className="w-full mt-4 bg-transparent">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Next Card
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">How to Use</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-600 space-y-2">
                    <p>
                      Let this strategy card guide your thinking. It doesn't need to be literal—use it as inspiration.
                    </p>
                    <p>Write down any ideas that come to mind, no matter how wild or impractical they seem.</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Idea Capture */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BookOpen className="h-5 w-5" />
                    <span>Capture Your Ideas</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {showFileUpload && (
                    <div className="border-t pt-4">
                      <FileUpload onFileUpload={handleFileUpload} />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Idea</label>
                    <Textarea
                      placeholder="Write your idea here... anything goes!"
                      value={currentIdea}
                      onChange={(e) => setCurrentIdea(e.target.value)}
                      className="min-h-32"
                      disabled={!session.isTimerRunning && session.timer === 0}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes & Context (optional)</label>
                    <Textarea
                      placeholder="Add any notes about where this came from or what you're thinking..."
                      value={currentNotes}
                      onChange={(e) => setCurrentNotes(e.target.value)}
                      className="min-h-20"
                      disabled={!session.isTimerRunning && session.timer === 0}
                    />
                  </div>

                  {sessionUploadedFiles.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-amber-900 mb-2">Attached files:</p>
                      <div className="space-y-1">
                        {sessionUploadedFiles.map((file) => (
                          <p key={file.url} className="text-xs text-amber-800">
                            {file.name}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      onClick={addIdea}
                      disabled={!currentIdea.trim() || (!session.isTimerRunning && session.timer === 0)}
                      className="flex-1 bg-amber-600 hover:bg-amber-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Idea
                    </Button>
                    <Button
                      onClick={() => setShowFileUpload(!showFileUpload)}
                      variant="outline"
                      size="icon"
                      className="bg-transparent"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button onClick={newCard} variant="outline" className="flex-1 bg-transparent">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      New Card
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Ideas Grid */}
              {activeIdeas.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Ideas Captured</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {activeIdeas.map((idea) => (
                        <div
                          key={idea.id}
                          className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">
                                {getCategoryIcon(STRATEGY_CARDS.find((c) => c.id === idea.cardId)?.category || "")}
                              </span>
                              <span className="text-xs text-gray-500">
                                {new Date(idea.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => selectIdea(idea.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Heart className="h-4 w-4 text-gray-400 hover:text-red-500" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => discardIdea(idea.id)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-600" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-gray-800 mb-2">{idea.content}</p>
                          {idea.notes && <p className="text-xs text-gray-600 italic">"{idea.notes}"</p>}
                          {idea.attachedFiles && idea.attachedFiles.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-200">
                              <p className="text-xs text-gray-600 font-medium">Attachments:</p>
                              <div className="text-xs text-gray-500 space-y-1">
                                {idea.attachedFiles.map((file) => (
                                  <a key={file.url} href={file.url} target="_blank" rel="noopener noreferrer">
                                    {file.name}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Review view
  if (currentView === "review") {
    const activeIdeas = session.ideas.filter((idea) => idea.status === "active")
    const selectedIdeas = session.ideas.filter((idea) => idea.status === "selected")
    const discardedIdeas = session.ideas.filter((idea) => idea.status === "discarded")

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-medium text-gray-800">{session.title}</h1>
              <Badge variant="outline">{session.ideas.length} total ideas</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setCurrentView("ideate")} variant="outline" size="sm">
                Continue Ideating
              </Button>
              <Button onClick={() => setSession(null)} variant="outline" size="sm">
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
                  <Card key={idea.id} className="opacity-75 hover:opacity-100 transition-opacity">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Archive className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-xs text-gray-500">Discarded from "{idea.cardText}"</p>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => selectIdea(idea.id)}>
                          Restore
                        </Button>
                      </div>
                      <p className="text-gray-700 line-through">{idea.content}</p>
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
    const activeIdeas = session.ideas.filter((idea) => idea.status === "active")

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-medium text-gray-800">{session.title}</h1>
              <Badge className="bg-amber-500">
                <Layout className="h-3 w-3 mr-1" />
                Comparative Judgment
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentView("ideate")
              }}
            >
              Back to Ideating
            </Button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          <ComparativeJudgment ideas={activeIdeas} onRankingComplete={handleRankingComplete} />
        </div>
      </div>
    )
  }

  if (currentView === "ranked") {
    const rankedIdeas = [...session.ideas].sort((a, b) => (b.thurstoneScore || 0) - (a.thurstoneScore || 0))

    console.log(
      "[v0] Rendering ranked view:",
      rankedIdeas.map((i) => ({
        content: i.content,
        wins: i.wins,
        thurstoneScore: i.thurstoneScore,
      })),
    )

    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="bg-white border-b border-orange-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-lg font-medium text-gray-800">{session.title}</h1>
              <Badge className="bg-amber-500">
                <Trophy className="h-3 w-3 mr-1" />
                Ranked
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setCurrentView("dashboard")} variant="outline" size="sm">
                <Home className="h-4 w-4 mr-2" />
                Dashboard
              </Button>
              <Button
                onClick={() => {
                  setSession(null)
                  setCurrentView("setup")
                }}
                variant="outline"
                size="sm"
              >
                New Session
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-amber-600" />
                <span>Your Ideas Ranked</span>
              </CardTitle>
              <p className="text-sm text-gray-600 mt-2">
                Ranked using Thurstone's Law of Comparative Judgment (Case V) - a statistical model that produces
                interval-scaled scores from pairwise comparisons.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rankedIdeas.map((idea, idx) => (
                  <Card
                    key={idea.id}
                    className={`${
                      idx === 0
                        ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400"
                        : idx === 1
                          ? "bg-orange-50 border-orange-200"
                          : idx === 2
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-white"
                    }`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Badge
                            variant="outline"
                            className={`text-lg font-bold ${
                              idx === 0
                                ? "bg-amber-500 text-white border-amber-600"
                                : idx === 1
                                  ? "bg-orange-400 text-white border-orange-500"
                                  : idx === 2
                                    ? "bg-yellow-400 text-white border-yellow-500"
                                    : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            #{idx + 1}
                          </Badge>
                          {idx < 3 && (
                            <Award
                              className={`h-5 w-5 ${
                                idx === 0 ? "text-amber-500" : idx === 1 ? "text-orange-400" : "text-yellow-500"
                              }`}
                            />
                          )}
                        </div>
                        <Button
                          onClick={() => sendToMisfits(idea)}
                          variant="outline"
                          size="sm"
                          className="text-purple-600 hover:bg-purple-50"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Send to Island of Misfits
                        </Button>
                      </div>

                      <p className="text-lg font-medium text-gray-800 mb-2">{idea.content}</p>
                      {idea.notes && <p className="text-sm text-gray-600 italic mb-3">"{idea.notes}"</p>}

                      <div className="flex items-center space-x-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">μ (Thurstone score):</span>
                          <Badge variant="secondary">{idea.thurstoneScore?.toFixed(3) || "0.000"}</Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">Wins:</span>
                          <Badge variant="outline">{idea.wins || 0}</Badge>
                        </div>
                      </div>

                      {idea.attachedFiles && idea.attachedFiles.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-medium text-gray-600 mb-2">Attached files:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {idea.attachedFiles.map((file) => {
                              const isImage = file.type.startsWith("image/")
                              const isVideo = file.type.startsWith("video/")
                              const isAudio = file.type.startsWith("audio/")

                              return (
                                <div key={file.url} className="border border-gray-200 rounded p-2">
                                  {isImage && (
                                    <img
                                      src={file.url || "/placeholder.svg"}
                                      alt={file.name}
                                      className="w-full h-32 object-cover rounded"
                                    />
                                  )}
                                  {isVideo && (
                                    <video src={file.url} controls className="w-full h-32 rounded">
                                      Your browser does not support video.
                                    </video>
                                  )}
                                  {isAudio && (
                                    <div className="bg-gray-50 p-4 rounded">
                                      <audio src={file.url} controls className="w-full">
                                        Your browser does not support audio.
                                      </audio>
                                    </div>
                                  )}
                                  {!isImage && !isVideo && !isAudio && (
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      {file.name}
                                    </a>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return null
}
