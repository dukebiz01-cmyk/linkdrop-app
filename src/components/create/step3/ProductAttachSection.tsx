import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Check, X, Package, Loader2, Image as ImageIcon } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { StepBadge } from "@/components/create/StepBadge";
import type { AttachedProduct } from "@/components/create/types";

// ③ 카드 담기 — 자체업로드 상품을 카드로 담는 섹션. (작업용 카피, 추후 카피 패스)
//   목록 = get_my_products() RPC(인증 세션 — 클라이언트 전용). 활성 상품만 추가 가능.
//   상태는 위저드 소유 → value/onChange props.

// get_my_products() 반환 행. (v7.7 — headline/selling_points 추가)
type ProductRow = {
  drop_id: string;
  share_code: string | null;
  share_uuid: string | null;
  name: string | null;
  price_krw: number | null;
  image_url: string | null;
  is_active: boolean | null;
  headline: string | null;
  selling_points: string[] | null;
};

function priceLabel(krw: number | null): string {
  return krw != null ? `${Number(krw).toLocaleString("ko-KR")}원` : "가격 미정";
}

// jsonb selling_points → 깔끔한 string[]. (RPC 가 jsonb 배열/널 반환)
function toPoints(v: unknown): string[] {
  return Array.isArray(v)
    ? v
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .map((s) => s.trim())
    : [];
}

export function ProductAttachSection({
  value,
  onChange,
}: {
  value: AttachedProduct[];
  onChange: (next: AttachedProduct[]) => void;
}) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const supabase = getSupabase();
        // 인증 세션 확인(SSR/anon 금지) — get_my_products 는 auth.uid() 필수.
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session?.user.id) {
          if (!cancelled) setError(true);
          return;
        }
        const { data, error: rpcErr } = await supabase.rpc("get_my_products");
        if (cancelled) return;
        if (rpcErr) {
          console.error("[ProductAttachSection] get_my_products failed:", rpcErr);
          setError(true);
          return;
        }
        setRows(((data ?? []) as ProductRow[]).filter((r) => r.is_active !== false));
      } catch (e) {
        if (cancelled) return;
        console.error("[ProductAttachSection] unexpected:", e);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const attachedIds = new Set(value.map((p) => p.refDropId));

  function handleAdd(r: ProductRow) {
    if (attachedIds.has(r.drop_id) || !r.share_uuid) return;
    // 나-2 — 저장 카피 스냅샷도 함께 운반(있을 때만). 관련 상품 컴팩트 렌더용.
    const headline = r.headline?.trim() || "";
    const sellingPoints = toPoints(r.selling_points);
    onChange([
      ...value,
      {
        refDropId: r.drop_id,
        refShareUuid: r.share_uuid,
        name: r.name?.trim() || "이름 없는 상품",
        priceKrw: r.price_krw,
        imageUrl: r.image_url,
        ...(headline ? { headline } : {}),
        ...(sellingPoints.length > 0 ? { sellingPoints } : {}),
      },
    ]);
  }

  function handleRemove(refDropId: string) {
    onChange(value.filter((p) => p.refDropId !== refDropId));
  }

  return (
    <section className="px-6 pb-28 pt-6">
      <StepBadge n={2} />
      <h2 className="mt-3 text-lg font-extrabold tracking-ko text-text-strong">
        상품 카드 담기 <span className="text-sm font-medium text-text-subtle">(선택)</span>
      </h2>
      <p className="mt-1 text-sm font-medium tracking-ko text-text-muted">
        내가 등록한 상품을 이 카드에 함께 담을 수 있어요.
      </p>

      {loading ? (
        <div className="mt-4 flex items-center justify-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          불러오는 중…
        </div>
      ) : error ? (
        <div className="mt-4 rounded-lg border border-border bg-bg p-4 text-center">
          <p className="text-sm text-text-muted">상품 목록을 불러오지 못했어요.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-border bg-bg px-6 py-8 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-surface">
            <Package className="size-7 text-text-subtle" strokeWidth={1.5} />
          </span>
          <p className="mt-3 text-sm text-text-muted">담을 수 있는 상품이 없어요.</p>
          <Link
            to="/partner/products/new"
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-action px-4 text-sm font-semibold text-action-foreground"
          >
            <Plus className="size-4" strokeWidth={2} />
            상품 등록
          </Link>
        </div>
      ) : (
        <div className="mt-4 -mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1">
          {rows.map((r) => {
            const added = attachedIds.has(r.drop_id);
            return (
              <div
                key={r.drop_id}
                className="relative w-32 shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-bg"
              >
                {r.image_url ? (
                  <img src={r.image_url} alt="" className="aspect-square w-full object-cover" />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center bg-surface">
                    <ImageIcon className="size-6 text-text-subtle" strokeWidth={2} />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleAdd(r)}
                  disabled={added || !r.share_uuid}
                  aria-label={added ? "담김" : "담기"}
                  className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-action text-action-foreground shadow-soft disabled:bg-intent-success disabled:opacity-100"
                >
                  {added ? (
                    <Check className="size-4" strokeWidth={2.5} />
                  ) : (
                    <Plus className="size-4" strokeWidth={2.5} />
                  )}
                </button>
                <div className="p-2">
                  <p className="truncate text-xs font-semibold tracking-ko text-text-strong">
                    {r.name?.trim() || "이름 없는 상품"}
                  </p>
                  <p className="mt-0.5 text-sm font-bold tracking-ko text-text-strong">
                    {priceLabel(r.price_krw)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 담은 상품 */}
      {value.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold tracking-ko text-text-strong">
            담은 상품 {value.length}
          </p>
          <ul className="mt-2 space-y-2">
            {value.map((p) => (
              <li
                key={p.refDropId}
                className="flex items-center gap-3 rounded-lg border border-border bg-bg p-2"
              >
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt=""
                    className="size-12 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface">
                    <ImageIcon className="size-5 text-text-subtle" strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-ko text-text-strong">
                    {p.name}
                  </p>
                  <p className="text-xs font-medium tracking-ko text-text-muted">
                    {priceLabel(p.priceKrw)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(p.refDropId)}
                  aria-label="담은 상품 제거"
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-text-subtle hover:text-text-strong"
                >
                  <X className="size-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
