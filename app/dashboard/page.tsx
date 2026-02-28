"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sparkles, Lightbulb, FileText, X } from "lucide-react"
import Link from "next/link"
import SharedNav from "@/components/shared-nav"

interface DashboardProject {
  id: string
  type: "ideation" | "threader" | "coach"
  name: string
  date: string
  metadata: string
  preview: string
  coachProject?: string
  lastView?: string // For ideation sessions
  isComplete?: boolean // For ideation sessions
}

function DashboardContent() {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [ideationSessions, setIdeationSessions] = useState<DashboardProject[]>([])
  const [threaderProjects, setThreaderProjects] = useState<DashboardProject[]>([])
  const [coachProjects, setCoachProjects] = useState<DashboardProject[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "ideation" | "threader" | "coach"; id: string; name: string } | null>(null)

  useEffect(() => {
    if (user?.id) {
      loadAllProjects()
    }
  }, [user?.id])

  const loadAllProjects = async () => {
    if (!user?.id) return

    setLoading(true)
    try {
      // Load Ideation Sessions
      const { data: ideationData, error: ideationError } = await supabase
        .from("ideation_sessions")
        .select("*, ideas(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!ideationError && ideationData) {
        // Fetch project names for ideation sessions linked to coach projects
        const coachProjectIds = ideationData
          .filter((s: any) => s.coach_project_id)
          .map((s: any) => s.coach_project_id)
        
        let projectNamesMap: Record<string, string> = {}
        if (coachProjectIds.length > 0) {
          const { data: projectsData } = await supabase
            .from("projects")
            .select("id, name")
            .in("id", coachProjectIds)
          
          if (projectsData) {
            projectsData.forEach((p: any) => {
              projectNamesMap[p.id] = p.name || "Untitled project"
            })
          }
        }

        const formattedIdeation: DashboardProject[] = ideationData.map((s: any) => ({
          id: s.id,
          type: "ideation" as const,
          name: s.title || "Untitled session",
          date: new Date(s.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          metadata: `${s.ideas?.length || 0} idea${(s.ideas?.length || 0) !== 1 ? "s" : ""}`,
          preview: s.ideas?.[0]?.content || "",
          coachProject: s.coach_project_id ? projectNamesMap[s.coach_project_id] || null : null,
          lastView: s.last_view || undefined,
          isComplete: s.is_complete || false,
        }))
        setIdeationSessions(formattedIdeation)
      }

      // Load Threader Projects
      const { data: threaderData, error: threaderError } = await supabase
        .from("threader_projects")
        .select("*, threader_items(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!threaderError && threaderData) {
        // Fetch project names for threads linked to coach projects
        const coachProjectIds = threaderData
          .filter((p: any) => p.coach_project_id)
          .map((p: any) => p.coach_project_id)
        
        let projectNamesMap: Record<string, string> = {}
        if (coachProjectIds.length > 0) {
          const { data: projectsData } = await supabase
            .from("projects")
            .select("id, name")
            .in("id", coachProjectIds)
          
          if (projectsData) {
            projectsData.forEach((p: any) => {
              projectNamesMap[p.id] = p.name || "Untitled project"
            })
          }
        }

        const formattedThreader: DashboardProject[] = threaderData.map((p: any) => ({
          id: p.id,
          type: "threader" as const,
          name: p.title || "Untitled thread",
          date: new Date(p.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          metadata: `${p.threader_items?.length || 0} point${(p.threader_items?.length || 0) !== 1 ? "s" : ""}`,
          preview: p.threader_items?.[0]?.content || "",
          coachProject: p.coach_project_id ? projectNamesMap[p.coach_project_id] || null : null,
        }))
        setThreaderProjects(formattedThreader)
      }

      // Load Writing Coach Projects
      const { data: coachData, error: coachError } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!coachError && coachData) {
        const formattedCoach: DashboardProject[] = coachData.map((p: any) => ({
          id: p.id,
          type: "coach" as const,
          name: p.name || "Untitled project",
          date: new Date(p.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          }),
          metadata: `${p.progress || 0}% complete`,
          preview: p.description?.slice(0, 55) || "",
        }))
        setCoachProjects(formattedCoach)
      }
    } catch (error) {
      console.error("Error loading projects:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterProjects = (projects: DashboardProject[], query: string): DashboardProject[] => {
    if (!query) return projects
    const q = query.toLowerCase()
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.preview.toLowerCase().includes(q) ||
        p.metadata.toLowerCase().includes(q)
    )
  }

  const filteredIdeation = filterProjects(ideationSessions, searchQuery)
  const filteredThreader = filterProjects(threaderProjects, searchQuery)
  const filteredCoach = filterProjects(coachProjects, searchQuery)

  const handleProjectClick = (project: DashboardProject, e?: React.MouseEvent) => {
    // Don't navigate if clicking the delete button
    if (e && (e.target as HTMLElement).closest('.delete-btn')) {
      return
    }
    
    if (project.type === "ideation") {
      // Match behavior from ideation dashboard: use lastView or default to ranked/ideate
      const targetView = project.lastView || (project.isComplete ? "ranked" : "ideate")
      router.push(`/pre-writing?view=${targetView}&session=${project.id}`)
    } else if (project.type === "threader") {
      // Match behavior from threader dashboard: load session
      router.push(`/threader?view=session&session=${project.id}`)
    } else if (project.type === "coach") {
      // Match behavior from writing coach dashboard: select project (opens directly to working state)
      router.push(`/writing-coach?project=${project.id}`)
    }
  }

  const handleDeleteClick = (e: React.MouseEvent, project: DashboardProject) => {
    e.stopPropagation()
    setDeleteConfirm({
      type: project.type,
      id: project.id,
      name: project.name,
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm || !user?.id) return

    try {
      if (deleteConfirm.type === "ideation") {
        // Delete ideas first (foreign key constraint)
        await supabase.from("ideas").delete().eq("session_id", deleteConfirm.id)
        // Then delete the session
        await supabase.from("ideation_sessions").delete().eq("id", deleteConfirm.id)
        setIdeationSessions((prev) => prev.filter((p) => p.id !== deleteConfirm.id))
      } else if (deleteConfirm.type === "threader") {
        // Delete threader items first (foreign key constraint)
        await supabase.from("threader_items").delete().eq("project_id", deleteConfirm.id)
        // Then delete the project
        await supabase.from("threader_projects").delete().eq("id", deleteConfirm.id)
        setThreaderProjects((prev) => prev.filter((p) => p.id !== deleteConfirm.id))
      } else if (deleteConfirm.type === "coach") {
        // Delete associated tasks, threader projects, and ideation sessions first
        const { data: projectData } = await supabase
          .from("projects")
          .select("id")
          .eq("id", deleteConfirm.id)
          .single()
        
        if (projectData) {
          // Delete tasks
          await supabase.from("tasks").delete().eq("project_id", deleteConfirm.id)
          // Delete associated threader projects
          await supabase.from("threader_projects").delete().eq("coach_project_id", deleteConfirm.id)
          // Delete associated ideation sessions
          await supabase.from("ideation_sessions").delete().eq("coach_project_id", deleteConfirm.id)
          // Finally delete the project
          await supabase.from("projects").delete().eq("id", deleteConfirm.id)
        }
        setCoachProjects((prev) => prev.filter((p) => p.id !== deleteConfirm.id))
      }
      setDeleteConfirm(null)
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("Failed to delete project. Please try again.")
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="text-[#9a948a]">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee]">
      <SharedNav activeTool="dashboard" onLogout={signOut} />

      {/* Main Content */}
      <div className="max-w-[860px] mx-auto px-6 py-12">
        <h2 className="font-serif text-3xl font-light text-[#1a1814] mb-1">My Projects</h2>
        <p className="text-xs text-[#9a948a] uppercase tracking-wider mb-6">
          all your saved work — click any card to open
        </p>

        {/* Search */}
        <div className="mb-8">
          <Input
            type="text"
            placeholder="Search by name or content…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-[420px] bg-white border-[#e0dbd0] rounded-lg px-4 py-2.5 font-mono text-sm text-[#1a1814] focus:border-[#c8c2b4] focus:outline-none"
          />
        </div>

        {/* Writing Coach Projects - First */}
        <div className="mb-10">
          <div className="text-xs uppercase tracking-wider text-[#9a948a] mb-3 pb-2 border-b border-[#e0dbd0]">
            ✍️ Writing Projects
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {filteredCoach.length === 0 ? (
              <div className="font-serif italic text-sm text-[#9a948a] py-1">No projects yet.</div>
            ) : (
              filteredCoach.map((project) => (
                <div
                  key={project.id}
                  onClick={(e) => handleProjectClick(project, e)}
                  className="bg-white border border-[#e0dbd0] rounded-lg p-4 cursor-pointer transition-all hover:border-[#c8c2b4] hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-1 relative"
                >
                  <button
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="delete-btn absolute top-2 right-2 p-1 text-[#9a948a] hover:text-[#8b2020] transition-colors"
                    title="Delete project"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-[0.56rem] uppercase tracking-wider text-[#1a5c32]">✍️ Writing</div>
                  <div className="font-serif text-base text-[#1a1814] leading-snug">{project.name}</div>
                  <div className="text-xs text-[#9a948a]">{project.date} · {project.metadata}</div>
                  {project.preview && (
                    <div className="text-xs text-[#9a948a] italic truncate">{project.preview}</div>
                  )}
                </div>
              ))
            )}
            <button
              onClick={() => router.push("/writing-coach")}
              className="flex items-center gap-2 bg-transparent border border-dashed border-[#c8c2b4] rounded-lg p-4 cursor-pointer transition-all hover:border-[#e0dbd0] hover:text-[#1a1814] hover:bg-white font-mono text-xs text-[#9a948a]"
            >
              + New writing project
            </button>
          </div>
        </div>

        {/* Ideation Sessions */}
        <div className="mb-10">
          <div className="text-xs uppercase tracking-wider text-[#9a948a] mb-3 pb-2 border-b border-[#e0dbd0]">
            💡 Ideation Sessions
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {filteredIdeation.length === 0 ? (
              <div className="font-serif italic text-sm text-[#9a948a] py-1">No sessions yet.</div>
            ) : (
              filteredIdeation.map((project) => (
                <div
                  key={project.id}
                  onClick={(e) => handleProjectClick(project, e)}
                  className="bg-white border border-[#e0dbd0] rounded-lg p-4 cursor-pointer transition-all hover:border-[#c8c2b4] hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-1 relative"
                >
                  <button
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="delete-btn absolute top-2 right-2 p-1 text-[#9a948a] hover:text-[#8b2020] transition-colors"
                    title="Delete session"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-[0.56rem] uppercase tracking-wider text-[#b8860b]">💡 Ideation</div>
                  <div className="font-serif text-base text-[#1a1814] leading-snug">{project.name}</div>
                  <div className="text-xs text-[#9a948a]">{project.date} · {project.metadata}</div>
                  {project.preview && (
                    <div className="text-xs text-[#9a948a] italic truncate">{project.preview}</div>
                  )}
                  {project.coachProject && (
                    <div className="text-[0.6rem] text-[#1a4a6e] mt-1">↳ from "{project.coachProject}"</div>
                  )}
                </div>
              ))
            )}
            <button
              onClick={() => router.push("/pre-writing")}
              className="flex items-center gap-2 bg-transparent border border-dashed border-[#c8c2b4] rounded-lg p-4 cursor-pointer transition-all hover:border-[#e0dbd0] hover:text-[#1a1814] hover:bg-white font-mono text-xs text-[#9a948a]"
            >
              + New ideation session
            </button>
          </div>
        </div>

        {/* Threader Projects */}
        <div className="mb-10">
          <div className="text-xs uppercase tracking-wider text-[#9a948a] mb-3 pb-2 border-b border-[#e0dbd0]">
            🧵 Threads
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {filteredThreader.length === 0 ? (
              <div className="font-serif italic text-sm text-[#9a948a] py-1">No threads yet.</div>
            ) : (
              filteredThreader.map((project) => (
                <div
                  key={project.id}
                  onClick={(e) => handleProjectClick(project, e)}
                  className="bg-white border border-[#e0dbd0] rounded-lg p-4 cursor-pointer transition-all hover:border-[#c8c2b4] hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-1 relative"
                >
                  <button
                    onClick={(e) => handleDeleteClick(e, project)}
                    className="delete-btn absolute top-2 right-2 p-1 text-[#9a948a] hover:text-[#8b2020] transition-colors"
                    title="Delete thread"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <div className="text-[0.56rem] uppercase tracking-wider text-[#1a4a6e]">🧵 Thread</div>
                  <div className="font-serif text-base text-[#1a1814] leading-snug">{project.name}</div>
                  <div className="text-xs text-[#9a948a]">{project.date} · {project.metadata}</div>
                  {project.preview && (
                    <div className="text-xs text-[#9a948a] italic truncate">{project.preview}</div>
                  )}
                  {project.coachProject && (
                    <div className="text-[0.6rem] text-[#1a4a6e] mt-1">↳ from "{project.coachProject}"</div>
                  )}
                </div>
              ))
            )}
            <button
              onClick={() => router.push("/threader")}
              className="flex items-center gap-2 bg-transparent border border-dashed border-[#c8c2b4] rounded-lg p-4 cursor-pointer transition-all hover:border-[#e0dbd0] hover:text-[#1a1814] hover:bg-white font-mono text-xs text-[#9a948a]"
            >
              + New thread
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/45 z-[200] flex items-center justify-center" onClick={cancelDelete}>
          <div className="bg-white border border-[#e0dbd0] rounded-xl p-7 max-w-[360px] w-[90%] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="font-serif text-lg text-[#1a1814] mb-1">Delete this {deleteConfirm.type === "ideation" ? "session" : deleteConfirm.type === "threader" ? "thread" : "project"}?</div>
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

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center">
        <div className="text-[#9a948a]">Loading...</div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}

