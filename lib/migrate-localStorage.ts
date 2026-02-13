import { supabase } from "./supabase"

interface LocalStorageProject {
  id: string
  name: string
  description: string
  tasks: any[]
  currentTaskIndex: number
  skipsUsed: number
  completedWork: string[]
  createdAt: string | Date
  coachMode: string
}

interface LocalStorageIdeationSession {
  id: string
  title: string
  description: string
  createdAt: string | Date
  ideas: any[]
  timer: number
  isTimerRunning: boolean
  uploadedFiles: any[]
  isComplete?: boolean
}

interface LocalStorageMisfitIdea {
  id: string
  content: string
  notes: string
  tags: string[]
  reasonDiscarded: string
  originalSessionTitle?: string
  discardedAt: string | Date
  rediscoveredIn?: string
  attachedFiles?: any[]
}

/**
 * Migrate projects from localStorage to Supabase
 */
export async function migrateProjects(userId: string): Promise<number> {
  try {
    const savedProjects = localStorage.getItem(`writing-coach-projects-${userId}`)
    if (!savedProjects) return 0

    const projects: LocalStorageProject[] = JSON.parse(savedProjects)
    let migratedCount = 0

    for (const project of projects) {
      try {
        // Convert old timestamp-based IDs to UUIDs if needed
        const projectId = /^\d+$/.test(project.id) ? crypto.randomUUID() : project.id
        
        // Upsert project
        const { error: projectError } = await supabase
          .from("projects")
          .upsert(
            {
              id: projectId,
              user_id: userId,
              name: project.name,
              description: project.description,
              coach_mode: project.coachMode,
              current_task_index: project.currentTaskIndex,
              skips_used: project.skipsUsed,
              completed_work: project.completedWork || [],
              created_at: new Date(project.createdAt).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )

        if (projectError) {
          console.error(`Error migrating project ${project.id}:`, projectError)
          continue
        }

        // Delete existing tasks
        await supabase.from("tasks").delete().eq("project_id", projectId)

        // Insert tasks
        if (project.tasks && project.tasks.length > 0) {
          const tasksToInsert = project.tasks.flatMap((task) => {
            // Convert old timestamp-based IDs to UUIDs if needed
            const taskId = /^\d+$/.test(task.id) ? crypto.randomUUID() : task.id
            const baseTask = {
              id: taskId,
              project_id: projectId,
              title: task.title,
              description: task.description,
              focus: task.focus,
              duration: task.duration,
              suggested_duration: task.suggestedDuration,
              completed: task.completed,
              user_work: task.userWork || null,
              feedback: task.feedback || null,
              completed_at: task.completedAt ? new Date(task.completedAt).toISOString() : null,
              needs_improvement: task.needsImprovement || false,
              attempts: task.attempts || 0,
              parent_task_id: task.parentTaskId || null,
              actionable_points: task.actionablePoints || [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }

            const allTasks = [baseTask]
            if (task.subtasks && task.subtasks.length > 0) {
              task.subtasks.forEach((subtask: any) => {
                // Convert old timestamp-based IDs to UUIDs if needed
                const subtaskId = /^\d+$/.test(subtask.id) ? crypto.randomUUID() : subtask.id
                allTasks.push({
                  id: subtaskId,
                  project_id: projectId,
                  title: subtask.title,
                  description: subtask.description,
                  focus: subtask.focus,
                  duration: subtask.duration,
                  suggested_duration: subtask.suggestedDuration,
                  completed: subtask.completed,
                  user_work: subtask.userWork || null,
                  feedback: subtask.feedback || null,
                  completed_at: subtask.completedAt ? new Date(subtask.completedAt).toISOString() : null,
                  needs_improvement: subtask.needsImprovement || false,
                  attempts: subtask.attempts || 0,
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
            console.error(`Error migrating tasks for project ${project.id}:`, tasksError)
            continue
          }
        }

        migratedCount++
      } catch (error) {
        console.error(`Error migrating project ${project.id}:`, error)
      }
    }

    return migratedCount
  } catch (error) {
    console.error("Error migrating projects:", error)
    return 0
  }
}

/**
 * Migrate ideation sessions from localStorage to Supabase
 */
export async function migrateIdeationSessions(userId: string): Promise<number> {
  try {
    const savedSessions = localStorage.getItem("ideation-sessions")
    if (!savedSessions) return 0

    const sessions: LocalStorageIdeationSession[] = JSON.parse(savedSessions)
    let migratedCount = 0

    for (const session of sessions) {
      try {
        // Convert old timestamp-based IDs to UUIDs if needed
        const sessionId = /^\d+$/.test(session.id) ? crypto.randomUUID() : session.id
        
        // Upsert session
        const { error: sessionError } = await supabase
          .from("ideation_sessions")
          .upsert(
            {
              id: sessionId,
              user_id: userId,
              title: session.title,
              description: session.description,
              timer: session.timer,
              is_timer_running: session.isTimerRunning,
              is_complete: session.isComplete || false,
              uploaded_files: session.uploadedFiles || [],
              created_at: new Date(session.createdAt).toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )

        if (sessionError) {
          console.error(`Error migrating session ${session.id}:`, sessionError)
          continue
        }

        // Delete existing ideas
        await supabase.from("ideas").delete().eq("session_id", sessionId)

        // Insert ideas
        if (session.ideas && session.ideas.length > 0) {
          const ideasToInsert = session.ideas.map((idea) => {
            // Convert old timestamp-based IDs to UUIDs if needed
            const ideaId = /^\d+$/.test(idea.id) ? crypto.randomUUID() : idea.id
            return {
              id: ideaId,
              session_id: sessionId,
              content: idea.content,
              card_id: idea.cardId,
              card_text: idea.cardText,
              notes: idea.notes || "",
              status: idea.status,
              attached_files: idea.attachedFiles || [],
              wins: idea.wins || null,
              score: idea.score || null,
              thurstone_score: idea.thurstoneScore || null,
              timestamp: new Date(idea.timestamp).toISOString(),
              created_at: new Date(idea.timestamp).toISOString(),
            }
          })

          const { error: ideasError } = await supabase.from("ideas").insert(ideasToInsert)

          if (ideasError) {
            console.error(`Error migrating ideas for session ${session.id}:`, ideasError)
            continue
          }
        }

        migratedCount++
      } catch (error) {
        console.error(`Error migrating session ${session.id}:`, error)
      }
    }

    return migratedCount
  } catch (error) {
    console.error("Error migrating ideation sessions:", error)
    return 0
  }
}

/**
 * Migrate misfit ideas from localStorage to Supabase
 */
export async function migrateMisfitIdeas(userId: string): Promise<number> {
  try {
    const savedMisfits = localStorage.getItem("misfit-ideas")
    if (!savedMisfits) return 0

    const misfits: LocalStorageMisfitIdea[] = JSON.parse(savedMisfits)
    let migratedCount = 0

    for (const misfit of misfits) {
      try {
        const { error } = await supabase.from("misfit_ideas").upsert(
          {
            id: misfit.id,
            user_id: userId,
            content: misfit.content,
            notes: misfit.notes,
            tags: misfit.tags || [],
            reason_discarded: misfit.reasonDiscarded,
            original_session_title: misfit.originalSessionTitle || null,
            attached_files: misfit.attachedFiles || [],
            rediscovered_in: misfit.rediscoveredIn || null,
            discarded_at: new Date(misfit.discardedAt).toISOString(),
            created_at: new Date(misfit.discardedAt).toISOString(),
          },
          { onConflict: "id" }
        )

        if (error) {
          console.error(`Error migrating misfit idea ${misfit.id}:`, error)
          continue
        }

        migratedCount++
      } catch (error) {
        console.error(`Error migrating misfit idea ${misfit.id}:`, error)
      }
    }

    return migratedCount
  } catch (error) {
    console.error("Error migrating misfit ideas:", error)
    return 0
  }
}

/**
 * Migrate all localStorage data to Supabase for a user
 * Returns an object with migration counts
 */
export async function migrateAllLocalStorageData(userId: string): Promise<{
  projects: number
  sessions: number
  misfits: number
}> {
  const projects = await migrateProjects(userId)
  const sessions = await migrateIdeationSessions(userId)
  const misfits = await migrateMisfitIdeas(userId)

  return { projects, sessions, misfits }
}

