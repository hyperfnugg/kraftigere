import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useCombobox } from 'downshift'
import { type User } from 'firebase/auth'
import { MealsTab } from './Meals'
import { formatAmount } from './amounts'
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
        {tab === 'Home' && <Home entries={entries} ordering={ordering} onDishes={setDishesOf} />}
        {tab === 'Meals' && <MealsTab openAt={recipeLink} ordering={ordering} />}
        {tab === 'Shop' && <Shop entries={entries} ordering={ordering} onDishes={setDishesOf} />}
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
function Home({ entries, ordering, onDishes }: { entries: Entry[]; ordering: boolean; onDishes: (entry: Entry) => void }) {
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
        <div style={{ color: '#8a5a00' }}>Odabestilling pågår</div>
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
              {isOpen && <OdaProductLine ware={wares.find((w) => w.id === entry.ware)} wares={wares} />}
            </li>
          )
        })}
      </ul>
    </>
  )
}

// The Ware's Oda Product, opening on oda.com, or "Aldri fra Oda". Changing it is removing it
// and choosing again, searching Oda in its place.
function OdaProductLine({ ware, wares }: { ware?: Ware; wares: Ware[] }) {
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
          <ClearButton label="Fjern Oda-produkt" onClick={() => setOdaProduct(ware.id, null)} />
        </div>
      ) : searching ? (
        <OdaSearch ware={ware} wares={wares} onClose={() => setSearching(false)} />
      ) : (
        <button onClick={() => setSearching(true)} style={{ ...smallButtonStyle, alignSelf: 'flex-start' }}>
          Velg Oda-produkt
        </button>
      )}
    </div>
  )
}

const toOdaProduct = (p: OdaResult) => ({ id: p.id, name: p.name, packText: p.packText })

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

// onPick takes the pick instead of saving it on the Ware.
function OdaSearch({
  ware,
  wares,
  onClose,
  onPick,
}: {
  ware: Ware
  wares: Ware[]
  onClose: () => void
  onPick?: (p: OdaResult) => void
}) {
  const [query, setQuery] = useState(ware.name)
  // 'idle' while the text is too short to search.
  const [search, setSearch] = useState<Search | 'idle' | 'searching' | 'error'>('searching')
  const [all, setAll] = useState(false)
  const [message, setMessage] = useState('')
  const latest = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // An Oda Product belongs to at most one Ware.
  const usedBy = (id: number) => wares.find((w) => w.id !== ware.id && w.oda?.id === id)

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
      const other = hit && usedBy(hit.id)
      if (!hit) setMessage('Fant ikke produktet fra lenken')
      else if (other) setMessage(`Brukt av «${other.name}»`)
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
      ? [...(all ? products : products.slice(0, 5)), ...(!all && products.length > 5 ? ['more' as const] : []), 'never']
      : []

  const { isOpen, highlightedIndex, getInputProps, getMenuProps, getItemProps } = useCombobox<OdaRow>({
    items: rows,
    inputValue: query,
    selectedItem: null,
    initialIsOpen: true,
    itemToString: (row) => (typeof row === 'object' && row ? row.name : ''),
    isItemDisabled: (row) => typeof row === 'object' && !!usedBy(row.id),
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
              const other = typeof row === 'object' && usedBy(row.id)
              return (
                <li
                  key={typeof row === 'object' ? row.id : row}
                  {...getItemProps({ item: row, index })}
                  style={{
                    padding: '0.375rem 0.5rem',
                    cursor: other ? 'default' : 'pointer',
                    background: highlightedIndex === index ? '#eee' : 'transparent',
                    color: other ? '#888' : '#222',
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
                      {other && ` · brukt av «${other.name}»`}
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
function Shop({ entries, ordering, onDishes }: { entries: Entry[]; ordering: boolean; onDishes: (entry: Entry) => void }) {
  const unchecked = entries.filter((e) => !e.checked)
  const checked = entries.filter((e) => e.checked)

  return (
    <>
      {ordering && <div style={{ color: '#8a5a00' }}>Odabestilling pågår</div>}
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

// Odabestilling: the choosing, or while an Oda Order lasts, what's next and the In Basket
// Entries, read-only, each with its Oda Product. "Koble til Oda" when the Family has no working
// Oda Link. The choosing is kept only on this device; the Oda Order replaces it on every device.
function OdaTab({ entries, ordering, onDishes }: { entries: Entry[]; ordering: boolean; onDishes: (entry: Entry) => void }) {
  const basket = useBasket()
  const wares = useWares()
  const [linking, setLinking] = useState(false)

  if (ordering) {
    return (
      <>
        <OdaOrder />
        <ul style={{ ...listStyle, gap: '0.75rem' }}>
          {entries
            .filter((e) => e.basket)
            .map((entry) => {
              const oda = wares.find((w) => w.id === entry.ware)?.oda
              return (
                <li key={entry.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '1.375rem' }}>
                  <span>
                    {entry.text}
                    <Details entry={entry} onDishes={onDishes} />
                  </span>
                  {oda && (
                    <a href={odaProductUrl(oda.id)} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: '#555' }}>
                      {oda.name}
                      {oda.packText && ` · ${oda.packText}`}
                    </a>
                  )}
                </li>
              )
            })}
        </ul>
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
      <Choosing entries={entries.filter((e) => !e.checked)} onDishes={onDishes} />
    </>
  )
}

// Choosing which unchecked Entries to order from Oda: "Nye varer" first, whose Wares have no Oda
// Product yet, then "Tidligere kjøpte varer", each alphabetically. A Ware without an Oda
// Product gets one suggested when the choosing opens: the first search hit for its name that no
// other Ware has, preferring one that's available. Only Entries whose Ware has an Oda Product
// start ticked. Picks made here are saved on their Wares only when the Basket is filled, and
// only for ticked Entries. Wares never from Oda wait, folded, at the bottom.
function Choosing({ entries, onDishes }: { entries: Entry[]; onDishes: (entry: Entry) => void }) {
  const wares = useWares()
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  // Suggested or picked here, by Ware id, not yet saved.
  const [picks, setPicks] = useState<Record<string, OdaResult>>({})
  const [suggesting, setSuggesting] = useState(true)
  const suggested = useRef(false)
  const [unfolded, setUnfolded] = useState(false)
  const [tried, setTried] = useState(false)
  const [filling, setFilling] = useState(false)
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

  // Once, as soon as the Wares have loaded.
  useEffect(() => {
    if (suggested.current || wares.length === 0) return
    suggested.current = true
    const want = inside.flatMap((r) => (r.ware && !r.ware.oda ? [r.ware] : []))
    const done = () => setSuggesting(false)
    if (want.length === 0) return void Promise.resolve().then(done)
    suggestOda(want.map((w) => w.name))
      .then((res) => {
        if (!res.linked) return
        const taken = new Set(wares.flatMap((w) => (w.oda ? [w.oda.id] : [])))
        const next: Record<string, OdaResult> = {}
        want.forEach((w, i) => {
          const free = res.products[i].filter((p) => !taken.has(p.id))
          const p = free.find((p) => p.available) ?? free[0]
          if (p) {
            next[w.id] = p
            taken.add(p.id)
          }
        })
        // A pick made while the suggestions were on their way wins.
        setPicks((picks) => ({ ...next, ...picks }))
      })
      .catch(() => {})
      .finally(done)
  }, [inside, wares])

  const row = (r: (typeof rows)[number]) => {
    const marked = tried && lacking.has(r.entry.id)
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
            <OdaProductLine ware={r.ware} wares={wares} />
          ) : (
            r.ware && (
              <PickLine
                ware={r.ware}
                wares={wares}
                pick={picks[r.ware.id]}
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
      // The function reads the Oda Products from the Wares, so they're saved first.
      const links = chosen.flatMap((r): [string, OdaProduct][] => {
        const p = pickOf(r)
        return r.ware && p ? [[r.ware.id, toOdaProduct(p)]] : []
      })
      if (links.length > 0) await setOdaProducts(links)
      // Filled, the Oda Order begins and takes the choosing's place.
      if (!(await fillBasket(chosen.map((r) => r.entry.id)))) setError('Koble til Oda på nytt')
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
      <button onClick={fill} disabled={chosen.length === 0 || filling} style={{ ...buttonStyle, alignSelf: 'flex-start' }}>
        Fyll handlekurven
      </button>
    </>
  )
}

// An Oda Product picked or suggested in the choosing, not yet saved on the Ware. It reads like a
// saved one, linking to oda.com; × opens the search in its place, starting with the Ware's name.
function PickLine({
  ware,
  wares,
  pick,
  suggesting,
  onPick,
}: {
  ware: Ware
  wares: Ware[]
  pick?: OdaResult
  suggesting: boolean
  onPick: (p: OdaResult) => void
}) {
  const [searching, setSearching] = useState(false)
  const lineStyle = { fontSize: '0.875rem', color: '#555' }

  if (searching) {
    return (
      <div style={lineStyle}>
        <OdaSearch ware={ware} wares={wares} onPick={onPick} onClose={() => setSearching(false)} />
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
