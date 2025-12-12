"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArchiveRestore, Trash2, Plus, Search, Calendar, Archive, Heart, Filter } from "lucide-react"

interface MisfitIdea {
  id: string
  content: string
  notes: string
  tags: string[]
  reasonDiscarded: string
  originalSessionTitle?: string
  discardedAt: Date
  rediscoveredIn?: string
  attachedFiles?: any[]
}

const SUGGESTED_TAGS = [
  "experimental",
  "risky",
  "unconventional",
  "simplistic",
  "too-complex",
  "metaphorical",
  "absurd",
]

export default function IslandOfMisfits({ onMisfitImport }: { onMisfitImport?: (idea: MisfitIdea) => void }) {
  const [misfitIdeas, setMisfitIdeas] = useState<MisfitIdea[]>(JSON.parse(localStorage.getItem("misfit-ideas") || "[]"))
  const [showForm, setShowForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newIdea, setNewIdea] = useState({
    content: "",
    notes: "",
    tags: [] as string[],
    reasonDiscarded: "",
  })
  const [newTag, setNewTag] = useState("")

  const saveMisfits = (ideas: MisfitIdea[]) => {
    localStorage.setItem("misfit-ideas", JSON.stringify(ideas))
    setMisfitIdeas(ideas)
  }

  const addMisfitIdea = () => {
    if (!newIdea.content.trim()) return

    const idea: MisfitIdea = {
      id: Date.now().toString(),
      content: newIdea.content,
      notes: newIdea.notes,
      tags: newIdea.tags,
      reasonDiscarded: newIdea.reasonDiscarded,
      discardedAt: new Date(),
    }

    saveMisfits([...misfitIdeas, idea])
    setNewIdea({ content: "", notes: "", tags: [], reasonDiscarded: "" })
    setShowForm(false)
  }

  const removeMisfitIdea = (id: string) => {
    saveMisfits(misfitIdeas.filter((idea) => idea.id !== id))
  }

  const toggleTag = (tag: string) => {
    if (newIdea.tags.includes(tag)) {
      setNewIdea({ ...newIdea, tags: newIdea.tags.filter((t) => t !== tag) })
    } else {
      setNewIdea({ ...newIdea, tags: [...newIdea.tags, tag] })
    }
  }

  const addCustomTag = () => {
    if (newTag.trim() && !newIdea.tags.includes(newTag.trim())) {
      setNewIdea({ ...newIdea, tags: [...newIdea.tags, newTag.trim()] })
      setNewTag("")
    }
  }

  const toggleFilterTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const filteredIdeas = misfitIdeas.filter((idea) => {
    const matchesSearch =
      idea.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      idea.notes.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesTags = selectedTags.length === 0 || selectedTags.some((tag) => idea.tags.includes(tag))

    return matchesSearch && matchesTags
  })

  const allTags = Array.from(new Set(misfitIdeas.flatMap((idea) => idea.tags)))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800 flex items-center space-x-2 mb-2">
              <Archive className="h-6 w-6 text-purple-600" />
              <span>Island of Misfit Ideas</span>
            </h2>
            <p className="text-gray-600 text-sm">
              A sanctuary for ideas that didn't fit this session but might spark something brilliant later. Every great
              idea starts as a misfit.
            </p>
          </div>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Misfit
          </Button>
        </div>
      </div>

      {/* Add Misfit Idea Form */}
      {showForm && (
        <Card className="border-purple-200 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-lg">Preserve a Misfit Idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">The Idea</label>
              <Textarea
                placeholder="What's the idea that didn't make the cut this time?"
                value={newIdea.content}
                onChange={(e) => setNewIdea({ ...newIdea, content: e.target.value })}
                className="min-h-20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Why Was It Discarded?</label>
              <Input
                placeholder="e.g., Too experimental, Wrong tone for this project, Needs more development"
                value={newIdea.reasonDiscarded}
                onChange={(e) => setNewIdea({ ...newIdea, reasonDiscarded: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes & Context</label>
              <Textarea
                placeholder="Any additional context or why you think this might be useful later?"
                value={newIdea.notes}
                onChange={(e) => setNewIdea({ ...newIdea, notes: e.target.value })}
                className="min-h-16"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Tags</label>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_TAGS.map((tag) => (
                    <Badge
                      key={tag}
                      variant={newIdea.tags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-purple-200"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add custom tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && addCustomTag()}
                    className="flex-1"
                  />
                  <Button onClick={addCustomTag} variant="outline" size="sm">
                    Add
                  </Button>
                </div>
                {newIdea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newIdea.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer hover:bg-red-200"
                        onClick={() => toggleTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={addMisfitIdea}
                disabled={!newIdea.content.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                <Archive className="h-4 w-4 mr-2" />
                Save to Island
              </Button>
              <Button onClick={() => setShowForm(false)} variant="outline" className="flex-1 bg-transparent">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search misfits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
              <Filter className="h-4 w-4" />
              <span>Filter by tags:</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-purple-200"
                  onClick={() => toggleFilterTag(tag)}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Misfit Ideas Grid */}
      {filteredIdeas.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Archive className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">
              {misfitIdeas.length === 0
                ? "No misfit ideas yet. They'll appear here when you discard ideas from sessions."
                : "No ideas match your search or filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredIdeas.map((idea) => (
            <Card key={idea.id} className="hover:shadow-md transition-shadow border-purple-100">
              <CardContent className="p-6">
                <div className="mb-3">
                  <p className="font-medium text-gray-800 mb-2">{idea.content}</p>
                  {idea.reasonDiscarded && (
                    <p className="text-xs text-gray-500 italic border-l-2 border-purple-300 pl-2">
                      Discarded: {idea.reasonDiscarded}
                    </p>
                  )}
                </div>

                {idea.notes && (
                  <p className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Context:</span> {idea.notes}
                  </p>
                )}

                {idea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {idea.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                  <span className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(idea.discardedAt).toLocaleDateString()}</span>
                  </span>
                  {idea.rediscoveredIn && (
                    <span className="flex items-center space-x-1 text-green-600">
                      <Heart className="h-3 w-3" />
                      <span>Reused</span>
                    </span>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-200">
                  <Button
                    onClick={() => {
                      onMisfitImport?.(idea)
                      removeMisfitIdea(idea.id)
                    }}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-transparent hover:bg-green-50"
                  >
                    <ArchiveRestore className="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                  <Button
                    onClick={() => removeMisfitIdea(idea.id)}
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      {misfitIdeas.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">{misfitIdeas.length}</div>
                <div className="text-xs text-gray-600">Ideas Archived</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">{allTags.length}</div>
                <div className="text-xs text-gray-600">Unique Tags</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {misfitIdeas.filter((i) => i.rediscoveredIn).length}
                </div>
                <div className="text-xs text-gray-600">Reused Ideas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
