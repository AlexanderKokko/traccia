/**
 * Weekly synthesis — shared by both backends.
 *
 * The hosted app called an LLM with an empathetic, explicitly non-diagnostic prompt
 * and a `{headline, summary}` schema. With no model wired up we derive the same shape
 * from the data itself: real numbers, the same warm non-clinical register, and nothing
 * asserted that the entries do not show. Nothing leaves the device.
 *
 * To use a real model, replace this function — and put the call behind a Supabase Edge
 * Function so the provider API key never reaches the browser, and so diary content is
 * only sent onward deliberately.
 */
export async function composeWeeklySummary({ payload, lang = 'it' }) {
  await new Promise((r) => setTimeout(r, 900))
  const days = payload || []
  const en = lang === 'en'
  if (days.length < 2) throw new Error('not enough data')

  const avg = (key) => {
    const vals = days.map((d) => d[key]).filter((v) => v != null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  const pain = avg('dolore')
  const energy = avg('energia')
  const sleep = avg('sonno_ore')
  const mood = avg('umore')

  const withBoth = days.filter((d) => d.dolore != null && d.energia != null)
  const inverse =
    withBoth.length >= 3 &&
    withBoth.filter((d) => d.dolore > (pain ?? 0) && d.energia < (energy ?? 0)).length >=
      Math.ceil(withBoth.length / 3)

  const first = days[0]
  const last = days[days.length - 1]
  const painTrend =
    first?.dolore != null && last?.dolore != null ? last.dolore - first.dolore : null

  const headline = en
    ? days.length >= 6
      ? 'A steady week of tracking'
      : 'A few days, gently noted'
    : days.length >= 6
      ? 'Una settimana seguita con costanza'
      : 'Qualche giorno, annotato con cura'

  const parts = []
  parts.push(
    en
      ? `You logged ${days.length} ${days.length === 1 ? 'day' : 'days'} this week.`
      : `Hai registrato ${days.length} ${days.length === 1 ? 'giorno' : 'giorni'} questa settimana.`
  )

  if (pain != null) {
    parts.push(
      en
        ? `Pain sat around ${pain.toFixed(1)}/10 on average${
            painTrend != null && Math.abs(painTrend) >= 1
              ? painTrend < 0
                ? ', easing towards the end of the week'
                : ', climbing a little towards the end of the week'
              : ''
          }.`
        : `Il dolore si è mantenuto intorno a ${pain.toFixed(1)}/10 in media${
            painTrend != null && Math.abs(painTrend) >= 1
              ? painTrend < 0
                ? ', in calo verso fine settimana'
                : ', in leggera salita verso fine settimana'
              : ''
          }.`
    )
  }

  if (inverse) {
    parts.push(
      en
        ? 'Energy tended to dip on the days when pain was higher.'
        : "L'energia tendeva a calare nelle giornate con più dolore."
    )
  } else if (energy != null) {
    parts.push(
      en
        ? `Energy averaged ${energy.toFixed(1)}/10.`
        : `L'energia è stata in media ${energy.toFixed(1)}/10.`
    )
  }

  if (sleep != null) {
    parts.push(
      en
        ? `You slept about ${sleep.toFixed(1)} hours a night.`
        : `Hai dormito circa ${sleep.toFixed(1)} ore a notte.`
    )
  }

  if (mood != null && mood >= 3.5) {
    parts.push(en ? 'Mood held up well.' : "L'umore ha retto bene.")
  }

  parts.push(
    en
      ? 'Keeping the diary this consistently is real effort — it is what makes these patterns visible at all.'
      : 'Tenere il diario con questa costanza è un impegno vero: è ciò che rende visibili questi andamenti.'
  )

  return { headline, summary: parts.join(' ') }
}
