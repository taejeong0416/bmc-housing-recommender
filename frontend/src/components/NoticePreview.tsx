// 모집공고 참고자료 — BMC 실제 공고문(2026년 1차 청년 매입임대) 한 건의 첫 페이지를 보여주고,
// 클릭 시 전체 PDF를 연다. 단지별 공고가 아니라서 참고용임을 밝힌다.
// 상세화면 청약 액션(청약센터 바로가기) 바로 아래에 붙인다.
export function NoticePreview({ className = '' }: { className?: string }) {
  return (
    <a
      href={`${import.meta.env.BASE_URL}notices/sample-notice.pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex gap-3.5 rounded-xl border border-line-soft bg-panel p-3 transition-colors hover:border-teal/40 ${className}`}
    >
      <div className="relative h-[106px] w-[78px] shrink-0 overflow-hidden rounded-lg border border-line-soft bg-white shadow-sm">
        <img
          src={`${import.meta.env.BASE_URL}notices/sample-notice.png`}
          alt="2026년 1차 청년 매입임대주택 모집공고 첫 페이지"
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="ms text-[16px] text-teal">campaign</span>
          <span className="text-[13.5px] font-bold text-ink">
            모집공고 참고자료
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-sub">
          2026년 1차 청년 매입임대주택 공고예요. 이 단지의 공고는 청약센터에서
          확인해 주세요.
        </p>
        <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-[11.5px] font-bold text-white transition-colors group-hover:bg-teal-dark">
          <span className="ms text-[14px]">description</span>공고문 보기
        </span>
      </div>
    </a>
  )
}
