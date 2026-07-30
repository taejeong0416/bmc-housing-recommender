import type { ButtonHTMLAttributes } from 'react'

// 라이프스타일 태그 타일(구 theme.tagBtn) — Preference·Setup 공용.
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }

export function TagButton({ active, className = '', ...rest }: Props) {
  return (
    <button
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-[6px] rounded-xl border px-1 py-[14px] transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[.97] ${
        active
          ? 'border-teal bg-teal text-white shadow-sm'
          : 'border-line bg-white text-body hover:border-teal/45 hover:bg-teal-ghost hover:text-teal'
      } ${className}`}
      {...rest}
    />
  )
}
