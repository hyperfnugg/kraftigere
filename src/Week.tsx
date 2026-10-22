import { type FormEvent, useState } from 'react'
import { makeMenu } from './ai'
import { addWeeks, isoWeekId, weekLabel } from './dates'
import {
  DAYS,
  DAY_NAMES,
  MAX_COURSES,
  acceptMenu,
  readLatest,
  setGuidelines,
  setMadeMenu,
  setMeal,
  setNotes,
  useGuidelines,
  useRecipes,
  useWeek,
  type Menu,
  type StoredRecipe,
  type Week,
} from './weeks'

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
  const recipes = useRecipes(weekId)

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
        <>
          <SavedText
            key={weekId}
            label="Ukeplan"
            placeholder="Det som gjelder denne uka: gjester, hvem som er borte, hva som er i fryseren."
            value={week.notes ?? ''}
            onSave={(text) => setNotes(weekId, text)}
          />
          <MenuSection key={`menu-${weekId}`} weekId={weekId} week={week} recipes={recipes} />
        </>
      )}
    </>
  )
}

const sectionStyle = { display: 'flex', flexDirection: 'column', gap: '0.5rem' } as const
const errorStyle = { color: '#a00', fontSize: '0.875rem' }

// One course per line, at most MAX_COURSES.
function parseCourses(text: string) {
  return text
    .split('\n')
    .map((c) => c.trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, MAX_COURSES)
}

// Runs one AI job at a time for a part of the week, showing what's going on.
function useJob() {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  async function run(label: string, job: () => Promise<void>) {
    setBusy(label)
    setError('')
    try {
      await job()
    } catch (e) {
      console.error(e)
      setError('Noe gikk galt. Prøv igjen.')
    } finally {
      setBusy(null)
    }
  }
  return { busy, error, run }
}

// The instruction box: a one-off instruction to the AI for remaking something.
function Instruct({
  label,
  disabled,
  onInstruct,
}: {
  label: string
  disabled: boolean
  onInstruct: (instruction: string) => Promise<void>
}) {
  const [text, setText] = useState('')
  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    await onInstruct(t)
    setText('')
  }
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        aria-label={label}
        placeholder="Be om en endring"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        style={{ flex: 1, minWidth: 0, fontSize: '1rem', padding: '0.5rem' }}
      />
      <button type="submit" disabled={disabled} style={buttonStyle}>
        Endre
      </button>
    </form>
  )
}

function MenuSection({
  weekId,
  week,
  recipes,
}: {
  weekId: string
  week: Week
  recipes: Record<string, StoredRecipe>
}) {
  const { busy, error, run } = useJob()
  const menu = week.menu

  // Makes the Menu from the latest Guidelines and Week Notes, or remakes the current one
  // following an instruction.
  async function make(instruction?: string) {
    const latest = await readLatest(weekId)
    const context = {
      guidelines: latest.guidelines.text,
      notes: latest.week.notes ?? '',
      weekLabel: weekLabel(weekId),
    }
    const before = latest.week.menu
    const made: Menu = await makeMenu(context, instruction && before ? { current: before, instruction } : undefined)
    setMadeMenu(weekId, made, before).catch(console.error)
  }

  return (
    <section style={sectionStyle}>
      <h3 style={headingStyle}>Meny</h3>
      {!menu && (
        <button onClick={() => run('Lager meny…', () => make())} disabled={!!busy} style={buttonStyle}>
          Lag meny
        </button>
      )}
      {menu && (
        <>
          {DAYS.map((d) => (
            <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '0.875rem', color: '#555' }}>{DAY_NAMES[d]}</div>
              <SavedText
                label={DAY_NAMES[d]}
                placeholder="Ingen middag"
                value={menu[d].join('\n')}
                rows={Math.max(1, menu[d].length)}
                maxLength={MAX_COURSES * 201}
                onSave={(text) => setMeal(weekId, d, parseCourses(text), recipes)}
              />
            </div>
          ))}
          <Instruct
            label="Endring i menyen"
            disabled={!!busy}
            onInstruct={(instruction) => run('Endrer meny…', () => make(instruction))}
          />
          {!week.accepted && (
            <button onClick={() => acceptMenu(weekId)} disabled={!!busy} style={buttonStyle}>
              Godta meny
            </button>
          )}
        </>
      )}
      {busy && <div style={{ color: '#555' }}>{busy}</div>}
      {error && <div style={errorStyle}>{error}</div>}
    </section>
  )
}
