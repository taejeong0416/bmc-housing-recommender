import { useStore } from '../store'
import { Button } from './ui/Button'

// 서비스 성격 고지 — 첫 진입에 한 번 띄운다. 수집하지 않는다는 사실과 저장 위치,
// 실제 청약은 청약센터라는 역할 분담을 사용자가 시작 전에 인지하게 하는 것이 목적.
export default function NoticeModal() {
  const seen = useStore((s) => s.state.noticeSeen)
  const patch = useStore((s) => s.patch)
  if (seen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-[420px] animate-rise rounded-2xl bg-white p-5 shadow-card">
        <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-ink">
          <span className="ms text-[21px] text-teal">shield_person</span>
          시민 개인정보를 수집·보관하지 않습니다
        </h2>
        <p className="mt-2.5 text-[13px] leading-[1.65] text-sub">
          로그인이 없고, 선택한 조건·취향·관심 목록은 사용자 브라우저에만
          저장되며 서버로 전송되지 않습니다. 실제 청약 신청·자격 조회는 BMC
          청약센터에서 진행해 주세요.
        </p>
        <Button
          onClick={() => patch({ noticeSeen: true })}
          className="mt-4 w-full rounded-[12px] p-3 text-[14px]"
        >
          확인
        </Button>
      </div>
    </div>
  )
}
