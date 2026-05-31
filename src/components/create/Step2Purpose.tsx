import { useState } from "react";
import { BookOpen, Check, Gift, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig } from "@/components/cards/types";
import { StepBadge } from "@/components/create/StepBadge";
import type { WizardSuggestionConfidence } from "@/components/create/types";
import type { DropPurpose } from "@/lib/types";
import { cn } from "@/lib/utils";

// phase1 C: UX 레이어 노출 2 목적만 — 정보 + 혜택·예약(쿠폰 enum).
//   구매·상담·예약 enum 은 보존 (DropPurpose 5개 유지, AI 추천/홈 prefill 대비).
//   네이버 예약은 매장 reservation_url 로 수신자 카드(/d/) 에 자동 연결.
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
    label: "혜택·예약",
    description: "할인·쿠폰·기간 혜택, 매장 예약 자동 연결",
    icon: Gift,
    stripClass: "bg-intent-coupon-strip",
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
  isBusiness = false,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
  /** phase1 B: 비지니스 게이팅 — true 만 "쿠폰" 카드 노출. */
  isBusiness?: boolean;
}) {
  // phase1 B: 일반 = 정보만. 비지니스 = 정보 + 쿠폰.
  const visiblePurposes = isBusiness
    ? WIZARD_PURPOSES
    : WIZARD_PURPOSES.filter((p) => p.purpose === "정보");
  return (
    <div className="grid grid-cols-2 gap-3">
      {visiblePurposes.map((item) => {
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
              isSelected && "border-[#0A0A0A] bg-[#FAFAFA]/40 ring-1 ring-[#0A0A0A]/25",
            )}
          >
            {showSuggestedBadge && (
              <span
                className={cn(
                  "absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold tracking-ko",
                  suggestionConfidence === "high"
                    ? "bg-[#0A0A0A] text-white"
                    : "border border-[#0A0A0A] bg-white text-[#0A0A0A]",
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
  isBusiness = false,
}: {
  selected: DropPurpose | null;
  onSelect: (p: DropPurpose) => void;
  suggestedPurpose?: DropPurpose | null;
  suggestionConfidence?: WizardSuggestionConfidence | null;
  isPurposePrefilled: boolean;
  /** phase1 B: 비지니스 게이팅 — true 만 "쿠폰" 카드 노출. */
  isBusiness?: boolean;
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
        <StepBadge n={1} />
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
                <span className="font-semibold text-[#0A0A0A]">{selectedConfig.label}</span>
              </p>
              {purposeDiffers && (
                <p className="text-xs font-medium leading-relaxed tracking-ko text-text-subtle">
                  AI는 {suggestedConfig.label}을 추천했지만, 선택한 {selectedConfig.label} 기준으로
                  Drop을 만듭니다.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-[#0A0A0A] bg-[#FAFAFA]/40 p-4 ring-1 ring-[#0A0A0A]/25">
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface">
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 w-1", selectedConfig.stripClass)}
              />
              <SelectedIcon className="size-6 text-[#0A0A0A]" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold tracking-ko text-text-strong">
                {selectedConfig.label}
              </p>
              <p className="mt-1 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
                {selectedConfig.description}
              </p>
            </div>
            <Check className="size-6 shrink-0 text-[#0A0A0A]" strokeWidth={2} />
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
                isBusiness={isBusiness}
              />
            </div>
          )}
        </CardShell>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      <StepBadge n={1} />
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
            isBusiness={isBusiness}
          />
        </div>

        <p className="mt-6 text-xs font-medium leading-relaxed tracking-ko text-text-muted">
          선택한 목적에 따라 AI가 요약, 버튼, 공유 문구를 다르게 추천합니다.
        </p>
      </CardShell>
    </main>
  );
}
