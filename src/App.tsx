import { useState, type FormEvent } from 'react'
import { type User } from 'firebase/auth'
import { generate } from './ai'
import { signInWithGoogle, signOut, useOnline, useUser } from './firebase'
import {
  addEntry,
  removeEntries,
  removeEntry,
  setAmount,
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

function List({ user }: { user: User }) {
  const { entries } = useEntries()
  const staples = useStaples()
  useRemoveCheckedAfterShopping(entries)
  const checked = entries.filter((e) => e.checked)
  const online = useOnline()
  const [text, setText] = useState('')
  const [fact, setFact] = useState<Fact | null>(null)
  const [editing, setEditing] = useState<{ entryId: string; amount: string } | null>(null)

  function saveAmount() {
    if (!editing) return
    const entry = entries.find((e) => e.id === editing.entryId)
    if (entry && (entry.amount ?? '') !== editing.amount.trim()) setAmount(entry.id, editing.amount)
    setEditing(null)
  }

  const lastUnchecked = entries.findLast((e) => !e.checked)

  if (fact && fact.entryId !== lastUnchecked?.id) setFact(null)

  const suggestions = suggest(staples, text)

  // Typed text that matches a Staple adds that Staple under its own name.
  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = stapleName(text)
    if (!t) return
    addEntry(staples.find((s) => s.id === stapleId(t))?.name ?? t)
    setText('')
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
        <button
          onClick={() => signOut()}
          style={{ ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.75rem' }}
        >
          Sign out
        </button>
      </header>

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
              style={{ ...buttonStyle, padding: '0.25rem 0.75rem' }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {checked.length > 0 && (
        <button
          onClick={() => removeEntries(checked)}
          style={{ ...buttonStyle, alignSelf: 'flex-end', fontSize: '0.875rem', padding: '0.25rem 0.75rem' }}
        >
          Remove checked
        </button>
      )}

      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {entries.map((entry) => {
          const isLastUnchecked = entry.id === lastUnchecked?.id
          const showFact = fact?.entryId === entry.id
          const factLoading = showFact && fact.loading
          return (
            <li
              key={entry.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                opacity: entry.checked ? 0.4 : 1,
                fontSize: '1.125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={entry.checked}
                  onChange={(e) => toggleEntry(entry.id, e.target.checked)}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                {editing?.entryId === entry.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      saveAmount()
                    }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span>{entry.text}</span>
                    <input
                      autoFocus
                      value={editing.amount}
                      onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                      onBlur={saveAmount}
                      maxLength={50}
                      placeholder="Amount"
                      aria-label="Amount"
                      style={{ flex: 1, minWidth: 0, fontSize: '1rem', padding: '0.25rem' }}
                    />
                  </form>
                ) : (
                  <span
                    onClick={() => setEditing({ entryId: entry.id, amount: entry.amount ?? '' })}
                    style={{
                      flex: 1,
                      cursor: 'pointer',
                      textDecoration: entry.checked ? 'line-through' : 'none',
                    }}
                  >
                    {entry.text}
                    {entry.amount && <span style={{ color: '#666' }}> · {entry.amount}</span>}
                  </span>
                )}
                {isLastUnchecked && (
                  <button
                    onClick={() => showFunFact(entry)}
                    disabled={factLoading}
                    style={{ ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                  >
                    Fun fact
                  </button>
                )}
                <button
                  onClick={() => removeEntry(entry.id)}
                  aria-label="Remove"
                  style={{ ...buttonStyle, padding: '0.25rem 0.5rem' }}
                >
                  ×
                </button>
              </div>
              {showFact && (
                <div
                  style={{
                    paddingLeft: '2rem',
                    fontSize: '0.9rem',
                    color: '#666',
                    fontStyle: 'italic',
                  }}
                >
                  {fact.loading ? 'Thinking…' : fact.text}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </main>
  )
}
