import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft, Ticket, CheckCircle2, Sparkles } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";
import { EmptyState } from "@/components/EmptyState";

type CouponConditions = { min_amount?: number } | null;

type CouponRow = {
  id: string;
  title: string;
  coupon_type: string;
  discount_value: number | string | null;
  discount_unit: string | null;
  conditions: CouponConditions;
  valid_until: string | null;
  total_count: number | null;
  is_active: boolean | null;
  created_at: string | null;
};

type LoaderData = {
  partnerId: string | null;
  partnerName: string | null;
  coupons: CouponRow[];
};

export const Route = createFileRoute("/_partner/partner/coupons")({
  head: () => ({ meta: [{ title: "쿠폰 관리 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { partnerId: null, partnerName: null, coupons: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id;
    if (!ownerUserId) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();

    if (!partner?.id) return empty;

    const { data: coupons } = await supabase
      .from("coupons")
      .select(
        "id, title, coupon_type, discount_value, discount_unit, conditions, valid_until, total_count, is_active, created_at",
      )
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false });

    return {
      partnerId: partner.id,
      partnerName: partner.display_name ?? null,
      coupons: (coupons as CouponRow[] | null) ?? [],
    };
  },
  component: CouponsPage,
});

function CouponsPage() {
  const data = Route.useLoaderData();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [couponType, setCouponType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [noExpiry, setNoExpiry] = useState(true);
  const [validUntil, setValidUntil] = useState("");
  const [totalCount, setTotalCount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const partnerId = data.partnerId;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!partnerId) {
      toast.error("매장 정보를 찾을 수 없어요.");
      return;
    }
    const titleTrim = title.trim();
    if (!titleTrim) {
      toast.error("쿠폰 이름을 입력해 주세요.");
      return;
    }
    const dv = Number(discountValue);
    if (!Number.isFinite(dv) || dv <= 0) {
      toast.error("할인 값을 올바르게 입력해 주세요.");
      return;
    }
    if (couponType === "percent" && dv > 100) {
      toast.error("퍼센트 할인은 100 이하여야 해요.");
      return;
    }
    if (!noExpiry && !validUntil) {
      toast.error("사용 기한 날짜를 선택해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const minNum = minAmount ? Number(minAmount) : NaN;
      const countNum = totalCount ? Number(totalCount) : NaN;
      const payload: Record<string, unknown> = {
        partner_id: partnerId,
        title: titleTrim,
        coupon_type: couponType,
        discount_value: dv,
        discount_unit: couponType === "percent" ? "%" : "원",
        conditions:
          Number.isFinite(minNum) && minNum > 0 ? { min_amount: minNum } : {},
        valid_from: new Date().toISOString(),
        valid_until: noExpiry ? null : new Date(validUntil).toISOString(),
        is_active: true,
      };
      if (Number.isFinite(countNum) && countNum > 0) {
        payload.total_count = countNum;
      }

      const { error } = await getSupabase().from("coupons").insert(payload);
      if (error) {
        console.error("[partner.coupons] insert failed:", error);
        toast.error("쿠폰을 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("쿠폰을 만들었어요.");
      setTitle("");
      setDiscountValue("");
      setMinAmount("");
      setTotalCount("");
      setNoExpiry(true);
      setValidUntil("");
      await router.invalidate();
    } catch (err) {
      console.error("[partner.coupons] unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          매장 홈
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">쿠폰 관리</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">
          손님에게 줄 할인·혜택 쿠폰을 만들어요
        </p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* 만들기 폼 */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-[#EFF6FF]">
              <Sparkles className="size-4 text-[#2563EB]" strokeWidth={2} />
            </span>
            <h2 className="text-sm font-bold text-[#0F172A]">새 쿠폰 만들기</h2>
          </div>

          {/* 쿠폰 이름 */}
          <div className="space-y-2">
            <label
              htmlFor="cp-title"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              쿠폰 이름
            </label>
            <input
              id="cp-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 첫 방문 환영 10% 할인"
              maxLength={80}
              className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
              required
            />
          </div>

          {/* 할인 종류 */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-[#0F172A]">
              할인 종류
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCouponType("percent")}
                className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold ${
                  couponType === "percent"
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                퍼센트 (%)
              </button>
              <button
                type="button"
                onClick={() => setCouponType("amount")}
                className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold ${
                  couponType === "amount"
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                금액 (원)
              </button>
            </div>
          </div>

          {/* 할인 값 */}
          <div className="space-y-2">
            <label
              htmlFor="cp-value"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              할인 값
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cp-value"
                type="number"
                inputMode="numeric"
                min={1}
                max={couponType === "percent" ? 100 : undefined}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={couponType === "percent" ? "10" : "3000"}
                className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
                required
              />
              <span className="text-sm font-semibold text-[#64748B]">
                {couponType === "percent" ? "%" : "원"}
              </span>
            </div>
          </div>

          {/* 최소 사용 금액 */}
          <div className="space-y-2">
            <label
              htmlFor="cp-min"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              최소 사용 금액{" "}
              <span className="font-medium text-[#94A3B8]">(선택)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cp-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="예: 30000"
                className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
              />
              <span className="text-sm font-semibold text-[#64748B]">원</span>
            </div>
            <p className="text-[11px] text-[#94A3B8]">
              이 금액 이상 결제할 때만 쿠폰을 쓸 수 있어요
            </p>
          </div>

          {/* 사용 기한 */}
          <div className="space-y-2">
            <span className="block text-xs font-semibold text-[#0F172A]">
              사용 기한
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNoExpiry(true)}
                className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold ${
                  noExpiry
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                무기한
              </button>
              <button
                type="button"
                onClick={() => setNoExpiry(false)}
                className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold ${
                  !noExpiry
                    ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                    : "border-[#E5E7EB] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                }`}
              >
                날짜 지정
              </button>
            </div>
            {!noExpiry ? (
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                required
              />
            ) : null}
          </div>

          {/* 발행 수량 */}
          <div className="space-y-2">
            <label
              htmlFor="cp-count"
              className="block text-xs font-semibold text-[#0F172A]"
            >
              발행 수량{" "}
              <span className="font-medium text-[#94A3B8]">
                (선택, 비우면 무제한)
              </span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="cp-count"
                type="number"
                inputMode="numeric"
                min={1}
                value={totalCount}
                onChange={(e) => setTotalCount(e.target.value)}
                placeholder="예: 100"
                className="flex-1 min-h-[44px] rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:outline-none"
              />
              <span className="text-sm font-semibold text-[#64748B]">장</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !partnerId}
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white shadow-[0_2px_8px_rgba(37,99,235,0.25)] disabled:opacity-50"
          >
            <Ticket className="size-4" strokeWidth={2} />
            {submitting ? "만드는 중…" : "쿠폰 만들기"}
          </button>

          {!partnerId ? (
            <p className="text-[11px] text-[#EF4444]">
              매장 정보를 불러오지 못했어요. 새로고침해 주세요.
            </p>
          ) : null}
        </form>

        {/* 발급한 쿠폰 */}
        <section>
          <h2 className="mb-2 px-1 text-sm font-semibold text-[#0A0A0A]">
            발행한 쿠폰 ({data.coupons.length})
          </h2>
          {data.coupons.length === 0 ? (
            <EmptyState
              title="발행한 쿠폰이 없어요"
              description="위에서 첫 쿠폰을 만들어 보세요."
            />
          ) : (
            <ul className="space-y-3">
              {data.coupons.map((c) => (
                <li
                  key={c.id}
                  className="rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                >
                  <CouponItem row={c} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}

function CouponItem({ row }: { row: CouponRow }) {
  const minAmount = row.conditions?.min_amount;
  const dv =
    typeof row.discount_value === "string"
      ? Number(row.discount_value)
      : (row.discount_value ?? 0);
  const unit =
    row.discount_unit ?? (row.coupon_type === "percent" ? "%" : "원");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#0F172A] line-clamp-1">
          {row.title}
        </p>
        {row.is_active ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#059669]">
            <CheckCircle2 className="size-3" strokeWidth={2} />
            활성
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[11px] font-semibold text-[#64748B]">
            비활성
          </span>
        )}
      </div>
      <p className="text-sm text-[#475569]">
        {dv}
        {unit} 할인
        {minAmount
          ? ` · ${Number(minAmount).toLocaleString()}원 이상 결제 시`
          : ""}
      </p>
      <p className="text-xs text-[#64748B]">
        {row.valid_until ? `${formatDate(row.valid_until)} 까지` : "기한 없음"}
        {row.total_count ? ` · ${row.total_count}장 한정` : ""}
      </p>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}
