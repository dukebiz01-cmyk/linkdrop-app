import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  ABUSE_REASONS,
  type AbuseReportReason,
} from "@/lib/helpers/abuse-report";
import { cn } from "@/lib/utils";

interface AbuseReportSheetProps {
  isOpen: boolean;
  onClose: () => void;
  dropId: string;
}

type SubmitState =
  | "idle"
  | "submitting"
  | "success"
  | "error_duplicate"
  | "error_unknown";

export function AbuseReportSheet({ isOpen, onClose, dropId }: AbuseReportSheetProps) {
  const [selected, setSelected] = useState<AbuseReportReason | null>(null);
  const [description, setDescription] = useState("");
  const [state, setState] = useState<SubmitState>("idle");

  // 시트 닫힐 때 상태 리셋
  useEffect(() => {
    if (!isOpen) {
      setSelected(null);
      setDescription("");
      setState("idle");
    }
  }, [isOpen]);

  // 성공 1.5s 후 자동 닫기 (Toaster 미마운트 환경 대응)
  useEffect(() => {
    if (state !== "success") return;
    const timer = setTimeout(() => onClose(), 1500);
    return () => clearTimeout(timer);
  }, [state, onClose]);

  async function handleSubmit() {
    if (!selected || state === "submitting") return;
    setState("submitting");
    try {
      const res = await fetch("/api/abuse-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          drop_id: dropId,
          reason: selected,
          description: description.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        setState("success");
      } else if (data.error === "duplicate") {
        setState("error_duplicate");
      } else {
        setState("error_unknown");
      }
    } catch {
      setState("error_unknown");
    }
  }

  function handleClose() {
    if (state === "submitting") return;
    onClose();
  }

  const submitDisabled = !selected || state === "submitting" || state === "success";

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8">
        <div className="flex flex-col gap-4 pt-6">
          <div>
            <h2 className="text-lg font-bold tracking-ko text-text-strong">
              이 카드의 문제를 알려주세요
            </h2>
            <p className="mt-1 text-sm tracking-ko text-text-muted">
              신고 사유를 선택해 주세요
            </p>
          </div>

          {state === "success" ? (
            <div className="flex flex-col items-center gap-2 py-8">
              <Check
                size={32}
                strokeWidth={2.5}
                className="text-[#16A34A]"
                aria-hidden
              />
              <p className="text-sm font-bold tracking-ko text-text-strong">
                신고가 접수됐어요
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                {ABUSE_REASONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                      selected === opt.value
                        ? "border-[#2563EB] bg-[#EFF6FF]"
                        : "border-[#E5E5E5] bg-white hover:border-text-muted",
                    )}
                  >
                    <input
                      type="radio"
                      name="abuse-reason"
                      value={opt.value}
                      checked={selected === opt.value}
                      onChange={() => setSelected(opt.value)}
                      className="mt-0.5 size-4 shrink-0 accent-[#2563EB]"
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold tracking-ko text-text-strong">
                        {opt.label}
                      </span>
                      <span className="text-xs tracking-ko text-text-muted">
                        {opt.description}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                placeholder="추가 설명 (선택)"
                rows={3}
                maxLength={500}
                className="w-full rounded-lg border border-[#E5E5E5] px-3 py-2 text-sm tracking-ko text-text-strong focus:border-[#2563EB] focus:outline-none focus:ring-1 focus:ring-[#2563EB]/25"
              />

              {state === "error_duplicate" && (
                <p className="flex items-center gap-2 text-sm font-medium tracking-ko text-[#991B1B]">
                  <AlertCircle size={14} strokeWidth={2} aria-hidden />
                  이미 신고하셨어요. 24시간 후 다시 가능해요
                </p>
              )}
              {state === "error_unknown" && (
                <p className="flex items-center gap-2 text-sm font-medium tracking-ko text-[#991B1B]">
                  <AlertCircle size={14} strokeWidth={2} aria-hidden />
                  잠시 후 다시 시도해 주세요
                </p>
              )}

              <p className="text-xs tracking-ko text-text-subtle">
                신고는 운영진이 확인 후 처리합니다
              </p>

              <button
                type="button"
                disabled={submitDisabled}
                onClick={handleSubmit}
                className="w-full min-h-[44px] rounded-2xl bg-[#2563EB] py-4 font-bold text-white disabled:bg-[#A3A3A3] disabled:cursor-not-allowed"
              >
                {state === "submitting" ? "제출 중..." : "신고하기"}
              </button>
              <button
                type="button"
                disabled={state === "submitting"}
                onClick={handleClose}
                className="min-h-[44px] text-sm tracking-ko text-[#A3A3A3]"
              >
                취소
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
