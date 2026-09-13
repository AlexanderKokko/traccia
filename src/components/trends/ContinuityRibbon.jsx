import { useState } from 'react'
import { t } from '@/lib/translations'
import { formatShortDate } from '@/lib/dateUtils'
import { getCondition } from '@/lib/conditions'
import { useChartTheme } from '@/lib/useChartTheme'

const DAY_WIDTH = 36
const BASELINE = 34
const HEIGHT = 150
const PAIN_SPAN = 64

/** Catmull-Rom-style smoothing through the daily points. */
function splinePath(points) {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i - 1] || points[i]
    const curr = points[i]
    const next = points[i + 1]
    const after = points[i + 2] || next
    const c1x = curr.x + (next.x - prev.x) / 6
    const c1y = curr.y + (next.y - prev.y) / 6
    const c2x = next.x - (after.x - curr.x) / 6
    const c2y = next.y - (after.y - curr.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`
  }
  return d
}

/** Days with no entry — same value the legend swatch uses, so the two agree. */
const NO_ENTRY_COLOR = '#DDE3DF'

export default function ContinuityRibbon({ days, lang }) {
  const [hovered, setHovered] = useState(null)
  const chart = useChartTheme()
  const noneLabel = t('none_of_these', lang)

  const points = days.map((day, i) => {
    const hasPain = day.entry && day.entry.pain != null
    return {
      x: i * DAY_WIDTH + DAY_WIDTH / 2,
      y: hasPain ? BASELINE + (day.entry.pain / 10) * PAIN_SPAN : BASELINE,
      day,
      hasPain,
      pain: day.entry?.pain,
    }
  })

  const path = splinePath(points)
  const width = Math.max(days.length * DAY_WIDTH, 1)

  const modulesInPeriod = [
    ...new Set(days.filter((d) => d.entry && d.entry.module !== 'base').map((d) => d.entry.module)),
  ]

  const colorOf = (p) => (p.day.entry ? p.day.color || '#7A8B85' : NO_ENTRY_COLOR)

  return (
    <div>
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: HEIGHT }}
        >
          <defs>
            <linearGradient id="ribbonGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              {points.map((p, i) => (
                <stop
                  key={i}
                  offset={`${(i / Math.max(1, days.length - 1)) * 100}%`}
                  stopColor={colorOf(p)}
                />
              ))}
            </linearGradient>
          </defs>

          <line x1="0" y1={BASELINE} x2={width} y2={BASELINE} stroke={chart.grid} strokeWidth="1" />
          <path
            d={path}
            fill="none"
            stroke="url(#ribbonGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p, i) => {
            const r = 3.5 + (p.hasPain ? (p.pain / 10) * 3.5 : 0)
            const flagged = p.day.entry?.alarm_symptoms?.some((s) => s !== noneLabel)
            return (
              <g key={i}>
                {flagged && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={r + 3.5}
                    fill="none"
                    stroke="#C56B6B"
                    strokeWidth="1.5"
                    opacity="0.7"
                  />
                )}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={r}
                  fill={colorOf(p)}
                  stroke={chart.dotStroke}
                  strokeWidth="1.5"
                />
              </g>
            )
          })}
        </svg>

        <div className="absolute inset-0 flex">
          {days.map((day, i) => {
            const top = Math.max((points[i].y / HEIGHT) * 100 - 2, 6)
            const condition = day.entry ? getCondition(day.entry.module, lang) : null
            return (
              <div
                key={i}
                className="relative flex-1 h-full"
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {hovered === i && (
                  <div
                    className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-full px-2.5 py-1.5 rounded-lg bg-ink text-white text-[11px] leading-tight shadow-lg whitespace-nowrap"
                    style={{ left: '50%', top: `${top}%` }}
                  >
                    <div className="font-600">{formatShortDate(day.date, lang)}</div>
                    {condition && (
                      <div className="opacity-80">
                        {condition.emoji} {condition.label}
                      </div>
                    )}
                    <div className="opacity-90">
                      {day.entry
                        ? day.entry.pain != null
                          ? `${t('pain', lang)}: ${day.entry.pain}/10`
                          : t('continuity_no_pain', lang)
                        : t('no_entry', lang)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mt-4">
        {modulesInPeriod.map((key) => {
          const condition = getCondition(key, lang)
          if (!condition) return null
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: condition.color }} />
              <span className="text-[11.5px] text-ink/55">
                {condition.emoji} {condition.label}
              </span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NO_ENTRY_COLOR }} />
          <span className="text-[11.5px] text-ink/55">{t('no_entry', lang)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border-2 border-[#C56B6B] bg-transparent" />
          <span className="text-[11.5px] text-ink/55">{t('continuity_alarm_legend', lang)}</span>
        </div>
      </div>
    </div>
  )
}
