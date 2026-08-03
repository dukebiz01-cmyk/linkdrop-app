import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Package,
  User,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Truck,
} from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Toaster } from "@/components/ui/sonner";

// ③c 선주문 관리 (커머스) — partner.reservations.tsx 1:1 미러. 색은 디자인 토큰.
//   데이터(get_partner_preorders)·상태 RPC(confirm/fulfill/cancel_preorder)·렌더를 예약뷰와 동형.
//   _partner.tsx beforeLoad 가 인증/파트너 가드 → 이 loader 는 세션 없으면 graceful empty(throw 금지).
//   ⚠️ TEMP — 위 RPC 들이 types.ts 미반영(③a)이라 typed rpc 우회 캐스트. 타입 재생성 후 제거.

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
  /** ST2b-3(v8.8) — 구매자 취소 요청 표식(실행은 기존 cancel_preorder 그대로). */
  cancel_requested_at?: string | null;
};

/** UI-5-T7-F6-4b — 배송지(v7.11 컬럼 · RLS preorders_owner_select 직접 조회 보강 —
 *  get_partner_preorders 반환형 무수정). preorder_id 키 맵. */
type ShippingInfo = {
  receiver_name: string | null;
  receiver_phone: string | null;
  shipping_address: string | null;
  shipping_address_detail: string | null;
};

type LoaderData = {
  preorders: PreorderRow[];
  shipping: Record<string, ShippingInfo>;
};


export const Route = createFileRoute("/_partner/partner/preorders")({
  head: () => ({ meta: [{ title: "주문예약 관리 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { preorders: [], shipping: {} };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const ownerUserId = sessionData.session?.user.id ?? null;
    if (!ownerUserId) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle();
    if (!partner?.id) return empty;

    // ⚠️ TEMP — get_partner_preorders 가 types.ts 미반영(③a). client.rpc 를 변수로 분리하면 this 분실
    //   ('rest' 에러) → supabase.rpc 를 메서드로 직접 호출, 캐스트는 인자(as never)·결과에만.
    //   loader 는 rpc 실패해도 throw 금지(페이지 죽음 방지) → graceful 빈 배열.
    try {
      const { data: preorders, error } = (await supabase.rpc(
        "get_partner_preorders" as never,
        { p_partner_id: partner.id } as never,
      )) as { data: PreorderRow[] | null; error: { message?: string } | null };
      if (error) {
        console.error("[preorder-loader] error:", error);
        return empty;
      }
      // F6-4b — 배송지 보강 조회(RLS preorders_owner_select · RPC 반환형 무수정 원칙).
      //   실패해도 주문 목록은 정상(graceful 빈 맵).
      let shipping: Record<string, ShippingInfo> = {};
      try {
        const { data: shipRows } = await supabase
          .from("preorders")
          .select("id, receiver_name, receiver_phone, shipping_address, shipping_address_detail")
          .eq("partner_id", partner.id);
        if (Array.isArray(shipRows)) {
          shipping = Object.fromEntries(
            (shipRows as ({ id: string } & ShippingInfo)[]).map((r) => [
              r.id,
              {
                receiver_name: r.receiver_name ?? null,
                receiver_phone: r.receiver_phone ?? null,
                shipping_address: r.shipping_address ?? null,
                shipping_address_detail: r.shipping_address_detail ?? null,
              },
            ]),
          );
        }
      } catch (e) {
        console.error("[preorder-loader] shipping load failed:", e);
      }
      return { preorders: preorders ?? [], shipping };
    } catch (e) {
      console.error("[preorder-loader] error:", e);
      return empty;
    }
  },
  component: PartnerPreordersPage,
});

// "YYYY-MM-DD" → "M월 D일 발송 예정". 형식 안 맞으면 원문.
function formatHarvest(iso: string): string {
  const parts = iso.split("-");
  const m = parts[1];
  const d = parts[2];
  return m && d ? `${Number(m)}월 ${Number(d)}일 발송 예정` : iso;
}

// created_at → "M.D" (주문일 표기용).
function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

// W5c-2 — 모임판(gb) 배너 행: 내 gb 드롭 + 실집계(get_groupbuy_status · RPC 미적용 = block_data 표식 폴백).
type GbBannerRow = {
  dropId: string;
  name: string;
  qty: number;
  finalized: boolean;
  finalPrice: number | null;
};

function PartnerPreordersPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  // W5c-2 — [모임판 마감] 상태: 배너 목록 · 인라인 확인 1단계(Radix 0) · 처리 중.
  const [gbBanners, setGbBanners] = useState<GbBannerRow[]>([]);
  const [gbConfirming, setGbConfirming] = useState<string | null>(null);
  const [gbClosing, setGbClosing] = useState(false);
  // 결과 요약(RPC 반환 jsonb 그대로 보관 — updated_count 병기 재료).
  const [gbResults, setGbResults] = useState<Record<string, { final_price?: number; updated_count?: number }>>({});

  // 내 gb 드롭 조회(파트너 드롭 조회 관례 = products.index :261 동형) + 드롭별 실집계.
  async function loadGbBanners() {
    try {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) return;
      const { data: rows } = await supabase
        .from("info_drops")
        .select(`id, blocks:component_blocks ( block_kind, block_data )`)
        .eq("owner_user_id", uid)
        .eq("purpose", "구매");
      const list: GbBannerRow[] = [];
      for (const r of (rows ?? []) as unknown as {
        id: string;
        blocks: { block_kind: string; block_data: Record<string, unknown> | null }[] | null;
      }[]) {
        const bd = (r.blocks ?? []).find(
          (b) => b.block_kind === "product" && !(b.block_data ?? {}).ref_drop_id,
        )?.block_data as Record<string, unknown> | undefined;
        if (!bd || bd.gb_enabled !== true) continue;
        // 표식 폴백(RPC 미적용 공백 구간): block_data 의 gb_finalized_at/gb_final_price.
        let qty = 0;
        let finalized = typeof bd.gb_finalized_at === "string" && !!bd.gb_finalized_at;
        let finalPrice = typeof bd.gb_final_price === "number" ? bd.gb_final_price : null;
        try {
          const { data: st, error } = (await supabase.rpc(
            "get_groupbuy_status" as never,
            { p_drop_id: r.id } as never,
          )) as {
            data: { current_qty?: number; finalized?: boolean; final_price?: number | null }[] | null;
            error: { message?: string } | null;
          };
          const row0 = Array.isArray(st) ? st[0] : null;
          if (!error && row0) {
            qty = Math.max(0, Math.floor(Number(row0.current_qty) || 0));
            finalized = row0.finalized === true;
            finalPrice = typeof row0.final_price === "number" ? row0.final_price : finalPrice;
          } else if (error) {
            console.warn("[partner.preorders] get_groupbuy_status 실패 — 표식 폴백:", error.message);
          }
        } catch (e) {
          console.warn("[partner.preorders] get_groupbuy_status 예외 — 표식 폴백:", e);
        }
        list.push({
          dropId: r.id,
          name: typeof bd.name === "string" ? bd.name : "",
          qty,
          finalized,
          finalPrice,
        });
      }
      setGbBanners(list);
    } catch (e) {
      console.warn("[partner.preorders] gb 배너 로드 실패:", e);
    }
  }
  useEffect(() => {
    void loadGbBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 마감 확정 — finalize_groupbuy(실패·RPC 부재 = 기존 토스트 관례 · 가짜 성공 0).
  async function handleFinalizeGb(dropId: string) {
    if (gbClosing) return;
    setGbClosing(true);
    try {
      const { data: res, error } = (await getSupabase().rpc(
        "finalize_groupbuy" as never,
        { p_drop_id: dropId } as never,
      )) as {
        data: { final_price?: number; updated_count?: number; mode?: string } | null;
        error: { message?: string } | null;
      };
      if (error || !res) {
        console.error("[partner.preorders] finalize_groupbuy failed:", error);
        toast.error("처리 중 문제가 생겼어요."); // 기존 문구 재사용(신규 작문 0).
        return;
      }
      setGbConfirming(null);
      setGbResults((prev) => ({ ...prev, [dropId]: res })); // RPC 반환 그대로 보관.
      await loadGbBanners(); // 배너 "마감됨 · 확정가" 전환.
      await router.invalidate(); // cancel 모드 시 주문 목록 상태 반영.
    } catch (err) {
      console.error("[partner.preorders] finalize_groupbuy unexpected:", err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setGbClosing(false);
    }
  }
  // 처리 끝남 목록 접기/펼치기 — 기본 5건만, 더보기로 전체.
  const [othersExpanded, setOthersExpanded] = useState(false);

  const pending = data.preorders.filter((r) => r.status === "pending");
  const others = data.preorders.filter((r) => r.status !== "pending");
  const OTHERS_PREVIEW = 5;
  const visibleOthers = othersExpanded ? others : others.slice(0, OTHERS_PREVIEW);

  // 상태 변경 공통 — RPC 호출 + 성공 toast + router.invalidate(). 예약뷰 패턴.
  async function runAction(
    preorderId: string,
    fn: string,
    args: Record<string, unknown>,
    okMsg: string,
    failMsg: string,
  ) {
    setActingId(preorderId);
    try {
      // client.rpc 분리 금지(this 분실) → supabase.rpc 메서드 직접 호출, 캐스트는 인자·결과에만.
      const supabase = getSupabase();
      const { error } = (await supabase.rpc(fn as never, args as never)) as {
        error: { message?: string } | null;
      };
      if (error) {
        console.error(`[partner.preorders] ${fn} failed:`, error);
        toast.error(failMsg);
        return;
      }
      toast.success(okMsg);
      await router.invalidate();
    } catch (err) {
      console.error(`[partner.preorders] ${fn} unexpected:`, err);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setActingId(null);
    }
  }

  function handleConfirm(id: string) {
    void runAction(
      id,
      "confirm_preorder",
      { p_preorder_id: id },
      "주문예약을 확정했어요.",
      "확정 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  function handleFulfill(id: string) {
    void runAction(
      id,
      "fulfill_preorder",
      { p_preorder_id: id },
      "이행완료로 처리했어요.",
      "이행 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
  function handleCancel(id: string) {
    void runAction(
      id,
      "cancel_preorder",
      { p_preorder_id: id, p_reason: "" },
      "주문예약을 취소했어요.",
      "취소 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
    );
  }

  return (
    <main className="min-h-screen bg-surface tracking-ko pb-12">
      <header className="bg-bg px-5 py-4 border-b border-border">
        <Link
          to="/partner/products"
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-strong"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          내 상점
        </Link>
        <h1 className="mt-1 text-lg font-bold text-text-strong">주문예약 관리</h1>
        <p className="mt-0.5 text-xs text-text-muted">들어온 주문예약을 확인하고 처리해요</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {/* W5c-2 — 모임판(gb) 드롭 배너: 미마감 = 현재 모임 + [모임판 마감](인라인 확인 1단계 · Radix 0)
            / 마감 = "마감됨 · 확정가"(버튼 미노출). RPC 미적용 공백 = 표식 폴백·조용한 0. */}
        {gbBanners.map((b) => (
          <div key={b.dropId} className="rounded-2xl border border-border bg-bg p-4">
            {b.finalized ? (
              <p className="text-sm font-bold text-text-strong tabular-nums [word-break:keep-all]">
                마감됨 · 확정가 {(b.finalPrice ?? 0).toLocaleString("ko-KR")}원
                {gbResults[b.dropId]?.updated_count != null && (
                  <span className="ml-1 text-xs font-semibold text-text-muted">
                    ({gbResults[b.dropId]!.updated_count!.toLocaleString("ko-KR")}건)
                  </span>
                )}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold text-text-strong tabular-nums">
                    {b.name} 모일수록 판매 · 현재 {b.qty.toLocaleString("ko-KR")}개 모임
                  </p>
                  {gbConfirming !== b.dropId && (
                    <button
                      type="button"
                      onClick={() => setGbConfirming(b.dropId)}
                      className="shrink-0 rounded-lg bg-text-strong px-3 py-2 text-xs font-bold text-bg transition-transform active:scale-95"
                    >
                      모임판 마감
                    </button>
                  )}
                </div>
                {gbConfirming === b.dropId && (
                  <div className="space-y-2 rounded-xl bg-surface p-3">
                    <p className="text-xs font-semibold leading-relaxed text-text-strong [word-break:keep-all]">
                      마감하면 최저 도달가로 전원 확정됩니다. 되돌릴 수 없어요.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleFinalizeGb(b.dropId)}
                        disabled={gbClosing}
                        className="flex-1 rounded-lg bg-text-strong py-2 text-xs font-bold text-bg disabled:opacity-50"
                      >
                        마감 확정
                      </button>
                      <button
                        type="button"
                        onClick={() => setGbConfirming(null)}
                        disabled={gbClosing}
                        className="flex-1 rounded-lg border border-border bg-bg py-2 text-xs font-bold text-text-muted"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {/* 신규 선주문 (pending) — 미처리 개수 배지(모노크롬). 0이면 배지 없음 + 빈 상태. */}
        <section>
          <div className="mb-2 flex items-center gap-2 px-1">
            <h2 className="text-sm font-semibold text-text-strong">신규 주문예약</h2>
            {pending.length > 0 ? (
              <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-action px-1.5 text-[11px] font-bold text-action-foreground">
                {pending.length}
              </span>
            ) : null}
          </div>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-border bg-bg p-6 text-center">
              <p className="text-sm text-text-muted">아직 받은 주문예약이 없어요.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {pending.map((r) => (
                <PreorderCard
                  key={r.preorder_id}
                  row={r}
                  shipping={data.shipping[r.preorder_id] ?? null}
                  acting={actingId === r.preorder_id}
                  onConfirm={handleConfirm}
                  onFulfill={handleFulfill}
                  onCancel={handleCancel}
                />
              ))}
            </ul>
          )}
        </section>

        {/* 처리완료 (confirmed/fulfilled/cancelled) — 기본 5건만, 더보기로 전체. */}
        {others.length > 0 ? (
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-text-strong">
              처리완료 ({others.length})
            </h2>
            <ul className="space-y-3">
              {visibleOthers.map((r) => (
                <PreorderCard
                  key={r.preorder_id}
                  row={r}
                  shipping={data.shipping[r.preorder_id] ?? null}
                  acting={actingId === r.preorder_id}
                  onConfirm={handleConfirm}
                  onFulfill={handleFulfill}
                  onCancel={handleCancel}
                />
              ))}
            </ul>
            {others.length > OTHERS_PREVIEW ? (
              <button
                type="button"
                onClick={() => setOthersExpanded((v) => !v)}
                className="mt-3 flex w-full min-h-[44px] items-center justify-center rounded-2xl border border-border bg-bg px-4 text-sm font-semibold text-text-strong hover:bg-surface"
              >
                {othersExpanded ? "접기" : `더보기 (${others.length - OTHERS_PREVIEW}건)`}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}

// 선주문 상태 배지 — pending=대기중 / confirmed=확정 / fulfilled=이행완료 / cancelled=취소.
function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-full bg-intent-warning-bg px-2 py-0.5 text-[11px] font-bold text-intent-warning">
        대기중
      </span>
    );
  }
  if (status === "confirmed") {
    return (
      <span className="inline-flex items-center rounded-full bg-intent-success-bg px-2 py-0.5 text-[11px] font-bold text-intent-success">
        확정
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center rounded-full bg-intent-danger-bg px-2 py-0.5 text-[11px] font-bold text-intent-danger">
        취소
      </span>
    );
  }
  // fulfilled (또는 알 수 없는 상태) — muted.
  const label = status === "fulfilled" ? "이행완료" : status;
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-text-subtle">
      {label}
    </span>
  );
}

// 선주문 카드 — 상품명+상태배지+주문일 / 발송일·수량·합계 / 손님·메모. 상태별 액션.
//   ⚠️ 전화번호/전화하기·payment 배지 없음(선주문은 전화 미수집·결제 off-platform).
function PreorderCard({
  row,
  shipping = null,
  acting = false,
  onConfirm,
  onFulfill,
  onCancel,
}: {
  row: PreorderRow;
  shipping?: ShippingInfo | null;
  acting?: boolean;
  onConfirm: (id: string) => void;
  onFulfill: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const isPending = row.status === "pending";
  const isConfirmed = row.status === "confirmed";
  const hasActions = isPending || isConfirmed;
  // F6-4b — [주소 복사]: 이름·전화·주소 한 줄 포맷(택배 접수 창 바로 붙여넣기).
  const copyAddress = () => {
    const line = [
      shipping?.receiver_name,
      shipping?.receiver_phone,
      [shipping?.shipping_address, shipping?.shipping_address_detail].filter(Boolean).join(" "),
    ]
      .filter(Boolean)
      .join(" ");
    navigator.clipboard
      ?.writeText(line)
      .then(() => toast.success("주소를 복사했어요."))
      .catch(() => toast.error("복사에 실패했어요 — 길게 눌러 직접 복사해 주세요."));
  };
  return (
    <li
      className={`rounded-2xl border border-border bg-bg p-4 ${hasActions ? "" : "opacity-80"}`}
    >
      {/* 상단: 상품명 + 상태배지 | 주문일(M.D) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold text-text-strong">
            {row.product_name?.trim() || "상품"}
          </p>
          <StatusBadge status={row.status} />
          {/* ST2b-3(v8.8) — 취소 요청 배지(표식만 — 실행은 기존 취소 버튼). */}
          {row.cancel_requested_at && (row.status === "pending" || row.status === "confirmed") ? (
            <span className="inline-flex items-center rounded-full bg-intent-danger-bg px-2 py-0.5 text-[11px] font-bold text-intent-danger">
              취소 요청됨
            </span>
          ) : null}
        </div>
        {row.created_at ? (
          <span className="shrink-0 text-xs font-medium text-text-subtle">
            {formatMonthDay(row.created_at)} 주문
          </span>
        ) : null}
      </div>

      {/* 발송일 (있을 때만) */}
      {row.harvest_date ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
          <CalendarDays className="size-4 text-text-subtle" strokeWidth={2} />
          {formatHarvest(row.harvest_date)}
        </div>
      ) : null}

      {/* 수량 · 합계 */}
      <div className="mt-1.5 flex items-center gap-2 text-sm text-text-muted">
        <Package className="size-4 text-text-subtle" strokeWidth={2} />
        {row.quantity}개
        <span className="font-bold text-text-strong">
          · {Number(row.total_krw).toLocaleString()}원
        </span>
      </div>

      {/* 손님 */}
      <div className="mt-1.5 flex items-center gap-2 text-sm text-text-muted">
        <User className="size-4 text-text-subtle" strokeWidth={2} />
        {row.customer_name?.trim() || "손님"}
      </div>

      {/* UI-5-T7-F6-4b — 배송지 블록(있을 때만 · v7.11 컬럼): 이름·전화·주소 + [주소 복사].
          요청 메시지는 아래 기존 손님 메모 블록이 담당(중복 표기 금지). */}
      {shipping?.shipping_address ? (
        <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-surface p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-text-strong">
              <Truck className="size-4 text-text-subtle" strokeWidth={2} />
              배송지
            </p>
            <button
              type="button"
              onClick={copyAddress}
              className="flex min-h-[32px] items-center rounded-lg border border-border bg-bg px-2.5 text-xs font-semibold text-text-strong hover:border-text-muted"
            >
              주소 복사
            </button>
          </div>
          <p className="text-sm font-semibold text-text-strong">
            {shipping.receiver_name ?? "받는 분"}
            {shipping.receiver_phone ? ` · ${shipping.receiver_phone}` : ""}
          </p>
          <p className="text-sm leading-relaxed text-text-muted [word-break:keep-all]">
            {shipping.shipping_address}
            {shipping.shipping_address_detail ? ` ${shipping.shipping_address_detail}` : ""}
          </p>
        </div>
      ) : null}

      {/* 손님 메모 (있으면, 2줄 클램프) */}
      {row.customer_message?.trim() ? (
        <div className="mt-1.5 flex gap-2 text-sm text-text-muted">
          <MessageSquare className="mt-0.5 size-4 shrink-0 text-text-subtle" strokeWidth={2} />
          <p className="line-clamp-2 min-w-0 whitespace-pre-line">{row.customer_message}</p>
        </div>
      ) : null}

      {/* 액션 — pending: 취소+확정 / confirmed: 취소+이행완료 / 그 외: 없음. */}
      {hasActions ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => onCancel(row.preorder_id)}
            disabled={acting}
            className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-bg px-4 text-sm font-semibold text-text-strong hover:bg-surface disabled:opacity-50"
          >
            <XCircle className="size-4" strokeWidth={2} />
            취소
          </button>
          {isPending ? (
            <button
              type="button"
              onClick={() => onConfirm(row.preorder_id)}
              disabled={acting}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-action px-4 text-sm font-bold text-action-foreground hover:opacity-90 disabled:opacity-50"
            >
              <CheckCircle2 className="size-4" strokeWidth={2} />
              확정
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onFulfill(row.preorder_id)}
              disabled={acting}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-action px-4 text-sm font-bold text-action-foreground hover:opacity-90 disabled:opacity-50"
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
