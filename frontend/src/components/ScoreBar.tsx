// 적합도/매칭 점수 그라데이션 바 — 점수(0~100)에 비례해 teal 그라데이션으로 채운다.
// 상세화면 우측 요약(데스크톱)·본문 인라인(모바일) 두 곳의 점수 아래에 공통으로 쓴다.
export function ScoreBar({
  score,
  className = '',
}: {
  score: number
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-line-soft ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background:
            'linear-gradient(90deg, #35a0a8 0%, var(--color-teal) 60%, var(--color-teal-dark) 100%)',
        }}
      />
    </div>
  )
}
