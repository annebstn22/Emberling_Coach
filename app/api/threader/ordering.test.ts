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

// Core set: always runs in CI (`pnpm test`). Extended set runs when THREADER_FULL_GOLD=1.
// Reference orders use a documented spine (time, causality, thesis flow, explicit markers).

const goldCore: GoldExample[] = [
  {
    name: "ChronologicalApplication",
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
    name: "CauseEffectBurnout",
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
    name: "ThesisEvidenceConclusion",
    points: [
      "I argue that tiny daily practice beats waiting for big blocks of time.",
      "I ran one month of fifteen-minute sessions on a single skill and tracked streaks.",
      "I missed several days; restarting without shame mattered more than a perfect streak.",
      "So I stopped postponing until I felt ready and committed to small consistent reps instead.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  {
    name: "NarrativeTurnExplicit",
    points: [
      "For months I read struggle as proof I was falling behind.",
      "A mentor said friction is normal when a skill is actually growing.",
      "I started logging small wins instead of only measuring the gap to the ideal.",
      "Once the story changed, I practiced more steadily and stopped quitting after bad days.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  {
    name: "WritingProcessPipeline",
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
    name: "OnboardingTimeline",
    points: [
      "Week one on a new team I mostly listened and felt invisible in meetings.",
      "By week three I had a map of who owned which decisions and why.",
      "I shipped a small documentation fix with a clear rationale and public review.",
      "After that, people looped me in earlier and I contributed to planning.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
]

const goldExtended: GoldExample[] = [
  {
    name: "DivergentYearsChronology",
    points: [
      "Freshman year I trained for a judged sport where mistakes are visible the instant you enter the water.",
      "Sophomore year I studied a new language and avoided speaking until a trip forced me into conversations.",
      "Junior year I debugged hardware with a mentor watching my screen when things broke.",
      "Senior year I sold something I made to strangers at a fair and had to explain it in thirty seconds.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  {
    name: "MessyLearningMarkedSequence",
    points: [
      "First I fixed a bike alone, rewinding tutorials and ordering the wrong part once.",
      "Next I learned one dish by ruining it until the ratios finally made sense.",
      "Then I practiced an instrument badly in front of roommates for months.",
      "Looking back, the shared pattern is messy starts in public, then revision, not one clean take.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  {
    name: "VolunteerCrossDomainArc",
    points: [
      "I started volunteering in a chaotic back room sorting unpredictable donations.",
      "I built a simple spreadsheet so the next shift could see what was already done.",
      "I walked a new volunteer through the same workflow until they could run it alone.",
      "The lesson I draw is I keep turning fuzzy piles into something the next person can repeat.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  // Spine: literature review → question → method → collect → analyze → write; standard paper flow.
  {
    name: "ResearchPaperFlow",
    points: [
      "I mapped what prior work already claimed about our narrow problem.",
      "That gap became a single research question we could answer with new data.",
      "We locked a protocol and preregistered the main comparisons.",
      "We ran sessions, logged anomalies, and froze the dataset before touching figures.",
      "The analysis supported one hypothesis and ruled out a simpler alternative.",
      "The draft led with the claim, then evidence, then limits and next steps.",
    ],
    correctOrder: [0, 1, 2, 3, 4, 5],
  },
  // Spine: problem → prototype → user test → scope cut → ship → retro.
  {
    name: "ProductLaunchSequence",
    points: [
      "We picked one user pain that showed up in every interview transcript.",
      "We built a clickable prototype that did only that job, badly but end to end.",
      "Five people tried it; three got stuck on the same step.",
      "We cut two features and fixed the onboarding copy before writing new code.",
      "We released to a small list and watched support tickets for a week.",
      "The retro documented what we would measure before the next release.",
    ],
    correctOrder: [0, 1, 2, 3, 4, 5],
  },
  // Spine: fear → exposure across unrelated domains → same emotional lesson (no calendar labels).
  {
    name: "LatentPerformanceFearArc",
    points: [
      "I avoided stages and panels even when I cared about the topic.",
      "I took a role where demos were weekly and silence after a bug felt like judgment.",
      "I joined a choir where wrong notes were obvious to everyone beside me.",
      "I pitched a class project in a packed room with no notes allowed.",
      "I stopped treating visibility as proof I did not belong.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  // Spine: parallel "At the time I..." + rising stakes; last line is explicit synthesis.
  {
    name: "ParallelSyntaxCareerPivots",
    points: [
      "At the time I treated the lab job as a paycheck, not a direction.",
      "At the time I assumed teaching would be temporary until something better appeared.",
      "At the time I thought the policy internship was unrelated to anything technical.",
      "At the time I coded side projects alone and hid them from mentors.",
      "In hindsight those threads were one habit of translating ideas for other people.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  // Spine: A and B read plausible swapped; order fixed by "Earlier that day" vs "That evening" (time cue).
  {
    name: "LocalSwapTimeCue",
    points: [
      "Earlier that day I had promised a draft I did not believe in.",
      "I rewrote the opening three times and still hated the tone.",
      "That evening I sent a shorter version that admitted one real uncertainty.",
      "The reply thanked me for the honesty and asked for a follow-up meeting.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  // Spine: general principle → typical use → exception → operational rule.
  {
    name: "NestedRuleExceptionTakeaway",
    points: [
      "My default is to assume good faith in written feedback.",
      "Usually I respond with a question before I edit a single line.",
      "Unless safety or consent is at stake, then I pause the thread and escalate privately.",
      "So my checklist is clarify first, except when harm is possible, then escalate first.",
    ],
    correctOrder: [0, 1, 2, 3],
  },
  // Spine: trip logistics in calendar order (before flight → flight → arrival → conflict → resolution).
  {
    name: "TripAbroadChronology",
    points: [
      "Before the flight I memorized how to ask for directions without sounding rude.",
      "On the layover I realized my phrasebook order did not match how people actually spoke.",
      "After landing I botched a simple purchase and laughed instead of freezing.",
      "Midweek a host family conflict forced me to mediate with broken grammar.",
      "By the return flight I could handle a wrong train without panic.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  // Spine: identical opener pattern; content forces workshop → draft → critique → revise → reading order.
  {
    name: "ParallelGoalWasToWriting",
    points: [
      "The goal was to finish a messy first draft before the workshop.",
      "The goal was to read everyone else's piece without defending mine aloud.",
      "The goal was to record feedback verbatim before judging what counted.",
      "The goal was to rewrite one scene using only one critique theme.",
      "The goal was to read the revision aloud and mark every breath that felt false.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
  // Spine: hypothesis → setup → run → anomaly → control → conclusion (lab notebook order).
  {
    name: "LabNotebookSequence",
    points: [
      "We stated the smallest claim the apparatus could actually falsify.",
      "We calibrated sensors and logged ambient noise for a full afternoon.",
      "We ran trials A and B under matched conditions and saved raw traces.",
      "Trial B showed a spike we could not explain with the usual noise model.",
      "We added a shielded rerun and confirmed the spike was environmental.",
      "We reported the main effect with the caveat and linked the raw data.",
    ],
    correctOrder: [0, 1, 2, 3, 4, 5],
  },
  // Spine: contract negotiation beats (term sheet → counsel → revise → sign → integrate).
  {
    name: "ContractNegotiationBeats",
    points: [
      "We agreed on headline numbers and a target close date in principle.",
      "Our counsel flagged three clauses that conflicted with an older license.",
      "We traded redlines for a week until only liability caps remained contested.",
      "We signed with a side letter that documented the cap compromise.",
      "We filed the countersigned PDF and updated the internal wiki the same day.",
    ],
    correctOrder: [0, 1, 2, 3, 4],
  },
]

function activeGoldExamples(): GoldExample[] {
  if (process.env.THREADER_FULL_GOLD === "1") return [...goldCore, ...goldExtended]
  return goldCore
}

// ─── Signal specification ──────────────────────────────────────────────────────
// Each row in the matrix is a list of { spec, weight } pairs.
// The final scoring matrix is a weighted sum of each signal's matrix.
// This allows pure rows (1 signal) and blends (2-3 signals) with no code changes.

type ScoringSpec =
  | { kind: "jaccard" }
  | { kind: "discourse" }
  | { kind: "hf-embed"; model: string }
  | { kind: "llm-directional" }

type MatrixRow =
  | {
      id: number
      name: string
      signals: Array<{ spec: ScoringSpec; weight: number }>
    }
  | { id: number; name: string; fusion: "gated-disc-bge-llm" }

// Matrix: HF embedding rows only (NLI eval removed — HF returns unstable shapes for our router).
// Gated disc+BGE+LLM runs first among LLM rows (rate limits). Then discourse+LLM, pure LLM, linear triple.
const matrix: MatrixRow[] = [
  { id: 1, name: "Jaccard+length (lexical control)", signals: [{ spec: { kind: "jaccard" }, weight: 1 }] },
  { id: 2, name: "Discourse markers (rules)", signals: [{ spec: { kind: "discourse" }, weight: 1 }] },
  { id: 3, name: "HF mpnet (semantics, symmetric)", signals: [{ spec: { kind: "hf-embed", model: "sentence-transformers/all-mpnet-base-v2" }, weight: 1 }] },
  { id: 4, name: "HF BGE small (semantics, symmetric)", signals: [{ spec: { kind: "hf-embed", model: "BAAI/bge-small-en-v1.5" }, weight: 1 }] },
  {
    id: 5,
    name: "gated disc+BGE+LLM (low margin or disc/LLM disagree → LLM-heavy blend)",
    fusion: "gated-disc-bge-llm",
  },
  {
    id: 6,
    name: "discourse(0.5)+LLM(0.5)",
    signals: [
      { spec: { kind: "discourse" }, weight: 0.5 },
      { spec: { kind: "llm-directional" }, weight: 0.5 },
    ],
  },
  { id: 7, name: "LLM directional (Gateway)", signals: [{ spec: { kind: "llm-directional" }, weight: 1 }] },
  {
    id: 8,
    name: "linear disc(0.15)+BGE-small(0.35)+LLM(0.50)",
    signals: [
      { spec: { kind: "discourse" }, weight: 0.15 },
      { spec: { kind: "hf-embed", model: "BAAI/bge-small-en-v1.5" }, weight: 0.35 },
      { spec: { kind: "llm-directional" }, weight: 0.5 },
    ],
  },
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

  const embeddings = await computeEmbeddings(points, { kind: "huggingface", model: spec.model })

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
  if ("fusion" in row) {
    return ["HUGGINGFACE_API_KEY"]
  }
  const vars = new Set<string>()
  for (const { spec } of row.signals) {
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

/** Margins at each greedy step: top1 − top2 outgoing scores (same start rule as greedyOrder). */
function greedyPathMargins(points: string[], matrix: TransitionMatrix): number[] {
  const n = points.length
  if (n <= 1) return [1]

  let start = 0
  for (let i = 1; i < n; i++) if (points[i].length < points[start].length) start = i

  const path: number[] = [start]
  const remaining = new Set<number>()
  for (let i = 0; i < n; i++) if (i !== start) remaining.add(i)

  const margins: number[] = []
  while (remaining.size > 0) {
    const current = path[path.length - 1]
    const scores: number[] = []
    for (const j of remaining) scores.push(matrix[current]?.[j] ?? 0)
    scores.sort((a, b) => b - a)
    margins.push(scores.length >= 2 ? scores[0] - scores[1] : scores[0] ?? 0)

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
  return margins
}

function argmaxOutgoing(
  current: number,
  candidates: Set<number>,
  mat: TransitionMatrix,
): number | null {
  let best: number | null = null
  let bestScore = -Infinity
  for (const j of candidates) {
    const s = mat[current]?.[j] ?? 0
    if (s > bestScore) {
      bestScore = s
      best = j
    }
  }
  return best
}

/**
 * Fraction of greedy steps (on linearBlend) where discourse argmax next ≠ LLM argmax next.
 * Proxy for cross-signal disagreement without using ground-truth order.
 */
function discourseLLMDisagreementRateOnLinearGreedy(
  points: string[],
  linearBlend: TransitionMatrix,
  discourse: TransitionMatrix,
  llm: TransitionMatrix,
): number {
  const n = points.length
  if (n <= 1) return 0

  let start = 0
  for (let i = 1; i < n; i++) if (points[i].length < points[start].length) start = i

  const remaining = new Set<number>()
  for (let i = 0; i < n; i++) if (i !== start) remaining.add(i)

  let current = start
  let steps = 0
  let disagreements = 0

  while (remaining.size > 0) {
    const dNext = argmaxOutgoing(current, remaining, discourse)
    const lNext = argmaxOutgoing(current, remaining, llm)
    steps++
    if (dNext != null && lNext != null && dNext !== lNext) disagreements++

    let bestNext: number | null = null
    let bestScore = -Infinity
    for (const j of remaining) {
      const s = linearBlend[current]?.[j] ?? 0
      if (s > bestScore) {
        bestScore = s
        bestNext = j
      }
    }
    if (bestNext == null) break
    remaining.delete(bestNext)
    current = bestNext
  }

  return steps === 0 ? 0 : disagreements / steps
}

/**
 * No labels at runtime: if the linear blend’s greedy path has weak margins or discourse vs LLM
 * disagree on next-step picks, re-blend with higher LLM weight (same precomputed matrices).
 * Production POST could adopt the same policy without a second LLM call.
 */
function fuseConfidenceAware(
  points: string[],
  discourse: TransitionMatrix,
  bge01: TransitionMatrix,
  llm: TransitionMatrix,
  opts?: {
    linear?: [number, number, number]
    llmHeavy?: [number, number, number]
    marginThreshold?: number
    disagreeFractionThreshold?: number
  },
): TransitionMatrix {
  const linearW = opts?.linear ?? [0.15, 0.35, 0.5]
  const heavyW = opts?.llmHeavy ?? [0.05, 0.1, 0.85]
  const marginTh = opts?.marginThreshold ?? 0.06
  const disagreeTh = opts?.disagreeFractionThreshold ?? 0.34

  const linearBlend = blendMatrices([discourse, bge01, llm], [...linearW])
  const margins = greedyPathMargins(points, linearBlend)
  const meanMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0
  const disagreeRate = discourseLLMDisagreementRateOnLinearGreedy(
    points,
    linearBlend,
    discourse,
    llm,
  )

  const uncertain = meanMargin < marginTh || disagreeRate > disagreeTh
  return uncertain
    ? blendMatrices([discourse, bge01, llm], [...heavyW])
    : linearBlend
}

describe("Threader ordering matrix evaluation", () => {
  it("runs the full matrix (skips rows missing API keys)", async () => {
    const gold = activeGoldExamples()
    const fullGold = process.env.THREADER_FULL_GOLD === "1"

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
          let scoringMatrix: TransitionMatrix

          if ("fusion" in row && row.fusion === "gated-disc-bge-llm") {
            const bgeModel = "BAAI/bge-small-en-v1.5"
            const [discourse, bge01, llm] = await Promise.all([
              buildSignalMatrix(ex.points, { kind: "discourse" }),
              buildSignalMatrix(ex.points, { kind: "hf-embed", model: bgeModel }),
              buildSignalMatrix(ex.points, { kind: "llm-directional" }),
            ])
            scoringMatrix = fuseConfidenceAware(ex.points, discourse, bge01, llm)
          } else if ("signals" in row) {
            const signalMats = await Promise.all(
              row.signals.map(({ spec }) => buildSignalMatrix(ex.points, spec)),
            )
            const weights = row.signals.map(({ weight }) => weight)
            scoringMatrix = blendMatrices(signalMats, weights)
          } else {
            throw new Error("Invalid matrix row shape")
          }

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

    console.log(
      `\n=== Threader Matrix Results (${gold.length} gold examples${fullGold ? ", THREADER_FULL_GOLD" : ", core only"}) ===`,
    )
    for (const r of results) {
      if (!r.ran) {
        const reasons = r.skippedBecause?.join(" | ") ?? ""
        const isMissingKey = reasons.includes("_API_KEY")
        const isGateway =
          reasons.includes("AI Gateway") || reasons.includes("default provider")
        const isRateLimit =
          /rate limit/i.test(reasons) || reasons.includes("Free credits temporarily")
        const tag = isMissingKey
          ? "SKIP (no key)  "
          : isRateLimit
            ? "SKIP (rate limit) "
            : isGateway
              ? "SKIP (Gateway) "
              : "SKIP (API err) "
        console.log(`#${String(r.id).padStart(2)} ${tag} ${r.name} — ${reasons}`)
      } else {
        console.log(`#${String(r.id).padStart(2)} OK             ${r.name} | tau=${r.meanTau?.toFixed(3)} | acc=${r.meanAcc?.toFixed(3)}`)
      }
    }
    console.log("==============================\n")
  }, 300_000)
})

