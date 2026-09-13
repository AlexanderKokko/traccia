import { useTheme } from 'next-themes'

/**
 * Recharts draws into SVG with literal color props, so it cannot inherit the
 * theme tokens from CSS. This resolves the grid/axis/tooltip colors for the
 * active theme in one place.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'

  return {
    dark,
    grid: dark ? 'rgba(255,255,255,0.08)' : '#EEF1F0',
    tick: dark ? '#8FA09A' : '#7A8B85',
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${dark ? 'rgba(255,255,255,0.10)' : '#EBEEEC'}`,
      backgroundColor: dark ? '#16221E' : '#FFFFFF',
      color: dark ? '#E8F1ED' : '#1A2F2A',
      fontSize: 12,
      boxShadow: dark ? '0 8px 24px -6px rgba(0,0,0,0.6)' : '0 8px 24px -6px rgba(16,24,22,0.1)',
    },
    dotStroke: dark ? '#16221E' : '#FFFFFF',
  }
}
