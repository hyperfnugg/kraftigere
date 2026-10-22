import { useState, type FormEvent } from 'react'
import { type User } from 'firebase/auth'
import { generate } from './ai'
import { signInWithGoogle, signOut, useOnline, useUser } from './firebase'
import {
  addEntry,
  removeEntries,
  removeEntry,
  setNote,
  stapleId,
  stapleName,
  suggest,
  toggleEntry,
  useAccess,
  useEntries,
  useRemoveCheckedAfterShopping,
  useStaples,
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

type Fact = { entryId: string; text: string; loading: boolean }

export default function App() {
  const { user, loading: userLoading } = useUser()
  const { access, loading: accessLoading } = useAccess(user)

  if (userLoading) return null

  if (!user) {
    return (
      <main style={centerStyle}>
        <button style={buttonStyle} onClick={() => signInWithGoogle()}>
          Sign in with Google
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
            ? "Can't connect — check your connection and try again."
            : 'Not authorized — ask the admin to add your Google account.'}
        </div>
        <button style={buttonStyle} onClick={() => signOut()}>
          Sign out
        </button>
      </main>
    )
  }

  return <List user={user} />
}

const smallButtonStyle = { ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.75rem' }

type Tab = 'Home' | 'Shop'

function List({ user }: { user: User }) {
  const { entries } = useEntries()
  useRemoveCheckedAfterShopping(entries)
  const online = useOnline()
  const [tab, setTab] = useState<Tab>('Home')

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
        <div style={{ fontSize: '0.875rem', color: '#8a5a00' }}>Offline: changes will sync</div>
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
          Sign out
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tab === 'Home' ? <Home entries={entries} /> : <Shop entries={entries} />}
      </div>

      <nav
        style={{
          position: 'sticky',
          bottom: 0,
          display: 'flex',
          gap: '0.5rem',
          padding: '0.5rem 0',
          background: 'white',
          borderTop: '1px solid #ddd',
        }}
      >
        {(['Home', 'Shop'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            style={{
              ...buttonStyle,
              flex: 1,
              fontWeight: tab === t ? 700 : 400,
              color: tab === t ? 'black' : '#666',
            }}
          >
            {t}
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

function Note({ entry }: { entry: Entry }) {
  return entry.note ? <span style={{ color: '#666' }}> · {entry.note}</span> : null
}

// "Quick, before I forget": adding and editing Groceries, newest first. Entries are never
// checked off here. Removing takes two taps, to avoid misclicks.
function Home({ entries }: { entries: Entry[] }) {
  const staples = useStaples()
  const [text, setText] = useState('')
  const [fact, setFact] = useState<Fact | null>(null)
  const [open, setOpen] = useState<{ entryId: string; note: string } | null>(null)

  const newestFirst = entries.toReversed()
  const newestUnchecked = newestFirst.find((e) => !e.checked)

  if (fact && fact.entryId !== newestUnchecked?.id) setFact(null)

  const suggestions = suggest(staples, text, entries)

  // Typed text that matches a Staple adds that Staple under its own name.
  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = stapleName(text)
    if (!t) return
    addEntry(staples.find((s) => s.id === stapleId(t))?.name ?? t)
    setText('')
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

  async function showFunFact(entry: Entry) {
    setFact({ entryId: entry.id, text: '', loading: true })
    try {
      const result = await generate(
        `Share a fun fact about: ${entry.text}. One or two sentences, casual tone.`,
      )
      setFact({ entryId: entry.id, text: result.trim(), loading: false })
    } catch {
      setFact({ entryId: entry.id, text: 'Failed to fetch fun fact.', loading: false })
    }
  }

  return (
    <>
      <form onSubmit={onAdd} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={100}
          placeholder="Add entry"
          style={{ flex: 1, fontSize: '1rem', padding: '0.5rem' }}
        />
        <button type="submit" style={buttonStyle}>
          Add
        </button>
      </form>

      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '-0.5rem' }}>
          {suggestions.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                addEntry(s.name)
                setText('')
              }}
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
          const showFact = fact?.entryId === entry.id
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
                  <Note entry={entry} />
                </span>
                {entry.id === newestUnchecked?.id && (
                  <button
                    onClick={() => showFunFact(entry)}
                    disabled={showFact && fact.loading}
                    style={{ ...smallButtonStyle, padding: '0.25rem 0.5rem' }}
                  >
                    Fun fact
                  </button>
                )}
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
                    placeholder="Note"
                    aria-label="Note"
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
                    Remove
                  </button>
                </form>
              )}
              {showFact && (
                <div style={{ fontSize: '0.9rem', color: '#666', fontStyle: 'italic' }}>
                  {fact.loading ? 'Thinking…' : fact.text}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

// "I'm in the store": unchecked first, big text, one tap to check off.
function Shop({ entries }: { entries: Entry[] }) {
  const unchecked = entries.filter((e) => !e.checked)
  const checked = entries.filter((e) => e.checked)

  return (
    <>
      {checked.length > 0 && (
        <button onClick={() => removeEntries(checked)} style={{ ...smallButtonStyle, alignSelf: 'flex-end' }}>
          Remove checked
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
                <Note entry={entry} />
              </span>
            </label>
          </li>
        ))}
      </ul>
    </>
  )
}
