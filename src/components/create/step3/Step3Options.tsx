import { useEffect, useState, type ReactNode } from "react";
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
  //   • 대신 읽기전용 안내 + 활성 매장 쿠폰 title 1개 표시 (있으면).
  //   • 받는 사람 화면 쿠폰은 get_drop_detail.coupon (partner_id 기준) 으로 자동 연결.
  if (purpose === "쿠폰") {
    return (
      <CouponPurposeOptions fields={fields} onFieldsChange={onFieldsChange} />
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
 * 쿠폰 목적 — 읽기전용 안내 + 활성 매장 쿠폰 title + 한마디.
 * 매장 쿠폰은 partners.coupons 테이블에서 직접 조회. partner_id + is_active + 미만료.
 * 매장 쿠폰이 없으면 안내만 표시. 위저드에서 별도 입력 게이트는 없다.
 */
function CouponPurposeOptions({
  fields,
  onFieldsChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  const [storeCouponTitle, setStoreCouponTitle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      if (!supabase) return;
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("owner_user_id", uid)
        .maybeSingle();
      if (!partner || cancelled) return;
      const { data: coupon } = await supabase
        .from("coupons")
        .select("title, valid_until")
        .eq("partner_id", partner.id)
        .eq("is_active", true)
        .order("valid_from", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !coupon) return;
      if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) return;
      setStoreCouponTitle(coupon.title);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
          혜택 쿠폰은 매장 쿠폰이 자동으로 붙어요
        </h1>
        <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
          위저드에서 따로 쿠폰을 만들 필요는 없어요. <b>내 매장 → 쿠폰</b> 에서 활성화한
          매장 쿠폰이 받는 사람 화면에 자동 연결됩니다.
        </p>

        {storeCouponTitle ? (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-semibold uppercase tracking-ko text-text-subtle">
              현재 자동 연결되는 쿠폰
            </p>
            <p className="mt-1 text-sm font-bold tracking-ko text-text-strong">
              {storeCouponTitle}
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-medium tracking-ko text-text-muted">
              아직 활성화된 매장 쿠폰이 없어요. 받는 사람 화면에 쿠폰을 보이려면 <b>내 매장 → 쿠폰</b> 에서 먼저 만들어 주세요.
            </p>
          </div>
        )}
      </CardShell>

      <div className="mt-4">
        <PurposeMessageCard fields={fields} onFieldsChange={onFieldsChange} />
      </div>
    </main>
  );
}
