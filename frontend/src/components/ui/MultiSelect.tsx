import { useEffect, useRef, useState } from 'react'

// 다중 선택 패널 — 항목이 많아 칩으로 다 펼치기 어려운 선택(지역 등).
// 트리거를 누르면 항목이 타일 격자로 열린다. 빈 배열이 '전체'다.
// counts를 주면 타일마다 개수를 붙이고, 0인 타일은 고를 수 없게 흐리게 둔다.
// 고른 항목은 트리거 아래에 뺄 수 있는 칩으로 보인다.
type Props = {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  allLabel?: string
  panelTitle?: string
  counts?: Record<string, number>
  unit?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  allLabel = '전체',
  panelTitle,
  counts,
  unit = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])

  const summary =
    value.length === 0
      ? allLabel
      : value.length <= 2
        ? value.join(', ')
        : `${value[0]} 외 ${value.length - 1}곳`
  // 트리거 오른쪽 개수 — 고른 항목 합계, 없으면 전체 합계
  const shown = counts
    ? (value.length ? value : options).reduce(
        (sum, o) => sum + (counts[o] ?? 0),
        0,
      )
    : null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-12 w-full items-center gap-3 rounded-[10px] border bg-white px-4 text-left transition-colors ${
          open ? 'border-teal' : 'border-line hover:border-teal/45'
        }`}
      >
        <span
          className={`min-w-0 flex-1 truncate text-[15px] ${
            value.length ? 'font-bold text-ink' : 'text-body'
          }`}
        >
          {summary}
        </span>
        {shown !== null && (
          <span className="shrink-0 text-[13px] tabular-nums text-sub">
            {shown}
            {unit}
          </span>
        )}
        <span
          className={`ms shrink-0 text-[20px] transition-transform duration-150 ${
            open ? 'rotate-180 text-teal' : 'text-sub'
          }`}
          aria-hidden
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="animate-rise absolute z-50 mt-2 w-full rounded-[14px] border border-line bg-white p-4 shadow-pop">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-bold text-ink">
              {panelTitle ?? allLabel}
            </p>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-[8px] border border-line bg-white px-2.5 py-1.5 text-[13px] font-semibold text-body transition-colors hover:border-teal/45 hover:text-teal"
              >
                선택 해제
              </button>
            )}
          </div>
          <div
            role="group"
            aria-label={panelTitle ?? allLabel}
            className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4"
          >
            {options.map((o) => {
              const sel = value.includes(o)
              const n = counts?.[o] ?? 0
              const empty = !!counts && n === 0 && !sel
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={sel}
                  disabled={empty}
                  onClick={() => toggle(o)}
                  className={`flex flex-col items-start rounded-[10px] border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    sel
                      ? 'border-teal bg-teal text-white'
                      : 'border-line bg-white text-ink hover:border-teal/45'
                  }`}
                >
                  <span className="text-[14px] font-bold">{o}</span>
                  {counts && (
                    <span
                      className={`text-[12px] tabular-nums ${sel ? 'text-white/85' : 'text-sub'}`}
                    >
                      {n}
                      {unit}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[9px] bg-teal px-5 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-teal-dark"
            >
              선택 완료
            </button>
          </div>
        </div>
      )}

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="flex items-center gap-0.5 rounded-[8px] border border-line bg-white py-1 pl-2.5 pr-1 text-[13px] font-semibold text-body"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`${v} 빼기`}
                className="flex h-6 w-6 items-center justify-center rounded-md text-sub transition-colors hover:bg-panel hover:text-ink"
              >
                <span className="ms text-[16px]" aria-hidden>
                  close
                </span>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
