// /settings/privacy — 개인정보 보호 (v0-43 privacy-settings-page 이식, 정직 축소판).
//   _user 자식: 인증 가드는 부모 _user.tsx. 로더 없음(순수 클라 UI) → 리다이렉트 루프 무관.
//   §0/E-3 제거분: mock 카운트(차단수·기기수·Drop수 등), 가짜 다운로드 진행/계정삭제 모달(오버레이=#418),
//     dead 링크(로그인기록·기기관리·비번변경 등 라우트 없음). → 데이터 안내(정직) + 2단계 인증 로컬 토글만 이식.
//   데이터 다운로드/삭제는 실제 백엔드 필요 → "준비 중" 정직 안내(가짜 성공 금지).
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Shield, Smartphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_user/settings/privacy")({
  head: () => ({ meta: [{ title: "개인정보 보호 — LinkDrop" }] }),
  component: PrivacySettingsPage,
});

function PrivacySettingsPage() {
  // 화면만 — 로컬 상태(새로고침 시 리셋). 실제 2단계 인증 연동은 서비스 오픈 후.
  const [twoFactor, setTwoFactor] = useState(false);

  return (
    <main className="min-h-screen bg-white tracking-ko pb-16">
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[#F1F5F9] bg-white/95 px-2 backdrop-blur-xl">
        <Link
          to="/me"
          aria-label="뒤로"
          className="flex size-10 items-center justify-center rounded-full text-[#475569] transition-colors hover:bg-[#F1F5F9]"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </Link>
        <h1 className="flex-1 text-center text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">
          개인정보 보호
        </h1>
        <div className="w-10" />
      </header>

      <div className="mx-auto max-w-md px-4 pt-6">
        {/* 데이터 사용 안내 — 정적 정직 카피(GDPR·개인정보법 고지). */}
        <div className="rounded-xl bg-[#F8FAFC] p-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F1F5F9]">
              <Shield className="size-5 text-[#0F172A]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-bold text-[#0F172A]">
                LinkDrop은 데이터를 어떻게 사용하나요?
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                서비스 제공을 위해 최소한의 데이터만 수집합니다. 수집된 데이터는 Drop 전달, 쿠폰 발급,
                예약 연결에만 사용되며 제3자에게 판매되지 않습니다.
              </p>
            </div>
          </div>
        </div>

        {/* 보안 — 2단계 인증(로컬 토글, 저장 미연동). */}
        <h2 className="mb-3 mt-8 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
          보안
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#E8EDF3]">
          <div className="flex items-center justify-between gap-3 bg-white px-4 py-4">
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#94A3B8]">
                <Smartphone className="size-5" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[14px] font-medium text-[#0F172A]">2단계 인증</span>
                <span className="mt-0.5 block text-[12px] text-[#94A3B8]">추가 보안 (SMS 또는 앱)</span>
              </span>
            </span>
            <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
          </div>
        </div>

        {/* 데이터 권리 — 정직 안내(가짜 다운로드/삭제 모달 제거). */}
        <h2 className="mb-3 mt-8 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
          데이터 권리
        </h2>
        <div className="rounded-xl border border-[#E8EDF3] bg-white p-4">
          <p className="text-[13px] leading-relaxed text-[#64748B]">
            내 데이터 다운로드·계정 삭제 요청은 준비 중이에요. 지금 필요하시면 아래 담당자 메일로 요청해
            주세요.
          </p>
          <p className="mt-2 text-[12px] font-medium text-[#0F172A]">
            데이터 처리 책임자 · privacy@drop.how
          </p>
        </div>

        <p className="mt-8 border-t border-[#F1F5F9] pt-6 text-center text-[11px] text-[#94A3B8]">
          개인정보처리방침 · 이용약관은 서비스 오픈 시 안내됩니다.
        </p>
      </div>
    </main>
  );
}
