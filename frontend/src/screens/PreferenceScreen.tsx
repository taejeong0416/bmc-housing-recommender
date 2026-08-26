import { useStore } from '../store'
import { useNav } from '../nav'
import { baseTags, byTagId, wLevels } from '../data'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Segmented } from '../components/ui/Segmented'
import { TagButton } from '../components/ui/TagButton'
import type { Tag } from '../types'

export default function PreferenceScreen() {
  const { state: s, patch } = useStore()
  const { go } = useNav()
  const togglePref = (id: string) => () =>
    patch((st) => {
      if (st.selectedTags.includes(id)) {
        const w = { ...st.tagWeights }
        delete w[id]
        return {
          selectedTags: st.selectedTags.filter((x) => x !== id),
          tagWeights: w,
        }
      }
      return {
        selectedTags: [...st.selectedTags, id],
        tagWeights: { ...st.tagWeights, [id]: 2 },
      }
    })
  const setWeight = (id: string, v: number) => () =>
    patch((st) => ({ tagWeights: { ...st.tagWeights, [id]: v } }))
  const weightItems = s.selectedTags.map((id) => {
    const t = byTagId[id] || ({} as Tag)
    const lvl = s.tagWeights[id] || 2
    return {
      icon: t.icon,
      label: t.label,
      remove: togglePref(id),
      segs: wLevels.map(([v, label]) => ({
        label,
        active: lvl === v,
        onClick: setWeight(id, v),
      })),
    }
  })
  const canNext = s.selectedTags.length > 0
  const selectedCount = s.selectedTags.length
  const goSetup = go('setup')

  return (
    <Card className="w-full max-w-[440px] animate-rise px-[30px] pb-[26px] pt-7 lg:max-w-[780px]">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-bold text-body">취향 설정</span>
          <span className="rounded-full bg-teal-ghost px-2.5 py-1 text-[11.5px] font-bold text-teal">
            1 / 2 단계
          </span>
        </div>
        <div className="mt-3.5 flex gap-1.5">
          <span className="h-[5px] flex-1 rounded-full bg-teal" />
          <span className="h-[5px] flex-1 rounded-full bg-line" />
        </div>
      </div>

      <h1 className="text-[23px] font-extrabold leading-[1.32] tracking-[-0.4px] text-ink">
        시민님의 취향에
        <br />딱 맞는 동네를 찾아드려요
      </h1>
      <p className="mt-2.5 text-[13.5px] text-sub">
        관심 있는 라이프스타일을 골라주세요. 여러 개 선택할 수 있어요.
      </p>

      <div className="mt-6 lg:grid lg:grid-cols-2 lg:gap-7 lg:items-start">
        <div className="grid grid-cols-4 gap-2.5">
          {baseTags.map((t) => (
            <TagButton
              key={t.id}
              active={s.selectedTags.includes(t.id)}
              onClick={togglePref(t.id)}
            >
              <span className="ms text-[24px]">{t.icon}</span>
              <span className="text-[12px] font-semibold">{t.label}</span>
            </TagButton>
          ))}
        </div>

        <div className="mt-7 lg:mt-0">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[14.5px] font-bold text-ink">
              <span className="ms text-[18px] text-teal">tune</span>취향별
              중요도
            </span>
            <span className="text-[12px] font-bold text-teal">
              {selectedCount}개 선택됨
            </span>
          </div>
          <p className="mt-1.5 text-[12px] text-sub">
            중요도가 높을수록 추천 순위에 더 크게 반영돼요.
          </p>

          {canNext ? (
            <div className="mt-3.5 flex flex-col gap-2.5">
              {weightItems.map((w) => (
                <div
                  key={w.label}
                  className="rounded-[13px] border border-line-soft bg-panel/60 px-3.5 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-teal-ghost">
                      <span className="ms text-[19px] text-teal">{w.icon}</span>
                    </span>
                    <span className="flex-1 text-[14px] font-bold text-ink">
                      {w.label}
                    </span>
                    <button
                      onClick={w.remove}
                      aria-label={`${w.label} 제거`}
                      className="rounded-md p-0.5 leading-[0] text-faint transition-colors hover:text-heart"
                    >
                      <span className="ms text-[18px]">close</span>
                    </button>
                  </div>
                  <Segmented items={w.segs} className="mt-2.5" />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3.5 rounded-[13px] border border-dashed border-line bg-panel/50 p-7 text-center">
              <span className="ms text-[26px] text-faint">touch_app</span>
              <p className="mt-1.5 text-[13px] text-sub">
                위에서 관심 있는 취향을 먼저 선택해 주세요
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[12px] text-faint">
          <span className="ms text-[15px]">info</span>언제든 변경할 수 있어요
        </span>
        <Button
          onClick={goSetup}
          disabled={!canNext}
          className="rounded-[11px] px-[22px] py-[11px] text-[14px]"
        >
          다음 단계
        </Button>
      </div>
    </Card>
  )
}
