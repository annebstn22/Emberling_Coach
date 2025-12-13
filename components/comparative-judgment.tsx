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
  thurstoneScore?: number
}

// Standard normal CDF approximation using error function
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - probability : probability
}

// Inverse normal CDF (quantile function) using Beasley-Springer-Moro algorithm
function inverseNormalCDF(p: number): number {
  if (p <= 0 || p >= 1) {
    throw new Error("p must be between 0 and 1")
  }

  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1,
    2.506628277459239,
  ]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968,
    2.938163982698783,
  ]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]

  const pLow = 0.02425
  const pHigh = 1 - pLow

  let q: number, r: number, result: number

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    result =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  } else if (p <= pHigh) {
    q = p - 0.5
    r = q * q
    result =
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p))
    result =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }

  return result
}

// Compute Thurstone Case V scores from pairwise win matrix
function computeThurstoneScores(winMatrix: number[][], n: number): number[] {
  const scores: number[] = new Array(n).fill(0)

  for (let i = 0; i < n; i++) {
    let sumZ = 0
    let count = 0

    for (let j = 0; j < n; j++) {
      if (i === j) continue

      const winsI = winMatrix[i][j]
      const winsJ = winMatrix[j][i]
      const totalComparisons = winsI + winsJ

      if (totalComparisons === 0) continue

      // Empirical probability that i beats j
      let p_ij = winsI / totalComparisons

      // Clamp to [0.01, 0.99] to avoid infinite z-scores
      p_ij = Math.max(0.01, Math.min(0.99, p_ij))

      // Convert to z-score using inverse normal CDF
      const z_ij = inverseNormalCDF(p_ij)
      sumZ += z_ij
      count++
    }

    // μ_i is the mean of all z_ij values
    scores[i] = count > 0 ? sumZ / count : 0
  }

  // Normalize to mean 0
  const mean = scores.reduce((sum, s) => sum + s, 0) / n
  const normalizedScores = scores.map((s) => s - mean)

  return normalizedScores
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

  const [winMatrix, setWinMatrix] = useState<number[][]>(() => {
    const n = ideas.length
    return Array(n)
      .fill(0)
      .map(() => Array(n).fill(0))
  })

  const [currentIdeas, setCurrentIdeas] = useState<IdeaEntry[]>(ideas.map((idea) => ({ ...idea, score: 0, wins: 0 })))
  const [currentComparisonIndex, setCurrentComparisonIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  const recomputeScores = () => {
    console.log("[v0] Computing Thurstone scores from win matrix:", winMatrix)

    const thurstoneScores = computeThurstoneScores(winMatrix, ideas.length)

    console.log("[v0] Computed Thurstone scores:", thurstoneScores)

    const updatedIdeas = currentIdeas.map((idea, idx) => ({
      ...idea,
      thurstoneScore: thurstoneScores[idx],
      wins: winMatrix[idx].reduce((sum, val) => sum + val, 0), // Total wins for this idea
    }))

    console.log(
      "[v0] Updated ideas with scores:",
      updatedIdeas.map((i) => ({
        content: i.content,
        wins: i.wins,
        thurstoneScore: i.thurstoneScore,
      })),
    )

    setCurrentIdeas(updatedIdeas)
    return updatedIdeas
  }

  useEffect(() => {
    if (currentComparisonIndex >= comparisons.length && !isComplete) {
      console.log("[v0] All comparisons complete, computing final rankings")
      setIsComplete(true)
      const scoredIdeas = recomputeScores()
      const rankedIdeas = [...scoredIdeas].sort((a, b) => (b.thurstoneScore || 0) - (a.thurstoneScore || 0))

      console.log(
        "[v0] Final rankings:",
        rankedIdeas.map((idea, idx) => ({
          rank: idx + 1,
          content: idea.content,
          wins: idea.wins,
          thurstoneScore: idea.thurstoneScore,
        })),
      )

      onRankingComplete(rankedIdeas)
    }
  }, [currentComparisonIndex, comparisons.length, isComplete])

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
    const [indexA, indexB] = comparisons[currentComparisonIndex]

    const newWinMatrix = winMatrix.map((row) => [...row])
    const loserIndex = winnerIndex === indexA ? indexB : indexA
    newWinMatrix[winnerIndex][loserIndex]++
    setWinMatrix(newWinMatrix)

    console.log("[v0] Comparison result:", {
      winner: winnerIndex,
      loser: loserIndex,
      winMatrix: newWinMatrix,
      comparisonIndex: currentComparisonIndex,
      totalComparisons: comparisons.length,
    })

    const updatedIdeas = [...currentIdeas]
    updatedIdeas[winnerIndex] = {
      ...updatedIdeas[winnerIndex],
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
            <strong>Thurstone's Comparative Judgment</strong> uses pairwise comparisons to compute interval-scaled
            scores for each idea. This statistical method (Case V) produces more reliable and meaningful rankings than
            simple vote counting.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
