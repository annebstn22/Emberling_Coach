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
  LogOut,
  Sparkles,
  X,
} from "lucide-react"

import Link from "next/link"
import SharedNav from "@/components/shared-nav"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"
import ThreaderEmbedded from "./threader-embedded"
import IdeationEmbedded from "./ideation-embedded"

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

export default function WritingCoachApp({
  user,
  onLogout,
  initialProjectId,
}: {
  user: User
  onLogout: () => void
  initialProjectId?: string
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projectDescription, setProjectDescription] = useState("")
  const [projectName, setProjectName] = useState("")
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  // If initialProjectId is provided, start in "working" state (will be set when project loads)
  // Otherwise start in "dashboard" state
  const [currentState, setCurrentState] = useState<
    "dashboard" | "setup" | "working" | "evaluating" | "completed"
  >(initialProjectId ? "working" : "dashboard")
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
  const [feedbackPointsChecked, setFeedbackPointsChecked] = useState<boolean[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "ideation" | "threader"; id: string; name: string } | null>(null)
  const [threadSessions, setThreadSessions] = useState<Array<{ 
    id: string
    supabaseId?: string
    title: string
    points: string[]
    orderingResult?: any
    isCollapsed?: boolean
  }>>([])
  const [ideationSessions, setIdeationSessions] = useState<Array<{
    id: string
    supabaseId?: string
    title: string
    ideas: string[]
    isCollapsed?: boolean
    associatedThreadSessionId?: string
  }>>([])
  const typingStartTime = useRef<number>(0)
  const lastInputLength = useRef<number>(0)

  // Delete confirmation handlers
  const confirmDelete = async () => {
    if (!deleteConfirm) return

    try {
      if (deleteConfirm.type === "ideation") {
        const session = ideationSessions.find((s) => s.id === deleteConfirm.id)
        if (session) {
          // Delete from Supabase if it exists
          if (session.supabaseId) {
            await supabase
              .from("ideation_sessions")
              .delete()
              .eq("id", session.supabaseId)
            // Reload to sync with Supabase
            await loadIdeationSessionsForTask()
          } else {
            // Just remove from local state if not saved
            setIdeationSessions(ideationSessions.filter((s) => s.id !== session.id))
          }
        }
      } else if (deleteConfirm.type === "threader") {
        const session = threadSessions.find((s) => s.id === deleteConfirm.id)
        if (session) {
          // Delete from Supabase if it exists
          if (session.supabaseId) {
            await supabase
              .from("threader_projects")
              .delete()
              .eq("id", session.supabaseId)
            // Reload to sync with Supabase
            await loadThreadSessionsForTask()
          } else {
            // Just remove from local state if not saved
            setThreadSessions(threadSessions.filter((s) => s.id !== session.id))
          }
          // Clear association from any ideation session that was linked to this thread
          setIdeationSessions(
            ideationSessions.map((is) =>
              is.associatedThreadSessionId === session.id
                ? { ...is, associatedThreadSessionId: undefined }
                : is
            )
          )
        }
      }
      setDeleteConfirm(null)
    } catch (error) {
      console.error("Error deleting session:", error)
      alert("Failed to delete session. Please try again.")
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  // Sync feedback checklist when task changes
  useEffect(() => {
    const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
    const points = task?.actionablePoints ?? []
    setFeedbackPointsChecked(points.map(() => false))
  }, [currentProject?.id, currentProject?.currentTaskIndex])

  // Load thread sessions for current task when task changes
  useEffect(() => {
    if (currentProject?.id && user?.id) {
      loadThreadSessionsForTask()
      loadIdeationSessionsForTask()
    } else {
      setThreadSessions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, currentProject?.currentTaskIndex, user?.id])

  // Load projects from Supabase when user is available
  useEffect(() => {
    if (user?.id) {
      loadProjectsFromSupabase(user.id)
    } else {
      setProjects([])
      setCurrentProject(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Select project when initialProjectId is provided and projects are loaded
  useEffect(() => {
    if (initialProjectId && projects.length > 0) {
      const project = projects.find((p) => p.id === initialProjectId)
      if (project) {
        // Always select the project if it matches, even if already selected (in case of navigation)
        selectProject(project)
        setCurrentState("working")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProjectId, projects])

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

  // Load ideation sessions for current task
  const loadIdeationSessionsForTask = async () => {
    if (!user?.id || !currentProject?.id) return

    try {
      const { data: ideationSessionsData, error } = await supabase
        .from("ideation_sessions")
        .select("*, ideas(*)")
        .eq("user_id", user.id)
        .eq("coach_project_id", currentProject.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading ideation sessions:", error)
        return
      }

      if (ideationSessionsData) {
        const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
        const taskTitle = task?.title || "Current Task"
        const taskIndex = (currentProject?.currentTaskIndex ?? 0) + 1
        
        // Filter and format ideation sessions for current task
        const formattedSessions = ideationSessionsData
          .filter((s: any) => {
            // Check if title contains task title or task number to match to current task
            const title = s.title || ""
            return title.includes(taskTitle) || 
                   title.includes(`Task ${taskIndex}`) ||
                   title.includes(`Ideation`)
          })
          .map((s: any) => {
            const ideas = (s.ideas || [])
              .filter((idea: any) => idea.status !== "discarded")
              .map((idea: any) => idea.content)

            // Load collapsed state from database
            const isCollapsed = s.is_collapsed || false

            return {
              id: s.id,
              supabaseId: s.id,
              title: s.title,
              ideas: ideas,
              isCollapsed: isCollapsed,
            }
          })

        setIdeationSessions(formattedSessions)
      }
    } catch (error) {
      console.error("Error loading ideation sessions:", error)
    }
  }

  // Save ideation session to Supabase
  const saveIdeationSessionToSupabase = async (
    sessionId: string,
    title: string,
    ideas: string[],
    isCollapsed?: boolean
  ) => {
    if (!user?.id || !currentProject?.id) return

    try {
      // Upsert ideation session
      const { data: ideationSession, error: sessionError } = await supabase
        .from("ideation_sessions")
        .upsert(
          {
            id: sessionId,
            user_id: user.id,
            title: title || `Ideation from ${currentProject.name}`,
            description: "", // Required field - empty string for inline sessions
            coach_project_id: currentProject.id,
            is_complete: false,
            is_collapsed: isCollapsed || false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single()

      if (sessionError) {
        console.error("Error saving ideation session:", sessionError)
        return
      }

      // Delete existing ideas for this session
      await supabase.from("ideas").delete().eq("session_id", sessionId)

      // Insert all ideas
      if (ideas.length > 0) {
        const ideasToInsert = ideas.map((content, idx) => ({
          id: crypto.randomUUID(),
          session_id: sessionId,
          content: content,
          card_id: "inline", // Required field - use "inline" for ideas from embedded ideation
          card_text: "", // Required field - empty for inline ideas
          status: "active",
          timestamp: new Date().toISOString(),
        }))

        const { error: ideasError } = await supabase
          .from("ideas")
          .insert(ideasToInsert)

        if (ideasError) {
          console.error("Error saving ideas:", ideasError)
        }
      }
    } catch (error) {
      console.error("Error saving ideation session:", error)
    }
  }

  // Load thread sessions for current task
  const loadThreadSessionsForTask = async () => {
    if (!user?.id || !currentProject?.id) return

    try {
      const { data: threaderProjects, error } = await supabase
        .from("threader_projects")
        .select("*, threader_items(*)")
        .eq("user_id", user.id)
        .eq("coach_project_id", currentProject.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading thread sessions:", error)
        return
      }

      if (threaderProjects) {
        const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
        const taskTitle = task?.title || "Current Task"
        const taskIndex = (currentProject?.currentTaskIndex ?? 0) + 1
        
        // Filter and format thread sessions for current task
        const formattedSessions = threaderProjects
          .filter((p: any) => {
            // Check if title contains task title or task number to match to current task
            const title = p.title || ""
            return title.includes(taskTitle) || 
                   title.includes(`Task ${taskIndex}`) ||
                   title.includes(`Thread`)
          })
          .map((p: any) => {
            const items = (p.threader_items || [])
              .sort((a: any, b: any) => a.original_index - b.original_index)
              .map((item: any) => item.content)

            let orderingResult: any = undefined
            if (p.ordering_result) {
              try {
                orderingResult = typeof p.ordering_result === 'string' 
                  ? JSON.parse(p.ordering_result) 
                  : p.ordering_result
              } catch (e) {
                console.error("Error parsing ordering_result:", e)
              }
            }

            // Load isCollapsed from dedicated column
            const isCollapsed = p.is_collapsed || false

            return {
              id: p.id,
              supabaseId: p.id,
              title: p.title,
              points: items,
              orderingResult: orderingResult,
              isCollapsed: isCollapsed,
            }
          })

        setThreadSessions(formattedSessions)
      }
    } catch (error) {
      console.error("Error loading thread sessions:", error)
    }
  }

  // Save thread session to Supabase
  const saveThreadSessionToSupabase = async (
    sessionId: string,
    title: string,
    points: string[],
    orderingResult?: any,
    isCollapsed?: boolean
  ) => {
    if (!user?.id || !currentProject?.id) return

    try {
      // Convert points to ThreaderPoint format
      const threaderPoints = points.map((text, idx) => ({
        id: crypto.randomUUID(),
        text,
        originalIndex: idx,
      }))

      // Upsert threader project
      const { data: threaderProject, error: projectError } = await supabase
        .from("threader_projects")
        .upsert(
          {
            id: sessionId,
            user_id: user.id,
            title: title || `Thread from ${currentProject.name}`,
            coach_project_id: currentProject.id,
            ordering_result: orderingResult || null,
            is_collapsed: isCollapsed || false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
        .select()
        .single()

      if (projectError) {
        console.error("Error saving thread session:", projectError)
        return
      }

      // Delete existing items
      await supabase.from("threader_items").delete().eq("project_id", sessionId)

      // Insert new items
      if (threaderPoints.length > 0) {
        const itemsToInsert = threaderPoints.map((point, idx) => {
          // Find order_index if we have ordering result
          let orderIndex = null
          if (orderingResult?.best_ordering?.ordered_points) {
            const orderIdx = orderingResult.best_ordering.ordered_points.findIndex(
              (p: string) => p === point.text
            )
            orderIndex = orderIdx >= 0 ? orderIdx : null
          }

          return {
            project_id: sessionId,
            content: point.text,
            original_index: point.originalIndex,
            order_index: orderIndex,
          }
        })

        await supabase.from("threader_items").insert(itemsToInsert)
      }

      // Reload thread sessions to reflect changes
      await loadThreadSessionsForTask()
    } catch (error) {
      console.error("Error saving thread session:", error)
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

      // Delete existing tasks for this project (wait for completion)
      const { error: deleteError } = await supabase.from("tasks").delete().eq("project_id", project.id)
      
      if (deleteError) {
        console.error("Error deleting existing tasks:", deleteError)
        // Continue anyway - we'll try to upsert instead
      }

      // Insert all tasks (using upsert to handle race conditions)
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

        // Use upsert instead of insert to handle race conditions where tasks might already exist
        const { error: tasksError } = await supabase
          .from("tasks")
          .upsert(tasksToInsert.flat(), { onConflict: "id" })

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

        // Create new project - use UUIDs for Supabase compatibility
        const newProject: Project = {
          id: crypto.randomUUID(),
          name: projectName,
          description: projectDescription,
          tasks: tasks.map((task: any, index: number) => ({
            ...task,
            completed: false,
            needsImprovement: false,
            attempts: 0,
            duration: task.suggestedDuration || 20,
            id: crypto.randomUUID(),
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
        id: crypto.randomUUID(),
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
      id: crypto.randomUUID(),
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
    const task = updatedProject.tasks[currentProject.currentTaskIndex]
    updatedProject.tasks[currentProject.currentTaskIndex].needsImprovement = false

    setCurrentProject(updatedProject)
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)))
    setCurrentState("working")
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
    setFeedbackPointsChecked((task.actionablePoints ?? []).map(() => false))
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
      setFeedbackPointsChecked(
        (currentTask.actionablePoints ?? []).map(() => false)
      )
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

      // Map AI-generated subtasks to our Task structure - use UUIDs for Supabase
      return data.subtasks.map((subtask: any, index: number) => ({
        id: crypto.randomUUID(),
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

  // If we have an initialProjectId but haven't loaded/selected it yet, show loading
  if (initialProjectId && projects.length > 0 && (!currentProject || currentProject.id !== initialProjectId)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading project...</div>
      </div>
    )
  }

  // If we have initialProjectId but projects haven't loaded yet, show loading
  if (initialProjectId && projects.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading projects...</div>
      </div>
    )
  }

  // Dashboard view - only show if no initialProjectId and no current project
  // If we have initialProjectId, we should never show dashboard (even if state is still "dashboard" temporarily)
  if (currentState === "dashboard" && !initialProjectId && !currentProject) {
    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="coach" onLogout={onLogout} />

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
  const showFeedbackPanel = currentTask?.feedback && (currentTask?.actionablePoints?.length ?? 0) > 0

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <SharedNav activeTool="coach" onLogout={onLogout} />
      {/* Sub-header with task info */}
      <div className="bg-white border-b border-[#e0dbd0] px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-medium text-[#1a1814]">
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
              <span className="text-sm text-[#9a948a]">Coach:</span>
              <Badge variant="outline" className="text-xs">
                {currentProject?.coachMode === "baymax"
                  ? "🤖 Baymax"
                  : currentProject?.coachMode === "edna"
                    ? "👗 Edna"
                    : "📝 Normal"}
              </Badge>
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

      <div className={`p-4 ${showFeedbackPanel ? "max-w-[1600px] mx-auto" : "max-w-4xl mx-auto"}`}>
        <div className={showFeedbackPanel ? "grid grid-cols-[320px_1fr] gap-6" : ""}>
          {showFeedbackPanel && (
            <aside className="sticky top-4 h-fit">
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="text-base">Coach Feedback</CardTitle>
                  <p className="text-sm text-amber-900 whitespace-pre-wrap">{currentTask?.feedback}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-gray-700 mb-3">To implement:</p>
                  <div className="space-y-2">
                    {(currentTask?.actionablePoints ?? []).map((point, idx) => (
                      <label
                        key={idx}
                        className={`flex items-start gap-2 text-sm cursor-pointer group ${
                          feedbackPointsChecked[idx] ? "text-gray-500 line-through" : "text-gray-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={feedbackPointsChecked[idx] ?? false}
                          onChange={() =>
                            setFeedbackPointsChecked((prev) => {
                              const next = [...(prev.length ? prev : (currentTask?.actionablePoints ?? []).map(() => false))]
                              next[idx] = !next[idx]
                              return next
                            })
                          }
                          className="mt-1 rounded border-gray-300"
                        />
                        <span>{point}</span>
                      </label>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </aside>
          )}
          <div className="min-w-0">
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

                {/* Tool Row */}
                <div className="flex gap-2 flex-wrap mb-4">
                  <button
                    onClick={async () => {
                      const sessionId = crypto.randomUUID()
                      const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
                      const taskTitle = task?.title || "Current Task"
                      const newSession = {
                        id: sessionId,
                        supabaseId: sessionId,
                        title: `${taskTitle} — Ideation ${ideationSessions.length + 1}`,
                        ideas: [],
                      }
                      setIdeationSessions([...ideationSessions, newSession])
                      // Save to Supabase
                      await saveIdeationSessionToSupabase(sessionId, newSession.title, [])
                    }}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 hover:border-[#e8d08a] hover:text-[#b8860b] transition-all"
                  >
                    <Lightbulb className="h-4 w-4 text-[#b8860b]" />
                    <span>💡 Add ideation session</span>
                  </button>
                  <button
                    onClick={async () => {
                      const sessionId = crypto.randomUUID()
                      const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
                      const taskTitle = task?.title || "Current Task"
                      const newSession = {
                        id: sessionId,
                        supabaseId: sessionId,
                        title: `${taskTitle} — Thread ${threadSessions.length + 1}`,
                        points: [],
                      }
                      setThreadSessions([...threadSessions, newSession])
                      // Save to Supabase
                      await saveThreadSessionToSupabase(sessionId, newSession.title, [], undefined, false)
                    }}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 hover:border-[#a8c8e8] hover:text-[#1a4a6e] transition-all"
                  >
                    <Sparkles className="h-4 w-4 text-[#1a4a6e]" />
                    <span>🧵 Add thread session</span>
                  </button>
                </div>

                {/* Ideation Sessions List */}
                {ideationSessions.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {ideationSessions.map((session) => (
                      <div
                        key={session.id}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">
                            💡 {session.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({
                                type: "ideation",
                                id: session.id,
                                name: session.title,
                              })
                            }}
                            className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-4">
                          <IdeationEmbedded
                            initialIdeas={session.ideas}
                            isCollapsed={session.isCollapsed}
                            onToggleCollapse={async () => {
                              const updatedSession = {
                                ...session,
                                isCollapsed: !session.isCollapsed,
                              }
                              setIdeationSessions(
                                ideationSessions.map((s) =>
                                  s.id === session.id ? updatedSession : s
                                )
                              )
                              // Save collapsed state to Supabase
                              const sessionId = session.supabaseId || session.id
                              await saveIdeationSessionToSupabase(
                                sessionId,
                                session.title,
                                session.ideas,
                                updatedSession.isCollapsed
                              )
                            }}
                            onIdeasChange={async (ideas) => {
                              // Update session with new ideas
                              const updatedSession = { ...session, ideas }
                              setIdeationSessions(
                                ideationSessions.map((s) =>
                                  s.id === session.id ? updatedSession : s
                                )
                              )
                              // Auto-save to Supabase (always save, even if new session)
                              const sessionId = session.supabaseId || session.id
                              await saveIdeationSessionToSupabase(
                                sessionId,
                                session.title,
                                ideas
                              )
                              // Update supabaseId if it was a new session
                              if (!session.supabaseId) {
                                setIdeationSessions(
                                  ideationSessions.map((s) =>
                                    s.id === session.id ? { ...updatedSession, supabaseId: sessionId } : s
                                  )
                                )
                              }
                            }}
                            onFeedToThreader={async (ideas) => {
                              // Get the current session state to ensure we have the latest associatedThreadSessionId
                              const currentSession = ideationSessions.find((s) => s.id === session.id)
                              const associatedThreadId = currentSession?.associatedThreadSessionId

                              // Check if there's already an associated thread session
                              if (associatedThreadId) {
                                // Update existing thread session
                                const existingThreadSession = threadSessions.find(
                                  (ts) => ts.id === associatedThreadId
                                )
                                if (existingThreadSession) {
                                  // Update the existing session
                                  const updatedThreadSession = {
                                    ...existingThreadSession,
                                    points: ideas,
                                  }
                                  setThreadSessions(
                                    threadSessions.map((ts) =>
                                      ts.id === existingThreadSession.id ? updatedThreadSession : ts
                                    )
                                  )
                                  // Save to Supabase
                                  await saveThreadSessionToSupabase(
                                    existingThreadSession.supabaseId || existingThreadSession.id,
                                    existingThreadSession.title,
                                    ideas,
                                    existingThreadSession.orderingResult,
                                    existingThreadSession.isCollapsed
                                  )
                                } else {
                                  // Thread session was deleted, create a new one
                                  const threadSessionId = crypto.randomUUID()
                                  const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
                                  const taskTitle = task?.title || "Current Task"
                                  const newThreadSession = {
                                    id: threadSessionId,
                                    supabaseId: threadSessionId,
                                    title: `${taskTitle} — Thread ${threadSessions.length + 1}`,
                                    points: ideas,
                                  }
                                  setThreadSessions([...threadSessions, newThreadSession])
                                  // Save to Supabase
                                  await saveThreadSessionToSupabase(threadSessionId, newThreadSession.title, ideas, undefined, false)
                                  // Update ideation session with new thread session ID
                                  setIdeationSessions(
                                    ideationSessions.map((s) =>
                                      s.id === session.id ? { ...s, associatedThreadSessionId: threadSessionId } : s
                                    )
                                  )
                                }
                              } else {
                                // Create a new thread session and associate it
                                const threadSessionId = crypto.randomUUID()
                                const task = currentProject?.tasks[currentProject?.currentTaskIndex ?? 0]
                                const taskTitle = task?.title || "Current Task"
                                const newThreadSession = {
                                  id: threadSessionId,
                                  supabaseId: threadSessionId,
                                  title: `${taskTitle} — Thread ${threadSessions.length + 1}`,
                                  points: ideas,
                                }
                                setThreadSessions([...threadSessions, newThreadSession])
                                // Save to Supabase
                                await saveThreadSessionToSupabase(threadSessionId, newThreadSession.title, ideas, undefined, false)
                                // Associate the thread session with this ideation session
                                setIdeationSessions(
                                  ideationSessions.map((s) =>
                                    s.id === session.id ? { ...s, associatedThreadSessionId: threadSessionId } : s
                                  )
                                )
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Thread Sessions List */}
                {threadSessions.length > 0 && (
                  <div className="space-y-4 mb-4">
                    {threadSessions.map((session) => (
                      <div
                        key={session.id}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
                          <span className="text-sm font-medium text-gray-700">
                            🧵 {session.title}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm({
                                type: "threader",
                                id: session.id,
                                name: session.title,
                              })
                            }}
                            className="text-xs text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-4">
                          <ThreaderEmbedded
                            initialPoints={session.points}
                            initialOrderingResult={session.orderingResult}
                            isCollapsed={session.isCollapsed}
                            onToggleCollapse={async () => {
                              const updatedSession = {
                                ...session,
                                isCollapsed: !session.isCollapsed,
                              }
                              setThreadSessions(
                                threadSessions.map((s) =>
                                  s.id === session.id ? updatedSession : s
                                )
                              )
                              // Save collapsed state to Supabase
                              const sessionId = session.supabaseId || session.id
                              await saveThreadSessionToSupabase(
                                sessionId,
                                session.title,
                                session.points,
                                session.orderingResult,
                                updatedSession.isCollapsed
                              )
                            }}
                            onPointsChange={async (points) => {
                              // Update session with new points
                              const updatedSession = { ...session, points }
                              setThreadSessions(
                                threadSessions.map((s) =>
                                  s.id === session.id ? updatedSession : s
                                )
                              )
                              // Auto-save to Supabase (always save, even if new session)
                              const sessionId = session.supabaseId || session.id
                              await saveThreadSessionToSupabase(
                                sessionId,
                                session.title,
                                points,
                                session.orderingResult,
                                session.isCollapsed
                              )
                              // Update supabaseId if it was a new session
                              if (!session.supabaseId) {
                                setThreadSessions(
                                  threadSessions.map((s) =>
                                    s.id === session.id ? { ...updatedSession, supabaseId: sessionId } : s
                                  )
                                )
                              }
                            }}
                            onOrderingComplete={async (orderedPoints, bridges, orderingResult) => {
                              // Update session with ordered points and result
                              const updatedSession = {
                                ...session,
                                points: orderedPoints,
                                orderingResult,
                              }
                              setThreadSessions(
                                threadSessions.map((s) =>
                                  s.id === session.id ? updatedSession : s
                                )
                              )
                              // Save to Supabase (always save, even if new session)
                              const sessionId = session.supabaseId || session.id
                              await saveThreadSessionToSupabase(
                                sessionId,
                                session.title,
                                orderedPoints,
                                orderingResult,
                                session.isCollapsed
                              )
                              // Update supabaseId if it was a new session
                              if (!session.supabaseId) {
                                setThreadSessions(
                                  threadSessions.map((s) =>
                                    s.id === session.id ? { ...updatedSession, supabaseId: sessionId } : s
                                  )
                                )
                              }
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center" onClick={cancelDelete}>
          <div className="bg-white border border-[#e0dbd0] rounded-xl p-7 max-w-[360px] w-[90%] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="font-serif text-lg text-[#1a1814] mb-1">Delete this {deleteConfirm.type === "ideation" ? "ideation session" : "thread"}?</div>
            <div className="text-sm text-[#9a948a] leading-relaxed mb-5">
              This will permanently remove <strong>{deleteConfirm.name}</strong> and all its content. This cannot be undone.
            </div>
            <div className="flex gap-2.5 justify-end">
              <button
                onClick={cancelDelete}
                className="bg-transparent border border-[#e0dbd0] rounded-md px-4 py-2 font-mono text-xs text-[#9a948a] cursor-pointer hover:border-[#c8c2b4] hover:text-[#1a1814] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="bg-[#8b2020] text-white border-none rounded-md px-4 py-2 font-mono text-xs cursor-pointer hover:opacity-85 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
