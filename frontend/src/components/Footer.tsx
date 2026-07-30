import { footerLinks } from '../data'
import { soon } from './ui/toastStore'

export default function Footer() {
  return (
    <footer className="mt-[34px] border-t border-line">
      <div className="mx-auto max-w-[1280px] px-5 pb-2 pt-6">
        <div className="mb-3 flex flex-wrap gap-4">
          {footerLinks.map((f) => (
            <button
              key={f}
              onClick={soon(f)}
              className="text-[12.5px] font-bold text-body transition-colors hover:text-teal"
            >
              {f}
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-[1.7] text-sub">
          부산광역시 부산도시공사(BMC) · 부산광역시 부산진구 새싹로 1 · 대표전화
          051-810-1234
          <br />
          사업자등록번호 000-00-00000 · 통신판매업신고 제2026-부산진-0000호
        </p>
        <p className="mt-2 text-[11.5px] text-faint">
          © 2026 Busan Metropolitan Corporation. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
