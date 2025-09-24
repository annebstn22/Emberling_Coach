"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  SkipForward,
  CheckCircle,
  Target,
  Lightbulb,
  ArrowRight,
  Clock,
  FileText,
  RotateCcw,
  AlertCircle,
  Plus,
  Edit3,
  AlertTriangle,
} from "lucide-react"
import { generateText } from "ai"
import { google } from "@ai-sdk/google"

interface Task {
  id: string
  title: string
  description: string
  focus: string
  duration: number
  suggestedDuration: number
  completed: boolean
  feedback?: string
  userWork?: string
  completedAt?: Date
  needsImprovement?: boolean
  attempts?: number
  isSubtask?: boolean
  parentTaskId?: string
  subtasks?: Task[]
}

interface Project {
  description: string
  tasks: Task[]
  currentTaskIndex: number
  skipsUsed: number
  completedWork: string[]
}

export default function WritingCoachApp() {
  const [project, setProject] = useState<Project | null>(null)
  const [projectDescription, setProjectDescription] = useState("")
  const [isGeneratingTasks, setIsGeneratingTasks] = useState(false)
  const [currentState, setCurrentState] = useState<"setup" | "working" | "evaluating" | "completed">("setup")
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [taskInput, setTaskInput] = useState("")
  const [backspaceDisabled, setBackspaceDisabled] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [showNextButton, setShowNextButton] = useState(false)
  const [showRedoButton, setShowRedoButton] = useState(false)
  const [showCreateTaskButton, setShowCreateTaskButton] = useState(false)
  const [activeTab, setActiveTab] = useState("current")
  const [customDuration, setCustomDuration] = useState<number[]>([20])
  const [previousWork, setPreviousWork] = useState("")
  const [allDraftWork, setAllDraftWork] = useState("")

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false)
            handleTimeUp()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timeRemaining])

  // Backspace prevention
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (backspaceDisabled && e.key === "Backspace" && e.target instanceof HTMLTextAreaElement) {
        e.preventDefault()
      }
    }

    if (backspaceDisabled) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [backspaceDisabled])

  // Update consolidated draft work whenever project changes
  useEffect(() => {
    if (project) {
      const draftContent = project.tasks
        .filter((task) => task.focus === "draft" && task.userWork && task.completed)
        .map((task) => task.userWork)
        .join("\n\n")
      setAllDraftWork(draftContent)
    }
  }, [project])

  const generateTasks = async () => {
    if (!projectDescription.trim()) return

    setIsGeneratingTasks(true)
    try {
      const { text } = await generateText({
        model: google("gemini-1.5-flash"),
        prompt: `You are an encouraging writing coach helping perfectionist writers. Break down the following writing project into detailed, manageable WRITING tasks with clear success criteria.

IMPORTANT: You must respond with ONLY a valid JSON array. Do not include any other text, explanations, or markdown formatting.

DETAILED TASK REQUIREMENTS:
- All tasks should involve actual writing, editing, or revising
- Provide specific, actionable instructions with clear success metrics
- Include examples where helpful
- Break down research into "write research notes" or "write summary"
- Turn planning into "write outline" or "write draft structure"
- Make every task actionable with measurable text output

The JSON structure must be exactly:
[
  {
    "id": "task_1",
    "title": "Task Title",
    "description": "Detailed, specific writing instructions with success criteria and examples. Include what good completion looks like (word count, structure, key elements to include). Be thorough and helpful.",
    "focus": "draft",
    "suggestedDuration": 25
  }
]

Focus areas: outline, draft, edit, review
Descriptions should be 50-150 words with specific guidance
Suggested duration should vary (10-45 minutes)

Examples of good descriptions:
- "Write a comprehensive outline with 3-5 main sections. Each section should have 2-3 sub-points with brief explanations. Include an introduction hook, thesis statement, and conclusion summary. Aim for 300-500 words total. Good completion: Clear hierarchy, logical flow, specific examples noted."
- "Draft your introduction paragraph (150-200 words). Start with an attention-grabbing hook (question, statistic, or anecdote), provide context, and end with a clear thesis statement. Good completion: Engaging opening, smooth transitions, thesis clearly states your main argument."

Writing project: "${projectDescription}"`,
      })

      let cleanedText = text.trim()
      cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
      cleanedText = cleanedText.replace(/```\n?|\n?```/g, "")

      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        cleanedText = jsonMatch[0]
      }

      let tasks
      try {
        tasks = JSON.parse(cleanedText)
      } catch (parseError) {
        console.error("JSON parse error:", parseError)
        tasks = [
          {
            id: "task_1",
            title: "Write Research Notes",
            description:
              "Research your topic and write comprehensive notes (400-600 words). Focus on 5-7 key sources, summarizing main points, statistics, and quotes. Organize by themes or chronologically. Good completion: Clear source citations, key facts highlighted, personal insights noted, actionable information extracted.",
            focus: "research",
            suggestedDuration: 25,
          },
          {
            id: "task_2",
            title: "Create Detailed Outline",
            description:
              "Write a structured outline (300-500 words) with 3-5 main sections. Each section needs 2-3 sub-points with brief explanations. Include introduction hook, thesis statement, and conclusion summary. Good completion: Clear hierarchy, logical flow between sections, specific examples noted for each point.",
            focus: "outline",
            suggestedDuration: 20,
          },
          {
            id: "task_3",
            title: "Draft Introduction",
            description:
              "Write your introduction paragraph (150-200 words). Start with an attention-grabbing hook (question, statistic, or anecdote), provide necessary context, and end with a clear thesis statement. Good completion: Engaging opening, smooth transitions, thesis clearly states your main argument.",
            focus: "draft",
            suggestedDuration: 30,
          },
          {
            id: "task_4",
            title: "Draft Main Content",
            description:
              "Write the main body of your piece (800-1200 words). Develop each outline point into full paragraphs with supporting evidence, examples, and smooth transitions. Focus on getting ideas down completely. Good completion: Each main point fully developed, evidence supports claims, clear paragraph structure.",
            focus: "draft",
            suggestedDuration: 40,
          },
          {
            id: "task_5",
            title: "Edit and Polish",
            description:
              "Review and improve your draft for clarity, flow, and impact. Check for logical progression, strengthen weak arguments, improve word choice, and fix grammar. Read aloud to catch awkward phrasing. Good completion: Improved readability, stronger arguments, error-free text, consistent tone.",
            focus: "edit",
            suggestedDuration: 25,
          },
        ]
      }

      if (!Array.isArray(tasks)) {
        throw new Error("Response is not an array")
      }

      const newProject: Project = {
        description: projectDescription,
        tasks: tasks.map((task: any, index: number) => ({
          ...task,
          completed: false,
          needsImprovement: false,
          attempts: 0,
          duration: task.suggestedDuration || 20,
          id: task.id || `task_${index + 1}`,
          subtasks: [],
        })),
        currentTaskIndex: 0,
        skipsUsed: 0,
        completedWork: [],
      }

      setProject(newProject)
      setCurrentState("working")
      setCustomDuration([newProject.tasks[0].suggestedDuration])
      startCurrentTask(newProject)
    } catch (error) {
      console.error("Error generating tasks:", error)
      alert("Having trouble connecting to AI. Using default task structure.")

      const fallbackTasks = [
        {
          id: "task_1",
          title: "Write Research Notes",
          description:
            "Research your topic and write comprehensive notes (400-600 words). Focus on 5-7 key sources, summarizing main points, statistics, and quotes. Organize by themes or chronologically. Good completion: Clear source citations, key facts highlighted, personal insights noted.",
          focus: "research",
          duration: 25,
          suggestedDuration: 25,
          completed: false,
          needsImprovement: false,
          attempts: 0,
          subtasks: [],
        },
        {
          id: "task_2",
          title: "Create Detailed Outline",
          description:
            "Write a structured outline (300-500 words) with 3-5 main sections. Each section needs 2-3 sub-points with brief explanations. Include introduction hook, thesis statement, and conclusion summary. Good completion: Clear hierarchy, logical flow between sections.",
          focus: "outline",
          duration: 20,
          suggestedDuration: 20,
          completed: false,
          needsImprovement: false,
          attempts: 0,
          subtasks: [],
        },
        {
          id: "task_3",
          title: "Draft Introduction",
          description:
            "Write your introduction paragraph (150-200 words). Start with an attention-grabbing hook, provide necessary context, and end with a clear thesis statement. Good completion: Engaging opening, smooth transitions, clear thesis.",
          focus: "draft",
          duration: 35,
          suggestedDuration: 35,
          completed: false,
          needsImprovement: false,
          attempts: 0,
          subtasks: [],
        },
        {
          id: "task_4",
          title: "Draft Main Content",
          description:
            "Write the main body (800-1200 words). Develop each outline point into full paragraphs with supporting evidence and examples. Focus on getting ideas down completely. Good completion: Each main point fully developed, evidence supports claims.",
          focus: "draft",
          duration: 25,
          suggestedDuration: 25,
          completed: false,
          needsImprovement: false,
          attempts: 0,
          subtasks: [],
        },
      ]

      const fallbackProject: Project = {
        description: projectDescription,
        tasks: fallbackTasks,
        currentTaskIndex: 0,
        skipsUsed: 0,
        completedWork: [],
      }

      setProject(fallbackProject)
      setCurrentState("working")
      setCustomDuration([fallbackTasks[0].suggestedDuration])
      startCurrentTask(fallbackProject)
    } finally {
      setIsGeneratingTasks(false)
    }
  }

  const breakTaskIntoChunks = async (task: Task, desiredDuration: number) => {
    if (desiredDuration >= task.suggestedDuration) {
      return [{ ...task, duration: desiredDuration }]
    }

    try {
      const { text } = await generateText({
        model: google("gemini-1.5-flash"),
        prompt: `Break down this writing task into smaller ${desiredDuration}-minute chunks. Respond with ONLY valid JSON.

Original task: "${task.title}" - ${task.description}
Focus: ${task.focus}
Original duration: ${task.suggestedDuration} minutes
Desired chunk size: ${desiredDuration} minutes

Return this structure:
{
  "subtasks": [
    {
      "id": "subtask_1",
      "title": "Chunk Title",
      "description": "Specific instructions for this chunk",
      "focus": "${task.focus}",
      "duration": ${desiredDuration}
    }
  ]
}`,
      })

      let cleanedText = text.trim()
      cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleanedText = jsonMatch[0]
      }

      const result = JSON.parse(cleanedText)
      if (result.subtasks && Array.isArray(result.subtasks)) {
        return result.subtasks.map((subtask: any, index: number) => ({
          ...subtask,
          id: `${task.id}_chunk_${index + 1}`,
          isSubtask: true,
          parentTaskId: task.id,
          completed: false,
          needsImprovement: false,
          attempts: 0,
        }))
      }
    } catch (error) {
      console.error("Error breaking task into chunks:", error)
    }

    // Fallback: simple division
    const numChunks = Math.ceil(task.suggestedDuration / desiredDuration)
    return Array.from({ length: numChunks }, (_, index) => ({
      ...task,
      id: `${task.id}_chunk_${index + 1}`,
      title: `${task.title} - Part ${index + 1}`,
      description: `${task.description} (Focus on part ${index + 1} of ${numChunks})`,
      duration: desiredDuration,
      isSubtask: true,
      parentTaskId: task.id,
      completed: false,
      needsImprovement: false,
      attempts: 0,
    }))
  }

  const startCurrentTask = (proj: Project = project!) => {
    const currentTask = proj.tasks[proj.currentTaskIndex]
    if (currentTask) {
      setTimeRemaining(currentTask.duration * 60)
      setPreviousWork("")
      setTaskInput(currentTask.userWork || "")
      setIsTimerRunning(true)
      setShowNextButton(false)
      setShowRedoButton(false)
      setShowCreateTaskButton(false)

      // Auto-enable backspace lock for draft tasks
      if (currentTask.focus === "draft" && !currentTask.userWork) {
        setBackspaceDisabled(true)
      }
    }
  }

  const handleTimeUp = async () => {
    setCurrentState("evaluating")
    await evaluateProgress()
  }

  const evaluateProgress = async () => {
    if (!project) return

    setIsEvaluating(true)
    const currentTask = project.tasks[project.currentTaskIndex]
    const completedWork = project.completedWork.join("\n\n")

    try {
      const { text } = await generateText({
        model: google("gemini-1.5-flash"),
        prompt: `Evaluate this writing work and provide detailed, actionable feedback.

IMPORTANT: Respond with ONLY valid JSON. Provide 5-10 specific, actionable bullet points.

Return this structure:
{
  "feedback": "Brief overall assessment (max 30 words)",
  "actionablePoints": [
    "Specific action item 1",
    "Specific action item 2",
    "Specific action item 3",
    "Specific action item 4",
    "Specific action item 5"
  ],
  "shouldContinue": true/false,
  "qualityScore": 1-10,
  "needsImprovement": true/false,
  "suggestNewTask": true/false,
  "newTaskSuggestion": "brief description if needed"
}

Make actionable points specific and concrete, like:
- "Add 2-3 supporting examples to strengthen your second paragraph"
- "Improve the transition between paragraphs 3 and 4 with a connecting sentence"
- "Replace vague words like 'things' and 'stuff' with specific terms"
- "Add a stronger hook to your introduction - try a surprising statistic"

Task: ${currentTask.title} (${currentTask.duration}min, ${currentTask.focus})
Task Description: ${currentTask.description}
Work: "${taskInput || "No input provided"}"
Previous: "${previousWork.slice(-200)}"`,
      })

      let evaluation
      try {
        let cleanedText = text.trim()
        cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
        cleanedText = cleanedText.replace(/```\n?|\n?```/g, "")

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }

        evaluation = JSON.parse(cleanedText)
      } catch (parseError) {
        console.error("Evaluation JSON parse error:", parseError)
        evaluation = {
          feedback: "Good effort! Let's refine this work further.",
          actionablePoints: [
            "Add more specific details to support your main points",
            "Improve transitions between paragraphs for better flow",
            "Strengthen your opening with a more engaging hook",
            "Include concrete examples to illustrate your ideas",
            "Check for grammar and spelling errors throughout",
          ],
          shouldContinue: taskInput.trim().length > 50,
          qualityScore: taskInput.trim().length > 100 ? 7 : 4,
          needsImprovement: taskInput.trim().length < 100,
          suggestNewTask: false,
          newTaskSuggestion: "",
        }
      }

      const updatedProject = { ...project }
      const currentTaskIndex = project.currentTaskIndex

      updatedProject.tasks[currentTaskIndex].feedback = evaluation.feedback
      updatedProject.tasks[currentTaskIndex].attempts = (updatedProject.tasks[currentTaskIndex].attempts || 0) + 1

      if (evaluation.shouldContinue && !evaluation.needsImprovement) {
        // Task completed successfully
        updatedProject.tasks[currentTaskIndex].completed = true
        updatedProject.tasks[currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
        updatedProject.tasks[currentTaskIndex].completedAt = new Date()
        updatedProject.tasks[currentTaskIndex].needsImprovement = false
        updatedProject.completedWork.push(taskInput)
        setShowNextButton(true)
        setShowRedoButton(false)
        setShowCreateTaskButton(false)

        // Evolve future tasks based on progress
        await evolveTasks(updatedProject, currentTaskIndex)
      } else {
        // Task needs improvement
        updatedProject.tasks[currentTaskIndex].needsImprovement = true
        updatedProject.tasks[currentTaskIndex].completed = false
        updatedProject.tasks[currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()

        // Store actionable points for display
        updatedProject.tasks[currentTaskIndex].actionablePoints = evaluation.actionablePoints

        setShowNextButton(false)
        setShowRedoButton(true)
        setShowCreateTaskButton(evaluation.suggestNewTask || false)
      }

      setProject(updatedProject)
      setIsEvaluating(false)
    } catch (error) {
      console.error("Error evaluating progress:", error)
      const updatedProject = { ...project }
      updatedProject.tasks[project.currentTaskIndex].completed = true
      updatedProject.tasks[project.currentTaskIndex].feedback = "Great effort! Let's move forward."
      updatedProject.tasks[project.currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
      updatedProject.tasks[project.currentTaskIndex].completedAt = new Date()
      updatedProject.completedWork.push(taskInput)

      setProject(updatedProject)
      setShowNextButton(true)
      setShowRedoButton(false)
      setShowCreateTaskButton(false)
      setIsEvaluating(false)
    }
  }

  const evolveTasks = async (updatedProject: Project, completedTaskIndex: number) => {
    if (completedTaskIndex >= updatedProject.tasks.length - 2) return

    try {
      const completedWork = updatedProject.completedWork.join("\n\n")
      const remainingTasks = updatedProject.tasks.slice(completedTaskIndex + 1)

      const { text } = await generateText({
        model: google("gemini-1.5-flash"),
        prompt: `Based on the writer's progress, suggest improvements to the remaining tasks. Respond with ONLY valid JSON.

Return this structure:
{
  "tasks": [
    {
      "id": "existing_task_id",
      "title": "Updated Title",
      "description": "Updated description based on progress",
      "focus": "same_focus",
      "suggestedDuration": 25
    }
  ]
}

Original project: ${updatedProject.description}
Completed work so far: ${completedWork.slice(-800)}
Remaining tasks to improve: ${JSON.stringify(remainingTasks.map((t) => ({ id: t.id, title: t.title, focus: t.focus })))}`,
      })

      let evolution
      try {
        let cleanedText = text.trim()
        cleanedText = cleanedText.replace(/```json\n?|\n?```/g, "")
        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          cleanedText = jsonMatch[0]
        }
        evolution = JSON.parse(cleanedText)

        if (evolution.tasks && Array.isArray(evolution.tasks)) {
          evolution.tasks.forEach((evolvedTask: any) => {
            const taskIndex = updatedProject.tasks.findIndex((t) => t.id === evolvedTask.id)
            if (taskIndex > completedTaskIndex) {
              updatedProject.tasks[taskIndex] = {
                ...updatedProject.tasks[taskIndex],
                title: evolvedTask.title || updatedProject.tasks[taskIndex].title,
                description: evolvedTask.description || updatedProject.tasks[taskIndex].description,
                suggestedDuration: evolvedTask.suggestedDuration || updatedProject.tasks[taskIndex].suggestedDuration,
              }
            }
          })
        }
      } catch (error) {
        console.log("Task evolution failed, continuing with original tasks")
      }
    } catch (error) {
      console.log("Task evolution error:", error)
    }
  }

  const handleNextStep = () => {
    if (!project) return

    const updatedProject = { ...project }
    updatedProject.currentTaskIndex += 1

    setProject(updatedProject)
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)

    if (updatedProject.currentTaskIndex >= updatedProject.tasks.length) {
      setCurrentState("completed")
    } else {
      setCurrentState("working")
      const nextTask = updatedProject.tasks[updatedProject.currentTaskIndex]
      setCustomDuration([nextTask.suggestedDuration])
      startCurrentTask(updatedProject)
    }
  }

  const handleRedoTask = () => {
    if (!project) return

    const updatedProject = { ...project }
    updatedProject.tasks[project.currentTaskIndex].needsImprovement = false

    setProject(updatedProject)
    setCurrentState("working")
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
    startCurrentTask(updatedProject)
  }

  const handleCreateNewTask = async () => {
    if (!project) return

    const currentTask = project.tasks[project.currentTaskIndex]
    const newTaskId = `${currentTask.id}_followup_${Date.now()}`

    const newTask: Task = {
      id: newTaskId,
      title: `Follow-up: ${currentTask.title}`,
      description: currentTask.feedback || "Continue working on the previous task based on feedback.",
      focus: currentTask.focus,
      duration: currentTask.duration,
      suggestedDuration: currentTask.suggestedDuration,
      completed: false,
      needsImprovement: false,
      attempts: 0,
      subtasks: [],
    }

    const updatedProject = { ...project }
    // Insert the new task right after the current one
    updatedProject.tasks.splice(project.currentTaskIndex + 1, 0, newTask)

    // Mark current task as completed with existing work
    updatedProject.tasks[project.currentTaskIndex].completed = true
    updatedProject.tasks[project.currentTaskIndex].needsImprovement = false
    updatedProject.tasks[project.currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
    updatedProject.tasks[project.currentTaskIndex].completedAt = new Date()
    updatedProject.completedWork.push(taskInput)

    // Move to the new task
    updatedProject.currentTaskIndex += 1

    setProject(updatedProject)
    setCurrentState("working")
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
    startCurrentTask(updatedProject)
  }

  const updateTaskDuration = async () => {
    if (!project) return

    const currentTask = project.tasks[project.currentTaskIndex]
    const newDuration = customDuration[0]

    if (newDuration < currentTask.suggestedDuration) {
      // Break task into chunks
      const chunks = await breakTaskIntoChunks(currentTask, newDuration)
      if (chunks.length > 1) {
        const updatedProject = { ...project }
        // Replace current task with chunks
        updatedProject.tasks.splice(project.currentTaskIndex, 1, ...chunks)
        setProject(updatedProject)
        startCurrentTask(updatedProject)
        return
      }
    }

    // Simple duration update
    const updatedProject = { ...project }
    updatedProject.tasks[project.currentTaskIndex].duration = newDuration
    setProject(updatedProject)
    setTimeRemaining(newDuration * 60)
  }

  const skipTask = () => {
    if (!project || project.skipsUsed >= 3) return

    const updatedProject = { ...project }
    updatedProject.skipsUsed += 1
    updatedProject.currentTaskIndex += 1

    setProject(updatedProject)
    setIsTimerRunning(false)

    if (updatedProject.currentTaskIndex >= updatedProject.tasks.length) {
      setCurrentState("completed")
    } else {
      const nextTask = updatedProject.tasks[updatedProject.currentTaskIndex]
      setCustomDuration([nextTask.suggestedDuration])
      startCurrentTask(updatedProject)
    }
  }

  const handleCompleteEarly = async () => {
    setIsTimerRunning(false)
    setTimeRemaining(0)
    setCurrentState("evaluating")
    await evaluateProgress()
  }

  const pauseTimer = () => {
    setIsTimerRunning(!isTimerRunning)
  }

  const resetProject = () => {
    setProject(null)
    setProjectDescription("")
    setCurrentState("setup")
    setTimeRemaining(0)
    setIsTimerRunning(false)
    setTaskInput("")
    setPreviousWork("")
    setAllDraftWork("")
    setShowNextButton(false)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
    setActiveTab("current")
    setCustomDuration([20])
    setBackspaceDisabled(false)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getProgressPercentage = () => {
    if (!project) return 0
    return (project.tasks.filter((t) => t.completed).length / project.tasks.length) * 100
  }

  const getFocusColor = (focus: string) => {
    const colors = {
      research: "bg-blue-100 text-blue-800 border-blue-200",
      outline: "bg-purple-100 text-purple-800 border-purple-200",
      draft: "bg-green-100 text-green-800 border-green-200",
      edit: "bg-orange-100 text-orange-800 border-orange-200",
      review: "bg-red-100 text-red-800 border-red-200",
    }
    return colors[focus as keyof typeof colors] || "bg-gray-100 text-gray-800 border-gray-200"
  }

  const handleGoodEnough = () => {
    if (!project) return

    const updatedProject = { ...project }
    const currentTaskIndex = project.currentTaskIndex

    // Mark task as completed
    updatedProject.tasks[currentTaskIndex].completed = true
    updatedProject.tasks[currentTaskIndex].userWork = (previousWork + "\n\n" + taskInput).trim()
    updatedProject.tasks[currentTaskIndex].completedAt = new Date()
    updatedProject.tasks[currentTaskIndex].needsImprovement = false
    updatedProject.tasks[currentTaskIndex].feedback = "Marked as good enough by user"
    updatedProject.completedWork.push(taskInput)

    setProject(updatedProject)
    setShowNextButton(true)
    setShowRedoButton(false)
    setShowCreateTaskButton(false)
  }

  const handleTaskClick = (taskIndex: number) => {
    if (!project) return

    const updatedProject = { ...project }
    updatedProject.currentTaskIndex = taskIndex

    setProject(updatedProject)
    setCurrentState("working")
    setActiveTab("current")

    const selectedTask = updatedProject.tasks[taskIndex]
    setCustomDuration([selectedTask.suggestedDuration])
    startCurrentTask(updatedProject)
  }

  const handleDraftWorkChange = (newContent: string) => {
    setAllDraftWork(newContent)

    // Update all draft tasks with the new content
    if (project) {
      const updatedProject = { ...project }
      const draftTasks = updatedProject.tasks.filter((task) => task.focus === "draft" && task.completed)

      if (draftTasks.length > 0) {
        // Split content roughly equally among draft tasks
        const contentPerTask = Math.ceil(newContent.length / draftTasks.length)
        let currentIndex = 0

        draftTasks.forEach((task, index) => {
          const taskIndex = updatedProject.tasks.findIndex((t) => t.id === task.id)
          if (taskIndex !== -1) {
            const start = currentIndex
            const end = Math.min(currentIndex + contentPerTask, newContent.length)
            updatedProject.tasks[taskIndex].userWork = newContent.slice(start, end).trim()
            currentIndex = end
          }
        })

        setProject(updatedProject)
      }
    }
  }

  if (currentState === "setup") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-light text-gray-800">Writing Coach</CardTitle>
            <p className="text-gray-600 mt-2">Break your writing into manageable, guided tasks</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Describe your writing project</label>
              <Textarea
                placeholder="e.g., Write a 1500-word blog post about sustainable living practices for beginners..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="min-h-32"
              />
            </div>
            <Button
              onClick={generateTasks}
              disabled={!projectDescription.trim() || isGeneratingTasks}
              className="w-full"
              size="lg"
            >
              {isGeneratingTasks ? "Creating Your Tasks..." : "Start Writing Journey"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentState === "evaluating") {
    const currentTask = project?.tasks[project?.currentTaskIndex || 0]

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl text-center">
          <CardContent className="py-12">
            {isEvaluating ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h2 className="text-xl font-medium text-gray-800">Evaluating your progress...</h2>
                <p className="text-gray-600 mt-2">Your writing coach is reviewing your work</p>
              </>
            ) : (
              <>
                {currentTask?.needsImprovement ? (
                  <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                ) : (
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                )}
                <h2 className="text-xl font-medium text-gray-800 mb-4">
                  {currentTask?.needsImprovement ? "Let's Improve This!" : "Task Complete!"}
                </h2>
                {currentTask?.feedback && (
                  <div
                    className={`border rounded-lg p-4 mb-6 ${
                      currentTask.needsImprovement ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"
                    }`}
                  >
                    <p className={`mb-4 ${currentTask.needsImprovement ? "text-amber-800" : "text-green-800"}`}>
                      {currentTask.feedback}
                    </p>
                    {currentTask.actionablePoints && currentTask.actionablePoints.length > 0 && (
                      <div className="text-left">
                        <h4
                          className={`font-medium mb-2 ${currentTask.needsImprovement ? "text-amber-800" : "text-green-800"}`}
                        >
                          Action Items:
                        </h4>
                        <ul
                          className={`space-y-1 text-sm ${currentTask.needsImprovement ? "text-amber-700" : "text-green-700"}`}
                        >
                          {currentTask.actionablePoints.map((point, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex gap-3 justify-center flex-wrap">
                  {showRedoButton && (
                    <Button onClick={handleRedoTask} variant="outline" size="lg">
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Try Again
                    </Button>
                  )}
                  <Button onClick={handleGoodEnough} variant="outline" size="lg" className="bg-gray-50">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Good Enough
                  </Button>
                  {showCreateTaskButton && (
                    <Button onClick={handleCreateNewTask} variant="outline" size="lg" className="bg-blue-50">
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Task
                    </Button>
                  )}
                  {showNextButton && (
                    <Button onClick={handleNextStep} size="lg">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Next Step
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (currentState === "completed") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl text-center">
          <CardContent className="py-12">
            <CheckCircle className="h-20 w-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-2xl font-medium text-gray-800 mb-4">Project Complete! 🎉</h2>
            <p className="text-gray-600 mb-6">
              You've successfully completed all tasks for your writing project. Great job pushing through and making
              consistent progress!
            </p>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">Your Journey</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p>Tasks completed: {project?.tasks.filter((t) => t.completed).length}</p>
                  <p>Skips used: {project?.skipsUsed}/3</p>
                  <p>Total attempts: {project?.tasks.reduce((sum, t) => sum + (t.attempts || 0), 0)}</p>
                </div>
              </div>
              <Button onClick={resetProject} size="lg">
                Start New Project
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentTask = project?.tasks[project?.currentTaskIndex || 0]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-medium text-gray-800">Writing Coach</h1>
            <Badge variant="outline">
              Task {(project?.currentTaskIndex || 0) + 1} of {project?.tasks.length}
            </Badge>
            {currentTask?.attempts && currentTask.attempts > 1 && (
              <Badge variant="secondary">Attempt {currentTask.attempts}</Badge>
            )}
            {currentTask?.isSubtask && <Badge variant="outline">Chunk</Badge>}
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Backspace Lock</span>
              <Switch checked={backspaceDisabled} onCheckedChange={setBackspaceDisabled} />
            </div>
            <Button variant="outline" size="sm" onClick={resetProject}>
              New Project
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="current" className="flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Current Task</span>
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Progress Overview</span>
            </TabsTrigger>
            <TabsTrigger value="draft" className="flex items-center space-x-2">
              <Edit3 className="h-4 w-4" />
              <span>Full Draft</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {/* Progress */}
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                  <span className="text-sm text-gray-600">{Math.round(getProgressPercentage())}%</span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </CardContent>
            </Card>

            {/* Current Task */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-xl">{currentTask?.title}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">{currentTask?.focus}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Auto-backspace warning for draft tasks */}
                {currentTask?.focus === "draft" && backspaceDisabled && !currentTask.userWork && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-amber-800 font-medium">Quick Draft Mode Activated</p>
                        <p className="text-amber-700 text-sm">
                          Backspace is disabled to encourage fast, unedited writing. Focus on getting ideas down!
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start space-x-2">
                    <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-blue-800">
                      <p className="whitespace-pre-wrap">{currentTask?.description}</p>
                    </div>
                  </div>
                </div>

                {/* Duration Control */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">Task Duration</span>
                    <span className="text-sm text-gray-600">Suggested: {currentTask?.suggestedDuration}min</span>
                  </div>
                  <div className="space-y-3">
                    <Slider
                      value={customDuration}
                      onValueChange={setCustomDuration}
                      max={60}
                      min={5}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>5min</span>
                      <span className="font-medium">{customDuration[0]}min selected</span>
                      <span>60min</span>
                    </div>
                    {customDuration[0] !== currentTask?.duration && (
                      <div className="space-y-2">
                        <Button
                          onClick={updateTaskDuration}
                          size="sm"
                          variant="outline"
                          className="w-full bg-transparent"
                        >
                          {customDuration[0] < (currentTask?.suggestedDuration || 20)
                            ? "Break into Smaller Chunks"
                            : "Update Duration"}
                        </Button>
                        {customDuration[0] < (currentTask?.suggestedDuration || 20) && (
                          <p className="text-xs text-gray-600">
                            This will break the task into{" "}
                            {Math.ceil((currentTask?.suggestedDuration || 20) / customDuration[0])} smaller chunks
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Timer */}
                <div className="flex items-center justify-center space-x-4 py-4">
                  <div className="text-center">
                    <div className="text-4xl font-mono font-bold text-gray-800 mb-2">{formatTime(timeRemaining)}</div>
                    <div className="flex items-center justify-center space-x-2">
                      <Button variant="outline" size="sm" onClick={pauseTimer} disabled={timeRemaining === 0}>
                        {isTimerRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={skipTask} disabled={(project?.skipsUsed || 0) >= 3}>
                        <SkipForward className="h-4 w-4" />
                        Skip ({3 - (project?.skipsUsed || 0)} left)
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleCompleteEarly}
                        disabled={timeRemaining === 0}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Complete Early
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Work Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Your work for this task:</label>
                  <Textarea
                    placeholder="Start writing here... Focus on progress, not perfection!"
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    className="min-h-48"
                    disabled={!isTimerRunning && timeRemaining > 0}
                  />
                  {backspaceDisabled && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Backspace is disabled - write fast, edit slow!</p>
                  )}
                </div>

                {timeRemaining === 0 && (
                  <Button onClick={evaluateProgress} className="w-full" size="lg">
                    Submit Progress for Review
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Writing Progress</span>
                </CardTitle>
                <p className="text-gray-600">Track your completed tasks and overall progress</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {project?.tasks.map((task, index) => (
                    <div
                      key={task.id}
                      onClick={() => handleTaskClick(index)}
                      className={`border rounded-lg p-4 transition-all cursor-pointer hover:shadow-md ${
                        task.completed
                          ? "bg-green-50 border-green-200 hover:bg-green-100"
                          : task.needsImprovement
                            ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                            : index === project.currentTaskIndex
                              ? "bg-blue-50 border-blue-200 hover:bg-blue-100"
                              : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          {task.completed ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : task.needsImprovement ? (
                            <AlertCircle className="h-5 w-5 text-amber-600" />
                          ) : index === project.currentTaskIndex ? (
                            <Clock className="h-5 w-5 text-blue-600" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                          )}
                          <h3 className="font-medium text-gray-800">{task.title}</h3>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge className={`text-xs ${getFocusColor(task.focus)}`}>{task.focus}</Badge>
                          <span className="text-xs text-gray-500">{task.duration}min</span>
                          {task.attempts && task.attempts > 1 && (
                            <Badge variant="outline" className="text-xs">
                              {task.attempts} attempts
                            </Badge>
                          )}
                          {task.isSubtask && (
                            <Badge variant="outline" className="text-xs">
                              chunk
                            </Badge>
                          )}
                        </div>
                      </div>

                      {task.feedback && (
                        <div
                          className={`mt-3 p-3 bg-white rounded border ${
                            task.needsImprovement ? "border-amber-200" : "border-green-200"
                          }`}
                        >
                          <p className={`text-sm mb-2 ${task.needsImprovement ? "text-amber-800" : "text-green-800"}`}>
                            <strong>Coach Feedback:</strong> {task.feedback}
                          </p>
                          {task.completedAt && (
                            <p className="text-xs text-gray-500">Completed: {task.completedAt.toLocaleString()}</p>
                          )}
                        </div>
                      )}

                      {task.userWork && (
                        <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Your Work:</strong>
                          </p>
                          <p className="text-sm text-gray-800 line-clamp-3">
                            {task.userWork.length > 150 ? `${task.userWork.substring(0, 150)}...` : task.userWork}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="draft" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Edit3 className="h-5 w-5" />
                  <span>Complete Draft</span>
                </CardTitle>
                <p className="text-gray-600">View and edit all your draft content in one place</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your complete draft ({allDraftWork.split(" ").filter((word) => word.length > 0).length} words):
                    </label>
                    <Textarea
                      placeholder="Your draft content will appear here as you complete draft tasks..."
                      value={allDraftWork}
                      onChange={(e) => handleDraftWorkChange(e.target.value)}
                      className="min-h-96"
                    />
                  </div>
                  {allDraftWork && (
                    <div className="text-sm text-gray-600">
                      <p>
                        This view combines all your completed draft tasks. Edit freely - changes will be saved to your
                        individual draft tasks.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
