import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Share2,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Eye,
  EyeOff,
  Megaphone,
  ChevronLeft,
  CalendarDays,
  Package,
  User,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Truck,
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

// ── 주문관리 탭 — /partner/preorders 데이터/핸들러 흡수. 신규 쿼리 없음:
//   기존 RPC get_partner_preorders(조회)·confirm/fulfill/cancel_preorder(처리)만 호출(로직 복제 아님). ──
type PreorderRow = {
  preorder_id: string;
  status: string;
  payment_status: string;
  created_at: string;
  product_name: string;
  harvest_date: string | null;
  quantity: number;
  unit_price_krw: number;
  total_krw: number;
  customer_name: string;
  customer_message: string | null;
};

// "YYYY-MM-DD" → "M월 D일 발송 예정"(preorders 뷰 동형).
function formatHarvest(iso: string): string {
  const parts = iso.split("-");
  const m = parts[1];
  const d = parts[2];
  return m && d ? `${Number(m)}월 ${Number(d)}일 발송 예정` : iso;
}
function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}
function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "대기중", cls: "bg-[#FEF3C7] text-[#B45309]" },
    confirmed: { label: "확정", cls: "bg-[#ECFDF3] text-[#16A34A]" },
    cancelled: { label: "취소", cls: "bg-[#FEF2F2] text-[#DC2626]" },
    fulfilled: { label: "이행완료", cls: "bg-[#F1F5F9] text-[#64748B]" },
  };
  const m = map[status] ?? { label: status, cls: "bg-[#F1F5F9] text-[#64748B]" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}

// v0 store-hub TopBar — 뒤로가기(→/me, 갇힘 해결). _partner BottomNav 는 레이아웃이 별도 유지.
function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#F0F0F0] bg-white/95 px-4 backdrop-blur-xl">
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="flex size-9 items-center justify-center rounded-lg text-[#525252] transition-colors hover:bg-[#F5F5F5]"
      >
        <ChevronLeft className="size-5" strokeWidth={2.25} />
      </button>
      <span className="text-[15px] font-semibold text-[#0A0A0A]">{title}</span>
      <div className="w-9" />
    </header>
  );
}

// 주문 카드(v0 톤) — 실 preorder 데이터. 상태별 액션(확정/이행완료/취소) = 기존 RPC 호출.
function OrderCard({
  row,
  acting,
  onConfirm,
  onFulfill,
  onCancel,
}: {
  row: PreorderRow;
  acting: boolean;
  onConfirm: (id: string) => void;
  onFulfill: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isPending = row.status === "pending";
  const isConfirmed = row.status === "confirmed";
  const hasActions = isPending || isConfirmed;
  return (
    <li className={`rounded-2xl border border-[#EDEDED] bg-white p-4 ${hasActions ? "" : "opacity-80"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[14px] font-bold text-[#0A0A0A]">
            {row.product_name?.trim() || "상품"}
          </p>
          <OrderStatusBadge status={row.status} />
        </div>
        {row.created_at ? (
          <span className="shrink-0 text-[12px] font-medium text-[#8A8A8A]">
            {formatMonthDay(row.created_at)} 주문
          </span>
        ) : null}
      </div>
      {row.harvest_date ? (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-[#525252]">
          <CalendarDays className="size-4 text-[#8A8A8A]" strokeWidth={2} />
          {formatHarvest(row.harvest_date)}
        </div>
      ) : null}
      <div className="mt-1.5 flex items-center gap-2 text-[13px] text-[#525252]">
        <Package className="size-4 text-[#8A8A8A]" strokeWidth={2} />
        {row.quantity}개{" "}
        <span className="font-bold text-[#0A0A0A]">
          · {Number(row.total_krw).toLocaleString()}원
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[13px] text-[#525252]">
        <User className="size-4 text-[#8A8A8A]" strokeWidth={2} />
        {row.customer_name?.trim() || "손님"}
      </div>
      {row.customer_message?.trim() ? (
        <div className="mt-1.5 flex gap-2 text-[13px] text-[#525252]">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-[#8A8A8A]" strokeWidth={2} />
          <p className="line-clamp-2 min-w-0 whitespace-pre-line">{row.customer_message}</p>
        </div>
      ) : null}
      {hasActions ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onCancel(row.preorder_id)}
            disabled={acting}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-4 text-sm font-semibold text-[#0A0A0A] hover:bg-[#F5F5F5] disabled:opacity-50"
          >
            <XCircle className="size-4" strokeWidth={2} />
            취소
          </button>
          {isPending ? (
            <button
              type="button"
              onClick={() => onConfirm(row.preorder_id)}
              disabled={acting}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" strokeWidth={2} />
              확정
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFulfill(row.preorder_id)}
              disabled={acting}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              <Truck className="size-4" strokeWidth={2} />
              이행완료
            </button>
          )}
        </div>
      ) : null}
    </li>
  );
}

function ProductsIndexPage() {
  const navigate = useNavigate();
  // 판매관리 3탭(#418: 인라인 탭). 상품(현행)/주문(preorders 흡수)/배송(준비중).
  const [tab, setTab] = useState<"product" | "order" | "shipping">("product");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // 주문 탭 상태 — lazy 로드(탭 최초 진입 시 1회). preorders 와 동일 RPC.
  const [orders, setOrders] = useState<PreorderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);

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
        // 공개=판매+탐색 단일 정책 — status 와 is_public 동시 토글(공개 시 탐색 커머스탭 노출).
        .update({ status: next, is_public: next === "published" })
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

  // 주문 로드 — partner.id → get_partner_preorders(기존 RPC, preorders 로더와 동일). 신규 쿼리 없음.
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(false);
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setOrdersError(true);
        return;
      }
      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("owner_user_id", uid)
        .maybeSingle();
      const pid = (partner as { id?: string } | null)?.id;
      if (!pid) {
        setOrders([]);
        setOrdersLoaded(true);
        return;
      }
      // ⚠️ TEMP — get_partner_preorders 가 types.ts 미반영(preorders 뷰와 동일 캐스트 관례).
      const { data: pre, error: rpcErr } = (await supabase.rpc(
        "get_partner_preorders" as never,
        { p_partner_id: pid } as never,
      )) as { data: PreorderRow[] | null; error: { message?: string } | null };
      if (rpcErr) {
        console.error("[partner.products/orders] get_partner_preorders failed:", rpcErr);
        setOrdersError(true);
        return;
      }
      setOrders(pre ?? []);
      setOrdersLoaded(true);
    } catch (e) {
      console.error("[partner.products/orders] unexpected:", e);
      setOrdersError(true);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // 주문 탭 최초 진입 시 1회 로드(lazy).
  useEffect(() => {
    if (tab === "order" && !ordersLoaded) void loadOrders();
  }, [tab, ordersLoaded, loadOrders]);

  // 주문 상태 처리 — 기존 RPC(confirm/fulfill/cancel_preorder) 호출. 성공 시에만 toast(§0 가짜 성공 금지).
  async function runOrderAction(
    id: string,
    fn: string,
    args: Record<string, unknown>,
    okMsg: string,
    failMsg: string,
  ) {
    setActingOrderId(id);
    try {
      const supabase = getSupabase();
      const { error: rpcErr } = (await supabase.rpc(fn as never, args as never)) as {
        error: { message?: string } | null;
      };
      if (rpcErr) {
        console.error(`[partner.products/orders] ${fn} failed:`, rpcErr);
        toast.error(failMsg);
        return;
      }
      toast.success(okMsg);
      await loadOrders();
    } catch (err) {
      console.error(`[partner.products/orders] ${fn} unexpected:`, err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setActingOrderId(null);
    }
  }
  function handleConfirmOrder(id: string) {
    void runOrderAction(
      id,
      "confirm_preorder",
      { p_preorder_id: id },
      "주문예약을 확정했어요.",
      "확정 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  function handleFulfillOrder(id: string) {
    void runOrderAction(
      id,
      "fulfill_preorder",
      { p_preorder_id: id },
      "이행완료로 처리했어요.",
      "이행 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  function handleCancelOrder(id: string) {
    void runOrderAction(
      id,
      "cancel_preorder",
      { p_preorder_id: id, p_reason: "" },
      "주문예약을 취소했어요.",
      "취소 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }

  const pendingOrders = orders.filter((r) => r.status === "pending");
  const otherOrders = orders.filter((r) => r.status !== "pending");

  return (
    <main className="min-h-screen bg-[#FAFAFA] tracking-ko pb-12">
      {/* ★ 갇힘 해결 — v0 TopBar 뒤로가기(→/me). _partner BottomNav 유지. */}
      <TopBar title="판매관리" onBack={() => navigate({ to: "/me" })} />

      {/* 하위 3탭(v0 SalesManagementPage) — 상품관리 / 주문관리 / 배송관리 */}
      <div className="sticky top-14 z-20 flex border-b border-[#EDEDED] bg-white px-5">
        {(
          [
            { id: "product", label: "상품관리" },
            { id: "order", label: "주문관리" },
            { id: "shipping", label: "배송관리" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="relative flex-1 py-3.5 text-[14px] font-semibold transition-colors"
            style={{ color: tab === t.id ? "#0A0A0A" : "#A3A3A3" }}
          >
            {t.label}
            {tab === t.id ? (
              <span className="absolute bottom-0 left-1/2 h-[2px] w-10 -translate-x-1/2 rounded-full bg-[#2563EB]" />
            ) : null}
          </button>
        ))}
      </div>

      {/* ── 상품관리 탭 — 현행 기능 전부 보존(리스트·등록·복사·공유·카드보기·공개토글). ── */}
      {tab === "product" ? (
        <div className="space-y-4 px-5 pt-4">
          {/* 1차 CTA — 새 상품 등록 */}
          <Link
            to="/partner/products/new"
            className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] px-4 py-3.5 text-sm font-semibold text-white hover:bg-[#171717]"
          >
            <Plus className="size-4" strokeWidth={2} />새 상품 등록
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
          <>
            {/* 공개=판매+탐색 안내(60대 친화 짧게). 토글 의미 1회 설명. */}
            <p className="px-1 text-xs text-[#64748B]">
              공개하면 탐색에서 손님이 봐요. 숨기면 손님에게 안 보여요.
            </p>
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
          </>
        )}
        </div>
      ) : tab === "order" ? (
        /* ── 주문관리 탭 — /partner/preorders 데이터 흡수(get_partner_preorders + confirm/fulfill/cancel_preorder). ── */
        <div className="space-y-4 px-5 pt-4">
          {ordersLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#64748B]">
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              불러오는 중…
            </div>
          ) : ordersError ? (
            <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center">
              <p className="text-sm text-[#64748B]">주문을 불러오지 못했어요.</p>
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#E2E8F0] px-4 text-sm font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
              >
                다시 시도
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-[#EDEDED] bg-white p-6 text-center">
              <p className="text-sm text-[#8A8A8A]">아직 받은 주문예약이 없어요.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-1">
                <h2 className="text-[14px] font-bold text-[#0A0A0A]">신규 주문예약</h2>
                {pendingOrders.length > 0 ? (
                  <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#0A0A0A] px-1.5 text-[11px] font-bold text-white">
                    {pendingOrders.length}
                  </span>
                ) : null}
              </div>
              {pendingOrders.length === 0 ? (
                <p className="px-1 text-[13px] text-[#8A8A8A]">새 주문예약이 없어요.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingOrders.map((r) => (
                    <OrderCard
                      key={r.preorder_id}
                      row={r}
                      acting={actingOrderId === r.preorder_id}
                      onConfirm={handleConfirmOrder}
                      onFulfill={handleFulfillOrder}
                      onCancel={handleCancelOrder}
                    />
                  ))}
                </ul>
              )}
              {otherOrders.length > 0 ? (
                <div className="mt-2">
                  <h2 className="mb-2 px-1 text-[14px] font-bold text-[#0A0A0A]">
                    처리완료 ({otherOrders.length})
                  </h2>
                  <ul className="space-y-3">
                    {otherOrders.map((r) => (
                      <OrderCard
                        key={r.preorder_id}
                        row={r}
                        acting={actingOrderId === r.preorder_id}
                        onConfirm={handleConfirmOrder}
                        onFulfill={handleFulfillOrder}
                        onCancel={handleCancelOrder}
                      />
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : (
        /* ── 배송관리 탭 — 준비 중(배송 스키마·RPC 없음). 가짜 송장·상태·mock 금지, 정직 표시. ── */
        <div className="px-5 pt-4">
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#D4D4D4] bg-white px-4 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-[#F1F5F9]">
              <Truck className="size-5 text-[#94A3B8]" strokeWidth={2} />
            </span>
            <p className="text-[13px] font-semibold text-[#475569]">배송관리는 준비 중이에요</p>
            <p className="text-[12px] text-[#94A3B8]">실물 상품 배송·송장 관리 기능을 준비하고 있어요.</p>
          </div>
        </div>
      )}

      <Toaster richColors position="top-center" />
    </main>
  );
}
