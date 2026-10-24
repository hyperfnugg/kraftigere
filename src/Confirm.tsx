import { type FormEvent, useEffect, useState } from 'react'
import { type Match, makeMatches } from './ai'
import {
  type Line,
  confirmWeek,
  formatAmount,
  makeLines,
  readFamilyMatches,
  rememberedMatch,
  startsTicked,
  weekIngredients,
} from './matching'
import { DAY_SHORT, type StoredRecipe } from './weeks'

const buttonStyle = { fontSize: '1rem', padding: '0.5rem 1rem', cursor: 'pointer' }
const smallButtonStyle = { ...buttonStyle, fontSize: '0.875rem', padding: '0.25rem 0.75rem' }
const sectionStyle = { display: 'flex', flexDirection: 'column', gap: '0.5rem' } as const
const greyStyle = { fontSize: '0.875rem', color: '#555' }

type Family = Awaited<ReturnType<typeof readFamilyMatches>>

// Iverksett: the week's Ingredients as one line per Ware or Staple, filling the screen
// above the tabs. Remembered matches are used as they are, and the AI matches the rest.
// Ticked lines go to Groceries as Menu Entries.
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
  const [matches, setMatches] = useState<Record<string, Match>>({})
  const [ticks, setTicks] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const f = await readFamilyMatches()
      const wordings = [...new Map(ingredients.map((i) => [i.key, i.text]))]
      const known: Record<string, Match> = {}
      const unknown: { key: string; text: string }[] = []
      for (const [key, text] of wordings) {
        if (f.matches[key]) known[key] = rememberedMatch(f.matches[key], f.staples, f.wares)
        else unknown.push({ key, text })
      }
      if (unknown.length > 0) {
        const made = await makeMatches(
          unknown.map((w) => w.text),
          { staples: f.staples.map((s) => s.name), wares: f.wares.map((w) => w.name) },
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

  const lines = family ? makeLines(ingredients, matches, family.staples, family.wares) : null
  const ticked = (line: Line) => ticks[line.key] ?? startsTicked(line, family!.staples)

  // Every wording on the line goes to the new match, so lines may merge.
  function rematch(line: Line, match: Match) {
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
        {lines?.map((line) => (
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
                {line.name} {formatAmount(line.amounts)}
                <span style={{ color: '#666' }}> · {line.days.map((d) => DAY_SHORT[d]).join(', ')}</span>
              </span>
            </div>
            <div style={{ ...greyStyle, marginLeft: '2.25rem' }}>
              {line.match.kind === 'ware' ? 'Vare' : 'Basisvare'}
              {line.wordings.some((w) => w.text !== line.name) &&
                ` · fra ${line.wordings.map((w) => w.text).join(', ')}`}
            </div>
            {editing === line.key && (
              <MatchEditor match={line.match} onSave={(m) => rematch(line, m)} onClose={() => setEditing(null)} />
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

// Changes what a line is matched to: a Staple or a Ware, by name. A name the Family
// doesn't have yet becomes a new one at Iverksett.
function MatchEditor({
  match,
  onSave,
  onClose,
}: {
  match: Match
  onSave: (match: Match) => void
  onClose: () => void
}) {
  const [kind, setKind] = useState(match.kind)
  const [name, setName] = useState(match.name)
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = name.trim().replace(/\s+/g, ' ')
    if (n) onSave({ kind, name: n })
  }
  return (
    <form
      onSubmit={onSubmit}
      aria-label="Endre vare"
      style={{ ...sectionStyle, padding: '0.5rem', border: '1px solid #ddd', marginLeft: '2.25rem' }}
    >
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <select
          aria-label="Type"
          value={kind}
          onChange={(e) => setKind(e.target.value as Match['kind'])}
          style={{ fontSize: '1rem', padding: '0.25rem' }}
        >
          <option value="staple">Basisvare</option>
          <option value="ware">Vare</option>
        </select>
        <input
          autoFocus
          aria-label="Navn"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          style={{ flex: 1, minWidth: 0, fontSize: '1rem', padding: '0.25rem' }}
        />
      </div>
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
