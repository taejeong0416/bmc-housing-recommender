import type { HTMLAttributes } from 'react'

// 카드 컨테이너 — 화면 최상위 공통(흰 배경, 18px 라운드, 얇은 테두리).
export function Card({
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[18px] border border-line bg-white ${className}`}
      {...rest}
    />
  )
}
