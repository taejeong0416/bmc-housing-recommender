import { useStore } from '../store'
import { toast } from '../components/ui/toastStore'

// 관심(하트) 단일 진입점 — 지도·상세·관심페이지가 같은 토글·토스트(실행취소)를 공유.
export function useFavorites() {
  const favorites = useStore((s) => s.state.favorites)
  const learningPromptSeen = useStore((s) => s.state.learningPromptSeen)
  const patch = useStore((s) => s.patch)
  const setFav = (id: string, on: boolean) =>
    patch((st) => ({ favorites: { ...st.favorites, [id]: on } }))

  const toggle = (id: string, name: string) => {
    const on = !favorites[id]
    setFav(id, on)
    // 첫 찜 순간에 취향 학습 동의를 맥락에서 한 번만 물어본다(§ just-in-time 동의).
    if (on && !learningPromptSeen) patch({ learningPromptOpen: true })
    if (on)
      toast(`'${name}' 관심목록에 담았어요`, {
        icon: 'favorite',
        iconClass: 'text-heart',
        action: { label: '실행취소', run: () => setFav(id, false) },
      })
    else
      toast(`'${name}' 관심목록에서 뺐어요`, {
        icon: 'favorite',
        iconClass: 'text-white/45',
        action: { label: '되돌리기', run: () => setFav(id, true) },
      })
  }

  return { favorites, toggle }
}
