import { createFileRoute } from "@tanstack/react-router";
// S3-4e — 사업자 정보 단일 소스 이관: components/business-footer.tsx 의 BUSINESS_INFO 공유
//   (/d 법정 푸터 펼침과 중복 하드코딩 금지).
import { BUSINESS_INFO } from "@/components/business-footer";

// 사업자 정보 — 공개(비로그인) 라우트. Kakao 비즈 심사 + 전자상거래법 §10 충족용.
//   app.drop.how/business-info 로 로그인 없이 도달(랜딩 푸터 링크).
//   ⚠️ 법인등록번호는 절대 넣지 말 것(내부 식별번호). 사업자등록번호만 공개.

export const Route = createFileRoute("/business-info")({
  head: () => ({ meta: [{ title: "사업자 정보 — LinkDrop" }] }),
  component: BusinessInfoPage,
});

function BusinessInfoPage() {
  return (
    <main className="mx-auto min-h-screen max-w-md bg-white px-6 py-10 tracking-ko">
      <header className="mb-8">
        <h1 className="text-2xl font-extrabold text-[#0A0A0A]">사업자 정보</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed text-[#737373]">
          전자상거래 등에서의 소비자보호에 관한 법률 제10조에 따른 사업자 정보입니다.
        </p>
      </header>

      <dl className="border-y border-[#E5E5E5]">
        {BUSINESS_INFO.map((row) => (
          <div key={row.label} className="flex gap-4 border-b border-[#E5E5E5] py-3 last:border-b-0">
            <dt className="w-28 shrink-0 text-sm font-semibold text-[#737373]">{row.label}</dt>
            <dd className="min-w-0 flex-1 text-sm font-medium text-[#0A0A0A]">{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8">
        <a
          href="/"
          className="text-xs font-medium text-[#A3A3A3] underline-offset-2 transition-colors hover:text-[#525252] hover:underline"
        >
          ← 홈으로
        </a>
      </div>
    </main>
  );
}
