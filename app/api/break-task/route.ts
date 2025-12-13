import { generateText } from "ai"

export async function POST(request: Request) {
  try {
    const { task, numChunks, chunkDuration } = await request.json()

    const prompt = `You are an expert writing coach helping break down a writing task into smaller, semantically distinct subtasks.

ORIGINAL TASK:
Title: ${task.title}
Description: ${task.description}
Focus: ${task.focus}
Original Duration: ${task.suggestedDuration} minutes

REQUIREMENTS:
- Break this into ${numChunks} subtasks
- Each subtask should take approximately ${chunkDuration} minutes
- Subtasks must be DISTINCT and NON-OVERLAPPING
- Each subtask must have a clear, specific objective
- Completing all subtasks must achieve the same outcome as the original task
- DO NOT just copy the same description ${numChunks} times

EXAMPLES OF GOOD CHUNKING:

Original: "Draft the introduction section (25 minutes)"
Broken into 10-minute chunks:
1. (10 min) "Write opening hook and context" - Draft 2-3 sentences that grab attention and introduce the topic's relevance
2. (10 min) "State thesis and preview main points" - Clearly articulate your main argument and outline what the paper will cover
3. (5 min) "Refine flow and transitions" - Review the introduction for logical progression and smooth connections between ideas

Original: "Revise body paragraphs for clarity (30 minutes)"
Broken into 10-minute chunks:
1. (10 min) "Strengthen topic sentences" - Ensure each paragraph starts with a clear claim that supports the thesis
2. (10 min) "Add supporting evidence" - Insert specific examples, quotes, or data to back up claims
3. (10 min) "Improve transitions between paragraphs" - Add connecting phrases and ensure logical flow of ideas

CRITICAL: Respond with ONLY valid JSON. No markdown code blocks, no explanations, just the JSON object.

{
  "subtasks": [
    {
      "title": "[Brief, specific title for this subtask]",
      "description": "[Detailed instructions for what to accomplish in ${chunkDuration} minutes]",
      "focus": "${task.focus}",
      "duration": ${chunkDuration}
    }
  ]
}

Make each subtask independently completable and evaluable.`

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
      temperature: 0.3,
    })

    console.log("[v0] AI response for task breakdown:", text)

    // Extract JSON from response
    let cleanedText = text.trim()

    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "")

    // Try to find JSON object
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)?.[0]

    if (!jsonMatch) {
      console.error("[v0] No JSON found in response")
      return Response.json({ error: "Invalid JSON response" }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch)

    // Validate the structure
    if (!result.subtasks || !Array.isArray(result.subtasks) || result.subtasks.length === 0) {
      console.error("[v0] Invalid subtasks structure:", result)
      return Response.json({ error: "Invalid subtasks structure" }, { status: 500 })
    }

    // Validate each subtask has required fields
    for (const subtask of result.subtasks) {
      if (!subtask.title || !subtask.description) {
        console.error("[v0] Subtask missing required fields:", subtask)
        return Response.json({ error: "Subtask missing required fields" }, { status: 500 })
      }
    }

    console.log("[v0] Successfully generated", result.subtasks.length, "distinct subtasks")
    return Response.json({ subtasks: result.subtasks })
  } catch (error: any) {
    console.error("[v0] Error in break-task route:", error)
    return Response.json({ error: error.message || "Failed to break task into chunks" }, { status: 500 })
  }
}
