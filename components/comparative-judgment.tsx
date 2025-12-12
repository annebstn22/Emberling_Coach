"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, Award } from "lucide-react"

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

export default function ComparativeJudgment({
  ideas,
  onRankingComplete,
}: {
  ideas: IdeaEntry[]
  onRankingComplete: (rankedIdeas: IdeaEntry[]) => void
}) {
  const [comparisons, setComparisons] = useState<Array<[number, number]>>(() => {
    const pairs: Array<[number, number]> = []
    for (let i = 0; i < ideas.length; i++) {
      for (let j = i + 1; j < ideas.length; j++) {
        pairs.push([i, j])
      }
    }
    // Shuffle pairs for variety
    return pairs.sort(() => Math.random() - 0.5)
  })

  const [currentIdeas, setCurrentIdeas] = useState<IdeaEntry[]>(ideas.map((idea) => ({ ...idea, score: 0, wins: 0 })))
  const [currentComparisonIndex, setCurrentComparisonIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (currentComparisonIndex >= comparisons.length && !isComplete) {
      setIsComplete(true)
      const rankedIdeas = [...currentIdeas].sort((a, b) => (b.score || 0) - (a.score || 0))
      onRankingComplete(rankedIdeas)
    }
  }, [currentComparisonIndex, comparisons.length, currentIdeas, isComplete, onRankingComplete])

  if (ideas.length < 2) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <p className="text-gray-600">You need at least 2 ideas to start ranking.</p>
        </CardContent>
      </Card>
    )
  }

  if (isComplete || currentComparisonIndex >= comparisons.length) {
    return (
      <Card className="text-center py-8">
        <CardContent>
          <Award className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-800 mb-2">Ranking Complete!</p>
          <p className="text-gray-600">Your ideas have been ranked based on your comparisons.</p>
        </CardContent>
      </Card>
    )
  }

  const [indexA, indexB] = comparisons[currentComparisonIndex]
  const ideaA = currentIdeas[indexA]
  const ideaB = currentIdeas[indexB]

  const selectWinner = (winnerIndex: number) => {
    const updatedIdeas = [...currentIdeas]
    updatedIdeas[winnerIndex] = {
      ...updatedIdeas[winnerIndex],
      score: (updatedIdeas[winnerIndex].score || 0) + 1,
      wins: (updatedIdeas[winnerIndex].wins || 0) + 1,
    }

    setCurrentIdeas(updatedIdeas)
    setCurrentComparisonIndex(currentComparisonIndex + 1)
  }

  const progress = ((currentComparisonIndex + 1) / comparisons.length) * 100

  const renderFilePreview = (file: any) => {
    const isImage = file.type.startsWith("image/")
    const isVideo = file.type.startsWith("video/")
    const isAudio = file.type.startsWith("audio/")

    if (isImage) {
      return (
        <img
          src={file.url || "/placeholder.svg"}
          alt={file.name}
          className="w-full h-48 object-cover rounded-lg mb-3"
        />
      )
    }
    if (isVideo) {
      return (
        <video src={file.url} controls className="w-full h-48 rounded-lg mb-3">
          Your browser does not support video.
        </video>
      )
    }
    if (isAudio) {
      return (
        <div className="bg-gray-100 p-4 rounded-lg mb-3">
          <audio src={file.url} controls className="w-full">
            Your browser does not support audio.
          </audio>
        </div>
      )
    }
    return (
      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
        📎 {file.name}
      </a>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compare Ideas</span>
            <Badge variant="outline">
              {currentComparisonIndex + 1} / {comparisons.length}
            </Badge>
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            Which idea resonates more with you? Click to choose the stronger one.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Idea A */}
            <button onClick={() => selectWinner(indexA)} className="text-left transition-all hover:scale-105">
              <Card className="cursor-pointer transition-all border-2 hover:border-amber-400 border-gray-200 hover:bg-gray-50 h-full">
                <CardContent className="p-6">
                  {ideaA.attachedFiles && ideaA.attachedFiles.length > 0 && (
                    <div className="mb-3">{renderFilePreview(ideaA.attachedFiles[0])}</div>
                  )}

                  <p className="text-lg font-medium text-gray-800 mb-3">{ideaA.content}</p>
                  {ideaA.notes && <p className="text-sm text-gray-600 italic mb-3">"{ideaA.notes}"</p>}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <span className="text-xs text-gray-600">Choose this idea</span>
                    <ChevronRight className="h-4 w-4 text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            </button>

            {/* Idea B */}
            <button onClick={() => selectWinner(indexB)} className="text-left transition-all hover:scale-105">
              <Card className="cursor-pointer transition-all border-2 hover:border-amber-400 border-gray-200 hover:bg-gray-50 h-full">
                <CardContent className="p-6">
                  {ideaB.attachedFiles && ideaB.attachedFiles.length > 0 && (
                    <div className="mb-3">{renderFilePreview(ideaB.attachedFiles[0])}</div>
                  )}

                  <p className="text-lg font-medium text-gray-800 mb-3">{ideaB.content}</p>
                  {ideaB.notes && <p className="text-sm text-gray-600 italic mb-3">"{ideaB.notes}"</p>}

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
            <strong>Comparative judgment</strong> helps you identify your strongest ideas by making direct comparisons.
            Research shows this method produces more reliable rankings than rating each idea individually.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
