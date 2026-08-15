import { LinkDropLockup } from "@/components/brand/linkdrop-logo"

/** 신뢰 푸터 — 지표 + 링크만 가볍게(사업자 정보 줄 없음).
 *  UI-5-T7-L6 어댑트: 링크 실배선 — 이용약관=/tos · 개인정보=/privacy(BusinessFooter 정본
 *  목적지 동일) · 고객센터=/business-info(전용 페이지 부재 — 고객문의 행 보유 페이지로 배선,
 *  # 복귀 원하면 판정 1줄).
 *  PG1-c — 사업자 정보(상호·대표자·사업자등록번호·통신판매업신고)는 __root 전역 BusinessFooter
 *  단독 담당. 랜딩에서 이 푸터 바로 아래 렌더되므로 여기 두면 이중 표기 — 렌더분 제거 확정.
 *  v0 자리표시 줄(홍길동·000-00-00000) 사체는 PG1-b 에서 폐기 — 재복원 금지. */
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
    </footer>
  )
}
