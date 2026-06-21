import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, Package, Store, Phone } from "lucide-react";
import { getAuthClient } from "@/lib/auth-context";

// STEP 1 손님 주문상태 — 본인 선주문 읽기전용 뷰. partner.preorders.tsx 미러(액션 버튼 전부 제거).
//   _user 자식 규칙: 세션/userId 없어도 throw 금지 → graceful 빈 배열(리다이렉트 루프 방지).
//   ⚠️ TEMP — get_my_preorders 가 types.ts 미반영. supabase.rpc 메서드 직접 호출(detach 금지),
//      캐스트는 인자(as never)·결과에만. 타입 재생성 후 정리.

type MyPreorderRow = {
  preorder_id: string;
  status: string;
  payment_status: string;
  created_at: string;
  product_name: string;
  partner_name: string;
  partner_phone: string | null;
  harvest_date: string | null;
  quantity: number;
  unit_price_krw: number;
  total_krw: number;
  partner_message: string | null;
};

type LoaderData = {
  preorders: MyPreorderRow[];
};

export const Route = createFileRoute("/_user/me/orders")({
  head: () => ({ meta: [{ title: "내 주문 — LinkDrop" }] }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { preorders: [] };
    const supabase = await getAuthClient();
    if (!supabase) return empty;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    if (!userId) return empty;

    // client.rpc 를 변수로 분리하면 this 분실('rest' 에러) → supabase.rpc 메서드 직접 호출.
    try {
      const { data: preorders, error } = (await supabase.rpc(
        "get_my_preorders" as never,
        {} as never,
      )) as { data: MyPreorderRow[] | null; error: { message?: string } | null };
      if (error) {
        console.error("[me.orders-loader] error:", error);
        return empty;
      }
      return { preorders: preorders ?? [] };
    } catch (e) {
      console.error("[me.orders-loader] error:", e);
      return empty;
    }
  },
  component: MyOrdersPage,
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

function MyOrdersPage() {
  const data = Route.useLoaderData();

  const active = data.preorders.filter(
    (r) => r.status === "pending" || r.status === "confirmed",
  );
  const done = data.preorders.filter(
    (r) => r.status !== "pending" && r.status !== "confirmed",
  );

  return (
    <main className="min-h-screen bg-surface tracking-ko pb-12">
      <header className="bg-bg px-5 py-4 border-b border-border">
        <Link
          to="/me"
          className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-strong"
        >
          <ArrowLeft className="size-3" strokeWidth={2} />
          나
        </Link>
        <h1 className="mt-1 text-lg font-bold text-text-strong">내 주문</h1>
        <p className="mt-0.5 text-xs text-text-muted">선주문한 상품의 진행 상태예요</p>
      </header>

      <div className="space-y-4 px-5 pt-4">
        {data.preorders.length === 0 ? (
          <div className="rounded-2xl border border-border bg-bg p-6 text-center">
            <p className="text-sm text-text-muted">아직 주문한 선주문이 없어요.</p>
          </div>
        ) : (
          <>
            {/* 진행 중 (pending/confirmed) */}
            {active.length > 0 ? (
              <section>
                <h2 className="mb-2 px-1 text-sm font-semibold text-text-strong">
                  진행 중 ({active.length})
                </h2>
                <ul className="space-y-3">
                  {active.map((r) => (
                    <MyPreorderCard key={r.preorder_id} row={r} />
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 완료/취소 (fulfilled/cancelled) */}
            {done.length > 0 ? (
              <section>
                <h2 className="mb-2 px-1 text-sm font-semibold text-text-strong">
                  완료·취소 ({done.length})
                </h2>
                <ul className="space-y-3">
                  {done.map((r) => (
                    <MyPreorderCard key={r.preorder_id} row={r} />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </div>
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
  const label = status === "fulfilled" ? "이행완료" : status;
  return (
    <span className="inline-flex items-center rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-text-subtle">
      {label}
    </span>
  );
}

// 손님 선주문 카드 — 읽기전용(액션 버튼 없음). 상품명+상태+주문일 / 발송일·수량·합계 / 농가명 /
//   진행중이면 결제 안내+농가 전화 / 농가 메모. payment_status 배지 없음(결제 off-platform).
function MyPreorderCard({ row }: { row: MyPreorderRow }) {
  const isActive = row.status === "pending" || row.status === "confirmed";
  return (
    <li className={`rounded-2xl border border-border bg-bg p-4 ${isActive ? "" : "opacity-80"}`}>
      {/* 상단: 상품명 + 상태배지 | 주문일(M.D) */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-sm font-bold text-text-strong">
            {row.product_name?.trim() || "상품"}
          </p>
          <StatusBadge status={row.status} />
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

      {/* 농가명 */}
      <div className="mt-1.5 flex items-center gap-2 text-sm text-text-muted">
        <Store className="size-4 text-text-subtle" strokeWidth={2} />
        {row.partner_name?.trim() || "농가"}
      </div>

      {/* 진행 중 — 결제 안내 + 농가 전화 */}
      {isActive ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs font-medium leading-relaxed tracking-ko text-text-muted">
            농가에 전화로 결제·배송을 확정해요.
          </p>
          {row.partner_phone ? (
            <a
              href={`tel:${row.partner_phone}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-action px-4 text-sm font-semibold tracking-ko text-action-foreground"
            >
              <Phone className="size-4" strokeWidth={2} />
              농가에 전화하기
            </a>
          ) : null}
        </div>
      ) : null}

      {/* 농가 메모 (있으면, 2줄 클램프) — 취소사유/안내 */}
      {row.partner_message?.trim() ? (
        <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-text-muted">
          {row.partner_message}
        </p>
      ) : null}
    </li>
  );
}
