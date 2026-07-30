import { create } from 'zustand'

// 토스트: 데모 미배선 안내 + 관심 담기/빼기 피드백(아이콘·실행취소 액션 지원).
export type ToastAction = { label: string; run: () => void }
export type Toast = {
  id: number
  msg: string
  icon: string
  iconClass: string
  action?: ToastAction
}
type ToastOpts = { icon?: string; iconClass?: string; action?: ToastAction }

type ToastStore = {
  toasts: Toast[]
  push: (msg: string, opts?: ToastOpts) => void
  dismiss: (id: number) => void
}
let seq = 0
export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (msg, opts = {}) => {
    const id = ++seq
    const t: Toast = {
      id,
      msg,
      icon: opts.icon ?? 'bolt',
      iconClass: opts.iconClass ?? 'text-gold',
      action: opts.action,
    }
    set((s) => ({ toasts: [...s.toasts, t] }))
    // 실행취소 버튼이 있으면 누를 시간을 더 준다.
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
      opts.action ? 4200 : 2600,
    )
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}))

export const toast = (msg: string, opts?: ToastOpts) =>
  useToastStore.getState().push(msg, opts)
// 준비 중 안내 단축 헬퍼.
export const soon = (label: string) => () =>
  toast(`${label} 기능은 준비 중이에요`)
