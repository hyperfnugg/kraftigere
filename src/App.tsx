import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useCombobox } from 'downshift'
import { type User } from 'firebase/auth'
import { MealsTab, OdaOrderLink } from './Meals'
import { Button, ErrorLine, GlyphButton, MainAction, Notice, Pot, StatusLine, TextButton } from './ui'
import { readPackSizes, warmUp } from './ai'
import { MAX_PACKS, type PackSize, formatAmount, hasAmounts, startingPacks } from './amounts'
import { signInWithGoogle, signOut, useOnline, useUser } from './firebase'
import {
  cancelOda,
  fillBasket,
  linkOda,
  linkResult,
  odaProductUrl,
  orderedOda,
  parseOdaUrl,
  searchOda,
  setPacks,
  substituteBasket,
  suggestOda,
  useBasket,
  type OdaResult,
  type Search,
} from './oda'
import {
  addEntry,
  isStaple,
  removeEntries,
  removeEntry,
  dropOrders,
  inStoreOrder,
  setNeverOda,
  setOrders,
  storeOrder,
  setNote,
  setOdaProduct,
  setOdaProducts,
  suggest,
  toggleEntry,
  typedName,
  useAccess,
  useEntries,
  useRemoveCheckedAfterShopping,
  useWares,
  wareId,
  type Dish,
  type Entry,
  type OdaProduct,
  type Ware,
} from './entries'

const centerClass = 'flex min-h-screen flex-col items-center justify-center gap-4 text-xl'

export default function App() {
  const { user, loading: userLoading } = useUser()
  const { access, loading: accessLoading } = useAccess(user)

  if (userLoading) return null

  if (!user) {
    return (
      <main className={centerClass}>
        <MainAction onClick={() => signInWithGoogle()}>Logg inn med Google</MainAction>
      </main>
    )
  }

  if (accessLoading) return null

  if (access !== 'authorized') {
    return (
      <main className={centerClass}>
        <div>
          {access === 'unreachable'
            ? "Får ikke kontakt. Sjekk nettet og prøv igjen."
            : 'Ingen tilgang. Be admin legge til Google-kontoen din.'}
        </div>
        <Button onClick={() => signOut()}>Logg ut</Button>
      </main>
    )
  }

  return <List user={user} />
}

type Tab = 'Home' | 'Meals' | 'Shop' | 'Oda'

const TABS = [
  // A plain black text glyph, like ↻ on Middag, not an emoji.
  { tab: 'Home', label: '⌂', name: 'Hjem' },
  { tab: 'Shop', label: 'Handle', name: 'Handle' },
] as const

// Behind ⋮, to keep the bar uncrowded.
const MORE_TABS = [
  { tab: 'Meals', name: 'Middag' },
  { tab: 'Oda', name: 'Odabestilling' },
] as const

function List({ user }: { user: User }) {
  const { entries } = useEntries()
  useRemoveCheckedAfterShopping(entries)
  const online = useOnline()
  // Back from linking Oda, the app opens on Odabestilling.
  const [tab, setTab] = useState<Tab>(linkResult ? 'Oda' : 'Home')
  const [more, setMore] = useState(false)
  const [dishesOf, setDishesOf] = useState<Entry | null>(null)
  // A dish tapped on the List opens its Recipe in Middag.
  const [recipeLink, setRecipeLink] = useState<Dish | null>(null)
  // An Oda Order lasts while any Entry is In Basket, and locks Groceries on every device.
  const ordering = entries.some((e) => e.basket)

  function openRecipe(dish: Dish) {
    setDishesOf(null)
    setRecipeLink(dish)
    setTab('Meals')
  }

  const hidden = MORE_TABS.find((m) => m.tab === tab)

  return (
    <main className="mx-auto box-border flex min-h-screen w-[min(100%,32rem)] flex-col gap-4 p-4">
      <div className="flex flex-1 flex-col gap-4">
        {tab === 'Home' && <Home entries={entries} ordering={ordering} onOdaOrder={() => setTab('Oda')} onDishes={setDishesOf} />}
        {tab === 'Meals' && <MealsTab openAt={recipeLink} ordering={ordering} onOdaOrder={() => setTab('Oda')} />}
        {tab === 'Shop' && <Shop entries={entries} ordering={ordering} onOdaOrder={() => setTab('Oda')} onDishes={setDishesOf} />}
        {tab === 'Oda' && <OdaTab entries={entries} ordering={ordering} onDishes={setDishesOf} />}
      </div>
      {dishesOf && <Dishes entry={dishesOf} onOpen={openRecipe} onClose={() => setDishesOf(null)} />}

      <nav className="sticky bottom-0 z-2 flex flex-col gap-2 border-t border-line bg-white py-2">
        {!online && <Notice>Frakoblet: endringer lagres når nettet er tilbake</Notice>}
        <div className="flex gap-2">
          {TABS.map(({ tab: t, label, name }) => (
            <Button
              key={t}
              inverted={tab === t}
              onClick={() => {
                setRecipeLink(null)
                setMore(false)
                setTab(t)
              }}
              aria-pressed={tab === t}
              aria-label={name}
              className="flex-1"
            >
              {t === 'Home' ? <span className="text-2xl leading-none">{label}</span> : label}
            </Button>
          ))}
          {/* Names the tab behind it while that one is open. */}
          <Button inverted={!!hidden} onClick={() => setMore(!more)} aria-expanded={more} aria-label="Mer" className="flex-1">
            {hidden && `${hidden.name} `}
            <span className="text-2xl leading-none">⋮</span>
          </Button>
        </div>
        {/* A tap anywhere else closes the menu, and does nothing more. */}
        {more && <div onClick={() => setMore(false)} className="fixed inset-0" />}
        {more && (
          <div
            role="menu"
            className="absolute right-0 bottom-full flex flex-col gap-2 border border-black bg-white p-2"
          >
            <Account user={user} />
            {MORE_TABS.map(({ tab: t, name }) => (
              <Button
                key={t}
                role="menuitem"
                inverted={tab === t}
                onClick={() => {
                  setRecipeLink(null)
                  setMore(false)
                  setTab(t)
                }}
                className="text-left"
              >
                {name}
              </Button>
            ))}
          </div>
        )}
      </nav>
    </main>
  )
}

// A list without bullets; each use sets its gap.
const listClass = 'm-0 flex list-none flex-col p-0'

// An Entry's Note, and the pot with what its dishes need, which lists the dishes.
function Details({ entry, onDishes }: { entry: Entry; onDishes: (entry: Entry) => void }) {
  return (
    <>
      <Note entry={entry} />
      <DishesLink entry={entry} onDishes={onDishes} />
    </>
  )
}

function Note({ entry }: { entry: Entry }) {
  return entry.note && <span className="text-muted"> · {entry.note}</span>
}

function DishesLink({
  entry,
  onDishes,
  tabIndex,
}: {
  entry: Entry
  onDishes: (entry: Entry) => void
  tabIndex?: number
}) {
  return (
    <>
      {entry.dishes && (
        <>
          <span className="text-muted"> · </span>
          <TextButton
            aria-label="Fra middag"
            tabIndex={tabIndex}
            onClick={(e) => {
              // Not the line's own tap: opening it on Hjem, checking it off on Handle.
              e.preventDefault()
              e.stopPropagation()
              onDishes(entry)
            }}
            className="text-muted"
          >
            <Pot /> {formatAmount(entry.dishes)}
          </TextButton>
        </>
      )}
    </>
  )
}

// Dims the screen behind a dialog in its middle.
const overlayClass = 'fixed inset-0 z-3 flex items-center justify-center bg-black/30'
const dialogClass = 'box-border flex w-[min(100%_-_2rem,24rem)] flex-col gap-3 border border-black bg-white p-4'

// The dishes an Entry was added for at Iverksett, each opening its Recipe.
function Dishes({ entry, onOpen, onClose }: { entry: Entry; onOpen: (dish: Dish) => void; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      className={overlayClass}
    >
      <div
        role="dialog"
        aria-label={`${entry.text} fra middag`}
        onClick={(e) => e.stopPropagation()}
        className={dialogClass}
      >
        <div className="flex items-center justify-between">
          <strong className="text-lg">{entry.text}</strong>
          <GlyphButton onClick={onClose} aria-label="Lukk" className="-m-2">
            ✕
          </GlyphButton>
        </div>
        <ul className={`${listClass} gap-2`}>
          {entry.dishes?.map((dish, i) => (
            <li key={i}>
              <Button onClick={() => onOpen(dish)} className="w-full text-left">
                {dish.course}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// "Quick, before I forget": adding and editing Groceries, alphabetically. Entries are never
// checked off here. Removing takes two taps, to avoid misclicks. Nothing changes while an
// Oda Order lasts.
function Home({
  entries,
  ordering,
  onOdaOrder,
  onDishes,
}: {
  entries: Entry[]
  ordering: boolean
  onOdaOrder: () => void
  onDishes: (entry: Entry) => void
}) {
  const wares = useWares()
  const [text, setText] = useState('')
  const [open, setOpen] = useState<{ entryId: string; note: string } | null>(null)

  // What's typed in the field narrows the List, matched like the Suggestions, until it's
  // cleared: by adding, Esc or ✕.
  const typed = typedName(text)
  const filter = ordering ? '' : wareId(typed)
  const addField = useRef<HTMLInputElement>(null)
  const alphabetical = entries
    .filter((e) => e.ware.includes(filter))
    .toSorted((a, b) => a.text.localeCompare(b.text, 'nb'))

  // "+" to add what's typed as it is, unless it's already suggested or waiting on the List,
  // then the Staples suggested for it. Adding takes picking one of these. "+" goes first, so
  // it's never scrolled out of the row.
  const typedWare = wares.find((w) => w.id === wareId(typed))
  const choices = suggest(wares, typed, entries).map((w) => ({ id: w.id, name: w.name, label: w.name }))
  // With nothing typed, "+" opens the most added Staples to pick several at once.
  if (!typed) choices.unshift({ id: '+', name: '', label: '+' })
  else if (
    !choices.some((c) => c.id === wareId(typed)) &&
    !entries.some((e) => e.ware === wareId(typed) && !e.checked)
  ) {
    const name = typedWare?.name ?? typed
    choices.unshift({ id: '+', name, label: `+ ${name}` })
  }
  const [picking, setPicking] = useState(false)

  function choose(c: { name: string }) {
    if (c.name) add(c.name)
    else {
      setActive(-1)
      setPicking(true)
    }
  }
  // The choice picked with Up and Down, while focus stays in the field. -1 is none.
  const [active, setActive] = useState(-1)
  const highlighted = choices[active]
  const listId = useId()

  // Only the choices that fit whole in one row show. The rest wrap onto a second row, which
  // is cut off, and are measured out of the keyboard's reach.
  const chipRow = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ count: Infinity, height: 0 })
  const shown = Math.min(fit.count, choices.length)
  useLayoutEffect(() => {
    const row = chipRow.current
    if (!row) return
    function measure() {
      const chips = [...row!.children] as HTMLElement[]
      if (!chips[0]) return
      const count = chips.filter((c) => c.offsetTop === chips[0].offsetTop).length
      const height = chips[0].offsetHeight
      setFit((f) => (f.count === count && f.height === height ? f : { count, height }))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  })

  function onAddKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' && shown > 0) {
      e.preventDefault()
      setActive(Math.min(active + 1, shown - 1))
    } else if (e.key === 'ArrowUp' && active >= 0) {
      e.preventDefault()
      setActive(active - 1)
    } else if (e.key === 'Escape' && highlighted) {
      e.nativeEvent.stopPropagation()
      setActive(-1)
    } else if (e.key === 'Escape' && text) {
      e.nativeEvent.stopPropagation()
      setText('')
    }
  }

  // A Ware already waiting opens its Entry for the Note instead.
  function add(name: string) {
    const waiting = addEntry(name, entries, wares)
    if (waiting) setOpen({ entryId: waiting.id, note: waiting.note ?? '' })
    setText('')
    setActive(-1)
  }

  // Enter adds only a highlighted choice. Otherwise it goes to the List, keeping the
  // filter, which on a phone also puts the keyboard away.
  function onEnter(e: FormEvent) {
    e.preventDefault()
    if (highlighted) choose(highlighted)
    else if (currentId) focusRow(currentId)
    else addField.current?.blur()
  }

  // The List is one Tab stop: the row last focused, or the first. Arrows move between rows,
  // and typing goes back to the field.
  const [current, setCurrent] = useState<string | null>(null)
  const currentId = alphabetical.some((e) => e.id === current) ? current : (alphabetical[0]?.id ?? null)
  const rows = useRef(new Map<string, HTMLButtonElement>())

  // Right goes to a row's pot and Left back. Moving between rows stays on the pots,
  // landing on the name of a row without one.
  const onPots = useRef(false)
  const potOf = (row?: HTMLElement) =>
    row?.parentElement?.querySelector<HTMLButtonElement>('[aria-label="Fra middag"]')

  function focusRow(id: string, pot = false) {
    setCurrent(id)
    onPots.current = pot
    const row = rows.current.get(id)
    ;((pot && potOf(row)) || row)?.focus()
  }

  function onRowKeyDown(e: ReactKeyboardEvent<HTMLElement>, i: number) {
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: alphabetical.length - 1 }[e.key]
    const pot = potOf(rows.current.get(alphabetical[i].id))
    if (e.key === 'ArrowRight' && pot) {
      e.preventDefault()
      focusRow(alphabetical[i].id, true)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusRow(alphabetical[i].id)
    } else if (to !== undefined) {
      e.preventDefault()
      const row = alphabetical[Math.max(0, Math.min(to, alphabetical.length - 1))]
      if (row) focusRow(row.id, onPots.current)
    } else if (!ordering && e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault()
      setText(text + e.key)
      setActive(-1)
      addField.current?.focus()
    }
  }

  function saveNote() {
    if (!open) return
    const entry = entries.find((e) => e.id === open.entryId)
    if (entry && (entry.note ?? '') !== open.note.trim()) setNote(entry.id, open.note)
  }

  function toggleOpen(entry: Entry) {
    if (open?.entryId === entry.id) setOpen(null)
    else setOpen({ entryId: entry.id, note: entry.note ?? '' })
  }

  // A tap outside the open Entry, or Esc, closes it, keeping the Note. Esc goes back to its row.
  const openRef = useRef<HTMLLIElement>(null)
  useEffect(() => {
    if (!open) return
    // On click, not pointerdown: closing moves the rows below, so the tap would miss its row.
    // A tap on another row has opened that one by now, and it stays open.
    function close() {
      saveNote()
      setOpen((o) => (o?.entryId === open?.entryId ? null : o))
    }
    // The path is taken as the click happened: the button tapped may be gone by now.
    function onClick(e: MouseEvent) {
      if (!openRef.current || !e.composedPath().includes(openRef.current)) close()
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || !open) return
      close()
      focusRow(open.entryId)
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  })

  return (
    <>
      {/* Stays at the top while the List scrolls, to filter or add from anywhere in it. */}
      <div className="sticky top-0 z-1 -my-2 flex flex-col gap-4 border-b border-line bg-white py-2">
        {ordering ? (
          <Notice>
            <OdaOrderLink onClick={onOdaOrder} />
          </Notice>
        ) : (
          <form onSubmit={onEnter} className="flex gap-2">
            <div className="relative flex flex-1">
              <input
                ref={addField}
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setActive(-1)
                }}
                onKeyDown={onAddKeyDown}
                role="combobox"
                aria-expanded={choices.length > 0}
                enterKeyHint="done"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={highlighted ? `${listId}-${active}` : undefined}
                maxLength={100}
                placeholder="Hva trenger vi?"
                aria-label="Hva trenger vi?"
                className="min-w-0 flex-1 p-2 pr-10 text-base"
              />
              {text && (
                <button
                  type="button"
                  aria-label="Tøm"
                  title="Tøm"
                  onClick={() => {
                    setText('')
                    setActive(-1)
                    addField.current?.focus()
                  }}
                  className="absolute inset-y-0 right-0 w-10 text-xl leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </form>
        )}

        {!ordering && choices.length > 0 && (
          <div
            ref={chipRow}
            id={listId}
            role="listbox"
            aria-orientation="horizontal"
            aria-label="Forslag"
            // The padding keeps the highlight's outline from being clipped.
            // content-box: the measured height is the chips', with the padding around it.
            className="-mx-[3px] mt-[calc(-0.5rem_-_3px)] -mb-[3px] box-content flex flex-wrap gap-2 overflow-hidden p-[3px]"
            style={{ height: fit.height || undefined }}
          >
            {choices.map((s, i) => (
              <Button
                small
                key={s.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                aria-hidden={i >= shown || undefined}
                tabIndex={-1}
                onClick={() => choose(s)}
                // A long typed name is cut short rather than pushing past the row. "+" makes a
                // new Ware rather than picking a Staple, so it looks apart.
                className={`max-w-full shrink-0 truncate ${s.id === '+' ? 'bg-subtle' : ''} ${i === active ? 'outline-2 outline-offset-1 outline-black' : ''}`}
              >
                {s.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <ul className={listClass}>
        {alphabetical.map((entry, i) => {
          const isOpen = !ordering && open?.entryId === entry.id
          const tabIndex = entry.id === currentId ? 0 : -1
          return (
            <li
              key={entry.id}
              ref={isOpen ? openRef : undefined}
              className="flex min-h-11 flex-col justify-center gap-2 border-b border-line py-2 text-lg"
            >
              <div className="flex items-center gap-3">
                <span
                  onClick={() => !ordering && toggleOpen(entry)}
                  onKeyDown={(e) => onRowKeyDown(e, i)}
                  className={`min-w-0 flex-1 wrap-anywhere ${ordering ? 'cursor-default' : 'cursor-pointer'} ${entry.checked ? 'line-through opacity-40' : ''}`}
                >
                  <button
                    ref={(el) => {
                      if (el) rows.current.set(entry.id, el)
                      else rows.current.delete(entry.id)
                    }}
                    type="button"
                    tabIndex={tabIndex}
                    aria-expanded={ordering ? undefined : isOpen}
                    onFocus={() => setCurrent(entry.id)}
                    className="cursor-[inherit] text-left [text-decoration:inherit]"
                  >
                    {entry.text}
                    <Note entry={entry} />
                  </button>
                  <DishesLink entry={entry} onDishes={onDishes} tabIndex={tabIndex} />
                </span>
                {isOpen && (
                    <Button
                      small
                      type="button"
                      onClick={() => {
                        removeEntry(entry.id)
                        setOpen(null)
                        const next = alphabetical[i + 1] ?? alphabetical[i - 1]
                        if (next) focusRow(next.id)
                      }}
                    >
                      Fjern
                    </Button>
                )}
              </div>
              {isOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveNote()
                    setOpen(null)
                    focusRow(entry.id)
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    value={open.note}
                    onChange={(e) => setOpen({ ...open, note: e.target.value })}
                    onBlur={saveNote}
                    // Usually replaced rather than amended.
                    onFocus={(e) => e.target.select()}
                    maxLength={200}
                    placeholder="Notat"
                    aria-label="Notat"
                    className="min-w-0 flex-1 p-1 text-base"
                  />
                </form>
              )}
              {isOpen && <OdaProductLine ware={wares.find((w) => w.id === entry.ware)} />}
            </li>
          )
        })}
      </ul>

      {picking && (
        <StaplePicker
          wares={wares}
          entries={entries}
          onClose={(names) => {
            for (const name of names) addEntry(name, entries, wares)
            setPicking(false)
            addField.current?.focus()
          }}
        />
      )}
    </>
  )
}

// The 30 most added Staples not already waiting, most added first, to tick several and add
// them all when the list closes, however it's closed.
function StaplePicker({
  wares,
  entries,
  onClose,
}: {
  wares: Ware[]
  entries: Entry[]
  onClose: (names: string[]) => void
}) {
  const [staples] = useState(() => {
    const waiting = new Set(entries.filter((e) => !e.checked).map((e) => e.ware))
    return wares
      .filter((w) => isStaple(w) && !waiting.has(w.id))
      .toSorted((a, b) => b.addCount - a.addCount)
      .slice(0, 30)
  })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const close = () => onClose(staples.filter((w) => picked.has(w.id)).map((w) => w.name))

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  function toggle(id: string) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  return (
    <div
      onClick={close}
      className={overlayClass}
    >
      {/* dvh: the phone's visible height, without its address bar. */}
      <div
        role="dialog"
        aria-label="Legg til fra basisvarer"
        onClick={(e) => e.stopPropagation()}
        className={`${dialogClass} max-h-[calc(100dvh_-_4rem)]`}
      >
        <strong className="text-lg">Legg til</strong>
        {staples.length === 0 ? (
          <div className="text-muted">Alle basisvarene står allerede på lista</div>
        ) : (
          // Only the list scrolls, keeping the title and button in view. min-h-0 lets it
          // shrink below its content.
          <ul className={`${listClass} min-h-0 overflow-y-auto`}>
            {staples.map((w, i) => (
              <li key={w.id} className="border-b border-line">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 py-1 text-lg wrap-anywhere">
                  <input
                    type="checkbox"
                    autoFocus={i === 0}
                    checked={picked.has(w.id)}
                    onChange={() => toggle(w.id)}
                    className="size-5 shrink-0"
                  />
                  {w.name}
                </label>
              </li>
            ))}
          </ul>
        )}
        {picked.size > 0 ? <MainAction onClick={close}>Legg til {picked.size}</MainAction> : <Button onClick={close}>Lukk</Button>}
      </div>
    </div>
  )
}

// Who's signed in, as initials in the top right of the ⋮ menu, opening the full name and
// Logg ut below them. Rarely needed, so kept small and one tap away.
function Account({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const name = user.displayName ?? user.email ?? ''
  const words = name.split(/[\s@.]+/).filter(Boolean)
  const initials = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? '?')).toUpperCase()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Konto: ${name}`}
        title={name}
        className={`size-11 rounded-full bg-subtle font-bold ${initials.length > 1 ? 'text-sm' : 'text-lg'}`}
      >
        {initials}
      </button>
      {open && (
        <div className="flex flex-col gap-2 self-stretch border-b border-line pb-2 text-sm text-muted">
          {user.displayName && <span className="text-black">{user.displayName}</span>}
          {user.email && <span>{user.email}</span>}
          <Button small onClick={() => signOut()} className="self-start">
            Logg ut
          </Button>
        </div>
      )}
    </div>
  )
}

// The Ware's Oda Product, opening on oda.com, or "Aldri fra Oda". Changing it is removing it
// and choosing again, searching Oda in its place.
function OdaProductLine({ ware }: { ware?: Ware }) {
  const [searching, setSearching] = useState(false)
  if (!ware) return null

  return (
    <div className="flex flex-col gap-2 text-sm text-muted">
      {ware.neverOda ? (
        <div className="flex items-center gap-3">
          Aldri fra Oda
          <ClearButton label="Fjern Aldri fra Oda" onClick={() => setNeverOda(ware.id, false)} />
        </div>
      ) : ware.oda ? (
        <div className="flex items-center gap-3">
          <a href={odaProductUrl(ware.oda.id)} target="_blank" rel="noreferrer">
            {ware.oda.name}
            {ware.oda.packText && ` · ${ware.oda.packText}`}
          </a>
          <ClearButton label="Fjern Oda-produkt" onClick={() => setOdaProduct(ware.id, null)} />
        </div>
      ) : searching ? (
        <OdaSearch ware={ware} onClose={() => setSearching(false)} />
      ) : (
        <Button small onClick={() => setSearching(true)} className="self-start">
          Velg Oda-produkt
        </Button>
      )}
    </div>
  )
}

// Suggested or picked in the choosing, by Ware id, not yet saved.
type Picks = Record<string, OdaResult>

const toOdaProduct = (p: OdaProduct) => ({ id: p.id, name: p.name, packText: p.packText })

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    // Inside a line of text, so it overhangs the line rather than making it taller.
    <GlyphButton onClick={onClick} aria-label={label} title={label} className="-my-3 text-black">
      ×
    </GlyphButton>
  )
}

// A search field over Oda with its results below it: ↑/↓ to move, Enter to pick, Esc to close
// the list and Esc again, or leaving it, to close the search. It searches as you type, starting
// with the Ware's name. A pasted link to an Oda Product picks it when the search finds that id.
// The last row marks the Ware never from Oda.
type OdaRow = OdaResult | 'more' | 'never'

// onPick takes the pick instead of saving it on the Ware. Choosing what replaces an unavailable
// product (replacing), nothing unavailable can be picked and the Ware can't become never from Oda.
function OdaSearch({
  ware,
  onClose,
  onPick,
  replacing,
}: {
  ware: Ware
  onClose: () => void
  onPick?: (p: OdaResult) => void
  replacing?: 'substitute' | 'gone'
}) {
  const [query, setQuery] = useState(ware.name)
  // 'idle' while the text is too short to search.
  const [search, setSearch] = useState<Search | 'idle' | 'searching' | 'error'>('searching')
  const [all, setAll] = useState(false)
  const [message, setMessage] = useState('')
  const latest = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const unpickable = (p: OdaResult) => !!replacing && !p.available

  function pick(p: OdaResult) {
    if (onPick) onPick(p)
    else setOdaProduct(ware.id, toOdaProduct(p))
    onClose()
  }

  async function run(q: string) {
    const n = ++latest.current
    const link = parseOdaUrl(q)
    setAll(false)
    setMessage('')
    if (link && !link.words) {
      setSearch({ linked: true, products: [] })
      setMessage('Fant ikke produktet fra lenken')
      return
    }
    setSearch('searching')
    try {
      const result = await searchOda(link ? link.words : q)
      if (n !== latest.current) return
      setSearch(result)
      if (!link || !result.linked) return
      const hit = result.products.find((p) => p.id === link.id)
      if (!hit) setMessage('Fant ikke produktet fra lenken')
      else if (unpickable(hit)) setMessage('Produktet er ikke tilgjengelig')
      else pick(hit)
    } catch {
      if (n === latest.current) setSearch('error')
    }
  }

  // Waits for a pause in typing, except for a pasted link. Earlier results go at once, so
  // nothing in the list moves under the pointer.
  function schedule(q: string) {
    clearTimeout(timer.current)
    latest.current++
    setMessage('')
    const t = q.trim()
    if (parseOdaUrl(t)) run(t)
    else if (t.length < 2) setSearch('idle')
    else {
      setSearch('searching')
      timer.current = setTimeout(() => run(t), 400)
    }
  }

  // Searches once, when the search opens.
  useEffect(() => {
    const n = ++latest.current
    searchOda(ware.name).then(
      (result) => n === latest.current && setSearch(result),
      () => n === latest.current && setSearch('error'),
    )
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const products = typeof search === 'object' && search.linked ? search.products : []
  // Rows only for a finished search.
  const rows: OdaRow[] =
    typeof search === 'object' && search.linked
      ? [...(all ? products : products.slice(0, 5)), ...(!all && products.length > 5 ? ['more' as const] : []), ...(replacing ? [] : ['never' as const])]
      : []

  const { isOpen, highlightedIndex, getInputProps, getMenuProps, getItemProps } = useCombobox<OdaRow>({
    items: rows,
    inputValue: query,
    selectedItem: null,
    initialIsOpen: true,
    itemToString: (row) => (typeof row === 'object' && row ? row.name : ''),
    isItemDisabled: (row) => typeof row === 'object' && unpickable(row),
    onInputValueChange: ({ inputValue, type }) => {
      if (type !== useCombobox.stateChangeTypes.InputChange) return
      setQuery(inputValue)
      schedule(inputValue)
    },
    onSelectedItemChange: ({ selectedItem }) => {
      if (selectedItem === 'more') setAll(true)
      else if (selectedItem === 'never') {
        setNeverOda(ware.id, true)
        onClose()
      } else if (selectedItem) pick(selectedItem)
    },
    stateReducer: (state, { type, changes }) => {
      // Leaving the field never picks, and "Flere" keeps the list open where it was.
      if (type === useCombobox.stateChangeTypes.InputBlur)
        return { ...changes, selectedItem: state.selectedItem, inputValue: state.inputValue }
      if (changes.selectedItem === 'more')
        return { ...changes, isOpen: true, inputValue: state.inputValue, highlightedIndex: state.highlightedIndex }
      return changes
    },
  })

  const listed = isOpen && rows.length > 0

  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onClose()
      }}
      // Esc is the search's own, so it doesn't also close the Entry around it.
      onKeyDown={(e) => e.key === 'Escape' && e.nativeEvent.stopPropagation()}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col">
        <input
          {...getInputProps({
            autoFocus: true,
            onFocus: (e) => e.target.select(),
            onKeyDown: (e) => {
              // Esc with the list closed closes the search.
              if (e.key === 'Escape' && !isOpen) {
                ;(e.nativeEvent as { preventDownshiftDefault?: boolean }).preventDownshiftDefault = true
                onClose()
              }
            },
          })}
          maxLength={200}
          placeholder="Søk, eller lim inn lenke fra oda.com"
          aria-label="Søk på Oda"
          className={`p-2 text-base ${listed ? 'border-b-line' : ''}`}
        />
        <ul {...getMenuProps()} className={listed ? 'border-x border-b border-black' : ''}>
          {listed &&
            rows.map((row, index) => {
              const off = typeof row === 'object' && unpickable(row)
              return (
                <li
                  key={typeof row === 'object' ? row.id : row}
                  {...getItemProps({ item: row, index })}
                  className={`flex min-h-11 items-center px-2 py-1 wrap-anywhere ${off ? 'cursor-default text-faint' : 'cursor-pointer text-black'} ${highlightedIndex === index ? 'bg-subtle' : ''}`}
                >
                  {row === 'more' ? (
                    'Flere...'
                  ) : row === 'never' ? (
                    'Aldri fra Oda'
                  ) : (
                    <>
                      {row.name}
                      {row.packText && ` · ${row.packText}`}
                      {row.price !== null && ` · ${row.price.toFixed(2).replace('.', ',')} kr`}
                      {!row.available && ' · ikke tilgjengelig'}
                    </>
                  )}
                </li>
              )
            })}
        </ul>
      </div>
      {search === 'searching' && <StatusLine>Søker …</StatusLine>}
      {search === 'error' && <ErrorLine>Oda svarer ikke</ErrorLine>}
      {typeof search === 'object' && !search.linked && (
        <Button small onClick={() => linkOda()} className="self-start">
          Koble til Oda
        </Button>
      )}
      {message && <ErrorLine>{message}</ErrorLine>}
      {typeof search === 'object' && search.linked && products.length === 0 && !message && <div className="text-muted">Ingen treff</div>}
    </div>
  )
}

const varer = (n: number) => `${n} ${n === 1 ? 'vare' : 'varer'}`

// A question before acting, naming both its buttons.
function Ask({ text, go, onGo, onBack }: { text: string; go: string; onGo: () => void; onBack: () => void }) {
  return (
    <div role="alert">
      <Notice box className="flex flex-col gap-2">
        {text}
        <div className="flex gap-2">
          <Button small onClick={onGo}>
            {go}
          </Button>
          <Button small onClick={onBack}>
            Tilbake
          </Button>
        </div>
      </Notice>
    </div>
  )
}

// "I'm in the store": unchecked first, big text, one tap to check off. Read-only while an Oda
// Order lasts.
function Shop({
  entries,
  ordering,
  onOdaOrder,
  onDishes,
}: {
  entries: Entry[]
  ordering: boolean
  onOdaOrder: () => void
  onDishes: (entry: Entry) => void
}) {
  // Entries checked off here stay in place until the screen sleeps or another tab opens
  // (which unmounts Handle), so the List doesn't jump around while shopping.
  const [lingering, setLingering] = useState<Set<string>>(new Set())
  function toggle(id: string, on: boolean) {
    toggleEntry(id, on)
    setLingering((l) => {
      const next = new Set(l)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }
  useEffect(() => {
    const onHide = () => document.hidden && setLingering(new Set())
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])
  const inPlace = (e: Entry) => !e.checked || lingering.has(e.id)

  // In Store Order. A drop's orders show at once and until Firestore has them, so the old
  // order doesn't flash back.
  const wares = useWares()
  const [dropped, setDropped] = useState<Map<string, number> | null>(null)
  const order = (e: Entry) => dropped?.get(e.ware) ?? storeOrder(e, wares)
  const unchecked = inStoreOrder(entries.filter(inPlace), order)
  const checked = inStoreOrder(
    entries.filter((e) => !inPlace(e)),
    order,
  )

  // While dragging, the dragged Entry and the index it would land at, shown there live.
  const [drag, setDrag] = useState<{ id: string; to: number } | null>(null)
  const items = useRef(new Map<string, HTMLLIElement>())
  const dragged = drag && unchecked.find((e) => e.id === drag.id)
  const shown = dragged ? unchecked.filter((e) => e !== dragged).toSpliced(drag.to, 0, dragged) : unchecked
  const dropAt = (id: string, y: number) =>
    unchecked.filter((e) => {
      const r = e.id !== id && items.current.get(e.id)?.getBoundingClientRect()
      return r && r.top + r.height / 2 < y
    }).length
  // An Entry not yet timed counts as added now.
  function drop(id: string, to: number, now: number) {
    const moved = unchecked.find((e) => e.id === id)
    if (!moved) return
    const others = unchecked.filter((e) => e !== moved)
    const writes = dropOrders(others, moved, to, wares, (e) => Math.min(order(e), now))
    setDropped(new Map(writes))
    setOrders(writes)
      .catch(console.error)
      .finally(() => setDropped(null))
  }
  // Listens on window: reordering moves the dragged row in the DOM, which would lose pointer
  // capture. The listeners reach the latest drop through a ref.
  const dropRef = useRef(drop)
  useLayoutEffect(() => {
    dropRef.current = drop
  })
  const dragId = drag?.id
  useEffect(() => {
    if (!dragId) return
    let to = -1
    const move = (e: PointerEvent) => {
      to = dropAt(dragId, e.clientY)
      setDrag({ id: dragId, to })
    }
    const up = () => {
      if (to >= 0) dropRef.current(dragId, to, Date.now())
      setDrag(null)
    }
    const cancel = () => setDrag(null)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    // dropAt reads only refs and the rows, which the drag doesn't change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId])

  const row = (entry: Entry, i: number) => (
    <li
      key={entry.id}
      ref={(el) => {
        if (el) items.current.set(entry.id, el)
        else items.current.delete(entry.id)
      }}
      className={`flex min-h-11 items-center gap-3 border-b border-line py-2 text-xl ${entry.checked ? 'opacity-40' : ''} ${drag?.id === entry.id ? 'outline-2 -outline-offset-2 outline-black' : ''}`}
    >
      <label className={`flex min-w-0 flex-1 items-center gap-3 ${ordering ? 'cursor-default' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={entry.checked}
          disabled={ordering}
          onChange={(e) => toggle(entry.id, e.target.checked)}
          className="size-6 shrink-0"
        />
        <span className={`min-w-0 wrap-anywhere ${entry.checked ? 'line-through' : ''}`}>
          {entry.text}
          <Details entry={entry} onDishes={onDishes} />
        </span>
      </label>
      {!entry.checked && !ordering && (
        <div
          aria-label={`Flytt ${entry.text}`}
          onPointerDown={(e) => {
            e.preventDefault()
            setDrag({ id: entry.id, to: i })
          }}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center select-none"
        >
          {/* Drawn, not the ↕ glyph, so the row's text is just the Entry's. */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 4 V20 M8 8 L12 4 L16 8 M8 16 L12 20 L16 16" />
          </svg>
        </div>
      )}
    </li>
  )

  return (
    <>
      {ordering && (
        <Notice>
          <OdaOrderLink onClick={onOdaOrder} />
        </Notice>
      )}
      <ul className={listClass}>{shown.map(row)}</ul>
      {/* Folded away below the List, so checking off the first Entry doesn't push the List down. */}
      {checked.length > 0 && (
        <details>
          <summary className="py-2 text-lg font-bold">Avkrysset ({checked.length})</summary>
          <div className="flex flex-col gap-3">
            <ul className={listClass}>{checked.map(row)}</ul>
            {!ordering && (
              <Button small onClick={() => removeEntries(checked)} className="self-end">
                Fjern avkryssede
              </Button>
            )}
          </div>
        </details>
      )}
    </>
  )
}

// Each Oda Product of these Entries' Basket lines with the Entries it's for, both alphabetically.
function byProduct(entries: Entry[]) {
  const lines = entries
    .flatMap((entry) => (entry.basket ? [{ entry, line: entry.basket }] : []))
    .toSorted((a, b) => a.entry.text.localeCompare(b.entry.text, 'nb'))
  return [...new Set(lines.map((l) => l.line.productId))]
    .map((id) => lines.filter((l) => l.line.productId === id))
    .sort((a, b) => a[0].line.name.localeCompare(b[0].line.name, 'nb'))
}

// Odabestilling: the choosing, or while an Oda Order lasts, the step after filling or the Order
// Summary. "Koble til Oda" when the Family has no working Oda Link. The choosing is kept only on
// this device; the Oda Order replaces it on every device.
function OdaTab({ entries, ordering, onDishes }: { entries: Entry[]; ordering: boolean; onDishes: (entry: Entry) => void }) {
  const basket = useBasket()
  const [linking, setLinking] = useState(false)
  // The choosing stays until filling is over, and the Entries found unavailable have arrived, so
  // the Oda Order doesn't show for a moment before the step, and a failed fill loses nothing.
  const [filling, setFilling] = useState(false)
  const [unavailable, setUnavailable] = useState<string[]>([])
  const [adding, setAdding] = useState<{ entries: Entry[]; outcome?: 'done' | 'failed' } | null>(null)
  const settling = entries.some((e) => unavailable.includes(e.id) && e.basket && e.basket.quantity > 0)
  // Only until they've arrived: a Substitute gives the same Entries packs again.
  if (unavailable.length > 0 && !settling) setUnavailable([])
  useEffect(warmUp, [])

  const waiting = entries.filter((e) => e.basket?.quantity === 0 && !e.basket.left && !e.basket.shared)
  // Through the call and until its outcome has arrived, as odaSubstitute changes the lines before
  // Oda answers and changes them back if it refuses.
  if (adding?.outcome && (!ordering || (adding.outcome === 'done') === (waiting.length === 0))) setAdding(null)

  if (ordering && !filling && !settling) {
    if (adding || waiting.length > 0) {
      return (
        <SubstituteStep
          entries={adding?.entries ?? waiting}
          onDishes={onDishes}
          onStart={() => setAdding({ entries: waiting })}
          onEnd={(outcome) => setAdding((a) => a && { ...a, outcome })}
        />
      )
    }
    return <OrderSummary entries={entries} onDishes={onDishes} />
  }
  if (basket && basket !== 'error' && !basket.linked) {
    return (
      <div className="flex flex-col gap-2">
        <MainAction
          disabled={linking}
          onClick={() => {
            setLinking(true)
            linkOda().catch(() => setLinking(false))
          }}
          className="self-start"
        >
          Koble til Oda
        </MainAction>
        {linkResult === 'error' && <ErrorLine>Koblingen ble ikke fullført</ErrorLine>}
      </div>
    )
  }
  return (
    <>
      {/* What's already in the Basket stays there through the Oda Order. */}
      {basket === null ? (
        <StatusLine>Oda: henter handlekurven …</StatusLine>
      ) : basket === 'error' ? (
        <ErrorLine>Oda svarer ikke</ErrorLine>
      ) : (
        <div className="text-muted">
          <a href={basket.url} target="_blank" rel="noreferrer">
            Oda: {varer(basket.items)} i handlekurven
          </a>
        </div>
      )}
      {(filling || settling) && <FillingBasket />}
      <Choosing
        entries={entries.filter((e) => !e.checked)}
        setFilling={setFilling}
        setUnavailable={setUnavailable}
        onDishes={onDishes}
      />
    </>
  )
}

// Choosing which unchecked Entries to order from Oda: "Nye varer" first, whose Wares have no Oda
// Product yet, then "Tidligere kjøpte varer", each alphabetically. A Ware without an Oda Product
// gets one suggested when the choosing opens: the first search hit for its name, preferring one
// that's available. Only Entries whose Ware has an Oda Product start ticked. Picks made here are saved on their Wares only when the
// Basket is filled, and only for ticked Entries. Wares never from Oda wait, folded, at the bottom.
//
function Choosing({
  entries,
  setFilling,
  setUnavailable,
  onDishes,
}: {
  entries: Entry[]
  setFilling: (filling: boolean) => void
  setUnavailable: (ids: string[]) => void
  onDishes: (entry: Entry) => void
}) {
  const wares = useWares()
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [picks, setPicks] = useState<Picks>({})
  const [suggesting, setSuggesting] = useState(true)
  const suggested = useRef(false)
  const [unfolded, setUnfolded] = useState(false)
  const [tried, setTried] = useState(false)
  const [error, setError] = useState('')

  const rows = entries
    .map((entry) => ({ entry, ware: wares.find((w) => w.id === entry.ware) }))
    .sort((a, b) => a.entry.text.localeCompare(b.entry.text, 'nb'))
  const outside = rows.filter((r) => r.ware?.neverOda)
  const inside = rows.filter((r) => !r.ware?.neverOda)
  // Wares never given an Oda Product first, then those bought from Oda before.
  const fresh = inside.filter((r) => !r.ware?.oda)
  const known = inside.filter((r) => r.ware?.oda)
  const pickOf = (r: (typeof rows)[number]) => (r.ware && !r.ware.oda ? picks[r.ware.id] : undefined)
  // Only Tidligere kjøpte varer start ticked: a suggestion is checked by ticking it.
  const ticked = (r: (typeof rows)[number]) => ticks[r.entry.id] ?? !!r.ware?.oda
  const chosen = inside.filter(ticked)
  const lacking = new Set(chosen.filter((r) => !r.ware?.oda && !pickOf(r)).map((r) => r.entry.id))

  // Once, as soon as the Wares and Entries have loaded. Back from linking Oda, the app opens here
  // and either can come first.
  useEffect(() => {
    if (suggested.current || wares.length === 0 || entries.length === 0) return
    suggested.current = true
    const want = inside.flatMap((r) => (r.ware && !r.ware.oda ? [r.ware] : []))
    const done = () => setSuggesting(false)
    if (want.length === 0) return void Promise.resolve().then(done)
    suggestOda(want.map((w) => w.name))
      .then((res) => {
        if (!res.linked) return
        const next: Record<string, OdaResult> = {}
        want.forEach((w, i) => {
          const p = res.products[i].find((p) => p.available) ?? res.products[i][0]
          if (p) next[w.id] = p
        })
        // A pick made while the suggestions were on their way wins.
        setPicks((picks) => ({ ...next, ...picks }))
      })
      .catch(() => {})
      .finally(done)
  }, [entries, inside, wares])

  const row = (r: (typeof rows)[number]) => {
    const marked = tried && lacking.has(r.entry.id)
    return (
      <li key={r.entry.id} className="flex min-h-11 flex-col justify-center gap-1 border-b border-line py-2 text-lg">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={ticked(r)}
            onChange={(e) => setTicks({ ...ticks, [r.entry.id]: e.target.checked })}
            className="size-5 shrink-0"
          />
          <span className={`min-w-0 wrap-anywhere ${marked ? 'font-semibold text-danger' : 'font-normal'}`}>
            {r.entry.text}
            <Details entry={r.entry} onDishes={onDishes} />
          </span>
        </label>
        <div className="pl-8">
          {r.ware?.oda ? (
            <OdaProductLine ware={r.ware} />
          ) : (
            r.ware && (
              <PickLine
                ware={r.ware}
                picks={picks}
                suggesting={suggesting}
                onPick={(p) => {
                  setPicks({ ...picks, [r.ware!.id]: p })
                  setTicks({ ...ticks, [r.entry.id]: true })
                }}
              />
            )
          )}
        </div>
      </li>
    )
  }
  // Nye varer say once, under their heading, that their suggestions are on the way.
  const section = (title: string, rs: typeof rows, status?: string) =>
    rs.length > 0 && (
      <section className="flex flex-col gap-2">
        <h3 className="text-lg font-bold">{title}</h3>
        {status && <StatusLine>{status}</StatusLine>}
        <ul className={listClass}>{rs.map(row)}</ul>
      </section>
    )

  async function fill() {
    setTried(true)
    setError('')
    if (lacking.size > 0) return
    setFilling(true)
    try {
      // The function reads the Oda Products from the Wares, so they're saved first.
      const links = chosen.flatMap((r): [string, OdaProduct][] => {
        const p = pickOf(r)
        return r.ware && p ? [[r.ware.id, toOdaProduct(p)]] : []
      })
      if (links.length > 0) await setOdaProducts(links)
      // Filled, the Oda Order begins and takes the choosing's place.
      const filled = await fillBasket(chosen.map((r) => r.entry.id))
      if (!filled.linked) setError('Koble til Oda på nytt')
      else setUnavailable(filled.unavailable ?? [])
    } catch {
      setError('Fikk ikke fylt handlekurven')
    } finally {
      setFilling(false)
    }
  }

  return (
    <>
      {section('Nye varer', fresh, suggesting ? 'Finner Oda-produkter …' : undefined)}
      {section('Tidligere kjøpte varer', known)}
      {outside.length > 0 && (
        <div className="flex flex-col gap-2">
          <TextButton onClick={() => setUnfolded(!unfolded)} aria-expanded={unfolded} className="self-start py-2 text-lg font-bold">
            {unfolded ? '▾' : '▸'} Utenfor Oda ({outside.length})
          </TextButton>
          {unfolded && (
            <ul className={listClass}>
              {outside.map((r) => (
                <li key={r.entry.id} className="flex min-h-11 flex-col justify-center gap-1 border-b border-line py-2 text-muted">
                  <span>
                    {r.entry.text}
                    <Details entry={r.entry} onDishes={onDishes} />
                  </span>
                  <div className="flex items-center gap-3 text-sm">
                    Aldri fra Oda
                    {/* Moves the Entry up, unticked. */}
                    <ClearButton
                      label="Fjern Aldri fra Oda"
                      onClick={() => {
                        setTicks({ ...ticks, [r.entry.id]: false })
                        setNeverOda(r.entry.ware, false)
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {tried && lacking.size > 0 && <ErrorLine>Alle varer må ha et Oda-produkt</ErrorLine>}
      {error && <ErrorLine>{error}</ErrorLine>}
      <MainAction onClick={fill} disabled={chosen.length === 0} className="self-start">
        Fyll handlekurven
      </MainAction>
    </>
  )
}

// Covers the whole screen, tabs too, while Oda works on the Basket, which can take several seconds.
function FillingBasket() {
  return (
    <div
      role="status"
      className="fixed inset-0 z-3 flex items-center justify-center bg-white text-lg"
    >
      Fyller handlekurven …
    </div>
  )
}

// An Oda Product's Pack Count, from 1 to 20. With no count yet it's empty and its buttons are
// disabled. Everything keeps its place, so nothing moves when the count arrives. What it has to say
// shows on its own row.
function PackStepper({
  count,
  disabled,
  note,
  onChange,
}: {
  count: number | null
  disabled: boolean
  note: string
  onChange: (count: number) => void
}) {
  return (
    <div className="flex items-center">
      <GlyphButton aria-label="Færre pakker" disabled={disabled || count === null || count <= 1} onClick={() => onChange(count! - 1)} className="-ml-3">
        −
      </GlyphButton>
      <span aria-label="Antall pakker" className="min-w-[2ch] text-center text-lg">
        {count}
      </span>
      <GlyphButton aria-label="Flere pakker" disabled={disabled || count === null || count >= MAX_PACKS} onClick={() => onChange(count! + 1)}>
        +
      </GlyphButton>
      {note && <span className="text-accent">{note}</span>}
    </div>
  )
}

const lineClass = 'text-sm text-muted'

// An Oda Product picked or suggested in the choosing, not yet saved on the Ware. It reads like a
// saved one, linking to oda.com; × opens the search in its place, starting with the Ware's name.
function PickLine({
  ware,
  picks,
  suggesting,
  onPick,
}: {
  ware: Ware
  picks: Picks
  suggesting: boolean
  onPick: (p: OdaResult) => void
}) {
  const [searching, setSearching] = useState(false)
  const pick: OdaResult | undefined = picks[ware.id]
  if (searching) {
    return (
      <div className={lineClass}>
        <OdaSearch ware={ware} onPick={onPick} onClose={() => setSearching(false)} />
      </div>
    )
  }
  if (pick) {
    return (
      <div className={`${lineClass} flex items-center gap-3`}>
        <a href={odaProductUrl(pick.id)} target="_blank" rel="noreferrer">
          {pick.name}
          {pick.packText && ` · ${pick.packText}`}
        </a>
        {!pick.available && 'ikke tilgjengelig'}
        <ClearButton label="Bytt Oda-produkt" onClick={() => setSearching(true)} />
      </div>
    )
  }
  // Said once for the Section, not on every line.
  if (suggesting) return null
  return (
    <Button small onClick={() => setSearching(true)}>
      Velg Oda-produkt
    </Button>
  )
}

// After filling, what wasn't available, laid out like the Order Summary: each Oda Product with the
// Entries it's for below it, and one search for what to put in the Basket instead. For a
// temporarily unavailable product that's a Substitute, for this Oda Order only. For an Off Sale one
// it becomes the Ware's Oda Product, saved first. What gets nothing is Left Out. Picks last until a
// button is pressed, and through a call that fails.
function SubstituteStep({
  entries,
  onDishes,
  onStart,
  onEnd,
}: {
  entries: Entry[]
  onDishes: (entry: Entry) => void
  onStart: () => void
  onEnd: (outcome: 'done' | 'failed') => void
}) {
  const wares = useWares()
  // By the id of the Oda Product they replace.
  const [picks, setPicks] = useState<Record<number, OdaResult>>({})
  const [busy, setBusy] = useState<'adding' | 'skipping' | null>(null)
  const [error, setError] = useState('')
  const wareOf = (entry: Entry) => wares.find((w) => w.id === entry.ware)
  const products = byProduct(entries)
  const picked = entries.flatMap((entry) => {
    const pick = picks[entry.basket?.productId ?? 0]
    return pick ? [{ entry, pick }] : []
  })

  async function finish(chosen: typeof picked) {
    setBusy(chosen.length > 0 ? 'adding' : 'skipping')
    setError('')
    onStart()
    let outcome: 'done' | 'failed' = 'done'
    try {
      const links = chosen.flatMap(({ entry, pick }): [string, OdaProduct][] => {
        const ware = wareOf(entry)
        return entry.basket?.gone && ware ? [[ware.id, toOdaProduct(pick)]] : []
      })
      if (links.length > 0) await setOdaProducts(links)
      const filled = await substituteBasket(chosen.map(({ entry, pick }) => ({ id: entry.id, product: toOdaProduct(pick) })))
      if (!filled) {
        setError('Koble til Oda på nytt')
        outcome = 'failed'
      }
    } catch (e) {
      setError('Oda svarer ikke')
      // Another device got there first, so these Entries aren't coming back to this step.
      if ((e as { code?: string }).code !== 'functions/failed-precondition') outcome = 'failed'
    } finally {
      setBusy(null)
      onEnd(outcome)
    }
  }

  return (
    <>
      {busy === 'adding' && <FillingBasket />}
      <div>Dette er ikke tilgjengelig på Oda. Velg noe annet å bestille, eller hopp over.</div>
      <ul className={listClass}>
        {products.map((needs) => {
          const { productId, name, packText, gone } = needs[0].line
          const ware = wareOf(needs[0].entry)
          return (
            <li key={productId} className="flex flex-col gap-1 border-b border-line py-2">
              <div className="text-lg wrap-anywhere">
                {name}
                {packText && ` · ${packText}`} · {gone ? 'ikke lenger tilgjengelig' : 'ikke tilgjengelig'}
              </div>
              {needs.map(({ entry }) => (
                <div key={entry.id} className={lineClass}>
                  {entry.text}
                  <Details entry={entry} onDishes={onDishes} />
                </div>
              ))}
              {ware && (
                <ReplaceLine
                  ware={ware}
                  replacing={gone ? 'gone' : 'substitute'}
                  pick={picks[productId]}
                  onPick={(p) => setPicks((all) => ({ ...all, [productId]: p }))}
                  onClear={() =>
                    setPicks((all) => Object.fromEntries(Object.entries(all).filter(([id]) => Number(id) !== productId)))
                  }
                />
              )}
            </li>
          )
        })}
      </ul>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div className="flex items-center gap-2">
        <MainAction onClick={() => finish(picked)} disabled={picked.length === 0 || !!busy}>
          Legg i handlekurven
        </MainAction>
        <Button onClick={() => finish([])} disabled={!!busy}>
          Hopp over
        </Button>
      </div>
    </>
  )
}

// What replaces an unavailable product: its search, or what's picked, which × takes away again.
function ReplaceLine({
  ware,
  replacing,
  pick,
  onPick,
  onClear,
}: {
  ware: Ware
  replacing: 'substitute' | 'gone'
  pick?: OdaResult
  onPick: (p: OdaResult) => void
  onClear: () => void
}) {
  const [searching, setSearching] = useState(false)
  if (searching) {
    return (
      <div className={lineClass}>
        <OdaSearch ware={ware} replacing={replacing} onPick={onPick} onClose={() => setSearching(false)} />
      </div>
    )
  }
  if (pick) {
    return (
      <div className={`${lineClass} flex items-center gap-3`}>
        <a href={odaProductUrl(pick.id)} target="_blank" rel="noreferrer">
          {pick.name}
          {pick.packText && ` · ${pick.packText}`}
        </a>
        <ClearButton label={replacing === 'gone' ? 'Fjern Oda-produkt' : 'Fjern erstatning'} onClick={onClear} />
      </div>
    )
  }
  return (
    <Button small onClick={() => setSearching(true)} className="self-start">
      {replacing === 'gone' ? 'Velg nytt Oda-produkt' : 'Velg erstatning'}
    </Button>
  )
}

type ProductNeeds = ReturnType<typeof byProduct>[number]

const isUncounted = (needs: ProductNeeds) => needs.some(({ line }) => line.uncounted)
const needsAmounts = (needs: ProductNeeds) => needs.some(({ entry }) => hasAmounts(entry.dishes ?? []))

// The first saved Pack Size among the product's Entries, which are alphabetical.
function savedSize(needs: ProductNeeds, wares: Ware[]) {
  for (const { entry, line } of needs) {
    const oda = wares.find((w) => w.id === entry.ware)?.oda
    if (oda?.id === line.productId && oda.packGrams) return oda
  }
}

const startingCount = (needs: ProductNeeds, size?: { packGrams?: number; packPieces?: number } | null) =>
  startingPacks(needs.map(({ entry }) => entry.dishes ?? []), size ?? {})

// Sets the starting Pack Counts of the products not yet counted. Those that need no reading go in
// the Basket at once, so a slow read holds up nothing but its own products. Pack Sizes nobody has
// saved are read in one request, for products where an Entry has amounts, and saved at once on the
// Wares whose own Oda Product it is, even if the Oda Order is later Cancelled. A Substitute's is
// used once. A product whose Pack Size can't be read stays not yet counted. Returns what went wrong
// with Oda, if anything.
async function setStartingCounts(needing: ProductNeeds[], wares: Ware[], onRead: (sizes: Record<number, PackSize | null>) => void) {
  const land = async (counts: { productId: number; count: number }[]) => {
    if (counts.length === 0) return ''
    try {
      return (await setPacks(counts, true)) ? '' : 'Koble til Oda på nytt'
    } catch {
      return 'Oda svarer ikke'
    }
  }
  const unread = needing.filter((needs) => needsAmounts(needs) && !savedSize(needs, wares))
  const known = needing.filter((needs) => !unread.includes(needs))

  const readAndLand = async () => {
    if (unread.length === 0) return ''
    const products = unread.map((needs) => ({ id: needs[0].line.productId, name: needs[0].line.name, packText: needs[0].line.packText }))
    const read = await readPackSizes(products).catch((e) => {
      console.warn('Fikk ikke lest pakningsstørrelser:', e)
      return unread.map(() => null)
    })
    onRead(Object.fromEntries(products.map((p, i) => [p.id, read[i]])))
    const links = unread.flatMap((needs, i) => {
      const size = read[i]
      if (!size) return []
      return needs.flatMap(({ entry, line }): [string, OdaProduct][] => {
        const ware = wares.find((w) => w.id === entry.ware)
        return ware?.oda?.id === line.productId ? [[ware.id, { ...toOdaProduct(ware.oda), ...size }]] : []
      })
    })
    if (links.length > 0) setOdaProducts(links).catch(console.warn)
    return land(unread.flatMap((needs, i) => (read[i] ? [{ productId: needs[0].line.productId, count: startingCount(needs, read[i]) }] : [])))
  }

  const errors = await Promise.all([
    land(known.map((needs) => ({ productId: needs[0].line.productId, count: startingCount(needs, savedSize(needs, wares)) }))),
    readAndLand(),
  ])
  return errors.find(Boolean) ?? ''
}

// What the Oda Order put in the Basket: what's next, then each Oda Product with its Pack Count and
// the In Basket Entries it's for, both alphabetically, then what was Left Out. While any product
// isn't yet counted, each device that opens it does the counting once, with "Bestilt" and "Avbryt"
// disabled. Whatever fails, they open up afterwards, so a Gemini outage never blocks an order.
function OrderSummary({ entries, onDishes }: { entries: Entry[]; onDishes: (entry: Entry) => void }) {
  const wares = useWares()
  const leftOut = entries.filter((e) => e.basket?.left)
  const products = byProduct(entries.filter((e) => e.basket && (e.basket.quantity > 0 || e.basket.shared)))
  const [counting, setCounting] = useState(() => products.some(isUncounted))
  const [countError, setCountError] = useState('')
  // Read here, by Oda Product id, or null if that failed.
  const [sizes, setSizes] = useState<Record<number, PackSize | null>>({})
  // "Bestilt", "Avbryt" and the steppers wait for each other on this device.
  const [busy, setBusy] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (!counting || started.current || wares.length === 0) return
    started.current = true
    setStartingCounts(products.filter(isUncounted), wares, setSizes)
      .then(setCountError)
      .finally(() => setCounting(false))
  }, [counting, products, wares])

  return (
    <>
      <OdaOrder counting={counting} countError={countError} busy={busy} setBusy={setBusy} />
      <ul className={listClass}>
        {products.map((needs) => (
          <OrderProduct
            key={needs[0].line.productId}
            needs={needs}
            wares={wares}
            read={sizes[needs[0].line.productId]}
            counting={counting}
            busy={busy}
            setBusy={setBusy}
            onDishes={onDishes}
          />
        ))}
      </ul>
      {leftOut.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-bold">Ikke tilgjengelig</h3>
          <ul className={listClass}>
            {leftOut.map((entry) => (
              <li key={entry.id} className="border-b border-line py-2 text-lg text-muted wrap-anywhere">
                {entry.text}
                <Details entry={entry} onDishes={onDishes} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// One Oda Product on the Order Summary. Its stepper shows a new count at once, changes the real
// Basket, and goes back if Oda fails. A product not yet counted shows the count it's about to get,
// as soon as that's known, and none while its Pack Size is being read. "Sjekk antall" when no Pack
// Size could be read for it, until the stepper is used.
function OrderProduct({
  needs,
  wares,
  read,
  counting,
  busy,
  setBusy,
  onDishes,
}: {
  needs: ProductNeeds
  wares: Ware[]
  read: PackSize | null | undefined
  counting: boolean
  busy: boolean
  setBusy: (busy: boolean) => void
  onDishes: (entry: Entry) => void
}) {
  const { productId, name, packText } = needs[0].line
  const [pending, setPending] = useState<number | null>(null)
  const [error, setError] = useState('')
  const uncounted = isUncounted(needs)
  const size = savedSize(needs, wares) ?? read
  const sizeless = uncounted && needsAmounts(needs) && !size
  const reading = counting && sizeless && read === undefined
  const landing = counting && uncounted && !sizeless
  const count = reading ? null : landing ? startingCount(needs, size) : needs.reduce((sum, { line }) => sum + line.quantity, 0)

  async function change(count: number) {
    setBusy(true)
    setPending(count)
    setError('')
    try {
      if (!(await setPacks([{ productId, count }]))) setError('Koble til Oda på nytt')
    } catch {
      setError('Oda svarer ikke')
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col border-b border-line py-2">
      <a href={odaProductUrl(productId)} target="_blank" rel="noreferrer" className="text-lg wrap-anywhere">
        {name}
        {packText && ` · ${packText}`}
      </a>
      <PackStepper
        count={pending ?? count}
        disabled={busy}
        note={error || (sizeless && !reading ? 'Sjekk antall' : '')}
        onChange={change}
      />
      {needs.map(({ entry }) => (
        <div key={entry.id} className={lineClass}>
          {entry.text}
          <Details entry={entry} onDishes={onDishes} />
        </div>
      ))}
    </li>
  )
}

// While an Oda Order lasts: the next step is the Family Member's own, ordering in the Basket on
// oda.com. Anyone may end it, with "Bestilt" or "Avbryt". Avbryt asks first, then takes out of
// the Basket exactly what Kraft put in. While counting both wait, and a line of text takes the
// place of what's next, which keeps its height, so nothing moves when counting ends.
function OdaOrder({
  counting,
  countError,
  busy,
  setBusy,
}: {
  counting: boolean
  countError: string
  busy: boolean
  setBusy: (busy: boolean) => void
}) {
  const basket = useBasket()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState('')
  const url = basket && basket !== 'error' && basket.linked ? basket.url : 'https://oda.com/no/cart/'

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch {
      setError('Oda svarer ikke')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!(await cancelOda())) setError('Koble til Oda på nytt')
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {counting && (
          <div className="absolute">
            <StatusLine>Regner ut antall pakker …</StatusLine>
          </div>
        )}
        <div className={counting ? 'invisible' : 'visible'}>
          Neste steg er ditt: bestill i{' '}
          <a href={url} target="_blank" rel="noreferrer">
            handlekurven på oda.com
          </a>
        </div>
      </div>
      <div className="flex gap-2">
        <MainAction onClick={() => act(orderedOda)} disabled={counting || busy || asking}>
          Bestilt
        </MainAction>
        <Button onClick={() => setAsking(true)} disabled={counting || busy || asking}>
          Avbryt
        </Button>
      </div>
      {asking && (
        <Ask
          text="Ta ut varene Kraft la i handlekurven?"
          go="Avbryt odabestillingen"
          onGo={() => {
            setAsking(false)
            act(cancel)
          }}
          onBack={() => setAsking(false)}
        />
      )}
      {(error || countError) && <ErrorLine>{error || countError}</ErrorLine>}
    </div>
  )
}
