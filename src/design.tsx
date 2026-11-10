// An entry point like main.tsx, so its components are never hot-swapped on their own.
/* eslint-disable react-refresh/only-export-components */
import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, ErrorLine, GlyphButton, MainAction, Notice, Pot, StatusLine, TextButton } from './ui'
import './index.css'

// The specimen page: every part DESIGN.md names, in each of its states, drawn with the app's
// own components and classes. Dev only, at /design.html. Where a part lives inside a screen
// rather than in ui.tsx, it's copied here with the same classes; keep the two in step.

const COLOURS = ['black', 'white', 'muted', 'faint', 'line', 'subtle', 'accent', 'accent-dark', 'accent-light', 'accent-pale', 'danger']

function Term({ name, children, note }: { name: string; children: ReactNode; note?: string }) {
  return (
    <section className="flex flex-col gap-2 border-t border-black py-4">
      <h2 className="text-lg font-bold">{name}</h2>
      {note && <div className="text-muted">{note}</div>}
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Row({ name, detail, pot, checked, dragging, grip }: { name: string; detail?: string; pot?: string; checked?: boolean; dragging?: boolean; grip?: boolean }) {
  return (
    <li className={`flex min-h-11 items-center gap-3 border-b border-line py-2 text-lg ${checked ? 'opacity-40' : ''} ${dragging ? 'outline-2 -outline-offset-2 outline-black' : ''}`}>
      <label className="flex min-w-0 flex-1 items-center gap-3">
        <input type="checkbox" defaultChecked={checked} className="size-5 shrink-0" />
        <span className={`min-w-0 wrap-anywhere ${checked ? 'line-through' : ''}`}>
          {name}
          {detail && <span className="text-muted"> · {detail}</span>}
          {pot && (
            <span className="text-muted">
              {' · '}
              <Pot /> {pot}
            </span>
          )}
        </span>
      </label>
      {grip && (
        <GlyphButton aria-label={`Flytt ${name}`} className="cursor-grab">
          ↕
        </GlyphButton>
      )}
    </li>
  )
}

function Specimen() {
  return (
    <main className="mx-auto box-border flex w-[min(100%,32rem)] flex-col p-4 pb-16">
      <h1 className="text-2xl font-bold">Kraft · design</h1>
      <p className="py-2 text-muted">Every part named in DESIGN.md, in each of its states. The app draws them from the same components and classes.</p>

      <Term name="Colour" note="Only these exist. Colour is for attention: accent for Notices, danger for Error Lines.">
        <div className="grid grid-cols-2 gap-2">
          {COLOURS.map((c) => (
            <div key={c} className="flex items-center gap-2">
              <span className="size-8 shrink-0 border border-black" style={{ background: `var(--color-${c})` }} />
              <code className="text-sm">{c}</code>
            </div>
          ))}
        </div>
      </Term>

      <Term name="Type" note="system-ui throughout. No screen titles.">
        <div className="text-sm">text-sm · small Buttons</div>
        <div className="text-base">text-base · nearly everything</div>
        <div className="text-lg font-bold">text-lg bold · Section headings</div>
        <div className="text-lg">text-lg · Names in lists</div>
        <div className="text-xl">text-xl · Names on Handle, Glyph Buttons</div>
      </Term>

      <Term name="Button" note="White, 1px black border, square. small in Rows and Chips.">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Button</Button>
          <Button small>small</Button>
          <Button disabled>Disabled</Button>
          <Button disabled>Fyller …</Button>
        </div>
      </Term>

      <Term name="Main Action" note="The one action a screen or Dialog exists for. At most one.">
        <div className="flex flex-wrap items-center gap-2">
          <MainAction>Fyll handlekurven</MainAction>
          <MainAction disabled>Fyll handlekurven</MainAction>
          <MainAction disabled>Fyller handlekurven …</MainAction>
        </div>
      </Term>

      <Term name="Glyph Button" note="A bare glyph, 44px to tap, always with an aria-label. Never an emoji.">
        <div className="flex flex-wrap items-center">
          {[
            ['✕', 'Lukk'],
            ['×', 'Fjern'],
            ['↻', 'Lag på nytt'],
            ['‹', 'Forrige uke'],
            ['›', 'Neste uke'],
            ['−', 'Færre'],
            ['+', 'Flere'],
            ['↕', 'Flytt'],
          ].map(([g, label]) => (
            <GlyphButton key={g} aria-label={label} title={label}>
              {g}
            </GlyphButton>
          ))}
          <GlyphButton aria-label="Utdatert" className="text-accent">
            ↻
          </GlyphButton>
          <GlyphButton aria-label="Disabled" disabled>
            ↻
          </GlyphButton>
        </div>
      </Term>

      <Term name="Text Button" note="Reads as the text around it.">
        <div>
          Neste steg er ditt: <TextButton className="underline">Odabestilling pågår</TextButton>
        </div>
      </Term>

      <Term name="Tab Bar · Tab · Current" note="Equal square cells; the Current Tab inverted.">
        <div className="flex gap-2 border-t border-line py-2">
          <Button inverted className="flex-1">
            <span className="text-2xl leading-none">⌂</span>
          </Button>
          <Button className="flex-1">Handle</Button>
          <Button className="flex-1">
            <span className="text-2xl leading-none">⋮</span>
          </Button>
        </div>
        <div className="flex gap-2 border-t border-line py-2">
          <Button className="flex-1">
            <span className="text-2xl leading-none">⌂</span>
          </Button>
          <Button className="flex-1">Handle</Button>
          <Button inverted className="flex-1">
            Middag <span className="text-2xl leading-none">⋮</span>
          </Button>
        </div>
      </Term>

      <Term name="More · Avatar" note="Square, no shadow. The Avatar is the one round thing.">
        <div className="flex w-48 flex-col gap-2 self-end border border-black bg-white p-2">
          <div className="flex justify-end">
            <span className="flex size-11 items-center justify-center rounded-full bg-subtle text-lg font-bold">A</span>
          </div>
          <Button inverted className="text-left">
            Middag
          </Button>
          <Button className="text-left">Odabestilling</Button>
        </div>
      </Term>

      <Term name="Add Field · Chip · New Chip · Highlighted">
        <div className="relative flex">
          <input placeholder="Hva trenger vi?" aria-label="Hva trenger vi?" defaultValue="mel" className="min-w-0 flex-1 p-2 pr-10 text-base" />
          <button aria-label="Tøm" className="absolute inset-y-0 right-0 w-10 text-xl leading-none">
            ×
          </button>
        </div>
        <div className="flex flex-wrap gap-2 p-[3px]">
          <Button small className="bg-subtle">
            + mel
          </Button>
          <Button small className="outline-2 outline-offset-1 outline-black">
            mel, hvete
          </Button>
          <Button small>mel, potet</Button>
        </div>
      </Term>

      <Term name="Row · Box · Name · Detail · Source Mark · Grip" note="At least 44px, a line hairline below. Long words wrap.">
        <ul>
          <Row name="løk, gul" pot="300 g (2,5 stk)" grip />
          <Row name="hvitløk" detail="ingen liker dette produktet" pot="12 g" grip />
          <Row name="ost, mozzarella, revet" pot="150 g" grip dragging />
          <Row name="atteatteatteatteatteatteatteatteatteatteatteatte" detail="lang notat som brytes" grip />
          <Row name="melk" checked />
        </ul>
      </Term>

      <Term name="Fold" note="A Section that opens in place.">
        <details>
          <summary className="py-2 text-lg font-bold">Avkrysset (2)</summary>
          <ul>
            <Row name="melk" checked />
            <Row name="brød" checked />
          </ul>
        </details>
      </Term>

      <Term name="Section · Status Line · Empty" note="A heading, not a box. One Status Line per Section, never per Row.">
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-bold">Nye varer</h3>
          <StatusLine>Finner Oda-produkter …</StatusLine>
          <ul>
            <Row name="agurk" pot="200 g (0,5 stk)" />
            <Row name="brokkoli" pot="300 g" />
          </ul>
        </section>
        <div className="text-muted">Ingen treff</div>
      </Term>

      <Term name="Search Field">
        <div className="flex flex-col">
          <input aria-label="Søk på Oda" placeholder="Søk, eller lim inn lenke fra oda.com" defaultValue="mel" className="border-b-line p-2 text-base" />
          <ul className="border-x border-b border-black">
            <li className="flex min-h-11 items-center bg-subtle px-2 py-1">Hvetemel · 1 kg · 24,90 kr</li>
            <li className="flex min-h-11 items-center px-2 py-1">Potetmel · 500 g · 32,50 kr</li>
            <li className="flex min-h-11 items-center px-2 py-1 text-faint">Speltmel · 1 kg · ikke tilgjengelig</li>
          </ul>
        </div>
      </Term>

      <Term name="Stepper">
        <div className="flex items-center">
          <GlyphButton aria-label="Færre pakker" className="-ml-3">
            −
          </GlyphButton>
          <span className="min-w-[2ch] text-center text-lg">2</span>
          <GlyphButton aria-label="Flere pakker">+</GlyphButton>
          <span className="text-accent">Sjekk antall</span>
        </div>
      </Term>

      <Term name="Week Switcher">
        <div className="flex items-center gap-2">
          <GlyphButton aria-label="Forrige uke" className="text-2xl">
            ‹
          </GlyphButton>
          <h3 className="flex-1 text-center text-lg font-bold">Uke 46 · 9. nov–15. nov</h3>
          <GlyphButton aria-label="Neste uke" className="text-2xl" disabled>
            ›
          </GlyphButton>
        </div>
      </Term>

      <Term name="Notice · Error Line · Offline" note="Amber to notice, red when something failed. No success messages.">
        <Notice>Utdatert · man. 9. nov 22:17</Notice>
        <Notice box>
          <div className="flex flex-col gap-2">
            Ta ut varene Kraft la i handlekurven?
            <div className="flex gap-2">
              <Button small>Avbryt odabestillingen</Button>
              <Button small>Tilbake</Button>
            </div>
          </div>
        </Notice>
        <ErrorLine>Fikk ikke fylt handlekurven</ErrorLine>
        <Notice>Frakoblet: endringer lagres når nettet er tilbake</Notice>
      </Term>

      <Term name="Busy" note="The label says what's happening, ending in “ …”. Never ⏳ or a spinner.">
        <div className="flex items-center gap-2 text-lg">
          Taco <span className="text-muted">Lager …</span>
        </div>
        <StatusLine>Lager oppskrifter … 3 av 7</StatusLine>
      </Term>

      <Term name="Dialog" note="Square, a 1px black border, on a dimmed screen. ✕ closes.">
        <div className="flex justify-center bg-black/30 p-6">
          <div className="box-border flex w-[min(100%,24rem)] flex-col gap-3 border border-black bg-white p-4">
            <div className="flex items-center justify-between">
              <strong className="text-lg">løk, gul</strong>
              <GlyphButton aria-label="Lukk" className="-m-2">
                ✕
              </GlyphButton>
            </div>
            <Button className="w-full text-left">Taco</Button>
            <Button className="w-full text-left">Fiskesuppe</Button>
          </div>
        </div>
      </Term>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Specimen />
  </StrictMode>,
)
