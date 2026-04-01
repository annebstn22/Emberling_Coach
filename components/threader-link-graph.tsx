"use client"

import * as React from "react"

type ThreaderLinkGraphProps = {
  linkScores: number[]
  /** standalone = full threader page; embedded = coach card (tighter) */
  variant?: "standalone" | "embedded"
}

/**
 * Path graph: numbered nodes in suggested order; horizontal gaps between nodes reflect
 * transition strength (shorter gap = stronger link in the blend matrix). Matches Threader
 * palette (--blue, --border2, --ink, --muted).
 */
const ThreaderLinkGraph: React.FC<ThreaderLinkGraphProps> = ({
  linkScores,
  variant = "standalone",
}) => {
  if (linkScores.length === 0) return null

  const R = variant === "embedded" ? 16 : 20
  const padX = variant === "embedded" ? 12 : 20
  const padY = variant === "embedded" ? 10 : 14
  const minGap = variant === "embedded" ? 18 : 28
  const maxGap = variant === "embedded" ? 72 : 108

  const minS = Math.min(...linkScores)
  const maxS = Math.max(...linkScores)
  const span = maxS - minS || 1

  const gaps = linkScores.map((s) => {
    const norm = (s - minS) / span
    return minGap + (1 - norm) * (maxGap - minGap)
  })

  const centersX: number[] = [padX + R]
  for (let i = 0; i < gaps.length; i++) {
    centersX.push(centersX[i] + 2 * R + gaps[i])
  }

  const width = centersX[centersX.length - 1] + R + padX
  const cy = padY + R
  const height = cy + R + padY + (variant === "embedded" ? 22 : 28)

  const strongestIdx = linkScores.indexOf(maxS)

  return (
    <div
      className={
        variant === "embedded"
          ? "mt-2 pt-2 border-t border-[#e0dbd0] bg-[#faf8f4]"
          : "mt-0 pt-4 border-t border-gray-200 bg-[#faf8f4]/90"
      }
    >
      <p
        className={
          variant === "embedded"
            ? "font-mono text-[0.54rem] uppercase tracking-[0.1em] text-[#9a948a] mb-2 px-1"
            : "font-mono text-[0.65rem] uppercase tracking-[0.12em] text-gray-500 mb-3"
        }
        style={variant === "standalone" ? { color: "var(--muted)" } : undefined}
      >
        Link strength along this order
      </p>
      <div className="overflow-x-auto pb-1">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMinYMid meet"
          className="block min-w-[280px]"
          aria-hidden
        >
          {linkScores.map((_, i) => {
            const x0 = centersX[i] + R
            const x1 = centersX[i + 1] - R
            const y = cy
            const isStrongest = i === strongestIdx && linkScores.length > 1
            return (
              <line
                key={`e-${i}`}
                x1={x0}
                y1={y}
                x2={x1}
                y2={y}
                stroke={isStrongest ? "#1a4a6e" : "#c8c2b4"}
                strokeWidth={isStrongest ? 2.75 : 1.35}
                strokeLinecap="round"
              />
            )
          })}
          {centersX.map((cx, i) => (
            <g key={`n-${i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={R}
                fill="#fff"
                stroke="#a8c8e8"
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                className="select-none"
                style={{
                  fontFamily: "var(--font-mono), Inconsolata, monospace",
                  fontSize: variant === "embedded" ? 11 : 13,
                  fill: "#1a4a6e",
                  fontWeight: 500,
                }}
              >
                {i + 1}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p
        className={
          variant === "embedded"
            ? "font-serif italic text-[0.65rem] text-[#9a948a] mt-1 px-1 leading-snug"
            : "text-xs italic text-gray-500 mt-2 font-serif leading-snug"
        }
      >
        Shorter lines mean the model sees a stronger transition; longer lines mean a weaker
        link between those two beats.
        {linkScores.length > 1 && (
          <span className="text-[#1a4a6e] not-italic font-mono text-[0.6rem] ml-1">
            (thickest stroke = tightest pair)
          </span>
        )}
      </p>
    </div>
  )
}

export default ThreaderLinkGraph
