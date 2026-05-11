import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { ActionButton } from "@/components/ActionButton";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export interface PartnerOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (partner: PartnerOption) => void;
}

export function PartnerPickerModal({ open, onClose, onSelect }: Props) {
  const navigate = useNavigate();
  const [partners, setPartners] = useState<PartnerOption[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!isSupabaseConfigured) {
      setPartners([]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const sb = getSupabase();
        const { data: sess } = await sb.auth.getSession();
        const uid = sess.session?.user.id;
        if (!uid) {
          setPartners([]);
          return;
        }
        const { data } = await sb
          .from("partners")
          .select("id, name, status, owner_id")
          .eq("owner_id", uid)
          .eq("status", "approved");
        setPartners(
          (data ?? []).map((p) => ({ id: p.id as string, name: p.name as string })),
        );
      } catch {
        setPartners([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] rounded-2xl bg-bg p-6 shadow-soft"
      >
        <h2 className="text-lg font-extrabold tracking-tighter text-text-strong">
          어느 매장으로 보낼까요?
        </h2>
        <p className="mt-1 text-sm font-medium text-text-muted">
          이 카드의 보상이 적립될 매장을 골라주세요
        </p>

        <div className="mt-6 space-y-2">
          {loading && (
            <p className="text-sm font-medium text-text-muted">불러오는 중…</p>
          )}
          {partners && partners.length === 0 && !loading && (
            <div className="rounded-lg border border-border p-6 text-center">
              <Store
                className="mx-auto size-8 text-text-subtle"
                strokeWidth={2}
              />
              <p className="mt-3 text-sm font-semibold text-text-strong">
                등록된 매장이 없어요
              </p>
              <p className="mt-1 text-xs font-medium text-text-muted">
                먼저 매장을 등록해 주세요
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/partner/register" })}
                className="mt-4 inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold text-text-strong transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                매장 등록하기
              </button>
            </div>
          )}
          {partners?.map((p) => {
            const isSelected = selectedId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                  isSelected
                    ? "border-text-strong"
                    : "border-border hover:border-text-muted",
                )}
              >
                <Store className="size-5 text-text-muted" strokeWidth={2} />
                <span className="flex-1 text-sm font-semibold text-text-strong">
                  {p.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-border text-sm font-semibold text-text-strong transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            취소
          </button>
          <ActionButton
            type="button"
            disabled={!selectedId}
            onClick={() => {
              const p = partners?.find((x) => x.id === selectedId);
              if (p) onSelect(p);
            }}
            className="flex-1"
          >
            선택
          </ActionButton>
        </div>
      </div>
    </div>
  );
}