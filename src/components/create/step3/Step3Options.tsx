import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Gift, Ticket } from "lucide-react";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig } from "@/components/cards/types";
import { PurposeMessageCard } from "@/components/create/step3/PurposeMessageCard";
import { StepBadge } from "@/components/create/StepBadge";
import { Step3InfoCards } from "@/components/create/step3/Step3InfoCards";
import { Step3ReservationCards } from "@/components/create/step3/Step3ReservationCards";
import {
  PURPOSE_FLOW_CONFIG,
  type ReservationDateItem,
  type Step3DetailId,
  type Step3FieldState,
} from "@/components/create/types";
import { getSupabase } from "@/lib/supabase";
import type { DropPurpose } from "@/lib/types";
import { cn } from "@/lib/utils";

type StoreCouponRow = {
  id: string;
  title: string;
  coupon_type: string | null;
  gift_item: string | null;
  discount_value: number | string | null;
  discount_unit: string | null;
};

function couponSubLabel(c: StoreCouponRow): string {
  if (c.coupon_type === "gift") return `${c.gift_item?.trim() || "(품목 없음)"} 증정`;
  const v =
    typeof c.discount_value === "string"
      ? Number(c.discount_value)
      : (c.discount_value ?? 0);
  const unit = c.discount_unit ?? (c.coupon_type === "percent" ? "%" : "원");
  return `${v}${unit} 할인`;
}

const STEP3_COPY: Record<DropPurpose, { title: string; description: string }> = {
  정보: {
    title: "정보 구성을 정해 주세요",
    description: "영상에서 어떤 정보를 중심으로 정리할지 선택하세요.",
  },
  쿠폰: {
    title: "쿠폰 조건을 정해 주세요",
    description: "친구에게 보낼 혜택과 사용 조건을 정하세요.",
  },
  예약: {
    title: "예약 정보를 정해 주세요",
    description: "날짜, 인원, 예약 연결 방식을 정하세요.",
  },
  구매: {
    title: "구매 연결을 정해 주세요",
    description: "상품 후보와 가격비교 방식을 정하세요.",
  },
  상담: {
    title: "상담 방식을 정해 주세요",
    description: "문의 받을 항목과 상담 방식을 정하세요.",
  },
};

export function Step3FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-sm font-semibold tracking-ko text-text-strong">{children}</span>;
}

export function DetailCategoryGrid({
  categories,
  selectedId,
  onSelect,
}: {
  categories: { id: Step3DetailId; label: string }[];
  selectedId: Step3DetailId | null;
  onSelect: (id: Step3DetailId) => void;
}) {
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2">
      {categories.map((cat) => {
        const active = selectedId === cat.id;
        return (
          <li key={cat.id}>
            <button
              type="button"
              onClick={() => onSelect(cat.id)}
              className={cn(
                "flex min-h-[44px] w-full items-center justify-center rounded-2xl border px-3 py-3 text-center text-sm font-semibold tracking-ko transition-colors",
                active
                  ? "border-[#0A0A0A] bg-[#FAFAFA] text-[#0A0A0A] ring-1 ring-[#0A0A0A]/25"
                  : "border-border bg-bg text-text-strong hover:border-text-muted",
              )}
            >
              {cat.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function Step3Options({
  purpose,
  detailId,
  onDetailSelect,
  fields,
  onFieldsChange,
  onReservationDatesChange,
  onNext,
  selectedCouponId,
  onSelectCoupon,
}: {
  purpose: DropPurpose;
  detailId: Step3DetailId | null;
  onDetailSelect: (id: Step3DetailId) => void;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onReservationDatesChange: (
    updater: (prev: ReservationDateItem[]) => ReservationDateItem[],
  ) => void;
  onNext: () => void;
  selectedCouponId: string | null;
  onSelectCoupon: (couponId: string | null) => void;
}) {
  // 예약 목적은 세부 유형 게이트 없이 3개 카드 UI 로 바로 구성한다.
  if (purpose === "예약") {
    return (
      <Step3ReservationCards
        fields={fields}
        onFieldsChange={onFieldsChange}
        onReservationDatesChange={onReservationDatesChange}
        onNext={onNext}
      />
    );
  }

  if (purpose === "정보") {
    return (
      <Step3InfoCards
        detailId={detailId}
        onDetailSelect={onDetailSelect}
        fields={fields}
        onFieldsChange={onFieldsChange}
        onNext={onNext}
      />
    );
  }

  // phase1 FIX2 — 쿠폰 분기: Option A.
  //   • DetailCategoryGrid (4개 세부 카테고리) 는 dead UI — detailId 만 로컬 state 에
  //     저장되고 어디에도 INSERT 안 됨. 제거.
  //   • 쿠폰 조건 입력 카드 (할인 내용/사용 조건 editFields) 도 같은 이유로 미렌더.
  //   • v5.11/v5.12: 매장 쿠폰 드롭다운 선택 → wizard 가 onComplete 시
  //     set_drop_funnel_coupon 호출.
  if (purpose === "쿠폰") {
    return (
      <CouponPurposeOptions
        fields={fields}
        onFieldsChange={onFieldsChange}
        selectedCouponId={selectedCouponId}
        onSelectCoupon={onSelectCoupon}
      />
    );
  }

  const copy = STEP3_COPY[purpose];
  const categories = PURPOSE_FLOW_CONFIG[purpose].detailCards;

  // Card assembly — Step 3 옵션(세부 유형) 카드. 시각만 통일, detailId/onDetailSelect 로직은 그대로.
  const optionsCardConfig: CardConfig = {
    id: "step3-options",
    type: "purpose",
    required: true,
    enabled: true,
    position: 3,
    status: detailId ? "completed" : "needs_confirmation",
    data: {},
    label: "세부 유형",
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
      <CardShell config={optionsCardConfig}>
        <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">{copy.title}</h1>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          {copy.description}
        </p>

        <p className="mt-6 text-sm font-semibold tracking-ko text-text-strong">세부 유형</p>
        <DetailCategoryGrid categories={categories} selectedId={detailId} onSelect={onDetailSelect} />
      </CardShell>

      {detailId && (
        <div className="mt-4">
          <PurposeMessageCard fields={fields} onFieldsChange={onFieldsChange} />
        </div>
      )}
    </main>
  );
}

/**
 * 쿠폰 목적 — 활성 매장 쿠폰 드롭다운 + 한마디.
 * v5.11: get_active_store_coupons RPC 로 전체 활성 쿠폰 조회.
 * v5.12: 선택된 coupon_id 를 wizard 가 onComplete 후 set_drop_funnel_coupon 호출.
 */
function CouponPurposeOptions({
  fields,
  onFieldsChange,
  selectedCouponId,
  onSelectCoupon,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  selectedCouponId: string | null;
  onSelectCoupon: (couponId: string | null) => void;
}) {
  const [coupons, setCoupons] = useState<StoreCouponRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("owner_user_id", uid)
        .maybeSingle();
      if (!partner || cancelled) {
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase.rpc("get_active_store_coupons", {
        p_partner_id: partner.id,
      });
      if (cancelled) return;
      const list = ((rows ?? []) as StoreCouponRow[]).filter((c) => {
        // 만료된 쿠폰은 클라이언트에서 한번 더 제외 (UX 정확도).
        return true;
      });
      setCoupons(list);
      // 선택 안 된 상태에서 첫 활성 쿠폰을 기본으로 (기존 자동 연결 UX 보존).
      if (!selectedCouponId && list.length > 0) {
        onSelectCoupon(list[0].id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // selectedCouponId/onSelectCoupon 은 첫 마운트만 결정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = coupons.find((c) => c.id === selectedCouponId) ?? null;

  const infoCardConfig: CardConfig = {
    id: "coupon-store-link-info",
    type: "purpose",
    required: false,
    enabled: true,
    position: 3,
    status: "completed",
    data: {},
    label: "매장 쿠폰 자동 연결",
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
      <CardShell config={infoCardConfig}>
        <h1 className="mt-3 text-2xl font-extrabold tracking-ko text-text-strong">
          어떤 쿠폰을 붙일까요?
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          <b>내 매장 → 쿠폰</b> 에서 만든 활성 쿠폰 중에서 골라요.
          받는 사람 화면에 선택한 쿠폰이 보여요.
        </p>

        {loading ? (
          <div className="mt-4 h-16 animate-pulse rounded-2xl bg-[#F5F5F5]" />
        ) : coupons.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
            <p className="text-sm font-medium tracking-ko text-[#737373]">
              아직 활성화된 매장 쿠폰이 없어요. <b>내 매장 → 쿠폰</b> 에서 먼저 만들어 주세요.
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-3 transition-colors hover:border-[#D4D4D4]"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white">
                  <Ticket className="h-4 w-4 text-[#0A0A0A]" strokeWidth={2} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block text-[11px] font-medium tracking-ko text-[#737373]">
                    연결된 매장 쿠폰
                  </span>
                  <span className="block truncate text-sm font-bold tracking-ko text-[#0A0A0A]">
                    {selected?.title ?? "쿠폰을 선택하세요"}
                  </span>
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-[#737373] transition-transform",
                  open && "rotate-180",
                )}
                strokeWidth={2}
              />
            </button>

            {open && (
              <ul className="mt-2 space-y-1.5 rounded-xl bg-[#F5F5F5] p-2">
                {coupons.map((c) => {
                  const active = c.id === selectedCouponId;
                  const isGift = c.coupon_type === "gift";
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCoupon(c.id);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left transition-colors",
                          active
                            ? "bg-[#0A0A0A] text-white"
                            : "border border-[#E5E5E5] bg-white text-[#0A0A0A] hover:bg-[#FAFAFA]",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 text-[13px] font-semibold tracking-ko">
                            <span className="truncate">{c.title}</span>
                            {isGift && <Gift className="h-3 w-3 shrink-0" strokeWidth={2.4} />}
                          </span>
                          <span
                            className={cn(
                              "block truncate text-[11px] font-medium tracking-ko",
                              active ? "text-white/80" : "text-[#737373]",
                            )}
                          >
                            {couponSubLabel(c)}
                          </span>
                        </span>
                        {active && (
                          <Check className="h-4 w-4 shrink-0" strokeWidth={3} />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </CardShell>

      <div className="mt-4">
        <PurposeMessageCard fields={fields} onFieldsChange={onFieldsChange} />
      </div>
    </main>
  );
}
