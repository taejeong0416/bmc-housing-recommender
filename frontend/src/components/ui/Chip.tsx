import type { ButtonHTMLAttributes } from 'react'

// 다중 선택 칩(구 theme.chipStyle) — Setup의 방 구조·건물 유형 등.
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }

export function Chip({ active, className = '', ...rest }: Props) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-[9px] border px-[13px] py-2 text-[12.5px] transition-[background-color,border-color,color] duration-150 ${
        active
          ? 'border-teal bg-teal font-bold text-white'
          : 'border-line bg-white font-semibold text-body hover:border-teal/45 hover:text-teal'
      } ${className}`}
      {...rest}
    />
  )
}
