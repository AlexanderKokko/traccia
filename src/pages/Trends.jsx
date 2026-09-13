import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, Printer, CalendarCheck, StickyNote } from 'lucide-react'
import { db } from '@/api/client'
import { useLanguage } from '@/lib/LanguageContext'
import { useDataSync } from '@/lib/useDataSync'
import { t } from '@/lib/translations'
import {
  todayISO,
  subtractDays,
  formatShortDate,
  getPeriodDays,
  getPeriodLabel,
} from '@/lib/dateUtils'
import { getCondition } from '@/lib/conditions'
import { useChartTheme } from '@/lib/useChartTheme'
import { buildReportHtml } from '@/lib/printReport'
import { toast } from '@/components/ui/toast-bus'
import WeeklyAISummary from '@/components/trends/WeeklyAISummary'
import ContinuityRibbon from '@/components/trends/ContinuityRibbon'

export default function Trends() {
  const { lang } = useLanguage()
  const chart = useChartTheme()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7g')
  const [lifestyleModule, setLifestyleModule] = useState(null)

  const load = useCallback(() => {
    db.entities.DiaryEntry.list('-entry_date', 200)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])
  useDataSync(load)

  const conditionOf = (key) => getCondition(key, lang)

  const days = getPeriodDays(period)
  const today = todayISO()
  const periodStart = subtractDays(today, days - 1)
  const prevStart = subtractDays(periodStart, days)
  const prevEnd = subtractDays(periodStart, 1)

  const inRange = (date, from, to) => date >= from && date <= to
  const current = entries.filter((e) => inRange(e.entry_date, periodStart, today))
  const previous = entries.filter((e) => inRange(e.entry_date, prevStart, prevEnd))

  const average = (rows, key) => {
    const values = rows.map((r) => r[key]).filter((v) => v != null)
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }

  const delta = (curr, prev) =>
    curr == null || prev == null || prev === 0 ? null : ((curr - prev) / prev) * 100

  /** `value` is already oriented so that positive = worse. */
  const trendOf = (value) => {
    // `null` means there is no comparable previous period — not "no change".
    // Without this guard `-null` coerces to -0 and renders a misleading "0%".
    if (value == null || Number.isNaN(value)) return null
    if (Math.abs(value) < 5) {
      return { icon: Minus, color: '#7A8B85', label: lang === 'it' ? 'stabile' : 'stable' }
    }
    return value > 0
      ? { icon: TrendingUp, color: '#C56B6B', label: lang === 'it' ? 'peggioramento' : 'worse' }
      : { icon: TrendingDown, color: '#3B9A6E', label: lang === 'it' ? 'miglioramento' : 'better' }
  }

  const recentNotes = entries.filter((e) => e.notes).slice(0, 5)

  const painSeries = [...current].reverse().map((e) => ({
    date: formatShortDate(e.entry_date, lang),
    dolore: e.pain,
    color: conditionOf(e.module)?.color || '#7A8B85',
  }))
  const energySeries = [...current]
    .reverse()
    .map((e) => ({ date: formatShortDate(e.entry_date, lang), energia: e.energy }))
  const sleepSeries = [...current]
    .reverse()
    .map((e) => ({ date: formatShortDate(e.entry_date, lang), sonno: e.sleep_hours }))
  const moodSeries = [...current]
    .reverse()
    .map((e) => ({ date: formatShortDate(e.entry_date, lang), umore: e.mood }))

  const usedModules = [...new Set(entries.map((e) => e.module))].filter((m) => m !== 'base')
  const mostRecentModule = entries.find((e) => e.module !== 'base')?.module
  const lifestyleKey = lifestyleModule || mostRecentModule
  const lifestyleCondition = lifestyleKey ? conditionOf(lifestyleKey) : null

  const ribbonDays = []
  for (let i = days - 1; i >= 0; i--) {
    const date = subtractDays(today, i)
    const entry = entries.find((e) => e.entry_date === date)
    ribbonDays.push({
      date,
      entry,
      color: entry ? conditionOf(entry.module)?.color || '#7A8B85' : null,
    })
  }

  const painNow = average(current, 'pain')
  const painPrev = average(previous, 'pain')
  const painDelta = delta(painNow, painPrev)
  const painRising = painDelta != null && painDelta > 15

  /** Picks the module-specific series worth charting for a condition. */
  const moduleSeries = (key) => {
    const condition = conditionOf(key)
    if (!condition) return null
    const field = condition.trendField
      ? condition.fields.find((f) => f.key === condition.trendField.key)
      : condition.fields.find((f) => f.type === 'number' || f.type === 'slider')
    if (!field) return null

    return {
      key: field.key,
      label: condition.trendField?.label || field.label,
      color: condition.color,
      data: entries
        .filter((e) => e.module === key && e.module_data?.[field.key] != null)
        .reverse()
        .map((e) => ({
          date: formatShortDate(e.entry_date, lang),
          value: e.module_data[field.key],
        })),
    }
  }

  const exportReport = async () => {
    const [appointments, therapies] = await Promise.all([
      db.entities.Appointment.list().catch(() => []),
      db.entities.Therapy.list().catch(() => []),
    ])
    const html = buildReportHtml(
      [...entries].reverse(),
      appointments,
      therapies,
      periodStart,
      today,
      lang
    )
    const win = window.open('', '_blank')
    if (!win) {
      toast({
        variant: 'destructive',
        title: lang === 'it' ? 'Report bloccato' : 'Report blocked',
        description:
          lang === 'it'
            ? 'Il browser ha bloccato la finestra. Consenti i popup per questo sito e riprova.'
            : 'Your browser blocked the window. Allow pop-ups for this site and try again.',
      })
      return
    }
    win.document.write(html)
    win.document.close()
    setTimeout(() => win.print(), 300)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner" />
      </div>
    )
  }

  const metrics = [
    { label: t('pain', lang), curr: painNow, prev: painPrev, lowerIsBetter: true },
    {
      label: t('trend_energy', lang),
      curr: average(current, 'energy'),
      prev: average(previous, 'energy'),
      lowerIsBetter: false,
    },
    {
      label: t('trend_sleep', lang),
      curr: average(current, 'sleep_hours'),
      prev: average(previous, 'sleep_hours'),
      lowerIsBetter: false,
    },
  ]

  const smallCharts = [
    {
      title: t('trend_energy', lang),
      data: energySeries,
      key: 'energia',
      color: '#B8863B',
      domain: [0, 10],
    },
    {
      title: t('trend_sleep', lang),
      data: sleepSeries,
      key: 'sonno',
      color: '#4A6FA5',
      domain: [0, 12],
    },
    {
      title: t('trend_mood', lang),
      data: moodSeries,
      key: 'umore',
      color: '#8A5A8A',
      domain: [0, 5],
    },
  ].filter((series) => series.data.some((row) => row[series.key] != null))

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[28px] sm:text-[34px] font-600 text-ink leading-[1.12] tracking-tight">
            {t('trends_title', lang)}
          </h1>
          <p className="text-ink/55 text-[14px] mt-1.5">{t('trends_subtitle', lang)}</p>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input-float !w-auto !h-10 !text-[13px] font-500"
          >
            <option value="7g">{t('last_7', lang)}</option>
            <option value="14g">{t('last_14', lang)}</option>
            <option value="30g">{t('last_30', lang)}</option>
            <option value="90g">{t('last_90', lang)}</option>
          </select>
          <button onClick={exportReport} className="btn-primary">
            <Printer className="w-4 h-4" strokeWidth={2} />
            <span className="hidden sm:inline">
              {lang === 'it' ? 'Esporta report' : 'Export report'}
            </span>
          </button>
        </div>
      </div>

      {painRising && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 mb-5 flex items-start gap-2.5 amber-soft"
          style={{ border: '1px solid #B8863B30' }}
        >
          <TrendingUp
            className="w-[18px] h-[18px] text-[#B8863B] shrink-0 mt-0.5"
            strokeWidth={2}
          />
          <p className="text-[13px] text-[#7A5623] leading-relaxed">
            {t('pain_increase_warning', lang)}
          </p>
        </motion.div>
      )}

      <div className="card-float p-5 sm:p-6 mb-5">
        <h2 className="font-display text-[18px] font-600 text-ink mb-1.5">
          {t('how_are_you_doing', lang)}
        </h2>
        <p className="text-[12px] text-ink/45 mb-5 leading-relaxed">
          {getPeriodLabel(period, lang)} {t('comparison_note', lang)}
        </p>

        <div className="grid sm:grid-cols-3 gap-3">
          {metrics.map((metric) => {
            const change = delta(metric.curr, metric.prev)
            const trend = change == null ? null : trendOf(metric.lowerIsBetter ? -change : change)
            const Icon = trend?.icon
            return (
              <div key={metric.label} className="card-inner p-4">
                <p className="text-[12.5px] text-ink/50 mb-1.5">{metric.label}</p>
                {metric.curr != null ? (
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-[28px] font-700 text-ink tabular-nums leading-none">
                      {metric.curr.toFixed(1)}
                    </span>
                    {trend && (
                      <span
                        className="flex items-center gap-1 text-[12px] font-500"
                        style={{ color: trend.color }}
                      >
                        <Icon className="w-3.5 h-3.5" strokeWidth={2.4} />
                        {Math.abs(change).toFixed(0)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-ink/40 italic">{t('need_more_days', lang)}</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <WeeklyAISummary entries={entries} />

      {painSeries.length > 0 && painSeries.some((p) => p.dolore != null) && (
        <div className="card-float p-5 sm:p-6 mb-5">
          <h2 className="font-display text-[17px] font-600 text-ink mb-4">
            {t('pain_line', lang)}
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={painSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 11, fill: chart.tick }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip contentStyle={chart.tooltip} />
              <Line
                type="monotone"
                dataKey="dolore"
                stroke="#4FAF82"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#4FAF82' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {smallCharts.length > 0 && (
        <div className="grid sm:grid-cols-3 gap-4 mb-5">
          {smallCharts.map((small) => (
            <div key={small.key} className="card-float p-5">
              <h2 className="font-display text-[14px] font-600 text-ink mb-3">{small.title}</h2>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={small.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={small.domain}
                    tick={{ fontSize: 10, fill: chart.tick }}
                    axisLine={false}
                    tickLine={false}
                    width={24}
                  />
                  <Tooltip contentStyle={{ ...chart.tooltip, fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey={small.key}
                    stroke={small.color}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: small.color }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      )}

      {usedModules.map((key) => {
        const series = moduleSeries(key)
        if (!series || series.data.length === 0) return null
        const condition = conditionOf(key)
        return (
          <div key={key} className="card-float p-5 sm:p-6 mb-5">
            <h2 className="font-display text-[16px] font-600 text-ink mb-4 flex items-center gap-2">
              <span className="text-[18px]">{condition.emoji}</span> {t('trend_for', lang)}{' '}
              {condition.label} — {series.label}
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={series.data}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: chart.tick }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: chart.tick }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip contentStyle={chart.tooltip} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={series.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: series.color }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}

      <div className="card-float p-5 sm:p-6 mb-5">
        <h2 className="font-display text-[16px] font-600 text-ink mb-3 flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-brand" strokeWidth={2} />{' '}
          {t('continuity_title', lang)}
        </h2>
        <ContinuityRibbon days={ribbonDays} lang={lang} />
      </div>

      {recentNotes.length > 0 && (
        <div className="card-float p-5 sm:p-6 mb-5">
          <h2 className="font-display text-[16px] font-600 text-ink mb-3 flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-brand" strokeWidth={2} /> {t('recent_notes', lang)}
          </h2>
          <div className="space-y-3">
            {recentNotes.map((note) => (
              <div key={note.id} className="border-l-2 border-brand/30 pl-3.5">
                <p className="text-[11px] text-ink/45 font-mono-data mb-0.5">
                  {formatShortDate(note.entry_date, lang)}
                </p>
                <p className="text-[13px] text-ink-soft leading-relaxed">{note.notes}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lifestyleCondition && (
        <div className="card-float p-5 sm:p-6 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[18px]">{lifestyleCondition.emoji}</span>
            <h2 className="font-display text-[16px] font-600 text-ink">
              {t('lifestyle_title', lang)} — {lifestyleCondition.label}
            </h2>
          </div>

          {usedModules.length > 1 && (
            <select
              value={lifestyleModule || ''}
              onChange={(e) => setLifestyleModule(e.target.value || null)}
              className="input-float !w-auto !h-10 !text-[13px] mb-4"
            >
              <option value="">{t('most_recent_module', lang)}</option>
              {usedModules.map((key) => (
                <option key={key} value={key}>
                  {conditionOf(key)?.emoji} {conditionOf(key)?.label}
                </option>
              ))}
            </select>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl p-4 bg-brand-soft">
              <p className="text-[13px] font-600 text-brand-dark mb-2 flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-brand text-white text-[11px]">
                  ✓
                </span>{' '}
                {t('helps', lang)}
              </p>
              <ul className="space-y-2">
                {lifestyleCondition.lifestyle.helps.map((item, i) => (
                  <li key={i} className="text-[13px] text-ink-soft leading-relaxed pl-6 relative">
                    <span className="absolute left-0 top-0 text-brand/40">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl p-4 warn-soft">
              <p className="text-[13px] font-600 text-[#8A3A45] mb-2 flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#C56B6B] text-white text-[11px]">
                  ✕
                </span>{' '}
                {t('avoid_title', lang)}
              </p>
              <ul className="space-y-2">
                {lifestyleCondition.lifestyle.avoid.map((item, i) => (
                  <li key={i} className="text-[13px] text-ink-soft leading-relaxed pl-6 relative">
                    <span className="absolute left-0 top-0 text-[#C56B6B]/40">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-ink/40 mt-3 italic leading-relaxed">
            {t('lifestyle_disclaimer', lang)}
          </p>
        </div>
      )}
    </div>
  )
}
