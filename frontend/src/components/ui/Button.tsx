import type { ButtonHTMLAttributes } from 'react'

// 공통 버튼. 크기·여백은 화면별 편차가 있어 className으로 받고, 색·상태(hover/active/focus)만 variant로 통일.
const base =
  'inline-flex items-center justify-center font-bold transition-[background-color,box-shadow,transform,border-color] duration-150 active:scale-[.98] disabled:pointer-events-none'

const variants = {
  primary:
    'bg-teal text-white shadow-sm hover:bg-teal-dark hover:shadow-card disabled:bg-[#c3cdc9] disabled:shadow-none',
  outline:
    'border border-teal/70 text-teal hover:bg-teal-soft hover:border-teal disabled:opacity-50',
  gold: 'bg-gold text-gold-ink shadow-sm hover:bg-gold-dark hover:shadow-card',
  ghost: 'text-body hover:bg-teal-ghost hover:text-teal',
} as const

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
}

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: Props) {
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...rest} />
  )
}
