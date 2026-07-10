"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Store,
  Share2,
  Copy,
  Check,
  Users,
  Link2,
  Package,
  BarChart3,
  Ticket,
  Calendar,
  ShoppingBag,
  Tag,
  Clock,
  Sparkles,
  Truck,
  PackageCheck,
  MapPin,
} from "lucide-react";
import { PartnerDashboardPageDemo } from "@/components/partner-dashboard-page";
import { ReservationCalendarPageDemo } from "@/components/reservation-calendar-page";
import { MyCouponsPageDemo } from "@/components/my-coupons-page";

// ============================================================
// 내 매장 허브 — 사장님 운영 진입점 (그리드형)
// WHY: 흩어진 관리 기능(판매·매출·프로모션·예약)을 하나의 그리드로 정돈
// WHY: 판매관리 안에 상품관리 + 주문관리(내 주문관리)를 하위로 묶음
// ============================================================

const ACCENT = "#2563EB";

interface StoreHubData {
  name: string;
  category: string;
  region: string;
  subscribers: number;
  slug: string;
  logoUrl?: string;
}

const DEMO_STORE: StoreHubData = {
  name: "노을재 캠핑장",
  category: "캠핑·펜션",
  region: "충청북도 괴산군 칠성면 사평리 모래재",
  subscribers: 3,
  slug: "noeulhouse",
};

const DEMO_BENEFITS = [
  { id: "b1", title: "얼리썸머 캐쉬백 10,000원", meta: "26.08.05까지", kind: "cash" as const },
  { id: "b2", title: "웰컴쿠폰 · 할인쿠폰", meta: "26.12.31까지 · 외 1개", kind: "coupon" as const },
];

const DEMO_PARTNERS = [
  { id: "p1", name: "노을재캠핑장", meta: "캠핑·펜션 · 괴산군 · 약 3.1km" },
];

type ManageKey = "revenue" | "promotion" | "reservation";

const MANAGE_TILES: {
  key: ManageKey;
  title: string;
  sub: string;
  icon: typeof Package;
}[] = [
  { key: "revenue", title: "매출관리", sub: "매장 지표·정산", icon: BarChart3 },
  { key: "promotion", title: "프로모션관리", sub: "쿠폰 만들기·처리", icon: Ticket },
  { key: "reservation", title: "예약관리", sub: "예약·캘린더", icon: Calendar },
];

function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#F0F0F0] bg-white/95 px-4 backdrop-blur-xl">
      <button
        onClick={onBack}
        aria-label="뒤로"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[#525252] transition-colors hover:bg-[#F5F5F5]"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <span className="text-[15px] font-semibold text-[#0A0A0A]">{title}</span>
      <div className="w-9" />
    </header>
  );
}

// ---------- 판매관리: 상품관리 + 주문관리 하위 ----------

const DEMO_PRODUCTS = [
  { id: "pr1", name: "노을 오토캠핑 A구역", price: "₩55,000", status: "판매중" },
  { id: "pr2", name: "숲속 글램핑 디럭스", price: "₩120,000", status: "판매중" },
  { id: "pr3", name: "장작 세트 (추가상품)", price: "₩12,000", status: "품절" },
];

const DEMO_ORDERS = [
  { id: "o1", buyer: "김**", item: "노을 오토캠핑 A구역", when: "오늘 14:20", state: "결제완료" as const },
  { id: "o2", buyer: "이**", item: "숲속 글램핑 디럭스", when: "어제 19:03", state: "이용완료" as const },
  { id: "o3", buyer: "박**", item: "장작 세트", when: "08.02", state: "취소" as const },
];

type ShipState = "배송준비" | "배송중" | "배송완료";

const DEMO_SHIPMENTS: {
  id: string;
  buyer: string;
  item: string;
  address: string;
  courier: string;
  tracking: string;
  state: ShipState;
}[] = [
  {
    id: "s1",
    buyer: "김**",
    item: "장작 세트 (추가상품)",
    address: "서울 성동구 왕십리로 ***",
    courier: "CJ대한통운",
    tracking: "6412 8830 21**",
    state: "배송준비",
  },
  {
    id: "s2",
    buyer: "이**",
    item: "노을재 감성 랜턴",
    address: "경기 성남시 분당구 ***",
    courier: "우체국택배",
    tracking: "1902 5567 43**",
    state: "배송중",
  },
  {
    id: "s3",
    buyer: "박**",
    item: "캠핑 원두 드립백 20p",
    address: "부산 해운대구 ***",
    courier: "롯데택배",
    tracking: "3388 1120 90**",
    state: "배송완료",
  },
];

export function SalesManagementPage({ onBack }: { onBack?: () => void }) {
  const [tab, setTab] = useState<"product" | "order" | "shipping">("product");

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <TopBar title="판매관리" onBack={onBack ?? (() => {})} />

      {/* 하위 탭: 상품관리 / 주문관리 */}
      <div className="sticky top-14 z-20 flex border-b border-[#EDEDED] bg-white px-5">
        {[
          { id: "product" as const, label: "상품관리" },
          { id: "order" as const, label: "주문관리" },
          { id: "shipping" as const, label: "배송관리" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="relative flex-1 py-3.5 text-[14px] font-semibold transition-colors"
            style={{ color: tab === t.id ? "#0A0A0A" : "#A3A3A3" }}
          >
            {t.label}
            {tab === t.id && (
              <span
                className="absolute bottom-0 left-1/2 h-[2px] w-10 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: ACCENT }}
              />
            )}
          </button>
        ))}
      </div>

      <main className="px-5 py-5">
        {tab === "shipping" ? (
          <ShippingManagement />
        ) : tab === "product" ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[13px] text-[#525252]">
                총 <b className="font-bold text-[#0A0A0A]">{DEMO_PRODUCTS.length}</b>개 상품
              </span>
              <button
                className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                <Tag className="h-3.5 w-3.5" strokeWidth={2.5} />
                상품 등록
              </button>
            </div>
            <div className="space-y-2.5">
              {DEMO_PRODUCTS.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-2xl border border-[#EDEDED] bg-white p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#0A0A0A]">{p.name}</p>
                    <p className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color: ACCENT }}>
                      {p.price}
                    </p>
                  </div>
                  <span
                    className="ml-3 shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={
                      p.status === "판매중"
                        ? { backgroundColor: `${ACCENT}14`, color: ACCENT }
                        : { backgroundColor: "#F1F1F2", color: "#8A8A8A" }
                    }
                  >
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" strokeWidth={2.25} style={{ color: ACCENT }} />
              <span className="text-[14px] font-bold text-[#0A0A0A]">내 주문관리</span>
              <span className="ml-auto text-[13px] text-[#525252]">
                총 <b className="font-bold text-[#0A0A0A]">{DEMO_ORDERS.length}</b>건
              </span>
            </div>
            <div className="space-y-2.5">
              {DEMO_ORDERS.map((o) => (
                <div key={o.id} className="rounded-2xl border border-[#EDEDED] bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[#0A0A0A]">{o.buyer}</span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                      style={
                        o.state === "결제완료"
                          ? { backgroundColor: `${ACCENT}14`, color: ACCENT }
                          : o.state === "이용완료"
                          ? { backgroundColor: "#ECFDF3", color: "#16A34A" }
                          : { backgroundColor: "#FEF2F2", color: "#DC2626" }
                      }
                    >
                      {o.state}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-[#525252]">{o.item}</p>
                  <p className="mt-1 flex items-center gap-1 text-[11.5px] text-[#8A8A8A]">
                    <Clock className="h-3 w-3" strokeWidth={2} />
                    {o.when}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- 배송관리: 주문 배송 상태 추적 ----------

const SHIP_STATES: ShipState[] = ["배송준비", "배송중", "배송완료"];

function shipStyle(state: ShipState) {
  if (state === "배송준비") return { backgroundColor: "#FFF7ED", color: "#EA580C" };
  if (state === "배송중") return { backgroundColor: `${ACCENT}14`, color: ACCENT };
  return { backgroundColor: "#ECFDF3", color: "#16A34A" };
}

function ShippingManagement() {
  const [filter, setFilter] = useState<ShipState | "전체">("전체");

  const list = filter === "전체" ? DEMO_SHIPMENTS : DEMO_SHIPMENTS.filter((s) => s.state === filter);
  const counts = SHIP_STATES.map((s) => ({
    state: s,
    count: DEMO_SHIPMENTS.filter((x) => x.state === s).length,
  }));

  return (
    <div>
      {/* 상태 요약 */}
      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {counts.map(({ state, count }) => {
          const Icon = state === "배송준비" ? Package : state === "배송중" ? Truck : PackageCheck;
          return (
            <button
              key={state}
              onClick={() => setFilter(state)}
              className="rounded-2xl border bg-white p-3 text-left transition-colors"
              style={{ borderColor: filter === state ? ACCENT : "#EDEDED" }}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} style={shipStyle(state)} />
              <p className="mt-2 text-[18px] font-extrabold tabular-nums text-[#0A0A0A]">{count}</p>
              <p className="text-[11.5px] text-[#8A8A8A]">{state}</p>
            </button>
          );
        })}
      </div>

      {/* 필터 칩 */}
      <div className="mb-3 flex items-center gap-2">
        {(["전체", ...SHIP_STATES] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={
              filter === f
                ? { backgroundColor: "#0A0A0A", color: "#fff" }
                : { backgroundColor: "#F1F1F2", color: "#525252" }
            }
          >
            {f}
          </button>
        ))}
      </div>

      {/* 배송 목록 */}
      <div className="space-y-2.5">
        {list.map((s) => (
          <div key={s.id} className="rounded-2xl border border-[#EDEDED] bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#0A0A0A]">{s.buyer}</span>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={shipStyle(s.state)}>
                {s.state}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[#525252]">{s.item}</p>
            <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-[#8A8A8A]">
              <MapPin className="h-3 w-3 flex-none" strokeWidth={2} />
              {s.address}
            </p>
            <div className="mt-2.5 flex items-center justify-between border-t border-[#F5F5F5] pt-2.5">
              <span className="flex items-center gap-1 text-[12px] text-[#525252]">
                <Truck className="h-3.5 w-3.5" strokeWidth={2} style={{ color: ACCENT }} />
                {s.courier} · {s.tracking}
              </span>
              <button
                className="rounded-full px-3 py-1.5 text-[11.5px] font-bold"
                style={
                  s.state === "배송완료"
                    ? { backgroundColor: "#F1F1F2", color: "#8A8A8A" }
                    : { backgroundColor: ACCENT, color: "#fff" }
                }
              >
                {s.state === "배송준비" ? "송장 등록" : s.state === "배송중" ? "배송 추적" : "완료됨"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 매출/프로모션/예약: 기존 화면 재사용 ----------

function ReusedScreen({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <TopBar title={title} onBack={onBack} />
      {children}
    </div>
  );
}

// ---------- 메인 허브 ----------

export function StoreHubPage({
  store = DEMO_STORE,
  onBack,
}: {
  store?: StoreHubData;
  onBack?: () => void;
}) {
  const [sub, setSub] = useState<ManageKey | null>(null);
  const [copied, setCopied] = useState(false);

  const link = `drop.how/${store.slug}`;

  const copyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(link).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (sub === "revenue")
    return (
      <ReusedScreen title="매출관리" onBack={() => setSub(null)}>
        <PartnerDashboardPageDemo />
      </ReusedScreen>
    );
  if (sub === "promotion")
    return (
      <ReusedScreen title="프로모션관리" onBack={() => setSub(null)}>
        <MyCouponsPageDemo />
      </ReusedScreen>
    );
  if (sub === "reservation")
    return (
      <ReusedScreen title="예약관리" onBack={() => setSub(null)}>
        <ReservationCalendarPageDemo />
      </ReusedScreen>
    );

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-10">
      <TopBar title="내 매장" onBack={onBack ?? (() => {})} />

      <main className="px-5 pt-4">
        {/* 내 매장 명함 */}
        <section className="rounded-3xl border border-[#ECECEC] bg-white p-5 [box-shadow:0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <div className="flex items-start gap-3.5">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[20px] font-bold text-white"
              style={{ backgroundColor: "#0A0A0A" }}
            >
              {store.name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h2 className="truncate text-[18px] font-bold text-[#0A0A0A]">{store.name}</h2>
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ backgroundColor: ACCENT }}
                >
                  BIZ
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-[#6E6E6E]">내 매장 명함</p>
            </div>
            <button
              onClick={copyLink}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold text-white"
              style={{ backgroundColor: ACCENT }}
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={2.5} />
              명함 공유
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[#F0F0F0] pt-4">
            <InfoRow label="업종" value={store.category} />
            <InfoRow label="구독" value={`${store.subscribers}명`} />
            <div className="col-span-2">
              <InfoRow label="지역" value={store.region} />
            </div>
            <div className="col-span-2">
              <InfoRow label="링크" value={link} accent />
            </div>
          </div>
        </section>

        {/* 진행 중 혜택 */}
        <SectionTitle icon={Sparkles} title="진행 중 혜택" />
        <div className="space-y-2.5">
          {DEMO_BENEFITS.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-4"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
              >
                {b.kind === "cash" ? (
                  <Sparkles className="h-4 w-4" strokeWidth={2.25} />
                ) : (
                  <Ticket className="h-4 w-4" strokeWidth={2.25} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#0A0A0A]">{b.title}</p>
                <p className="mt-0.5 text-[12px] text-[#8A8A8A]">{b.meta}</p>
              </div>
            </div>
          ))}
          <button
            className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[#D4D4D4] py-3 text-[13px] font-semibold text-[#8A8A8A]"
            disabled
          >
            공동 혜택 만들기 · 준비 중
          </button>
        </div>

        {/* 내 가게 링크 */}
        <SectionTitle icon={Link2} title="내 가게 링크" />
        <div className="flex items-center gap-2 rounded-2xl border border-[#ECECEC] bg-white p-3.5">
          <Link2 className="h-4 w-4 shrink-0 text-[#8A8A8A]" strokeWidth={2.25} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#0A0A0A]">{link}</span>
          <button
            onClick={copyLink}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold transition-colors"
            style={{ backgroundColor: copied ? "#ECFDF3" : `${ACCENT}12`, color: copied ? "#16A34A" : ACCENT }}
          >
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {copied ? "복사됨" : "복사"}
          </button>
        </div>

        {/* 내 제휴 파트너 */}
        <SectionTitle icon={Users} title={`내 제휴 파트너 ${DEMO_PARTNERS.length}`} />
        <div className="space-y-2.5">
          {DEMO_PARTNERS.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-[#ECECEC] bg-white p-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F1F1F2] text-[15px] font-bold text-[#525252]">
                {p.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[#0A0A0A]">{p.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-[#8A8A8A]">{p.meta}</p>
              </div>
              <button className="shrink-0 rounded-full border border-[#E5E5E5] px-3 py-1.5 text-[12px] font-semibold text-[#525252] transition-colors hover:bg-[#F5F5F5]">
                제휴 해제
              </button>
            </div>
          ))}
        </div>

        {/* 관리 그리드 */}
        <SectionTitle icon={Store} title="매장 관리" />
        <div className="grid grid-cols-2 gap-3">
          {MANAGE_TILES.map((t) => (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              className="group flex flex-col items-start rounded-2xl border border-[#ECECEC] bg-white p-4 text-left transition-all hover:border-[#D4D4D4] active:scale-[0.98]"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors"
                style={{ backgroundColor: `${ACCENT}12`, color: ACCENT }}
              >
                <t.icon className="h-[22px] w-[22px]" strokeWidth={2} />
              </span>
              <span className="mt-3 flex w-full items-center justify-between">
                <span className="text-[15px] font-bold text-[#0A0A0A]">{t.title}</span>
                <ChevronRight className="h-4 w-4 text-[#C4C4C4] transition-transform group-hover:translate-x-0.5" />
              </span>
              <span className="mt-0.5 text-[12px] text-[#8A8A8A]">{t.sub}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-9 shrink-0 text-[12px] font-semibold text-[#A3A3A3]">{label}</span>
      <span
        className="min-w-0 flex-1 truncate text-[13.5px] font-medium"
        style={{ color: accent ? ACCENT : "#0A0A0A" }}
      >
        {value}
      </span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Store; title: string }) {
  return (
    <div className="mb-2.5 mt-6 flex items-center gap-1.5">
      <Icon className="h-4 w-4 text-[#525252]" strokeWidth={2.25} />
      <h3 className="text-[14px] font-bold text-[#0A0A0A]">{title}</h3>
    </div>
  );
}

export function StoreHubPageDemo() {
  return <StoreHubPage onBack={() => {}} />;
}
