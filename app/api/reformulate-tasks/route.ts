import { generateText } from "ai"
import { google } from "@ai-sdk/google"
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const { text } = await generateText({
      model: google("gemini-2.0-flash-exp"),
      prompt: prompt,
      temperature: 0.3,
    })

    // Clean and validate the JSON response
    let cleanedText = text.trim()

    // Remove markdown code blocks
    cleanedText = cleanedText.replace(/```json\s*/g, "")
    cleanedText = cleanedText.replace(/```\s*/g, "")
    cleanedText = cleanedText.replace(/^\s*\n/gm, "")

    // Try to extract JSON
    const jsonArrayMatch = cleanedText.match(/\[[\s\S]*\]/)
    const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/)

    if (jsonArrayMatch) {
      cleanedText = jsonArrayMatch[0]
    } else if (jsonObjectMatch) {
      cleanedText = jsonObjectMatch[0]
    }

    // Try to parse to validate it's valid JSON
    try {
      JSON.parse(cleanedText)
      return NextResponse.json({ text: cleanedText })
    } catch (parseError) {
      console.error("Invalid JSON from AI. Raw response:", text)
      return NextResponse.json({ error: "Invalid JSON response", rawText: text }, { status: 500 })
    }
  } catch (error) {
    console.error("Error reformulating tasks:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reformulate tasks" },
      { status: 500 },
    )
  }
}
