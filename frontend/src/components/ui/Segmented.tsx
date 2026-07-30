// 단일 선택 세그먼트(구 theme.segStyle) — 취향 중요도 등.
export function Segmented({
  items,
  className = '',
}: {
  items: { label: string; active: boolean; onClick: () => void }[]
  className?: string
}) {
  return (
    <div
      className={`flex gap-1 rounded-[10px] bg-panel p-1 ${className}`}
      role="group"
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={it.onClick}
          aria-pressed={it.active}
          className={`flex-1 rounded-[7px] px-1 py-[7px] text-[12.5px] transition-[background-color,color,box-shadow] duration-150 ${
            it.active
              ? 'bg-white font-bold text-teal shadow-sm'
              : 'font-semibold text-sub hover:text-body'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}
