import { getBadgeStyle } from '@/lib/conditions'

/**
 * Reference-range badge. It only ever shows a public reference range label —
 * never an interpretation of the user's value.
 */
export default function RefBadge({ badge }) {
  if (!badge) return null
  const style = getBadgeStyle(badge.level)
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-600 font-mono-data whitespace-nowrap"
      style={style}
    >
      {badge.label}
    </span>
  )
}
