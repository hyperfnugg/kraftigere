import type { Timestamp } from 'firebase/firestore'
import {
  Fragment,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { makeMenu, makeRecipe, warmUp } from './ai'
import { ConfirmView } from './Confirm'
import { addWeeks, isoWeekId, timeLabel, weekLabel } from './dates'
import { formatNumber, measureText } from './amounts'
import {
  DAYS,
  DAY_NAMES,
  MAX_STEP_INGREDIENTS,
  MAX_STEP_INSTRUCTIONS,
  MAX_STEPS,
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
  type Step,
  type StoredRecipe,
  type Week,
} from './weeks'
import { Button, ErrorLine, GlyphButton, StatusLine, TextButton } from './ui'

const textareaClass = 'box-border w-full p-2 text-base'
const headingClass = 'text-lg font-bold'

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
      className={textareaClass}
    />
  )
}

// "What's for dinner": planning the week's Menu from Guidelines and Day Notes, and cooking
// from its Recipes. A dish tapped on the List opens with its Recipe.
// Says an Oda Order is under way, and goes to it.
export function OdaOrderLink({ onClick }: { onClick: () => void }) {
  return (
    <TextButton onClick={onClick} className="underline">
      Odabestilling pågår
    </TextButton>
  )
}

// ordering: an Oda Order lasts, so Iverksett waits.
export function MealsTab({
  openAt,
  ordering,
  onOdaOrder,
}: {
  openAt: { week: string; recipe: string } | null
  ordering: boolean
  onOdaOrder: () => void
}) {
  const [weekId, setWeekId] = useState(() => openAt?.week ?? isoWeekId(new Date()))
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
      <Button
        small
        onClick={() => setGuidelinesOpen(!guidelinesOpen)}
        aria-expanded={guidelinesOpen}
        className="self-start"
      >
        Føringer
      </Button>
      {guidelinesOpen && (
        <SavedText
          label="Føringer"
          placeholder="Det som gjelder hver uke: hvem som spiser, hva de ikke tåler, hvor lang tid maten kan ta."
          value={guidelines.text}
          onSave={setGuidelines}
          rows={6}
        />
      )}

      <div className="flex items-center gap-2">
        <GlyphButton onClick={() => previous && setWeekId(previous)} disabled={!previous} aria-label="Forrige uke" className="text-2xl">
          ‹
        </GlyphButton>
        <h2 className={`${headingClass} flex-1 text-center`}>{weekLabel(weekId)}</h2>
        <GlyphButton onClick={() => next && setWeekId(next)} disabled={!next} aria-label="Neste uke" className="text-2xl">
          ›
        </GlyphButton>
      </div>

      {week && (
        <MenuSection
          key={`menu-${weekId}`}
          weekId={weekId}
          week={week}
          guidelines={guidelines}
          recipes={recipes}
          job={job}
          openAt={openAt?.week === weekId ? openAt.recipe : undefined}
          ordering={ordering}
          onOdaOrder={onOdaOrder}
        />
      )}
    </>
  )
}

const sectionClass = 'flex flex-col gap-2'

// The day's one dish, or none.
function parseMeal(text: string) {
  const dish = text.trim().replace(/\s+/g, ' ').slice(0, 200)
  return dish ? [dish] : []
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
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        aria-label={label}
        placeholder="Be om en endring"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        className="min-w-0 flex-1 p-2 text-base"
      />
      <Button type="submit" disabled={disabled}>
        Endre
      </Button>
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
    // A Notice that's also a Button: its text in amber, its box black.
    <Button small onClick={() => confirmRemake(onRemake)} disabled={disabled} className="self-start">
      <span className={disabled ? '' : 'text-accent'}>Utdatert · {timeLabel(since.toDate())}</span>
    </Button>
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

// Makes the Menu, dish names only, from the latest Guidelines and Day Notes. Courses that
// changed lose their Recipes.
async function makeWeekMenu(weekId: string, recipes: Record<string, StoredRecipe>) {
  const { week, context } = await readContext(weekId)
  const before = week.menu
  const made: Menu = await makeMenu(context)
  setMadeMenu(weekId, made, before, recipes).catch(console.error)
}

// Writes a Recipe for each of the courses, all at once, counting them as they land.
async function makeWeekRecipes(
  weekId: string,
  courses: { day: Day; course: number }[],
  progress: Progress,
  mark: Mark,
) {
  const { week, context } = await readContext(weekId)
  mark(courses.map(({ day, course }) => recipeId(day, course)), true)
  let done = 0
  progress(`Lager oppskrifter … 0 av ${courses.length}`)
  const results = await Promise.allSettled(
    courses.map(async ({ day, course }) => {
      try {
        const meal = week.menu?.[day] ?? []
        const recipe = await makeRecipe(context, { day, meal, course: meal[course] })
        setMadeRecipe(weekId, recipeId(day, course), recipe).catch(console.error)
        progress(`Lager oppskrifter … ${++done} av ${courses.length}`)
      } finally {
        mark([recipeId(day, course)], false)
      }
    }),
  )
  if (results.some((r) => r.status === 'rejected')) throw new Error('Some Recipes failed')
}

// Makes the week's Menu, names only, if it has none. Recipes wait for "Lag oppskrifter".
// Tried once while the tab is open, so a failure doesn't retry forever.
function useAutoMake(weekId: string) {
  const job = useJob()
  const week = useWeek(weekId)
  const tried = useRef(false)
  useEffect(() => {
    if (!week?.synced || job.busy || week.week.menu || week.week.confirmedAt || tried.current) return
    tried.current = true
    job.run('Lager meny …', () => job.track([...DAYS], () => makeWeekMenu(weekId, {})))
  })
  return job
}

// A bare ↻: tapping it remakes, after the warning. Amber when what it remakes is Outdated.
function Remake({
  label,
  since,
  disabled,
  onRemake,
}: {
  label: string
  since?: Timestamp
  disabled: boolean
  onRemake: () => void
}) {
  const title = since ? `${label} · utdatert ${timeLabel(since.toDate())}` : label
  return (
    <GlyphButton
      onClick={() => confirmRemake(onRemake)}
      disabled={disabled}
      aria-label={title}
      title={title}
      className={`text-2xl ${since ? 'text-accent' : ''}`}
    >
      ↻
    </GlyphButton>
  )
}

// A new Meal for the day from the AI, following its Note.
async function suggestMeal(weekId: string, day: Day) {
  const { week, context } = await readContext(weekId)
  const instruction = `Lag ny middag for ${DAY_NAMES[day].toLowerCase()} ut fra notatet for dagen.`
  const made = await makeMenu(context, week.menu ? { current: week.menu, instruction } : undefined)
  return made[day]
}

// Shows that something is being made, in words: no ⏳ or spinner.
function Working() {
  return (
    <span role="status" aria-label="Lager…" className="shrink-0 text-muted">
      Lager …
    </span>
  )
}

function MenuSection({
  weekId,
  week,
  guidelines,
  recipes,
  job,
  openAt,
  ordering,
  onOdaOrder,
}: {
  weekId: string
  week: Week
  guidelines: Guidelines
  recipes: Record<string, StoredRecipe>
  job: Job
  openAt?: string
  ordering: boolean
  onOdaOrder: () => void
}) {
  const { busy, error, run, pending } = job
  const [openRecipe, setOpenRecipe] = useState<{ day: Day; course: number } | null>(() => {
    if (!openAt) return null
    const [day, course] = openAt.split('-')
    return { day: day as Day, course: Number(course) }
  })
  const [editing, setEditing] = useState<Day | null>(null)
  const [confirming, setConfirming] = useState(false)
  const menu = week.menu
  // After Confirm the Ingredients are bought: the Menu and Day Notes are fixed, only
  // Recipes are edited by hand, with no AI, and nothing is Outdated.
  const confirmed = !!week.confirmedAt
  const menuOutdated = !confirmed && menuOutdatedSince(week, guidelines)
  const open = openRecipe && recipes[recipeId(openRecipe.day, openRecipe.course)]
  // "Lag oppskrifter" runs once: after that, a Recipe is made or remade from its screen.
  const recipesStarted = Object.keys(recipes).length > 0
  // Iverksett needs a Recipe for every course.
  const ready = !!menu && DAYS.every((d) => menu[d].every((_, i) => recipes[recipeId(d, i)]))
  const allCourses = menu ? DAYS.flatMap((day) => menu[day].map((_, course) => ({ day, course }))) : []
  // Days are edited until "Lag oppskrifter", and tapping one edits it. After that, editing
  // belongs to the Recipes.
  const daysEditable = !recipesStarted && !confirmed
  const toggleEditing = (d: Day) => setEditing(editing === d ? null : d)
  // After that, tapping anywhere on a day opens its Recipe, if it has one.
  const recipeToOpen = (d: Day) => {
    const course = daysEditable ? -1 : (menu?.[d].findIndex((_, i) => recipes[recipeId(d, i)]) ?? -1)
    return course >= 0 ? { day: d, course } : null
  }
  function onDayClick(d: Day, e: MouseEvent) {
    // Taps inside the open editor are for its fields.
    if (daysEditable && !(e.target as Element).closest('form')) toggleEditing(d)
    const target = recipeToOpen(d)
    if (target) setOpenRecipe(target)
  }

  // ↻ beside a day, until "Lag oppskrifter": a new dish from the AI, following the day's
  // Note, saved at once.
  const suggestButton = (day: Day) => (
    <GlyphButton
      onClick={() =>
        run('Lager middag …', () =>
          job.track([day], async () => {
            const meal = await suggestMeal(weekId, day)
            if (menu) setMeal(weekId, day, meal, menu[day], recipes).catch(console.error)
          }),
        )
      }
      disabled={!!busy}
      aria-label={`Ny middag ${DAY_NAMES[day].toLowerCase()}`}
      title="Ny middag"
      className="text-2xl"
    >
      ↻
    </GlyphButton>
  )

  const make = () => job.track([...DAYS], () => makeWeekMenu(weekId, recipes))
  const makeRecipes = (courses: { day: Day; course: number }[], progress: Progress) =>
    makeWeekRecipes(weekId, courses, progress, job.mark)

  return (
    <section className={sectionClass}>
      <h3 className={headingClass}>Meny</h3>
      {menuOutdated && (
        <Outdated since={menuOutdated} disabled={!!busy} onRemake={() => run('Lager meny …', () => make())} />
      )}
      {DAYS.map((d) => (
        <div key={d} className="flex min-h-11 items-center gap-3 border-b border-line py-2">
          <div
            onClick={(e) => onDayClick(d, e)}
            className={`flex min-w-0 flex-1 flex-col gap-1 ${daysEditable || recipeToOpen(d) ? 'cursor-pointer' : ''}`}
          >
            <span
              {...(daysEditable && {
                role: 'button',
                tabIndex: 0,
                'aria-expanded': editing === d,
                'aria-label': `Endre ${DAY_NAMES[d].toLowerCase()}`,
                onKeyDown: (e: KeyboardEvent) => {
                  if (e.key !== 'Enter') return
                  // Otherwise the Enter lands in the Note as it gets focus.
                  e.preventDefault()
                  toggleEditing(d)
                },
              })}
              className="text-sm text-muted"
            >
              {DAY_NAMES[d]}
              {week.dayNotes?.[d] && <span className="text-muted"> · {week.dayNotes[d]}</span>}
            </span>
            {editing === d && daysEditable && (
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
              />
            )}
            {menu && (
              <>
                {menu[d].length === 0 && <div className="text-faint">Ingen middag</div>}
                {menu[d].map((course, i) => {
                  const id = recipeId(d, i)
                  const recipe = recipes[id]
                  const outdated = recipe && !confirmed && recipeOutdatedSince(recipe, d, week, guidelines)
                  return (
                    <div
                      key={id}
                      role="group"
                      aria-label={`Oppskrift ${course}`}
                      className="flex items-center gap-2"
                    >
                      {recipe ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && setOpenRecipe({ day: d, course: i })}
                          className="text-lg wrap-anywhere"
                        >
                          {course}
                        </span>
                      ) : (
                        <span className="text-lg text-faint wrap-anywhere">{course}</span>
                      )}
                      {pending.includes(id) && <Working />}
                      {/* After "Lag oppskrifter", a changed course gets its Recipe here. */}
                      {!recipe && recipesStarted && !confirmed && !pending.includes(id) && (
                        <Button
                          small
                          onClick={(e) => {
                            e.stopPropagation()
                            run('Lager oppskrift …', (p) => makeRecipes([{ day: d, course: i }], p))
                          }}
                          disabled={!!busy}
                        >
                          Lag oppskrift
                        </Button>
                      )}
                      {outdated && !pending.includes(id) && (
                        <span className="text-sm text-accent">utdatert</span>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
          {/* ⏳ while the day's dish is made, or ↻ for a new one, beside the whole day. */}
          {pending.includes(d) ? <Working /> : daysEditable && menu && suggestButton(d)}
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
      {busy && <StatusLine>{busy}</StatusLine>}
      {error && <ErrorLine>{error}</ErrorLine>}
      {week.confirmedAt ? (
        <div className="text-muted">Iverksatt · {timeLabel(week.confirmedAt.toDate())}</div>
      ) : (
        menu && (
          <div className="flex gap-2">
            {/* Stays, disabled once run, so the steps show: Lag oppskrifter, then Iverksett. The
                next step is the Main Action. */}
            <Button
              inverted={!recipesStarted}
              onClick={() => run('Lager oppskrifter …', (p) => makeRecipes(allCourses, p))}
              disabled={!!busy || recipesStarted}
            >
              Lag oppskrifter
            </Button>
            <Button inverted={recipesStarted} onClick={() => setConfirming(true)} disabled={!!busy || !ready || ordering}>
              Iverksett
            </Button>
            {ordering && (
              <span className="self-center text-muted">
                <OdaOrderLink onClick={onOdaOrder} />
              </span>
            )}
          </div>
        )
      )}
      {confirming && !ordering && <ConfirmView weekId={weekId} recipes={recipes} onClose={() => setConfirming(false)} />}
    </section>
  )
}

// Wide enough for the Recipe as a table, as on a tablet held horizontally.
const wideQuery = window.matchMedia('(min-width: 40rem)')

function useWide() {
  return useSyncExternalStore(
    (onChange) => {
      wideQuery.addEventListener('change', onChange)
      return () => wideQuery.removeEventListener('change', onChange)
    },
    () => wideQuery.matches,
  )
}

// Keeps the screen on while cooking. The lock goes when the app is hidden, so it's taken
// again on return.
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | undefined
    let gone = false
    const take = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return
      navigator.wakeLock
        .request('screen')
        .then((l) => {
          if (gone) return l.release()
          lock = l
        })
        .catch(() => {})
    }
    take()
    document.addEventListener('visibilitychange', take)
    return () => {
      gone = true
      document.removeEventListener('visibilitychange', take)
      lock?.release().catch(() => {})
    }
  }, [])
}

// "200 g" with the kitchen measure after it in grey, "(2 dl)", or just the measure when
// there are no grams ("etter smak").
function Quantity({ ingredient }: { ingredient: Ingredient }) {
  const { grams, measure } = ingredient
  const extra = measureText(measure)
  const grey = 'text-[0.85em] text-muted'
  if (grams === null) return <span className={grey}>{extra}</span>
  return (
    <>
      {formatNumber(grams)} g{extra && <span className={grey}> ({extra})</span>}
    </>
  )
}

// An instruction's number in a circle, as in Modernist Cuisine.
function InstructionNumber({ n }: { n: number }) {
  return (
    <span className="mt-[0.1em] box-border inline-flex h-[1.5em] min-w-[1.5em] shrink-0 items-center justify-center border border-current text-[0.75em]">
      {n}
    </span>
  )
}

// One instruction with its number, wrapped lines indented past the number.
function Instruction({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex gap-2">
      <InstructionNumber n={n} />
      <span>{text}</span>
    </div>
  )
}

// The steps to cook from, in the style of Modernist Cuisine: each step's Ingredients beside
// its instructions, which are numbered across the Recipe. A table when wide, blocks when
// not.
function RecipeSteps({ steps, wide }: { steps: Step[]; wide: boolean }) {
  // The number of each step's first instruction.
  const firsts = steps.map((_, i) => 1 + steps.slice(0, i).reduce((n, s) => n + s.instructions.length, 0))
  if (!wide) {
    return (
      <div className="border-b border-line text-lg leading-[1.4]">
        {steps.map((step, i) => (
          <div
            key={i}
            role="group"
            aria-label={`Steg ${i + 1}`}
            className={`${sectionClass} border-t border-line py-3`}
          >
            {step.ingredients.length > 0 && (
              <div className="grid grid-cols-[1fr_auto] gap-x-4">
                {step.ingredients.map((ing, k) => (
                  <Fragment key={k}>
                    <span>{ing.text}</span>
                    <span className="whitespace-nowrap">
                      <Quantity ingredient={ing} />
                    </span>
                  </Fragment>
                ))}
              </div>
            )}
            {step.instructions.map((text, k) => (
              <Instruction key={k} n={firsts[i] + k} text={text} />
            ))}
          </div>
        ))}
      </div>
    )
  }

  const cell = 'py-1.5 pr-4 pl-0 text-left align-top'
  const head = `${cell} text-sm font-normal tracking-wider text-muted`
  return (
    <table className="w-full border-collapse border-b border-line text-xl leading-[1.4]">
      <thead>
        <tr>
          <th className={`${head} w-[30%]`}>INGREDIENS</th>
          <th className={`${head} w-[15%]`}>MENGDE</th>
          <th className={head}>FREMGANGSMÅTE</th>
        </tr>
      </thead>
      {steps.map((step, i) => {
        const rows = Math.max(1, step.ingredients.length, step.instructions.length)
        return (
          <tbody key={i} aria-label={`Steg ${i + 1}`} className="border-t border-line">
            {Array.from({ length: rows }, (_, r) => {
              const ing = step.ingredients[r]
              const text = step.instructions[r]
              return (
                <tr key={r}>
                  <td className={cell}>{ing?.text}</td>
                  <td className={`${cell} whitespace-nowrap`}>{ing && <Quantity ingredient={ing} />}</td>
                  <td className={cell}>{text !== undefined && <Instruction n={firsts[i] + r} text={text} />}</td>
                </tr>
              )
            })}
          </tbody>
        )
      })}
    </table>
  )
}

// A Recipe filling the screen above the tabs, to cook from, with a way back to the Menu.
// Its steps are read-only, with the form behind "Rediger".
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
  const wide = useWide()
  const [editing, setEditing] = useState(false)
  useWakeLock()

  async function remake(instruction: string) {
    const { week, context } = await readContext(weekId)
    const meal = week.menu?.[day] ?? []
    const course = meal[Number(recipe.id.split('-')[1])] ?? recipe.course
    const current = { course: recipe.course, servings: recipe.servings, steps: recipe.steps }
    const made = await makeRecipe(context, { day, meal, course }, { current, instruction })
    setMadeRecipe(weekId, recipe.id, made).catch(console.error)
  }

  return (
    <div
      role="dialog"
      aria-label={recipe.course}
      className="fixed inset-0 z-1 overflow-y-auto bg-white"
    >
      {/* sm is 40rem, as for useWide. */}
      <div className="mx-auto box-border flex w-[min(100%,32rem)] flex-col gap-4 px-4 pt-4 pb-24 sm:w-[min(100%,72rem)]">
        <div className="flex justify-between">
          <Button small onClick={onClose}>
            ‹ Meny
          </Button>
          <Button small onClick={() => setEditing(!editing)}>
            {editing ? 'Ferdig' : 'Rediger'}
          </Button>
        </div>
        <div className="text-sm text-muted">{DAY_NAMES[day]}</div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">{recipe.course}</h2>
          {pending.includes(recipe.id) && <Working />}
          {ai && !pending.includes(recipe.id) && (
            <Remake
              label="Lag oppskriften på nytt"
              since={outdated}
              disabled={!!busy}
              onRemake={() => run('Lager oppskrift …', onRemake)}
            />
          )}
        </div>
        {editing ? (
          <RecipeEditor weekId={weekId} recipe={recipe} />
        ) : (
          <>
            <div className="text-muted">{recipe.servings} porsjoner</div>
            <RecipeSteps steps={recipe.steps} wide={wide} />
          </>
        )}
        {ai && (
          <Instruct
            label={`Endring i oppskriften ${recipe.course}`}
            disabled={!!busy}
            onInstruct={(instruction) => run('Endrer oppskrift …', () => remake(instruction))}
          />
        )}
        {busy && <StatusLine>{busy}</StatusLine>}
        {error && <ErrorLine>{error}</ErrorLine>}
      </div>
    </div>
  )
}

// The day's Meal and Note, edited under the day. Saved, and closed, on Enter or when focus
// leaves the editor. The Meal is only saved if it was edited, as the Menu may arrive while
// the editor is open.
function DayEditor({
  day,
  note,
  courses,
  onSave,
}: {
  day: Day
  note: string
  courses?: string[]
  onSave: (note: string, courses?: string[]) => void
}) {
  const [noteDraft, setNoteDraft] = useState(note)
  const [coursesDraft, setCoursesDraft] = useState<string | null>(null)
  const save = () => onSave(noteDraft.trim(), coursesDraft === null ? undefined : parseMeal(coursesDraft))
  return (
    <form
      aria-label={`Endre ${DAY_NAMES[day].toLowerCase()}`}
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          save()
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) save()
      }}
      className={`${sectionClass} border border-black p-2`}
    >
      <label className={sectionClass}>
        <span className="text-sm text-muted">Notat</span>
        <textarea
          autoFocus
          aria-label="Notat"
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          rows={2}
          maxLength={5000}
          placeholder="Gjester, hvem som er borte, rester som skal brukes."
          className={textareaClass}
        />
      </label>
      {courses && (
        <label className={sectionClass}>
          <span className="text-sm text-muted">Middag</span>
          <input
            aria-label="Middag"
            value={coursesDraft ?? courses.join(' + ')}
            onChange={(e) => setCoursesDraft(e.target.value)}
            maxLength={200}
            placeholder="Ingen middag"
            className="p-2 text-base"
          />
        </label>
      )}
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
  placeholder,
}: {
  label: string
  value: string
  onSave: (text: string) => void
  // A width class; without one the input takes the space left.
  width?: string
  inputMode?: 'decimal' | 'numeric'
  placeholder?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      aria-label={label}
      value={draft ?? value}
      inputMode={inputMode}
      placeholder={placeholder}
      maxLength={200}
      onFocus={() => setDraft(value)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== null && draft.trim() !== value) onSave(draft.trim())
        setDraft(null)
      }}
      className={`${width ?? 'flex-1'} min-w-0 p-1 text-base`}
    />
  )
}

// "1,5" or "1.5"; anything else, or nothing above 0, is no amount.
function parseAmount(text: string) {
  const n = Number(text.replace(',', '.'))
  return text && Number.isFinite(n) && n > 0 ? n : null
}

// One instruction per line, empty lines left out.
function parseInstructions(text: string) {
  return text
    .split('\n')
    .map((t) => t.trim().slice(0, 500))
    .filter(Boolean)
    .slice(0, MAX_STEP_INSTRUCTIONS)
}

const amountText = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

const newIngredient: Ingredient = { text: 'ny ingrediens', grams: null, measure: '' }

// A Recipe edited as a form: servings, then each step's Ingredient rows and text, each
// saved as you leave it. Steps can be added anywhere and removed, but not moved.
function RecipeEditor({ weekId, recipe }: { weekId: string; recipe: StoredRecipe }) {
  const save = (fields: Partial<Recipe>) => updateRecipe(weekId, recipe.id, fields).catch(console.error)
  // The steps are saved whole, so each edit builds on the last one saved until a snapshot
  // shows it: leaving one field for the next saves both before either is shown, and a
  // snapshot can arrive without the latest save. Not after the AI remade the Recipe.
  const saved = useRef<{ steps: Step[]; madeAt?: number } | null>(null)
  useEffect(() => {
    if (saved.current && JSON.stringify(recipe.steps) === JSON.stringify(saved.current.steps)) saved.current = null
  }, [recipe.steps])
  function saveSteps(edit: (steps: Step[]) => Step[]) {
    const madeAt = recipe.madeAt?.toMillis()
    const last = saved.current?.madeAt === madeAt ? saved.current : null
    const steps = edit(last?.steps ?? recipe.steps)
    saved.current = { steps, madeAt }
    save({ steps })
  }
  const setStep = (i: number, edit: (step: Step) => Step) =>
    saveSteps((steps) => steps.map((s, j) => (j === i ? edit(s) : s)))
  const setIngredients = (i: number, edit: (ingredients: Ingredient[]) => Ingredient[]) =>
    setStep(i, (s) => ({ ...s, ingredients: edit(s.ingredients) }))
  const setIngredient = (i: number, k: number, fields: Partial<Ingredient>) =>
    setIngredients(i, (ings) => ings.map((ing, j) => (j === k ? { ...ing, ...fields } : ing)))
  const canAddStep = recipe.steps.length < MAX_STEPS
  const addStep = (at: number, label: string) =>
    canAddStep && (
      <Button
        small
        onClick={() => saveSteps((steps) => steps.toSpliced(at, 0, { ingredients: [], instructions: [] }))}
        aria-label={label}
        className="self-start"
      >
        + steg
      </Button>
    )

  return (
    <div className={sectionClass}>
      <label className="flex items-center gap-2">
        <SavedInput
          label="Porsjoner"
          value={String(recipe.servings)}
          inputMode="numeric"
          width="w-12"
          onSave={(text) => {
            const n = Math.round(Number(text))
            if (n >= 1 && n <= 50) save({ servings: n })
          }}
        />
        porsjoner
      </label>

      {addStep(0, 'Nytt steg før steg 1')}
      {recipe.steps.map((step, i) => (
        <div
          key={i}
          role="group"
          aria-label={`Steg ${i + 1}`}
          className={`${sectionClass} border-t border-line pt-2`}
        >
          <div className="flex items-center gap-2">
            <span className="flex-1 text-sm text-muted">Steg {i + 1}</span>
            <Button
              small
              onClick={() => saveSteps((steps) => steps.filter((_, j) => j !== i))}
              aria-label={`Fjern steg ${i + 1}`}
            >
              Fjern steg
            </Button>
          </div>
          {step.ingredients.map((ing, k) => (
            <div key={k} role="group" aria-label={`Ingrediens ${ing.text}`} className="flex gap-1">
              <SavedInput
                label="Gram"
                value={amountText(ing.grams)}
                inputMode="decimal"
                placeholder="g"
                width="w-14"
                onSave={(text) => setIngredient(i, k, { grams: parseAmount(text) })}
              />
              <SavedInput
                label="Mål"
                value={ing.measure}
                placeholder="mål"
                width="w-22"
                onSave={(measure) => setIngredient(i, k, { measure })}
              />
              <SavedInput
                label="Ingrediens"
                value={ing.text}
                onSave={(text) => text && setIngredient(i, k, { text })}
              />
              <Button
                small
                onClick={() => setIngredients(i, (ings) => ings.filter((_, j) => j !== k))}
                aria-label={`Fjern ${ing.text}`}
              >
                Fjern
              </Button>
            </div>
          ))}
          {step.ingredients.length < MAX_STEP_INGREDIENTS && (
            <Button small onClick={() => setIngredients(i, (ings) => [...ings, newIngredient])} className="self-start">
              Legg til ingrediens
            </Button>
          )}
          <SavedText
            label={`Fremgangsmåte steg ${i + 1}`}
            value={step.instructions.join('\n')}
            rows={Math.max(2, step.instructions.length)}
            maxLength={5000}
            placeholder="Én instruksjon per linje"
            onSave={(text) => setStep(i, (s) => ({ ...s, instructions: parseInstructions(text) }))}
          />
          {addStep(i + 1, `Nytt steg etter steg ${i + 1}`)}
        </div>
      ))}
    </div>
  )
}
