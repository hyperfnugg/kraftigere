import { type FormEvent, useEffect, useState } from 'react'
import { makeMatches } from './ai'
import { formatAmount } from './amounts'
import {
  type Line,
  confirmWeek,
  makeLines,
  readFamilyMatches,
  rememberedMatch,
  startsTicked,
  waitingEntry,
  weekIngredients,
} from './matching'
import { wareName } from './entries'
import { DAY_SHORT, type StoredRecipe } from './weeks'

const buttonStyle = { fontSize: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }
const smallButtonStyle = { ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.75rem' }
const sectionStyle = { display: 'flex', flexDirection: 'column', gap: '0.5rem' } as const
const greyStyle = { fontSize: '0.875rem', color: '#555' }

type Family = Awaited<ReturnType<typeof readFamilyMatches>>

// Iverksett: the week's Ingredients as one line per Ware, filling the screen above the
// tabs. Remembered matches are used as they are, and the AI matches the rest. Ticked
// lines go to Groceries.
export function ConfirmView({
  weekId,
  recipes,
  onClose,
}: {
  weekId: string
  recipes: Record<string, StoredRecipe>
  onClose: () => void
}) {
  // The Recipes as they were when the screen opened.
  const [ingredients] = useState(() => weekIngredients(recipes))
  const [family, setFamily] = useState<Family | null>(null)
  const [matches, setMatches] = useState<Record<string, string>>({})
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const f = await readFamilyMatches()
      const wordings = [...new Map(ingredients.map((i) => [i.key, i.text]))]
      const known: Record<string, string> = {}
      const unknown: { key: string; text: string }[] = []
      for (const [key, text] of wordings) {
        if (f.matches[key]) known[key] = rememberedMatch(f.matches[key], f.wares)
        else unknown.push({ key, text })
      }
      if (unknown.length > 0) {
        const made = await makeMatches(
          unknown.map((w) => w.text),
          f.wares.map((w) => w.name),
        )
        unknown.forEach((w, i) => (known[w.key] = made[i]))
      }
      if (cancelled) return
      setFamily(f)
      setMatches(known)
    })().catch((e) => {
      console.error(e)
      if (!cancelled) setError('Noe gikk galt. Prøv igjen.')
    })
    return () => {
      cancelled = true
    }
  }, [ingredients])

  const lines = family ? makeLines(ingredients, matches, family.wares) : null
  const shown = lines?.filter((l) => !waitingEntry(l, family!.entries))
  const ticked = (line: Line) => ticks[line.key] ?? startsTicked(line, family!.wares)

  // Every wording on the line goes to the new match, so lines may merge.
  function rematch(line: Line, match: string) {
    setMatches((m) => ({ ...m, ...Object.fromEntries(line.wordings.map((w) => [w.key, match])) }))
    setEditing(null)
  }

  function confirm() {
    if (!family || !lines) return
    confirmWeek(weekId, lines.map((l) => ({ ...l, ticked: ticked(l) })), family).catch(console.error)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-label="Iverksett"
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
        <h2 style={{ fontSize: '1.375rem', margin: 0 }}>Iverksett</h2>
        <div style={greyStyle}>
          Det som er krysset av, havner på Dagligvarer. Det som ikke er krysset av, har dere hjemme.
        </div>
        {!lines && !error && <div style={{ color: '#555' }}>Finner varer… ⏳</div>}
        {error && <div style={{ color: '#a00', fontSize: '0.875rem' }}>{error}</div>}
        {shown?.map((line) => (
          <div key={line.key} role="group" aria-label={line.name} style={sectionStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.125rem' }}>
              <input
                type="checkbox"
                aria-label={`Kjøp ${line.name}`}
                checked={ticked(line)}
                onChange={(e) => setTicks({ ...ticks, [line.key]: e.target.checked })}
                style={{ width: '1.5rem', height: '1.5rem' }}
              />
              <span
                role="button"
                tabIndex={0}
                aria-expanded={editing === line.key}
                onClick={() => setEditing(editing === line.key ? null : line.key)}
                onKeyDown={(e) => e.key === 'Enter' && setEditing(editing === line.key ? null : line.key)}
                style={{ flex: 1, cursor: 'pointer', opacity: ticked(line) ? 1 : 0.5 }}
              >
                {line.name}
                <span style={{ color: '#666' }}>
                  {[formatAmount(line.amounts), line.days.map((d) => DAY_SHORT[d]).join(', ')]
                    .filter(Boolean)
                    .map((t) => ` · ${t}`)}
                </span>
              </span>
            </div>
            {line.wordings.some((w) => w.text !== line.name) && (
              <div style={{ ...greyStyle, marginLeft: '2.25rem' }}>
                fra {line.wordings.map((w) => w.text).join(', ')}
              </div>
            )}
            {editing === line.key && (
              <MatchEditor match={line.name} onSave={(m) => rematch(line, m)} onClose={() => setEditing(null)} />
            )}
          </div>
        ))}
        {lines && (
          <button onClick={confirm} style={{ ...buttonStyle, alignSelf: 'flex-start' }}>
            Iverksett
          </button>
        )}
      </div>
    </div>
  )
}

// Changes the Ware a line is matched to, by name. A name the Family doesn't have yet
// becomes a new Ware at Iverksett.
function MatchEditor({
  match,
  onSave,
  onClose,
}: {
  match: string
  onSave: (match: string) => void
  onClose: () => void
}) {
  const [name, setName] = useState(match)
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = wareName(name)
    if (n) onSave(n)
  }
  return (
    <form
      onSubmit={onSubmit}
      aria-label="Endre vare"
      style={{ ...sectionStyle, padding: '0.5rem', border: '1px solid #ddd', marginLeft: '2.25rem' }}
    >
      <input
        autoFocus
        aria-label="Vare"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        style={{ fontSize: '1rem', padding: '0.25rem' }}
      />
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
