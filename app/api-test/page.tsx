"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function APITestPage() {
  const [points, setPoints] = useState("First point\nSecond point\nThird point")
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAPI = async () => {
    setLoading(true)
    setResult(null)

    try {
      const pointsArray = points
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)

      const response = await fetch("/api/threader", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ points: pointsArray }),
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unknown error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Threader API Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Enter points (one per line):
              </label>
              <Textarea
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                rows={6}
                placeholder="First point&#10;Second point&#10;Third point"
              />
            </div>
            <Button onClick={testAPI} disabled={loading}>
              {loading ? "Testing..." : "Test API"}
            </Button>
          </CardContent>
        </Card>

        {result && (
          <>
            {result.error ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-red-600">{result.error}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>Expansion Comparison</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.all_points?.map((original: string, i: number) => {
                      const expanded = result.expanded_points?.[i]
                      const changed = original !== expanded
                      return (
                        <div
                          key={i}
                          className={`p-3 rounded border ${
                            changed ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <div className="text-xs text-gray-500 mb-1">Point {i + 1}</div>
                          <div className="font-medium mb-1">Original: {original}</div>
                          {expanded && (
                            <div className={changed ? "text-green-700" : "text-gray-600"}>
                              Expanded: {expanded}
                              {changed && (
                                <span className="ml-2 text-xs bg-green-200 px-2 py-1 rounded">
                                  ✓ Changed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {result.best_ordering && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Best Ordering with Bridges</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {result.best_ordering.ordered_points?.map(
                          (point: string, i: number) => (
                            <div key={i}>
                              <div className="font-medium mb-1">
                                {i + 1}. {point}
                              </div>
                              {i < result.best_ordering.bridges.length && (
                                <div className="text-sm italic text-blue-600 ml-4">
                                  → {result.best_ordering.bridges[i]}
                                </div>
                              )}
                            </div>
                          ),
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Full API Response (JSON)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

