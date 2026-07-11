import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BellRing, Loader2, PackageCheck, PackageX, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  cancelRestockAlert,
  enrichRestockAlert,
  listMyRestockAlerts,
  type RestockAlertItem,
} from "@/lib/restock-alerts";

export const Route = createFileRoute("/_user/inbox")({
  head: () => ({ meta: [{ title: "받은함" }] }),
  component: InboxPage,
});

// FIX-41 — 재입고 알림 v1: waiting 알림을 드롭 정보와 결합해 표시. 재입고 여부는 읽기 시점
//   클라 판정(get_drop_detail remaining_stock 파생)만 — notified_at 갱신 시도 금지(UPDATE
//   정책 없음이 의도: notified 전환은 service_role 전용).
// TODO(v2): notified 전환 + 서버 발신(푸시/Edge) — v1 구현 금지(FIX-41 락).
function InboxPage() {
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [items, setItems] = useState<RestockAlertItem[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listMyRestockAlerts();
        const enriched = await Promise.all(rows.map(enrichRestockAlert));
        if (!cancelled) setItems(enriched);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCancel(item: RestockAlertItem) {
    if (cancellingId) return;
    setCancellingId(item.id);
    const ok = await cancelRestockAlert(item.drop_id);
    setCancellingId(null);
    if (ok) {
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      toast.success("재입고 알림을 취소했어요.");
    } else {
      toast.error("취소하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }

  return (
    <main className="px-6 py-8">
      <h1 className="text-2xl font-extrabold text-text-strong">받은함</h1>

      {/* 재입고 알림 — 신청분이 있을 때만 섹션 렌더(없으면 아래 기존 EmptyState 그대로). */}
      {loading ? (
        <p className="mt-8 flex items-center gap-2 text-sm font-medium text-text-muted">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          알림을 불러오는 중…
        </p>
      ) : items.length > 0 ? (
        <section className="mt-8 space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-ko text-text-strong">
            <BellRing className="size-4" strokeWidth={2} />
            재입고 알림
          </h2>
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-white p-3"
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface text-text-subtle">
                    <BellRing className="size-5" strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-ko text-text-strong">
                    {item.title ?? "카드 정보를 불러올 수 없어요"}
                  </p>
                  {/* 재입고 판정 3분기 — 읽기 시점 사실만(추정·재촉 카피 0). */}
                  {item.restocked === true ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-bold text-accent">
                      <PackageCheck className="size-3.5" strokeWidth={2.25} />
                      재입고됐어요
                    </p>
                  ) : item.restocked === false ? (
                    <p className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-text-muted">
                      <PackageX className="size-3.5" strokeWidth={2} />
                      아직 품절이에요
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12px] font-medium text-text-subtle">
                      재고 상태를 알 수 없어요
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void handleCancel(item)}
                  disabled={cancellingId === item.id}
                  aria-label="재입고 알림 취소"
                  className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-text-subtle transition-colors hover:bg-surface disabled:opacity-50"
                >
                  {cancellingId === item.id ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  ) : (
                    <X className="size-4" strokeWidth={2.25} />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-8">
          <EmptyState title="새 알림이 없어요" description="새로운 리워드가 도착하면 표시됩니다." />
        </section>
      )}
    </main>
  );
}
