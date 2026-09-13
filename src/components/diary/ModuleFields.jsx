import RefBadge from '@/components/RefBadge'

/** Renders a condition's dynamic diary fields from its `fields` definition. */
export default function ModuleFields({ fields, data, onChange }) {
  const set = (key, value) => onChange({ ...data, [key]: value })

  const toggleInList = (key, option) => {
    const current = data[key] || []
    set(key, current.includes(option) ? current.filter((v) => v !== option) : [...current, option])
  }

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        if (field.showIf && data[field.showIf.field] !== field.showIf.value) return null
        const value = data[field.key]

        switch (field.type) {
          case 'slider':
            return (
              <SliderField
                key={field.key}
                field={field}
                value={value}
                onChange={(v) => set(field.key, v)}
              />
            )

          case 'select':
            return (
              <Field
                key={field.key}
                label={field.label}
                badge={field.badge ? field.badge(value, data) : null}
              >
                <select
                  value={value || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  className="input-float"
                >
                  <option value="">—</option>
                  {field.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
            )

          case 'number':
            return (
              <Field
                key={field.key}
                label={field.label}
                badge={field.badge ? field.badge(value, data) : null}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step={field.step || '1'}
                    value={value ?? ''}
                    onChange={(e) =>
                      set(field.key, e.target.value === '' ? null : parseFloat(e.target.value))
                    }
                    placeholder={field.placeholder || ''}
                    className="input-float !w-36 font-mono-data"
                  />
                  {field.unit && <span className="text-[13px] text-ink/50">{field.unit}</span>}
                </div>
              </Field>
            )

          case 'chips':
            return (
              <Field key={field.key} label={field.label}>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => {
                    const selected = (value || []).includes(opt)
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => toggleInList(field.key, opt)}
                        className="toggle-chip"
                        style={
                          selected
                            ? {
                                backgroundColor: '#4FAF82',
                                borderColor: '#4FAF82',
                                color: '#fff',
                              }
                            : undefined
                        }
                      >
                        {opt}
                      </button>
                    )
                  })}
                </div>
              </Field>
            )

          case 'checkbox':
            return (
              <Field key={field.key} label={field.label}>
                <div className="flex flex-wrap gap-4">
                  {field.options.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(value || []).includes(opt)}
                        onChange={() => toggleInList(field.key, opt)}
                        className="w-[18px] h-[18px] rounded-[5px] accent-[#4FAF82]"
                      />
                      <span className="text-[13.5px] text-ink-soft">{opt}</span>
                    </label>
                  ))}
                </div>
              </Field>
            )

          case 'text':
            return (
              <Field key={field.key} label={field.label}>
                <input
                  type="text"
                  value={value || ''}
                  onChange={(e) => set(field.key, e.target.value)}
                  placeholder={field.placeholder || ''}
                  className="input-float"
                />
              </Field>
            )

          default:
            return null
        }
      })}
    </div>
  )
}

function Field({ label, badge, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-[13px] font-500 text-ink/70">{label}</label>
        {badge && <RefBadge badge={badge} />}
      </div>
      {children}
    </div>
  )
}

function SliderField({ field, value, onChange }) {
  const current = value ?? field.min
  const pct = ((current - field.min) / (field.max - field.min)) * 100

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[13px] font-500 text-ink/70">{field.label}</label>
        <span className="font-mono-data text-[14px] font-600 text-ink tabular-nums">{current}</span>
      </div>
      <input
        type="range"
        min={field.min}
        max={field.max}
        value={current}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="traccia-slider w-full"
        style={{ background: `linear-gradient(to right, #4FAF82 ${pct}%, #EBEEEC ${pct}%)` }}
      />
    </div>
  )
}
