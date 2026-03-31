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

type EmbeddingProvider =
  | { kind: "openai"; model: "text-embedding-3-small" }
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
    model: "text-embedding-3-small",
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
      throw new Error(`HuggingFace embeddings failed (${res.status}): ${msg}`)
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
  provider: EmbeddingProvider = { kind: "openai", model: "text-embedding-3-small" },
): Promise<EmbeddingVector[]> {
  if (texts.length === 0) return []
  if (provider.kind === "openai") return computeEmbeddingsOpenAI(texts)
  return computeEmbeddingsHuggingFace(texts, provider.model)
}

type DirectionalProvider =
  | { kind: "nli"; model: string }
  | { kind: "msmarco"; model: string }

function softmax(logits: number[]): number[] {
  if (logits.length === 0) return []
  const max = Math.max(...logits)
  const exps = logits.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  if (sum === 0) return logits.map(() => 0)
  return exps.map((v) => v / sum)
}

// Zero-shot NLI models (e.g. facebook/bart-large-mnli) use a different pipeline
// and input format than standard text-classification pair models.
const ZERO_SHOT_NLI_MODELS = new Set(["facebook/bart-large-mnli"])

async function huggingFacePairScore(
  model: string,
  text: string,
  textPair: string,
): Promise<unknown> {
  const apiKey = getHuggingFaceApiKey()
  const encodedModel = model.split("/").map(encodeURIComponent).join("/")

  if (ZERO_SHOT_NLI_MODELS.has(model)) {
    // bart-large-mnli: zero-shot-classification pipeline.
    // We frame "textPair follows from text" as a candidate label.
    const url = `https://router.huggingface.co/hf-inference/models/${encodedModel}/pipeline/zero-shot-classification`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: text,
        parameters: {
          candidate_labels: ["entailment", "neutral", "contradiction"],
          hypothesis_template: `{}. ${textPair}`,
        },
      }),
    })
    if (!res.ok) {
      const msg = await res.text().catch(() => "")
      throw new Error(`HuggingFace directional score failed (${res.status}): ${msg}`)
    }
    return (await res.json()) as unknown
  }

  // Standard NLI text-classification pair models (e.g. FacebookAI/roberta-large-mnli).
  // Try text_pair format first; if that 404s, fall back to RoBERTa's concatenated format.
  const url = `https://router.huggingface.co/hf-inference/models/${encodedModel}/pipeline/text-classification`

  const resPair = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: { text, text_pair: textPair } }),
  })

  if (resPair.ok) return (await resPair.json()) as unknown

  if (resPair.status !== 404) {
    const msg = await resPair.text().catch(() => "")
    throw new Error(`HuggingFace directional score failed (${resPair.status}): ${msg}`)
  }

  // 404 fallback: send as concatenated RoBERTa-style string "[premise] </s></s> [hypothesis]"
  const resConcat = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: `${text} </s></s> ${textPair}` }),
  })

  if (!resConcat.ok) {
    const msg = await resConcat.text().catch(() => "")
    throw new Error(`HuggingFace directional score failed (${resConcat.status}): ${msg}`)
  }
  return (await resConcat.json()) as unknown
}

function extractEntailmentScoreFromNliResponse(json: unknown): number | null {
  // Standard text-classification return: [{label, score}, ...]
  if (Array.isArray(json) && json.length > 0 && typeof json[0] === "object") {
    const items = json as Array<{ label?: string; score?: number }>
    // Check it's label/score pairs (not a nested zero-shot result)
    if (typeof (items[0] as any)?.label === "string") {
      const entail = items.find((x) => (x.label ?? "").toLowerCase().includes("entail"))
      if (entail && typeof entail.score === "number") return entail.score
    }
  }

  // Raw logits: [contradiction, neutral, entailment]
  if (Array.isArray(json) && json.length === 3 && json.every((x) => typeof x === "number")) {
    const probs = softmax(json as number[])
    return probs[2] ?? null
  }

  // Zero-shot-classification return (bart-large-mnli): { sequence, labels: [...], scores: [...] }
  if (json !== null && typeof json === "object" && !Array.isArray(json)) {
    const obj = json as any
    if (Array.isArray(obj.labels) && Array.isArray(obj.scores)) {
      const labels: unknown[] = obj.labels
      const scores: unknown[] = obj.scores
      const idx = labels.findIndex((l) => String(l).toLowerCase().includes("entail"))
      const s = scores[idx]
      if (typeof s === "number") return s
    }
  }

  // Nested array: [{sequence, labels, scores}]
  if (Array.isArray(json) && json.length > 0 && typeof json[0] === "object") {
    const first = json[0] as any
    if (Array.isArray(first?.labels) && Array.isArray(first?.scores)) {
      const labels: unknown[] = first.labels
      const scores: unknown[] = first.scores
      const idx = labels.findIndex((l) => String(l).toLowerCase().includes("entail"))
      const s = scores[idx]
      if (typeof s === "number") return s
    }
  }

  return null
}

function extractMsMarcoScore(json: unknown): number | null {
  // Often: [{label: "LABEL_0", score: 0.123}] (score is fine as-is)
  if (Array.isArray(json) && json.length > 0 && typeof json[0] === "object") {
    const item = json[0] as any
    if (typeof item?.score === "number") return item.score
  }
  // Sometimes: just a number
  if (typeof json === "number") return json
  return null
}

export async function computeDirectionalScores(
  texts: string[],
  provider: DirectionalProvider = { kind: "nli", model: "FacebookAI/roberta-large-mnli" },
): Promise<TransitionMatrix> {
  const n = texts.length
  const matrix: TransitionMatrix = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  )
  if (n === 0) return matrix

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const json = await huggingFacePairScore(provider.model, texts[i], texts[j])
      if (provider.kind === "nli") {
        const score = extractEntailmentScoreFromNliResponse(json)
        if (score == null) {
          throw new Error("Unexpected NLI response shape from HuggingFace")
        }
        matrix[i][j] = score
      } else {
        const score = extractMsMarcoScore(json)
        if (score == null) {
          throw new Error("Unexpected MS MARCO response shape from HuggingFace")
        }
        matrix[i][j] = score
      }
    }
  }

  return matrix
}

// ─── Discourse marker scoring (rule-based, no API, genuinely asymmetric) ────────
// Maps each sentence to a narrative position [0,1]:
//   0 = introduction/thesis   0.5 = body/continuation   1 = conclusion/consequence
// The transition score A→B = sigmoid(5 * (posB − posA)):
//   > 0.5 if B's discourse role is later than A's (correct ordering)
//   < 0.5 if B should come before A (incorrect ordering)
const DISCOURSE_MARKERS: Array<{ pattern: RegExp; position: number }> = [
  // Introduction / thesis (0.1)
  { pattern: /\b(i believe|i think|i want to|the question|to begin|at first|initially|i was|i felt|when i first|i joined|i started|i had|i used to)\b/i, position: 0.1 },
  // Early illustration (0.3)
  { pattern: /\b(for example|for instance|specifically|to illustrate|consider|such as|one example|take the case)\b/i, position: 0.3 },
  // Mid continuation (0.5)
  { pattern: /\b(also|additionally|furthermore|moreover|in addition|another|similarly|likewise|and then|and i)\b/i, position: 0.5 },
  { pattern: /\b(then|next|after that|following this|after this)\b/i, position: 0.5 },
  // Early temporal reference (0.2)
  { pattern: /\b(before|previously|earlier|at the start|back when|at the time)\b/i, position: 0.2 },
  // Later temporal (0.7)
  { pattern: /\b(eventually|over time|by then|in time|after a while|soon after)\b/i, position: 0.7 },
  // Contrast / pivot (0.6)
  { pattern: /\b(however|but then|although|despite|on the other hand|in contrast|yet|nevertheless|while)\b/i, position: 0.6 },
  // Realization / insight (0.65)
  { pattern: /\b(i realized|i understood|i discovered|that reframed|that changed|i noticed|i learned that)\b/i, position: 0.65 },
  // Causal consequence (0.75)
  { pattern: /\b(therefore|thus|hence|as a result|consequently|because of this|this led|this caused|this meant|this helped|so i|which meant)\b/i, position: 0.75 },
  // Conclusion / summary (0.9)
  { pattern: /\b(in conclusion|in summary|to summarize|ultimately|to conclude|this is why|this shows|the lesson|what i learned|going forward|from now on|looking back|the takeaway)\b/i, position: 0.9 },
  { pattern: /\b(finally|in the end|at the end|by the end|lastly|last of all)\b/i, position: 0.85 },
]

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
      // sigmoid(5 * Δposition): strong signal when discourse roles differ, neutral when same
      matrix[i][j] = 1 / (1 + Math.exp(-5 * (positions[j] - positions[i])))
    }
  }
  return matrix
}

// ─── LLM directional scoring (GPT-4o-mini, single batch call) ─────────────────
// Asks the model to rate how naturally each fragment j follows fragment i in a
// coherent essay or argument. One call per example; returns an n×n matrix.
export async function computeLLMDirectionalScores(texts: string[]): Promise<TransitionMatrix> {
  const n = texts.length
  if (n === 0) return []
  const openai = getOpenAIClient()

  const fragmentsList = texts.map((t, i) => `[${i}]: "${t.replace(/"/g, "''")}"`).join("\n")
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "user",
        content: `You are ordering text fragments for a writing coach app.\nFor each ordered pair (i→j), score 0.0–1.0: how naturally does fragment j follow fragment i in a coherent essay, argument, or narrative?\n  1.0 = j clearly and naturally continues from i\n  0.5 = neutral / could go either way\n  0.0 = j should definitely NOT follow i\n\nFragments:\n${fragmentsList}\n\nReturn ONLY a JSON ${n}×${n} matrix (array of arrays) where result[i][j] is the score for the pair (i→j). Set diagonal entries to 0. No explanation, no markdown.`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ""
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error(`LLM directional score: could not parse JSON from response: ${raw.slice(0, 200)}`)

  const parsed = JSON.parse(match[0]) as unknown
  if (!Array.isArray(parsed) || parsed.length !== n) {
    throw new Error(`LLM directional score: unexpected matrix shape (expected ${n}×${n})`)
  }
  return parsed as TransitionMatrix
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

export function buildTransitionMatrix(
  cosineMatrix: TransitionMatrix,
  directionalMatrix: TransitionMatrix,
  alpha: number,
  beta: number,
): TransitionMatrix {
  const n = cosineMatrix.length
  const out: TransitionMatrix = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  )

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      // Map cosine [-1, 1] → [0, 1] so it composes cleanly with probabilities
      const cos01 = (cosineMatrix[i][j] + 1) / 2
      const dir01 = directionalMatrix[i]?.[j] ?? 0
      out[i][j] = alpha * cos01 + beta * dir01
    }
  }

  return out
}

// Semantic expansion using LLM (like IdeaExpander from Hex notebook)
async function expandPoints(points: string[]): Promise<ExpandedPoint[]> {
  if (points.length === 0) return []

  // Build consolidated prompt for batch expansion
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
      temperature: 0.5, // Slightly higher for more variation
    })

    console.log("=== EXPANSION DEBUG ===")
    console.log("Original points:", points)
    console.log("Raw LLM response:", text)
    console.log("Response length:", text.length)

    // Parse output into list - handle various formats
    const lines = text.split("\n").filter((line) => line.trim())
    console.log("Parsed lines:", lines)

    const expanded: ExpandedPoint[] = []

    for (let i = 0; i < points.length; i++) {
      const num = i + 1
      // Try multiple patterns: "1.", "1)", "1. ", etc.
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
            
            // Check if it's actually different from original (not just the same text)
            if (expandedText && expandedText.length > 0 && expandedText.toLowerCase() !== points[i].toLowerCase()) {
              found = true
              break
            }
          }
        }
        if (found) break
      }

      // Validate that expansion is actually different and meaningful
      const isDifferent = expandedText && 
                         expandedText.toLowerCase().trim() !== points[i].toLowerCase().trim() &&
                         expandedText.length > points[i].length + 15 // Must be at least 15 chars longer
      
      if (found && isDifferent) {
        // Good expansion from LLM
        expanded.push({
          original: points[i],
          expanded: expandedText,
          index: i,
        })
        console.log(`✓ Point ${i + 1} LLM expanded: "${points[i]}" → "${expandedText.substring(0, 80)}..."`)
      } else {
        // LLM either failed or returned same/similar text - use smart fallback
        if (found) {
          console.log(`⚠ Point ${i + 1} LLM returned too similar text, using fallback`)
        } else {
          console.log(`⚠ Point ${i + 1} parsing failed, using fallback`)
        }
        // If parsing failed or expansion is too similar, try a smarter fallback
        // Make implicit meaning explicit based on common patterns
        let smartExpansion = points[i]
        
        // Try to infer what's implied and make it explicit
        if (points[i].toLowerCase().includes("worked") || points[i].toLowerCase().includes("job")) {
          smartExpansion = `${points[i]}, where I gained valuable experience and developed key skills.`
        } else if (points[i].toLowerCase().includes("learned") || points[i].toLowerCase().includes("studied")) {
          smartExpansion = `${points[i]}, which helped me understand important concepts and develop new perspectives.`
        } else if (points[i].toLowerCase().includes("want") || points[i].toLowerCase().includes("plan")) {
          smartExpansion = `${points[i]}, as this will help me achieve my goals and advance my understanding.`
        } else {
          // Generic but better than the old one
          smartExpansion = `${points[i]}, which represents an important aspect of my experience and perspective.`
        }
        
        expanded.push({
          original: points[i],
          expanded: smartExpansion,
          index: i,
        })
        console.log(`⚠ Point ${i + 1} smart fallback: "${points[i]}" → "${smartExpansion.substring(0, 80)}..."`)
      }
    }

    console.log("Final expanded points:", expanded.map((ep) => ({
      original: ep.original,
      expanded: ep.expanded.substring(0, 60),
      changed: ep.original !== ep.expanded,
      lengthDiff: ep.expanded.length - ep.original.length,
    })))
    console.log("=== END EXPANSION DEBUG ===")

    return expanded
  } catch (error) {
    console.error("Error expanding points:", error)
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

// Greedy algorithm: always pick best next transition
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

// Simulated annealing for better optimization
function simulatedAnnealingOrdering(
  expandedPoints: ExpandedPoint[],
  transitionMatrix: TransitionMatrix,
  maxIterations = 1000,
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

  let temperature = 1.0
  const coolingRate = 0.995

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

// Genetic algorithm
function geneticAlgorithmOrdering(
  expandedPoints: ExpandedPoint[],
  transitionMatrix: TransitionMatrix,
  populationSize = 30,
  generations = 50,
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
      const tournamentSize = 5
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
      if (i + 1 < populationSize && Math.random() < 0.7) {
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
      if (Math.random() < 0.1) {
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

// Generate bridge text between ordered points using LLM
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
      temperature: 0.8, // Higher temperature for more variety
    })

    // Clean and return - remove quotes, extra whitespace, etc.
    let cleaned = text.trim()
    cleaned = cleaned.replace(/^["']|["']$/g, "") // Remove surrounding quotes
    cleaned = cleaned.replace(/^["']|["']$/g, "") // Remove any remaining quotes
    cleaned = cleaned.split("\n")[0].trim() // Take first line only
    cleaned = cleaned.replace(/^transition:?\s*/i, "") // Remove "Transition:" prefix if present

    // If cleaned is empty or too long, use fallback
    if (!cleaned || cleaned.length > 50) {
      const bridges = [
        "which naturally leads to",
        "and thus",
        "building toward",
        "until finally",
        "as a result",
        "consequently",
      ]
      return bridges[position % bridges.length]
    }

    console.log(`Bridge ${position}: "${cleaned}" (from "${point1.substring(0, 30)}..." to "${point2.substring(0, 30)}...")`)

    return cleaned
  } catch (error) {
    console.error("Error generating bridge text:", error)
    // Fallback to varied default bridges based on position
    const bridges = [
      "which naturally leads to",
      "and thus",
      "building toward",
      "until finally",
      "as a result",
      "consequently",
    ]
    return bridges[position % bridges.length]
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

    // Filter out empty points - use ALL valid points (no selection)
    const validPoints = points.filter((p) => p && p.trim().length > 0)

    if (validPoints.length < 2) {
      return NextResponse.json(
        { error: "At least 2 valid points are required" },
        { status: 400 },
      )
    }

    // Step 1: Expand all points semantically
    const expandedPoints = await expandPoints(validPoints)

    // Step 2: Build transition matrix
    // Signals used (see ordering.test.ts for full evaluation):
    //   - Jaccard+length: strongest single baseline (tau=0.333)
    //   - OpenAI cosine: semantic similarity
    //   - Discourse markers: rule-based, free, genuinely directional
    //   - LLM directional: GPT-4o-mini asks "does B follow A?" (single batch call)
    // Full combination is determined by test matrix results; until confirmed,
    // we use Jaccard + LLM directional + cosine with equal weights, with
    // graceful fallback at each level.
    const texts = expandedPoints.map((p) => p.expanded)

    // Jaccard+length matrix (always available)
    const jaccardMatrix: TransitionMatrix = (() => {
      const n = texts.length
      const m: TransitionMatrix = Array.from({ length: n }, () => new Array(n).fill(0))
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue
          const t1 = texts[i].toLowerCase()
          const t2 = texts[j].toLowerCase()
          const w1 = new Set(t1.split(/\s+/).filter(Boolean))
          const w2 = new Set(t2.split(/\s+/).filter(Boolean))
          const inter = [...w1].filter((x) => w2.has(x)).length
          const union = new Set([...w1, ...w2]).size
          const lex = union > 0 ? inter / union : 0
          const len = 1 - Math.abs(t1.length - t2.length) / Math.max(t1.length, t2.length, 1)
          m[i][j] = 0.5 * lex + 0.5 * len
        }
      }
      return m
    })()

    // Discourse matrix (always available — no API)
    const discourseMatrix = computeDiscourseMatrix(texts)

    let transitionMatrix: TransitionMatrix
    try {
      // Run embeddings and LLM directional scoring in parallel
      const [embeddings, llmMatrix] = await Promise.all([
        computeEmbeddings(texts, { kind: "openai", model: "text-embedding-3-small" }),
        computeLLMDirectionalScores(texts),
      ])
      const cosineMatrix = computeCosineMatrix(embeddings)
      // Blend: Jaccard 0.35 + cosine 0.3 + LLM directional 0.35
      const n = texts.length
      transitionMatrix = Array.from({ length: n }, (_, i) =>
        Array.from({ length: n }, (_, j) =>
          i === j
            ? 0
            : 0.35 * (jaccardMatrix[i]?.[j] ?? 0) +
              0.30 * ((cosineMatrix[i]?.[j] + 1) / 2) +
              0.35 * (llmMatrix[i]?.[j] ?? 0),
        ),
      )
    } catch {
      // OpenAI unavailable — use HF cosine + discourse markers
      try {
        const embeddings = await computeEmbeddings(texts, {
          kind: "huggingface",
          model: "sentence-transformers/all-mpnet-base-v2",
        })
        const cosineMatrix = computeCosineMatrix(embeddings)
        const n = texts.length
        transitionMatrix = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) =>
            i === j
              ? 0
              : 0.45 * (jaccardMatrix[i]?.[j] ?? 0) +
                0.30 * ((cosineMatrix[i]?.[j] + 1) / 2) +
                0.25 * (discourseMatrix[i]?.[j] ?? 0),
          ),
        )
      } catch {
        // All APIs unavailable — Jaccard + discourse markers
        console.warn("Embedding APIs unavailable, using Jaccard+discourse ordering")
        const n = texts.length
        transitionMatrix = Array.from({ length: n }, (_, i) =>
          Array.from({ length: n }, (_, j) =>
            i === j ? 0 : 0.7 * (jaccardMatrix[i]?.[j] ?? 0) + 0.3 * (discourseMatrix[i]?.[j] ?? 0),
          ),
        )
      }
    }

    // Step 3: Generate three orderings using different algorithms
    const orderings: OrderingResult[] = [
      greedyOrdering(expandedPoints, transitionMatrix),
      simulatedAnnealingOrdering(expandedPoints, transitionMatrix),
      geneticAlgorithmOrdering(expandedPoints, transitionMatrix),
    ]

    // Sort by score (best first)
    orderings.sort((a, b) => b.score - a.score)

    // Step 4: Generate bridge text for the best ordering
    const bestOrdering = orderings[0]
    const bridges: string[] = []

    console.log("Generating bridges for best ordering:", bestOrdering.path)

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

    console.log("Generated bridges:", bridges)

    // Return results with original points (not expanded) and bridges
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

