"use client"

import Link from "next/link"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"

type ActiveTool = "ideation" | "threader" | "coach" | "dashboard" | "island" | null

interface SharedNavProps {
  activeTool?: ActiveTool
  onLogout: () => void
}

export default function SharedNav({ activeTool = null, onLogout }: SharedNavProps) {
  const btnBase = "px-3 py-1.5 text-xs uppercase tracking-wider border rounded transition-all"
  const btnInactive = `${btnBase} border-transparent text-[#9a948a] hover:border-[#e0dbd0]`
  const btnActive = `${btnBase} border-[#c8c2b4] text-[#1a1814] bg-[#f0ece2]`

  return (
    <nav className="sticky top-0 z-50 bg-[#f7f4ee] border-b border-[#e0dbd0] px-8 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-serif text-xl font-light text-[#1a1814] tracking-wide">
            Emberling
          </Link>
          <div className="flex gap-1">
            <Link href="/pre-writing">
              <button className={activeTool === "ideation" ? btnActive : btnInactive}>
                💡 Ideation
              </button>
            </Link>
            <Link href="/threader">
              <button className={activeTool === "threader" ? btnActive : btnInactive}>
                🧵 Threader
              </button>
            </Link>
            <Link href="/writing-coach">
              <button className={activeTool === "coach" ? btnActive : btnInactive}>
                ✍️ Coach
              </button>
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/island">
            <button 
              className={`${btnBase} ${activeTool === "island" ? "bg-[#fdf5f5]" : "bg-transparent"}`}
              style={{
                borderColor: '#d4b4b4',
                color: '#8b4040',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#fdf5f5' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = activeTool === "island" ? '#fdf5f5' : 'transparent' }}
            >
              🏝 Island
            </button>
          </Link>
          <Link href="/dashboard">
            <button className={activeTool === "dashboard" ? btnActive : `${btnBase} border-[#e0dbd0] text-[#9a948a] hover:border-[#c8c2b4] hover:text-[#1a1814]`}>
              ⊞ My Projects
            </button>
          </Link>
          <Button
            onClick={onLogout}
            variant="outline"
            size="sm"
            className="border-[#e0dbd0] text-[#9a948a] hover:border-[#c8c2b4] hover:text-[#1a1814]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  )
}

