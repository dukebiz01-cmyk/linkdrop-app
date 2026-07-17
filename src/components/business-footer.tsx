// S3-4e — 사업자 정보 단일 소스(하드코딩 중복 금지): /business-info 라우트 표와
//   /d 법정 푸터 펼침이 공유. ⚠️ 법인등록번호 금지 — 사업자등록번호만 공개.
export type BusinessInfoRow = { label: string; value: string };
export const BUSINESS_INFO: BusinessInfoRow[] = [
  { label: "상호", value: "피티아이티 주식회사" },
  { label: "대표자", value: "이현민" },
  { label: "사업자등록번호", value: "125-86-19781" },
  { label: "사업장 주소", value: "경기도 평택시 용죽2로 30, 상가동 지하1층 B04호" },
  { label: "이메일", value: "dukebiz01@gmail.com" },
  { label: "고객문의", value: "031-8094-0012" },
];

export function BusinessFooter() {
  return (
    <footer className="border-t border-border bg-surface px-5 py-7 text-xs leading-6 text-text-muted">
      <div className="mx-auto max-w-screen-sm space-y-1 text-center">
        <p className="font-medium text-text-strong">피티아이티주식회사</p>
        <p>대표자 이현민 · 사업자등록번호 125-86-19781</p>
        <p>경기도 평택시 용죽2로 30, 상가동 지하1층 B04호</p>
        <p>고객센터 031-8094-0012 · dukebiz01@gmail.com</p>
        <nav className="flex justify-center gap-3 pt-2">
          <a href="/business-info" className="hover:text-text-strong">
            사업자정보
          </a>
          <a href="/tos" className="hover:text-text-strong">
            이용약관
          </a>
          <a href="/privacy" className="hover:text-text-strong">
            개인정보처리방침
          </a>
        </nav>
      </div>
    </footer>
  );
}
