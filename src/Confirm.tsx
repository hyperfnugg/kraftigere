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
import { Button, ErrorLine, MainAction, StatusLine } from './ui'

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
      className="fixed inset-0 z-1 overflow-y-auto bg-white"
    >
      <div className="mx-auto box-border flex w-[min(100%,32rem)] flex-col gap-4 px-4 pt-4 pb-24">
        <Button small onClick={onClose} className="self-start">
          ‹ Meny
        </Button>
        <div className="text-muted">
          Det som er krysset av, havner på Dagligvarer. Det som ikke er krysset av, har dere hjemme.
        </div>
        {!lines && !error && <StatusLine>Finner varer …</StatusLine>}
        {error && <ErrorLine>{error}</ErrorLine>}
        <div>
          {shown?.map((line) => (
            <div key={line.key} role="group" aria-label={line.name} className="flex min-h-11 flex-col justify-center gap-2 border-b border-line py-2">
              <div className="flex items-center gap-3 text-lg">
                <input
                  type="checkbox"
                  aria-label={`Kjøp ${line.name}`}
                  checked={ticked(line)}
                  onChange={(e) => setTicks({ ...ticks, [line.key]: e.target.checked })}
                  className="size-6"
                />
                <span
                  role="button"
                  tabIndex={0}
                  aria-expanded={editing === line.key}
                  onClick={() => setEditing(editing === line.key ? null : line.key)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditing(editing === line.key ? null : line.key)}
                  className={`min-w-0 flex-1 cursor-pointer wrap-anywhere ${ticked(line) ? '' : 'opacity-50'}`}
                >
                  {line.name}
                  <span className="text-muted">
                    {[formatAmount(line.amounts), line.days.map((d) => DAY_SHORT[d]).join(', ')]
                      .filter(Boolean)
                      .map((t) => ` · ${t}`)}
                  </span>
                </span>
              </div>
              {line.wordings.some((w) => w.text !== line.name) && (
                <div className="ml-9 text-sm text-muted">
                  fra {line.wordings.map((w) => w.text).join(', ')}
                </div>
              )}
              {editing === line.key && (
                <MatchEditor match={line.name} onSave={(m) => rematch(line, m)} onClose={() => setEditing(null)} />
              )}
            </div>
          ))}
        </div>
        {lines && (
          <MainAction onClick={confirm} className="self-start">
            Iverksett
          </MainAction>
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
      className="ml-9 flex flex-col gap-2 border border-black p-2"
    >
      <input
        autoFocus
        aria-label="Vare"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        className="p-2 text-base"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onClose}>
          Avbryt
        </Button>
        <MainAction type="submit">Lagre</MainAction>
      </div>
    </form>
  )
}
