import { useEffect, useState, type FormEvent } from 'react'
import { type User } from 'firebase/auth'
import { generate } from './ai'
import { signInWithGoogle, signOut, useUser } from './firebase'
import {
  addItem,
  removeItem,
  toggleItem,
  useAuthorized,
  useItems,
  type Item,
} from './items'

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

type Fact = { itemId: string; text: string; loading: boolean }

export default function App() {
  const { user, loading: userLoading } = useUser()
  const { authorized, loading: authLoading } = useAuthorized(user)

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

  if (authLoading) return null

  if (!authorized) {
    return (
      <main style={centerStyle}>
        <div>Not authorized — ask the admin to add your Google account.</div>
        <button style={buttonStyle} onClick={() => signOut()}>
          Sign out
        </button>
      </main>
    )
  }

  return <List user={user} />
}

function List({ user }: { user: User }) {
  const { items } = useItems()
  const [text, setText] = useState('')
  const [fact, setFact] = useState<Fact | null>(null)

  const lastUnchecked = items.findLast((i) => !i.checked)

  useEffect(() => {
    if (fact && fact.itemId !== lastUnchecked?.id) setFact(null)
  }, [lastUnchecked?.id, fact])

  function onAdd(e: FormEvent) {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    addItem(t)
    setText('')
  }

  async function showFunFact(item: Item) {
    setFact({ itemId: item.id, text: '', loading: true })
    try {
      const result = await generate(
        `Share a fun fact about: ${item.text}. One or two sentences, casual tone.`,
      )
      setFact({ itemId: item.id, text: result.trim(), loading: false })
    } catch {
      setFact({ itemId: item.id, text: 'Failed to fetch fun fact.', loading: false })
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
        {items.map((item) => {
          const isLastUnchecked = item.id === lastUnchecked?.id
          const showFact = fact?.itemId === item.id
          const factLoading = showFact && fact.loading
          return (
            <li
              key={item.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                opacity: item.checked ? 0.4 : 1,
                fontSize: '1.125rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => toggleItem(item.id, e.target.checked)}
                  style={{ width: '1.25rem', height: '1.25rem' }}
                />
                <span
                  style={{
                    flex: 1,
                    textDecoration: item.checked ? 'line-through' : 'none',
                  }}
                >
                  {item.text}
                </span>
                {isLastUnchecked && (
                  <button
                    onClick={() => showFunFact(item)}
                    disabled={factLoading}
                    style={{ ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.5rem' }}
                  >
                    Fun fact
                  </button>
                )}
                <button
                  onClick={() => removeItem(item.id)}
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
