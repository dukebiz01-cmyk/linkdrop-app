import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ticket } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

type LoaderData = { ownerUserId: string | null };

export const Route = createFileRoute("/_partner/partner/redeem")({
  head: () => ({ meta: [{ title: "쿠폰 사용 처리 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const supabase = await getAuthClient();
    if (!supabase) return { ownerUserId: null };
    const { data: sessionData } = await supabase.auth.getSession();
    return { ownerUserId: sessionData.session?.user.id ?? null };
  },
  component: RedeemPage,
});

function friendlyError(message: string): string {
  if (message.includes("INVALID_CLAIM_CODE")) return "없는 코드예요. 코드를 다시 확인해 주세요.";
  if (message.includes("ALREADY_USED")) return "이미 사용된 쿠폰이에요.";
  if (message.includes("EXPIRED")) return "기간이 지난 쿠폰이에요.";
  return "처리에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

function RedeemPage() {
  const { ownerUserId } = Route.useLoaderData();
  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko">
      <header className="flex items-center gap-3 bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#0F172A] hover:bg-[#F1F5F9]"
          aria-label="뒤로"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-[#0F172A]">쿠폰 사용 처리</h1>
      </header>
      <CouponRedeemView ownerUserId={ownerUserId} />
      <Toaster richColors position="top-center" />
    </main>
  );
}

// 쿠폰 코드 처리 본문 — /partner/redeem 와 /partner/promotion(탭) 양쪽에서 재사용.
export function CouponRedeemView({ ownerUserId }: { ownerUserId: string | null }) {
  const [claimCode, setClaimCode] = useState("");
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  async function handleRedeem(e: React.FormEvent) {
    e.preventDefault();
    const code = claimCode.trim();
    if (!code) {
      toast.error("쿠폰 코드를 입력해 주세요.");
      return;
    }
    if (!ownerUserId) {
      toast.error("로그인 상태를 다시 확인해 주세요.");
      return;
    }
    // 금액 필수 — 비었거나 0 이하면 RPC 호출 전 차단(NULL/0 → gross NULL → 트리거 롤백 방지).
    const amt = amount.trim() ? Number(amount.replace(/[^0-9]/g, "")) : null;
    if (amt === null || !Number.isFinite(amt) || amt <= 0) {
      setAmountError(true);
      amountRef.current?.focus();
      toast.error("사용 금액을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
      const { error } = await getSupabase().rpc("redeem_coupon_v2", {
        p_claim_code: code,
        p_staff_id: ownerUserId,
        p_amount_krw: amt,
        // 브라우저는 자기 IP 모름 — null. 서버 측 클라이언트 IP 로깅은 후속.
        p_ip: null,
        p_user_agent: userAgent,
      });
      if (error) {
        console.error("[partner.redeem] redeem_coupon_v2 failed:", error);
        toast.error(friendlyError(error.message ?? ""));
        return;
      }
      toast.success("사용 처리됐어요.");
      setClaimCode("");
      setAmount("");
      setAmountError(false);
    } catch (err) {
      console.error("[partner.redeem] unexpected:", err);
      toast.error("처리에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleRedeem} className="space-y-4 px-5 pt-5">
      <section className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <div className="mb-4 flex items-center gap-2">
          <Ticket className="size-4 text-[#0A0A0A]" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-[#0A0A0A]">쿠폰 코드 입력</h2>
        </div>

        <label htmlFor="claim-code" className="block text-sm font-semibold text-[#0F172A]">
          손님이 보여주신 코드
        </label>
        <input
          id="claim-code"
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          value={claimCode}
          onChange={(e) => setClaimCode(e.target.value)}
          placeholder="예: ABCD1234"
          className="mt-2 h-12 w-full rounded-xl border border-[#E5E7EB] bg-white px-4 text-base font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
        />
        <p className="mt-2 text-xs text-[#64748B]">
          손님이 휴대폰에서 보여주신 코드를 그대로 입력해 주세요.
        </p>

        <label htmlFor="amount" className="mt-5 block text-sm font-semibold text-[#0F172A]">
          결제 금액 (원) <span className="text-[#DC2626]">*</span>
        </label>
        <input
          id="amount"
          ref={amountRef}
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            if (amountError) setAmountError(false);
          }}
          aria-invalid={amountError}
          placeholder="예: 15000"
          className={`mt-2 h-12 w-full rounded-xl border bg-white px-4 text-base font-semibold text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 ${
            amountError
              ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]/20"
              : "border-[#E5E7EB] focus:border-[#0A0A0A] focus:ring-[#0A0A0A]/20"
          }`}
        />
        {amountError ? (
          <p className="mt-2 text-xs font-medium text-[#DC2626]">사용 금액을 입력해주세요.</p>
        ) : (
          <p className="mt-2 text-xs text-[#64748B]">
            실제 결제하신 금액을 입력해 주세요. 매출 집계와 보상 정산에 사용돼요.
          </p>
        )}
      </section>

      <button
        type="submit"
        disabled={submitting || !claimCode.trim()}
        className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6 py-3 text-base font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "처리 중…" : "사용 처리하기"}
      </button>
    </form>
  );
}
