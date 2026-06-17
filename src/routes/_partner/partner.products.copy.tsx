import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import {
  ProductCopyEditor,
  EMPTY_PRODUCT_COPY,
  type ProductCopyValue,
} from "@/components/create/ProductCopyEditor";

// 나-1 — 상품 홍보 카피 "포커스드" 편집(전체 편집 아님, 카피만).
//   판매관리 목록 → 상품별 "홍보 카피" → 이 화면. GET 으로 프리필, 저장은 POST(서버에서 소유자 확인).

type CopySearch = { drop_id?: string };

export const Route = createFileRoute("/_partner/partner/products/copy")({
  head: () => ({ meta: [{ title: "홍보 카피 — LinkDrop" }] }),
  validateSearch: (search: Record<string, unknown>): CopySearch => ({
    drop_id: typeof search.drop_id === "string" ? search.drop_id : undefined,
  }),
  component: ProductCopyPage,
});

function priceLabel(krw: number | null): string {
  return krw != null ? `${krw.toLocaleString("ko-KR")}원` : "가격 미정";
}

function ProductCopyPage() {
  const { drop_id: dropId } = Route.useSearch();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<{
    name: string | null;
    priceKrw: number | null;
    imageUrl: string | null;
  } | null>(null);
  const [copy, setCopy] = useState<ProductCopyValue>(EMPTY_PRODUCT_COPY);

  useEffect(() => {
    if (!dropId) {
      setError("잘못된 접근이에요.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/products/copy?drop_id=${encodeURIComponent(dropId)}`);
        const json = (await res.json()) as {
          name?: string | null;
          price_krw?: number | null;
          image_url?: string | null;
          headline?: string;
          selling_points?: string[];
          message?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(json.message ?? "상품을 불러오지 못했어요.");
          return;
        }
        setProduct({
          name: json.name ?? null,
          priceKrw: typeof json.price_krw === "number" ? json.price_krw : null,
          imageUrl: json.image_url ?? null,
        });
        setCopy({
          headline: typeof json.headline === "string" ? json.headline : "",
          sellingPoints: Array.isArray(json.selling_points) ? json.selling_points : [],
        });
      } catch {
        if (!cancelled) setError("상품을 불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dropId]);

  async function handleSave() {
    if (!dropId || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/products/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drop_id: dropId,
          headline: copy.headline.trim(),
          selling_points: copy.sellingPoints.map((s) => s.trim()).filter(Boolean),
        }),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        toast.error(json.message ?? "저장에 실패했어요.");
        return;
      }
      toast.success("홍보 카피를 저장했어요.");
      void navigate({ to: "/partner/products" });
    } catch {
      toast.error("저장 중 문제가 생겼어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="border-b border-[#F1F5F9] bg-white px-5 py-4">
        <Link
          to="/partner/products"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          판매 관리
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">홍보 카피</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">상품에 보여줄 홍보 문구를 만들어요</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#64748B]">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            불러오는 중…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
            <p className="text-sm text-[#64748B]">{error}</p>
            <Link
              to="/partner/products"
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-sm font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
            >
              목록으로
            </Link>
          </div>
        ) : (
          <>
            {/* 상품 미리보기 */}
            <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              {product?.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-[#FAFAFA]">
                  <ImageIcon className="size-6 text-[#94A3B8]" strokeWidth={2} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0F172A]">
                  {product?.name?.trim() || "이름 없는 상품"}
                </p>
                <p className="mt-0.5 text-base font-semibold text-[#0F172A]">
                  {priceLabel(product?.priceKrw ?? null)}
                </p>
              </div>
            </div>

            <ProductCopyEditor
              productName={product?.name ?? ""}
              priceKrw={product?.priceKrw ?? null}
              productId={dropId}
              value={copy}
              onChange={setCopy}
            />

            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <CheckCircle2 className="size-4" strokeWidth={2} />
              )}
              {saving ? "저장 중…" : "카피 저장"}
            </button>
          </>
        )}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
