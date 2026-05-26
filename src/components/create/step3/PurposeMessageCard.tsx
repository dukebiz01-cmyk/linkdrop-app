import { useState } from "react";
import { CardShell } from "@/components/cards/CardShell";
import type { CardConfig, CardStatus } from "@/components/cards/types";
import type { Step3FieldState } from "@/components/create-drop-wizard";

const PURPOSE_MESSAGE_PLACEHOLDER = "여기 분위기 좋아 보여서 공유해요.";

function PurposeMessageCard({
  fields,
  onFieldsChange,
}: {
  fields: Step3FieldState;
  onFieldsChange: (patch: Partial<Step3FieldState>) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const action = fields.shareMessageUserAction;

  const status: CardStatus =
    action === "removed"
      ? "hidden"
      : action === "accepted" || action === "edited"
        ? "completed"
        : "ai_suggested";

  const displayText = fields.shareMessage || PURPOSE_MESSAGE_PLACEHOLDER;

  const messageCardConfig: CardConfig = {
    id: "purpose_message",
    type: "message",
    required: false,
    enabled: true,
    position: 1,
    status,
    data: { message: displayText },
    ai_suggested: action === null,
    label: "친구에게 한마디",
    userAction: action,
    receiverVisible: status !== "hidden",
  };

  if (status === "hidden") {
    return (
      <CardShell config={messageCardConfig}>
        <p className="text-sm tracking-ko text-text-muted">
          한마디 없이 카드를 보냅니다. 받는 친구에게는 한마디가 보이지 않아요.
        </p>
        <button
          type="button"
          onClick={() => onFieldsChange({ shareMessage: "", shareMessageUserAction: null })}
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]"
        >
          다시 넣기
        </button>
      </CardShell>
    );
  }

  if (isEditing) {
    return (
      <CardShell config={messageCardConfig}>
        <textarea
          value={fields.shareMessage || PURPOSE_MESSAGE_PLACEHOLDER}
          onChange={(e) =>
            onFieldsChange({
              shareMessage: e.target.value.slice(0, 200),
              shareMessageUserAction: "edited",
            })
          }
          rows={3}
          autoFocus
          onBlur={() => setIsEditing(false)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-ko text-text-strong focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25"
        />
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[#2563EB]"
        >
          완료
        </button>
      </CardShell>
    );
  }

  return (
    <CardShell config={messageCardConfig}>
      <p className="text-sm tracking-ko text-text-strong">{displayText}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {status === "ai_suggested" && (
          <button
            type="button"
            onClick={() =>
              onFieldsChange({
                shareMessage: PURPOSE_MESSAGE_PLACEHOLDER,
                shareMessageUserAction: "accepted",
              })
            }
            className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8]"
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
        <button
          type="button"
          onClick={() => onFieldsChange({ shareMessage: "", shareMessageUserAction: "removed" })}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-slate-50"
        >
          한마디 빼기
        </button>
      </div>
    </CardShell>
  );
}

export { PurposeMessageCard, PURPOSE_MESSAGE_PLACEHOLDER };
