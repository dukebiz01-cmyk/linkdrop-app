import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Calendar as CalendarIcon, Check, MapPin, Ticket } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

// /r/{claim_code} — 공개 확인/처리 페이지. QR(URL)을 아무 카메라로 스캔하면 열린다.
//   읽기전용 쿠폰 표시(손님/anon) + can_redeem(매장 owner/staff)이면 사용 처리(redeem_coupon_v2).
//   ★ 인증 게이트 없음(공개) — d.$shareUuid.tsx 패턴. 데이터는 get_coupon_by_claim_code RPC(B1).
//   SSR loader 가 쿠키 세션을 타므로 can_redeem 이 뷰어 기준으로 옳게 계산됨.

type CouponInfo = {
  claim_code: string;
  status: string; // issued | used | expired | cancelled
  used_at: string | null;
  expires_at: string | null;
  store_name: string | null;
  store_kind: string | null;
  store_address: string | null;
  title: string | null;
  coupon_type: string | null;
  gift_item: string | null;
  discount_value: number | null;
  discount_unit: string | null; // KRW | percent ...
  conditions: { min_amount?: number; [k: string]: unknown } | null;
  valid_from: string | null;
  valid_until: string | null;
  can_redeem: boolean;
};

export const Route = createFileRoute("/r/$claim_code")({
  head: () => ({ meta: [{ title: "쿠폰 확인 — LinkDrop" }] }),
  loader: async ({ params }): Promise<CouponInfo | null> => {
    try {
      const supabase = await getAuthClient();
      if (!supabase) return null;
      const { data, error } = await supabase.rpc("get_coupon_by_claim_code", {
        p_claim_code: params.claim_code,
      });
      if (error || !data) return null; // 없는 코드 → 404 뷰
      return data as unknown as CouponInfo;
    } catch (e) {
      console.error("[r/$claim_code loader]", e);
      return null;
    }
  },
  component: CouponVerifyPage,
});

function friendlyError(message: string): string {
  if (message.includes("INVALID_CLAIM_CODE")) return "없는 코드예요. 코드를 다시 확인해 주세요.";
  if (message.includes("ALREADY_USED")) return "이미 사용된 쿠폰이에요.";
  if (message.includes("EXPIRED")) return "기간이 지난 쿠폰이에요.";
  if (message.includes("STAFF_REQUIRED") || message.includes("UNAUTHORIZED_STAFF"))
    return "이 매장 직원만 사용 처리할 수 있어요.";
  return "처리에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function benefitLine(d: CouponInfo): string | null {
  if (d.coupon_type === "gift" && d.gift_item?.trim()) return `${d.gift_item.trim()} 증정`;
  if (typeof d.discount_value === "number" && d.discount_value > 0) {
    // percent 판별 = coupon_type==="percent" (RPC 의 discount_unit 은 "%" 라 unit 비교는 빗나감)
    return d.coupon_type === "percent"
      ? `${d.discount_value}% 할인`
      : `${d.discount_value.toLocaleString("ko-KR")}원 할인`;
  }
  return null;
}

function statusLabel(s: string): string {
  switch (s) {
    case "issued":
      return "사용 가능";
    case "used":
      return "사용 완료";
    case "expired":
      return "만료";
    case "cancelled":
      return "취소됨";
    default:
      return s;
  }
}

function CouponVerifyPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 404 — 없는 코드
  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] tracking-ko px-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-[#F5F5F5]">
          <Ticket className="size-7 text-[#A3A3A3]" strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-lg font-bold text-[#0A0A0A]">쿠폰을 찾을 수 없어요</h1>
        <p className="mt-2 text-sm text-[#64748B]">유효한 쿠폰 코드인지 확인해 주세요.</p>
      </main>
    );
  }

  const benefit = benefitLine(data);
  const minAmount =
    typeof data.conditions?.min_amount === "number" ? data.conditions.min_amount : null;
  const validUntil = data.valid_until ?? data.expires_at;
  const isIssued = data.status === "issued";
  const canRedeem = data.can_redeem === true && isIssued; // ★ 손님/anon·비-issued 면 처리 버튼 없음
  const claimCode = data.claim_code; // 가드 이후 캡처(클로저 narrowing 보존)

  async function handleRedeem() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("로그인 상태를 다시 확인해 주세요.");
        return;
      }
      const amt = amount.trim() ? Number(amount.replace(/[^0-9]/g, "")) : null;
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
      const { error } = await supabase.rpc("redeem_coupon_v2", {
        p_claim_code: claimCode,
        p_staff_id: user.id,
        p_amount_krw: amt,
        p_ip: null,
        p_user_agent: userAgent,
      });
      if (error) {
        console.error("[r/$claim_code] redeem_coupon_v2 failed:", error);
        toast.error(friendlyError(error.message ?? ""));
        return;
      }
      toast.success("사용 처리됐어요.");
      setAmount("");
      await router.invalidate(); // loader 재실행 → status=used 반영(버튼 사라짐)
    } catch (err) {
      console.error("[r/$claim_code] unexpected:", err);
      toast.error("처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko px-5 pb-12 pt-5">
      <div className="mx-auto w-full max-w-[420px]">
        {/* 읽기전용 쿠폰 카드 */}
        <section className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#64748B]">
                <MapPin className="size-4" strokeWidth={2} />
                {data.store_name?.trim() || "매장"}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  isIssued ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#94A3B8]"
                }`}
              >
                {statusLabel(data.status)}
              </span>
            </div>

            <h1 className="mt-3 text-xl font-extrabold leading-snug text-[#0A0A0A]">
              {data.title?.trim() || "쿠폰"}
            </h1>

            {benefit ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#FAFAFA] px-3 py-1.5 text-base font-bold text-[#0A0A0A]">
                {benefit}
              </p>
            ) : null}

            {minAmount !== null ? (
              <p className="mt-3 text-sm font-medium text-[#475569]">
                {minAmount.toLocaleString("ko-KR")}원 이상 사용 시
              </p>
            ) : null}

            {validUntil ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#64748B]">
                <CalendarIcon className="size-[15px]" strokeWidth={2} />
                {formatDate(validUntil)} 까지
              </p>
            ) : null}

            {data.status === "used" && data.used_at ? (
              <p className="mt-2 text-xs text-[#A3A3A3]">{formatDate(data.used_at)} 사용 완료</p>
            ) : null}
          </div>
        </section>

        {/* 처리 — can_redeem(매장 owner/staff) + issued 일 때만 */}
        {canRedeem ? (
          <section className="mt-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <Ticket className="size-4 text-[#0A0A0A]" strokeWidth={2} />
              <h2 className="text-sm font-semibold text-[#0A0A0A]">사용 처리</h2>
            </div>
            <label htmlFor="amount" className="block text-sm font-semibold text-[#0F172A]">
              결제 금액 (원, 선택)
            </label>
            <input
              id="amount"
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 15000"
              className="mt-2 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
            />
            <p className="mt-2 text-xs text-[#64748B]">
              안 적으셔도 사용 처리는 돼요. 적어주시면 매출 집계에 도움이 돼요.
            </p>
            <button
              type="button"
              onClick={() => void handleRedeem()}
              disabled={submitting}
              className="mt-4 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] px-6 py-3 text-base font-bold text-white hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                "처리 중…"
              ) : (
                <>
                  <Check className="size-5" strokeWidth={2.5} />
                  사용 처리하기
                </>
              )}
            </button>
          </section>
        ) : (
          // 손님/anon 또는 이미 처리/만료 — 읽기전용 안내
          <p className="mt-4 text-center text-sm text-[#64748B]">
            {isIssued ? "매장 직원이 확인 후 처리해요." : "처리가 끝났거나 사용할 수 없는 쿠폰이에요."}
          </p>
        )}

        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          className="mt-6 inline-flex items-center gap-1 text-xs font-medium text-[#64748B] hover:text-[#0A0A0A]"
        >
          <ArrowLeft className="size-3.5" strokeWidth={2} />
          LinkDrop 홈
        </button>
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
