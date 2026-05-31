import type { ReactNode } from "react";
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
                  ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] ring-1 ring-[#2563EB]/25"
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
