import type { HTMLAttributes } from 'react'

// P1-D-2 카드 컨테이너 — 화면 최상위 공통(흰 배경·18px 라운드·부드러운 그림자).
export function Card({
  className = '',
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[18px] bg-white shadow-[0_6px_30px_rgba(20,60,55,.08)] ${className}`}
      {...rest}
    />
  )
}
