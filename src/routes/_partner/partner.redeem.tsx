import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ScanLine, Ticket, X } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

// QR 스캐너 컨테이너 DOM id (html5-qrcode 가 비디오를 주입할 자리).
const SCANNER_ELEMENT_ID = "redeem-qr-scanner";

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
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // QR 스캐너 — client-only. html5-qrcode 는 카메라(getUserMedia)·DOM 의존이라
  //   서버 렌더 경로에 두지 않고 useEffect(클라이언트) 안에서만 동적 import·start·stop.
  //   스캔 = 보조 수단: 실패해도 기존 수동 입력 그대로 사용 가능. 자동 redeem 안 함(코드만 채움).
  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(SCANNER_ELEMENT_ID);
        scannerRef.current = instance;
        await instance.start(
          { facingMode: "environment" }, // 후면 카메라 — 손님 화면을 비춤
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            // 코드만 채운다 — 자동 redeem 금지. 직원이 금액 입력 후 기존 버튼으로 확정.
            setClaimCode(decodedText.trim());
            setScanning(false); // → cleanup 이 카메라 stop/clear
          },
          () => {
            // per-frame 디코드 실패는 조용히 무시(계속 스캔).
          },
        );
      } catch (err) {
        if (cancelled) return;
        // 권한 거부(NotAllowedError)·카메라 없음(NotFoundError) 등 → 수동 입력으로 폴백.
        console.error("[partner.redeem] QR 스캐너 시작 실패:", err);
        toast.error("카메라를 쓸 수 없어 코드를 직접 입력해 주세요.");
        setScanning(false);
      }
    })();
    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (inst) {
        // 카메라 자원 정리 — stop() 후 clear(). 이미 멈췄거나 DOM 제거된 경우는 무시.
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {});
      }
    };
  }, [scanning]);

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
    setSubmitting(true);
    try {
      const amt = amount.trim() ? Number(amount.replace(/[^0-9]/g, "")) : null;
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

        {/* QR 스캔(보조) — 손님 쿠폰 화면의 QR 을 스캔해 코드 자동 입력. 카메라 불가 시 위 수동 입력. */}
        <button
          type="button"
          onClick={() => setScanning((s) => !s)}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-bold text-[#0A0A0A] hover:bg-[#FAFAFA]"
        >
          {scanning ? (
            <X className="size-4" strokeWidth={2} />
          ) : (
            <ScanLine className="size-4" strokeWidth={2} />
          )}
          {scanning ? "스캔 닫기" : "QR 스캔"}
        </button>
        {scanning ? (
          <div className="mt-3">
            <div
              id={SCANNER_ELEMENT_ID}
              className="mx-auto w-full max-w-[280px] overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#0A0A0A]"
            />
            <p className="mt-2 text-xs text-[#64748B]">손님 화면의 QR 코드를 비춰 주세요.</p>
          </div>
        ) : null}

        <label htmlFor="amount" className="mt-5 block text-sm font-semibold text-[#0F172A]">
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
