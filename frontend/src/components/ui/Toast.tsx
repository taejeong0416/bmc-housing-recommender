import { useToastStore } from './toastStore'

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-7 z-[2000] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className="animate-toast-in pointer-events-auto flex items-center gap-2.5 rounded-full bg-ink/95 py-2 pl-[18px] pr-2.5 text-[13px] font-semibold text-white shadow-pop backdrop-blur-sm"
        >
          <span className={`ms text-[18px] ${t.iconClass}`}>{t.icon}</span>
          <span>{t.msg}</span>
          {t.action && (
            <button
              onClick={() => {
                t.action!.run()
                dismiss(t.id)
              }}
              className="ml-1 shrink-0 rounded-full bg-white/15 px-3 py-1 text-[12px] font-bold text-white transition-colors hover:bg-white/25"
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
