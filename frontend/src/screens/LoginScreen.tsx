import { useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { socialLoginsData } from '../data'
import { Button } from '../components/ui/Button'
import { soon } from '../components/ui/toastStore'

export default function LoginScreen() {
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const patch = useStore((s) => s.patch)
  const consentCompleted = useStore((s) => s.state.consentCompleted)
  const { go } = useNav()
  const goMap = go('map')
  const goSetup = go('setup')
  const goConsent = go('consent')
  // 가짜 세션: 로그인/소셜 후 개인정보 동의(최초 1회) → 하드필터 설정 → 취향 학습.
  const doLogin = () => {
    patch({ loggedIn: true })
    if (consentCompleted) goSetup()
    else goConsent()
  }
  const pwType = showPw ? 'text' : 'password'
  const pwIcon = showPw ? 'visibility_off' : 'visibility'

  return (
    <div className="w-full max-w-[380px] animate-rise py-6">
      <div className="mb-7 text-center">
        <div className="text-[30px] font-extrabold tracking-[-1px] text-teal">
          Be:live
        </div>
        <p className="mt-1.5 text-[13px] text-sub">
          부산도시공사 취향 임대주택 추천
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-body">
            아이디
          </span>
          <div className="relative">
            <span className="ms pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-faint">
              person
            </span>
            <input
              placeholder="아이디를 입력하세요"
              className="w-full rounded-[11px] border border-line bg-panel py-3 pl-10 pr-3 text-[14px] text-ink transition-colors placeholder:text-faint focus:border-teal focus:bg-white"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-body">
            비밀번호
          </span>
          <div className="relative">
            <span className="ms pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-faint">
              lock
            </span>
            <input
              type={pwType}
              placeholder="비밀번호를 입력하세요"
              className="w-full rounded-[11px] border border-line bg-panel py-3 pl-10 pr-11 text-[14px] text-ink transition-colors placeholder:text-faint focus:border-teal focus:bg-white"
            />
            <button
              onClick={() => setShowPw((v) => !v)}
              aria-label="비밀번호 표시 전환"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 leading-[0] text-faint transition-colors hover:text-body"
            >
              <span className="ms text-[20px]">{pwIcon}</span>
            </button>
          </div>
        </label>
      </div>

      <div className="mt-3.5 flex items-center justify-between">
        <button
          onClick={() => setRemember((v) => !v)}
          className="flex items-center gap-2 text-[12.5px] font-semibold text-body"
        >
          <span
            className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
              remember ? 'border-teal bg-teal' : 'border-faint bg-white'
            }`}
          >
            {remember && (
              <span className="ms text-[14px] text-white">check</span>
            )}
          </span>
          로그인 상태 유지
        </button>
        <span className="flex items-center gap-2.5 text-[12.5px] font-semibold text-sub">
          <button
            onClick={soon('아이디 찾기')}
            className="transition-colors hover:text-body"
          >
            아이디 찾기
          </button>
          <span className="text-line">|</span>
          <button
            onClick={soon('비밀번호 찾기')}
            className="transition-colors hover:text-body"
          >
            비밀번호 찾기
          </button>
        </span>
      </div>

      <Button
        onClick={doLogin}
        className="mt-5 w-full rounded-[12px] p-[13px] text-[15px]"
      >
        로그인
      </Button>
      <Button
        variant="outline"
        onClick={soon('회원가입')}
        className="mt-2.5 w-full rounded-[12px] p-3 text-[14px]"
      >
        회원가입
      </Button>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line-soft" />
        <span className="text-[12px] font-semibold text-faint">
          간편 로그인
        </span>
        <span className="h-px flex-1 bg-line-soft" />
      </div>
      <div className="flex flex-col gap-2.5">
        {socialLoginsData.map((soc) => (
          <button
            key={soc.label}
            onClick={doLogin}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] p-3 text-[13.5px] font-bold transition-transform active:scale-[.98]"
            style={{ background: soc.bg, color: soc.color, border: soc.border }}
          >
            <span className="ms text-[18px]">{soc.icon}</span>
            {soc.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-[12px] bg-teal-ghost px-3.5 py-3">
        <span className="ms mt-px text-[17px] text-teal">verified_user</span>
        <p className="text-[11.5px] leading-[1.55] text-body">
          공공임대 신청·자격 조회에는 본인인증이 필요합니다. 개인정보는 관련
          법령에 따라 안전하게 보호됩니다.
        </p>
      </div>
      <button
        onClick={goMap}
        className="group mt-4 flex w-full items-center justify-center gap-1 text-[13px] font-semibold text-sub transition-colors hover:text-teal"
      >
        비회원으로 주택 둘러보기
        <span className="ms text-[16px] transition-transform group-hover:translate-x-0.5">
          arrow_forward
        </span>
      </button>
    </div>
  )
}
