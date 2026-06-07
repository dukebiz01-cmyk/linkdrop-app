import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  Copy,
  Gift as GiftIcon,
  Home as HomeIcon,
  MapPin,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getCouponDisplayStatus } from "@/lib/coupon-status";
import { Toaster } from "@/components/ui/sonner";

/**
 * /coupon/$claim_code — 쿠폰 상세 기프티콘 (phase1-2).
 *
 * 손님이 매장에서 보여주는 화면. me.tsx 의 coupon_claims → coupons → partners
 * 중첩 JOIN 패턴 재사용. catcher_user_id 강제로 본인 쿠폰만 조회.
 *
 * 4상태 매핑 (claim_status enum):
 *   - issued → "사용 가능" 배지(초록) + 코드 강조
 *   - used → "사용 완료" + 흐리게(opacity-60) + used_at
 *   - expired → "기간 만료" + 흐리게
 *   - cancelled → "취소" + 흐리게
 *
 * 색 정책 (phase1-2 line 6-8): v0.26 검정 미니멀 그대로. #0A0A0A 파랑 X.
 * 시안의 파랑 무시, v0 my-coupons-page 의 검정 색감 따름.
 */

type CouponDetailData = {
  id: string;
  status: string;
  used_at: string | null;
  expires_at: string | null;
  claim_code: string;
  coupon: {
    title: string;
    discount_value: number | string | null;
    discount_unit: string | null;
    valid_until: string | null;
    conditions: { min_amount?: number; [k: string]: unknown } | null;
    coupon_type: string | null;
    gift_item: string | null;
    partner: { display_name: string } | null;
  } | null;
};

export const Route = createFileRoute("/_user/coupon/$claim_code")({
  head: () => ({ meta: [{ title: "쿠폰" }] }),
  loader: async ({ params }): Promise<CouponDetailData | null> => {
    const supabase = await getAuthClient();
    if (!supabase) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return null;

    const { data } = await supabase
      .from("coupon_claims")
      .select(
        "id, status, used_at, expires_at, claim_code, " +
          "coupon:coupons(title, discount_value, discount_unit, valid_until, conditions, coupon_type, gift_item, " +
          "partner:partners(display_name))",
      )
      .eq("claim_code", params.claim_code)
      .eq("catcher_user_id", userId)
      .maybeSingle();

    return (data as CouponDetailData | null) ?? null;
  },
  component: CouponDetailPage,
});

function CouponDetailPage() {
  const data = Route.useLoaderData();
  const navigate = useNavigate();

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#EAEEF4] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F5F5F5]">
          <CalendarIcon className="h-7 w-7 text-[#A3A3A3]" strokeWidth={1.75} />
        </div>
        <h2 className="mt-5 text-[17px] font-semibold text-[#0A0A0A]">쿠폰을 찾을 수 없어요</h2>
        <p className="mt-2 text-sm text-[#525252]">유효한 쿠폰 번호인지 확인해 주세요.</p>
        <button
          type="button"
          onClick={() => navigate({ to: "/me" })}
          className="mt-6 rounded-full bg-[#0A0A0A] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#171717]"
        >
          내 쿠폰함으로
        </button>
      </main>
    );
  }

  return <CouponDetailView data={data} onBack={() => navigate({ to: "/me" })} />;
}

function CouponDetailView({ data, onBack }: { data: CouponDetailData; onBack: () => void }) {
  const status = data.status;
  const expiresAt = data.expires_at ?? data.coupon?.valid_until ?? null;
  // 표시 상태 — status/used_at/expires_at 종합(만료 반영). 만료일은 표시값과 동일 기준.
  const displayStatus = getCouponDisplayStatus({
    status,
    used_at: data.used_at,
    expires_at: expiresAt,
  });
  const isCancelled = status === "cancelled";
  // 활성(사용 가능/곧 만료) ↔ 흐림(사용 완료/만료/취소).
  const isActive = displayStatus === "available" || displayStatus === "expiring";
  const isExpiring = displayStatus === "expiring";
  const isUsed = displayStatus === "used";
  const isExpired = displayStatus === "expired" && !isCancelled;
  const isDim = !isActive;

  const couponTitle = data.coupon?.title?.trim() || "쿠폰";
  const storeName = data.coupon?.partner?.display_name?.trim() || "";
  const isGift = data.coupon?.coupon_type === "gift";
  const giftItem = data.coupon?.gift_item?.trim() || "";
  const minAmount =
    !isGift && typeof data.coupon?.conditions?.min_amount === "number"
      ? data.coupon.conditions.min_amount
      : null;

  return (
    <main className="flex min-h-screen flex-col items-center bg-[#EAEEF4] tracking-ko px-[18px] pb-10 pt-[22px]">
      <div className="w-full max-w-[392px]">
        {/* 헤더 */}
        <div className="flex items-center gap-2 px-1 pb-5">
          <button
            type="button"
            onClick={onBack}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#0A0A0A] hover:bg-white/60"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
          </button>
          <h1 className="text-[19px] font-extrabold tracking-[-0.02em] text-[#0A0A0A]">쿠폰</h1>
        </div>

        {/* 쿠폰 카드 (티켓 구조) */}
        <article
          className={`relative overflow-hidden rounded-[22px] bg-white shadow-[0_14px_36px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.04)] transition-opacity ${
            isDim ? "opacity-60" : ""
          }`}
        >
          {/* 상단 — 매장·제목·혜택·유효기간 */}
          <div className="px-[22px] pb-[18px] pt-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#525252]">
                <MapPin className="h-4 w-4" strokeWidth={2} />
                {storeName || "매장 정보 없음"}
              </span>
              <StatusBadge
                isActive={isActive}
                isExpiring={isExpiring}
                isUsed={isUsed}
                isExpired={isExpired}
                isCancelled={isCancelled}
              />
            </div>

            <p className="text-[29px] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#0A0A0A]">
              {couponTitle}
            </p>

            {isGift && giftItem ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FAFAFA] px-3 py-1.5 text-base font-bold text-[#0A0A0A]">
                <GiftIcon className="h-4 w-4" strokeWidth={2.4} />
                {giftItem} 증정
              </p>
            ) : minAmount !== null ? (
              <p className="mt-2.5 text-base font-medium text-[#334155]">
                {minAmount.toLocaleString("ko-KR")}원 이상 사용하실 때
              </p>
            ) : null}

            {expiresAt ? (
              <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#64748B]">
                <CalendarIcon className="h-[15px] w-[15px]" strokeWidth={2} />
                {formatDate(expiresAt)} 까지
              </p>
            ) : null}

            {isUsed && data.used_at ? (
              <p className="mt-2 text-xs text-[#A3A3A3]">
                {formatDateTime(data.used_at)} 사용 완료
              </p>
            ) : null}
          </div>

          {/* 점선 perforation + 좌우 notch */}
          <div className="relative mx-[22px] border-t-2 border-dashed border-[#E2E8F0]" aria-hidden>
            <span className="absolute left-[-35px] top-1/2 h-[26px] w-[26px] -translate-y-1/2 rounded-full bg-[#EAEEF4]" />
            <span className="absolute right-[-35px] top-1/2 h-[26px] w-[26px] -translate-y-1/2 rounded-full bg-[#EAEEF4]" />
          </div>

          {/* 하단 — 쿠폰 번호 + 복사 */}
          <div className="px-[22px] pb-6 pt-[18px]">
            <p className="mb-2 text-sm font-semibold text-[#64748B]">쿠폰 번호</p>
            <CouponCodeRow code={data.claim_code} disabled={isDim} />
          </div>
        </article>

        {/* 안내 */}
        {isActive ? (
          <div className="mt-[18px] flex items-center gap-[13px] rounded-2xl bg-white px-[18px] py-4 shadow-[0_2px_10px_rgba(15,23,42,0.05)]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5]">
              <HomeIcon className="h-[21px] w-[21px] text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <p className="text-base font-bold leading-[1.4] tracking-[-0.01em] text-[#1E293B]">
              방문 시 사장님께
              <br />이 화면을 보여주세요
            </p>
          </div>
        ) : null}

        {/* 쿠폰함 동선 — 받은 쿠폰을 다시 찾는 경로 명시 (재방문 보조). */}
        <button
          type="button"
          onClick={onBack}
          className="mt-[18px] flex w-full min-h-[52px] items-center justify-center rounded-2xl bg-[#0A0A0A] px-6 text-base font-bold text-white transition-colors hover:bg-[#171717]"
        >
          내 쿠폰함 보기
        </button>
        <p className="mt-2 text-center text-xs text-[#64748B]">
          받은 쿠폰은 '나' 탭에서 다시 볼 수 있어요.
        </p>

        {/* 푸터 */}
        <footer className="mt-[26px] text-center">
          <div className="inline-flex items-center gap-1.5 text-sm font-bold text-[#475569]">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] bg-[#0A0A0A] text-[12px] font-extrabold text-white">
              D
            </span>
            LinkDrop
          </div>
          <p className="mt-2 text-[11px] leading-[1.5] text-[#94A3B8]">
            본 콘텐츠는 LinkDrop 광고/제휴 안내가 적용됩니다 (FTC 권고)
          </p>
        </footer>
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}

function CouponCodeRow({ code, disabled }: { code: string; disabled: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("쿠폰 번호를 복사했어요.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("복사에 실패했어요.");
    }
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex-1 font-mono text-[25px] font-extrabold tracking-[0.05em] text-[#0A0A0A] break-all">
        {code}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        aria-label="쿠폰 번호 복사"
        className={`flex shrink-0 items-center gap-1.5 rounded-xl px-[15px] py-3 text-[15px] font-bold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          copied ? "bg-[#10B981]" : "bg-[#0A0A0A] hover:bg-[#171717]"
        }`}
      >
        {copied ? (
          <Check className="h-[17px] w-[17px]" strokeWidth={2.5} />
        ) : (
          <Copy className="h-[17px] w-[17px]" strokeWidth={2} />
        )}
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}

function StatusBadge({
  isActive,
  isExpiring,
  isUsed,
  isExpired,
  isCancelled,
}: {
  isActive: boolean;
  isExpiring: boolean;
  isUsed: boolean;
  isExpired: boolean;
  isCancelled: boolean;
}) {
  if (isActive) {
    // 사용 가능/곧 만료 모두 usable → 기존 초록 배지 재사용(색 추가 없음), 라벨만 분기.
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-[11px] py-[5px] text-[13px] font-bold text-[#10B981]">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        {isExpiring ? "곧 만료" : "사용 가능"}
      </span>
    );
  }
  if (isUsed) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-[11px] py-[5px] text-[13px] font-bold text-[#525252]">
        사용 완료
      </span>
    );
  }
  if (isExpired) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#F5F5F5] px-[11px] py-[5px] text-[13px] font-bold text-[#A3A3A3]">
        기간 만료
      </span>
    );
  }
  if (isCancelled) {
    return (
      <span className="inline-flex items-center rounded-full bg-[#FEF2F2] px-[11px] py-[5px] text-[13px] font-bold text-[#EF4444]">
        취소됨
      </span>
    );
  }
  return null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${m}.${day} ${h}:${min}`;
}
