import { useState } from "react";
import { ChevronRight, Eye } from "lucide-react";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig, CardStatus } from "@/components/cards/types";
import type { Step3FieldState } from "@/components/create-drop-wizard";
import { PurposeMessageCard } from "@/components/create/step3/PurposeMessageCard";

// 정적 placeholder (청크 3-D 에서 AI 호출 결과로 교체)
const INFO_HEADLINE_PLACEHOLDER = "이 영상 핵심 내용을 한 줄로 정리합니다.";

// PURPOSE_FLOW_CONFIG["정보"].detailCards 의 id → label 매핑
const INFO_DETAIL_LABELS: Record<string, string> = {
  summary: "영상 핵심 요약",
  place: "장소/매장 소개",
  review: "후기 정리",
  checklist: "체크리스트",
};

// ─────────── ① InfoPreviewCard (wrap X — 자체 border 미리보기) ───────────
function InfoPreviewCard({
  fields,
  detailId,
}: {
  fields: Step3FieldState;
  detailId: string | null;
}) {
  const headline = fields.infoHeadline.trim() || INFO_HEADLINE_PLACEHOLDER;
  const categoryLabel = detailId ? (INFO_DETAIL_LABELS[detailId] ?? detailId) : "정보";
  const message =
    fields.shareMessage && fields.shareMessageUserAction !== "removed" ? fields.shareMessage : "";

  return (
    <div className="overflow-hidden rounded-2xl border border-[#0A0A0A] bg-[#FAFAFA]/40 p-4 ring-1 ring-[#0A0A0A]/25">
      <span className="inline-flex items-center gap-1 rounded-lg bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-semibold tracking-ko text-white">
        <Eye className="size-3" strokeWidth={2} />
        영상 정보 안내
      </span>
      <p className="mt-3 text-sm font-semibold tracking-ko text-text-muted">{categoryLabel}</p>
      <p className="mt-1 text-lg font-extrabold leading-snug tracking-ko text-text-strong">
        {headline}
      </p>
      {message && <p className="mt-2 text-sm tracking-ko text-text-muted">— {message}</p>}
    </div>
  );
}

// ─────────── ② InfoHeadlineCard (필수, 2액션 — 한마디 빼기 X) ───────────
function InfoHeadlineCard({
  fields,
  onFieldsChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const action = fields.infoHeadlineUserAction;
  const status: CardStatus =
    action === "accepted" || action === "edited" ? "completed" : "ai_suggested";
  const displayText = fields.infoHeadline.trim() || INFO_HEADLINE_PLACEHOLDER;

  const config: CardConfig = {
    id: "info_headline",
    type: "message",
    required: true,
    enabled: true,
    position: 2,
    status,
    data: { headline: displayText },
    ai_suggested: action === null,
    label: "정보 제목",
    userAction: action,
    receiverVisible: true,
  };

  if (isEditing) {
    return (
      <CardShell config={config}>
        <textarea
          value={fields.infoHeadline || INFO_HEADLINE_PLACEHOLDER}
          onChange={(e) =>
            onFieldsChange({
              infoHeadline: e.target.value.slice(0, 80),
              infoHeadlineUserAction: "edited",
            })
          }
          rows={2}
          autoFocus
          onBlur={() => setIsEditing(false)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-ko text-text-strong focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/25"
        />
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#0A0A0A]"
        >
          완료
        </button>
      </CardShell>
    );
  }

  return (
    <CardShell config={config}>
      <p className="text-base font-semibold tracking-ko text-text-strong">{displayText}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status === "ai_suggested" && (
          <button
            type="button"
            onClick={() =>
              onFieldsChange({
                infoHeadline: INFO_HEADLINE_PLACEHOLDER,
                infoHeadlineUserAction: "accepted",
              })
            }
            className="rounded-lg bg-[#0A0A0A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#171717]"
          >
            그대로 사용
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-text-strong hover:bg-slate-50"
        >
          수정
        </button>
      </div>
    </CardShell>
  );
}

// ─────────── ③ InfoDetailCategoryCard ([유형 바꾸기] placeholder, 3-B에서 sheet 연결) ───────────
function InfoDetailCategoryCard({
  detailId,
  onOpenChangeSheet,
}: {
  detailId: string | null;
  onOpenChangeSheet: () => void;
}) {
  const label = detailId ? (INFO_DETAIL_LABELS[detailId] ?? detailId) : "선택 필요";
  const status: CardStatus = detailId ? "completed" : "needs_confirmation";

  const config: CardConfig = {
    id: "info_detail_category",
    type: "purpose",
    required: false,
    enabled: true,
    position: 3,
    status,
    data: { categoryId: detailId },
    label: "정보 유형",
    receiverVisible: true,
  };

  return (
    <CardShell config={config}>
      <p className="text-sm tracking-ko text-text-strong">{label}</p>
      <button
        type="button"
        onClick={onOpenChangeSheet}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#0A0A0A]"
      >
        유형 바꾸기 <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </CardShell>
  );
}

// ─────────── ⑤ InfoAdvancedCard (고급, hidden by default) ───────────
function InfoAdvancedCard({
  fields,
  onFieldsChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasData =
    fields.infoKeyPoints.length > 0 ||
    fields.infoChecklist.length > 0 ||
    fields.infoQuote.trim().length > 0;
  const status: CardStatus = hasData ? "completed" : "ai_suggested";

  const config: CardConfig = {
    id: "info_advanced",
    type: "hours",
    required: false,
    enabled: true,
    position: 5,
    status,
    data: { open },
    ai_suggested: !hasData,
    label: "고급 설정",
    userAction: hasData ? "edited" : null,
    receiverVisible: true,
  };

  return (
    <CardShell config={config}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#0A0A0A]"
        >
          고급 설정 추가 <ChevronRight className="size-4" strokeWidth={2} />
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium tracking-ko text-text-muted">
              키포인트 (줄바꿈으로 구분)
            </label>
            <textarea
              value={fields.infoKeyPoints.join("\n")}
              onChange={(e) =>
                onFieldsChange({
                  infoKeyPoints: e.target.value.split("\n").filter(Boolean),
                })
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-ko text-text-strong focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/25"
            />
          </div>
          <div>
            <label className="text-xs font-medium tracking-ko text-text-muted">
              체크리스트 (줄바꿈으로 구분)
            </label>
            <textarea
              value={fields.infoChecklist.join("\n")}
              onChange={(e) =>
                onFieldsChange({
                  infoChecklist: e.target.value.split("\n").filter(Boolean),
                })
              }
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-ko text-text-strong focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/25"
            />
          </div>
          <div>
            <label className="text-xs font-medium tracking-ko text-text-muted">인용</label>
            <textarea
              value={fields.infoQuote}
              onChange={(e) => onFieldsChange({ infoQuote: e.target.value.slice(0, 200) })}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-ko text-text-strong focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/25"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-medium text-text-muted"
          >
            닫기
          </button>
        </div>
      )}
    </CardShell>
  );
}

// ─────────── 메인 Step3InfoCards ───────────
export interface Step3InfoCardsProps {
  detailId: string | null;
  onDetailSelect: (id: string) => void;
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
  onNext: () => void;
}

export function Step3InfoCards({
  detailId,
  onDetailSelect,
  fields,
  onFieldsChange,
  onNext: _onNext,
}: Step3InfoCardsProps) {
  const [showCategoryGrid, setShowCategoryGrid] = useState(false);
  const handleOpenChangeSheet = () => {
    setShowCategoryGrid((s) => !s);
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-32 pt-2">
      {/* StepBadge 는 dispatcher(Step3Options) 가 처리. 여기는 카드만. */}
      <div className="mt-4 space-y-4">
        <InfoPreviewCard fields={fields} detailId={detailId} />
        <InfoHeadlineCard fields={fields} onFieldsChange={onFieldsChange} />
        <InfoDetailCategoryCard detailId={detailId} onOpenChangeSheet={handleOpenChangeSheet} />
        {showCategoryGrid && (
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E5E5E5] p-3">
            {Object.entries(INFO_DETAIL_LABELS).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  onDetailSelect(id);
                  setShowCategoryGrid(false);
                }}
                className={`rounded-lg border px-3 py-2 text-sm tracking-ko text-left
                  ${
                    detailId === id
                      ? "border-[#0A0A0A] bg-[#FAFAFA] text-[#0A0A0A]"
                      : "border-[#E5E5E5] bg-white text-text-strong"
                  }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <PurposeMessageCard fields={fields} onFieldsChange={onFieldsChange} />
        <InfoAdvancedCard fields={fields} onFieldsChange={onFieldsChange} />
      </div>
    </main>
  );
}
