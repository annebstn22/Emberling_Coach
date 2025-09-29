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
      model: google("gemini-2.5-flash"),
      prompt: prompt,
    })

    return NextResponse.json({ text })
  } catch (error) {
    console.error("Error reformulating tasks:", error)
    return NextResponse.json({ error: "Failed to reformulate tasks" }, { status: 500 })
  }
}
