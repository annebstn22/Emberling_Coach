import { describe, it, expect } from "vitest"
import {
  computeEmbeddings,
  computeDiscourseMatrix,
  computeLLMDirectionalScores,
  cosineSimilarity,
  type TransitionMatrix,
} from "./route"

type GoldExample = {
  name: string
  points: string[]
  correctOrder: number[]
}

function jaccardPlusLengthScore(a: string, b: string): number {
  const text1 = a.toLowerCase()
  const text2 = b.toLowerCase()

  const words1 = new Set(text1.split(/\s+/).filter(Boolean))
  const words2 = new Set(text2.split(/\s+/).filter(Boolean))
  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  const union = new Set([...words1, ...words2])
  const lexicalScore = union.size > 0 ? intersection.size / union.size : 0

  const len1 = text1.length
  const len2 = text2.length
  const lengthScore = 1 - Math.abs(len1 - len2) / Math.max(len1, len2, 1)

  return 0.5 * lexicalScore + 0.5 * lengthScore
}

function buildMatrixFromScore(points: string[], scoreFn: (a: string, b: string) => number): TransitionMatrix {
  const n = points.length
  const m: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      m[i][j] = scoreFn(points[i], points[j])
    }
  }
  return m
}

function averageTransitionScore(path: number[], matrix: TransitionMatrix): number {
  if (path.length <= 1) return 1
  let sum = 0
  for (let i = 0; i < path.length - 1; i++) sum += matrix[path[i]]?.[path[i + 1]] ?? 0
  return sum / (path.length - 1)
}

function greedyOrder(points: string[], matrix: TransitionMatrix): number[] {
  const n = points.length
  if (n <= 1) return [...Array(n).keys()]

  // Start with shortest point (mirrors production heuristic)
  let start = 0
  for (let i = 1; i < n; i++) if (points[i].length < points[start].length) start = i

  const path = [start]
  const remaining = new Set<number>()
  for (let i = 0; i < n; i++) if (i !== start) remaining.add(i)

  while (remaining.size > 0) {
    const current = path[path.length - 1]
    let bestNext: number | null = null
    let bestScore = -Infinity
    for (const j of remaining) {
      const s = matrix[current]?.[j] ?? 0
      if (s > bestScore) {
        bestScore = s
        bestNext = j
      }
    }
    if (bestNext == null) break
    path.push(bestNext)
    remaining.delete(bestNext)
  }
  // If anything left (shouldn't), append
  for (const j of remaining) path.push(j)
  return path
}

function simulatedAnnealingOrder(
  matrix: TransitionMatrix,
  maxIterations = 800,
): number[] {
  const n = matrix.length
  if (n <= 1) return [...Array(n).keys()]

  // Random path
  let current = [...Array(n).keys()]
  for (let i = current.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[current[i], current[j]] = [current[j], current[i]]
  }

  let currentScore = averageTransitionScore(current, matrix)
  let best = [...current]
  let bestScore = currentScore

  let temperature = 1.0
  const coolingRate = 0.995

  for (let iter = 0; iter < maxIterations; iter++) {
    const next = [...current]
    const i = Math.floor(Math.random() * n)
    const j = Math.floor(Math.random() * n)
    ;[next[i], next[j]] = [next[j], next[i]]
    const nextScore = averageTransitionScore(next, matrix)
    const delta = nextScore - currentScore
    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      current = next
      currentScore = nextScore
      if (currentScore > bestScore) {
        best = [...current]
        bestScore = currentScore
      }
    }
    temperature *= coolingRate
  }
  return best
}

function geneticAlgorithmOrder(
  matrix: TransitionMatrix,
  populationSize = 24,
  generations = 35,
): number[] {
  const n = matrix.length
  if (n <= 1) return [...Array(n).keys()]

  const randomPerm = () => {
    const arr = [...Array(n).keys()]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  let population = Array.from({ length: populationSize }, randomPerm)
  const fitness = (p: number[]) => averageTransitionScore(p, matrix)

  for (let gen = 0; gen < generations; gen++) {
    const scored = population
      .map((p) => ({ p, f: fitness(p) }))
      .sort((a, b) => b.f - a.f)

    const elites = scored.slice(0, Math.max(2, Math.floor(populationSize * 0.2))).map((x) => x.p)
    const nextPop: number[][] = [...elites.map((e) => [...e])]

    const pick = () => scored[Math.floor(Math.random() * Math.min(scored.length, 10))].p

    while (nextPop.length < populationSize) {
      const a = pick()
      const b = pick()
      const start = Math.floor(Math.random() * n)
      const end = Math.floor(Math.random() * (n - start)) + start
      const child = new Array(n).fill(-1)
      for (let k = start; k <= end; k++) child[k] = a[k]
      let pos = (end + 1) % n
      for (const gene of b) {
        if (!child.includes(gene)) {
          child[pos] = gene
          pos = (pos + 1) % n
        }
      }
      // mutation
      if (Math.random() < 0.1) {
        const i = Math.floor(Math.random() * n)
        const j = Math.floor(Math.random() * n)
        ;[child[i], child[j]] = [child[j], child[i]]
      }
      nextPop.push(child as number[])
    }
    population = nextPop
  }

  const scored = population.map((p) => ({ p, f: fitness(p) }))
  scored.sort((a, b) => b.f - a.f)
  return scored[0].p
}

function bestOfThree(points: string[], matrix: TransitionMatrix): number[] {
  const g = greedyOrder(points, matrix)
  const a = simulatedAnnealingOrder(matrix)
  const ga = geneticAlgorithmOrder(matrix)
  const candidates = [g, a, ga]
  candidates.sort((p1, p2) => averageTransitionScore(p2, matrix) - averageTransitionScore(p1, matrix))
  return candidates[0]
}

function kendallsTau(orderA: number[], orderB: number[]): number {
  // order arrays contain same items (0..n-1)
  const n = orderA.length
  const posA = new Array<number>(n)
  const posB = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    posA[orderA[i]] = i
    posB[orderB[i]] = i
  }

  let concordant = 0
  let discordant = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const aBefore = posA[i] < posA[j]
      const bBefore = posB[i] < posB[j]
      if (aBefore === bBefore) concordant++
      else discordant++
    }
  }
  const totalPairs = (n * (n - 1)) / 2
  if (totalPairs === 0) return 1
  return (concordant - discordant) / totalPairs
}

function pairwiseAccuracy(tau: number): number {
  // tau ∈ [-1, 1] -> accuracy ∈ [0, 1]
  return (tau + 1) / 2
}

function combineMatrices(
  cosine01: TransitionMatrix,
  directional01: TransitionMatrix,
  alpha: number,
  beta: number,
): TransitionMatrix {
  const n = cosine01.length
  const out: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const cos = cosine01[i]?.[j] ?? 0
      const dir = directional01[i]?.[j] ?? 0
      out[i][j] = alpha * cos + beta * dir
    }
  }
  return out
}

const gold: GoldExample[] = [
  {
    name: "ChronologicalEssayArc",
    points: [
      "I was hesitant to apply at first.",
      "I talked to a mentor and got clarity.",
      "I prepared my materials and portfolio.",
      "I submitted the application and waited.",
      "I learned from the outcome and adjusted my plan.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  {
    name: "CauseEffectChain",
    points: [
      "I stopped sleeping well for weeks.",
      "My focus dropped and I procrastinated more.",
      "My work piled up and I felt overwhelmed.",
      "I finally asked for help and changed my routine.",
      "My energy improved and I caught up.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  {
    name: "ArgumentWithSupport",
    points: [
      "I believe constraints can make writing better.",
      "A tight word limit forces you to choose the strongest ideas.",
      "When I removed extra sentences, the main point became clearer.",
      "This is why I draft long and then cut aggressively.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  {
    name: "NarrativeTurn",
    points: [
      "I thought I was failing because it felt hard.",
      "Then I realized difficulty was part of learning.",
      "That reframed my self-talk and reduced the shame.",
      "I kept practicing and improved steadily.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  {
    name: "SimpleProjectPlan",
    points: [
      "Define the goal and audience clearly.",
      "Outline the main sections in rough bullets.",
      "Draft quickly without editing.",
      "Revise for clarity and flow.",
      "Polish grammar and style last.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  {
    name: "MixedButDefensible",
    points: [
      "I joined a new team and felt out of place.",
      "I watched how decisions were made and took notes.",
      "I asked small questions to test my understanding.",
      "I proposed one change with a clear rationale.",
      "I earned trust and started contributing more openly.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
]

// ─── Signal specification ──────────────────────────────────────────────────────
// Each row in the matrix is a list of { spec, weight } pairs.
// The final scoring matrix is a weighted sum of each signal's matrix.
// This allows pure rows (1 signal) and blends (2-3 signals) with no code changes.

type ScoringSpec =
  | { kind: "jaccard" }                                           // lexical + length, no API
  | { kind: "discourse" }                                         // rule-based discourse markers, no API
  | { kind: "openai-embed"; model: "text-embedding-3-small" }    // cosine similarity
  | { kind: "hf-embed"; model: string }                          // cosine similarity
  | { kind: "llm-directional" }                                   // GPT-4o-mini pairwise "does B follow A?"

type MatrixRow = {
  id: number
  name: string
  signals: Array<{ spec: ScoringSpec; weight: number }>
}

// ─── Matrix rows ───────────────────────────────────────────────────────────────
// Rows 1–2  : pure baselines (no API)
// Rows 3–5  : pure ML baselines (embeddings)
// Row  6    : LLM directional alone — tests GPT-4o-mini as ordering judge
// Rows 7–9  : Jaccard + cosine hybrids — does cosine add to the baseline?
// Rows 10–11: Jaccard + discourse — does rule-based direction add to baseline?
// Rows 12–13: Jaccard + LLM directional — the main hypothesis
// Row  14   : triple blend Jaccard + cosine + LLM (the production candidate)
const matrix: MatrixRow[] = [
  // ── Pure baselines ──
  { id: 1,  name: "Jaccard+length",
    signals: [{ spec: { kind: "jaccard" }, weight: 1 }] },
  { id: 2,  name: "Discourse markers",
    signals: [{ spec: { kind: "discourse" }, weight: 1 }] },
  // ── Pure ML ──
  { id: 3,  name: "OpenAI text-embedding-3-small",
    signals: [{ spec: { kind: "openai-embed", model: "text-embedding-3-small" }, weight: 1 }] },
  { id: 4,  name: "HF all-mpnet-base-v2",
    signals: [{ spec: { kind: "hf-embed", model: "sentence-transformers/all-mpnet-base-v2" }, weight: 1 }] },
  { id: 5,  name: "HF BGE small",
    signals: [{ spec: { kind: "hf-embed", model: "BAAI/bge-small-en-v1.5" }, weight: 1 }] },
  // ── LLM directional alone ──
  { id: 6,  name: "LLM directional (GPT-4o-mini)",
    signals: [{ spec: { kind: "llm-directional" }, weight: 1 }] },
  // ── Jaccard + cosine hybrids ──
  { id: 7,  name: "Jaccard(0.5) + mpnet(0.5)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.5 }, { spec: { kind: "hf-embed", model: "sentence-transformers/all-mpnet-base-v2" }, weight: 0.5 }] },
  { id: 8,  name: "Jaccard(0.7) + mpnet(0.3)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.7 }, { spec: { kind: "hf-embed", model: "sentence-transformers/all-mpnet-base-v2" }, weight: 0.3 }] },
  { id: 9,  name: "Jaccard(0.3) + mpnet(0.7)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.3 }, { spec: { kind: "hf-embed", model: "sentence-transformers/all-mpnet-base-v2" }, weight: 0.7 }] },
  // ── Jaccard + discourse hybrids ──
  { id: 10, name: "Jaccard(0.7) + discourse(0.3)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.7 }, { spec: { kind: "discourse" }, weight: 0.3 }] },
  { id: 11, name: "Jaccard(0.5) + discourse(0.5)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.5 }, { spec: { kind: "discourse" }, weight: 0.5 }] },
  // ── Jaccard + LLM directional ──
  { id: 12, name: "Jaccard(0.5) + LLM(0.5)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.5 }, { spec: { kind: "llm-directional" }, weight: 0.5 }] },
  { id: 13, name: "Jaccard(0.35) + LLM(0.65)",
    signals: [{ spec: { kind: "jaccard" }, weight: 0.35 }, { spec: { kind: "llm-directional" }, weight: 0.65 }] },
  // ── Triple blend (production candidate) ──
  { id: 14, name: "Jaccard(0.35) + mpnet(0.3) + LLM(0.35)",
    signals: [
      { spec: { kind: "jaccard" }, weight: 0.35 },
      { spec: { kind: "hf-embed", model: "sentence-transformers/all-mpnet-base-v2" }, weight: 0.30 },
      { spec: { kind: "llm-directional" }, weight: 0.35 },
    ] },
]

// ─── Build a single signal's scoring matrix ────────────────────────────────────
async function buildSignalMatrix(points: string[], spec: ScoringSpec): Promise<TransitionMatrix> {
  if (spec.kind === "jaccard") {
    return buildMatrixFromScore(points, jaccardPlusLengthScore)
  }

  if (spec.kind === "discourse") {
    return computeDiscourseMatrix(points)
  }

  if (spec.kind === "llm-directional") {
    return computeLLMDirectionalScores(points)
  }

  // Cosine embedding signals
  const embeddings =
    spec.kind === "openai-embed"
      ? await computeEmbeddings(points, { kind: "openai", model: spec.model })
      : await computeEmbeddings(points, { kind: "huggingface", model: spec.model })

  const n = points.length
  const m: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      m[i][j] = (cosineSimilarity(embeddings[i], embeddings[j]) + 1) / 2
    }
  }
  return m
}

// ─── Determine which env vars each row needs ───────────────────────────────────
function requiredEnvFor(row: MatrixRow): string[] {
  const vars = new Set<string>()
  for (const { spec } of row.signals) {
    if (spec.kind === "openai-embed" || spec.kind === "llm-directional") vars.add("OPENAI_API_KEY")
    if (spec.kind === "hf-embed") vars.add("HUGGINGFACE_API_KEY")
  }
  return [...vars]
}

// ─── Weighted blend of multiple signal matrices ────────────────────────────────
function blendMatrices(mats: TransitionMatrix[], weights: number[]): TransitionMatrix {
  const n = mats[0]?.length ?? 0
  const total = weights.reduce((a, b) => a + b, 0)
  const out: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let s = 0; s < mats.length; s++) {
    const w = (weights[s] ?? 0) / total
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        out[i][j] += w * (mats[s][i]?.[j] ?? 0)
      }
    }
  }
  return out
}

describe("Threader ordering matrix evaluation", () => {
  it("runs the full matrix (skips rows missing API keys)", async () => {
    const results: Array<{
      id: number
      name: string
      ran: boolean
      meanTau?: number
      meanAcc?: number
      skippedBecause?: string[]
    }> = []

    for (const row of matrix) {
      const required = requiredEnvFor(row)
      const missing = required.filter((v) => !process.env[v])
      if (missing.length > 0) {
        results.push({ id: row.id, name: row.name, ran: false, skippedBecause: missing })
        continue
      }

      try {
        const taus: number[] = []

        for (const ex of gold) {
          // Build each signal's matrix (in parallel within a row)
          const signalMats = await Promise.all(
            row.signals.map(({ spec }) => buildSignalMatrix(ex.points, spec)),
          )
          const weights = row.signals.map(({ weight }) => weight)
          const scoringMatrix = blendMatrices(signalMats, weights)

          const predicted = bestOfThree(ex.points, scoringMatrix)
          taus.push(kendallsTau(ex.correctOrder, predicted))
        }

        const meanTau = taus.reduce((a, b) => a + b, 0) / taus.length
        results.push({ id: row.id, name: row.name, ran: true, meanTau, meanAcc: pairwiseAccuracy(meanTau) })
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        results.push({ id: row.id, name: row.name, ran: false, skippedBecause: [reason] })
      }
    }

    // Baseline must always run
    expect(results.find((r) => r.id === 1)?.ran).toBe(true)

    // Bounds check on any row that ran
    for (const r of results) {
      if (!r.ran) continue
      expect(r.meanTau).toBeGreaterThanOrEqual(-1)
      expect(r.meanTau).toBeLessThanOrEqual(1)
      expect(r.meanAcc).toBeGreaterThanOrEqual(0)
      expect(r.meanAcc).toBeLessThanOrEqual(1)
    }

    console.log("\n=== Threader Matrix Results ===")
    for (const r of results) {
      if (!r.ran) {
        const isMissingKey = r.skippedBecause?.some((s) => s.includes("_API_KEY"))
        console.log(`#${String(r.id).padStart(2)} ${isMissingKey ? "SKIP (no key)  " : "SKIP (API err) "} ${r.name} — ${r.skippedBecause?.join(" | ")}`)
      } else {
        console.log(`#${String(r.id).padStart(2)} OK             ${r.name} | tau=${r.meanTau?.toFixed(3)} | acc=${r.meanAcc?.toFixed(3)}`)
      }
    }
    console.log("==============================\n")
  }, 180_000)
})

