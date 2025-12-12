import { generateText } from "ai"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: prompt,
      temperature: 0.3, // Lower temperature for more consistent JSON
    })

    // Clean and validate the JSON response
    let cleanedText = text.trim()

    // Remove markdown code blocks
    cleanedText = cleanedText.replace(/```json\s*/g, "")
    cleanedText = cleanedText.replace(/```\s*/g, "")
    cleanedText = cleanedText.replace(/^\s*\n/gm, "")

    // Try to extract JSON - look for array or object
    const jsonArrayMatch = cleanedText.match(/\[[\s\S]*\]/)
    const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/)

    if (jsonArrayMatch) {
      cleanedText = jsonArrayMatch[0]
    } else if (jsonObjectMatch) {
      cleanedText = jsonObjectMatch[0]
    }

    // Try to parse to validate it's valid JSON
    try {
      const parsed = JSON.parse(cleanedText)
      return NextResponse.json({ text: cleanedText })
    } catch (parseError) {
      console.error("Invalid JSON from AI. Raw response:", text)
      console.error("Cleaned text:", cleanedText)
      console.error("Parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON response", rawText: text }, { status: 500 })
    }
  } catch (error) {
    console.error("Error generating tasks:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate tasks" },
      { status: 500 },
    )
  }
}
