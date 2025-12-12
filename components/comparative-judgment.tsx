"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, BarChart3, Trophy } from "lucide-react"

interface IdeaEntry {
  id: string
  content: string
  cardText: string
  notes: string
  status: "active" | "discarded" | "selected"
  attachedFiles?: any[]
  score?: number
  wins?: number
}

interface RankingState {
  totalComparisons: number
  ideaAWins: number
  ideaBWins: number
}

export default function ComparativeJudgment({
  ideas,
  onRankingComplete,
}: { ideas: IdeaEntry[]; onRankingComplete: (rankedIdeas: IdeaEntry[]) => void }) {
  const [currentIdeas, setCurrentIdeas] = useState<IdeaEntry[]>(
    ideas.map((idea, idx) => ({ ...idea, score: 0, wins: 0 })),
  )
  const [pairIndex, setPairIndex] = useState(0)
  const [rankingStats, setRankingStats] = useState<RankingState>({
    totalComparisons: 0,
    ideaAWins: 0,
    ideaBWins: 0,
  })
  const [isComplete, setIsComplete] = useState(false)

  if (ideas.length < 2) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <p className="text-gray-600">You need at least 2 ideas to start ranking.</p>
        </CardContent>
      </Card>
    )
  }

  const getCurrentPair = () => {
    if (pairIndex >= currentIdeas.length * currentIdeas.length) {
      return null
    }
    const ideaAIdx = Math.floor(pairIndex / currentIdeas.length)
    const ideaBIdx = pairIndex % currentIdeas.length
    if (ideaAIdx === ideaBIdx || ideaAIdx >= currentIdeas.length || ideaBIdx >= currentIdeas.length) {
      return null
    }
    return {
      ideaA: currentIdeas[ideaAIdx],
      ideaB: currentIdeas[ideaBIdx],
      indexA: ideaAIdx,
      indexB: ideaBIdx,
    }
  }

  const selectWinner = (winnerIdx: "a" | "b") => {
    const pair = getCurrentPair()
    if (!pair) return

    const updatedIdeas = [...currentIdeas]
    const winnerIndex = winnerIdx === "a" ? pair.indexA : pair.indexB
    const loserIndex = winnerIdx === "a" ? pair.indexB : pair.indexA

    updatedIdeas[winnerIndex] = {
      ...updatedIdeas[winnerIndex],
      score: (updatedIdeas[winnerIndex].score || 0) + 1,
      wins: (updatedIdeas[winnerIndex].wins || 0) + 1,
    }

    setCurrentIdeas(updatedIdeas)
    setRankingStats({
      totalComparisons: rankingStats.totalComparisons + 1,
      ideaAWins: winnerIdx === "a" ? rankingStats.ideaAWins + 1 : rankingStats.ideaAWins,
      ideaBWins: winnerIdx === "b" ? rankingStats.ideaBWins + 1 : rankingStats.ideaBWins,
    })

    const nextPairIndex = pairIndex + 1
    if (nextPairIndex >= currentIdeas.length * currentIdeas.length) {
      setIsComplete(true)
      onRankingComplete(updatedIdeas)
    } else {
      setPairIndex(nextPairIndex)
    }
  }

  if (isComplete) {
    const rankedIdeas = [...currentIdeas].sort((a, b) => (b.score || 0) - (a.score || 0))

    return (
      <div className="space-y-6">
        <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-amber-600" />
              <span>Ranking Complete!</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{rankingStats.totalComparisons}</div>
                <div className="text-xs text-gray-600">Comparisons Made</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600">{rankedIdeas[0]?.wins || 0}</div>
                <div className="text-xs text-gray-600">Top Idea Wins</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-800">{rankedIdeas.length}</div>
                <div className="text-xs text-gray-600">Ideas Ranked</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Ideas Ranked by Quality</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rankedIdeas.map((idea, idx) => (
                <div
                  key={idea.id}
                  className={`border rounded-lg p-4 ${
                    idx === 0
                      ? "bg-amber-50 border-amber-200 ring-2 ring-amber-300"
                      : idx === 1
                        ? "bg-gray-50 border-gray-200"
                        : idx === 2
                          ? "bg-orange-50 border-orange-200"
                          : "bg-white border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <div
                          className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                            idx === 0
                              ? "bg-amber-400 text-white"
                              : idx === 1
                                ? "bg-gray-400 text-white"
                                : idx === 2
                                  ? "bg-orange-400 text-white"
                                  : "bg-gray-300 text-white"
                          }`}
                        >
                          {idx + 1}
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{idea.content}</p>
                        {idea.notes && <p className="text-xs text-gray-600 mt-1">"{idea.notes}"</p>}
                      </div>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {idea.wins} wins
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pair = getCurrentPair()
  if (!pair) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <p className="text-gray-600">No more comparisons needed.</p>
        </CardContent>
      </Card>
    )
  }

  const progress = ((pairIndex + 1) / (currentIdeas.length * currentIdeas.length)) * 100

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compare Ideas</span>
            <Badge variant="outline">
              {Math.min(pairIndex + 1, currentIdeas.length * currentIdeas.length)} /{" "}
              {currentIdeas.length * currentIdeas.length}
            </Badge>
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">Which idea resonates more with you?</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Idea A */}
            <button
              onClick={() => selectWinner("a")}
              className="text-left transition-all hover:scale-105 active:scale-95"
            >
              <Card
                className={`cursor-pointer transition-all border-2 hover:border-amber-400 ${
                  rankingStats.ideaAWins > rankingStats.ideaBWins
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <CardContent className="p-6">
                  <p className="text-lg font-medium text-gray-800 mb-3">{pair.ideaA.content}</p>
                  {pair.ideaA.notes && <p className="text-sm text-gray-600 italic mb-3">"{pair.ideaA.notes}"</p>}
                  {pair.ideaA.attachedFiles && pair.ideaA.attachedFiles.length > 0 && (
                    <div className="text-xs text-gray-500 mb-3">{pair.ideaA.attachedFiles.length} file(s) attached</div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-600">Choose this idea</span>
                    <ChevronRight className="h-4 w-4 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Idea B */}
            <button
              onClick={() => selectWinner("b")}
              className="text-left transition-all hover:scale-105 active:scale-95"
            >
              <Card
                className={`cursor-pointer transition-all border-2 hover:border-amber-400 ${
                  rankingStats.ideaBWins > rankingStats.ideaAWins
                    ? "border-amber-200 bg-amber-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <CardContent className="p-6">
                  <p className="text-lg font-medium text-gray-800 mb-3">{pair.ideaB.content}</p>
                  {pair.ideaB.notes && <p className="text-sm text-gray-600 italic mb-3">"{pair.ideaB.notes}"</p>}
                  {pair.ideaB.attachedFiles && pair.ideaB.attachedFiles.length > 0 && (
                    <div className="text-xs text-gray-500 mb-3">{pair.ideaB.attachedFiles.length} file(s) attached</div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <ChevronLeft className="h-4 w-4 text-amber-600" />
                    <span className="text-xs text-gray-600">Choose this idea</span>
                  </div>
                </CardContent>
              </Card>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm text-blue-800">
            This comparative judgment method helps surface your best ideas by comparing them directly. The more
            comparisons you make, the more accurate your ranking becomes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
