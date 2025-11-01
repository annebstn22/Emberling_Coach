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

    console.log("Raw AI response:", text)

    // Clean and validate the JSON response
    let cleanedText = text.trim()

    // Remove markdown code blocks
    cleanedText = cleanedText.replace(/```json\s*/g, "")
    cleanedText = cleanedText.replace(/```\s*/g, "")
    cleanedText = cleanedText.replace(/^\s*\n/gm, "")

    // Try to extract JSON - look for object first (since evaluation returns an object)
    const jsonObjectMatch = cleanedText.match(/\{[\s\S]*\}/)

    if (jsonObjectMatch) {
      cleanedText = jsonObjectMatch[0]
    }

    console.log("Cleaned text:", cleanedText)

    // Try to parse to validate it's valid JSON
    try {
      const parsed = JSON.parse(cleanedText)

      // Validate that it has the required fields
      if (!parsed.feedback || !Array.isArray(parsed.actionablePoints)) {
        console.error("Invalid evaluation structure:", parsed)
        throw new Error("Response missing required fields")
      }

      return NextResponse.json({ text: cleanedText })
    } catch (parseError) {
      console.error("Invalid JSON from AI. Raw response:", text)
      console.error("Cleaned text:", cleanedText)
      console.error("Parse error:", parseError)

      // Return a structured error with the raw text for debugging
      return NextResponse.json(
        {
          error: "Invalid JSON response",
          rawText: text,
          cleanedText: cleanedText,
          parseError: parseError instanceof Error ? parseError.message : "Unknown parse error",
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error evaluating progress:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to evaluate progress" },
      { status: 500 },
    )
  }
}
