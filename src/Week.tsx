import type { Timestamp } from 'firebase/firestore'
import { type FormEvent, useState } from 'react'
import { makeMenu, makeRecipe } from './ai'
import { addWeeks, isoWeekId, timeLabel, weekLabel } from './dates'
import {
  DAYS,
  DAY_NAMES,
  MAX_COURSES,
  acceptMenu,
  recipeId,
  menuOutdatedSince,
  readLatest,
  recipeOutdatedSince,
  setGuidelines,
  setMadeMenu,
  setMadeRecipe,
  setMeal,
  setNotes,
  updateRecipe,
  useGuidelines,
  useRecipes,
  useWeek,
  type Day,
  type Guidelines,
  type Ingredient,
  type Menu,
  type Recipe,
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
          <MenuSection
            key={`menu-${weekId}`}
            weekId={weekId}
            week={week}
            guidelines={guidelines}
            recipes={recipes}
          />
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
  async function run(label: string, job: (progress: (label: string) => void) => Promise<void>) {
    setBusy(label)
    setError('')
    try {
      await job(setBusy)
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

// "Utdatert" with when it became so. Tapping it remakes, after a warning that hand edits go.
function Outdated({ since, disabled, onRemake }: { since: Timestamp; disabled: boolean; onRemake: () => void }) {
  return (
    <button
      onClick={() => {
        if (window.confirm('Lag på nytt? Endringer du har gjort forsvinner.')) onRemake()
      }}
      disabled={disabled}
      style={{ ...smallButtonStyle, alignSelf: 'flex-start', color: '#8a5a00' }}
    >
      Utdatert · {timeLabel(since.toDate())}
    </button>
  )
}

function MenuSection({
  weekId,
  week,
  guidelines,
  recipes,
}: {
  weekId: string
  week: Week
  guidelines: Guidelines
  recipes: Record<string, StoredRecipe>
}) {
  const { busy, error, run } = useJob()
  const [openRecipe, setOpenRecipe] = useState<string | null>(null)
  const menu = week.menu
  const menuOutdated = menuOutdatedSince(week, guidelines)

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

  // Writes a Recipe for each of the courses, all at once, counting them as they land.
  async function makeRecipes(courses: { day: Day; course: number }[], progress: (label: string) => void) {
    const latest = await readLatest(weekId)
    const context = {
      guidelines: latest.guidelines.text,
      notes: latest.week.notes ?? '',
      weekLabel: weekLabel(weekId),
    }
    let done = 0
    progress(`Lager oppskrifter… 0 av ${courses.length}`)
    const results = await Promise.allSettled(
      courses.map(async ({ day, course }) => {
        const meal = latest.week.menu?.[day] ?? []
        const recipe = await makeRecipe(context, { day, meal, course: meal[course] })
        setMadeRecipe(weekId, recipeId(day, course), recipe).catch(console.error)
        progress(`Lager oppskrifter… ${++done} av ${courses.length}`)
      }),
    )
    if (results.some((r) => r.status === 'rejected')) throw new Error('Some Recipes failed')
  }

  // The courses that have no Recipe yet.
  function missingRecipes(m: Menu) {
    return DAYS.flatMap((day) =>
      m[day].map((_, course) => ({ day, course })).filter(({ day, course }) => !recipes[recipeId(day, course)]),
    )
  }

  return (
    <section style={sectionStyle}>
      <h3 style={headingStyle}>Meny</h3>
      {menuOutdated && (
        <Outdated since={menuOutdated} disabled={!!busy} onRemake={() => run('Lager meny…', () => make())} />
      )}
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
              {menu[d].map((course, i) => {
                const id = recipeId(d, i)
                const recipe = recipes[id]
                if (recipe) {
                  const outdated = recipeOutdatedSince(recipe, d, week, guidelines)
                  return (
                    <div key={id} role="group" aria-label={`Oppskrift ${course}`} style={sectionStyle}>
                      <button
                        onClick={() => setOpenRecipe(openRecipe === id ? null : id)}
                        aria-expanded={openRecipe === id}
                        style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
                      >
                        Oppskrift: {course}
                      </button>
                      {outdated && (
                        <Outdated
                          since={outdated}
                          disabled={!!busy}
                          onRemake={() => run('Lager oppskrift…', (p) => makeRecipes([{ day: d, course: i }], p))}
                        />
                      )}
                      {openRecipe === id && (
                        <RecipeForm weekId={weekId} day={d} recipe={recipe} disabled={!!busy} run={run} />
                      )}
                    </div>
                  )
                }
                return (
                  week.accepted && (
                    <button
                      key={id}
                      onClick={() => run('Lager oppskrift…', (p) => makeRecipes([{ day: d, course: i }], p))}
                      disabled={!!busy}
                      style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
                    >
                      Lag oppskrift: {course}
                    </button>
                  )
                )
              })}
            </div>
          ))}
          <Instruct
            label="Endring i menyen"
            disabled={!!busy}
            onInstruct={(instruction) => run('Endrer meny…', () => make(instruction))}
          />
          {!week.accepted && (
            <button
              onClick={() => {
                acceptMenu(weekId).catch(console.error)
                run('Lager oppskrifter…', (p) => makeRecipes(missingRecipes(menu), p))
              }}
              disabled={!!busy}
              style={buttonStyle}
            >
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

// An input that saves when you leave it, like SavedText.
function SavedInput({
  label,
  value,
  onSave,
  width,
  inputMode,
}: {
  label: string
  value: string
  onSave: (text: string) => void
  width?: string
  inputMode?: 'decimal' | 'numeric'
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      value={draft ?? value}
      inputMode={inputMode}
      maxLength={200}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== value) onSave(draft.trim())
        setDraft(null)
      }}
      style={{ width, flex: width ? undefined : 1, minWidth: 0, fontSize: '1rem', padding: '0.25rem' }}
    />
  )
}

// "1,5" or "1.5"; anything else is no amount.
function parseAmount(text: string) {
  const n = Number(text.replace(',', '.'))
  return text && Number.isFinite(n) ? n : null
}

// A Recipe edited as a form: servings, Ingredient rows and steps, each saved as you leave
// it. The instruction box remakes it.
function RecipeForm({
  weekId,
  day,
  recipe,
  disabled,
  run,
}: {
  weekId: string
  day: Day
  recipe: StoredRecipe
  disabled: boolean
  run: (label: string, job: () => Promise<void>) => Promise<void>
}) {
  const save = (fields: Partial<Recipe>) => updateRecipe(weekId, recipe.id, fields).catch(console.error)
  const setIngredient = (i: number, fields: Partial<Ingredient>) =>
    save({ ingredients: recipe.ingredients.map((ing, j) => (j === i ? { ...ing, ...fields } : ing)) })

  async function remake(instruction: string) {
    const latest = await readLatest(weekId)
    const context = {
      guidelines: latest.guidelines.text,
      notes: latest.week.notes ?? '',
      weekLabel: weekLabel(weekId),
    }
    const meal = latest.week.menu?.[day] ?? []
    const course = meal[Number(recipe.id.split('-')[1])] ?? recipe.course
    const current = { course: recipe.course, servings: recipe.servings, ingredients: recipe.ingredients, steps: recipe.steps }
    const made = await makeRecipe(context, { day, meal, course }, { current, instruction })
    setMadeRecipe(weekId, recipe.id, made).catch(console.error)
  }

  return (
    <div style={{ ...sectionStyle, padding: '0.5rem', border: '1px solid #ddd' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <SavedInput
          label="Porsjoner"
          value={String(recipe.servings)}
          inputMode="numeric"
          width="3rem"
          onSave={(text) => {
            const n = Math.round(Number(text))
            if (n >= 1 && n <= 50) save({ servings: n })
          }}
        />
        porsjoner
      </label>

      <div style={{ fontSize: '0.875rem', color: '#555' }}>Ingredienser</div>
      {recipe.ingredients.map((ing, i) => (
        <div key={i} role="group" aria-label={`Ingrediens ${ing.text}`} style={{ display: 'flex', gap: '0.25rem' }}>
          <SavedInput
            label="Mengde"
            value={ing.amount === null ? '' : String(ing.amount).replace('.', ',')}
            inputMode="decimal"
            width="4rem"
            onSave={(text) => setIngredient(i, { amount: parseAmount(text) })}
          />
          <SavedInput label="Enhet" value={ing.unit} width="3rem" onSave={(unit) => setIngredient(i, { unit })} />
          <SavedInput label="Ingrediens" value={ing.text} onSave={(text) => text && setIngredient(i, { text })} />
          <button
            onClick={() => save({ ingredients: recipe.ingredients.filter((_, j) => j !== i) })}
            aria-label={`Fjern ${ing.text}`}
            style={smallButtonStyle}
          >
            Fjern
          </button>
        </div>
      ))}
      {recipe.ingredients.length < 60 && (
        <button
          onClick={() => save({ ingredients: [...recipe.ingredients, { text: 'ny ingrediens', amount: null, unit: '' }] })}
          style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
        >
          Legg til ingrediens
        </button>
      )}

      <div style={{ fontSize: '0.875rem', color: '#555' }}>Fremgangsmåte</div>
      <SavedText
        label="Fremgangsmåte"
        value={recipe.steps}
        rows={Math.max(3, recipe.steps.split('\n').length)}
        maxLength={10000}
        onSave={(steps) => save({ steps: steps.trim() })}
      />

      <Instruct
        label={`Endring i oppskriften ${recipe.course}`}
        disabled={disabled}
        onInstruct={(instruction) => run('Endrer oppskrift…', () => remake(instruction))}
      />
    </div>
  )
}
