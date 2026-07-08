// 빌키 실연동(APICardAuth.do)은 상용 키 수령 후 v3 본체에서 구현 — 현재는 심사용 정기결제 프로세스 화면
// /subscribe — 비즈니스 구독 요금제(월 자동결제) 신청 화면 (CC-SUBSCRIBE-v3-UI).
//   심사용 정기결제 프로세스: 요금제 3종 + 정기결제 고지·동의 + [구독 시작하기] 접수 안내.
//   ⚠️ 빌키 발급 = 서버-서버 /spay/APICardAuth.do(카드정보 서버 AES) 방식으로 확정됐으나, PCI·심사
//   범위 고려로 이번엔 서버 연동을 만들지 않음(A안). 버튼은 접수 안내 폴백 — 실연동은 v3 본체.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { ChevronRight } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";

export const Route = createFileRoute("/_user/subscribe")({
  // 파트너 오너 가드(hecto-test 동일 패턴). 비대상 = 홈. 로컬 미설정/세션 없음은 상위 _user 처리.
  beforeLoad: async () => {
    const supabase = await getAuthClient();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const { data: isOwner } = await supabase.rpc("is_active_partner_owner", {
      _user_id: data.session.user.id,
    });
    if (!isOwner) throw redirect({ to: "/home" });
  },
  component: SubscribePage,
});

// ── 요금제 3종(정의서: 상품 3개+·상품명·제공기간·금액) ──
const PROVIDE_PERIOD = "결제일부터 1개월, 매월 자동갱신";
type Plan = { key: string; name: string; priceKrw: number; benefits: string[] };
const PLANS: Plan[] = [
  {
    key: "basic",
    name: "베이식",
    priceKrw: 33000,
    benefits: ["카드 발행 무제한", "기본 성과 리포트", "쿠폰·예약 기본 기능"],
  },
  {
    key: "pro",
    name: "프로",
    priceKrw: 55000,
    benefits: ["베이식 전체 포함", "확산 여정·전환 분석", "AI 카피 우선 처리", "구독자 관리"],
  },
  {
    key: "premium",
    name: "프리미엄",
    priceKrw: 110000,
    benefits: ["프로 전체 포함", "우선 노출·추천 가중", "전담 지원", "고급 리포트·내보내기"],
  },
];

// ── 약관 전문(표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정) ──
// 표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정
const SUB_RECURRING =
  "본 구독은 매월 자동 결제되며, 해지 전까지 매월 갱신됩니다. 해지 시 다음 결제일부터 청구가 중단되며, 이미 결제된 당월분은 환불되지 않습니다.";
// 표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정
const SUB_TERMS =
  "구독은 링크드롭 비즈니스 기능 이용 권한을 제공합니다. 구독 기간 동안 요금제별 혜택이 제공되며, 서비스 정책 및 관련 법령에 따라 이용 조건이 적용됩니다.";
// 표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정
const SUB_PRIVACY =
  "정기결제 처리를 위해 결제대행사(헥토파이낸셜)에 결제수단 정보가 안전하게 보관·이용됩니다. 제공 정보는 정기결제 처리 목적으로만 이용됩니다.";

const AGREE_TERMS = [
  { key: "recurring", label: "매월 정기결제 상품 확인 및 동의", body: SUB_RECURRING },
  { key: "terms", label: "구독 이용약관", body: SUB_TERMS },
  { key: "privacy", label: "개인정보 수집·이용 동의", body: SUB_PRIVACY },
] as const;

function fmtWon(n: number): string {
  return n.toLocaleString("ko-KR");
}

function SubscribePage() {
  const [selectedPlan, setSelectedPlan] = useState<string>("basic");
  const [agreedKeys, setAgreedKeys] = useState<Record<string, boolean>>({});
  const [expandedTerm, setExpandedTerm] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  const plan = PLANS.find((p) => p.key === selectedPlan) ?? PLANS[0];
  const allAgreed = AGREE_TERMS.every((t) => agreedKeys[t.key]);
  // 요금제 선택 + 필수 3개 동의 게이트는 유지(심사 캡처 요건). 접수 후 재제출 방지.
  const canStart = allAgreed && !submitted;

  // [구독 시작하기] — A안: 빌키 실연동 없이 접수 안내 폴백(서버 연동은 v3 본체).
  const onStart = useCallback(() => {
    if (!canStart) return;
    setSubmitted(true);
  }, [canStart]);

  return (
    <main className="min-h-screen bg-[#F6F8FB] tracking-ko pb-24">
      <header className="border-b border-[#F1F5F9] bg-white px-4 py-4">
        <h1 className="text-[22px] font-bold tracking-[-0.01em] text-[#0F172A]">구독 요금제</h1>
        <p className="mt-1 text-sm font-medium text-[#64748B]">
          비즈니스 기능을 매월 구독으로 이용하세요.
        </p>
      </header>

      <div className="mx-auto flex max-w-md flex-col gap-4 px-4 pt-4">
        {/* ① 요금제 3종 카드 */}
        <div className="flex flex-col gap-3">
          {PLANS.map((p) => {
            const selected = selectedPlan === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelectedPlan(p.key)}
                aria-pressed={selected}
                className={`flex flex-col rounded-2xl border bg-white p-5 text-left transition-colors ${
                  selected
                    ? "border-2 border-[#2563EB] shadow-[0_2px_8px_rgba(37,99,235,0.12)]"
                    : "border border-[#E8EDF3] hover:border-[#94A3B8]"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-base font-extrabold tracking-ko text-[#0F172A]">
                    {p.name}
                  </span>
                  <span className="text-lg font-extrabold tabular-nums tracking-ko text-[#0F172A]">
                    월 {fmtWon(p.priceKrw)}원
                    <span className="ml-1 text-xs font-semibold text-[#94A3B8]">VAT 포함</span>
                  </span>
                </div>
                <span className="mt-1 text-xs font-medium tracking-ko text-[#94A3B8]">
                  제공기간 · {PROVIDE_PERIOD}
                </span>
                <ul className="mt-3 flex flex-col gap-1">
                  {p.benefits.map((b) => (
                    <li
                      key={b}
                      className="flex items-start gap-1.5 text-[13px] font-medium tracking-ko text-[#475569]"
                    >
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#2563EB]" />
                      {b}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* ② 정기결제 상시 고지 */}
        <p className="rounded-xl bg-[#EFF4FF] p-4 text-xs font-medium leading-relaxed tracking-ko text-[#1D4ED8]">
          본 상품은 매월 자동으로 결제되는 정기결제 상품입니다. 선택하신 결제수단으로 매월 결제일에{" "}
          {fmtWon(plan.priceKrw)}원이 자동 청구되며, 언제든 해지할 수 있습니다.
        </p>

        {/* ② 정기결제 약관 동의(네이버 표준 계층) */}
        <div className="rounded-xl border border-[#E8EDF3] bg-white">
          <label className="flex items-center gap-2 px-4 py-3">
            <input
              type="checkbox"
              checked={allAgreed}
              onChange={(e) =>
                setAgreedKeys(Object.fromEntries(AGREE_TERMS.map((t) => [t.key, e.target.checked])))
              }
              className="size-5 shrink-0 accent-[#2563EB]"
            />
            <span className="text-sm font-bold tracking-ko text-[#0F172A]">전체 동의</span>
          </label>
          <div className="border-t border-[#E8EDF3]">
            {AGREE_TERMS.map((t) => {
              const open = !!expandedTerm[t.key];
              return (
                <div key={t.key} className="px-4">
                  <div className="flex items-center gap-2 py-2.5">
                    <input
                      type="checkbox"
                      checked={!!agreedKeys[t.key]}
                      onChange={() => setAgreedKeys((p) => ({ ...p, [t.key]: !p[t.key] }))}
                      className="size-5 shrink-0 accent-[#2563EB]"
                    />
                    <span className="flex-1 text-xs font-medium leading-relaxed tracking-ko text-[#64748B]">
                      <span className="font-bold text-[#DC2626]">[필수]</span> {t.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedTerm((p) => ({ ...p, [t.key]: !p[t.key] }))}
                      aria-expanded={open}
                      aria-label={`${t.label} 전문 보기`}
                      className="flex size-8 shrink-0 items-center justify-center text-[#94A3B8]"
                    >
                      <ChevronRight
                        className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
                        strokeWidth={2}
                      />
                    </button>
                  </div>
                  {open ? (
                    <p className="mb-2.5 rounded-lg bg-[#F1F5F9] px-3 py-2 text-[11px] font-medium leading-relaxed tracking-ko text-[#64748B]">
                      {t.body}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* ③ 구독 시작 — 요금제 선택 + 필수 3개 동의 시에만 활성. A안: 접수 안내 폴백. */}
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#2563EB] px-6 text-base font-bold tracking-ko text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitted ? "구독 신청 접수됨" : `${plan.name} 구독 시작하기 · 월 ${fmtWon(plan.priceKrw)}원`}
        </button>
        {submitted ? (
          <p className="rounded-lg bg-[#EFF4FF] px-3 py-2 text-xs font-medium tracking-ko text-[#1D4ED8]">
            구독 신청이 접수되었습니다. 정식 결제수단 등록은 서비스 오픈 후 안내드립니다.
          </p>
        ) : null}
        <p className="text-[11px] font-medium leading-relaxed tracking-ko text-[#94A3B8]">
          구독 신청을 접수하면 정식 결제수단(카드) 등록은 서비스 오픈 후 별도로 안내드립니다. 매월
          자동결제는 등록 완료 후 시작됩니다.
        </p>
      </div>
    </main>
  );
}
