"use client"

import type React from "react"

import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  Target,
  Lightbulb,
  ArrowRight,
  Clock,
  FileText,
  RotateCcw,
  AlertCircle,
  Plus,
  Edit3,
  AlertTriangle,
  Zap,
  Trophy,
  Gauge,
  Home,
  User,
  Gamepad2,
  LogIn,
  UserPlus,
  LogOut,
} from "lucide-react"

import PreWritingIdeation from "@/components/pre-writing-ideation"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import { migrateAllLocalStorageData } from "@/lib/migrate-localStorage"

type CoachMode = "normal" | "baymax" | "edna"

interface Task {
  id: string
  title: string
  description: string
  focus: string
  duration: number
  suggestedDuration: number
  completed: boolean
  feedback?: string
  userWork?: string
  completedAt?: Date
  needsImprovement?: boolean
  attempts?: number
  isSubtask?: boolean
  parentTaskId?: string
  subtasks?: Task[]
  actionablePoints?: string[]
}

interface Project {
  id: string
  name: string
  description: string
  tasks: Task[]
  currentTaskIndex: number
  skipsUsed: number
  completedWork: string[]
  createdAt: Date
  coachMode: CoachMode
}

interface TypingStats {
  wpm: number
  charactersTyped: number
  timeElapsed: number
  lastKeystroke: number
}

// Removed duplicate User interface definition
// interface User {
//   id: string
//   email: string
//   name: string
//   createdAt: Date
// }

export default function WritingCoachApp() {
  const [user, setUser] = useState<User | null>(null)
  const [authMode, setAuthMode] = useState<"login" | "signup" | "reset">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [authError, setAuthError] = useState("")
  const [resetEmailSent, setResetEmailSent] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projectDescription, setProjectDescription] = useState("")
  const [projectName, setProjectName] = useState("")
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  const [isReformulatingTasks, setIsReformulatingTasks] = useState(false)
  const [currentState, setCurrentState] = useState<
    "auth" | "tool-select" | "dashboard" | "setup" | "working" | "evaluating" | "completed"
  >("auth")
  const [selectedTool, setSelectedTool] = useState<"writing-coach" | "pre-writing" | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [taskInput, setTaskInput] = useState("")
  const [backspaceDisabled, setBackspaceDisabled] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [showNextButton, setShowNextButton] = useState(false)
  const [showRedoButton, setShowRedoButton] = useState(false)
  const [showCreateTaskButton, setShowCreateTaskButton] = useState(false)
  const [activeTab, setActiveTab] = useState("current")
  const [customDuration, setCustomDuration] = useState<number[]>([20])
  const [previousWork, setPreviousWork] = useState("")
  const [allDraftWork, setAllDraftWork] = useState("")
  const [coachMode, setCoachMode] = useState<CoachMode>("normal")
  const [gameMode, setGameMode] = useState(false)
  const [typingStats, setTypingStats] = useState<TypingStats>({
    wpm: 0,
    charactersTyped: 0,
    timeElapsed: 0,
    lastKeystroke: Date.now(),
  })

  const [isChunking, setIsChunking] = useState(false)

  const typingStartTime = useRef<number>(0)
  const lastInputLength = useRef<number>(0)

  // Save navigation state to localStorage when it changes
  useEffect(() => {
    if (user && currentState !== "auth") {
      localStorage.setItem("app-navigation-state", currentState)
    } else {
      localStorage.removeItem("app-navigation-state")
    }
  }, [currentState, user])

  useEffect(() => {
    if (user && selectedTool) {
      localStorage.setItem("app-selected-tool", selectedTool)
    } else {
      localStorage.removeItem("app-selected-tool")
    }
  }, [selectedTool, user])

  // Load user session and projects from Supabase on mount
  useEffect(() => {
    const loadSessionAndProjects = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        
        // Restore navigation state ONLY after confirming user is authenticated
        const savedState = localStorage.getItem("app-navigation-state")
        const savedTool = localStorage.getItem("app-selected-tool")
        
        if (savedState && savedState !== "auth") {
          setCurrentState(savedState as any)
        } else {
          setCurrentState("tool-select")
        }
        
        if (savedTool) {
          setSelectedTool(savedTool as any)
        }
        
        await loadProjectsFromSupabase(session.user.id)
      } else {
        // No session, clear everything
        setUser(null)
        setCurrentState("auth")
        setSelectedTool(null)
        localStorage.removeItem("app-navigation-state")
        localStorage.removeItem("app-selected-tool")
      }
    }

    loadSessionAndProjects()

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user)
        
        // Restore navigation state ONLY after confirming user is authenticated
        const savedState = localStorage.getItem("app-navigation-state")
        const savedTool = localStorage.getItem("app-selected-tool")
        
        if (savedState && savedState !== "auth") {
          setCurrentState(savedState as any)
        } else {
          setCurrentState("tool-select")
        }
        
        if (savedTool) {
          setSelectedTool(savedTool as any)
        }
        
        // Check if migration is needed (localStorage has data but Supabase doesn't)
        const hasLocalStorageData =
          localStorage.getItem(`writing-coach-projects-${session.user.id}`) ||
          localStorage.getItem("ideation-sessions") ||
          localStorage.getItem("misfit-ideas")
        
        if (hasLocalStorageData) {
          // Check if data already exists in Supabase
          const { data: existingProjects } = await supabase
            .from("projects")
            .select("id")
            .eq("user_id", session.user.id)
            .limit(1)
          
          // Only migrate if localStorage has data but Supabase doesn't
          if (!existingProjects || existingProjects.length === 0) {
            try {
              const result = await migrateAllLocalStorageData(session.user.id)
              console.log("Migration completed:", result)
            } catch (error) {
              console.error("Migration error:", error)
            }
          }
        }
        
        await loadProjectsFromSupabase(session.user.id)
      } else {
        setUser(null)
        setCurrentState("auth")
        setSelectedTool(null)
        setProjects([])
        setCurrentProject(null)
        // Clear navigation state on logout
        localStorage.removeItem("app-navigation-state")
        localStorage.removeItem("app-selected-tool")
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Load projects from Supabase
  const loadProjectsFromSupabase = async (userId: string) => {
    try {
      const { data: projectsData, error } = await supabase
        .from("projects")
        .select("*, tasks(*)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading projects:", error)
        return
      }

      if (projectsData) {
        const formattedProjects: Project[] = projectsData.map((p: any) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          coachMode: p.coach_mode as CoachMode,
          currentTaskIndex: p.current_task_index,
          skipsUsed: p.skips_used,
          completedWork: p.completed_work || [],
          createdAt: new Date(p.created_at),
          tasks: (p.tasks || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description,
            focus: t.focus,
            duration: t.duration,
            suggestedDuration: t.suggested_duration,
            completed: t.completed,
            feedback: t.feedback || undefined,
            userWork: t.user_work || undefined,
            completedAt: t.completed_at ? new Date(t.completed_at) : undefined,
            needsImprovement: t.needs_improvement,
            attempts: t.attempts,
            parentTaskId: t.parent_task_id || undefined,
            actionablePoints: t.actionable_points || [],
            subtasks: [], // Will be populated from parent_task_id relationships
          })),
        }))

        // Build subtask relationships
        formattedProjects.forEach((project) => {
          project.tasks.forEach((task) => {
            if (task.parentTaskId) {
              const parentTask = project.tasks.find((t) => t.id === task.parentTaskId)
              if (parentTask) {
                if (!parentTask.subtasks) {
                  parentTask.subtasks = []
                }
                parentTask.subtasks.push(task)
              }
            }
          })
        })

        setProjects(formattedProjects)
      }
    } catch (error) {
      console.error("Error loading projects:", error)
    }
  }

  // Save project to Supabase
  const saveProjectToSupabase = async (project: Project) => {
    if (!user) return

    try {
      // Upsert project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .upsert(
          {
            id: project.id,
            user_id: user.id,
            name: project.name,
            description: project.description,
            coach_mode: project.coachMode,
            current_task_index: project.currentTaskIndex,
            skips_used: project.skipsUsed,
            completed_work: project.completedWork,
            created_at: project.createdAt.toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single()

      if (projectError) {
        console.error("Error saving project:", projectError)
        return
      }

      // Delete existing tasks for this project
      await supabase.from("tasks").delete().eq("project_id", project.id)

      // Insert all tasks
      if (project.tasks.length > 0) {
        const tasksToInsert = project.tasks.flatMap((task) => {
          const baseTask = {
            id: task.id,
            project_id: project.id,
            title: task.title,
            description: task.description,
            focus: task.focus,
            duration: task.duration,
            suggested_duration: task.suggestedDuration,
            completed: task.completed,
            user_work: task.userWork || null,
            feedback: task.feedback || null,
            completed_at: task.completedAt ? task.completedAt.toISOString() : null,
            needs_improvement: task.needsImprovement,
            attempts: task.attempts,
            parent_task_id: task.parentTaskId || null,
            actionable_points: task.actionablePoints || [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }

          // Include subtasks as separate records
          const allTasks = [baseTask]
          if (task.subtasks && task.subtasks.length > 0) {
            task.subtasks.forEach((subtask) => {
              allTasks.push({
                id: subtask.id,
                project_id: project.id,
                title: subtask.title,
                description: subtask.description,
                focus: subtask.focus,
                duration: subtask.duration,
                suggested_duration: subtask.suggestedDuration,
                completed: subtask.completed,
                user_work: subtask.userWork || null,
                feedback: subtask.feedback || null,
                completed_at: subtask.completedAt ? subtask.completedAt.toISOString() : null,
                needs_improvement: subtask.needsImprovement,
                attempts: subtask.attempts,
                parent_task_id: task.id,
                actionable_points: subtask.actionablePoints || [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            })
          }
          return allTasks
        })

        const { error: tasksError } = await supabase.from("tasks").insert(tasksToInsert.flat())

        if (tasksError) {
          console.error("Error saving tasks:", tasksError)
        }
      }
    } catch (error) {
      console.error("Error saving project:", error)
    }
  }

  // Save projects to Supabase whenever projects change (debounced to avoid excessive saves)
  useEffect(() => {
    if (projects.length > 0 && user) {
      // Debounce saves to avoid too many database calls
      const timeoutId = setTimeout(async () => {
        try {
          // Save all projects
          await Promise.all(projects.map((project) => saveProjectToSupabase(project)))
        } catch (error) {
          console.error("Error saving projects:", error)
        }
      }, 1000) // Save 1 second after last change

      return () => clearTimeout(timeoutId)
    }
  }, [projects, user])

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            handleTimeUp()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timeRemaining])

  // Typing stats tracking
  useEffect(() => {
    if (gameMode && isTimerRunning && taskInput.length > lastInputLength.current) {
      const now = Date.now()
      if (typingStartTime.current === 0) {
        typingStartTime.current = now
      }

      const timeElapsed = (now - typingStartTime.current) / 1000 / 60 // minutes
      const charactersTyped = taskInput.length
      const wpm = timeElapsed > 0 ? Math.round(charactersTyped / 5 / timeElapsed) : 0

      setTypingStats({
        wpm,
        charactersTyped,
        timeElapsed: timeElapsed * 60, // back to seconds
        lastKeystroke: now,
      })
    }
    lastInputLength.current = taskInput.length
  }, [taskInput, gameMode, isTimerRunning])

  // Reset typing stats when starting new task
  useEffect(() => {
    if (isTimerRunning) {
      typingStartTime.current = 0
      setTypingStats({
        wpm: 0,
        charactersTyped: 0,
        timeElapsed: 0,
        lastKeystroke: Date.now(),
      })
    }
  }, [isTimerRunning])

  // Backspace prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (backspaceDisabled && e.key === "Backspace" && e.target instanceof HTMLTextAreaElement) {
        e.preventDefault()
      }
    }

    if (backspaceDisabled) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [backspaceDisabled])

  // Update consolidated draft work whenever project changes
  useEffect(() => {
    if (currentProject) {
      const draftContent = currentProject.tasks
        .filter((task) => task.focus === "draft" && task.userWork && task.completed)
        .map((task) => task.userWork)
        .join("\n\n")
      setAllDraftWork(draftContent)
    }
  }, [currentProject])

  // Password validation helper
  const isStrongPassword = (password: string): boolean => {
    return /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(password)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError("")

    if (authMode === "signup") {
      if (!name.trim() || !email.trim() || !password.trim()) {
        setAuthError("Please fill in all fields")
        return
      }

      // Validate password strength
      if (!isStrongPassword(password)) {
        setAuthError("Password must be at least 8 characters and include a number and a capital letter")
        return
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      })

      if (error) {
        if (error.message.toLowerCase().includes("user already registered") || error.message.toLowerCase().includes("already")) {
          setAuthError("User with this email already exists")
        } else {
          setAuthError(error.message)
        }
        return
      }

      if (data.user) {
        setUser(data.user)
        setCurrentState("tool-select")
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setAuthError("Please fill in all fields")
        return
      }

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setAuthError(error.message || "Invalid email or password")
        return
      }

      if (data.user) {
        setUser(data.user)
        setCurrentState("tool-select")
        // Projects will be loaded separately via Supabase queries
      }
    }

    // Reset form
    setEmail("")
    setPassword("")
    setName("")
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
      redirectTo: `${window.location.origin}/auth/reset`,
    })

    if (error) {
      setAuthError(error.message)
      return
    }

    setResetEmailSent(true)
  }

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Error signing out:", error)
        return
      }
      
      // Clear all state
      setUser(null)
      setProjects([])
      setCurrentProject(null)
      setCurrentState("auth")
      setSelectedTool(null)
      setEmail("")
      setPassword("")
      setName("")
      setAuthError("")
      setResetEmailSent(false)
      
      // Clear navigation state from localStorage
      localStorage.removeItem("app-navigation-state")
      localStorage.removeItem("app-selected-tool")
    } catch (error) {
      console.error("Error during logout:", error)
    }
  }

  const getCoachPersonality = (mode: CoachMode) => {
    switch (mode) {
      case "baymax":
        return {
          name: "Baymax",
          taskStyle: "gentle, supportive, and methodical with healthcare robot terminology",
          feedbackStyle: "caring, analytical, with gentle humor and medical/diagnostic language",
          encouragement: "I am programmed to assist with your writing health. You are making progress.",
          examples: [
            "Congratulations. You have completed a messy draft. I will initiate celebration protocol: gentle fist bump. Ba-la-la-la.",
            "You said, 'It must be perfect.' I am unable to locate a diagnostic code for perfect. May I suggest 'done' instead?",
            "You appear to be deleting the same sentence repeatedly. That is called 'looping.' Looping does not complete projects.",
          ],
        }
      case "edna":
        return {
          name: "Edna Mode",
          taskStyle: "direct, no-nonsense, with fashion designer confidence and impatience for perfectionism",
          feedbackStyle: "brutally honest, witty, motivating, with zero tolerance for self-doubt",
          encouragement: "Darling, perfection is the enemy of done. Now MOVE!",
          examples: [
            "You know that little voice whining, 'This isn't good enough'? Give it a name. Brenda. Carl. Whatever. Then tell Brenda to sit down and eat a granola bar while you finish the damn draft.",
            "Oh, sweetie. Sitting there paralyzed because your project isn't perfect yet? Newsflash: you can't edit air. You have to make a mess before you can clean it up.",
            "Stop fussing over the same sentence. Call it done and move on — polishing comes later.",
          ],
        }
      default:
        return {
          name: "Writing Coach",
          taskStyle: "encouraging and professional",
          feedbackStyle: "constructive and supportive",
          encouragement: "You're making great progress. Keep going!",
          examples: [],
        }
    }
  }

  const reformulateTasks = async (project: Project, newCoachMode: CoachMode) => {
    setIsReformulatingTasks(true)
    const taskPersonality = getCoachPersonality(newCoachMode)

    try {
      const prompt = `You are ${taskPersonality.name}, a writing coach. Reformulate these existing writing tasks to match your ${taskPersonality.taskStyle} personality while keeping the same core objectives and structure.

PERSONALITY GUIDELINES:
${
  newCoachMode === "baymax"
    ? `
- Use gentle, medical/diagnostic language
- Be supportive but analytical
- Include healthcare robot terminology
- Show care for the user's "writing health"
- Use phrases like "I detect," "diagnostic," "protocol," "optimal"
`
    : newCoachMode === "edna"
      ? `
- Be direct and no-nonsense
- Show impatience with perfectionism
- Use fashion designer confidence
- Include phrases like "darling," "sweetie" (but not condescending)
- Be brutally honest but motivating
- Zero tolerance for self-doubt
`
      : `
- Be encouraging and professional
- Provide clear, actionable guidance
- Focus on progress over perfection
`
}

IMPORTANT: You must respond with ONLY a valid JSON array. Keep the same task IDs, focus areas, and suggested durations.

Original tasks to reformulate:
${JSON.stringify(
  project.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    focus: task.focus,
    suggestedDuration: task.suggestedDuration,
  })),
)}

Return the same structure but with titles and descriptions rewritten in ${taskPersonality.name}'s voice:
[
  {
    "id": "existing_task_id",
    "title": "Reformulated title in ${taskPersonality.name}'s voice",
    "description": "Reformulated description in ${taskPersonality.name}'s ${taskPersonality.taskStyle} style",
    "focus": "same_focus",
    "suggestedDuration": same_duration
  }
]`

      const response = await fetch("/api/reformulate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to reformulate tasks"
        try {
          const data = await response.json()
          if (data?.error && typeof data.error === "string") {
            errorMessage = data.error
          }
        } catch {
          // ignore JSON parse failures; keep generic message
        }

        throw new Error(errorMessage)
      }

      const { text } = await response.json()

      let cleanedText = text.trim()
      cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
      cleanedText = cleanedText.replace(/```\n?|\n?```/g, "")

      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        cleanedText = jsonMatch[0]
      }

      const reformulatedTasks = JSON.parse(cleanedText)

      if (Array.isArray(reformulatedTasks)) {
        const updatedProject = { ...project, coachMode: newCoachMode }

        // Update tasks with reformulated content while preserving user data
        updatedProject.tasks = updatedProject.tasks.map((task) => {
          const reformulated = reformulatedTasks.find((rt) => rt.id === task.id)
          if (reformulated) {
            return {
              ...task,
              title: reformulated.title,
              description: reformulated.description,
            }
          }
          return task
        })

        setCurrentProject(updatedProject)
        setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
      }
    } catch (error) {
      console.error("Failed to reformulate tasks:", error)
      // Still update the coach mode even if reformulation fails
      const updatedProject = { ...project, coachMode: newCoachMode }
      setCurrentProject(updatedProject)
      setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    }

    setIsReformulatingTasks(false)
  }

  const generateTasks = async () => {
    if (!projectDescription.trim() || !projectName.trim()) return

    setIsGeneratingTasks(true)
    const taskPersonality = getCoachPersonality(coachMode)

    const maxRetries = 3
    let lastError = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
        }

        const prompt = `You are ${taskPersonality.name}, a writing coach with a ${taskPersonality.taskStyle} approach. Break down the following writing project into detailed, manageable WRITING tasks.

PERSONALITY GUIDELINES:
${
  coachMode === "baymax"
    ? `
- Use gentle, medical/diagnostic language
- Be supportive but analytical
- Include healthcare robot terminology
- Show care for the user's "writing health"
- Use phrases like "I detect," "diagnostic," "protocol," "optimal"
`
    : coachMode === "edna"
      ? `
- Be direct and no-nonsense
- Show impatience with perfectionism
- Use fashion designer confidence
- Include phrases like "darling," "sweetie" (but not condescending)
- Be brutally honest but motivating
- Zero tolerance for self-doubt
`
      : `
- Be encouraging and professional
- Provide clear, actionable guidance
- Focus on progress over perfection
`
}

IMPORTANT: You must respond with ONLY a JSON array. No other text.

TASK REQUIREMENTS:
- All tasks involve actual writing, editing, or revising
- Provide specific instructions with clear success criteria
- Break research into "write research notes" or "write summary"
- Turn planning into "write outline" or "write draft structure"
- Make every task actionable with measurable text output

JSON structure:
[
  {
    "id": "task_1",
    "title": "Task Title (in ${taskPersonality.name}'s voice)",
    "description": "Detailed instructions in ${taskPersonality.name}'s ${taskPersonality.taskStyle} style. Include success criteria and examples. Be thorough and helpful while maintaining the personality.",
    "focus": "draft",
    "suggestedDuration": 25
  }
]

Focus areas: outline, draft, edit, review
Descriptions: 50-150 words with specific guidance in character
Duration: vary between 10-45 minutes

Writing project: "${projectDescription}"`

        const response = await fetch("/api/generate-tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        })

        if (!response.ok) {
          let errorMessage = "Failed to generate tasks"
          try {
            const data = await response.json()
            if (data?.error && typeof data.error === "string") {
              errorMessage = data.error
            }
          } catch {
            // ignore JSON parse failures; keep generic message
          }

          throw new Error(errorMessage)
        }

        const { text } = await response.json()

        let cleanedText = text.trim()
        cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
        cleanedText = cleanedText.replace(/```\n?|\n?```/g, "")

        const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }

        let tasks
        try {
          tasks = JSON.parse(cleanedText)
        } catch (parseError) {
          console.error("JSON parse error:", parseError)
          throw new Error("Failed to parse AI response")
        }

        if (!Array.isArray(tasks)) {
          throw new Error("Response is not an array")
        }

        // Create new project
        const newProject: Project = {
          id: Date.now().toString(),
          name: projectName,
          description: projectDescription,
          tasks: tasks.map((task: any, index: number) => ({
            ...task,
            completed: false,
            needsImprovement: false,
            attempts: 0,
            duration: task.suggestedDuration || 20,
            id: task.id || `task_${index + 1}`,
            subtasks: [],
          })),
          currentTaskIndex: 0,
          skipsUsed: 0,
          completedWork: [],
          createdAt: new Date(),
          coachMode: coachMode,
        }

        setProjects((prev) => [...prev, newProject])
        setCurrentProject(newProject)
        setCurrentState("working")
        setCustomDuration([newProject.tasks[0].suggestedDuration])
        startCurrentTask(newProject)
        setIsGeneratingTasks(false)
        return
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error)
        lastError = error

        if (attempt < maxRetries) {
          continue
        }
      }
    }

    // Fallback tasks with personality
    console.error("All attempts failed, using fallback tasks")

    const fallbackTasks = [
      {
        id: "task_1",
        title:
          coachMode === "baymax"
            ? "Diagnostic Phase: Research Documentation Protocol"
            : coachMode === "edna"
              ? "Research Phase - No Dawdling, Darling"
              : "Write Research Notes and Key Points",
        description:
          coachMode === "baymax"
            ? "I detect a need for comprehensive research documentation. Please compile 400-600 words of research notes. Focus on 5-7 key sources, documenting main points, statistics, and quotes. Organize systematically by themes or chronologically. Optimal completion criteria: Clear source citations, key facts highlighted, personal insights noted, actionable information extracted for your writing health."
            : coachMode === "edna"
              ? "Listen, sweetie, research without notes is just procrastination with extra steps. Write 400-600 words of research notes NOW. Focus on 5-7 key sources, summarize main points, statistics, quotes. Organize by themes or chronologically. Good completion: Clear citations, key facts highlighted, insights noted. No perfectionist dawdling - just get the information down!"
              : "Research your topic and write comprehensive notes (400-600 words). Focus on 5-7 key sources, summarizing main points, statistics, and quotes. Organize by themes or chronologically. Good completion: Clear source citations, personal insights noted, actionable information extracted for your writing.",
        focus: "research",
        duration: 25,
        suggestedDuration: 25,
        completed: false,
        needsImprovement: false,
        attempts: 0,
        subtasks: [],
      },
    ]

    const fallbackProject: Project = {
      id: Date.now().toString(),
      name: projectName,
      description: projectDescription,
      tasks: fallbackTasks,
      currentTaskIndex: 0,
      skipsUsed: 0,
      completedWork: [],
      createdAt: new Date(),
      coachMode: coachMode,
    }

    setProjects((prev) => [...prev, fallbackProject])
    setCurrentProject(fallbackProject)
    setCurrentState("working")
    setCustomDuration([fallbackTasks[0].suggestedDuration])
    startCurrentTask(fallbackProject)
    setIsGeneratingTasks(false)
  }

  const startCurrentTask = (proj: Project = currentProject!) => {
    const currentTask = proj.tasks[proj.currentTaskIndex]
    if (currentTask) {
      setTimeRemaining(currentTask.duration * 60)
      setPreviousWork("")
      setTaskInput(currentTask.userWork || "")
      setIsTimerRunning(true)
      setShowNextButton(false)
      setShowRedoButton(false)
      setShowCreateTaskButton(false)

      // Auto-enable backspace lock for draft tasks
      if (currentTask.focus === "draft" && !currentTask.userWork) {
        setBackspaceDisabled(true)
      }

      // Enable game mode for draft tasks by default
      if (currentTask.focus === "draft") {
        setGameMode(true)
      }
    }
  }

  const handleTimeUp = async () => {
    setCurrentState("evaluating")
    await evaluateProgress()
  }

  const evaluateProgress = async () => {
    if (!currentProject) return

    setIsEvaluating(true)
    const currentTask = currentProject.tasks[currentProject.currentTaskIndex]
    const evalPersonality = getCoachPersonality(currentProject.coachMode)

    const maxRetries = 2
    let evaluation = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt))
        }

        const prompt = `You are ${evalPersonality.name} evaluating writing work. Provide feedback in your ${evalPersonality.feedbackStyle} style.

PERSONALITY GUIDELINES:
${
  currentProject.coachMode === "baymax"
    ? `
- Use gentle, medical/diagnostic language
- Be supportive but analytical ("I detect...", "diagnostic indicates...", "optimal progress would be...")
- Show care for their "writing health"
- Use healthcare robot terminology
- Be encouraging but factual
`
    : currentProject.coachMode === "edna"
      ? `
- Be direct and brutally honest
- Show zero tolerance for perfectionism
- Use fashion designer confidence
- Include "darling," "sweetie" but not condescending
- Be motivating through tough love
- Call out self-doubt immediately
`
      : `
- Be encouraging and professional
- Provide constructive feedback
- Focus on progress over perfection
`
}

CRITICAL: Respond with ONLY valid JSON. No explanations before or after. Just the JSON object.

Task details:
- Title: ${currentTask.title}
- Duration: ${currentTask.duration} minutes
- Focus: ${currentTask.focus}
- User's work: "${taskInput || "No input provided"}"
- Word count: ${taskInput.trim().split(/\s+/).length} words

Return EXACTLY this JSON structure (no markdown, no additional text):
{
  "feedback": "Brief overall assessment in ${evalPersonality.name}'s voice (max 30 words)",
  "actionablePoints": [
    "Specific action item 1 in ${evalPersonality.name}'s style",
    "Specific action item 2 in ${evalPersonality.name}'s style",
    "Specific action item 3 in ${evalPersonality.name}'s style",
    "Specific action item 4 in ${evalPersonality.name}'s style",
    "Specific action item 5 in ${evalPersonality.name}'s style"
  ],
  "shouldContinue": true,
  "qualityScore": 7,
  "needsImprovement": false,
  "suggestNewTask": false,
  "newTaskSuggestion": ""
}

Provide EXACTLY 5 actionable points. Evaluate if the work is sufficient for a ${currentTask.duration}-minute task.`

        const response = await fetch("/api/evaluate-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        })

        if (!response.ok) {
          let errorMessage = "Failed to evaluate progress"
          try {
            const data = await response.json()
            if (data?.error && typeof data.error === "string") {
              errorMessage = data.error
            }
          } catch {
            // ignore JSON parse failures; keep generic message
          }

          throw new Error(errorMessage)
        }

        const { text } = await response.json()

        let cleanedText = text.trim()
        cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
        cleanedText = cleanedText.replace(/```\n?|\n?```/g, "")

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }

        evaluation = JSON.parse(cleanedText)

        // Ensure exactly 5 actionable points
        if (evaluation.actionablePoints && evaluation.actionablePoints.length > 5) {
          evaluation.actionablePoints = evaluation.actionablePoints.slice(0, 5)
        }

        break
      } catch (error) {
        console.error(`Evaluation attempt ${attempt} failed:`, error)

        if (attempt === maxRetries) {
          // Use a more detailed fallback based on word count
          const wordCount = taskInput.trim().split(/\s+/).length
          const hasSubstantialWork = wordCount >= 50

          evaluation = {
            feedback:
              currentProject.coachMode === "baymax"
                ? hasSubstantialWork
                  ? "I detect good effort. Progress indicators are positive."
                  : "I detect minimal output. Optimal progress requires more content."
                : currentProject.coachMode === "edna"
                  ? hasSubstantialWork
                    ? "Not terrible, darling. But we can do better."
                    : "Sweetie, this isn't enough. I need to see more work!"
                  : hasSubstantialWork
                    ? "Good effort! Let's refine this work further."
                    : "This needs more work. Let's add more content.",
            actionablePoints:
              currentProject.coachMode === "baymax"
                ? [
                    "I recommend adding more specific details to support your main diagnostic points",
                    "Optimal flow requires improved transitions between paragraphs",
                    "Your opening requires a more engaging hook for better reader health",
                    "Include concrete examples to illustrate your ideas more effectively",
                    "I detect grammar and spelling errors that need correction protocol",
                  ]
                : currentProject.coachMode === "edna"
                  ? [
                      "Add more specific details, sweetie - vague won't cut it",
                      "Fix those choppy transitions between paragraphs - make it flow!",
                      "Your opening is boring. Give me a hook that grabs attention!",
                      "Where are your examples? Show, don't just tell, darling",
                      "Grammar errors detected. Clean them up - no excuses!",
                    ]
                  : [
                      "Add more specific details to support your main points",
                      "Improve transitions between paragraphs for better flow",
                      "Strengthen your opening with a more engaging hook",
                      "Include concrete examples to illustrate your ideas",
                      "Check for grammar and spelling errors throughout",
                    ],
            shouldContinue: hasSubstantialWork,
            qualityScore: hasSubstantialWork ? 6 : 3,
            needsImprovement: !hasSubstantialWork,
            suggestNewTask: false,
            newTaskSuggestion: "",
          }
        }
      }
    }

    const updatedProject = { ...currentProject }
    const currentTaskIndex = currentProject.currentTaskIndex

    updatedProject.tasks[currentTaskIndex].feedback = evaluation.feedback
    updatedProject.tasks[currentTaskIndex].attempts = (updatedProject.tasks[currentTaskIndex].attempts || 0) + 1

    if (evaluation.shouldContinue && !evaluation.needsImprovement) {
      updatedProject.tasks[currentTaskIndex].completed = true
      updatedProject.tasks[currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
      updatedProject.tasks[currentTaskIndex].completedAt = new Date()
      updatedProject.tasks[currentTaskIndex].needsImprovement = false
      updatedProject.completedWork.push(taskInput)
      setShowNextButton(true)
      setShowRedoButton(false)
      setShowCreateTaskButton(false)
    } else {
      updatedProject.tasks[currentTaskIndex].needsImprovement = true
      updatedProject.tasks[currentTaskIndex].completed = false
      updatedProject.tasks[currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
      updatedProject.tasks[currentTaskIndex].actionablePoints = evaluation.actionablePoints

      setShowNextButton(false)
      setShowRedoButton(true)
      setShowCreateTaskButton(evaluation.suggestNewTask || false)
    }

    setCurrentProject(updatedProject)
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    
    // Immediately save when a task is completed
    if (evaluation.shouldContinue && !evaluation.needsImprovement) {
      saveProjectToSupabase(updatedProject).catch((error) => {
        console.error("Error saving completed task:", error)
      })
    }
    
    setIsEvaluating(false)
  }

  const handleNextStep = () => {
    if (!currentProject) return

    const updatedProject = { ...currentProject }
    updatedProject.currentTaskIndex += 1

    setCurrentProject(updatedProject)
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)

    if (updatedProject.currentTaskIndex >= updatedProject.tasks.length) {
      setCurrentState("completed")
    } else {
      const nextTask = updatedProject.tasks[updatedProject.currentTaskIndex]
      setCustomDuration([nextTask.suggestedDuration])
      startCurrentTask(updatedProject)
    }
  }

  const handleRedoTask = () => {
    if (!currentProject) return

    const updatedProject = { ...currentProject }
    updatedProject.tasks[currentProject.currentTaskIndex].needsImprovement = false

    setCurrentProject(updatedProject)
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    setCurrentState("working")
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
    startCurrentTask(updatedProject)
  }

  const skipTask = () => {
    if (!currentProject || currentProject.skipsUsed >= 3) return

    const updatedProject = { ...currentProject }
    updatedProject.skipsUsed += 1
    updatedProject.currentTaskIndex += 1

    setCurrentProject(updatedProject)
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    setIsTimerRunning(false)

    if (updatedProject.currentTaskIndex >= updatedProject.tasks.length) {
      setCurrentState("completed")
    } else {
      const nextTask = updatedProject.tasks[updatedProject.currentTaskIndex]
      setCustomDuration([nextTask.suggestedDuration])
      startCurrentTask(updatedProject)
    }
  }

  const handleCompleteEarly = async () => {
    setIsTimerRunning(false)
    setTimeRemaining(0)
    setCurrentState("evaluating")
    await evaluateProgress()
  }

  const pauseTimer = () => {
    setIsTimerRunning(!isTimerRunning)
  }

  const resetToSetup = () => {
    setCurrentProject(null)
    setProjectDescription("")
    setProjectName("")
    setCurrentState("setup")
    setTimeRemaining(0)
    setIsTimerRunning(false)
    setTaskInput("")
    setPreviousWork("")
    setAllDraftWork("")
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
    setActiveTab("current")
    setCustomDuration([20])
    setBackspaceDisabled(false)
    setGameMode(false)
  }

  const goToDashboard = () => {
    setCurrentState("dashboard")
    setCurrentProject(null)
  }

  const selectProject = (project: Project) => {
    setCurrentProject(project)
    setCoachMode(project.coachMode)
    setCurrentState("working")
    setActiveTab("current")
    const currentTask = project.tasks[project.currentTaskIndex]
    if (currentTask) {
      setCustomDuration([currentTask.suggestedDuration])
      startCurrentTask(project)
    }
  }

  const deleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId))
    if (currentProject?.id === projectId) {
      setCurrentProject(null)
      setCurrentState("dashboard")
    }
  }

  const handleTaskClick = (taskIndex: number) => {
    if (!currentProject) return

    const updatedProject = { ...currentProject }
    updatedProject.currentTaskIndex = taskIndex

    setCurrentProject(updatedProject)
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    setCurrentState("working")
    setActiveTab("current")

    const selectedTask = updatedProject.tasks[taskIndex]
    setCustomDuration([selectedTask.suggestedDuration])
    startCurrentTask(updatedProject)
  }

  const breakTaskIntoChunks = async (task: Task, desiredDuration: number) => {
    // Safety check: don't chunk if desired duration is same or more than suggested
    if (desiredDuration >= task.suggestedDuration) {
      return [{ ...task, duration: desiredDuration }]
    }

    const numChunks = Math.ceil(task.suggestedDuration / desiredDuration)
    const lastChunkDuration = task.suggestedDuration - (numChunks - 1) * desiredDuration

    console.log(`[v0] Breaking task into ${numChunks} chunks of ${desiredDuration} minutes each`)

    try {
      const response = await fetch("/api/break-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            title: task.title,
            description: task.description,
            focus: task.focus,
            suggestedDuration: task.suggestedDuration,
          },
          numChunks,
          chunkDuration: desiredDuration,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to break task")
      }

      const data = await response.json()

      if (!data.subtasks || !Array.isArray(data.subtasks)) {
        throw new Error("Invalid response structure")
      }

      console.log(`[v0] Successfully generated ${data.subtasks.length} distinct subtasks`)

      // Map AI-generated subtasks to our Task structure
      return data.subtasks.map((subtask: any, index: number) => ({
        id: `${task.id}_chunk_${index + 1}`,
        title: subtask.title,
        description: subtask.description,
        focus: subtask.focus || task.focus,
        duration: index === data.subtasks.length - 1 ? lastChunkDuration : desiredDuration,
        suggestedDuration: index === data.subtasks.length - 1 ? lastChunkDuration : desiredDuration,
        isSubtask: true,
        parentTaskId: task.id,
        completed: false,
        needsImprovement: false,
        attempts: 0,
      }))
    } catch (error) {
      console.error("[v0] Error breaking task into chunks:", error)
      throw error // Re-throw to handle in updateTaskDuration
    }
  }

  const updateTaskDuration = async () => {
    if (!currentProject || !currentTask) return

    const newDuration = customDuration[0]

    // Simple duration update if increasing duration
    if (newDuration >= currentTask.suggestedDuration) {
      const updatedProject = { ...currentProject }
      updatedProject.tasks[currentProject.currentTaskIndex].duration = newDuration
      setCurrentProject(updatedProject)
      setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
      setTimeRemaining(newDuration * 60)
      return
    }

    // Break task into chunks
    setIsChunking(true)
    try {
      const chunks = await breakTaskIntoChunks(currentTask, newDuration)

      if (chunks.length > 1) {
        const updatedProject = { ...currentProject }
        // Replace current task with chunks
        updatedProject.tasks.splice(currentProject.currentTaskIndex, 1, ...chunks)
        setCurrentProject(updatedProject)
        setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
        startCurrentTask(updatedProject)
      } else {
        // Single chunk, just update duration
        const updatedProject = { ...currentProject }
        updatedProject.tasks[currentProject.currentTaskIndex].duration = newDuration
        setCurrentProject(updatedProject)
        setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
        setTimeRemaining(newDuration * 60)
      }
    } catch (error) {
      console.error("[v0] Failed to break task:", error)
      alert("Failed to break task into chunks. Please try again.")
    } finally {
      setIsChunking(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getProgressPercentage = (project: Project) => {
    return (project.tasks.filter((t) => t.completed).length / project.tasks.length) * 100
  }

  const getFocusColor = (focus: string) => {
    const colors = {
      research: "bg-blue-100 text-blue-800 border-blue-200",
      outline: "bg-purple-100 text-purple-800 border-purple-200",
      draft: "bg-green-100 text-green-800 border-green-200",
      edit: "bg-orange-100 text-orange-800 border-orange-200",
      review: "bg-red-100 text-red-800 border-red-200",
    }
    return colors[focus as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  const getSpeedColor = (wpm: number) => {
    if (wpm < 20) return "from-red-500 to-red-600"
    if (wpm < 40) return "from-orange-500 to-yellow-500"
    if (wpm < 60) return "from-yellow-500 to-green-500"
    return "from-green-500 to-blue-500"
  }

  const getSpeedMessage = (wpm: number, coachMode: CoachMode) => {
    if (coachMode === "baymax") {
      if (wpm < 20) return "I detect slow typing. This is normal. Continue at your optimal pace."
      if (wpm < 40) return "Typing speed is adequate. You are making progress."
      if (wpm < 60) return "Good typing velocity detected. Your writing health is improving."
      return "Excellent typing speed! I am proud of your progress."
    } else if (coachMode === "edna") {
      if (wpm < 20) return "Darling, my grandmother types faster than this!"
      if (wpm < 40) return "Better, sweetie, but I know you can go faster!"
      if (wpm < 60) return "Now we're talking! Keep that momentum!"
      return "YES! This is the speed I want to see!"
    } else {
      if (wpm < 20) return "Take your time - steady progress is good progress"
      if (wpm < 40) return "Good pace! You're finding your rhythm"
      if (wpm < 60) return "Great speed! You're in the flow"
      return "Excellent! You're flying through this!"
    }
  }

  // Auth View
  if (currentState === "auth") {
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
                  Password reset email sent! Check your inbox and follow the link to reset your password.
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

  if (currentState === "tool-select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-light text-white mb-2">Welcome, {user?.name}</h1>
            <p className="text-slate-400">Choose your writing tool</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Pre-Writing Ideation Card */}
            <div
              onClick={() => {
                setSelectedTool("pre-writing")
                setCurrentState("dashboard")
              }}
              className="group cursor-pointer"
            >
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
            </div>

            {/* Writing Coach Card */}
            <div
              onClick={() => {
                setSelectedTool("writing-coach")
                setCurrentState("dashboard")
              }}
              className="group cursor-pointer"
            >
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
            </div>
          </div>

          <div className="mt-12 flex items-center justify-center">
            <Button
              onClick={handleLogout}
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

  // Dashboard view - route to appropriate tool
  if (currentState === "dashboard") {
    if (selectedTool === "pre-writing") {
      return (
        <PreWritingIdeation
          user={user}
          onLogout={handleLogout}
          onBack={() => {
            setSelectedTool(null)
            setCurrentState("tool-select")
          }}
        />
      )
    }

    // Writing Coach dashboard
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedTool(null)
                  setCurrentState("tool-select")
                }}
              >
                <Home className="h-4 w-4 mr-2" />
                Tool Select
              </Button>
              <Home className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-medium text-gray-800">Writing Coach Dashboard</h1>
              <span className="text-sm text-gray-600">Welcome, {user?.name}!</span>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-600">Coach Mode:</span>
                <Select value={coachMode} onValueChange={(value: CoachMode) => setCoachMode(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="baymax">Baymax</SelectItem>
                    <SelectItem value="edna">Edna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setCurrentState("setup")}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto p-6">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-gray-800 mb-2">No Projects Yet</h2>
              <p className="text-gray-600 mb-6">Create your first writing project to get started!</p>
              <Button onClick={() => setCurrentState("setup")} size="lg">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Project
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <Card key={project.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                      <Badge variant="outline" className="text-xs">
                        {project.coachMode === "baymax"
                          ? "🤖 Baymax"
                          : project.coachMode === "edna"
                            ? "👗 Edna"
                            : "📝 Normal"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700">Progress</span>
                        <span className="text-sm text-gray-600">
                          {project.tasks.filter((t) => t.completed).length}/{project.tasks.length} tasks
                        </span>
                      </div>
                      <Progress value={getProgressPercentage(project)} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Created {project.createdAt.toLocaleDateString()}</span>
                      <span>{project.skipsUsed}/3 skips used</span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button onClick={() => selectProject(project)} className="flex-1" size="sm">
                        {getProgressPercentage(project) === 100 ? "Review" : "Continue"}
                      </Button>
                      <Button
                        onClick={() => deleteProject(project.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Setup View
  if (currentState === "setup") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-light text-gray-800">Create New Project</CardTitle>
            <p className="text-gray-600 mt-2">Break your writing into manageable, guided tasks</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Project Name</label>
              <Input
                type="text"
                placeholder="e.g., Blog Post About Sustainable Living"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Choose Your Coach</label>
              <Select value={coachMode} onValueChange={(value: CoachMode) => setCoachMode(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">
                    <div className="flex items-center space-x-2">
                      <span>📝</span>
                      <div>
                        <div className="font-medium">Normal Coach</div>
                        <div className="text-xs text-gray-500">Encouraging and professional</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="baymax">
                    <div className="flex items-center space-x-2">
                      <span>🤖</span>
                      <div>
                        <div className="font-medium">Baymax</div>
                        <div className="text-xs text-gray-500">Gentle, healthcare robot</div>
                      </div>
                    </div>
                  </SelectItem>
                  <SelectItem value="edna">
                    <div className="flex items-center space-x-2">
                      <span>👗</span>
                      <div>
                        <div className="font-medium">Edna Mode</div>
                        <div className="text-xs text-gray-500">Direct, no-nonsense fashion designer</div>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Describe your writing project</label>
              <Textarea
                placeholder="e.g., Write a 1500-word blog post about sustainable living practices for beginners..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="min-h-32"
              />
            </div>

            <div className="flex space-x-3">
              <Button onClick={goToDashboard} variant="outline" className="flex-1 bg-transparent">
                Back to Dashboard
              </Button>
              <Button
                onClick={generateTasks}
                disabled={!projectDescription.trim() || !projectName.trim() || isGeneratingTasks}
                className="flex-1"
                size="lg"
              >
                {isGeneratingTasks ? "Creating Your Tasks..." : "Start Writing Journey"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Evaluation View
  if (currentState === "evaluating") {
    const currentTask = currentProject?.tasks[currentProject?.currentTaskIndex || 0]
    const viewPersonality = getCoachPersonality(currentProject?.coachMode || "normal")

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl text-center">
          <CardContent className="py-12">
            {isEvaluating ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-medium text-gray-800">
                  {currentProject?.coachMode === "baymax"
                    ? "Running diagnostic analysis..."
                    : currentProject?.coachMode === "edna"
                      ? "Edna is reviewing your work..."
                      : "Evaluating your progress..."}
                </h2>
                <p className="text-gray-600 mt-2">
                  {currentProject?.coachMode === "baymax"
                    ? "Please wait while I analyze your writing health"
                    : currentProject?.coachMode === "edna"
                      ? "This better be good, darling..."
                      : "Your writing coach is reviewing your work"}
                </p>
              </>
            ) : (
              <>
                {currentTask?.needsImprovement ? (
                  <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                ) : (
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                )}
                <h2 className="text-xl font-medium text-gray-800 mb-4">
                  {currentTask?.needsImprovement
                    ? currentProject?.coachMode === "baymax"
                      ? "Diagnostic Complete - Improvement Protocol Needed"
                      : currentProject?.coachMode === "edna"
                        ? "We Can Do Better, Darling!"
                        : "Let's Improve This!"
                    : currentProject?.coachMode === "baymax"
                      ? "Task Successfully Completed!"
                      : currentProject?.coachMode === "edna"
                        ? "Not Bad, Sweetie!"
                        : "Task Complete!"}
                </h2>
                {currentTask?.feedback && (
                  <div
                    className={`border rounded-lg p-4 mb-6 ${
                      currentTask.needsImprovement ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                    }`}
                  >
                    <p className={`mb-4 ${currentTask.needsImprovement ? "text-amber-800" : "text-green-800"}`}>
                      {currentTask.feedback}
                    </p>
                    {currentTask.actionablePoints && currentTask.actionablePoints.length > 0 && (
                      <div className="text-left">
                        <h4
                          className={`font-medium mb-2 ${currentTask.needsImprovement ? "text-amber-800" : "text-green-800"}`}
                        >
                          {currentProject?.coachMode === "baymax"
                            ? "Recommended Actions:"
                            : currentProject?.coachMode === "edna"
                              ? "Fix These Now:"
                              : "Action Items:"}
                        </h4>
                        <ul
                          className={`space-y-1 text-sm ${currentTask.needsImprovement ? "text-amber-700" : "text-green-700"}`}
                        >
                          {currentTask.actionablePoints.map((point, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 justify-center flex-wrap">
                  {showRedoButton && (
                    <Button onClick={handleRedoTask} variant="outline" size="lg">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      {currentProject?.coachMode === "baymax"
                        ? "Retry Protocol"
                        : currentProject?.coachMode === "edna"
                          ? "Try Again"
                          : "Try Again"}
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      if (!currentProject) return
                      const updatedProject = { ...currentProject }
                      const currentTaskIndex = currentProject.currentTaskIndex

                      // Mark CURRENT task as complete (not next task)
                      updatedProject.tasks[currentTaskIndex].completed = true
                      updatedProject.tasks[currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
                      updatedProject.tasks[currentTaskIndex].completedAt = new Date()
                      updatedProject.tasks[currentTaskIndex].needsImprovement = false
                      updatedProject.tasks[currentTaskIndex].feedback = "Marked as good enough by user"
                      updatedProject.completedWork.push(taskInput)

                      // Save the project
                      setCurrentProject(updatedProject)
                      setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
                      
                      // Immediately save when task is marked as complete
                      saveProjectToSupabase(updatedProject).catch((error) => {
                        console.error("Error saving completed task:", error)
                      })

                      // Automatically move to next task (no confirmation page)
                      updatedProject.currentTaskIndex += 1

                      if (updatedProject.currentTaskIndex >= updatedProject.tasks.length) {
                        // If last task, go to completion screen
                        setCurrentState("completed")
                      } else {
                        // Load next task immediately
                        setCurrentProject(updatedProject)
                        setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
                        setShowNextButton(false)
                        setShowRedoButton(false)
                        setShowCreateTaskButton(false)

                        const nextTask = updatedProject.tasks[updatedProject.currentTaskIndex]
                        setCustomDuration([nextTask.suggestedDuration])
                        setCurrentState("working")
                        startCurrentTask(updatedProject)
                      }
                    }}
                    variant="outline"
                    size="lg"
                    className="bg-gray-50"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {currentProject?.coachMode === "baymax"
                      ? "Mark Complete"
                      : currentProject?.coachMode === "edna"
                        ? "Good Enough"
                        : "Good Enough"}
                  </Button>
                  {showNextButton && (
                    <Button onClick={handleNextStep} size="lg">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      {currentProject?.coachMode === "baymax"
                        ? "Next Task"
                        : currentProject?.coachMode === "edna"
                          ? "Move On"
                          : "Next Step"}
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Completed View
  if (currentState === "completed") {
    const completedPersonality = getCoachPersonality(currentProject?.coachMode || "normal")

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardContent className="py-12">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-medium text-gray-800 mb-4">
              {currentProject?.coachMode === "baymax"
                ? "Mission Complete! Ba-la-la-la! 🤖"
                : currentProject?.coachMode === "edna"
                  ? "Finished! Now That's What I'm Talking About! 👗"
                  : "Project Complete! 🎉"}
            </h2>
            <p className="text-gray-600 mb-6">
              {currentProject?.coachMode === "baymax"
                ? "Your writing health has improved significantly. I am satisfied with your progress and dedication to completing this project."
                : currentProject?.coachMode === "edna"
                  ? "Darling, you actually did it! No more perfectionist paralysis - you pushed through and got it DONE. I'm proud of you."
                  : "You've successfully completed all tasks for your writing project. Great job pushing through and making consistent progress!"}
            </p>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Your Journey</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>Tasks completed: {currentProject?.tasks.filter((t) => t.completed).length}</p>
                  <p>Skips used: {currentProject?.skipsUsed}/3</p>
                  <p>Total attempts: {currentProject?.tasks.reduce((sum, t) => sum + (t.attempts || 0), 0)}</p>
                  <p>
                    Coach:{" "}
                    {currentProject?.coachMode === "baymax"
                      ? "Baymax 🤖"
                      : currentProject?.coachMode === "edna"
                        ? "Edna Mode 👗"
                        : "Normal 📝"}
                  </p>
                </div>
              </div>
              <div className="flex space-x-3">
                <Button onClick={goToDashboard} variant="outline" size="lg" className="flex-1 bg-transparent">
                  Back to Dashboard
                </Button>
                <Button onClick={resetToSetup} size="lg" className="flex-1">
                  Start New Project
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Working View
  const currentTask = currentProject?.tasks[currentProject?.currentTaskIndex || 0]
  const isDraftTask = currentTask?.focus === "draft"

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={goToDashboard}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <h1 className="text-lg font-medium text-gray-800">
              {currentProject?.coachMode === "baymax"
                ? "🤖 Baymax Coach"
                : currentProject?.coachMode === "edna"
                  ? "👗 Edna Mode"
                  : "📝 Writing Coach"}
            </h1>
            <Badge variant="outline">
              Task {(currentProject?.currentTaskIndex || 0) + 1} of {currentProject?.tasks.length}
            </Badge>
            {currentTask?.attempts && currentTask.attempts > 1 && (
              <Badge variant="secondary">Attempt {currentTask.attempts}</Badge>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Coach:</span>
              <Select
                value={currentProject?.coachMode || "normal"}
                onValueChange={async (value: CoachMode) => {
                  if (currentProject && value !== currentProject.coachMode) {
                    setCoachMode(value)
                    await reformulateTasks(currentProject, value)
                  }
                }}
                disabled={isReformulatingTasks}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="baymax">Baymax</SelectItem>
                  <SelectItem value="edna">Edna</SelectItem>
                </SelectContent>
              </Select>
              {isReformulatingTasks && <div className="text-xs text-gray-500">Reformulating...</div>}
            </div>
            {isDraftTask && (
              <div className="flex items-center space-x-2">
                <Gamepad2 className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-600">Game Mode</span>
                <Switch checked={gameMode} onCheckedChange={setGameMode} />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Backspace Lock</span>
              <Switch checked={backspaceDisabled} onCheckedChange={setBackspaceDisabled} />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current" className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Current Task</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Progress Overview</span>
            </TabsTrigger>
            <TabsTrigger value="draft" className="flex items-center space-x-2">
              <Edit3 className="h-4 w-4" />
              <span>Full Draft</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {/* Progress */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                  <span className="text-sm text-gray-600">{Math.round(getProgressPercentage(currentProject!))}%</span>
                </div>
                <Progress value={getProgressPercentage(currentProject!)} className="h-2" />
              </CardContent>
            </Card>

            {/* Game Mode Racing UI for Draft Tasks */}
            {isDraftTask && gameMode && (
              <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                <CardContent className="py-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <Trophy className="h-6 w-6 text-yellow-300" />
                      <h3 className="text-lg font-bold">DRAFT RACE MODE</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Zap className="h-5 w-5 text-yellow-300" />
                      <span className="text-sm font-medium">{typingStats.wpm} WPM</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Speed Meter</span>
                      <span>{typingStats.charactersTyped} characters</span>
                    </div>

                    <div className="relative h-4 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${getSpeedColor(typingStats.wpm)} transition-all duration-300`}
                        style={{ width: `${Math.min((typingStats.wpm / 80) * 100, 100)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Gauge className="h-3 w-3 text-white" />
                      </div>
                    </div>

                    <p className="text-sm text-center font-medium">
                      {getSpeedMessage(typingStats.wpm, currentProject?.coachMode || "normal")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Current Task */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-xl">{currentTask?.title}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{currentTask?.focus}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Auto-backspace warning for draft tasks */}
                {currentTask?.focus === "draft" && backspaceDisabled && !currentTask.userWork && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-amber-800 font-medium">
                          {currentProject?.coachMode === "baymax"
                            ? "Quick Draft Protocol Activated"
                            : currentProject?.coachMode === "edna"
                              ? "No-Delete Mode Engaged, Darling!"
                              : "Quick Draft Mode Activated"}
                        </p>
                        <p className="text-amber-700 text-sm">
                          {currentProject?.coachMode === "baymax"
                            ? "Backspace function disabled to encourage optimal writing flow. Focus on idea documentation."
                            : currentProject?.coachMode === "edna"
                              ? "Backspace is disabled because you can't edit what doesn't exist! Write first, perfect later."
                              : "Backspace is disabled to encourage fast, unedited writing. Focus on getting ideas down!"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-blue-800">
                      <p className="whitespace-pre-wrap">{currentTask?.description}</p>
                    </div>
                  </div>
                </div>

                {/* Duration Control */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Task Duration</span>
                    <span className="text-sm text-gray-600">Suggested: {currentTask?.suggestedDuration}min</span>
                  </div>
                  <div className="space-y-3">
                    <Slider
                      value={customDuration}
                      onValueChange={setCustomDuration}
                      max={currentTask?.suggestedDuration || 60}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>5min</span>
                      <span className="font-medium">{customDuration[0]}min selected</span>
                      <span>{currentTask?.suggestedDuration || 60}min</span>
                    </div>
                    {customDuration[0] !== currentTask?.duration && (
                      <div className="space-y-2">
                        <Button
                          onClick={updateTaskDuration}
                          size="sm"
                          variant="outline"
                          className="w-full bg-transparent"
                          disabled={isChunking}
                        >
                          {isChunking ? (
                            <>
                              <span className="mr-2">⏳</span>
                              Breaking down task...
                            </>
                          ) : customDuration[0] < (currentTask?.suggestedDuration || 20) ? (
                            "Break into Smaller Chunks"
                          ) : (
                            "Update Duration"
                          )}
                        </Button>
                        {customDuration[0] < (currentTask?.suggestedDuration || 20) && !isChunking && (
                          <p className="text-xs text-gray-600">
                            This will break the task into{" "}
                            {Math.ceil((currentTask?.suggestedDuration || 20) / customDuration[0])} smaller chunks
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timer Controls */}
                <div className="flex items-center justify-center space-x-4 py-4">
                  <div className="text-center">
                    <div className="text-4xl font-mono font-bold text-gray-800 mb-2">{formatTime(timeRemaining)}</div>
                    <div className="flex items-center justify-center space-x-2">
                      <Button variant="outline" size="sm" onClick={pauseTimer} disabled={timeRemaining === 0}>
                        {isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={skipTask}
                        disabled={(currentProject?.skipsUsed || 0) >= 3}
                      >
                        <SkipForward className="h-4 w-4" />
                        Skip ({3 - (currentProject?.skipsUsed || 0)} left)
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleCompleteEarly}
                        disabled={timeRemaining === 0}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete Early
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Work Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your work for this task:</label>
                  <Textarea
                    placeholder={
                      currentProject?.coachMode === "baymax"
                        ? "Begin writing here... Focus on progress, not perfection. I am here to support you."
                        : currentProject?.coachMode === "edna"
                          ? "Start writing NOW, darling! No perfectionist dawdling - just get the words down!"
                          : "Start writing here... Focus on progress, not perfection!"
                    }
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    className="min-h-48"
                    disabled={!isTimerRunning && timeRemaining > 0}
                  />
                  {backspaceDisabled && (
                    <p className="text-xs text-amber-600 mt-1">
                      {currentProject?.coachMode === "baymax"
                        ? "⚠️ Backspace disabled - optimal writing flow protocol active"
                        : currentProject?.coachMode === "edna"
                          ? "⚠️ No deleting allowed - write fast, edit later!"
                          : "⚠️ Backspace is disabled - write fast, edit slow!"}
                    </p>
                  )}
                </div>

                {timeRemaining === 0 && (
                  <Button onClick={evaluateProgress} className="w-full" size="lg">
                    {currentProject?.coachMode === "baymax"
                      ? "Submit for Analysis"
                      : currentProject?.coachMode === "edna"
                        ? "Let's See What You've Got"
                        : "Submit Progress for Review"}
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Writing Progress</span>
                </CardTitle>
                <p className="text-gray-600">Track your completed tasks and overall progress</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {currentProject?.tasks.map((task, index) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(index)}
                      className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
                        task.completed
                          ? "bg-green-50 border-green-200 hover:bg-green-100"
                          : task.needsImprovement
                            ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                            : index === currentProject.currentTaskIndex
                              ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          {task.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : task.needsImprovement ? (
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                          ) : index === currentProject.currentTaskIndex ? (
                            <Clock className="h-5 w-5 text-blue-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                          <h3 className="font-medium text-gray-800">{task.title}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getFocusColor(task.focus)}`}>{task.focus}</Badge>
                          <span className="text-xs text-gray-500">{task.duration}min</span>
                          {task.attempts && task.attempts > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {task.attempts} attempts
                            </Badge>
                          )}
                        </div>
                      </div>

                      {task.feedback && (
                        <div
                          className={`mt-3 p-3 bg-white rounded border ${
                            task.needsImprovement ? "border-amber-200" : "border-green-200"
                          }`}
                        >
                          <p className={`text-sm mb-2 ${task.needsImprovement ? "text-amber-800" : "text-green-800"}`}>
                            <strong>Coach Feedback:</strong> {task.feedback}
                          </p>
                          {task.completedAt && (
                            <p className="text-xs text-gray-500">Completed: {task.completedAt.toLocaleString()}</p>
                          )}
                        </div>
                      )}

                      {task.userWork && (
                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Your Work:</strong>
                          </p>
                          <p className="text-sm text-gray-800 line-clamp-3">
                            {task.userWork.length > 150 ? `${task.userWork.substring(0, 150)}...` : task.userWork}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="draft" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Edit3 className="h-5 w-5" />
                  <span>Complete Draft</span>
                </CardTitle>
                <p className="text-gray-600">View and edit all your draft content in one place</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your complete draft ({allDraftWork.split(" ").filter((word) => word.length > 0).length} words):
                    </label>
                    <Textarea
                      placeholder={
                        currentProject?.coachMode === "baymax"
                          ? "Your draft content will appear here as you complete draft tasks. I will monitor your progress."
                          : currentProject?.coachMode === "edna"
                            ? "Your draft content will appear here, darling. No peeking until you've done the work!"
                            : "Your draft content will appear here as you complete draft tasks..."
                      }
                      value={allDraftWork}
                      onChange={(e) => {
                        setAllDraftWork(e.target.value)
                        if (currentProject) {
                          const updatedProject = { ...currentProject }
                          const draftTasks = updatedProject.tasks.filter(
                            (task) => task.focus === "draft" && task.completed,
                          )
                          if (draftTasks.length > 0) {
                            const contentPerTask = Math.ceil(e.target.value.length / draftTasks.length)
                            let currentIndex = 0
                            draftTasks.forEach((task, index) => {
                              const taskIndex = updatedProject.tasks.findIndex((t) => t.id === task.id)
                              if (taskIndex !== -1) {
                                const start = currentIndex
                                const end = Math.min(currentIndex + contentPerTask, e.target.value.length)
                                updatedProject.tasks[taskIndex].userWork = e.target.value.slice(start, end).trim()
                                currentIndex = end
                              }
                            })
                            setCurrentProject(updatedProject)
                            setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
                          }
                        }
                      }}
                      className="min-h-96"
                    />
                  </div>
                  {allDraftWork && (
                    <div className="text-sm text-gray-600">
                      <p>
                        {currentProject?.coachMode === "baymax"
                          ? "This view combines all your completed draft tasks. Edit freely - changes will be saved to your individual draft tasks. I am monitoring your progress."
                          : currentProject?.coachMode === "edna"
                            ? "This combines all your draft work, sweetie. Edit away - but remember, done is better than perfect!"
                            : "This view combines all your completed draft tasks. Edit freely - changes will be saved to your individual draft tasks."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
