import { useMemo, useState } from 'react'
import { useNav } from '../nav'
import { useStore } from '../store'
import { Button } from '../components/ui/Button'
import { soon } from '../components/ui/toastStore'

// 온보딩 개인정보 동의 화면. 공공기관 소관 업무(임대주택 공급)는 동의 없이 가능하나
// '취향 기반 개인화'는 부가서비스라 별도 동의가 필요 — 여기서 ①개인화 ④AI 외부처리를
// 각각 선택 동의로 받고, 처리방침은 열람·확인(고지)으로 둔다. 선택 미동의여도 진행 가능
// (미동의 시 비개인화 폴백). ②취향 학습은 성격이 달라 이 화면이 아니라 첫 찜 맥락 팝업에서 받는다.
export default function ConsentScreen() {
  const { go } = useNav()
  const goSetup = go('setup')
  const patch = useStore((s) => s.patch)

  const [personalize, setPersonalize] = useState(false)
  const [aiExternal, setAiExternal] = useState(false)
  const [policyRead, setPolicyRead] = useState(false)

  const allChecked = personalize && aiExternal && policyRead
  const setAll = (on: boolean) => {
    setPersonalize(on)
    setAiExternal(on)
    setPolicyRead(on)
  }

  const items = useMemo(
    () => [
      {
        key: 'policy',
        required: true,
        checked: policyRead,
        toggle: () => setPolicyRead((v) => !v),
        title: '개인정보 처리방침 확인',
        desc: '수집 항목·이용 목적·보유기간·파기 기준을 확인했습니다.',
        link: '개인정보 처리방침 보기',
      },
      {
        key: 'personalize',
        required: false,
        checked: personalize,
        toggle: () => setPersonalize((v) => !v),
        title: '개인화 추천을 위한 정보 이용',
        desc: '설정한 조건·취향을 추천 정렬에 활용합니다. 동의하지 않아도 인기·조건순으로 이용할 수 있어요.',
      },
      {
        key: 'ai',
        required: false,
        checked: aiExternal,
        toggle: () => setAiExternal((v) => !v),
        title: 'AI 검색 시 외부 처리',
        desc: '자연어 검색 입력을 외부 AI 서비스로 전송해 분석합니다. 미동의 시 기본 검색만 제공됩니다.',
      },
    ],
    [personalize, aiExternal, policyRead],
  )

  const submit = () => {
    patch({
      consentPersonalize: personalize,
      consentAiExternal: aiExternal,
      consentCompleted: true,
    })
    goSetup()
  }

  return (
    <div className="w-full max-w-[440px] animate-rise py-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-[20px] font-extrabold text-ink">
          <span className="ms text-[24px] text-teal">shield_person</span>
          개인정보 이용 동의
        </h1>
        <p className="mt-1.5 text-[13px] leading-[1.6] text-sub">
          더 잘 맞는 추천을 위해 아래 항목에 동의를 받아요.{' '}
          <b className="text-body">선택 항목은 동의하지 않아도</b> 서비스를
          이용할 수 있습니다.
        </p>
      </div>

      {/* 모두 동의 — 편의용. 개별 체크는 아래에서 각각 유지된다. */}
      <button
        onClick={() => setAll(!allChecked)}
        className="mb-3 flex w-full items-center gap-2.5 rounded-[12px] border border-teal/25 bg-teal-ghost px-4 py-3.5 text-left"
      >
        <CheckBox on={allChecked} />
        <span className="text-[14px] font-extrabold text-ink">
          약관 전체 동의
        </span>
      </button>

      <div className="flex flex-col gap-2.5">
        {items.map((it) => (
          <div
            key={it.key}
            className="rounded-[12px] border border-line-soft bg-white px-4 py-3.5"
          >
            <button
              onClick={it.toggle}
              className="flex w-full items-start gap-2.5 text-left"
            >
              <CheckBox on={it.checked} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <b className="text-[13.5px] text-ink">{it.title}</b>
                  <span
                    className={`shrink-0 rounded px-1.5 py-px text-[10.5px] font-bold ${
                      it.required
                        ? 'bg-panel text-sub'
                        : 'bg-teal-soft text-teal'
                    }`}
                  >
                    {it.required ? '필수' : '선택'}
                  </span>
                </span>
                <span className="mt-1 block text-[12px] leading-[1.55] text-sub">
                  {it.desc}
                </span>
              </span>
            </button>
            {it.link && (
              <button
                onClick={soon('개인정보 처리방침')}
                className="ml-[34px] mt-1.5 flex items-center gap-0.5 text-[11.5px] font-semibold text-teal transition-colors hover:text-teal-dark"
              >
                {it.link}
                <span className="ms text-[15px]">chevron_right</span>
              </button>
            )}
          </div>
        ))}
      </div>

      <Button
        onClick={submit}
        disabled={!policyRead}
        className="mt-6 w-full rounded-[12px] p-[13px] text-[15px] disabled:cursor-not-allowed disabled:opacity-45"
      >
        동의하고 시작하기
      </Button>
      <p className="mt-3 text-center text-[11.5px] text-faint">
        동의 내역은 마이페이지에서 언제든 확인·변경할 수 있어요.
      </p>
    </div>
  )
}

function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      className={`mt-px flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[6px] border transition-colors ${
        on ? 'border-teal bg-teal' : 'border-faint bg-white'
      }`}
    >
      {on && <span className="ms text-[15px] text-white">check</span>}
    </span>
  )
}
