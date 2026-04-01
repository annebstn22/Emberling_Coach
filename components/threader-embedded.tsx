"use client"

import { useState, useEffect, useRef } from "react"
import { X } from "lucide-react"
import ThreaderLinkGraphImport from "@/components/threader-link-graph"

// Cursor/TS can resolve two @types/react copies (project vs hoisted); runtime is fine.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ThreaderLinkGraph = ThreaderLinkGraphImport as any

interface ThreaderPoint {
  id: string
  text: string
  originalIndex: number
}

interface ThreaderResponse {
  all_points: string[]
  expanded_points: string[]
  orderings: Array<{
    method: string
    path: number[]
    score: number
    description: string
    ordered_points: string[]
  }>
  best_ordering: {
    method: string
    path: number[]
    score: number
    ordered_points: string[]
    bridges: string[]
    link_scores?: number[]
  }
}

// Reasoning text for each position (matching prototype)
const REASONS = [
  "opens with the concrete — earns trust before asking anything of the reader",
  "builds on what came before — the reader is ready for this now",
  "the payoff — lands harder because the groundwork is laid",
  "reinforces the through-line — adds weight without repeating",
  "closes the loop — brings the reader back, changed",
]

export default function ThreaderEmbedded({
  onOrderingComplete,
  onPointsChange,
  initialPoints,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
  initialOrderingResult,
}: {
  onOrderingComplete?: (orderedPoints: string[], bridges: string[], orderingResult: ThreaderResponse) => void
  onPointsChange?: (points: string[]) => void
  initialPoints?: string[]
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  initialOrderingResult?: ThreaderResponse
}) {
  const [currentPoint, setCurrentPoint] = useState("")
  const pointTextareaRef = useRef<HTMLTextAreaElement>(null)
  const [points, setPoints] = useState<ThreaderPoint[]>(
    initialPoints?.map((text, idx) => ({
      id: crypto.randomUUID(),
      text,
      originalIndex: idx,
    })) || []
  )
  const [isOrdering, setIsOrdering] = useState(false)
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [orderingResult, setOrderingResult] = useState<ThreaderResponse | null>(
    initialOrderingResult || null
  )
  const prevInitialPointsRef = useRef<string>("")

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed
  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse()
    } else {
      setInternalCollapsed(!internalCollapsed)
    }
  }

  // Sync ordering result when initialOrderingResult changes
  useEffect(() => {
    if (initialOrderingResult && initialOrderingResult !== orderingResult) {
      setOrderingResult(initialOrderingResult)
    }
  }, [initialOrderingResult])

  // Sync points when initialPoints changes (e.g., when feeding from ideation)
  // But preserve ordering result if the points match the ordered points
  useEffect(() => {
    // Compare the stringified version to detect actual changes
    const currentInitialPointsStr = JSON.stringify(initialPoints || [])
    const prevInitialPointsStr = prevInitialPointsRef.current
    
    if (currentInitialPointsStr !== prevInitialPointsStr) {
      prevInitialPointsRef.current = currentInitialPointsStr
      
      if (initialPoints && initialPoints.length > 0) {
        const newPoints = initialPoints.map((text, idx) => ({
          id: crypto.randomUUID(),
          text,
          originalIndex: idx,
        }))
        
        // Check if the new points match the ordered points from initialOrderingResult
        // If so, this is likely an update after ordering, so preserve the ordering result
        const orderedPointsFromInitial = initialOrderingResult?.best_ordering?.ordered_points || []
        const pointsMatchInitialOrdered = orderedPointsFromInitial.length > 0 && 
          JSON.stringify(initialPoints) === JSON.stringify(orderedPointsFromInitial)
        
        setPoints(newPoints)
        
        // Only clear ordering result if:
        // 1. Points don't match the ordered points from initialOrderingResult (meaning it's a real change)
        // 2. AND there's no initialOrderingResult provided (meaning it's not being restored from parent)
        if (!pointsMatchInitialOrdered && !initialOrderingResult) {
          setOrderingResult(null)
        } else if (initialOrderingResult) {
          // If we have initialOrderingResult, always use it (it will be set by the other useEffect)
          // This ensures the ordering result is preserved when points are synced after ordering
        }
      } else if (points.length > 0) {
        // If initialPoints is cleared, clear our points too
        setPoints([])
        setOrderingResult(null)
      }
    }
  }, [initialPoints, initialOrderingResult])

  const addPoint = () => {
    if (!currentPoint.trim()) return

    const newPoint: ThreaderPoint = {
      id: crypto.randomUUID(),
      text: currentPoint.trim(),
      originalIndex: points.length,
    }

    const updatedPoints = [...points, newPoint]
    setPoints(updatedPoints)
    setCurrentPoint("")
    // Reset textarea height
    if (pointTextareaRef.current) {
      pointTextareaRef.current.style.height = 'auto'
    }
    
    // Clear ordering result if points changed
    if (orderingResult) {
      setOrderingResult(null)
    }

    // Notify parent of points change
    if (onPointsChange) {
      onPointsChange(updatedPoints.map((p) => p.text))
    }
  }

  const removePoint = (id: string) => {
    const updatedPoints = points.filter((p) => p.id !== id)
    setPoints(updatedPoints)
    
    // Clear ordering result if points changed
    if (orderingResult) {
      setOrderingResult(null)
    }

    // Notify parent of points change
    if (onPointsChange) {
      onPointsChange(updatedPoints.map((p) => p.text))
    }
  }

  const doThread = async () => {
    if (points.length < 2) {
      alert("You need at least 2 points to find an order")
      return
    }

    setIsOrdering(true)
    // Don't clear ordering result here - we'll set it with the new result
    // Clearing it causes a flash where the result disappears

    try {
      const response = await fetch("/api/threader", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: points.map((p) => p.text),
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to order points")
      }

      const data: ThreaderResponse = await response.json()
      setOrderingResult(data)

      // Call callback with ordered points, bridges, and full result
      // Note: We don't include isCollapsed in the ordering result passed to the callback
      // as it's metadata, not part of the actual API response
      if (onOrderingComplete && data.best_ordering) {
        onOrderingComplete(
          data.best_ordering.ordered_points,
          data.best_ordering.bridges,
          data
        )
      }
    } catch (error) {
      console.error("Error ordering points:", error)
      alert(error instanceof Error ? error.message : "Failed to order points")
      // Only clear on error
      setOrderingResult(null)
    } finally {
      setIsOrdering(false)
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (pointTextareaRef.current) {
      pointTextareaRef.current.style.height = 'auto'
      pointTextareaRef.current.style.height = `${pointTextareaRef.current.scrollHeight}px`
    }
  }, [currentPoint])

  const showNudge = points.length >= 3 && !orderingResult && !isCollapsed
  const orderedPoints = orderingResult?.best_ordering?.ordered_points || []
  const bridges = orderingResult?.best_ordering?.bridges || []

  // Collapsed view: show only the ordered points with bridges
  if (isCollapsed && orderingResult?.best_ordering) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-[#a8c8e8] rounded-lg overflow-hidden">
          {orderedPoints.map((point, idx) => (
            <div key={idx}>
              <div className="px-3 py-2.5 border-b border-[#e0dbd0] grid grid-cols-[18px_1fr] gap-2.5 text-sm">
                <span className="text-[0.54rem] text-[#1a4a6e] mt-0.5">{idx + 1}</span>
                <div>
                  <div 
                    className="text-[#1a1814] mb-1"
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: '1.5'
                    }}
                  >
                    {point}
                  </div>
                  <div className="font-serif italic text-xs text-[#9a948a] leading-snug">
                    {REASONS[Math.min(idx, REASONS.length - 1)]}
                  </div>
                </div>
              </div>
              {idx < orderedPoints.length - 1 && bridges[idx] && (
                <div className="px-3 py-1 text-xs text-[#1a4a6e] bg-[#eef4fa] border-b border-[#e0dbd0] italic pl-8">
                  {bridges[idx]}
                </div>
              )}
            </div>
          ))}
          {orderingResult?.best_ordering?.link_scores &&
            orderingResult.best_ordering.link_scores.length > 0 && (
              <div className="px-2">
                <ThreaderLinkGraph
                  linkScores={orderingResult.best_ordering.link_scores}
                  variant="embedded"
                />
              </div>
            )}
        </div>
        {/* Expand button */}
        <div className="flex justify-end">
          <button
            onClick={toggleCollapse}
            className="bg-[#f7f4ee] border border-[#e0dbd0] rounded-md px-3 py-1.5 font-mono text-xs text-[#1a1814] cursor-pointer transition-all hover:border-[#c8c2b4] whitespace-nowrap"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  // Expanded view: show full interface
  return (
    <div className="space-y-3">
      {/* Points list */}
      <div className="flex flex-col gap-1.5 mb-2">
        {points.map((point, idx) => (
          <div
            key={point.id}
            className="flex items-start gap-2 px-3 py-2 bg-[#f7f4ee] border border-[#e0dbd0] rounded-md text-sm animate-in fade-in slide-in-from-top-2"
          >
            <span 
              className="text-[0.54rem] text-[#1a4a6e] min-w-[14px] flex-shrink-0"
              style={{ paddingTop: '0.125rem' }}
            >
              {idx + 1}
            </span>
            <span 
              className="flex-1"
              style={{
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
                overflowWrap: 'break-word',
                lineHeight: '1.5'
              }}
            >
              {point.text}
            </span>
            <button
              onClick={() => removePoint(point.id)}
              className="bg-none border-none text-[#9a948a] cursor-pointer text-xs hover:text-[#8b2020] transition-colors"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <textarea
          ref={pointTextareaRef}
          value={currentPoint}
          onChange={(e) => setCurrentPoint(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              addPoint()
            }
            // Shift+Enter allows new line (default behavior)
          }}
          placeholder="a point for this paragraph…"
          className="flex-1 bg-white border border-[#e0dbd0] rounded-md px-3 py-2 font-mono text-sm text-[#1a1814] outline-none transition-colors focus:border-[#c8c2b4] resize-none"
          style={{
            minHeight: '2.5rem',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
          rows={1}
        />
        <button
          onClick={addPoint}
          className="bg-[#1a4a6e] text-white border-none rounded-md px-3 py-2 font-mono text-xs cursor-pointer hover:opacity-85 transition-opacity"
        >
          Add →
        </button>
      </div>

      {/* Nudge */}
      {showNudge && (
        <div className="bg-[#eef4fa] border border-[#a8c8e8] rounded-lg px-4 py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-2">
          <div className="font-serif italic text-sm text-[#1a4a6e]">I see a story here.</div>
          <button
            onClick={doThread}
            disabled={isOrdering}
            className="bg-[#1a4a6e] text-white border-none rounded-md px-3 py-1.5 font-mono text-xs cursor-pointer whitespace-nowrap flex-shrink-0 hover:opacity-85 transition-opacity disabled:opacity-50"
          >
            {isOrdering ? "Ordering..." : "Order them →"}
          </button>
        </div>
      )}

      {/* Result */}
      {orderingResult && (
        <div className="bg-white border border-[#a8c8e8] rounded-lg overflow-hidden mt-2 animate-in fade-in slide-in-from-bottom-2">
          {orderedPoints.map((point, idx) => (
            <div key={idx}>
              <div className="px-3 py-2.5 border-b border-[#e0dbd0] grid grid-cols-[18px_1fr] gap-2.5 text-sm animate-in fade-in slide-in-from-left-2">
                <span className="text-[0.54rem] text-[#1a4a6e] mt-0.5">{idx + 1}</span>
                <div>
                  <div 
                    className="text-[#1a1814] mb-1"
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      lineHeight: '1.5'
                    }}
                  >
                    {point}
                  </div>
                  <div className="font-serif italic text-xs text-[#9a948a] leading-snug">
                    {REASONS[Math.min(idx, REASONS.length - 1)]}
                  </div>
                </div>
              </div>
              {idx < orderedPoints.length - 1 && bridges[idx] && (
                <div className="px-3 py-1 text-xs text-[#1a4a6e] bg-[#eef4fa] border-b border-[#e0dbd0] italic pl-8">
                  {bridges[idx]}
                </div>
              )}
            </div>
          ))}
          {orderingResult?.best_ordering?.link_scores &&
            orderingResult.best_ordering.link_scores.length > 0 && (
              <div className="px-2">
                <ThreaderLinkGraph
                  linkScores={orderingResult.best_ordering.link_scores}
                  variant="embedded"
                />
              </div>
            )}
        </div>
      )}

      {/* Done button - only show if we have an ordering result */}
      {orderingResult?.best_ordering && (
        <div className="flex justify-end">
          <button
            onClick={toggleCollapse}
            className="bg-[#f7f4ee] border border-[#e0dbd0] rounded-md px-3 py-1.5 font-mono text-xs text-[#1a1814] cursor-pointer transition-all hover:border-[#c8c2b4] whitespace-nowrap"
          >
            ✓ Done
          </button>
        </div>
      )}
    </div>
  )
}

