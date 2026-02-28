"use client"

import { useState, useEffect } from "react"

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

      let p_ij = winsI / totalComparisons
      p_ij = Math.max(0.01, Math.min(0.99, p_ij))

      const z_ij = inverseNormalCDF(p_ij)
      sumZ += z_ij
      count++
    }

    scores[i] = count > 0 ? sumZ / count : 0
  }

  const mean = scores.reduce((sum, s) => sum + s, 0) / n
  return scores.map((s) => s - mean)
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
    const thurstoneScores = computeThurstoneScores(winMatrix, ideas.length)
    const updatedIdeas = currentIdeas.map((idea, idx) => ({
      ...idea,
      thurstoneScore: thurstoneScores[idx],
      wins: winMatrix[idx].reduce((sum, val) => sum + val, 0),
    }))
    setCurrentIdeas(updatedIdeas)
    return updatedIdeas
  }

  useEffect(() => {
    if (currentComparisonIndex >= comparisons.length && !isComplete) {
      setIsComplete(true)
      const scoredIdeas = recomputeScores()
      const rankedIdeas = [...scoredIdeas].sort((a, b) => (b.thurstoneScore || 0) - (a.thurstoneScore || 0))
      onRankingComplete(rankedIdeas)
    }
  }, [currentComparisonIndex, comparisons.length, isComplete])

  if (ideas.length < 2) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "3rem 1.5rem",
          minHeight: "calc(100vh - 57px)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "1rem",
            color: "var(--muted)",
          }}
        >
          You need at least 2 ideas to start ranking.
        </p>
      </div>
    )
  }

  if (isComplete || currentComparisonIndex >= comparisons.length) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "3rem 1.5rem",
          minHeight: "calc(100vh - 57px)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "1.8rem",
            color: "var(--ink)",
            marginBottom: ".3rem",
            textAlign: "center",
          }}
        >
          Ranking complete.
        </p>
        <p
          style={{
            fontSize: ".68rem",
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: ".12em",
            textAlign: "center",
          }}
        >
          loading your results…
        </p>
      </div>
    )
  }

  const [indexA, indexB] = comparisons[currentComparisonIndex]
  const ideaA = currentIdeas[indexA]
  const ideaB = currentIdeas[indexB]
  const remaining = comparisons.length - currentComparisonIndex
  const total = comparisons.length

  const selectWinner = (winnerIndex: number) => {
    const [idxA, idxB] = comparisons[currentComparisonIndex]
    const newWinMatrix = winMatrix.map((row) => [...row])
    const loserIndex = winnerIndex === idxA ? idxB : idxA
    newWinMatrix[winnerIndex][loserIndex]++
    setWinMatrix(newWinMatrix)

    const updatedIdeas = [...currentIdeas]
    updatedIdeas[winnerIndex] = {
      ...updatedIdeas[winnerIndex],
      wins: (updatedIdeas[winnerIndex].wins || 0) + 1,
    }
    setCurrentIdeas(updatedIdeas)
    setCurrentComparisonIndex(currentComparisonIndex + 1)
  }

  const skipPair = () => {
    setCurrentComparisonIndex(currentComparisonIndex + 1)
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "3rem 1.5rem",
        minHeight: "calc(100vh - 57px)",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontSize: "1.8rem",
          color: "var(--ink)",
          marginBottom: ".3rem",
          textAlign: "center",
        }}
      >
        Which is stronger?
      </div>

      {/* Sub */}
      <div
        style={{
          fontSize: ".68rem",
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: ".12em",
          marginBottom: "2rem",
          textAlign: "center",
        }}
      >
        pick the idea that matters more — {remaining} left
      </div>

      {/* Progress dots */}
      <div
        style={{
          display: "flex",
          gap: ".35rem",
          marginBottom: "2.5rem",
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: "500px",
        }}
      >
        {comparisons.map((_, i) => {
          const isDone = i < currentComparisonIndex
          const isActive = i === currentComparisonIndex
          return (
            <div
              key={i}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                flexShrink: 0,
                transition: "all .3s",
                background: isDone || isActive ? "var(--gold)" : "var(--border)",
                transform: isActive ? "scale(1.5)" : "scale(1)",
              }}
            />
          )
        })}
      </div>

      {/* Arena */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "1rem",
          alignItems: "center",
          width: "100%",
          maxWidth: "640px",
        }}
      >
        {/* Card A */}
        <button
          onClick={() => selectWinner(indexA)}
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            borderRadius: "14px",
            padding: "2rem 1.5rem",
            textAlign: "center",
            cursor: "pointer",
            transition: "all .2s cubic-bezier(.22,1,.36,1)",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = "var(--gold-bdr)"
            el.style.background = "var(--gold-bg)"
            el.style.transform = "scale(1.03)"
            el.style.boxShadow = "0 8px 24px rgba(0,0,0,.08)"
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = "var(--border)"
            el.style.background = "var(--surface)"
            el.style.transform = "scale(1)"
            el.style.boxShadow = "none"
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              color: "var(--ink)",
              lineHeight: "1.4",
            }}
          >
            {ideaA.content}
          </div>
        </button>

        {/* vs */}
        <div
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: "1.3rem",
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          vs
        </div>

        {/* Card B */}
        <button
          onClick={() => selectWinner(indexB)}
          style={{
            background: "var(--surface)",
            border: "2px solid var(--border)",
            borderRadius: "14px",
            padding: "2rem 1.5rem",
            textAlign: "center",
            cursor: "pointer",
            transition: "all .2s cubic-bezier(.22,1,.36,1)",
            fontFamily: "inherit",
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.borderColor = "var(--gold-bdr)"
            el.style.background = "var(--gold-bg)"
            el.style.transform = "scale(1.03)"
            el.style.boxShadow = "0 8px 24px rgba(0,0,0,.08)"
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.borderColor = "var(--border)"
            el.style.background = "var(--surface)"
            el.style.transform = "scale(1)"
            el.style.boxShadow = "none"
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              color: "var(--ink)",
              lineHeight: "1.4",
            }}
          >
            {ideaB.content}
          </div>
        </button>
      </div>

      {/* Skip */}
      <button
        onClick={skipPair}
        style={{
          background: "none",
          border: "none",
          fontFamily: "var(--font-mono)",
          fontSize: ".68rem",
          color: "var(--muted)",
          cursor: "pointer",
          textDecoration: "underline",
          marginTop: "1.5rem",
        }}
      >
        skip this pair →
      </button>
    </div>
  )
}
