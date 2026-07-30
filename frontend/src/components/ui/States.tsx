// 로딩/빈/에러 3-상태 표준 표시(P1-C-3). 목록·상세가 공유.

function Panel({
  icon,
  title,
  sub,
}: {
  icon: string
  title: string
  sub?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      <span className="ms text-[34px] text-[#b7bfbb]">{icon}</span>
      <p className="text-[14px] font-bold text-[#5b6560]">{title}</p>
      {sub && <p className="text-[12.5px] text-sub">{sub}</p>}
    </div>
  )
}

export function LoadingState({ label = '불러오는 중…' }: { label?: string }) {
  return <Panel icon="hourglass_empty" title={label} />
}

export function EmptyState({
  label = '결과가 없습니다.',
  sub,
}: {
  label?: string
  sub?: string
}) {
  return <Panel icon="inbox" title={label} sub={sub} />
}

export function ErrorState({
  label = '불러오지 못했습니다.',
  sub = '잠시 후 다시 시도해 주세요.',
}: {
  label?: string
  sub?: string
}) {
  return <Panel icon="error_outline" title={label} sub={sub} />
}
