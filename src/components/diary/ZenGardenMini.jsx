import { useEffect, useState } from 'react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { t } from '@/lib/translations'
import { computeStreak } from '@/lib/dateUtils'

/**
 * Compact procedural garden. The logging streak decides how many stems grow,
 * how tall they are, and (from 14 days) whether they flower.
 *
 * `variant="header"` renders a 36px pill; `variant="greeting"` a 92px scene
 * with the streak number beneath it.
 */
export default function ZenGardenMini({ variant = 'header' }) {
  const { lang } = useLanguage()
  const [streak, setStreak] = useState(0)

  useEffect(() => {
    db.entities.DiaryEntry.list('-entry_date', 400)
      .then((entries) => setStreak(computeStreak(entries)))
      .catch(() => setStreak(0))
  }, [])

  const tier = streak >= 14 ? 3 : streak >= 7 ? 2 : streak >= 3 ? 1 : streak >= 1 ? 0 : -1
  const big = variant === 'greeting'

  const width = big ? 92 : 44
  const height = big ? 46 : 22
  const pad = big ? 12 : 6

  const stemCount = streak === 0 ? 0 : Math.min(streak, big ? 6 : 5)
  const positions =
    stemCount === 1
      ? [width / 2]
      : Array.from({ length: stemCount }).map(
          (_, i) => pad + (i * (width - pad * 2)) / (stemCount - 1)
        )

  const stemHeight = (big ? 14 : 7) + Math.min(streak, 12) * (big ? 2.2 : 1)
  const leafRx = big ? 6 : 3
  const leafRy = big ? 3.2 : 1.6
  const stemWidth = big ? 2.6 : 1.4
  const flowerR = big ? 3.4 : 1.8

  const dayLabel = t(streak === 1 ? 'garden_day' : 'garden_days', lang)
  const title = tier === -1 ? t('garden_msg_0', lang) : `${streak} ${dayLabel}`

  const svg = (
    <svg
      viewBox={`0 0 ${width} ${height + 4}`}
      preserveAspectRatio="xMidYMax meet"
      className={big ? 'w-[92px] h-[54px]' : 'w-[36px] h-[22px]'}
      style={{ flexShrink: 0 }}
    >
      <path
        d={`M0 ${height} L${width} ${height}`}
        stroke="hsl(var(--garden-ground-2))"
        strokeWidth={big ? 2.5 : 2}
        strokeLinecap="round"
      />
      {tier === -1 && (
        <circle
          cx={width / 2}
          cy={height - (big ? 3 : 2)}
          r={big ? 3 : 1.8}
          fill="#8C7355"
          opacity={0.6}
        />
      )}
      {positions.map((x, i) => (
        <g key={i}>
          <path
            d={`M ${x} ${height} Q ${x - (big ? 3 : 2)} ${height - stemHeight / 2} ${x} ${height - stemHeight}`}
            stroke="#4FAF82"
            strokeWidth={stemWidth}
            fill="none"
            strokeLinecap="round"
          />
          <ellipse
            cx={x - (big ? 5 : 3)}
            cy={height - stemHeight * 0.5}
            rx={leafRx}
            ry={leafRy}
            fill="#54B88E"
            transform={`rotate(-26 ${x - (big ? 5 : 3)} ${height - stemHeight * 0.5})`}
          />
          <ellipse
            cx={x + (big ? 5 : 3)}
            cy={height - stemHeight * 0.7}
            rx={leafRx}
            ry={leafRy}
            fill="#4FAF82"
            transform={`rotate(26 ${x + (big ? 5 : 3)} ${height - stemHeight * 0.7})`}
          />
          {tier >= 3 && <circle cx={x} cy={height - stemHeight} r={flowerR} fill="#E8B86B" />}
        </g>
      ))}
    </svg>
  )

  if (big) {
    return (
      <div className="flex flex-col items-center gap-1.5" title={title}>
        {svg}
        <div className="flex items-baseline gap-1">
          <span className="font-display text-[26px] font-700 text-brand-dark tabular-nums leading-none">
            {streak}
          </span>
          <span className="text-[11px] text-ink/45">{dayLabel}</span>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-full border border-line bg-background hover:border-brand/40 transition-colors"
      title={title}
    >
      {svg}
      <span className="font-display text-[14px] font-700 text-brand-dark tabular-nums leading-none">
        {streak}
      </span>
      <span className="text-[10px] text-ink/45 leading-none hidden sm:inline">{dayLabel}</span>
    </div>
  )
}
