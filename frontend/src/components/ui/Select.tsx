import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

// 테마 드롭다운 — 네이티브 <select>의 OS 옵션창은 테마가 안 먹어, 트리거+팝오버 리스트박스로 직접 그린다.
// 값 기반 onChange(선택된 문자열). 미선택은 placeholder를 faint로 표시.
type Props = {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function Select({
  options,
  value,
  onChange,
  placeholder = '선택',
  disabled = false,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  const filled = !!value

  // 바깥 클릭 시 닫기 — 열려 있을 때만 리스너 부착.
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // 열릴 때 현재 값으로 활성 항목 맞춤.
  useEffect(() => {
    if (open) setActive(Math.max(0, options.indexOf(value)))
  }, [open, options, value])

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return
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
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (options[active]) choose(options[active])
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKey}
        className={`flex w-full items-center justify-between gap-2 rounded-[9px] border bg-white px-3 py-[10px] text-left text-[13px] transition-colors disabled:opacity-50 ${
          open ? 'border-teal' : 'border-line hover:border-teal/45'
        } ${filled ? 'text-ink' : 'text-faint'} ${className}`}
      >
        <span className="truncate">{filled ? value : placeholder}</span>
        <span
          className={`ms shrink-0 text-[18px] transition-transform duration-150 ${
            open ? 'rotate-180 text-teal' : 'text-faint'
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <ul
          role="listbox"
          className="animate-rise absolute z-50 mt-1.5 max-h-60 w-full overflow-auto rounded-[10px] border border-line bg-white p-1 shadow-pop"
        >
          {options.map((o, i) => {
            const sel = o === value
            return (
              <li key={o} role="option" aria-selected={sel}>
                <button
                  type="button"
                  onClick={() => choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[7px] px-2.5 py-2 text-left text-[13px] transition-colors ${
                    sel
                      ? 'bg-teal-ghost font-bold text-teal'
                      : active === i
                        ? 'bg-panel text-body'
                        : 'text-body'
                  }`}
                >
                  <span className="truncate">{o}</span>
                  {sel && (
                    <span className="ms text-[16px] text-teal">check</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
