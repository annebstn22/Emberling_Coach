import { generateText } from "ai"
import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"

interface OrderingResult {
  method: string
  path: number[]
  score: number
  description: string
}

interface ThreaderRequest {
  points: string[]
}

interface ExpandedPoint {
  original: string
  expanded: string
  index: number
}

export type EmbeddingVector = number[]
export type TransitionMatrix = number[][]

/** Hugging Face sentence-embedding model id for Threader cosine similarity. */
export const THREADER_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
/** OpenAI embedding model id when HF inference is unavailable. */
export const THREADER_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small" as const

const BLEND_WEIGHT_DISCOURSE = 0.35
const BLEND_WEIGHT_ENCODER = 0.65
const DISCOURSE_TRANSITION_STEEPNESS = 5
const SIMULATED_ANNEALING_MAX_ITERATIONS = 1000
const SIMULATED_ANNEALING_INITIAL_TEMP = 1.0
const SIMULATED_ANNEALING_COOLING_RATE = 0.995
const GENETIC_POPULATION_SIZE = 30
const GENETIC_GENERATIONS = 50
const GENETIC_TOURNAMENT_SIZE = 5
const GENETIC_CROSSOVER_RATE = 0.7
const GENETIC_MUTATION_RATE = 0.1
const EXPANSION_MIN_EXTRA_CHARS = 15
const BRIDGE_PHRASE_MAX_CHARS = 50
const DEFAULT_BRIDGE_PHRASES = [
  "which naturally leads to",
  "and thus",
  "building toward",
  "until finally",
  "as a result",
  "consequently",
] as const

// Discourse markers → narrative position [0,1]; pair scores use sigmoid(steepness * Δposition).
const DISCOURSE_MARKERS: Array<{ pattern: RegExp; position: number }> = [
  { pattern: /\b(i believe|i think|i want to|the question|to begin|at first|initially|i was|i felt|when i first|i joined|i started|i had|i used to)\b/i, position: 0.1 },
  { pattern: /\b(for example|for instance|specifically|to illustrate|consider|such as|one example|take the case)\b/i, position: 0.3 },
  { pattern: /\b(also|additionally|furthermore|moreover|in addition|another|similarly|likewise|and then|and i)\b/i, position: 0.5 },
  { pattern: /\b(then|next|after that|following this|after this)\b/i, position: 0.5 },
  { pattern: /\b(before|previously|earlier|at the start|back when|at the time)\b/i, position: 0.2 },
  { pattern: /\b(eventually|over time|by then|in time|after a while|soon after)\b/i, position: 0.7 },
  { pattern: /\b(however|but then|although|despite|on the other hand|in contrast|yet|nevertheless|while)\b/i, position: 0.6 },
  { pattern: /\b(i realized|i understood|i discovered|that reframed|that changed|i noticed|i learned that)\b/i, position: 0.65 },
  { pattern: /\b(therefore|thus|hence|as a result|consequently|because of this|this led|this caused|this meant|this helped|so i|which meant)\b/i, position: 0.75 },
  { pattern: /\b(in conclusion|in summary|to summarize|ultimately|to conclude|this is why|this shows|the lesson|what i learned|going forward|from now on|looking back|the takeaway)\b/i, position: 0.9 },
  { pattern: /\b(finally|in the end|at the end|by the end|lastly|last of all)\b/i, position: 0.85 },
]

type EmbeddingProvider =
  | { kind: "openai"; model: typeof THREADER_OPENAI_EMBEDDING_MODEL }
  | { kind: "huggingface"; model: string }

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY for embeddings")
  }
  return new OpenAI({ apiKey })
}

function getHuggingFaceApiKey(): string {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) {
    throw new Error("Missing HUGGINGFACE_API_KEY")
  }
  return apiKey
}

export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length) {
    throw new Error(`Embedding length mismatch: ${a.length} vs ${b.length}`)
  }
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    dot += ai * bi
    normA += ai * ai
    normB += bi * bi
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  if (!Number.isFinite(denom) || denom === 0) return 0
  const cos = dot / denom
  // Numerical guard: should be [-1, 1], but clamp anyway
  if (cos > 1) return 1
  if (cos < -1) return -1
  return cos
}

function meanPoolTokenEmbeddings(tokenEmbeddings: number[][]): number[] {
  if (tokenEmbeddings.length === 0) return []
  const dim = tokenEmbeddings[0]?.length ?? 0
  const out = new Array(dim).fill(0)
  for (const tokenVec of tokenEmbeddings) {
    for (let d = 0; d < dim; d++) out[d] += tokenVec[d] ?? 0
  }
  for (let d = 0; d < dim; d++) out[d] /= tokenEmbeddings.length
  return out
}

function normalizeVectorL2(vec: number[]): number[] {
  let sumSq = 0
  for (const v of vec) sumSq += v * v
  const denom = Math.sqrt(sumSq)
  if (!Number.isFinite(denom) || denom === 0) return vec
  return vec.map((v) => v / denom)
}

async function computeEmbeddingsOpenAI(texts: string[]): Promise<EmbeddingVector[]> {
  const openai = getOpenAIClient()
  const resp = await openai.embeddings.create({
    model: THREADER_OPENAI_EMBEDDING_MODEL,
    input: texts,
  })
  return resp.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[])
}

async function computeEmbeddingsHuggingFace(
  texts: string[],
  model: string,
): Promise<EmbeddingVector[]> {
  const apiKey = getHuggingFaceApiKey()
  const encodedModel = model.split("/").map(encodeURIComponent).join("/")
  const url = `https://router.huggingface.co/hf-inference/models/${encodedModel}/pipeline/feature-extraction`

  const vectors: EmbeddingVector[] = []
  for (const text of texts) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs: text }),
    })

    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      throw new Error(
        `HuggingFace embeddings failed (HTTP ${res.status}): ${msg.slice(0, 200)}. ` +
          "429 often means rate limit; 503 can mean the model is loading—retry shortly.",
      )
    }

    const json = (await res.json()) as unknown
    // HF feature extraction can return:
    // - number[] (already pooled)
    // - number[][] (token embeddings)
    if (Array.isArray(json) && typeof json[0] === "number") {
      vectors.push(normalizeVectorL2(json as number[]))
    } else if (Array.isArray(json) && Array.isArray(json[0])) {
      const pooled = meanPoolTokenEmbeddings(json as number[][])
      vectors.push(normalizeVectorL2(pooled))
    } else {
      throw new Error("Unexpected HuggingFace embeddings response shape")
    }
  }
  return vectors
}

export async function computeEmbeddings(
  texts: string[],
  provider: EmbeddingProvider = { kind: "openai", model: THREADER_OPENAI_EMBEDDING_MODEL },
): Promise<EmbeddingVector[]> {
  if (texts.length === 0) return []
  if (provider.kind === "openai") return computeEmbeddingsOpenAI(texts)
  return computeEmbeddingsHuggingFace(texts, provider.model)
}

function discoursePositionScore(text: string): number {
  const t = text.toLowerCase()
  const matched: number[] = []
  for (const { pattern, position } of DISCOURSE_MARKERS) {
    if (pattern.test(t)) matched.push(position)
  }
  if (matched.length === 0) return 0.5
  return matched.reduce((a, b) => a + b, 0) / matched.length
}

export function computeDiscourseMatrix(texts: string[]): TransitionMatrix {
  const n = texts.length
  const positions = texts.map(discoursePositionScore)
  const matrix: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      matrix[i][j] = 1 / (1 + Math.exp(-DISCOURSE_TRANSITION_STEEPNESS * (positions[j] - positions[i])))
    }
  }
  return matrix
}

// ─── Cosine similarity matrix from embeddings ─────────────────────────────────
function computeCosineMatrix(embeddings: EmbeddingVector[]): TransitionMatrix {
  const n = embeddings.length
  const out: TransitionMatrix = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  )
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      out[i][j] = cosineSimilarity(embeddings[i], embeddings[j])
    }
  }
  return out
}

function blendDiscourseEncoder(
  discourse: TransitionMatrix,
  cosRaw: TransitionMatrix,
  wDisc: number,
  wEnc: number,
): TransitionMatrix {
  const n = discourse.length
  const t = wDisc + wEnc
  const out: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      out[i][j] =
        (wDisc * (discourse[i]?.[j] ?? 0) + wEnc * (((cosRaw[i]?.[j] ?? 0) + 1) / 2)) / t
    }
  }
  return out
}

async function expandPoints(points: string[]): Promise<ExpandedPoint[]> {
  if (points.length === 0) return []

  const numbered = points.map((p, i) => `${i + 1}. ${p}`).join("\n")

  const prompt = `Expand each bullet point into 1-2 complete sentences that make the topic and meaning explicit. 

CRITICAL INSTRUCTIONS:
- Do NOT add new information that isn't implied
- Do NOT add generic filler like "This point provides important context"
- DO clarify what's implied in the original point
- DO make implicit connections and meanings explicit
- DO expand on the underlying significance or context

Examples:
Original: "I worked at a startup"
Expanded: "I worked at a startup, where I gained hands-on experience in a fast-paced environment and learned to adapt quickly to changing priorities."

Original: "I learned about product design"
Expanded: "I learned about product design, understanding how user needs translate into functional interfaces and how to balance aesthetics with usability."

Original: "I want to study computer science"
Expanded: "I want to study computer science to build a strong technical foundation that will enable me to create innovative solutions to complex problems."

Now expand these points following the same pattern:

${numbered}

Return ONLY a numbered list (1., 2., 3., etc.) with the expanded versions. No other text.`

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: prompt,
      temperature: 0.5,
    })

    const lines = text.split("\n").filter((line) => line.trim())

    const expanded: ExpandedPoint[] = []

    for (let i = 0; i < points.length; i++) {
      const num = i + 1
      const patterns = [
        new RegExp(`^${num}\\.\\s*(.+)$`, "i"),
        new RegExp(`^${num}\\)\\s*(.+)$`, "i"),
        new RegExp(`^${num}\\s+(.+)$`, "i"),
      ]

      let found = false
      let expandedText = ""

      for (const line of lines) {
        for (const pattern of patterns) {
          const match = line.trim().match(pattern)
          if (match && match[1]) {
            expandedText = match[1].trim()
            // Remove any trailing periods that might be from formatting
            // Remove quotes and clean up
            expandedText = expandedText.replace(/^["']|["']$/g, "")
            expandedText = expandedText.trim()

            if (expandedText && expandedText.length > 0 && expandedText.toLowerCase() !== points[i].toLowerCase()) {
              found = true
              break
            }
          }
        }
        if (found) break
      }

      const isDifferent =
        expandedText &&
        expandedText.toLowerCase().trim() !== points[i].toLowerCase().trim() &&
        expandedText.length > points[i].length + EXPANSION_MIN_EXTRA_CHARS

      if (found && isDifferent) {
        expanded.push({
          original: points[i],
          expanded: expandedText,
          index: i,
        })
      } else {
        let smartExpansion = points[i]

        if (points[i].toLowerCase().includes("worked") || points[i].toLowerCase().includes("job")) {
          smartExpansion = `${points[i]}, where I gained valuable experience and developed key skills.`
        } else if (points[i].toLowerCase().includes("learned") || points[i].toLowerCase().includes("studied")) {
          smartExpansion = `${points[i]}, which helped me understand important concepts and develop new perspectives.`
        } else if (points[i].toLowerCase().includes("want") || points[i].toLowerCase().includes("plan")) {
          smartExpansion = `${points[i]}, as this will help me achieve my goals and advance my understanding.`
        } else {
          smartExpansion = `${points[i]}, which represents an important aspect of my experience and perspective.`
        }

        expanded.push({
          original: points[i],
          expanded: smartExpansion,
          index: i,
        })
      }
    }

    return expanded
  } catch (error) {
    console.error(
      "Threader expandPoints: LLM call failed (check rate limits, API keys, and gateway availability):",
      error,
    )
    // Fallback: smart expansion based on content
    return points.map((p, i) => {
      let smartExpansion = p
      
      if (p.toLowerCase().includes("worked") || p.toLowerCase().includes("job") || p.toLowerCase().includes("startup")) {
        smartExpansion = `${p}, where I gained valuable experience and developed key skills.`
      } else if (p.toLowerCase().includes("learned") || p.toLowerCase().includes("studied")) {
        smartExpansion = `${p}, which helped me understand important concepts and develop new perspectives.`
      } else if (p.toLowerCase().includes("want") || p.toLowerCase().includes("plan") || p.toLowerCase().includes("study")) {
        smartExpansion = `${p}, as this will help me achieve my goals and advance my understanding.`
      } else {
        smartExpansion = `${p}, which represents an important aspect of my experience and perspective.`
      }
      
      return {
        original: p,
        expanded: smartExpansion,
        index: i,
      }
    })
  }
}

function greedyOrdering(
  expandedPoints: ExpandedPoint[],
  transitionMatrix: TransitionMatrix,
): OrderingResult {
  if (expandedPoints.length <= 1) {
    return {
      method: "Greedy Search",
      path: expandedPoints.map((p) => p.index),
      score: 1.0,
      description: "Fast algorithm that always picks the best local transition",
    }
  }

  // Start with shortest expanded point (often a good opener)
  const startIdx = expandedPoints.reduce(
    (minIdx, p, idx) =>
      p.expanded.length < expandedPoints[minIdx].expanded.length ? idx : minIdx,
    0,
  )
  const path = [startIdx]
  const remaining = new Set(
    expandedPoints.map((_, i) => i).filter((i) => i !== startIdx),
  )

  while (remaining.size > 0) {
    const current = path[path.length - 1]
    let bestNext = -1
    let bestScore = -1

    for (const nextIdx of remaining) {
      const score = transitionMatrix[current]?.[nextIdx] ?? 0
      if (score > bestScore) {
        bestScore = score
        bestNext = nextIdx
      }
    }

    if (bestNext >= 0) {
      path.push(bestNext)
      remaining.delete(bestNext)
    } else {
      // Fallback: add any remaining
      const fallback = remaining.values().next().value as number | undefined
      if (fallback == null) break
      path.push(fallback)
      remaining.delete(fallback)
    }
  }

  // Calculate average transition score
  let totalScore = 0
  for (let i = 0; i < path.length - 1; i++) {
    totalScore += transitionMatrix[path[i]]?.[path[i + 1]] ?? 0
  }
  const avgScore = path.length > 1 ? totalScore / (path.length - 1) : 1.0

  return {
    method: "Greedy Search",
    path: path.map((idx) => expandedPoints[idx].index),
    score: avgScore,
    description: "Fast algorithm that always picks the best local transition",
  }
}

function simulatedAnnealingOrdering(
  expandedPoints: ExpandedPoint[],
  transitionMatrix: TransitionMatrix,
  maxIterations = SIMULATED_ANNEALING_MAX_ITERATIONS,
): OrderingResult {
  if (expandedPoints.length <= 1) {
    return {
      method: "Simulated Annealing",
      path: expandedPoints.map((p) => p.index),
      score: 1.0,
      description: "Probabilistic optimization that escapes local optima",
    }
  }

  // Random initial path
  let currentPath = expandedPoints.map((_, i) => i)
  for (let i = currentPath.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[currentPath[i], currentPath[j]] = [currentPath[j], currentPath[i]]
  }

  let currentScore = 0
  for (let i = 0; i < currentPath.length - 1; i++) {
    currentScore += transitionMatrix[currentPath[i]]?.[currentPath[i + 1]] ?? 0
  }
  currentScore =
    currentPath.length > 1 ? currentScore / (currentPath.length - 1) : 1.0

  let bestPath = [...currentPath]
  let bestScore = currentScore

  let temperature = SIMULATED_ANNEALING_INITIAL_TEMP
  const coolingRate = SIMULATED_ANNEALING_COOLING_RATE

  for (let iter = 0; iter < maxIterations; iter++) {
    // Generate neighbor by swapping two random positions
    const newPath = [...currentPath]
    const i = Math.floor(Math.random() * newPath.length)
    const j = Math.floor(Math.random() * newPath.length)
    ;[newPath[i], newPath[j]] = [newPath[j], newPath[i]]

    // Calculate new score
    let newScore = 0
    for (let k = 0; k < newPath.length - 1; k++) {
      newScore += transitionMatrix[newPath[k]]?.[newPath[k + 1]] ?? 0
    }
    newScore = newPath.length > 1 ? newScore / (newPath.length - 1) : 1.0

    // Acceptance criterion
    const delta = newScore - currentScore
    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      currentPath = newPath
      currentScore = newScore

      if (currentScore > bestScore) {
        bestPath = [...currentPath]
        bestScore = currentScore
      }
    }

    temperature *= coolingRate
  }

  return {
    method: "Simulated Annealing",
    path: bestPath.map((idx) => expandedPoints[idx].index),
    score: bestScore,
    description: "Probabilistic optimization that escapes local optima",
  }
}

function geneticAlgorithmOrdering(
  expandedPoints: ExpandedPoint[],
  transitionMatrix: TransitionMatrix,
  populationSize = GENETIC_POPULATION_SIZE,
  generations = GENETIC_GENERATIONS,
): OrderingResult {
  if (expandedPoints.length <= 1) {
    return {
      method: "Genetic Algorithm",
      path: expandedPoints.map((p) => p.index),
      score: 1.0,
      description: "Evolutionary approach that evolves population of solutions",
    }
  }

  // Initialize population
  let population: number[][] = []
  for (let i = 0; i < populationSize; i++) {
    const individual = expandedPoints.map((_, idx) => idx)
    for (let j = individual.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1))
      ;[individual[j], individual[k]] = [individual[k], individual[j]]
    }
    population.push(individual)
  }

  // Fitness function
  const fitness = (path: number[]): number => {
    let score = 0
    for (let i = 0; i < path.length - 1; i++) {
      score += transitionMatrix[path[i]]?.[path[i + 1]] ?? 0
    }
    return path.length > 1 ? score / (path.length - 1) : 1.0
  }

  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness
    const fitnessScores = population.map(fitness)

    // Selection (tournament)
    const newPopulation: number[][] = []
    for (let i = 0; i < populationSize; i++) {
      const tournamentSize = GENETIC_TOURNAMENT_SIZE
      const tournament = []
      for (let j = 0; j < tournamentSize; j++) {
        const idx = Math.floor(Math.random() * populationSize)
        tournament.push({ individual: population[idx], fitness: fitnessScores[idx] })
      }
      const winner = tournament.reduce((best, curr) =>
        curr.fitness > best.fitness ? curr : best,
      )
      newPopulation.push([...winner.individual])
    }

    // Crossover (order crossover)
    for (let i = 0; i < populationSize; i += 2) {
      if (i + 1 < populationSize && Math.random() < GENETIC_CROSSOVER_RATE) {
        const parent1 = newPopulation[i]
        const parent2 = newPopulation[i + 1]
        const start = Math.floor(Math.random() * parent1.length)
        const end = Math.floor(Math.random() * (parent1.length - start)) + start

        const child1 = new Array(parent1.length).fill(-1)
        const child2 = new Array(parent2.length).fill(-1)

        // Copy segment
        for (let j = start; j <= end; j++) {
          child1[j] = parent1[j]
          child2[j] = parent2[j]
        }

        // Fill remaining
        const fillChild = (child: number[], parent: number[]) => {
          let pos = (end + 1) % child.length
          for (const gene of parent) {
            if (!child.includes(gene)) {
              child[pos] = gene
              pos = (pos + 1) % child.length
            }
          }
        }

        fillChild(child1, parent2)
        fillChild(child2, parent1)

        newPopulation[i] = child1
        newPopulation[i + 1] = child2
      }
    }

    // Mutation
    for (let i = 0; i < populationSize; i++) {
      if (Math.random() < GENETIC_MUTATION_RATE) {
        const idx1 = Math.floor(Math.random() * newPopulation[i].length)
        const idx2 = Math.floor(Math.random() * newPopulation[i].length)
        ;[newPopulation[i][idx1], newPopulation[i][idx2]] = [
          newPopulation[i][idx2],
          newPopulation[i][idx1],
        ]
      }
    }

    population = newPopulation
  }

  // Return best individual
  const fitnessScores = population.map(fitness)
  const bestIdx = fitnessScores.indexOf(Math.max(...fitnessScores))

  return {
    method: "Genetic Algorithm",
    path: population[bestIdx].map((idx) => expandedPoints[idx].index),
    score: fitnessScores[bestIdx],
    description: "Evolutionary approach that evolves population of solutions",
  }
}

async function generateBridgeText(
  point1: string,
  point2: string,
  position: number,
  total: number,
): Promise<string> {
  const prompt = `Generate a unique, brief transition phrase (2-5 words) that naturally connects these two points in a narrative flow.

Previous point: ${point1}
Next point: ${point2}
Position: ${position} of ${total}

The transition should be specific to how these two points relate. Use varied language - avoid repeating the same phrase.

Examples of varied transitions: "which naturally leads to", "and thus", "building toward", "until finally", "which then", "as a result", "consequently", "furthermore", "in turn", "thereby"

Return ONLY the transition phrase, nothing else. No quotes, no explanation.`

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: prompt,
      temperature: 0.8,
    })

    let cleaned = text.trim()
    cleaned = cleaned.replace(/^["']|["']$/g, "")
    cleaned = cleaned.replace(/^["']|["']$/g, "")
    cleaned = cleaned.split("\n")[0].trim()
    cleaned = cleaned.replace(/^transition:?\s*/i, "")

    if (!cleaned || cleaned.length > BRIDGE_PHRASE_MAX_CHARS) {
      return DEFAULT_BRIDGE_PHRASES[position % DEFAULT_BRIDGE_PHRASES.length]
    }

    return cleaned
  } catch (error) {
    console.error(
      "Threader bridge: LLM failed (rate limits or gateway); using canned phrase:",
      error,
    )
    return DEFAULT_BRIDGE_PHRASES[position % DEFAULT_BRIDGE_PHRASES.length]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ThreaderRequest = await request.json()
    const { points } = body

    if (!points || !Array.isArray(points) || points.length < 2) {
      return NextResponse.json(
        { error: "At least 2 points are required" },
        { status: 400 },
      )
    }

    const validPoints = points.filter((p) => p && p.trim().length > 0)

    if (validPoints.length < 2) {
      return NextResponse.json(
        { error: "At least 2 valid points are required" },
        { status: 400 },
      )
    }

    const expandedPoints = await expandPoints(validPoints)

    const texts = expandedPoints.map((p) => p.expanded)
    const discourseMatrix = computeDiscourseMatrix(texts)

    let transitionMatrix: TransitionMatrix
    let orderingBlendUsed: string
    try {
      const embeddings = await computeEmbeddings(texts, {
        kind: "huggingface",
        model: THREADER_EMBEDDING_MODEL,
      })
      transitionMatrix = blendDiscourseEncoder(
        discourseMatrix,
        computeCosineMatrix(embeddings),
        BLEND_WEIGHT_DISCOURSE,
        BLEND_WEIGHT_ENCODER,
      )
      orderingBlendUsed =
        `PRIMARY — discourse(${BLEND_WEIGHT_DISCOURSE}) + HF BGE-small cosine ${THREADER_EMBEDDING_MODEL} (${BLEND_WEIGHT_ENCODER})`
    } catch (hfErr) {
      console.warn("Threader HF embeddings failed:", hfErr)
      try {
        const embeddings = await computeEmbeddings(texts, {
          kind: "openai",
          model: THREADER_OPENAI_EMBEDDING_MODEL,
        })
        transitionMatrix = blendDiscourseEncoder(
          discourseMatrix,
          computeCosineMatrix(embeddings),
          BLEND_WEIGHT_DISCOURSE,
          BLEND_WEIGHT_ENCODER,
        )
        orderingBlendUsed =
          `FALLBACK — discourse(${BLEND_WEIGHT_DISCOURSE}) + OpenAI ${THREADER_OPENAI_EMBEDDING_MODEL} cosine (${BLEND_WEIGHT_ENCODER})`
      } catch {
        transitionMatrix = discourseMatrix
        orderingBlendUsed = "FALLBACK — discourse matrix only (no embeddings)"
      }
    }

    console.log("[Threader] Ordering blend in use:", orderingBlendUsed)

    const orderings: OrderingResult[] = [
      greedyOrdering(expandedPoints, transitionMatrix),
      simulatedAnnealingOrdering(expandedPoints, transitionMatrix),
      geneticAlgorithmOrdering(expandedPoints, transitionMatrix),
    ]

    orderings.sort((a, b) => b.score - a.score)

    const bestOrdering = orderings[0]
    const bridges: string[] = []

    for (let i = 0; i < bestOrdering.path.length - 1; i++) {
      const point1 = validPoints[bestOrdering.path[i]]
      const point2 = validPoints[bestOrdering.path[i + 1]]
      const bridge = await generateBridgeText(
        point1,
        point2,
        i,
        bestOrdering.path.length - 1,
      )
      bridges.push(bridge)
    }

    return NextResponse.json({
      all_points: validPoints,
      expanded_points: expandedPoints.map((ep) => ep.expanded),
      orderings: orderings.map((ordering) => ({
        ...ordering,
        ordered_points: ordering.path.map((idx) => validPoints[idx]),
      })),
      best_ordering: {
        ...bestOrdering,
        ordered_points: bestOrdering.path.map((idx) => validPoints[idx]),
        bridges: bridges,
        ordering_blend: orderingBlendUsed,
      },
    })
  } catch (error) {
    console.error("Error in threader API:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process threader request",
      },
      { status: 500 },
    )
  }
}

