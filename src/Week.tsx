import { useState } from 'react'
import { addWeeks, isoWeekId, weekLabel } from './dates'
import { setGuidelines, setNotes, useGuidelines, useWeek } from './weeks'

const buttonStyle = { fontSize: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }
const smallButtonStyle = { ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.75rem' }
const textareaStyle = {
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '1rem',
  fontFamily: 'inherit',
  padding: '0.5rem',
} as const
const headingStyle = { fontSize: '1.125rem', margin: 0 }

// A text that saves when you leave it. While you type, others' changes don't overwrite it.
export function SavedText({
  label,
  value,
  onSave,
  rows = 4,
  maxLength = 5000,
  placeholder,
}: {
  label: string
  value: string
  onSave: (text: string) => void
  rows?: number
  maxLength?: number
  placeholder?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <textarea
      aria-label={label}
      placeholder={placeholder}
      value={draft ?? value}
      rows={rows}
      maxLength={maxLength}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== value) onSave(draft)
        setDraft(null)
      }}
      style={textareaStyle}
    />
  )
}

// "I'm planning the week": Guidelines, Week Notes, and the week's Menu and Recipes.
export function WeekTab() {
  const [weekId, setWeekId] = useState(() => isoWeekId(new Date()))
  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const guidelines = useGuidelines()
  const week = useWeek(weekId)

  return (
    <>
      <button
        onClick={() => setGuidelinesOpen(!guidelinesOpen)}
        aria-expanded={guidelinesOpen}
        style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
      >
        Føringer
      </button>
      {guidelinesOpen && (
        <SavedText
          label="Føringer"
          placeholder="Det som gjelder hver uke: hvem som spiser, hva de ikke tåler, hvor lang tid maten kan ta."
          value={guidelines.text}
          onSave={setGuidelines}
          rows={6}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button onClick={() => setWeekId(addWeeks(weekId, -1))} aria-label="Forrige uke" style={buttonStyle}>
          ‹
        </button>
        <h2 style={{ ...headingStyle, flex: 1, textAlign: 'center' }}>{weekLabel(weekId)}</h2>
        <button onClick={() => setWeekId(addWeeks(weekId, 1))} aria-label="Neste uke" style={buttonStyle}>
          ›
        </button>
      </div>

      {week && (
        <SavedText
          key={weekId}
          label="Ukeplan"
          placeholder="Det som gjelder denne uka: gjester, hvem som er borte, hva som er i fryseren."
          value={week.notes ?? ''}
          onSave={(text) => setNotes(weekId, text)}
        />
      )}
    </>
  )
}
