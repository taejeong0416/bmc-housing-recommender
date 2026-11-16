import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

// 다중 선택 드롭다운 — 항목이 많아 칩으로 다 펼치기 어려운 선택(지역 등).
// 빈 배열이 '전체'다. 목록 맨 위 '전체'를 고르면 선택을 비운다. 고르는 동안 목록은 열려 있다.
type Props = {
  options: string[]
  value: string[]
  onChange: (value: string[]) => void
  allLabel?: string
  className?: string
}

export function MultiSelect({
  options,
  value,
  onChange,
  allLabel = '전체',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  // 0번은 '전체', 1번부터 options
  const rows = [allLabel, ...options]

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const toggle = (i: number) => {
    if (i === 0) return onChange([])
    const o = options[i - 1]
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return setOpen(false)
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggle(active)
    }
  }

  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? value[0]
        : `${value[0]} 외 ${value.length - 1}곳`

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded-[9px] border bg-white px-3 py-2.5 text-left text-[14px] text-ink transition-colors ${
          open ? 'border-teal' : 'border-line hover:border-teal/45'
        } ${className}`}
      >
        <span className="truncate">{summary}</span>
        <span
          className={`ms shrink-0 text-[18px] transition-transform duration-150 ${
            open ? 'rotate-180 text-teal' : 'text-sub'
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-multiselectable
          className="animate-rise absolute z-50 mt-1.5 grid max-h-72 w-full grid-cols-2 gap-0.5 overflow-auto rounded-[10px] border border-line bg-white p-1 shadow-pop sm:grid-cols-3"
        >
          {rows.map((o, i) => {
            const sel = i === 0 ? value.length === 0 : value.includes(o)
            return (
              <li
                key={o}
                role="option"
                aria-selected={sel}
                className={i === 0 ? 'col-span-full' : ''}
              >
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13.5px] transition-colors ${
                    active === i ? 'bg-panel' : ''
                  } ${sel ? 'font-bold text-teal' : 'text-body'}`}
                >
                  <span
                    className={`ms shrink-0 text-[18px] ${sel ? 'text-teal' : 'text-faint'}`}
                    aria-hidden
                  >
                    {sel ? 'check_box' : 'check_box_outline_blank'}
                  </span>
                  <span className="truncate">{o}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
