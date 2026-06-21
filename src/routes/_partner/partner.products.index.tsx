import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Share2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Eye,
  EyeOff,
  Megaphone,
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";
import { CommercePrepGuide } from "@/components/commerce/CommercePrepGuide";

// S3a — 판매 관리: 자체업로드 상품("내 상품") 목록. 읽기 전용 직접 쿼리(마이그 0).
//   소유 기준 = info_drops.owner_user_id = 현재 uid + purpose='구매'.
//   자체업로드 식별 = content_sources.source_url 가 합성 prefix 로 시작(외부 스크랩 제외).
//   공유 링크 = 첫 share_event(created_at 최소)의 share_uuid → app.drop.how/d/{uuid}.

export const Route = createFileRoute("/_partner/partner/products/")({
  head: () => ({ meta: [{ title: "판매 관리 — LinkDrop" }] }),
  component: ProductsIndexPage,
});

// S2b api/drops 자체업로드 분기가 source_url 에 박는 합성 prefix. 외부상품은 절대 안 겹침.
const SELF_UPLOAD_PREFIX = "https://app.drop.how/p/";
// 단축링크 시스템과 동일하게 base 하드코딩(origin/window.location 금지).
const APP_BASE = "https://app.drop.how";

type ProductSource = {
  title: string | null;
  thumbnail_url: string | null;
  price_krw: number | null;
  source_url: string | null;
  provider: string | null;
};

type ShareEventRow = { share_uuid: string | null; created_at: string | null };

type BlockRow = { block_kind: string | null; block_data: Record<string, unknown> | null };

type ProductRow = {
  id: string;
  status: string | null;
  created_at: string | null;
  view_count: number | null;
  source: ProductSource | null;
  share_events: ShareEventRow[] | null;
  blocks: BlockRow[] | null;
};

// 한 드롭의 공유 share_uuid = share_events 중 created_at 최소(첫) 것.
function firstShareUuid(r: ProductRow): string | null {
  const ev = (r.share_events ?? [])
    .slice()
    .sort((a, b) => +new Date(a.created_at ?? 0) - +new Date(b.created_at ?? 0))[0];
  return ev?.share_uuid ?? null;
}

// 신선 원물 여부 — product 블록 block_data.is_fresh === true (신선 등록 상품만 true).
function isFreshProduct(r: ProductRow): boolean {
  return (r.blocks ?? []).some(
    (b) => b.block_kind === "product" && b.block_data?.is_fresh === true,
  );
}

function ProductsIndexPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const supabase = getSupabase();
      // uid 조회 — partner.products.new.tsx 업로드 경로와 동일한 세션 조회 패턴.
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setError(true);
        return;
      }

      const { data: rows, error: qErr } = await supabase
        .from("info_drops")
        .select(
          `id, status, created_at, view_count,
           source:content_sources!inner ( title, thumbnail_url, price_krw, source_url, provider ),
           share_events ( share_uuid, created_at ),
           blocks:component_blocks ( block_kind, block_data )`,
        )
        .eq("owner_user_id", uid)
        .eq("purpose", "구매")
        .order("created_at", { ascending: false });

      if (qErr) {
        console.error("[partner.products] list query failed:", qErr);
        setError(true);
        return;
      }

      // 자체업로드만 — 외부 스크랩 구매상품(실제 외부 URL) 제외. JS 필터(embedded .like 회피).
      const filtered = ((rows ?? []) as unknown as ProductRow[]).filter((r) =>
        r.source?.source_url?.startsWith(SELF_UPLOAD_PREFIX),
      );
      setProducts(filtered);
    } catch (e) {
      console.error("[partner.products] unexpected:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // 공유하기 — products.new.tsx 와 동일 메커니즘(링크 클립보드 복사 + 동일 피드백).
  async function handleShare(shareUuid: string | null) {
    if (!shareUuid) return;
    const url = `${APP_BASE}/d/${shareUuid}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("공유 링크를 복사했어요.");
    } catch {
      toast.error("복사에 실패했어요.");
    }
  }

  // 활성↔비활성 (D3, 소프트 비활성) — info_drops.status 를 published↔archived 토글.
  //   세션 hydrate 후 클라 직접 UPDATE(drops_owner_modify RLS, owner-gated). status 만 patch.
  //   범위 (a): 파트너 목록 표시(판매중/비공개)만 — 공개 /d(get_drop_detail) 무변경.
  async function handleToggleActive(p: ProductRow) {
    const next = p.status === "published" ? "archived" : "published";
    setTogglingId(p.id);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user.id) {
        toast.error("로그인이 필요해요.");
        return;
      }
      const { error: upErr } = await supabase
        .from("info_drops")
        .update({ status: next })
        .eq("id", p.id);
      if (upErr) {
        console.error("[partner.products] status toggle failed:", upErr);
        toast.error("상태 변경에 실패했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success(next === "archived" ? "비공개로 전환했어요." : "판매중으로 전환했어요.");
      await load();
    } catch (e) {
      console.error("[partner.products] toggle unexpected:", e);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko pb-12">
      <header className="bg-white px-5 py-4 border-b border-[#F1F5F9]">
        <Link
          to="/partner"
          className="inline-flex items-center gap-1 text-xs text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          매장 홈
        </Link>
        <h1 className="mt-1 text-lg font-bold text-[#0F172A]">판매 관리</h1>
        <p className="mt-0.5 text-xs text-[#64748B]">내 상품 {products.length}개</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* 1차 CTA — 새 상품 등록 */}
        <Link
          to="/partner/products/new"
          className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#171717]"
        >
          <Plus className="size-4" strokeWidth={2} />새 상품 등록
        </Link>

        {/* ③c — 받은 선주문 보기 (additive). 토큰 색. */}
        <Link
          to="/partner/preorders"
          className="flex w-full min-h-[44px] items-center justify-between rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-semibold text-text-strong hover:bg-surface"
        >
          <span className="inline-flex items-center gap-2">
            <ClipboardList className="size-4" strokeWidth={2} />
            받은 선주문 보기
          </span>
          <ChevronRight className="size-4 text-text-subtle" strokeWidth={2} />
        </Link>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#64748B]">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            불러오는 중…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
            <p className="text-sm text-[#64748B]">목록을 불러오지 못했어요.</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-sm font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
            >
              다시 시도
            </button>
          </div>
        ) : products.length === 0 ? (
          // 등록 상품 0개 — 빈 화면 대신 커머스 준비 가이드(4항목). approved 가맹점 전용.
          <CommercePrepGuide />
        ) : (
          <ul className="flex flex-col gap-3">
            {products.map((p) => {
              const shareUuid = firstShareUuid(p);
              const isPublished = p.status === "published";
              return (
                <li
                  key={p.id}
                  className="rounded-2xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                >
                  {/* 상단: 사진 + 정보 */}
                  <div className="flex gap-3">
                    {p.source?.thumbnail_url ? (
                      <img
                        src={p.source.thumbnail_url}
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
                        {p.source?.title?.trim() || "이름 없는 상품"}
                      </p>
                      <p className="mt-0.5 text-base font-semibold text-[#0F172A]">
                        {p.source?.price_krw != null
                          ? `${p.source.price_krw.toLocaleString("ko-KR")}원`
                          : "가격 미정"}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {isPublished ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            판매중
                          </span>
                        ) : (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                            비공개
                          </span>
                        )}
                        {isFreshProduct(p) ? (
                          <span className="rounded-md bg-intent-success-bg px-2 py-0.5 text-xs font-medium text-intent-success">
                            신선
                          </span>
                        ) : null}
                        {p.view_count != null ? (
                          <span className="text-xs text-[#94A3B8]">조회 {p.view_count}</span>
                        ) : null}
                      </div>
                    </div>

                    {/* 활성↔비활성 토글 (D3) — published↔archived. 되돌릴 수 있어 confirm 없음. */}
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(p)}
                      disabled={togglingId === p.id}
                      aria-label={isPublished ? "비공개로 전환" : "판매중으로 전환"}
                      className="inline-flex h-8 shrink-0 items-center gap-1 self-start rounded-lg border border-[#E2E8F0] px-2 text-xs font-semibold text-[#64748B] hover:bg-[#FAFAFA] disabled:opacity-50"
                    >
                      {isPublished ? (
                        <EyeOff className="size-3.5" strokeWidth={2} />
                      ) : (
                        <Eye className="size-3.5" strokeWidth={2} />
                      )}
                      {isPublished ? "숨기기" : "공개"}
                    </button>
                  </div>

                  {/* 액션: 공유하기(주인공) + 카드보기 */}
                  <div className="mt-3 flex gap-2 border-t border-[#F1F5F9] pt-3">
                    <button
                      type="button"
                      onClick={() => void handleShare(shareUuid)}
                      disabled={!shareUuid}
                      className="flex flex-1 min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#EFF6FF] py-2.5 text-sm font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE] disabled:opacity-50"
                    >
                      <Share2 className="size-4" strokeWidth={2} />
                      공유하기
                    </button>
                    {/* 나-1 — 상품 홍보 카피(headline/selling_points) 편집 진입 */}
                    <Link
                      to="/partner/products/copy"
                      search={{ drop_id: p.id }}
                      className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
                    >
                      <Megaphone className="size-4" strokeWidth={2} />
                      홍보 카피
                    </Link>
                    {shareUuid ? (
                      <a
                        href={`${APP_BASE}/d/${shareUuid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
                      >
                        <ExternalLink className="size-4" strokeWidth={2} />
                        카드보기
                      </a>
                    ) : (
                      <span className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm font-medium text-[#94A3B8]">
                        <ExternalLink className="size-4" strokeWidth={2} />
                        카드보기
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
