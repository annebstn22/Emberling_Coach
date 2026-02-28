"use client"

import { useState, useEffect } from "react"

interface Idea {
  id: string
  text: string
  crossed: boolean
}

const STRATEGY_CARDS = [
  "What would someone who completely disagrees think about this?",
  "What's the most boring version of this idea? Now make it strange.",
  "If you had to explain this to a 6-year-old, what stays?",
  "What's the opposite of what you just said?",
  "What does this remind you of from a completely different field?",
  "What question does this idea refuse to answer?",
  "What would you cut if you only had half the space?",
  "What are you most afraid to include?",
  "Who benefits if this idea is wrong?",
  "What would make someone tear this apart?",
]

export default function IdeationEmbedded({
  onIdeasChange,
  onFeedToThreader,
  initialIdeas,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse,
}: {
  onIdeasChange?: (ideas: string[]) => void
  onFeedToThreader?: (ideas: string[]) => void
  initialIdeas?: string[]
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}) {
  const [currentPrompt, setCurrentPrompt] = useState(0)
  const [currentIdea, setCurrentIdea] = useState("")
  const [internalCollapsed, setInternalCollapsed] = useState(false)
  const [ideas, setIdeas] = useState<Idea[]>(
    initialIdeas?.map((text) => ({
      id: crypto.randomUUID(),
      text,
      crossed: false,
    })) || []
  )

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalCollapsed
  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse()
    } else {
      setInternalCollapsed(!internalCollapsed)
    }
  }

  const cyclePrompt = () => {
    setCurrentPrompt((prev) => (prev + 1) % STRATEGY_CARDS.length)
  }

  const addIdea = () => {
    if (!currentIdea.trim()) return

    const newIdea: Idea = {
      id: crypto.randomUUID(),
      text: currentIdea.trim(),
      crossed: false,
    }

    const updatedIdeas = [...ideas, newIdea]
    setIdeas(updatedIdeas)
    setCurrentIdea("")
    
    // Notify parent of ideas change (only active/non-crossed ideas)
    if (onIdeasChange) {
      onIdeasChange(updatedIdeas.filter((i) => !i.crossed).map((i) => i.text))
    }
  }

  const toggleCross = (id: string) => {
    const updatedIdeas = ideas.map((idea) =>
      idea.id === id ? { ...idea, crossed: !idea.crossed } : idea
    )
    setIdeas(updatedIdeas)
    
    // Notify parent of ideas change (only active/non-crossed ideas)
    if (onIdeasChange) {
      onIdeasChange(updatedIdeas.filter((i) => !i.crossed).map((i) => i.text))
    }
  }

  const hardDeleteIdea = (id: string) => {
    const updatedIdeas = ideas.filter((idea) => idea.id !== id)
    setIdeas(updatedIdeas)
    
    // Notify parent of ideas change (only active/non-crossed ideas)
    if (onIdeasChange) {
      onIdeasChange(updatedIdeas.filter((i) => !i.crossed).map((i) => i.text))
    }
  }

  const feedToThreader = () => {
    const activeIdeas = ideas.filter((i) => !i.crossed).map((i) => i.text)
    if (!activeIdeas.length) {
      alert("No active ideas to feed to Threader")
      return
    }
    if (onFeedToThreader) {
      onFeedToThreader(activeIdeas)
    }
  }

  const activeIdeasCount = ideas.filter((i) => !i.crossed).length
  const keptIdeas = ideas.filter((i) => !i.crossed).map((i) => i.text)

  // Collapsed view - show tags
  if (isCollapsed) {
    return (
      <div className="flex flex-wrap gap-1.5 items-center">
        {keptIdeas.length > 0 ? (
          keptIdeas.map((idea, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-1 bg-[#fdf8ee] border border-[#e8d08a] rounded text-xs text-[#b8860b]"
            >
              {idea}
            </span>
          ))
        ) : (
          <span className="text-xs text-[#9a948a] italic">No ideas kept</span>
        )}
        <button
          onClick={toggleCollapse}
          className="ml-auto text-xs text-[#9a948a] hover:text-[#1a1814] transition-colors px-2 py-1"
        >
          expand →
        </button>
      </div>
    )
  }

  // Expanded view - full ideation interface
  return (
    <div className="space-y-3">
      {/* Prompt Card */}
      <div
        onClick={cyclePrompt}
        className="bg-[#1a1814] text-[#f7f4ee] rounded-lg p-4 cursor-pointer transition-transform hover:-translate-y-0.5 min-h-[72px] flex flex-col justify-between"
      >
        <div className="text-[0.52rem] opacity-38 uppercase tracking-wider mb-1.5">
          Thinking card — click for a new one
        </div>
        <div className="font-serif italic text-sm leading-snug opacity-100 transition-opacity duration-300">
          {STRATEGY_CARDS[currentPrompt]}
        </div>
        <div className="text-[0.5rem] opacity-22 self-end mt-1">click for next →</div>
      </div>

      {/* Ideas List */}
      <div className="flex flex-col gap-1.5">
        {ideas.map((idea, idx) => (
          <div
            key={idea.id}
            className={`flex items-center gap-2 px-3 py-2 bg-[#f7f4ee] border border-[#e0dbd0] rounded-md text-sm transition-all ${
              idea.crossed ? "bg-[#fdf5f5] border-[#e8c8c8]" : ""
            }`}
          >
            <span className={`text-[0.54rem] min-w-[14px] flex-shrink-0 ${idea.crossed ? "text-[#9a948a]" : "text-[#b8860b]"}`}>
              {idx + 1}
            </span>
            <span className={`flex-1 leading-snug ${idea.crossed ? "line-through text-[#9a948a]" : ""}`}>
              {idea.text}
            </span>
            <button
              onClick={() => toggleCross(idea.id)}
              className="bg-none border-none text-[#9a948a] cursor-pointer text-xs px-2 py-1 rounded transition-all hover:text-[#8b4040] hover:bg-[#fdf0f0] flex-shrink-0"
              title={idea.crossed ? "Restore" : "Cross out"}
            >
              {idea.crossed ? "↩" : "✕"}
            </button>
            <button
              onClick={() => hardDeleteIdea(idea.id)}
              className="bg-none border-none text-[#9a948a] cursor-pointer text-[0.58rem] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-all hover:text-[#8b2020] hover:bg-[#fdf0f0] flex-shrink-0"
              title="Delete permanently"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Input Row */}
      <div className="flex gap-2">
        <input
          type="text"
          value={currentIdea}
          onChange={(e) => setCurrentIdea(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addIdea()
            }
          }}
          placeholder="an idea…"
          className="flex-1 bg-white border border-[#e0dbd0] rounded-md px-3 py-2 font-mono text-sm text-[#1a1814] outline-none transition-colors focus:border-[#c8c2b4]"
        />
        <button
          onClick={addIdea}
          className="bg-[#b8860b] text-white border-none rounded-md px-3 py-2 font-mono text-xs cursor-pointer hover:opacity-85 transition-opacity"
        >
          Add →
        </button>
      </div>

      {/* Action Row */}
      {ideas.length > 0 && (
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-[0.62rem] text-[#9a948a] flex-1">
            {activeIdeasCount} active idea{activeIdeasCount !== 1 ? "s" : ""}
          </span>
          {activeIdeasCount >= 3 && (
            <button
              onClick={feedToThreader}
              className="bg-[#eef4fa] border border-[#a8c8e8] rounded-md px-3 py-1.5 font-mono text-xs text-[#1a4a6e] cursor-pointer transition-all hover:bg-[#1a4a6e] hover:text-white hover:border-[#1a4a6e] whitespace-nowrap"
            >
              🧵 Feed to Threader
            </button>
          )}
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

