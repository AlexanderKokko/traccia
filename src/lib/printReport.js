import { formatShortDate } from './dateUtils'
import { getCondition, getSpecialists } from './conditions'

/** The report shows the specialist's localized name, not the raw enum key. */
function specialistLabel(key, lang) {
  return getSpecialists(lang)[key] || key
}

/**
 * Escapes everything that reaches the report from user input. Diary notes,
 * medication names and free-text module answers are typed by the user and are
 * interpolated straight into this HTML document, so they must never be able to
 * close a tag or open a <script>.
 */
function esc(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Builds the printable report handed to the doctor. Self-contained HTML — it is
 * opened in a new window and printed, so it carries its own styles.
 */
export function buildReportHtml(entries, appointments, therapies, from, to, lang = 'it') {
  const en = lang === 'en'
  const noneLabel = en ? 'None of these' : 'Nessuno di questi'

  const entryRows = entries
    .map((entry) => {
      const condition = getCondition(entry.module, lang)
      const flag = entry.alarm_symptoms?.some((s) => s !== noneLabel) ? ' ⚠️' : ''
      const moduleLabel = condition ? `${condition.emoji} ${condition.label}` : 'Base'

      let detail = ''
      if (condition && entry.module_data) {
        const rows = condition.fields
          .filter((f) => {
            const v = entry.module_data[f.key]
            return v != null && v !== '' && !(Array.isArray(v) && v.length === 0)
          })
          .map((f) => {
            const v = entry.module_data[f.key]
            return `<tr><td style="color:#6B7C76">${esc(f.label)}</td><td>${esc(
              Array.isArray(v) ? v.join(', ') : v
            )}</td></tr>`
          })
          .join('')
        if (rows) {
          detail = `<table style="margin-top:4px;font-size:11px;width:100%">${rows}</table>`
        }
      }

      const medication =
        entry.medication_taken === 'yes'
          ? en
            ? 'Yes'
            : 'Sì'
          : entry.medication_taken === 'later'
            ? en
              ? 'Later'
              : 'Più tardi'
            : entry.medication_taken === 'no'
              ? 'No'
              : '—'

      return `<tr>
      <td>${esc(formatShortDate(entry.entry_date, lang))}</td>
      <td>${esc(moduleLabel)}</td>
      <td>${esc(entry.pain ?? '—')}</td>
      <td>${esc(entry.energy ?? '—')}</td>
      <td>${esc(entry.sleep_hours ?? '—')}</td>
      <td>${esc(entry.mood ?? '—')}${flag}</td>
      <td>${esc(medication)}</td>
      <td>${esc(entry.notes || '')}</td>
    </tr>${detail ? `<tr><td colspan="8">${detail}</td></tr>` : ''}`
    })
    .join('')

  const therapyRows = therapies
    .map(
      (th) =>
        `<tr><td>${esc(th.name)}</td><td>${esc(th.dosage || '—')}</td><td>${esc(th.time || '—')}</td><td>${
          th.frequency === 'ogni_giorno'
            ? en
              ? 'Every day'
              : 'Ogni giorno'
            : th.frequency === 'settimanale'
              ? en
                ? 'Weekly'
                : 'Settimanale'
              : en
                ? 'As needed'
                : 'Al bisogno'
        }</td></tr>`
    )
    .join('')

  const appointmentRows = appointments
    .map(
      (a) =>
        `<tr><td>${esc(specialistLabel(a.specialist, lang))}</td><td>${esc(
          formatShortDate(a.appointment_date, lang)
        )}</td></tr>`
    )
    .join('')

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><title>${
    en ? 'Traccia Report' : 'Report Traccia'
  }</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #1A2F2A; max-width: 800px; margin: 0 auto; padding: 32px; }
    h1 { font-family: Georgia, serif; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #EBEEEC; padding: 6px 8px; text-align: left; font-size: 12px; }
    th { background: #F4F7F5; font-weight: 600; }
    .disclaimer { font-size: 11px; color: #7A8B85; margin-top: 24px; border-top: 1px solid #EBEEEC; padding-top: 12px; }
    .header { margin-bottom: 24px; }
  </style></head><body>
  <div class="header">
    <h1>🌿 ${en ? 'Symptom Diary Report — Traccia' : 'Report Diario Sintomi — Traccia'}</h1>
    <p style="color:#7A8B85">${en ? 'Period' : 'Periodo'}: ${formatShortDate(
      from,
      lang
    )} — ${formatShortDate(to, lang)}</p>
  </div>
  <h3>${en ? 'Current therapies' : 'Terapie in corso'}</h3>
  ${
    therapyRows
      ? `<table><tr><th>${en ? 'Medication' : 'Farmaco'}</th><th>${
          en ? 'Dosage' : 'Dosaggio'
        }</th><th>${en ? 'Time' : 'Orario'}</th><th>${
          en ? 'Frequency' : 'Frequenza'
        }</th></tr>${therapyRows}</table>`
      : `<p>${en ? 'No therapy recorded.' : 'Nessuna terapia registrata.'}</p>`
  }
  <h3>${en ? 'Upcoming scheduled check-ups' : 'Prossimi controlli programmati'}</h3>
  ${
    appointmentRows
      ? `<table><tr><th>${en ? 'Specialist' : 'Specialista'}</th><th>${
          en ? 'Date' : 'Data'
        }</th></tr>${appointmentRows}</table>`
      : `<p>${en ? 'No check-up scheduled.' : 'Nessun controllo programmato.'}</p>`
  }
  <h3>${en ? 'Day-by-day log' : 'Registro giorno per giorno'}</h3>
  <table>
    <tr><th>${en ? 'Date' : 'Data'}</th><th>${en ? 'Module' : 'Modulo'}</th><th>${
      en ? 'Pain' : 'Dolore'
    }</th><th>${en ? 'Energy' : 'Energia'}</th><th>${en ? 'Sleep' : 'Sonno'}</th><th>${
      en ? 'Mood' : 'Umore'
    }</th><th>${en ? 'Medication' : 'Farmaci'}</th><th>${en ? 'Notes' : 'Note'}</th></tr>
    ${entryRows || `<tr><td colspan="8">${en ? 'No entries.' : 'Nessuna registrazione.'}</td></tr>`}
  </table>
  <div class="disclaimer">
    ${
      en
        ? 'This document is a patient self-record generated by the Traccia app. It is not a medical report. The data reported is entered by the user and does not replace the clinical assessment of the treating doctor.'
        : "Questo documento è un'autoregistrazione del paziente generata dall'app Traccia. Non è un referto medico. I dati riportati sono inseriti dall'utente e non sostituiscono la valutazione clinica del medico curante."
    }
  </div>
  </body></html>`
}
