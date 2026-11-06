import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCombobox } from 'downshift'
import { type User } from 'firebase/auth'
import { MealsTab, OdaOrderLink } from './Meals'
import { readPackSizes, warmUp } from './ai'
import { MAX_PACKS, type PackSize, formatAmount, packCount } from './amounts'
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
  substituteBasket,
  suggestOda,
  useBasket,
  type OdaResult,
  type Search,
} from './oda'
import {
  addEntry,
  removeEntries,
  removeEntry,
  setNeverOda,
  setNote,
  setOdaProduct,
  setOdaProducts,
  suggest,
  toggleEntry,
  useAccess,
  useEntries,
  useRemoveCheckedAfterShopping,
  useWares,
  wareId,
  wareName,
  type Dish,
  type Entry,
  type OdaProduct,
  type Ware,
} from './entries'

const centerStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '1.25rem',
} as const

const buttonStyle = {
  fontSize: '1rem',
  padding: '0.5rem 1rem',
  cursor: 'pointer',
}

export default function App() {
  const { user, loading: userLoading } = useUser()
  const { access, loading: accessLoading } = useAccess(user)

  if (userLoading) return null

  if (!user) {
    return (
      <main style={centerStyle}>
        <button style={buttonStyle} onClick={() => signInWithGoogle()}>
          Logg inn med Google
        </button>
      </main>
    )
  }

  if (accessLoading) return null

  if (access !== 'authorized') {
    return (
      <main style={centerStyle}>
        <div>
          {access === 'unreachable'
            ? "Får ikke kontakt. Sjekk nettet og prøv igjen."
            : 'Ingen tilgang. Be admin legge til Google-kontoen din.'}
        </div>
        <button style={buttonStyle} onClick={() => signOut()}>
          Logg ut
        </button>
      </main>
    )
  }

  return <List user={user} />
}

const smallButtonStyle = { ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.75rem' }

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
    <main
      style={{
        minHeight: '100vh',
        padding: '1rem',
        width: 'min(100%, 32rem)',
        margin: '0 auto',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxSizing: 'border-box',
      }}
    >
      {!online && (
        <div style={{ fontSize: '0.875rem', color: '#8a5a00' }}>Frakoblet: endringer lagres når nettet er tilbake</div>
      )}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.875rem',
          color: '#555',
        }}
      >
        <span>{user.displayName ?? user.email}</span>
        <button onClick={() => signOut()} style={smallButtonStyle}>
          Logg ut
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tab === 'Home' && <Home entries={entries} ordering={ordering} onOdaOrder={() => setTab('Oda')} onDishes={setDishesOf} />}
        {tab === 'Meals' && <MealsTab openAt={recipeLink} ordering={ordering} onOdaOrder={() => setTab('Oda')} />}
        {tab === 'Shop' && <Shop entries={entries} ordering={ordering} onOdaOrder={() => setTab('Oda')} onDishes={setDishesOf} />}
        {tab === 'Oda' && <OdaTab entries={entries} ordering={ordering} onDishes={setDishesOf} />}
      </div>
      {dishesOf && <Dishes entry={dishesOf} onOpen={openRecipe} onClose={() => setDishesOf(null)} />}

      <nav
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 2,
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem 0',
          background: 'white',
          borderTop: '1px solid #ddd',
        }}
      >
        {TABS.map(({ tab: t, label, name }) => (
          <button
            key={t}
            onClick={() => {
              setRecipeLink(null)
              setMore(false)
              setTab(t)
            }}
            aria-pressed={tab === t}
            aria-label={name}
            style={{
              ...buttonStyle,
              flex: 1,
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? 'black' : '#666',
            }}
          >
            {t === 'Home' ? <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{label}</span> : label}
          </button>
        ))}
        {/* Names the tab behind it while that one is open. */}
        <button
          onClick={() => setMore(!more)}
          aria-expanded={more}
          aria-label="Mer"
          style={{
            ...buttonStyle,
            flex: 1,
            fontWeight: hidden ? 700 : 400,
            color: hidden ? 'black' : '#666',
          }}
        >
          {hidden && `${hidden.name} `}
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>⋮</span>
        </button>
        {/* A tap anywhere else closes the menu, and does nothing more. */}
        {more && <div onClick={() => setMore(false)} style={{ position: 'fixed', inset: 0 }} />}
        {more && (
          <div
            role="menu"
            style={{
              position: 'absolute',
              right: 0,
              bottom: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              padding: '0.5rem',
              background: 'white',
              border: '1px solid #ddd',
              borderRadius: '0.5rem',
            }}
          >
            {MORE_TABS.map(({ tab: t, name }) => (
              <button
                key={t}
                role="menuitem"
                onClick={() => {
                  setRecipeLink(null)
                  setMore(false)
                  setTab(t)
                }}
                style={{ ...buttonStyle, fontWeight: tab === t ? 700 : 400, textAlign: 'left' }}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </nav>
    </main>
  )
}

const listStyle = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
} as const

// The dishes an Entry is for: a chef's hat, drawn in the text's colour and size, so it sits
// in the line like the ⌂ and ↻ glyphs. Unicode has no plain one, only a colour emoji.
function ChefsHat() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ width: '1.1em', height: '1.1em', verticalAlign: '-0.2em' }}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
    >
      <path d="M7 20 V15 A3.5 3.5 0 0 1 7.6 8.1 A4.5 4.5 0 0 1 16.4 8.1 A3.5 3.5 0 0 1 17 15 V20 Z M7 17 H17" />
    </svg>
  )
}

// An Entry's Note, and the chef's hat with what its dishes need, which lists the dishes.
function Details({ entry, onDishes }: { entry: Entry; onDishes: (entry: Entry) => void }) {
  return (
    <>
      {entry.note && <span style={{ color: '#666' }}> · {entry.note}</span>}
      {entry.dishes && (
        <>
          <span style={{ color: '#666' }}> · </span>
          <button
            aria-label="Fra middag"
            onClick={(e) => {
              // Not the line's own tap: opening it on Hjem, checking it off on Handle.
              e.preventDefault()
              e.stopPropagation()
              onDishes(entry)
            }}
            style={{ font: 'inherit', color: '#666', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <ChefsHat /> {formatAmount(entry.dishes)}
          </button>
        </>
      )}
    </>
  )
}

// The dishes an Entry was added for at Iverksett, each opening its Recipe.
function Dishes({ entry, onOpen, onClose }: { entry: Entry; onOpen: (dish: Dish) => void; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3,
        background: 'rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-label={`${entry.text} fra middag`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'white',
          padding: '1rem',
          width: 'min(100% - 2rem, 24rem)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '1.125rem' }}>{entry.text}</strong>
          <button onClick={onClose} aria-label="Lukk" style={smallButtonStyle}>
            ✕
          </button>
        </div>
        <ul style={listStyle}>
          {entry.dishes?.map((dish, i) => (
            <li key={i}>
              <button
                onClick={() => onOpen(dish)}
                style={{ ...buttonStyle, width: '100%', textAlign: 'left', fontSize: '1.125rem' }}
              >
                {dish.course}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// "Quick, before I forget": adding and editing Groceries, newest first. Entries are never
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

  const newestFirst = entries.toReversed()

  const suggestions = suggest(wares, text, entries)

  // Typed text that matches a Ware adds that Ware under its own name. A Ware already
  // waiting opens its Entry for the Note instead.
  function add(name: string) {
    const waiting = addEntry(name, entries)
    if (waiting) setOpen({ entryId: waiting.id, note: waiting.note ?? '' })
    setText('')
  }

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = wareName(text)
    if (t) add(wares.find((w) => w.id === wareId(t))?.name ?? t)
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

  return (
    <>
      {ordering ? (
        <div style={{ color: '#8a5a00' }}>
          <OdaOrderLink onClick={onOdaOrder} />
        </div>
      ) : (
        <form onSubmit={onAdd} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={100}
            placeholder="Hva trenger vi?"
            style={{ flex: 1, fontSize: '1rem', padding: '0.5rem' }}
          />
          <button type="submit" style={buttonStyle}>
            Legg til
          </button>
        </form>
      )}

      {!ordering && suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '-0.5rem' }}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => add(s.name)}
              style={smallButtonStyle}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <ul style={listStyle}>
        {newestFirst.map((entry) => {
          const isOpen = !ordering && open?.entryId === entry.id
          return (
            <li
              key={entry.id}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '1.125rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  onClick={() => !ordering && toggleOpen(entry)}
                  style={{
                    flex: 1,
                    cursor: ordering ? 'default' : 'pointer',
                    opacity: entry.checked ? 0.4 : 1,
                    textDecoration: entry.checked ? 'line-through' : 'none',
                  }}
                >
                  {entry.text}
                  <Details entry={entry} onDishes={onDishes} />
                </span>
              </div>
              {isOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveNote()
                    setOpen(null)
                  }}
                  style={{ display: 'flex', gap: '0.5rem' }}
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
                    style={{ flex: 1, minWidth: 0, fontSize: '1rem', padding: '0.25rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      removeEntry(entry.id)
                      setOpen(null)
                    }}
                    style={smallButtonStyle}
                  >
                    Fjern
                  </button>
                </form>
              )}
              {isOpen && <OdaProductLine ware={wares.find((w) => w.id === entry.ware)} wares={wares} entries={entries} />}
            </li>
          )
        })}
      </ul>
    </>
  )
}

// The Ware's Oda Product, opening on oda.com, or "Aldri fra Oda". Changing it is removing it
// and choosing again, searching Oda in its place.
function OdaProductLine({ ware, wares, entries, picks }: { ware?: Ware; wares: Ware[]; entries: Entry[]; picks?: Picks }) {
  const [searching, setSearching] = useState(false)
  if (!ware) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: '#555' }}>
      {ware.neverOda ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          Aldri fra Oda
          <ClearButton label="Fjern Aldri fra Oda" onClick={() => setNeverOda(ware.id, false)} />
        </div>
      ) : ware.oda ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <a href={odaProductUrl(ware.oda.id)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            {ware.oda.name}
            {ware.oda.packText && ` · ${ware.oda.packText}`}
          </a>
          <AlsoOn ware={ware} wares={wares} entries={entries} picks={picks} productId={ware.oda.id} />
          <ClearButton label="Fjern Oda-produkt" onClick={() => setOdaProduct(ware.id, null)} />
        </div>
      ) : searching ? (
        <OdaSearch ware={ware} onClose={() => setSearching(false)} />
      ) : (
        <button onClick={() => setSearching(true)} style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}>
          Velg Oda-produkt
        </button>
      )}
    </div>
  )
}

// Suggested or picked in the choosing, by Ware id, not yet saved.
type Picks = Record<string, OdaResult>

// The other Wares waiting on the List with this Oda Product, saved or in the choosing's picks,
// ticked or not. They may share it, but it's worth knowing, as they may be the same thing. A Ware
// whose Entry is Checked or Removed is no longer in the way.
function AlsoOn({
  ware,
  wares,
  entries,
  picks,
  productId,
}: {
  ware: Ware
  wares: Ware[]
  entries: Entry[]
  picks?: Picks
  productId: number
}) {
  const productOf = (w: Ware) => w.oda?.id ?? (w.neverOda ? undefined : picks?.[w.id]?.id)
  const waiting = (w: Ware) => entries.some((e) => e.ware === w.id && !e.checked)
  const others = wares.filter((w) => w.id !== ware.id && productOf(w) === productId && waiting(w))
  if (others.length === 0) return null
  return <span style={{ color: '#8a5a00' }}>også på {others.map((w) => `«${w.name}»`).join(', ')}</span>
}

const toOdaProduct = (p: OdaProduct) => ({ id: p.id, name: p.name, packText: p.packText })

function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{ font: 'inherit', fontSize: '1.25rem', lineHeight: 1, color: '#000', padding: 0, border: 'none', background: 'none', cursor: 'pointer' }}
    >
      ×
    </button>
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
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          style={{
            fontSize: '1rem',
            padding: '0.25rem',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: listed ? '#888 #888 #ddd' : '#888',
          }}
        />
        <ul
          {...getMenuProps()}
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            borderWidth: 1,
            borderStyle: listed ? 'none solid solid' : 'none',
            borderColor: '#888',
          }}
        >
          {listed &&
            rows.map((row, index) => {
              const off = typeof row === 'object' && unpickable(row)
              return (
                <li
                  key={typeof row === 'object' ? row.id : row}
                  {...getItemProps({ item: row, index })}
                  style={{
                    padding: '0.375rem 0.5rem',
                    cursor: off ? 'default' : 'pointer',
                    background: highlightedIndex === index ? '#eee' : 'transparent',
                    color: off ? '#888' : '#222',
                  }}
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
      {search === 'searching' && <div>Søker …</div>}
      {search === 'error' && <div>Oda svarer ikke</div>}
      {typeof search === 'object' && !search.linked && (
        <button onClick={() => linkOda()} style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}>
          Koble til Oda
        </button>
      )}
      {message && <div style={{ color: '#8a5a00' }}>{message}</div>}
      {typeof search === 'object' && search.linked && products.length === 0 && !message && <div>Ingen treff</div>}
    </div>
  )
}

const askStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.75rem',
  border: '1px solid #e0c080',
  background: '#fff8e8',
  color: '#5a3c00',
} as const

const varer = (n: number) => `${n} ${n === 1 ? 'vare' : 'varer'}`

// A question before acting, naming both its buttons.
function Ask({ text, go, onGo, onBack }: { text: string; go: string; onGo: () => void; onBack: () => void }) {
  return (
    <div role="alert" style={askStyle}>
      {text}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={onGo} style={smallButtonStyle}>
          {go}
        </button>
        <button onClick={onBack} style={smallButtonStyle}>
          Tilbake
        </button>
      </div>
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
  const unchecked = entries.filter((e) => !e.checked)
  const checked = entries.filter((e) => e.checked)

  return (
    <>
      {ordering && (
        <div style={{ color: '#8a5a00' }}>
          <OdaOrderLink onClick={onOdaOrder} />
        </div>
      )}
      <ul style={{ ...listStyle, gap: '0.75rem' }}>
        {[...unchecked, ...checked].map((entry) => (
          <li key={entry.id} style={{ fontSize: '1.375rem', opacity: entry.checked ? 0.4 : 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: ordering ? 'default' : 'pointer' }}>
              <input
                type="checkbox"
                checked={entry.checked}
                disabled={ordering}
                onChange={(e) => toggleEntry(entry.id, e.target.checked)}
                style={{ width: '1.5rem', height: '1.5rem' }}
              />
              <span style={{ textDecoration: entry.checked ? 'line-through' : 'none' }}>
                {entry.text}
                <Details entry={entry} onDishes={onDishes} />
              </span>
            </label>
          </li>
        ))}
      </ul>
      {/* Below the List, so checking off the first Entry doesn't push the List down. */}
      {!ordering && checked.length > 0 && (
        <button onClick={() => removeEntries(checked)} style={{ ...smallButtonStyle, alignSelf: 'flex-end' }}>
          Fjern avkryssede
        </button>
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

// Odabestilling: the choosing, or while an Oda Order lasts, the Order Summary, read-only: what's
// next, then each Oda Product with its packs added up and the In Basket Entries it's for below it,
// both alphabetically. "Koble til Oda" when the Family has no working
// Oda Link. The choosing is kept only on this device; the Oda Order replaces it on every device.
function OdaTab({ entries, ordering, onDishes }: { entries: Entry[]; ordering: boolean; onDishes: (entry: Entry) => void }) {
  const basket = useBasket()
  const [linking, setLinking] = useState(false)
  // The choosing stays until filling is over, and the Entries found unavailable have arrived, so
  // the Oda Order doesn't show for a moment before the step, and a failed fill loses nothing.
  const [filling, setFilling] = useState(false)
  const [unavailable, setUnavailable] = useState<string[]>([])
  const settling = entries.some((e) => unavailable.includes(e.id) && e.basket && e.basket.quantity > 0)
  // Only until they've arrived: a Substitute gives the same Entries packs again.
  if (unavailable.length > 0 && !settling) setUnavailable([])
  useEffect(warmUp, [])

  if (ordering && !filling && !settling) {
    const waiting = entries.filter((e) => e.basket?.quantity === 0 && !e.basket.left && !e.basket.shared)
    if (waiting.length > 0) return <SubstituteStep entries={waiting} onDishes={onDishes} />
    const leftOut = entries.filter((e) => e.basket?.left)
    const products = byProduct(entries.filter((e) => e.basket && (e.basket.quantity > 0 || e.basket.shared)))
    return (
      <>
        <h2 style={{ fontSize: '1.375rem', margin: 0 }}>Oppsummering odabestilling</h2>
        <OdaOrder />
        <ul style={{ ...listStyle, gap: '0.75rem' }}>
          {products.map((needs) => {
            const { productId, name, packText } = needs[0].line
            return (
              <li key={productId} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <a href={odaProductUrl(productId)} target="_blank" rel="noreferrer" style={{ fontSize: '1.125rem', color: 'inherit' }}>
                  {needs.reduce((sum, b) => sum + b.line.quantity, 0)} × {name}
                  {packText && ` · ${packText}`}
                </a>
                {needs.map(({ entry }) => (
                  <div key={entry.id} style={{ fontSize: '0.875rem', color: '#555' }}>
                    {entry.text}
                    <Details entry={entry} onDishes={onDishes} />
                  </div>
                ))}
              </li>
            )
          })}
        </ul>
        {leftOut.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, color: '#555' }}>Ikke tilgjengelig</h3>
            <ul style={{ ...listStyle, gap: '0.75rem' }}>
              {leftOut.map((entry) => (
                <li key={entry.id} style={{ fontSize: '1.125rem', color: '#555' }}>
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
  if (basket && basket !== 'error' && !basket.linked) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem', color: '#8a5a00' }}>
        <button
          disabled={linking}
          onClick={() => {
            setLinking(true)
            linkOda().catch(() => setLinking(false))
          }}
          style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
        >
          Koble til Oda
        </button>
        {linkResult === 'error' && 'Koblingen ble ikke fullført'}
      </div>
    )
  }
  return (
    <>
      {/* What's already in the Basket stays there through the Oda Order. */}
      <div style={{ fontSize: '0.875rem', color: '#555' }}>
        {basket === null ? (
          'Oda: henter handlekurven …'
        ) : basket === 'error' ? (
          'Oda svarer ikke'
        ) : (
          <a href={basket.url} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            Oda: {varer(basket.items)} i handlekurven
          </a>
        )}
      </div>
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

type PackRow = { entry: Entry; ware: Ware | undefined }

// Each Entry's Pack Count comes from its dishes and its Oda Product's Pack Size, which the AI
// reads once, in one request, for the products that need it, when ready. A count set by hand lasts
// as long as its Oda Product does.
function usePackCounts(rows: PackRow[], productOf: (r: PackRow) => OdaProduct | undefined, ready: boolean) {
  // Set by hand, by Entry id, for the Oda Product they were set on.
  const [handCounts, setHandCounts] = useState<Record<string, { product: number; count: number }>>({})
  // Read by the AI here, by Oda Product id, not yet saved.
  const [sizes, setSizes] = useState<Record<number, PackSize | 'failed'>>({})
  const asked = useRef(new Set<number>())
  const hasAmounts = (e: Entry) => (e.dishes ?? []).some((d) => d.grams !== null || d.pieces !== null)
  const packs = (r: PackRow) => {
    const product = productOf(r)
    if (!product) return null
    const hand = handCounts[r.entry.id]
    if (hand?.product === product.id) return { count: hand.count }
    if (!hasAmounts(r.entry)) return { count: 1 }
    const size = product.packGrams ? product : sizes[product.id]
    if (!size) return { count: 1, waiting: true }
    if (size === 'failed') return { count: 1, failed: true }
    return { count: packCount(r.entry.dishes ?? [], size) }
  }
  const unsized = rows.flatMap((r) => {
    const product = productOf(r)
    return product && hasAmounts(r.entry) && !product.packGrams ? [product] : []
  })

  // Once ready, then again for anything that comes to need a Pack Size. Leaving the tab and coming
  // back asks again for what failed.
  useEffect(() => {
    if (!ready) return
    const want = [...new Map(unsized.filter((p) => !asked.current.has(p.id)).map((p) => [p.id, p])).values()]
    if (want.length === 0) return
    for (const p of want) asked.current.add(p.id)
    readPackSizes(want)
      .catch((e) => {
        console.warn('Fikk ikke lest pakningsstørrelser:', e)
        return want.map(() => null)
      })
      .then((answers) => setSizes((s) => ({ ...s, ...Object.fromEntries(want.map((p, i) => [p.id, answers[i] ?? 'failed'])) })))
  }, [ready, unsized])

  const setHandCount = (r: PackRow, count: number) => setHandCounts((h) => ({ ...h, [r.entry.id]: { product: productOf(r)!.id, count } }))
  return { packs, setHandCount, sizes }
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
  const productOf = (r: (typeof rows)[number]): OdaProduct | undefined => r.ware?.oda ?? pickOf(r)
  const { packs, setHandCount, sizes } = usePackCounts(inside, productOf, !suggesting)
  const counting = chosen.some((r) => packs(r)?.waiting)

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
    const pack = packs(r)
    const setCount = (count: number) => {
      setHandCount(r, count)
      setTicks({ ...ticks, [r.entry.id]: true })
    }
    return (
      <li key={r.entry.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '1.125rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={ticked(r)}
            onChange={(e) => setTicks({ ...ticks, [r.entry.id]: e.target.checked })}
            style={{ width: '1.25rem', height: '1.25rem' }}
          />
          <span style={{ color: marked ? '#b00020' : 'inherit', fontWeight: marked ? 600 : 400 }}>
            {r.entry.text}
            <Details entry={r.entry} onDishes={onDishes} />
          </span>
        </label>
        <div style={{ paddingLeft: '2rem' }}>
          {r.ware?.oda ? (
            <OdaProductLine ware={r.ware} wares={wares} entries={entries} picks={picks} />
          ) : (
            r.ware && (
              <PickLine
                ware={r.ware}
                wares={wares}
                entries={entries}
                picks={picks}
                suggesting={suggesting}
                onPick={(p) => {
                  setPicks({ ...picks, [r.ware!.id]: p })
                  setTicks({ ...ticks, [r.entry.id]: true })
                }}
              />
            )
          )}
          {pack && <PackStepper {...pack} onChange={setCount} />}
        </div>
      </li>
    )
  }
  // Nye varer sit in a frame, apart from the Wares bought before.
  const section = (title: string, rs: typeof rows, framed = false) =>
    rs.length > 0 && (
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          ...(framed && { padding: '0.75rem', border: '1px solid #d8dde6', borderRadius: '0.5rem', background: '#f4f6fa' }),
        }}
      >
        <h3 style={{ fontSize: '1rem', margin: 0, color: '#555' }}>{title}</h3>
        <ul style={{ ...listStyle, gap: '0.75rem' }}>{rs.map(row)}</ul>
      </section>
    )

  async function fill() {
    setTried(true)
    setError('')
    if (lacking.size > 0) return
    setFilling(true)
    try {
      // The function reads the Oda Products from the Wares, so they're saved first, with any
      // Pack Size read here.
      const links = chosen.flatMap((r): [string, OdaProduct][] => {
        const p = productOf(r)
        if (!r.ware || !p) return []
        const size = sizes[p.id]
        const read = size && size !== 'failed' ? size : undefined
        return pickOf(r) || read ? [[r.ware.id, { ...toOdaProduct(p), ...read }]] : []
      })
      if (links.length > 0) await setOdaProducts(links)
      // Filled, the Oda Order begins and takes the choosing's place.
      const filled = await fillBasket(chosen.map((r) => ({ id: r.entry.id, quantity: packs(r)?.count ?? 1 })))
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
      {section('Nye varer', fresh, true)}
      {section('Tidligere kjøpte varer', known)}
      {outside.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button
            onClick={() => setUnfolded(!unfolded)}
            aria-expanded={unfolded}
            style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}
          >
            {unfolded ? '▾' : '▸'} Utenfor Oda ({outside.length})
          </button>
          {unfolded && (
            <ul style={listStyle}>
              {outside.map((r) => (
                <li key={r.entry.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: '#555' }}>
                  <span>
                    {r.entry.text}
                    <Details entry={r.entry} onDishes={onDishes} />
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
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
      {tried && lacking.size > 0 && <div style={{ color: '#b00020' }}>Alle varer må ha et Oda-produkt</div>}
      {error && <div style={{ color: '#8a5a00' }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button onClick={fill} disabled={chosen.length === 0 || counting} style={buttonStyle}>
          Fyll handlekurven
        </button>
        {counting && <span style={{ fontSize: '0.875rem', color: '#555' }}>Regner ut antall pakker …</span>}
      </div>
    </>
  )
}

// Covers the whole screen, tabs too, while Oda works on the Basket, which can take several seconds.
function FillingBasket() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3,
        background: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.125rem',
      }}
    >
      Fyller handlekurven …
    </div>
  )
}

// An Entry's Pack Count, changed by hand from 1 to 20, and not while the AI is reading its Pack
// Size. If that failed, it says so until the count is changed.
function PackStepper({
  count,
  waiting,
  failed,
  onChange,
}: {
  count: number
  waiting?: boolean
  failed?: boolean
  onChange: (count: number) => void
}) {
  const step = { ...smallButtonStyle, padding: '0 0.625rem' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.875rem', color: '#555' }}>
      <button aria-label="Færre pakker" disabled={waiting || count <= 1} onClick={() => onChange(count - 1)} style={step}>
        −
      </button>
      <span aria-label="Antall pakker">{waiting ? '…' : count}</span>
      <button aria-label="Flere pakker" disabled={waiting || count >= MAX_PACKS} onClick={() => onChange(count + 1)} style={step}>
        +
      </button>
      {failed && <span style={{ color: '#8a5a00' }}>Fikk ikke regnet ut antall pakker</span>}
    </div>
  )
}

// An Oda Product picked or suggested in the choosing, not yet saved on the Ware. It reads like a
// saved one, linking to oda.com; × opens the search in its place, starting with the Ware's name.
function PickLine({
  ware,
  wares,
  entries,
  picks,
  suggesting,
  onPick,
}: {
  ware: Ware
  wares: Ware[]
  entries: Entry[]
  picks: Picks
  suggesting: boolean
  onPick: (p: OdaResult) => void
}) {
  const [searching, setSearching] = useState(false)
  const pick: OdaResult | undefined = picks[ware.id]
  const lineStyle = { fontSize: '0.875rem', color: '#555' }

  if (searching) {
    return (
      <div style={lineStyle}>
        <OdaSearch ware={ware} onPick={onPick} onClose={() => setSearching(false)} />
      </div>
    )
  }
  if (pick) {
    return (
      <div style={{ ...lineStyle, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <a href={odaProductUrl(pick.id)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          {pick.name}
          {pick.packText && ` · ${pick.packText}`}
        </a>
        {!pick.available && 'ikke tilgjengelig'}
        <AlsoOn ware={ware} wares={wares} entries={entries} picks={picks} productId={pick.id} />
        <ClearButton label="Bytt Oda-produkt" onClick={() => setSearching(true)} />
      </div>
    )
  }
  if (suggesting) return <div style={lineStyle}>Finner Oda-produkt …</div>
  return (
    <button onClick={() => setSearching(true)} style={smallButtonStyle}>
      Velg Oda-produkt
    </button>
  )
}

// After filling, what wasn't available, laid out like the Order Summary: each Oda Product with the
// Entries it's for below it, and one search for what to put in the Basket instead, with one Pack
// Count, starting at what its Entries add up to. For a temporarily unavailable product that's a Substitute, for this Oda Order
// only. For an Off Sale one it becomes the Ware's Oda Product, saved first with any Pack Size read
// here. What gets nothing is Left Out. Picks last until a button is pressed.
function SubstituteStep({ entries, onDishes }: { entries: Entry[]; onDishes: (entry: Entry) => void }) {
  const wares = useWares()
  // By the id of the Oda Product they replace.
  const [picks, setPicks] = useState<Record<number, OdaResult>>({})
  const [busy, setBusy] = useState<'adding' | 'skipping' | null>(null)
  const [error, setError] = useState('')
  const rows = entries.map((entry) => ({ entry, ware: wares.find((w) => w.id === entry.ware) }))
  const productOf = (r: PackRow) => picks[r.entry.basket?.productId ?? 0]
  const { packs, sizes } = usePackCounts(rows, productOf, true)
  // Set by hand, by the id of the Oda Product replaced, for the pick they were set on.
  const [handCounts, setHandCounts] = useState<Record<number, { product: number; count: number }>>({})
  const products = byProduct(entries)
  const packsFor = (needs: (typeof products)[number]) => {
    const { productId } = needs[0].line
    const pick = picks[productId]
    if (!pick) return null
    const hand = handCounts[productId]
    if (hand?.product === pick.id) return { count: hand.count }
    const each = rows.filter((r) => needs.some((n) => n.entry.id === r.entry.id)).map(packs)
    return {
      count: Math.min(MAX_PACKS, each.reduce((sum, p) => sum + (p?.count ?? 1), 0)),
      waiting: each.some((p) => p?.waiting),
      failed: each.some((p) => p?.failed),
    }
  }
  const picked = rows.filter((r) => productOf(r))
  const counting = products.some((needs) => packsFor(needs)?.waiting)

  async function finish(chosen: typeof rows) {
    setBusy(chosen.length > 0 ? 'adding' : 'skipping')
    setError('')
    try {
      const links = chosen.flatMap((r): [string, OdaProduct][] => {
        const p = productOf(r)
        const size = sizes[p.id]
        return r.entry.basket?.gone && r.ware ? [[r.ware.id, { ...toOdaProduct(p), ...(size && size !== 'failed' ? size : undefined) }]] : []
      })
      if (links.length > 0) await setOdaProducts(links)
      // The first Entry of each holds the packs, as a line per Entry is what Bestilt and Avbryt read.
      const filled = await substituteBasket(
        chosen.length === 0
          ? []
          : products.flatMap((needs) => {
              const pick = picks[needs[0].line.productId]
              const count = packsFor(needs)?.count ?? 1
              return pick ? needs.map(({ entry }, i) => ({ id: entry.id, quantity: i === 0 ? count : 0, product: toOdaProduct(pick) })) : []
            }),
      )
      if (!filled) setError('Koble til Oda på nytt')
    } catch {
      setError('Oda svarer ikke')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {busy === 'adding' && <FillingBasket />}
      <div>Dette er ikke tilgjengelig på Oda. Velg noe annet å bestille, eller hopp over.</div>
      <ul style={{ ...listStyle, gap: '0.75rem' }}>
        {products.map((needs) => {
          const { productId, name, packText, gone } = needs[0].line
          const ware = rows.find((r) => r.entry.id === needs[0].entry.id)?.ware
          const pack = packsFor(needs)
          return (
            <li key={productId} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <div style={{ fontSize: '1.125rem' }}>
                {name}
                {packText && ` · ${packText}`} · {gone ? 'ikke lenger tilgjengelig' : 'ikke tilgjengelig'}
              </div>
              {needs.map(({ entry }) => (
                <div key={entry.id} style={{ fontSize: '0.875rem', color: '#555' }}>
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
              {pack && (
                <PackStepper
                  {...pack}
                  onChange={(count) => setHandCounts((h) => ({ ...h, [productId]: { product: picks[productId].id, count } }))}
                />
              )}
            </li>
          )
        })}
      </ul>
      {error && <div style={{ color: '#8a5a00' }}>{error}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button onClick={() => finish(picked)} disabled={picked.length === 0 || !!busy || counting} style={buttonStyle}>
          Legg i handlekurven
        </button>
        <button onClick={() => finish([])} disabled={!!busy} style={buttonStyle}>
          Hopp over
        </button>
        {counting && <span style={{ fontSize: '0.875rem', color: '#555' }}>Regner ut antall pakker …</span>}
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
  const lineStyle = { fontSize: '0.875rem', color: '#555' }
  if (searching) {
    return (
      <div style={lineStyle}>
        <OdaSearch ware={ware} replacing={replacing} onPick={onPick} onClose={() => setSearching(false)} />
      </div>
    )
  }
  if (pick) {
    return (
      <div style={{ ...lineStyle, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <a href={odaProductUrl(pick.id)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          {pick.name}
          {pick.packText && ` · ${pick.packText}`}
        </a>
        <ClearButton label={replacing === 'gone' ? 'Fjern Oda-produkt' : 'Fjern erstatning'} onClick={onClear} />
      </div>
    )
  }
  return (
    <button onClick={() => setSearching(true)} style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}>
      {replacing === 'gone' ? 'Velg nytt Oda-produkt' : 'Velg erstatning'}
    </button>
  )
}

// While an Oda Order lasts: the next step is the Family Member's own, ordering in the Basket on
// oda.com. Anyone may end it, with "Bestilt" or "Avbryt". Avbryt asks first, then takes out of
// the Basket exactly what Kraft put in.
function OdaOrder() {
  const basket = useBasket()
  const [busy, setBusy] = useState(false)
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        Neste steg er ditt: bestill i{' '}
        <a href={url} target="_blank" rel="noreferrer">
          handlekurven på oda.com
        </a>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => act(orderedOda)} disabled={busy || asking} style={buttonStyle}>
          Bestilt
        </button>
        <button onClick={() => setAsking(true)} disabled={busy || asking} style={buttonStyle}>
          Avbryt
        </button>
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
      {error && <div style={{ color: '#8a5a00' }}>{error}</div>}
    </div>
  )
}
