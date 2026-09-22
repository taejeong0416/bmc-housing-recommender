import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useEscape } from '../hooks/useEscape'
import { Button } from './ui/Button'

// 서비스 성격 고지 — 서비스에 처음 들어설 때 한 번 띄운다. 수집하지 않는다는 사실과 저장 위치,
// 실제 청약은 청약센터라는 역할 분담을 사용자가 시작 전에 인지하게 하는 것이 목적.
// 랜딩(/)에서는 띄우지 않는다 — 첫인상을 가리지 않고, 랜딩을 떠나 서비스 화면에 들어설 때 한 번 알린다.
export default function NoticeModal() {
  const { pathname } = useLocation()
  const seen = useStore((s) => s.state.noticeSeen)
  const patch = useStore((s) => s.patch)
  const open = !seen && pathname !== '/'
  const confirm = useCallback(() => patch({ noticeSeen: true }), [patch])
  useEscape(open, confirm)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-[420px] animate-rise rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-[16px] font-extrabold text-ink">
          개인정보를 수집·보관하지 않습니다
        </h2>
        <p className="mt-2.5 text-[13px] leading-[1.65] text-sub">
          로그인이 없고, 선택한 조건·취향·관심 목록은{' '}
          <b className="text-ink">사용자 브라우저에만</b> 저장되며{' '}
          <b className="text-ink">서버에 보관하지 않습니다.</b>
        </p>
        <p className="mt-2 text-[13px] leading-[1.65] text-sub">
          AI 검색을 쓸 때만 입력한 문장과 조건·관심 목록 요약을 외부 AI로 보내
          조건을 해석합니다.
        </p>
        <p className="mt-2 text-[13px] leading-[1.65] text-sub">
          실제 청약 신청·자격 조회는 <b className="text-ink">BMC 청약센터</b>
          에서 진행해 주세요.
        </p>
        <Button
          onClick={confirm}
          className="mt-4 w-full rounded-[12px] p-3 text-[14px]"
        >
          확인
        </Button>
      </div>
    </div>
  )
}
