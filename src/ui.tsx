import type { ButtonHTMLAttributes } from 'react'

// A native button, sized up; `small` for the secondary ones.
export function Button({
  small,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { small?: boolean }) {
  const size = small ? 'text-sm py-1 px-3' : 'text-base py-2 px-4'
  return <button {...props} className={`${size} cursor-pointer ${className}`} />
}
