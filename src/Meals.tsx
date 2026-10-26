import type { Timestamp } from 'firebase/firestore'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { makeMenu, makeRecipe, warmUp } from './ai'
import { ConfirmView } from './Confirm'
import { addWeeks, isoWeekId, timeLabel, weekLabel } from './dates'
import {
  DAYS,
  DAY_NAMES,
  MAX_COURSES,
  recipeId,
  menuOutdatedSince,
  readLatest,
  recipeOutdatedSince,
  setGuidelines,
  setMadeMenu,
  setMadeRecipe,
  setMeal,
  setDayNote,
  updateRecipe,
  useGuidelines,
  useMenuWeeks,
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

// "What's for dinner": planning the week's Menu from Guidelines and Day Notes, and cooking
// from its Recipes.
export function MealsTab() {
  const [weekId, setWeekId] = useState(() => isoWeekId(new Date()))
  const menuWeeks = useMenuWeeks()
  const [guidelinesOpen, setGuidelinesOpen] = useState(false)
  const guidelines = useGuidelines()
  const week = useWeek(weekId)?.week
  const { recipes } = useRecipes(weekId)

  useEffect(warmUp, [])

  // This week and the next, and earlier weeks that have a Menu. Week ids sort by time.
  const thisWeek = isoWeekId(new Date())
  const nextWeek = addWeeks(thisWeek, 1)
  const shown = [...new Set([...menuWeeks.filter((id) => id < thisWeek), thisWeek, nextWeek])]
  const previous = shown.filter((id) => id < weekId).at(-1)
  const next = shown.find((id) => id > weekId)

  // This week and the next get their Menu and Recipes made as soon as they're missing.
  const thisJob = useAutoMake(thisWeek)
  const nextJob = useAutoMake(nextWeek)
  const pastJob = useJob()
  const job = weekId === thisWeek ? thisJob : weekId === nextWeek ? nextJob : pastJob

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
        <button
          onClick={() => previous && setWeekId(previous)}
          disabled={!previous}
          aria-label="Forrige uke"
          style={buttonStyle}
        >
          ‹
        </button>
        <h2 style={{ ...headingStyle, flex: 1, textAlign: 'center' }}>{weekLabel(weekId)}</h2>
        <button
          onClick={() => next && setWeekId(next)}
          disabled={!next}
          aria-label="Neste uke"
          style={buttonStyle}
        >
          ›
        </button>
      </div>

      {week && (
        <MenuSection
          key={`menu-${weekId}`}
          weekId={weekId}
          week={week}
          guidelines={guidelines}
          recipes={recipes}
          job={job}
        />
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

type Job = ReturnType<typeof useJob>
type Progress = (label: string) => void
// Marks days and Recipe ids as being made, or done.
type Mark = (keys: string[], on: boolean) => void

// Runs one AI job at a time for a part of the week, showing what's going on: a label, and
// which days and Recipes are being made.
function useJob() {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<string[]>([])
  const mark: Mark = (keys, on) =>
    setPending((p) => (on ? [...p, ...keys] : p.filter((k) => !keys.includes(k))))
  // Marks the keys for as long as the work goes on.
  async function track<T>(keys: string[], work: () => Promise<T>) {
    mark(keys, true)
    try {
      return await work()
    } finally {
      mark(keys, false)
    }
  }
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
  return { busy, error, run, pending, mark, track }
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

// Remakes after a warning that hand edits go.
function confirmRemake(onRemake: () => void) {
  if (window.confirm('Lag på nytt? Endringer du har gjort forsvinner.')) onRemake()
}

// "Utdatert" on the Menu, with when it became so. Tapping it remakes.
function Outdated({ since, disabled, onRemake }: { since: Timestamp; disabled: boolean; onRemake: () => void }) {
  return (
    <button
      onClick={() => confirmRemake(onRemake)}
      disabled={disabled}
      style={{ ...smallButtonStyle, alignSelf: 'flex-start', color: '#8a5a00' }}
    >
      Utdatert · {timeLabel(since.toDate())}
    </button>
  )
}

// What the AI makes the week's Menu and Recipes from, as of now.
async function readContext(weekId: string) {
  const latest = await readLatest(weekId)
  const context = {
    guidelines: latest.guidelines.text,
    dayNotes: latest.week.dayNotes ?? {},
    weekLabel: weekLabel(weekId),
  }
  return { week: latest.week, context }
}

// Makes the Menu from the latest Guidelines and Day Notes, or remakes the current one
// following an instruction. Courses that changed lose their Recipes, so new ones get made.
async function makeWeekMenu(weekId: string, recipes: Record<string, StoredRecipe>, instruction?: string) {
  const { week, context } = await readContext(weekId)
  const before = week.menu
  const made: Menu = await makeMenu(context, instruction && before ? { current: before, instruction } : undefined)
  setMadeMenu(weekId, made, before, recipes).catch(console.error)
}

// Writes a Recipe for each of the courses, all at once, counting them as they land.
// The Menu is passed in when it may not have reached the cache yet.
async function makeWeekRecipes(
  weekId: string,
  courses: { day: Day; course: number }[],
  progress: Progress,
  mark: Mark,
  menu?: Menu,
) {
  const { week, context } = await readContext(weekId)
  mark(courses.map(({ day, course }) => recipeId(day, course)), true)
  let done = 0
  progress(`Lager oppskrifter… 0 av ${courses.length}`)
  const results = await Promise.allSettled(
    courses.map(async ({ day, course }) => {
      try {
        const meal = (menu ?? week.menu)?.[day] ?? []
        const recipe = await makeRecipe(context, { day, meal, course: meal[course] })
        setMadeRecipe(weekId, recipeId(day, course), recipe).catch(console.error)
        progress(`Lager oppskrifter… ${++done} av ${courses.length}`)
      } finally {
        mark([recipeId(day, course)], false)
      }
    }),
  )
  if (results.some((r) => r.status === 'rejected')) throw new Error('Some Recipes failed')
}

// Makes the week's Menu if it has none, and Recipes for courses that have none, until the
// week is Confirmed. Each is tried once while the tab is open, so a failure doesn't retry
// forever.
function useAutoMake(weekId: string) {
  const job = useJob()
  const week = useWeek(weekId)
  const { recipes, synced } = useRecipes(weekId)
  const tried = useRef(new Set<string>())
  useEffect(() => {
    if (!week?.synced || !synced || job.busy || week.week.confirmedAt) return
    const menu = week.week.menu
    if (!menu) {
      if (tried.current.has(`${weekId}:menu`)) return
      tried.current.add(`${weekId}:menu`)
      job.run('Lager meny…', () => job.track([...DAYS], () => makeWeekMenu(weekId, recipes)))
      return
    }
    const missing = DAYS.flatMap((day) =>
      menu[day]
        .map((name, course) => ({ day, course, key: `${weekId}:${recipeId(day, course)}:${name}` }))
        .filter(({ day, course, key }) => !recipes[recipeId(day, course)] && !tried.current.has(key)),
    )
    if (missing.length === 0) return
    for (const { key } of missing) tried.current.add(key)
    job.run('Lager oppskrifter…', (p) => makeWeekRecipes(weekId, missing, p, job.mark, menu))
  })
  return job
}

// 🔄 next to an Outdated Recipe. Tapping it remakes.
function Remake({ since, disabled, onRemake }: { since: Timestamp; disabled: boolean; onRemake: () => void }) {
  const label = `Lag på nytt · utdatert ${timeLabel(since.toDate())}`
  return (
    <button
      onClick={() => confirmRemake(onRemake)}
      disabled={disabled}
      aria-label={label}
      title={label}
      style={{ ...smallButtonStyle, padding: '0.125rem 0.5rem', color: '#8a5a00' }}
    >
      🔄
    </button>
  )
}

// A new Meal for the day from the AI, following the given Note, without saving it.
async function suggestMeal(weekId: string, day: Day, note: string) {
  const { week, context } = await readContext(weekId)
  context.dayNotes = { ...context.dayNotes, [day]: note }
  const instruction = `Lag ny middag for ${DAY_NAMES[day].toLowerCase()} ut fra notatet for dagen.`
  const made = await makeMenu(context, week.menu ? { current: week.menu, instruction } : undefined)
  return made[day]
}

// Shows that something is being made.
function Working() {
  return (
    <span role="status" aria-label="Lager…" title="Lager…">
      ⏳
    </span>
  )
}

function MenuSection({
  weekId,
  week,
  guidelines,
  recipes,
  job,
}: {
  weekId: string
  week: Week
  guidelines: Guidelines
  recipes: Record<string, StoredRecipe>
  job: Job
}) {
  const { busy, error, run, pending } = job
  const [openRecipe, setOpenRecipe] = useState<{ day: Day; course: number } | null>(null)
  const [editing, setEditing] = useState<Day | null>(null)
  const [confirming, setConfirming] = useState(false)
  const menu = week.menu
  // After Confirm the Ingredients are bought: the Menu and Day Notes are fixed, only
  // Recipes are edited by hand, with no AI, and nothing is Outdated.
  const confirmed = !!week.confirmedAt
  const menuOutdated = !confirmed && menuOutdatedSince(week, guidelines)
  const open = openRecipe && recipes[recipeId(openRecipe.day, openRecipe.course)]
  // Iverksett needs a Recipe for every course.
  const ready = !!menu && DAYS.every((d) => menu[d].every((_, i) => recipes[recipeId(d, i)]))

  const make = (instruction?: string) => job.track([...DAYS], () => makeWeekMenu(weekId, recipes, instruction))
  const makeRecipes = (courses: { day: Day; course: number }[], progress: Progress) =>
    makeWeekRecipes(weekId, courses, progress, job.mark)

  return (
    <section style={sectionStyle}>
      <h3 style={headingStyle}>Meny</h3>
      {menuOutdated && (
        <Outdated since={menuOutdated} disabled={!!busy} onRemake={() => run('Lager meny…', () => make())} />
      )}
      {DAYS.map((d) => (
        <div key={d} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ flex: 1, fontSize: '0.875rem', color: '#555' }}>
              {DAY_NAMES[d]}
              {week.dayNotes?.[d] && <span style={{ color: '#666' }}> · {week.dayNotes[d]}</span>}
            </span>
            {pending.includes(d) && <Working />}
            {!confirmed && (
              <button
                onClick={() => setEditing(editing === d ? null : d)}
                aria-expanded={editing === d}
                aria-label={`Endre ${DAY_NAMES[d].toLowerCase()}`}
                style={{ ...smallButtonStyle, padding: '0.125rem 0.5rem' }}
              >
                ✏️
              </button>
            )}
          </div>
          {editing === d && !confirmed && (
            <DayEditor
              day={d}
              note={week.dayNotes?.[d] ?? ''}
              courses={menu?.[d]}
              onSave={(note, courses) => {
                if (note !== (week.dayNotes?.[d] ?? '')) setDayNote(weekId, d, note).catch(console.error)
                if (menu && courses && courses.join('\n') !== menu[d].join('\n')) {
                  setMeal(weekId, d, courses, menu[d], recipes).catch(console.error)
                }
                setEditing(null)
              }}
              onClose={() => setEditing(null)}
              busy={!!busy}
              onSuggest={(note, show) =>
                run('Lager middag…', async () => show(await job.track([d], () => suggestMeal(weekId, d, note))))
              }
            />
          )}
          {menu && (
            <>
              {menu[d].length === 0 && <div style={{ color: '#999' }}>Ingen middag</div>}
              {menu[d].map((course, i) => {
                const id = recipeId(d, i)
                const recipe = recipes[id]
                if (!recipe) {
                  return (
                    <div key={id} style={{ fontSize: '1.125rem', color: '#999' }}>
                      {course} {pending.includes(id) && <Working />}
                    </div>
                  )
                }
                const recipeOutdated = !confirmed && recipeOutdatedSince(recipe, d, week, guidelines)
                return (
                  <div
                    key={id}
                    role="group"
                    aria-label={`Oppskrift ${course}`}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenRecipe({ day: d, course: i })}
                      onKeyDown={(e) => e.key === 'Enter' && setOpenRecipe({ day: d, course: i })}
                      style={{ fontSize: '1.125rem', cursor: 'pointer' }}
                    >
                      {course}
                    </span>
                    {pending.includes(id) && <Working />}
                    {recipeOutdated && !pending.includes(id) && (
                      <Remake
                        since={recipeOutdated}
                        disabled={!!busy}
                        onRemake={() => run('Lager oppskrift…', (p) => makeRecipes([{ day: d, course: i }], p))}
                      />
                    )}
                  </div>
                )
              })}
            </>
          )}
        </div>
      ))}
      {openRecipe && open && (
        <RecipeView
          weekId={weekId}
          day={openRecipe.day}
          recipe={open}
          outdated={confirmed ? undefined : recipeOutdatedSince(open, openRecipe.day, week, guidelines)}
          ai={!confirmed}
          job={job}
          onRemake={(p) => makeRecipes([openRecipe], p)}
          onClose={() => setOpenRecipe(null)}
        />
      )}
      {menu && !confirmed && (
        <Instruct
          label="Endring i menyen"
          disabled={!!busy}
          onInstruct={(instruction) => run('Endrer meny…', () => make(instruction))}
        />
      )}
      {busy && <div style={{ color: '#555' }}>{busy}</div>}
      {error && <div style={errorStyle}>{error}</div>}
      {week.confirmedAt ? (
        <div style={{ color: '#555' }}>Iverksatt · {timeLabel(week.confirmedAt.toDate())}</div>
      ) : (
        ready && (
          <button
            onClick={() => setConfirming(true)}
            disabled={!!busy}
            style={{ ...buttonStyle, alignSelf: 'flex-start' }}
          >
            Iverksett
          </button>
        )
      )}
      {confirming && <ConfirmView weekId={weekId} recipes={recipes} onClose={() => setConfirming(false)} />}
    </section>
  )
}

// A Recipe filling the screen above the tabs, with a way back to the Menu.
function RecipeView({
  weekId,
  day,
  recipe,
  outdated,
  ai,
  job,
  onRemake,
  onClose,
}: {
  weekId: string
  day: Day
  recipe: StoredRecipe
  outdated?: Timestamp
  ai: boolean
  job: Job
  onRemake: (progress: Progress) => Promise<void>
  onClose: () => void
}) {
  const { busy, error, run, pending } = job
  return (
    <div
      role="dialog"
      aria-label={recipe.course}
      style={{ position: 'fixed', inset: 0, zIndex: 1, background: '#fff', overflowY: 'auto' }}
    >
      <div
        style={{
          ...sectionStyle,
          gap: '1rem',
          width: 'min(100%, 32rem)',
          margin: '0 auto',
          padding: '1rem 1rem 6rem',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <button onClick={onClose} style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}>
          ‹ Meny
        </button>
        <div style={{ fontSize: '0.875rem', color: '#555' }}>{DAY_NAMES[day]}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.375rem', margin: 0 }}>{recipe.course}</h2>
          {pending.includes(recipe.id) && <Working />}
          {outdated && !pending.includes(recipe.id) && (
            <Remake since={outdated} disabled={!!busy} onRemake={() => run('Lager oppskrift…', onRemake)} />
          )}
        </div>
        <RecipeForm weekId={weekId} day={day} recipe={recipe} ai={ai} disabled={!!busy} run={run} />
        {busy && <div style={{ color: '#555' }}>{busy}</div>}
        {error && <div style={errorStyle}>{error}</div>}
      </div>
    </div>
  )
}

// The day's Meal and Note, edited under the day. Saved together, or dropped on Avbryt. The
// Meal is only saved if it was edited, as the Menu may arrive while the editor is open.
function DayEditor({
  day,
  note,
  courses,
  onSave,
  onClose,
  busy,
  onSuggest,
}: {
  day: Day
  note: string
  courses?: string[]
  onSave: (note: string, courses?: string[]) => void
  onClose: () => void
  busy: boolean
  onSuggest: (note: string, show: (courses: string[]) => void) => void
}) {
  const [noteDraft, setNoteDraft] = useState(note)
  const [coursesDraft, setCoursesDraft] = useState<string | null>(null)
  return (
    <form
      aria-label={`Endre ${DAY_NAMES[day].toLowerCase()}`}
      onSubmit={(e) => {
        e.preventDefault()
        onSave(noteDraft.trim(), coursesDraft === null ? undefined : parseCourses(coursesDraft))
      }}
      style={{ ...sectionStyle, padding: '0.5rem', border: '1px solid #ddd' }}
    >
      {courses && (
        <label style={sectionStyle}>
          <span style={{ fontSize: '0.875rem', color: '#555' }}>Middag, én rett per linje</span>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <textarea
              autoFocus
              aria-label="Middag"
              value={coursesDraft ?? courses.join('\n')}
              onChange={(e) => setCoursesDraft(e.target.value)}
              rows={Math.max(2, courses.length)}
              maxLength={MAX_COURSES * 201}
              placeholder="Ingen middag"
              style={textareaStyle}
            />
            <button
              type="button"
              onClick={() => onSuggest(noteDraft.trim(), (c) => setCoursesDraft(c.join('\n')))}
              disabled={busy}
              aria-label="Foreslå ny middag"
              title="Foreslå ny middag"
              style={smallButtonStyle}
            >
              🔄
            </button>
          </div>
        </label>
      )}
      <label style={sectionStyle}>
        <span style={{ fontSize: '0.875rem', color: '#555' }}>Notat</span>
        <textarea
          autoFocus={!courses}
          aria-label="Notat"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="Gjester, hvem som er borte, rester som skal brukes."
          style={textareaStyle}
        />
      </label>
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose} style={buttonStyle}>
          Avbryt
        </button>
        <button type="submit" style={buttonStyle}>
          Lagre
        </button>
      </div>
    </form>
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
  ai,
  disabled,
  run,
}: {
  weekId: string
  day: Day
  recipe: StoredRecipe
  ai: boolean
  disabled: boolean
  run: (label: string, job: () => Promise<void>) => Promise<void>
}) {
  const save = (fields: Partial<Recipe>) => updateRecipe(weekId, recipe.id, fields).catch(console.error)
  const setIngredient = (i: number, fields: Partial<Ingredient>) =>
    save({ ingredients: recipe.ingredients.map((ing, j) => (j === i ? { ...ing, ...fields } : ing)) })

  async function remake(instruction: string) {
    const { week, context } = await readContext(weekId)
    const meal = week.menu?.[day] ?? []
    const course = meal[Number(recipe.id.split('-')[1])] ?? recipe.course
    const current = { course: recipe.course, servings: recipe.servings, ingredients: recipe.ingredients, steps: recipe.steps }
    const made = await makeRecipe(context, { day, meal, course }, { current, instruction })
    setMadeRecipe(weekId, recipe.id, made).catch(console.error)
  }

  return (
    <div style={sectionStyle}>
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

      {ai && (
        <Instruct
          label={`Endring i oppskriften ${recipe.course}`}
          disabled={disabled}
          onInstruct={(instruction) => run('Endrer oppskrift…', () => remake(instruction))}
        />
      )}
    </div>
  )
}
