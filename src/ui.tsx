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

// A button that reads as the text around it: no box, the surrounding font.
export function TextButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`cursor-pointer border-none bg-transparent p-0 [font:inherit] ${className}`} />
}
