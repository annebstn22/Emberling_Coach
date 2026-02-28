"use client"

import { useState, useEffect } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface MisfitIdea {
  id: string
  content: string
  notes: string
  tags: string[]
  reasonDiscarded: string
  originalSessionTitle?: string
  discardedAt: Date
  rediscoveredIn?: string
  attachedFiles?: any[]
}

export default function IslandOfMisfits({
  user,
  onMisfitImport,
}: {
  user: User | null
  onMisfitImport?: (idea: MisfitIdea) => void
}) {
  const [misfitIdeas, setMisfitIdeas] = useState<MisfitIdea[]>([])
  const [searchTerm, setSearchTerm] = useState("")

  const loadMisfitIdeas = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from("misfit_ideas")
        .select("*")
        .eq("user_id", user.id)
        .order("discarded_at", { ascending: false })

      if (!error && data) {
        setMisfitIdeas(
          data.map((idea: any) => ({
            id: idea.id,
            content: idea.content,
            notes: idea.notes,
            tags: idea.tags || [],
            reasonDiscarded: idea.reason_discarded,
            originalSessionTitle: idea.original_session_title || undefined,
            discardedAt: new Date(idea.discarded_at),
            rediscoveredIn: idea.rediscovered_in || undefined,
            attachedFiles: idea.attached_files || undefined,
          }))
        )
      }
    } catch (error) {
      console.error("Error loading misfit ideas:", error)
    }
  }

  useEffect(() => {
    if (user?.id) loadMisfitIdeas()
    else setMisfitIdeas([])
  }, [user?.id])

  const removeMisfitIdea = async (id: string) => {
    try {
      await supabase.from("misfit_ideas").delete().eq("id", id)
      setMisfitIdeas((prev) => prev.filter((i) => i.id !== id))
    } catch (error) {
      console.error("Error removing misfit idea:", error)
    }
  }

  const filteredIdeas = misfitIdeas.filter((idea) => {
    if (!searchTerm) return true
    const q = searchTerm.toLowerCase()
    return (
      idea.content.toLowerCase().includes(q) ||
      (idea.originalSessionTitle || "").toLowerCase().includes(q)
    )
  })

  return (
    <div style={{ width: "100%", maxWidth: "640px", margin: "0 auto", padding: "3rem 1.5rem" }}>
      {/* Title */}
      <h2
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "2rem",
          fontWeight: 300,
          color: "var(--ink)",
          marginBottom: ".3rem",
        }}
      >
        🏝 <em>Island of Misfit Ideas</em>
      </h2>

      {/* Sub */}
      <p
        style={{
          fontSize: ".68rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".12em",
          marginBottom: ".5rem",
          fontFamily: "var(--font-mono)",
        }}
      >
        ideas that didn't make the cut — yet
      </p>

      {/* Desc */}
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: ".93rem",
          color: "var(--muted)",
          marginBottom: "2rem",
          lineHeight: 1.5,
        }}
      >
        Every idea you exile during ranking ends up here. Searchable across all your sessions.
        The right project hasn't arrived for them yet.
      </p>

      {/* Search */}
      <input
        type="text"
        placeholder="search exiled ideas…"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: "100%",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: ".68rem 1rem",
          fontFamily: "var(--font-mono)",
          fontSize: ".85rem",
          color: "var(--ink)",
          outline: "none",
          marginBottom: "1.5rem",
          transition: "border-color .2s",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border2)" }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)" }}
      />

      {/* List */}
      {filteredIdeas.length === 0 ? (
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            color: "var(--muted)",
            fontSize: ".93rem",
            padding: "2rem 0",
            textAlign: "center",
          }}
        >
          {misfitIdeas.length === 0
            ? "No exiled ideas yet. They'll appear here when you exile them during ranking."
            : "No ideas match your search."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: ".5rem" }}>
          {filteredIdeas.map((idea) => (
            <div
              key={idea.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "1rem",
                padding: ".85rem 1.1rem",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderLeft: "3px solid #d4b4b4",
                borderRadius: "8px",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: ".88rem",
                    color: "var(--ink2)",
                    lineHeight: 1.4,
                  }}
                >
                  {idea.content}
                </div>
                {idea.originalSessionTitle && (
                  <div
                    style={{
                      fontSize: ".6rem",
                      color: "var(--muted)",
                      marginTop: ".2rem",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    from "{idea.originalSessionTitle}"
                  </div>
                )}
              </div>

              {/* Rescue */}
              <button
                onClick={() => {
                  onMisfitImport?.(idea)
                  removeMisfitIdea(idea.id)
                }}
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
                  flexShrink: 0,
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
                rescue →
              </button>

              {/* Delete */}
              <button
                onClick={() => removeMisfitIdea(idea.id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--muted)",
                  cursor: "pointer",
                  fontSize: ".75rem",
                  padding: ".1rem .2rem",
                  flexShrink: 0,
                  transition: "color .15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--red)" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)" }}
                title="Delete permanently"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
