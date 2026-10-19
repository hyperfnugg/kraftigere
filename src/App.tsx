import { useState, type FormEvent } from 'react'
import { type User } from 'firebase/auth'
import { generate } from './ai'
import { signInWithGoogle, signOut, useOnline, useUser } from './firebase'
import {
  addEntry,
  removeEntry,
  toggleEntry,
  useAccess,
  useEntries,
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
  const online = useOnline()
  const [text, setText] = useState('')
  const [fact, setFact] = useState<Fact | null>(null)

  const lastUnchecked = entries.findLast((e) => !e.checked)

  if (fact && fact.entryId !== lastUnchecked?.id) setFact(null)

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    addEntry(t)
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
          maxLength={500}
          placeholder="Add item"
          style={{ flex: 1, fontSize: '1rem', padding: '0.5rem' }}
        />
        <button type="submit" style={buttonStyle}>
          Add
        </button>
      </form>

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
                <span
                  style={{
                    flex: 1,
                    textDecoration: entry.checked ? 'line-through' : 'none',
                  }}
                >
                  {entry.text}
                </span>
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
