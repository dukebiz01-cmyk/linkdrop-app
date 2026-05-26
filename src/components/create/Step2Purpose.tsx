import { useState } from "react";
import { BookOpen, Calendar, Check, Gift, Phone, ShoppingBag, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig } from "@/components/cards/types";
import { StepBadge } from "@/components/create/StepBadge";
import type { WizardSuggestionConfidence } from "@/components/create/types";
import type { DropPurpose } from "@/lib/types";
import { cn } from "@/lib/utils";

// WHY: UX 레이어는 5 목적만 노출. DB intent_types 9행은 Phase 1 UI에서 숨김 (v3 결정 락).
const WIZARD_PURPOSES: {
  purpose: DropPurpose;
  label: string;
  description: string;
  icon: LucideIcon;
  stripClass: string;
  aiRecommended?: boolean;
}[] = [
  {
    purpose: "정보",
    label: "정보",
    description: "영상 핵심 정리",
    icon: BookOpen,
    stripClass: "bg-intent-info-strip",
    aiRecommended: true,
  },
  {
    purpose: "쿠폰",
    label: "쿠폰",
    description: "혜택으로 손님 모으기",
    icon: Gift,
    stripClass: "bg-intent-coupon-strip",
  },
  {
    purpose: "예약",
    label: "예약",
    description: "날짜 선택과 예약 연결",
    icon: Calendar,
    stripClass: "bg-intent-reservation-strip",
  },
  {
    purpose: "구매",
    label: "구매",
    description: "AI 상품 찾기·가격비교",
    icon: ShoppingBag,
    stripClass: "bg-intent-commerce-strip",
  },
  {
    purpose: "상담",
    label: "상담",
    description: "문의·상담 받기",
    icon: Phone,
    stripClass: "bg-intent-lead-strip",
  },
];

const PURPOSE_CONFIRM_HEADLINE: Record<DropPurpose, string> = {
  정보: "정보 Drop으로 만들게요",
  쿠폰: "쿠폰 Drop으로 만들게요",
  예약: "예약 Drop으로 만들게요",
  구매: "구매 Drop으로 만들게요",
  상담: "상담 Drop으로 만들게요",
};

const PURPOSE_CONFIRM_DETAIL: Record<DropPurpose, string> = {
  정보: "선택한 목적에 따라 AI가 영상 핵심, 요약, 공유 문구를 추천합니다.",
  쿠폰: "선택한 목적에 따라 AI가 혜택, 쿠폰 버튼, 공유 문구를 추천합니다.",
  예약: "선택한 목적에 따라 AI가 예약 버튼, 날짜 선택, 공유 문구를 추천합니다.",
  구매: "선택한 목적에 따라 AI가 상품 후보, 가격 비교, 구매 버튼을 추천합니다.",
  상담: "선택한 목적에 따라 AI가 문의 폼, 상담 버튼, 공유 문구를 추천합니다.",
};

function findPurposeConfig(p: DropPurpose) {
  return WIZARD_PURPOSES.find((item) => item.purpose === p);
}

export function PurposePickerGrid({
  selected,
  onSelect,
  suggestedPurpose,
  suggestionConfidence,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {WIZARD_PURPOSES.map((item) => {
        const Icon = item.icon;
        const isSelected = selected === item.purpose;
        const showSuggestedBadge =
          suggestedPurpose === item.purpose &&
          suggestionConfidence &&
          (suggestionConfidence === "high" || suggestionConfidence === "medium");
        return (
          <button
            key={item.purpose}
            type="button"
            onClick={() => onSelect(item.purpose)}
            className={cn(
              "group relative flex min-h-[112px] flex-col items-start justify-between gap-2 overflow-hidden rounded-2xl border border-border p-4 text-left transition-all duration-150 ease-out",
              "hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
              isSelected && "border-[#2563EB] bg-[#EFF6FF]/40 ring-1 ring-[#2563EB]/25",
            )}
          >
            {showSuggestedBadge && (
              <span
                className={cn(
                  "absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold tracking-ko",
                  suggestionConfidence === "high"
                    ? "bg-[#2563EB] text-white"
                    : "border border-[#2563EB] bg-white text-[#2563EB]",
                )}
              >
                <Sparkles className="size-3" strokeWidth={2} />
                AI 추천
              </span>
            )}
            {!showSuggestedBadge && !suggestedPurpose && item.aiRecommended && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg bg-surface px-2 py-0.5 text-[10px] font-semibold tracking-ko text-accent">
                <Sparkles className="size-3" strokeWidth={2} />
                AI 추천
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-0 w-1 transition-opacity duration-150",
                item.stripClass,
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            />
            <Icon className="size-6 text-text-muted" strokeWidth={2} />
            <div>
              <span className="text-sm font-bold tracking-ko text-text-strong">{item.label}</span>
              <p className="mt-1 text-xs font-medium leading-snug tracking-ko text-text-muted">
                {item.description}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function Step2PurposeSelect({
  selected,
  onSelect,
  suggestedPurpose,
  suggestionConfidence,
  isPurposePrefilled,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
  isPurposePrefilled: boolean;
}) {
  const [showPurposePicker, setShowPurposePicker] = useState(!isPurposePrefilled);
  const selectedConfig = selected ? findPurposeConfig(selected) : null;
  const suggestedConfig = suggestedPurpose ? findPurposeConfig(suggestedPurpose) : null;
  const purposeDiffers = suggestedPurpose && selected && suggestedPurpose !== selected;

  // Card assembly — Step 2 purpose 카드. 시각만 통일, onSelect 로직은 그대로 사용.
  const purposeCardConfig: CardConfig = {
    id: "purpose",
    type: "purpose",
    required: true,
    enabled: true,
    position: 2,
    status: selected ? "completed" : "needs_confirmation",
    data: {},
    label: "목적",
  };

  if (isPurposePrefilled && selected && selectedConfig) {
    const SelectedIcon = selectedConfig.icon;
    return (
      <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
        <StepBadge n={2} />
        <CardShell config={purposeCardConfig}>
          <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-ko text-text-strong">
            선택한 목적을 확인해 주세요
          </h1>

          <p className="mt-4 text-lg font-bold tracking-ko text-text-strong">
            {PURPOSE_CONFIRM_HEADLINE[selected]}
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
            홈에서 선택한 목적입니다. 필요하면 아래에서 변경할 수 있어요.
          </p>
          <p className="mt-1 text-sm leading-relaxed tracking-ko text-text-subtle">
            {PURPOSE_CONFIRM_DETAIL[selected]}
          </p>

          {suggestedConfig && (
            <div className="mt-4 space-y-2 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-medium tracking-ko text-text-muted">
                AI 추천:{" "}
                <span className="font-semibold text-text-strong">{suggestedConfig.label}</span>
              </p>
              <p className="text-sm font-medium tracking-ko text-text-muted">
                내 선택:{" "}
                <span className="font-semibold text-[#2563EB]">{selectedConfig.label}</span>
              </p>
              {purposeDiffers && (
                <p className="text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
                  AI는 {suggestedConfig.label}을 추천했지만, 선택한 {selectedConfig.label} 기준으로
                  Drop을 만듭니다.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#2563EB] bg-[#EFF6FF]/40 p-4 ring-1 ring-[#2563EB]/25">
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 w-1", selectedConfig.stripClass)}
              />
              <SelectedIcon className="size-6 text-[#2563EB]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold tracking-ko text-text-strong">
                {selectedConfig.label}
              </p>
              <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
                {selectedConfig.description}
              </p>
            </div>
            <Check className="size-6 shrink-0 text-[#2563EB]" strokeWidth={2} />
          </div>

          <button
            type="button"
            onClick={() => setShowPurposePicker((v) => !v)}
            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-2xl border border-border bg-white text-sm font-semibold tracking-ko text-text-strong transition-colors hover:border-text-muted hover:bg-surface"
          >
            {showPurposePicker ? "목적 선택 닫기" : "목적 바꾸기"}
          </button>

          {showPurposePicker && (
            <div className="mt-4">
              <PurposePickerGrid
                selected={selected}
                onSelect={onSelect}
                suggestedPurpose={suggestedPurpose}
                suggestionConfidence={suggestionConfidence}
              />
            </div>
          )}
        </CardShell>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={2} />
      <CardShell config={purposeCardConfig}>
        <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-ko text-text-strong">
          이 Drop의 목적을 선택하세요
        </h1>

        <div className="mt-8">
          <PurposePickerGrid
            selected={selected}
            onSelect={onSelect}
            suggestedPurpose={suggestedPurpose}
            suggestionConfidence={suggestionConfidence}
          />
        </div>

        <p className="mt-6 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
          선택한 목적에 따라 AI가 요약, 버튼, 공유 문구를 다르게 추천합니다.
        </p>
      </CardShell>
    </main>
  );
}
