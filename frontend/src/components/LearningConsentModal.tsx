import { useStore } from '../store'
import { Button } from './ui/Button'

// 취향 학습 맥락 물음(just-in-time). 찜·스와이프 행동을 프로파일에 계속 반영하는 기능이라
// 학습이 실제로 시작되는 첫 찜 시점에 한 번만 물어 사용자가 인지하고 고르게 한다.
// 이후 변경은 취향·조건 설정의 토글로. (기본 OFF, 학습 결과는 이 브라우저에만 남는다)
export default function LearningConsentModal() {
  const open = useStore((s) => s.state.learningPromptOpen)
  const patch = useStore((s) => s.patch)
  if (!open) return null

  const choose = (enabled: boolean) =>
    patch({
      favoriteLearningEnabled: enabled,
      learningPromptSeen: true,
      learningPromptOpen: false,
    })

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="w-full max-w-[380px] animate-rise rounded-2xl bg-white p-5 shadow-card">
        <h2 className="text-[16px] font-extrabold text-ink">
          찜으로 추천을 더 맞춰드릴까요?
        </h2>
        <p className="mt-2 text-[13px] leading-[1.6] text-sub">
          찜하거나 넘겨본 집을 바탕으로 취향을 학습해 추천을 점점 더 정교하게
          맞춰드려요. 학습 결과는 <b className="text-body">이 브라우저에만</b>{' '}
          저장되고, '취향·조건'에서 언제든 끌 수 있어요.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={() => choose(true)}
            className="w-full rounded-[12px] p-3 text-[14px]"
          >
            네, 취향 학습 켜기
          </Button>
          <Button
            variant="outline"
            onClick={() => choose(false)}
            className="w-full rounded-[12px] p-3 text-[14px]"
          >
            아니요, 켜지 않을게요
          </Button>
        </div>
      </div>
    </div>
  )
}
