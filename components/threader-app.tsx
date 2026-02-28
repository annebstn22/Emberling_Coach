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
import {
  Home,
  LogOut,
  Plus,
  X,
  Sparkles,
  RotateCcw,
  ChevronRight,
} from "lucide-react"

interface ThreaderPoint {
  id: string
  text: string
  originalIndex: number
}

interface ThreaderProject {
  id: string
  title: string
  description?: string
  points: ThreaderPoint[]
  orderedPoints?: string[]
  bridges?: string[]
  orderingResult?: ThreaderResponse
  coachProjectId?: string
  createdAt: Date
  updatedAt: Date
}

interface OrderingResult {
  method: string
  path: number[]
  score: number
  description: string
  ordered_points: string[]
}

interface ThreaderResponse {
  all_points: string[]
  expanded_points: string[]
  orderings: OrderingResult[]
  best_ordering: {
    method: string
    path: number[]
    score: number
    ordered_points: string[]
    bridges: string[]
  }
}

export default function ThreaderApp({
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
  const viewFromUrl = (searchParams.get("view") as "dashboard" | "session") || "session"
  const sessionIdFromUrl = searchParams.get("session")

  // If sessionIdFromUrl is present, default to "session" instead of "dashboard" to avoid flashing dashboard
  const initialView = sessionIdFromUrl && viewFromUrl === "dashboard" ? "session" : viewFromUrl
  const [currentView, setCurrentView] = useState(initialView)
  const [isLoadingSession, setIsLoadingSession] = useState(!!sessionIdFromUrl)

  // Update currentView when viewFromUrl changes
  useEffect(() => {
    if (viewFromUrl !== currentView) {
      setCurrentView(viewFromUrl)
    }
  }, [viewFromUrl, currentView])
  
  const [currentProject, setCurrentProject] = useState<ThreaderProject | null>(null)
  const [projectTitle, setProjectTitle] = useState("")
  const [currentPoint, setCurrentPoint] = useState("")
  const [points, setPoints] = useState<ThreaderPoint[]>([])
  const [allProjects, setAllProjects] = useState<ThreaderProject[]>([])
  const [isOrdering, setIsOrdering] = useState(false)
  const [orderingResult, setOrderingResult] = useState<ThreaderResponse | null>(null)
  const [showSaveButton, setShowSaveButton] = useState(false)

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isLoadingFromUrlRef = useRef(false)

  // Load projects from Supabase
  const loadProjectsFromSupabase = async () => {
    if (!user?.id) return

    try {
      const { data: projectsData, error } = await supabase
        .from("threader_projects")
        .select("*, threader_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error loading threader projects:", error)
        return
      }

      if (projectsData) {
        const formattedProjects: ThreaderProject[] = projectsData.map((p: any) => {
          const items = (p.threader_items || [])
            .sort((a: any, b: any) => a.original_index - b.original_index)
            .map((item: any) => ({
              id: item.id,
              text: item.content,
              originalIndex: item.original_index,
            }))

          // Parse ordering result if it exists
          let orderingResult: ThreaderResponse | undefined
          if (p.ordering_result) {
            try {
              orderingResult = typeof p.ordering_result === 'string' 
                ? JSON.parse(p.ordering_result) 
                : p.ordering_result
            } catch (e) {
              console.error("Error parsing ordering_result:", e)
            }
          }

          return {
            id: p.id,
            title: p.title,
            description: p.description,
            points: items,
            orderingResult: orderingResult,
            orderedPoints: orderingResult?.best_ordering?.ordered_points,
            bridges: orderingResult?.best_ordering?.bridges,
            coachProjectId: p.coach_project_id,
            createdAt: new Date(p.created_at),
            updatedAt: new Date(p.updated_at),
          }
        })

        setAllProjects(formattedProjects)
      }
    } catch (error) {
      console.error("Error loading projects:", error)
    }
  }

  useEffect(() => {
    if (user?.id) {
      loadProjectsFromSupabase()
    }
  }, [user?.id])


  // Ensure projects are loaded when sessionIdFromUrl is present
  useEffect(() => {
    if (sessionIdFromUrl && allProjects.length === 0 && user?.id) {
      // Force load projects if we have a sessionId but no projects loaded
      loadProjectsFromSupabase()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl, allProjects.length, user?.id])

  // Load session from URL when sessionIdFromUrl is present and projects are loaded
  useEffect(() => {
    // ONLY update currentProject from allProjects if we're loading from URL
    if (sessionIdFromUrl && allProjects.length > 0) {
      isLoadingFromUrlRef.current = true
      const project = allProjects.find((p) => p.id === sessionIdFromUrl)
      if (project) {
        // Only update if we don't have a project OR the project ID doesn't match
        // This prevents overwriting the active project when allProjects updates from auto-save
        if (!currentProject || currentProject.id !== project.id) {
          // Set view to session if it's not already
          if (currentView !== "session") {
            setCurrentView("session")
          }
          loadSession(project.id)
          setIsLoadingSession(false)
        } else {
          // Project already matches - just clear loading state
          setIsLoadingSession(false)
        }
        isLoadingFromUrlRef.current = false
      } else if (sessionIdFromUrl && allProjects.length > 0 && !project) {
        // Session not found after loading
        setIsLoadingSession(false)
        isLoadingFromUrlRef.current = false
      }
    } else if (sessionIdFromUrl && allProjects.length === 0) {
      // Projects are still loading, keep loading state
      // Don't set isLoadingSession to false yet
    } else if (!sessionIdFromUrl) {
      isLoadingFromUrlRef.current = false
      // Don't clear project here - let the effect above handle it
      setIsLoadingSession(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl, currentView, allProjects.length])

  // If view is "session" and no session exists, create a local session for UI (but don't save to DB until first point is added)
  useEffect(() => {
    if (viewFromUrl === "session" && !sessionIdFromUrl && !currentProject && currentView === "session") {
      // Create a local session for UI display (not saved to Supabase until first point is added)
      const newProject: ThreaderProject = {
        id: crypto.randomUUID(),
        title: "",
        points: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setCurrentProject(newProject)
      setProjectTitle("")
      setPoints([])
      setOrderingResult(null)
      setShowSaveButton(false)
      // Don't save to Supabase - wait until first point is added (handled in addPoint)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFromUrl, sessionIdFromUrl, currentProject, currentView])

  // Auto-save project (but don't clear ordering on auto-save)
  useEffect(() => {
    if (currentProject && user?.id) {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }

      autoSaveTimeoutRef.current = setTimeout(async () => {
        await saveProjectToSupabase(currentProject.id, projectTitle, points, false)
      }, 1000)
    }

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [currentProject, projectTitle, points, user?.id])

  const saveProjectToSupabase = async (
    projectId: string,
    title: string,
    projectPoints: ThreaderPoint[],
    clearOrdering: boolean = false,
  ) => {
    if (!user?.id) return

    // Skip saving empty projects (like ideation - only save when there's at least one point)
    if (projectPoints.length === 0) {
      console.log(`Skipping save for empty project ${projectId}`)
      return
    }

    try {
      // Upsert project
      const updateData: any = {
        id: projectId,
        user_id: user.id,
        title: title || "Untitled thread",
        updated_at: new Date().toISOString(),
      }

      // Clear ordering result if points changed
      if (clearOrdering) {
        updateData.ordering_result = null
      }

      const { error: projectError } = await supabase
        .from("threader_projects")
        .upsert(updateData, { onConflict: "id" })

      if (projectError) {
        console.error("Error saving project:", projectError)
        return
      }

      // Delete existing items
      await supabase.from("threader_items").delete().eq("project_id", projectId)

      // Insert new items
      if (projectPoints.length > 0) {
        const itemsToInsert = projectPoints.map((point, idx) => ({
          project_id: projectId,
          content: point.text,
          original_index: point.originalIndex,
          order_index: null, // Will be set after ordering
        }))

        await supabase.from("threader_items").insert(itemsToInsert)
      }
    } catch (error) {
      console.error("Error saving project:", error)
    }
  }

  const saveOrderingResultToSupabase = async (
    projectId: string,
    orderingData: ThreaderResponse,
  ) => {
    if (!user?.id) return

    try {
      const { error } = await supabase
        .from("threader_projects")
        .update({
          ordering_result: orderingData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
        .eq("user_id", user.id)

      if (error) {
        console.error("Error saving ordering result:", error)
      }
    } catch (error) {
      console.error("Error saving ordering result:", error)
    }
  }

  const startNewSession = () => {
    const newProject: ThreaderProject = {
      id: crypto.randomUUID(),
      title: "",
      points: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    setCurrentProject(newProject)
    setProjectTitle("")
    setPoints([])
    setOrderingResult(null)
    setShowSaveButton(false)
    setCurrentView("session")
    router.replace("/threader?view=session&session=" + newProject.id)
  }

  const addPoint = async () => {
    if (!currentPoint.trim()) return

    // Auto-create project ONLY when user adds their first point (like ideation)
    // Don't save to Supabase until at least one point is added
    if (!currentProject) {
      const newProject: ThreaderProject = {
        id: crypto.randomUUID(),
        title: "",
        points: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      setCurrentProject(newProject)
      setProjectTitle("")
      setPoints([])
      setOrderingResult(null)
      setShowSaveButton(false)
      // Don't save to Supabase yet - wait until point is added
      setAllProjects((prev) => [newProject, ...prev])
    }

    const newPoint: ThreaderPoint = {
      id: crypto.randomUUID(),
      text: currentPoint.trim(),
      originalIndex: points.length,
    }

    const updatedPoints = [...points, newPoint]
    setPoints(updatedPoints)

    // Use currentProject (which should exist now)
    const projectToUse = currentProject || allProjects[0]
    if (projectToUse) {
      setCurrentProject({
        ...projectToUse,
        points: updatedPoints,
      })
    }

    setCurrentPoint("")

    // Clear ordering result if points changed (same logic as remove)
    if (orderingResult) {
      setOrderingResult(null)
      setShowSaveButton(false)
      
      // Clear ordering result in database
      if (projectToUse) {
        await saveProjectToSupabase(projectToUse.id, projectTitle, updatedPoints, true)
      }
    } else if (projectToUse && user?.id) {
      // Save the project with the new point (first save)
      await saveProjectToSupabase(projectToUse.id, projectTitle, updatedPoints, false)
    }
  }

  const removePoint = async (id: string) => {
    const updatedPoints = points.filter((p) => p.id !== id)
    setPoints(updatedPoints)

    if (currentProject) {
      setCurrentProject({
        ...currentProject,
        points: updatedPoints,
      })
    }

    // Clear ordering result if points changed
    if (orderingResult) {
      setOrderingResult(null)
      setShowSaveButton(false)
      
      // Clear ordering result in database
      if (currentProject) {
        await saveProjectToSupabase(currentProject.id, projectTitle, updatedPoints, true)
      }
    }
  }

  const doThread = async () => {
    if (points.length < 2) {
      alert("You need at least 2 points to find an order")
      return
    }

    setIsOrdering(true)
    setOrderingResult(null)

    try {
      const response = await fetch("/api/threader", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points: points.map((p) => p.text),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to order points")
      }

      const data: ThreaderResponse = await response.json()
      setOrderingResult(data)
      setShowSaveButton(true)

      // Update project with ordered points and bridges
      if (currentProject && data.best_ordering) {
        const updatedProject = {
          ...currentProject,
          orderedPoints: data.best_ordering.ordered_points,
          bridges: data.best_ordering.bridges,
          orderingResult: data,
        }
        setCurrentProject(updatedProject)

        // Save ordering result to Supabase immediately
        await saveOrderingResultToSupabase(currentProject.id, data)
      }
    } catch (error) {
      console.error("Error ordering points:", error)
      alert(error instanceof Error ? error.message : "Failed to order points")
    } finally {
      setIsOrdering(false)
    }
  }

  const saveSession = async () => {
    if (!currentProject || !user?.id) return

    await saveProjectToSupabase(currentProject.id, projectTitle, points)

    // Save ordering result if it exists
    if (orderingResult) {
      await saveOrderingResultToSupabase(currentProject.id, orderingResult)
    }

    // If we have ordering results, save the ordered items with order_index
    if (orderingResult?.best_ordering) {
      const orderedItems = orderingResult.best_ordering.ordered_points.map((point, idx) => {
        const originalPoint = points.find((p) => p.text === point)
        return {
          project_id: currentProject.id,
          content: point,
          original_index: originalPoint?.originalIndex ?? idx,
          order_index: idx,
        }
      })

      // Delete and re-insert with order
      await supabase.from("threader_items").delete().eq("project_id", currentProject.id)
      await supabase.from("threader_items").insert(orderedItems)
    }

    // Reload projects
    await loadProjectsFromSupabase()
    setShowSaveButton(false)
    
    // Redirect to dashboard after saving
    setCurrentView("dashboard")
    router.replace("/threader?view=dashboard")
  }

  const loadSession = (projectId: string) => {
    const project = allProjects.find((p) => p.id === projectId)
    if (project) {
      setCurrentProject(project)
      setProjectTitle(project.title)
      setPoints(project.points)
      
      // Restore ordering result if it exists
      if (project.orderingResult) {
        setOrderingResult(project.orderingResult)
        setShowSaveButton(false) // Already saved, no need to show save button
      } else {
        setOrderingResult(null)
        setShowSaveButton(false)
      }
      
      setCurrentView("session")
      router.replace(`/threader?view=session&session=${projectId}`)
    }
  }

  // Get reasoning text for each position (matching prototype)
  const getReasoningText = (position: number, total: number): string => {
    const reasons = [
      "opens with the concrete — earns trust before asking anything of the reader",
      "builds on what came before — the reader is ready for this now",
      "the payoff — lands harder because the groundwork is laid",
      "reinforces the through-line — adds weight without repeating",
      "closes the loop — brings the reader back, changed",
    ]
    return reasons[Math.min(position, reasons.length - 1)]
  }

  // Show loading state if we're loading a session from URL
  if (isLoadingSession && sessionIdFromUrl) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="text-[#9a948a]">Loading thread...</div>
      </div>
    )
  }

  // Dashboard view
  if (currentView === "dashboard") {
    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="threader" onLogout={onLogout} />

        <div className="max-w-6xl mx-auto p-6 space-y-6">
          <Card className="bg-gradient-to-r from-blue-500 to-indigo-500 border-none text-white">
            <CardContent className="p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-2">Start a New Thread</h2>
                  <p className="text-blue-100">
                    Type your points and get the best order with natural transitions
                  </p>
                </div>
                <Button
                  onClick={startNewSession}
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  New Thread
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Threads</CardTitle>
            </CardHeader>
            <CardContent>
              {allProjects.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 text-blue-300 mx-auto mb-3" />
                  <p className="text-gray-600">No threads yet. Start your first thread!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {allProjects.map((project) => (
                    <Card
                      key={project.id}
                      className="hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => loadSession(project.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-800 mb-2">
                              {project.title || "Untitled thread"}
                            </h3>
                            <div className="flex items-center space-x-4 text-xs text-gray-500 mb-1">
                              <span>{project.points.length} points</span>
                              <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                            </div>
                            {project.coachProjectId && (
                              <div className="text-xs text-blue-600 mt-1">
                                ↳ from Writing Coach project
                              </div>
                            )}
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

  // Session view
  if (currentView === "session") {
    const showNudge = points.length >= 3
    const bestOrdering = orderingResult?.best_ordering

    return (
      <div className="min-h-screen bg-[#f7f4ee]">
        <SharedNav activeTool="threader" onLogout={onLogout} />

        <div className="max-w-[600px] mx-auto px-6 py-12 space-y-6">
          <div>
            <h2
              className="mb-1"
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2.2rem',
                fontWeight: 300,
                color: 'var(--ink)',
              }}
            >
              <em>What do you need to cover?</em>
            </h2>
            <p
              className="mb-4"
              style={{
                fontSize: '0.7rem',
                color: 'var(--muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                fontFamily: 'var(--font-mono)',
              }}
            >
              type each point — get the best order, with reasoning
            </p>

            <div className="flex items-center gap-3 mb-4">
              <span
                className="uppercase whitespace-nowrap"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  letterSpacing: '0.1em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Session
              </span>
              <input
                className="flex-1 bg-transparent border-none border-b outline-none px-0 pb-1 transition-colors"
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.1rem',
                  color: 'var(--ink)',
                  borderBottom: '1px solid var(--border)',
                }}
                placeholder="Untitled thread…"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border2)' }}
                onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)' }}
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-4">
                Your points — press Enter after each one
              </div>

              <div className="space-y-2 mb-4">
                {points.map((point, idx) => (
                  <div
                    key={point.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-md"
                  >
                    <span className="text-xs text-gray-500 w-4">{idx + 1}</span>
                    <span className="flex-1 text-sm">{point.text}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePoint(point.id)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  className="flex-1"
                  placeholder="a point you need to make…"
                  value={currentPoint}
                  onChange={(e) => setCurrentPoint(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addPoint()
                    }
                  }}
                />
                <Button onClick={addPoint} className="bg-gray-900 text-white">
                  Add →
                </Button>
              </div>
            </CardContent>
          </Card>

          {showNudge && !orderingResult && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-amber-900 mb-1">
                      {points.length === 3 ? "I see a story here." : `I see ${points.length} points that want an order.`}
                    </div>
                    <div className="text-xs text-amber-700">the threader is ready</div>
                  </div>
                  <Button
                    onClick={doThread}
                    disabled={isOrdering}
                    className="bg-amber-600 text-white hover:bg-amber-700"
                  >
                    {isOrdering ? "Ordering..." : "Find the order →"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isOrdering && (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="text-gray-600">Finding the best order...</div>
              </CardContent>
            </Card>
          )}

          {bestOrdering && (
            <Card>
              <div className="border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Suggested order</div>
                <button
                  className="text-blue-600 text-xs underline bg-transparent border-none cursor-pointer"
                  onClick={() => {
                    setOrderingResult(null)
                    setShowSaveButton(false)
                  }}
                >
                  edit points
                </button>
              </div>
              <div className="divide-y divide-gray-200">
                {bestOrdering.ordered_points.map((point, idx) => (
                  <div key={idx}>
                    <div className="grid grid-cols-[20px_1fr] gap-3 p-4">
                      <span className="text-xs font-medium text-blue-600 mt-1">{idx + 1}</span>
                      <div>
                        <div className="text-sm mb-2">{point}</div>
                        <div className="text-xs italic text-gray-500 font-serif">
                          {getReasoningText(idx, bestOrdering.ordered_points.length)}
                        </div>
                      </div>
                    </div>
                    {idx < bestOrdering.ordered_points.length - 1 && bestOrdering.bridges[idx] && (
                      <div className="px-5 py-2 text-xs text-blue-600 italic bg-blue-50 border-b border-gray-200">
                        {bestOrdering.bridges[idx]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

        </div>
      </div>
    )
  }

  return null
}

