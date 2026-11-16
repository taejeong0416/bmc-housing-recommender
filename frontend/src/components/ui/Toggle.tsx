// 온오프 스위치(구 theme.track/knob) — 지도 레이어 토글 등.
export function Toggle({
  on,
  onClick,
  ariaLabel,
}: {
  on: boolean
  onClick: () => void
  ariaLabel?: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={on}
      className={`relative inline-block h-[22px] w-10 rounded-[20px] transition-colors duration-150 ${
        on ? 'bg-teal' : 'bg-[#cfd6d3]'
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-transform duration-150 ${
          on ? 'translate-x-[18px]' : 'translate-x-0'
        }`}
      ></span>
    </button>
  )
}
