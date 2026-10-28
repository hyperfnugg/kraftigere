import { useState, type FormEvent } from 'react'
import { type User } from 'firebase/auth'
import { MealsTab } from './Meals'
import { formatAmount } from './amounts'
import { signInWithGoogle, signOut, useOnline, useUser } from './firebase'
import { linkOda, linkResult, useBasket } from './oda'
import {
  addEntry,
  removeEntries,
  removeEntry,
  setNote,
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

type Tab = 'Home' | 'Meals' | 'Shop'

const TABS = [
  // A plain black text glyph, like ↻ on Middag, not an emoji.
  { tab: 'Home', label: '⌂', name: 'Hjem' },
  { tab: 'Meals', label: 'Middag', name: 'Middag' },
  { tab: 'Shop', label: 'Handle', name: 'Handle' },
] as const

function List({ user }: { user: User }) {
  const { entries } = useEntries()
  useRemoveCheckedAfterShopping(entries)
  const online = useOnline()
  // Back from linking Oda, the app opens on Shop, where the Basket shows.
  const [tab, setTab] = useState<Tab>(linkResult ? 'Shop' : 'Home')
  const [dishesOf, setDishesOf] = useState<Entry | null>(null)
  // A dish tapped on the List opens its Recipe in Middag.
  const [recipeLink, setRecipeLink] = useState<Dish | null>(null)

  function openRecipe(dish: Dish) {
    setDishesOf(null)
    setRecipeLink(dish)
    setTab('Meals')
  }

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
        {tab === 'Home' && <Home entries={entries} onDishes={setDishesOf} />}
        {tab === 'Meals' && <MealsTab openAt={recipeLink} />}
        {tab === 'Shop' && <Shop entries={entries} onDishes={setDishesOf} />}
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
// checked off here. Removing takes two taps, to avoid misclicks.
function Home({ entries, onDishes }: { entries: Entry[]; onDishes: (entry: Entry) => void }) {
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

      {suggestions.length > 0 && (
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
          const isOpen = open?.entryId === entry.id
          return (
            <li
              key={entry.id}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '1.125rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span
                  onClick={() => toggleOpen(entry)}
                  style={{
                    flex: 1,
                    cursor: 'pointer',
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
            </li>
          )
        })}
      </ul>
    </>
  )
}

// "I'm in the store": unchecked first, big text, one tap to check off.
// The Basket on oda.com, or "Koble til Oda" when the Family has no working Oda Link.
function OdaLine() {
  const basket = useBasket()
  const [linking, setLinking] = useState(false)
  if (basket === null) return null
  if (basket === 'error') return <div style={{ fontSize: '0.875rem', color: '#555' }}>Oda svarer ikke</div>
  if (basket.linked) {
    return (
      <a href={basket.url} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: '#555' }}>
        Oda: {basket.items} {basket.items === 1 ? 'vare' : 'varer'} i handlekurven
      </a>
    )
  }
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

function Shop({ entries, onDishes }: { entries: Entry[]; onDishes: (entry: Entry) => void }) {
  const unchecked = entries.filter((e) => !e.checked)
  const checked = entries.filter((e) => e.checked)

  return (
    <>
      <OdaLine />
      {checked.length > 0 && (
        <button onClick={() => removeEntries(checked)} style={{ ...smallButtonStyle, alignSelf: 'flex-end' }}>
          Fjern avkryssede
        </button>
      )}
      <ul style={{ ...listStyle, gap: '0.75rem' }}>
        {[...unchecked, ...checked].map((entry) => (
          <li key={entry.id} style={{ fontSize: '1.375rem', opacity: entry.checked ? 0.4 : 1 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={entry.checked}
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
    </>
  )
}
