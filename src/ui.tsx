import type { ButtonHTMLAttributes, ReactNode } from 'react'

// The parts DESIGN.md names that recur across screens. Each takes a className for layout only:
// a second utility for a property one of these sets doesn't reliably win.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

// A square box with a 1px black border; `small` in Rows and Chips, `inverted` for the Main
// Action and the Current Tab. No fill of its own, so a Chip can take one.
export function Button({ small, inverted, className = '', ...props }: ButtonProps & { small?: boolean; inverted?: boolean }) {
  const size = small ? 'min-h-9 px-3 py-1 text-sm' : 'min-h-11 px-4 py-2 text-base'
  const tone = inverted
    ? 'border-black bg-black text-white disabled:border-faint disabled:bg-white disabled:text-faint'
    : 'border-black text-black disabled:border-faint disabled:text-faint'
  return <button {...props} className={`${size} border ${tone} ${className}`} />
}

// The one action a screen or Dialog exists for.
export function MainAction(props: ButtonProps) {
  return <Button inverted {...props} />
}

// A bare glyph with a hit area of at least 44px. Takes its colour from around it; always give
// it an aria-label.
export function GlyphButton({ className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-xl leading-none disabled:text-faint ${className}`}
    />
  )
}

// A button that reads as the text around it: no box, the surrounding font.
export function TextButton({ className = '', ...props }: ButtonProps) {
  return <button {...props} className={`text-left ${className}`} />
}

// Something to notice that isn't broken; `box` for one that stands as a block.
export function Notice({ box, className = '', children }: { box?: boolean; className?: string; children: ReactNode }) {
  const look = box ? 'border border-accent-light bg-accent-pale p-3 text-accent-dark' : 'text-accent'
  return <div className={`${look} ${className}`}>{children}</div>
}

// Something that failed or blocks the next step, under the control it's about.
export function ErrorLine({ children }: { children: ReactNode }) {
  return <div className="text-danger">{children}</div>
}

// What's happening now. The text ends in " …".
export function StatusLine({ children }: { children: ReactNode }) {
  return <div className="text-muted">{children}</div>
}

// The dishes an Entry is for: a cooking pot, drawn in the text's colour and size, so it sits
// in the line like the ⌂ and ↻ glyphs. Unicode has no plain one, only a colour emoji.
export function Pot() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="inline size-[1.1em] align-[-0.2em]"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M5 11 H19 V17 A3 3 0 0 1 16 20 H8 A3 3 0 0 1 5 17 Z M5 13 H2.5 M19 13 H21.5 M4 8.5 H20 M10.5 8.5 V6.5 H13.5 V8.5" />
    </svg>
  )
}
