import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Check,
  Package,
  Loader2,
  Image as ImageIcon,
  Megaphone,
  PencilLine,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { StepBadge } from "@/components/create/StepBadge";
import type { PromoCard } from "@/components/create/types";

// B 상품 홍보 카드 — 업주 상품 1개 선택 → 그 상품에 저장된 카피(headline/selling_points)를 그대로 사용.
//   나-2: 생성(메모+AI)은 상품 레벨(나-1: 상품 등록/홍보 카피 편집)로 이전. 여기선 "선택 → 저장 카피 사용"만.
//   목록 = get_my_products() RPC(v7.7 — headline/selling_points 반환). MVP = 홍보 카드 1개.
//   카피 없는 상품 → 홍보 카드 못 만듦(안내 + 상품 카피 편집 링크). 결과는 위저드 소유(value: PromoCard | null).

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

export function ProductPromoSection({
  value,
  onChange,
}: {
  value: PromoCard | null;
  onChange: (next: PromoCard | null) => void;
}) {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<ProductRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session?.user.id) {
          if (!cancelled) setError(true);
          return;
        }
        const { data, error: rpcErr } = await supabase.rpc("get_my_products");
        if (cancelled) return;
        if (rpcErr) {
          console.error("[ProductPromoSection] get_my_products failed:", rpcErr);
          setError(true);
          return;
        }
        setRows(((data ?? []) as ProductRow[]).filter((r) => r.is_active !== false));
      } catch (e) {
        if (cancelled) return;
        console.error("[ProductPromoSection] unexpected:", e);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 선택 상품에 저장된 카피가 있으면 그대로 홍보 카드 emit, 없으면 null(=카드 안 만들어짐).
  useEffect(() => {
    const headline = selected?.headline?.trim() ?? "";
    const points = toPoints(selected?.selling_points);
    if (selected && selected.share_uuid && headline && points.length > 0) {
      onChange({
        refDropId: selected.drop_id,
        refShareUuid: selected.share_uuid,
        name: selected.name?.trim() || "이름 없는 상품",
        priceKrw: selected.price_krw,
        imageUrl: selected.image_url,
        headline,
        sellingPoints: points,
      });
    } else {
      onChange(null);
    }
    // onChange 는 위저드 setter(안정) — deps 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function selectProduct(r: ProductRow) {
    if (!r.share_uuid) return;
    setSelected((prev) => (prev?.drop_id === r.drop_id ? null : r));
  }

  const selectedHeadline = selected?.headline?.trim() ?? "";
  const selectedPoints = toPoints(selected?.selling_points);
  const selectedHasCopy = selectedHeadline.length > 0 && selectedPoints.length > 0;

  return (
    <section className="px-6 pb-28 pt-6">
      <StepBadge n={2} />
      <h2 className="mt-3 text-lg font-extrabold tracking-ko text-text-strong">
        상품 홍보 카드 <span className="text-sm font-medium text-text-subtle">(선택)</span>
      </h2>
      <p className="mt-1 text-sm font-medium tracking-ko text-text-muted">
        상품을 고르면 상품에 저장된 홍보 문구를 카드로 보여줄 수 있어요.
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
          <p className="mt-3 text-sm text-text-muted">홍보할 상품이 없어요.</p>
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
            const active = selected?.drop_id === r.drop_id;
            return (
              <div
                key={r.drop_id}
                className={`relative w-32 shrink-0 snap-start overflow-hidden rounded-2xl border bg-bg ${
                  active ? "border-text-strong" : "border-border"
                }`}
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
                  onClick={() => selectProduct(r)}
                  disabled={!r.share_uuid}
                  aria-label={active ? "선택됨" : "선택"}
                  className="absolute right-1.5 top-1.5 inline-flex size-8 items-center justify-center rounded-full bg-action text-action-foreground shadow-soft disabled:opacity-40"
                >
                  {active ? (
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

      {/* 선택 후 — 저장된 카피 미리보기(있으면) 또는 카피 추가 안내(없으면) */}
      {selected ? (
        selectedHasCopy ? (
          <div className="mt-5 rounded-2xl border border-border bg-bg p-4">
            <div className="flex items-center gap-2">
              <Megaphone className="size-4 text-text-strong" strokeWidth={2} />
              <p className="text-sm font-bold tracking-ko text-text-strong">
                {selected.name?.trim() || "상품"} 홍보 문구
              </p>
            </div>
            <p className="mt-3 text-base font-bold leading-snug tracking-ko text-text-strong">
              {selectedHeadline}
            </p>
            <ul className="mt-2 space-y-1.5">
              {selectedPoints.map((p, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm font-medium tracking-ko text-text-muted"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-text-strong" strokeWidth={2.5} />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-medium tracking-ko text-text-muted">
                이대로 홍보 카드가 만들어져요.
              </p>
              <Link
                to="/partner/products/copy"
                search={{ drop_id: selected.drop_id }}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold tracking-ko text-text-strong hover:underline"
              >
                <PencilLine className="size-3.5" strokeWidth={2} />
                카피 수정
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-border bg-bg px-6 py-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface">
              <Megaphone className="size-6 text-text-subtle" strokeWidth={1.5} />
            </span>
            <p className="mt-3 text-sm font-semibold tracking-ko text-text-strong">
              이 상품에 홍보 카피가 없어요.
            </p>
            <p className="mt-1 text-xs font-medium tracking-ko text-text-subtle">
              상품 관리에서 홍보 카피를 먼저 추가하면 홍보 카드로 보여줄 수 있어요.
            </p>
            <Link
              to="/partner/products/copy"
              search={{ drop_id: selected.drop_id }}
              className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-action px-4 text-sm font-semibold text-action-foreground"
            >
              <PencilLine className="size-4" strokeWidth={2} />
              홍보 카피 추가
            </Link>
          </div>
        )
      ) : null}
    </section>
  );
}
