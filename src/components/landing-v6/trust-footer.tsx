import { LinkDropLockup } from "@/components/brand/linkdrop-logo"

/** 신뢰 푸터 — 지표 + 사업자 정보를 가볍게 한 블록으로.
 *  UI-5-T7-L6 어댑트: ① 링크 실배선 — 이용약관=/tos · 개인정보=/privacy(BusinessFooter 정본
 *  목적지 동일) · 고객센터=/business-info(전용 페이지 부재 — 고객문의 행 보유 페이지로 배선,
 *  # 복귀 원하면 판정 1줄). ② v0 자리표시 사업자 정보 줄(홍길동·000-00-00000)은 렌더 제거
 *  (실정보는 __root 전역 BusinessFooter 가 담당 — 이중 렌더·허위 표기 방지). 원문 주석 보존 ↓ */
export function TrustFooter() {
  return (
    <footer className="px-5 pb-9 pt-1 text-center">
      {/* 로고 + 링크 — 중앙 정렬로 가볍게 */}
      <div className="flex items-center justify-center">
        <LinkDropLockup script="korean" tone="ink" symbolSize={22} />
      </div>
      <div className="mt-3 flex items-center justify-center gap-x-3 text-[11.5px] font-medium text-[#64748B]">
        <a href="/tos" className="underline-offset-2 hover:underline">이용약관</a>
        <span className="text-[#CBD5E1]">·</span>
        <a href="/privacy" className="underline-offset-2 hover:underline">개인정보</a>
        <span className="text-[#CBD5E1]">·</span>
        <a href="/business-info" className="underline-offset-2 hover:underline">고객센터</a>
      </div>

      {/* v0 원문 보존(렌더 제거 — 자리표시 정보라 허위 표기 위험 · 실정보는 BusinessFooter):
      <p className="mx-auto mt-3 max-w-[300px] text-[10.5px] leading-relaxed text-[#A3AEBE]">
        (주)링크드롭 · 대표 홍길동 · 사업자등록번호 000-00-00000
        <br />
        통신판매업 제2025-서울강남-0000호
      </p> */}
    </footer>
  )
}
