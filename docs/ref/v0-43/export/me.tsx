import { useState, useEffect, type ComponentType, type ReactNode } from "react";
import {
  Building2,
  Package,
  Wallet,
  Heart,
  LayoutGrid,
  Settings,
  LogOut,
  ChevronRight,
  ChevronDown,
  X,
  Ticket,
  TicketPercent,
  TrendingUp,
  Diamond,
  Bell,
  ShieldCheck,
  HelpCircle,
  Pencil,
  Coins,
  Plus,
  Check,
  Minus,
  RotateCcw,
} from "lucide-react";
// 하단 탭바의 프로필(내 페이지) 마크 — 외부 컴포넌트 대신 인라인 SVG (동일 아이콘)
function MeMark({ className = "h-[22px] w-[22px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.9" fill="#0F172A" />
      <path d="M4.6 19.4a7.4 7.4 0 0 1 14.8 0 1.3 1.3 0 0 1-1.3 1.3H5.9a1.3 1.3 0 0 1-1.3-1.3Z" fill="#0F172A" />
    </svg>
  );
}

const CASH_PRESETS = [5000, 10000, 30000];
const won = (n: number) => `${n.toLocaleString()}원`;

// ─────────────────────────────────────────────────────────────
// Types (TODO 데이터/핸들러 — 전부 props)
// ─────────────────────────────────────────────────────────────

type Coupon = {
  id: string;
  title: string;
  storeName: string;
  expiresAt: string;
  status: "available" | "done" | "expired";
};

type CashTxn = {
  id: string;
  kind: "charge" | "use" | "refund";
  amount: number; // 양수: 적립(+), 음수: 차감(-)
  at: string;
  note?: string;
};

type DropyTxn = {
  id: string;
  kind: "earn" | "spend";
  amount: number; // 양수: 적립(+), 음수: 사용(-)
  at: string;
  note?: string;
};

type Maker = {
  id: string;
  name: string;
  subtitle?: string;
};

type MyDrop = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  views: number;
  shares: number;
  conversions: number;
};

// ─────────────────────────────────────────────────────────────
// 공통 섹션 래퍼 (제목 + 우측 액션 슬롯)
// ─────────────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8EDF3] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)]">
      <div className="mb-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-[#EEF3FE]">
            <Icon className="size-4 text-[#2563EB]" strokeWidth={2} />
          </span>
          <h3 className="text-[14px] font-bold tracking-[-0.01em] text-[#0F172A]">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// 네비 카드 (내 매장 / 내 주문)
// ─────────────────────────────────────────────────────────────

function NavCard({
  icon: Icon,
  title,
  subtitle,
  onClick,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-[#E8EDF3] bg-white p-3.5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.05),0_4px_12px_rgba(15,23,42,0.04)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#CBD5E1] hover:shadow-[0_10px_24px_rgba(15,23,42,0.09)]"
    >
      <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#0F172A] transition-colors group-hover:bg-[#EEF3FE] group-hover:text-[#2563EB]">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold text-[#0F172A]">{title}</div>
        <div className="truncate text-[11px] text-[#94A3B8]">{subtitle}</div>
      </div>
      <ChevronRight className="size-4 flex-shrink-0 text-[#CBD5E1]" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// 쿠폰 티켓 카드 (티켓 노치 + 점선)
// ─────────────────────────────────────────────────────────────

function CouponTicketCard({ coupon }: { coupon: Coupon }) {
  const isActive = coupon.status === "available";
  return (
    <li
      className={`relative flex overflow-hidden rounded-xl border ${
        isActive ? "border-[#EAE2D2] bg-[#FBF8F2]" : "border-[#E2E8F0] bg-[#F8FAFC]"
      }`}
    >
      {/* 좌측 스텁 (옅은 틴트 티켓 머리) */}
      <div
        className={`flex w-14 flex-shrink-0 items-center justify-center border-r border-dashed ${
          isActive ? "border-[#E0D6C2] bg-[#F3ECDD]" : "border-[#E2E8F0] bg-[#EFF1F4]"
        }`}
      >
        <TicketPercent className={`size-[22px] ${isActive ? "text-[#B07D2B]" : "text-[#94A3B8]"}`} strokeWidth={2} />
      </div>
      {/* 노치 (위/아래 반원) */}
      <span
        className={`absolute left-[48px] top-[-6px] size-3 rounded-full border bg-white ${
          isActive ? "border-[#EAE2D2]" : "border-[#E2E8F0]"
        }`}
      />
      <span
        className={`absolute left-[48px] bottom-[-6px] size-3 rounded-full border bg-white ${
          isActive ? "border-[#EAE2D2]" : "border-[#E2E8F0]"
        }`}
      />
      {/* 본문 */}
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className={`truncate text-[13px] font-bold ${isActive ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
          {coupon.title}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-[#78716C]">{coupon.storeName}</div>
        <div className={`mt-1 text-[10px] ${isActive ? "text-[#A07A38]" : "text-[#94A3B8]"}`}>{coupon.expiresAt}</div>
      </div>
      {/* 우측: 사용 버튼 or 상태 칩 */}
      <div className="flex items-center pr-2.5">
        {isActive ? (
          <button className="rounded-lg bg-[#0F172A] px-3 py-1.5 text-[11px] font-bold text-white transition-colors duration-150 hover:bg-[#1E293B] active:scale-95">
            사용
          </button>
        ) : (
          <span className="rounded-md border border-[#E2E8F0] bg-white px-2 py-1 text-[10px] font-medium text-[#94A3B8]">
            {coupon.status === "done" ? "사용 완료" : "기간 만료"}
          </span>
        )}
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────
// 구독 매장 row
// ─────────────────────────────────────────────────────────────

function MakerRow({ maker }: { maker: Maker }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="relative flex size-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1E293B] to-[#475569] text-[14px] font-bold text-white ring-1 ring-inset ring-white/10">
        {maker.name?.[0] ?? "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-[#0F172A]">{maker.name}</div>
        {maker.subtitle && <div className="mt-0.5 truncate text-[11.5px] text-[#94A3B8]">{maker.subtitle}</div>}
      </div>
      <button className="flex items-center gap-1 rounded-full bg-[#EEF3FE] px-3 py-1.5 text-[11px] font-bold text-[#2563EB] transition-colors duration-150 hover:bg-[#DEE9FD] active:scale-95">
        <Heart className="size-3 fill-current" strokeWidth={2} />
        구독중
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 캐시 이용내역 row
// ─────────────────────────────────────────────────────────────

function CashTxnRow({ txn }: { txn: CashTxn }) {
  const positive = txn.amount > 0;
  const meta =
    txn.kind === "charge"
      ? { label: "충전", Icon: Plus, tint: "#059669", bg: "#ECFDF5" }
      : txn.kind === "refund"
        ? { label: "결제취소", Icon: RotateCcw, tint: "#B45309", bg: "#FEF3C7" }
        : { label: "사용", Icon: Minus, tint: "#475569", bg: "#F1F5F9" };
  const { Icon } = meta;
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
        <Icon className="size-4" style={{ color: meta.tint }} strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-[#0F172A]">{meta.label}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-[#94A3B8]">{txn.at}</div>
      </div>
      <div className="flex flex-shrink-0 items-baseline gap-0.5">
        <span className={`text-[14px] font-bold tabular-nums ${positive ? "text-[#059669]" : "text-[#0F172A]"}`}>
          {positive ? "+" : "-"}
          {Math.abs(txn.amount).toLocaleString()}
        </span>
        <span className="text-[11px] font-semibold text-[#94A3B8]">cash</span>
      </div>
    </div>
  );
}

// 드로피 적립·사용 내역 row
function DropyTxnRow({ txn }: { txn: DropyTxn }) {
  const positive = txn.amount > 0;
  const meta = positive
    ? { Icon: Plus, tint: "#2563EB", bg: "#EEF3FE" }
    : { Icon: Minus, tint: "#475569", bg: "#F1F5F9" };
  const { Icon } = meta;
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-8 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: meta.bg }}>
        <Icon className="size-4" style={{ color: meta.tint }} strokeWidth={2.5} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-[#0F172A]">{txn.note ?? (positive ? "적립" : "사용")}</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-[#94A3B8]">{txn.at}</div>
      </div>
      <div className="flex flex-shrink-0 items-baseline gap-0.5">
        <span className={`text-[14px] font-bold tabular-nums ${positive ? "text-[#2563EB]" : "text-[#0F172A]"}`}>
          {positive ? "+" : "-"}
          {Math.abs(txn.amount).toLocaleString()}
        </span>
        <span className="text-[11px] font-semibold text-[#94A3B8]">dropy</span>
      </div>
    </div>
  );
}

// 재사용 내역 아코디언 — 캐시/드로피 공통(탭하면 열림/닫힘, 6건 초과 시 더보기)
function HistoryAccordion({
  icon: Icon,
  title,
  subtitle,
  count,
  children,
}: {
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  count: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[#F8FAFC]"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-[#F1F5F9]">
          <Icon className="size-[17px] text-[#475569]" strokeWidth={2.25} />
        </span>
        <span className="flex-1">
          <span className="block text-[14px] font-bold text-[#0F172A]">{title}</span>
          <span className="mt-0.5 block text-[11.5px] font-medium text-[#94A3B8]">{subtitle}</span>
        </span>
        <ChevronDown
          className="size-5 flex-shrink-0 text-[#94A3B8] transition-transform duration-300"
          strokeWidth={2.25}
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>
      <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <div className="border-t border-[#F1F5F9] px-4 pb-3">
            {count > 0 ? children : <p className="py-3 text-[13px] text-[#94A3B8]">내역이 없어요</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 캐시 패널 — 잔액 + 충전(프리셋/직접입력) + 동의 + 결제 + 이용내역
// ─────────────────────────────────────────────────────────────

function CashPanel({ balance, txns }: { balance: number; txns: CashTxn[] }) {
  const [chargeOpen, setChargeOpen] = useState(false);
  const [selected, setSelected] = useState<number | "custom">(5000);
  const [custom, setCustom] = useState("");
  const [agree, setAgree] = useState({ pay: false, terms: false, privacy: false });
  const [showAll, setShowAll] = useState(false);

  const amount = selected === "custom" ? Number(custom.replace(/[^0-9]/g, "")) || 0 : selected;
  const allAgreed = agree.pay && agree.terms && agree.privacy;
  const canPay = amount >= 1000 && allAgreed;

  const toggleAll = () => {
    const next = !allAgreed;
    setAgree({ pay: next, terms: next, privacy: next });
  };

  const consents: { key: keyof typeof agree; label: string }[] = [
    { key: "pay", label: "[필수] 구매조건 확인 및 결제진행 동의" },
    { key: "terms", label: "[필수] 캐시 이용약관 (환급 불가)" },
    { key: "privacy", label: "[필수] 개인정보 수집·이용 동의" },
  ];

  const visibleTxns = showAll ? txns : txns.slice(0, 6);

  return (
    <div className="flex flex-col gap-4">
      {/* 잔액 카드 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.28)]">
        <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-white/[0.06] blur-2xl" />
        <div className="relative flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/20 backdrop-blur-sm">
            <Coins className="size-[17px] text-white" strokeWidth={2.25} />
          </span>
          <span className="text-[12px] font-semibold tracking-[0.02em] text-white/70">내 캐시</span>
        </div>
        <div className="relative mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-[32px] font-bold leading-none tabular-nums tracking-[-0.02em] text-white">
              {balance.toLocaleString()}
            </span>
            <span className="text-[14px] font-semibold text-white/70">cash</span>
          </div>
          <span className="text-[11px] font-medium tabular-nums text-white/50">유상 {balance.toLocaleString()} · 무상 0</span>
        </div>
      </div>

      {/* 캐시 충전 — 아코디언 (탭하면 열림/닫힘) */}
      <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
        <button
          onClick={() => setChargeOpen((v) => !v)}
          aria-expanded={chargeOpen}
          className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-[#F8FAFC]"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#EEF3FE]">
            <Plus className="size-[18px] text-[#2563EB]" strokeWidth={2.5} />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-bold text-[#0F172A]">캐시 충전</span>
            <span className="mt-0.5 block text-[11.5px] font-medium text-[#94A3B8]">금액을 골라 바로 충전하세요</span>
          </span>
          <ChevronDown
            className="size-5 flex-shrink-0 text-[#94A3B8] transition-transform duration-300"
            strokeWidth={2.25}
            style={{ transform: chargeOpen ? "rotate(180deg)" : "none" }}
          />
        </button>

        <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: chargeOpen ? "1fr" : "0fr" }}>
          <div className="overflow-hidden">
            <div className="flex flex-col gap-3 border-t border-[#F1F5F9] p-4">
              {/* 충전 금액 선택 */}
              <div className="grid grid-cols-2 gap-2">
                {CASH_PRESETS.map((p) => {
                  const active = selected === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setSelected(p)}
                      className={`flex flex-col items-center rounded-xl border py-3 text-center transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? "border-[#2563EB] bg-[#EEF3FE] ring-1 ring-inset ring-[#2563EB]"
                          : "border-[#E8EDF3] bg-white hover:border-[#CBD5E1]"
                      }`}
                    >
                      <span className="text-[17px] font-bold tabular-nums text-[#0F172A]">{won(p)}</span>
                      <span className={`mt-1 text-[10.5px] font-semibold ${active ? "text-[#2563EB]" : "text-[#94A3B8]"}`}>cash {p.toLocaleString()}</span>
                    </button>
                  );
                })}
                {/* 직접입력 */}
                <button
                  onClick={() => setSelected("custom")}
                  className={`flex flex-col items-center rounded-xl border py-3 text-center transition-all duration-150 active:scale-[0.98] ${
                    selected === "custom"
                      ? "border-[#2563EB] bg-[#EEF3FE] ring-1 ring-inset ring-[#2563EB]"
                      : "border-[#E8EDF3] bg-white hover:border-[#CBD5E1]"
                  }`}
                >
                  {selected === "custom" ? (
                    <span className="flex items-baseline justify-center gap-0.5">
                      <input
                        autoFocus
                        inputMode="numeric"
                        value={custom}
                        onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
                        placeholder="0"
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 min-w-0 bg-transparent text-center text-[17px] font-bold tabular-nums text-[#0F172A] outline-none placeholder:text-[#CBD5E1]"
                      />
                      <span className="text-[14px] font-bold text-[#0F172A]">원</span>
                    </span>
                  ) : (
                    <span className="text-[17px] font-bold text-[#0F172A]">직접입력</span>
                  )}
                  <span className={`mt-1 text-[10.5px] font-semibold ${selected === "custom" ? "text-[#2563EB]" : "text-[#94A3B8]"}`}>최소 1,000원</span>
                </button>
              </div>

              {/* 약관 동의 */}
              <div className="rounded-xl bg-[#F8FAFC] p-3">
                <button onClick={toggleAll} className="flex w-full items-center gap-2.5 text-left">
                  <span
                    className={`flex size-5 items-center justify-center rounded-md transition-colors ${
                      allAgreed ? "bg-[#2563EB]" : "border-2 border-[#CBD5E1] bg-white"
                    }`}
                  >
                    {allAgreed && <Check className="size-3.5 text-white" strokeWidth={3} />}
                  </span>
                  <span className="text-[13px] font-bold text-[#0F172A]">전체 동의</span>
                </button>
                <div className="mt-2.5 flex flex-col gap-2 border-t border-[#EAEEF3] pt-2.5">
                  {consents.map((c) => {
                    const checked = agree[c.key];
                    return (
                      <button
                        key={c.key}
                        onClick={() => setAgree((a) => ({ ...a, [c.key]: !a[c.key] }))}
                        className="flex items-center gap-2.5 text-left"
                      >
                        <span className={`flex size-4 flex-shrink-0 items-center justify-center rounded transition-colors ${checked ? "text-[#2563EB]" : "text-[#CBD5E1]"}`}>
                          <Check className="size-4" strokeWidth={3} />
                        </span>
                        <span className="text-[12px] font-medium text-[#475569]">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 결제 버튼 */}
              <button
                disabled={!canPay}
                className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3.5 text-[14.5px] font-bold transition-all duration-150 ${
                  canPay
                    ? "bg-[#2563EB] text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] active:scale-[0.99]"
                    : "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
                }`}
              >
                {amount >= 1000 ? `${won(amount)} 결제하고 충전` : "충전 금액을 선택하세요"}
              </button>
              <p className="px-0.5 text-[11px] leading-relaxed text-[#94A3B8]">
                본 캐시는 링크드롭 콘텐츠 이용 전용이며 현금 환급되지 않습니다. 결제 취소 시에만 해당 금액이 차감·취소됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 이용 내역 — 재사용 아코디언 */}
      <HistoryAccordion icon={RotateCcw} title="이용 내역" subtitle={`충전 · 사용 · 결제취소 ${txns.length}건`} count={txns.length}>
        <div className="divide-y divide-[#F1F5F9]">
          {visibleTxns.map((t) => (
            <CashTxnRow key={t.id} txn={t} />
          ))}
        </div>
        {txns.length > 6 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 w-full rounded-xl bg-[#F1F5F9] py-2.5 text-[12.5px] font-semibold text-[#475569] transition-colors hover:bg-[#E8EDF3]"
          >
            {showAll ? "접기" : `전체 ${txns.length}건 보기`}
          </button>
        )}
      </HistoryAccordion>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 설정 시트 — 상단 설정 버��에서 열리는 바텀시트
// ─────────────────────────────────────────────────────────────

function SettingsSheet({ open, onClose, onLogout }: { open: boolean; onClose: () => void; onLogout?: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // SSR 안전: 마운트 전에는 렌더하지 않음. 바텀시트/포털 대신 설정 버튼 아래 인라인 아코디언으로 펼침.
  if (!mounted) return null;

  const rows = [
    { icon: Bell, label: "알림 설정" },
    { icon: ShieldCheck, label: "개인정보 보호" },
    { icon: HelpCircle, label: "도움말 · 문의" },
  ];

  return (
    <div
      className="grid transition-all duration-300 ease-out"
      style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      aria-hidden={!open}
    >
      <div className="overflow-hidden">
      <div className="mt-3 rounded-3xl bg-white px-5 pb-6 pt-4 shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-[#EAEEF3]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[17px] font-bold tracking-[-0.01em] text-[#0F172A]">설정</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex size-8 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <X className="size-5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="flex flex-col">
          {rows.map((row) => (
            <button
              key={row.label}
              className="flex min-h-[52px] items-center justify-between rounded-xl px-1 transition-colors duration-150 hover:bg-[#F1F5F9]"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-[#F1F5F9]">
                  <row.icon className="size-[18px] text-[#475569]" strokeWidth={2} />
                </span>
                <span className="text-[14px] font-medium text-[#0F172A]">{row.label}</span>
              </span>
              <ChevronRight className="size-4 text-[#CBD5E1]" />
            </button>
          ))}
        </div>

        <button
          onClick={onLogout}
          className="mt-3 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[#EAEEF3] bg-white text-[#64748B] transition-colors duration-150 hover:border-[#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#0F172A] active:scale-[0.99]"
        >
          <LogOut className="size-[17px]" strokeWidth={2.25} />
          <span className="text-[13px] font-bold tracking-[0.06em]">LOGOUT</span>
        </button>
        <p className="mt-4 text-center text-[11px] text-[#CBD5E1]">LinkDrop v1.0.0</p>
      </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MeScreen
// ─────────────────────────────────────────────────────────────

// ── 프리뷰용 mock 기본값 (실제 앱에서는 props로 주입) ──────────
const MOCK_COUPONS: Coupon[] = [
  { id: "c1", title: "아메리카노 1+1", storeName: "포레스트 커피", expiresAt: "2026-07-31까지", status: "available" },
  { id: "c2", title: "막걸리 1병 무료", storeName: "노을재 막걸리", expiresAt: "2026-06-15까지", status: "available" },
  { id: "c3", title: "사이드 메뉴 증정", storeName: "한끼식당", expiresAt: "사용 완료", status: "done" },
];

const MOCK_MAKERS: Maker[] = [
  { id: "m1", name: "포레스트 커피", subtitle: "양평 · 카페" },
  { id: "m2", name: "산지직송 농부장터", subtitle: "충주 · 농수산물" },
];

const MOCK_MY_DROPS: MyDrop[] = [
  { id: "d1", title: "햇사과 5kg 산지직송", thumbnailUrl: "https://picsum.photos/seed/farm/120/120", views: 1247, shares: 89, conversions: 37 },
  { id: "d2", title: "평일 점심 1만원 쿠폰", thumbnailUrl: "https://picsum.photos/seed/lunch/120/120", views: 832, shares: 54, conversions: 21 },
];

const MOCK_DROPY_TXNS: DropyTxn[] = [
  { id: "p1", kind: "earn", amount: 120, at: "2026.07.04 09:12", note: "카드 공유 리워드" },
  { id: "p2", kind: "spend", amount: -500, at: "2026.07.03 18:40", note: "쿠폰 교환" },
  { id: "p3", kind: "earn", amount: 50, at: "2026.07.03 12:05", note: "출석 적립" },
  { id: "p4", kind: "earn", amount: 300, at: "2026.07.02 20:22", note: "친구 초대" },
  { id: "p5", kind: "spend", amount: -200, at: "2026.07.01 11:30", note: "카드 부스트" },
  { id: "p6", kind: "earn", amount: 80, at: "2026.06.30 15:48", note: "카드 공유 리워드" },
  { id: "p7", kind: "earn", amount: 90, at: "2026.06.29 10:14", note: "카드 공유 리워드" },
];

const MOCK_CASH_TXNS: CashTxn[] = [
  { id: "t1", kind: "refund", amount: -500, at: "2026.07.04 08:24" },
  { id: "t2", kind: "charge", amount: 1000, at: "2026.07.04 08:24" },
  { id: "t3", kind: "refund", amount: 1000, at: "2026.07.04 08:23" },
  { id: "t4", kind: "refund", amount: -1000, at: "2026.07.04 08:23" },
  { id: "t5", kind: "charge", amount: 1000, at: "2026.07.04 08:23" },
  { id: "t6", kind: "refund", amount: -600, at: "2026.07.04 08:22" },
  { id: "t7", kind: "use", amount: -400, at: "2026.07.04 08:22" },
  { id: "t8", kind: "charge", amount: 1000, at: "2026.07.04 08:22" },
  { id: "t9", kind: "use", amount: -1500, at: "2026.07.04 08:22" },
];

type MeScreenProps = {
  isBusiness?: boolean;
  // TODO: 전부 실제 데이터/핸들러로 교체
  profile?: { name: string; email: string };
  coupons?: Coupon[];
  dropyBalance?: number;
  dropyTxns?: DropyTxn[];
  cashBalance?: number;
  cashTxns?: CashTxn[];
  sentCount?: number;
  subscribedMakers?: Maker[];
  myDrops?: MyDrop[];
  onEditProfile?: () => void;
  onLogout?: () => void;
  onViewMyCards?: () => void;
};

export default function MeScreen({
  isBusiness = true,
  profile = { name: "Duke", email: "dukebiz01@gmail.com" }, // TODO: get_my_wallet/profiles
  coupons = MOCK_COUPONS, // TODO: get_my_wallet
  dropyBalance = 1240, // TODO: get_my_wallet
  dropyTxns = MOCK_DROPY_TXNS, // TODO: get_dropy_transactions
  cashBalance = 1500, // TODO: get_my_wallet
  cashTxns = MOCK_CASH_TXNS, // TODO: get_cash_transactions
  sentCount = 128, // TODO: get_my_shares
  subscribedMakers = MOCK_MAKERS, // TODO: maker_follows
  myDrops = MOCK_MY_DROPS, // TODO: get_my_drops
  onEditProfile,
  onLogout,
  onViewMyCards,
}: MeScreenProps) {
  type WalletTab = "cash" | "dropy" | "coupon";
  const [walletTab, setWalletTab] = useState<WalletTab>("cash");
  const [couponFilter, setCouponFilter] = useState<"available" | "done" | "expired">("available");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const filteredCoupons = coupons.filter((c) => c.status === couponFilter);
  const availableCount = coupons.filter((c) => c.status === "available").length;

  // 상단 3자산: 캐시 / 드로피 / 쿠폰
  const heroAssets: {
    key: WalletTab;
    label: string;
    value: string | number;
    accent: boolean;
  }[] = [
    { key: "cash", label: "캐시", value: cashBalance.toLocaleString(), accent: true },
    { key: "dropy", label: "드로피", value: dropyBalance.toLocaleString(), accent: false },
    { key: "coupon", label: "쿠폰", value: availableCount, accent: false },
  ];

  // 보조 스탯: 만든 카드 / 보낸 카드 / 구독
  const subStats = [
    { key: "made", label: "만든 카드", value: myDrops.length },
    { key: "sent", label: "보낸 카드", value: sentCount },
    { key: "sub", label: "구독", value: subscribedMakers.length },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FB] px-4 pb-24">
      <header className="flex items-center justify-between pb-4 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#F1F5F9]" aria-hidden="true">
            <MeMark className="h-[22px] w-[22px]" />
          </span>
          <h1 className="text-[20px] font-bold tracking-[-0.02em] text-[#0F172A]">내 페이지</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            className="flex size-9 items-center justify-center rounded-full bg-white text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-[#EAEEF3] transition-colors duration-150 hover:text-[#0F172A] active:scale-95"
            aria-label="알림"
          >
            <Bell className="size-[18px]" strokeWidth={2} />
          </button>
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded-full bg-white text-[#475569] shadow-[0_1px_2px_rgba(15,23,42,0.06)] ring-1 ring-inset ring-[#EAEEF3] transition-colors duration-150 hover:text-[#0F172A] active:scale-95"
            aria-label="설정"
            aria-expanded={settingsOpen}
          >
            <Settings className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* 설정: 오버레이 대신 헤더(설정 버튼) 아래 인라인 아코디언으로 펼침 */}
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} onLogout={onLogout} />

      <div className="flex flex-col gap-3">
        {/* ① 프로필 히어로 (잉크 카드 + 자산 요약) */}
        <section className="overflow-hidden rounded-3xl bg-[#0F172A] p-5 shadow-[0_12px_30px_rgba(15,23,42,0.22)]">
          <div className="flex items-center gap-3.5">
            <div className="flex size-14 flex-shrink-0 items-center justify-center rounded-full bg-white text-[20px] font-bold text-[#0F172A] ring-2 ring-white/15 ring-offset-2 ring-offset-[#0F172A]">
              {profile.name?.[0] ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[17px] font-bold text-white">
                  {profile.name || "이름을 등록해 보세요"}
                </span>
                {isBusiness && (
                  <span className="flex-shrink-0 rounded-full bg-[#2563EB] px-2 py-0.5 text-[10px] font-bold text-white">
                    비즈
                  </span>
                )}
              </div>
              <div className="mt-1 truncate text-[12.5px] text-[#CBD5E1]">{profile.email}</div>
            </div>
            <button
              onClick={onEditProfile}
              className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors duration-150 hover:bg-white/20 active:scale-95"
              aria-label="프로필 편집"
            >
              <Pencil className="size-4" strokeWidth={2} />
            </button>
          </div>

          {/* 자산 요약 스트립 (캐시/드로피/쿠폰) — 탭하면 해당 지갑 탭으로 */}
          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10">
            {heroAssets.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setWalletTab(s.key)}
                className={`flex flex-col items-center py-3.5 transition-colors duration-150 hover:bg-white/[0.06] active:bg-white/10 ${i > 0 ? "border-l border-white/10" : ""}`}
              >
                <span
                  className={`text-[20px] font-bold leading-none tabular-nums ${s.accent ? "text-[#60A5FA]" : "text-white"}`}
                >
                  {s.value}
                </span>
                <span className="mt-2 flex items-center gap-0.5 text-[11.5px] font-semibold tracking-wide text-[#B6C2D2]">
                  {s.label}
                  <ChevronRight className="size-3 text-[#7C8BA1]" strokeWidth={2.5} />
                </span>
              </button>
            ))}
          </div>

          {/* 보조 스탯 (만든 카드/보낸 카드/구독) */}
          <div className="mt-3 grid grid-cols-3">
            {subStats.map((s, i) => (
              <div key={s.key} className={`flex items-center justify-center gap-1.5 py-0.5 ${i > 0 ? "border-l border-white/10" : ""}`}>
                <span className="text-[13px] font-bold tabular-nums text-white">{s.value}</span>
                <span className="text-[11px] font-medium text-[#8A99AD]">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 내 매장(비즈) / 내 주문 */}
        <div className={`grid gap-3 ${isBusiness ? "grid-cols-2" : "grid-cols-1"}`}>
          {isBusiness && <NavCard icon={Building2} title="내 매장" subtitle="매장 관리·성과" /* TODO: /partner */ />}
          <NavCard icon={Package} title="내 주문" subtitle="주문·예약 내역" /* TODO: /me-orders */ />
        </div>

        {/* ② 내 지갑 (캐시/드로피/쿠폰 세그먼트) */}
        <SectionCard icon={Wallet} title="내 지갑">
          {/* 세그먼트 컨트롤 */}
          <div className="mb-4 flex rounded-xl bg-[#F1F5F9] p-1">
            {[
              { k: "cash", l: "캐시", n: undefined },
              { k: "dropy", l: "드로피", n: undefined },
              { k: "coupon", l: "쿠폰", n: availableCount },
            ].map((t) => {
              const active = walletTab === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => setWalletTab(t.k as WalletTab)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-semibold transition-all duration-150 ${
                    active ? "bg-white text-[#0F172A] shadow-[0_1px_3px_rgba(15,23,42,0.1)]" : "text-[#64748B]"
                  }`}
                >
                  {t.l}
                  {t.n !== undefined && t.n > 0 && (
                    <span
                      className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                        active ? "bg-[#2563EB] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                      }`}
                    >
                      {t.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {walletTab === "cash" ? (
            <CashPanel balance={cashBalance} txns={cashTxns} />
          ) : walletTab === "coupon" ? (
            <>
              {/* 필터칩 (활성 잉크 채움 → 또렷한 위계) */}
              <div className="mb-3 flex gap-1.5">
                {[
                  { k: "available", l: "사용 가능" },
                  { k: "done", l: "완료" },
                  { k: "expired", l: "만료" },
                ].map((c) => {
                  const active = couponFilter === c.k;
                  return (
                    <button
                      key={c.k}
                      onClick={() => setCouponFilter(c.k as "available" | "done" | "expired")}
                      className={`rounded-lg px-3 py-1.5 text-[11.5px] font-semibold transition-all duration-150 ${
                        active
                          ? "bg-[#0F172A] text-white shadow-[0_2px_6px_rgba(15,23,42,0.18)]"
                          : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E8EDF3]"
                      }`}
                    >
                      {c.l}
                    </button>
                  );
                })}
              </div>
              {/* 쿠폰 리스트 (티켓 카드) */}
              {filteredCoupons.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {filteredCoupons.map((c) => (
                    <CouponTicketCard key={c.id} coupon={c} />
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] px-4 py-7 text-center">
                  <Ticket className="mb-2 size-5 text-[#CBD5E1]" strokeWidth={2} />
                  <p className="text-[12.5px] font-medium text-[#94A3B8]">
                    {couponFilter === "available" ? "받은 쿠폰이 없어요" : "해당하는 쿠폰이 없어요"}
                  </p>
                </div>
              )}
            </>
          ) : (
            /* dropy 리워드 카드 (멤버십 카드 룩) */
            <div className="flex flex-col gap-3">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1D4ED8] via-[#2563EB] to-[#1E3A8A] p-4 shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
                {/* 광택 곡선 */}
                <div className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -bottom-16 -left-8 size-32 rounded-full bg-white/[0.07] blur-2xl" />
                {/* 상단: 칩 + 브랜드 */}
                <div className="relative flex items-start justify-between">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-inset ring-white/25 backdrop-blur-sm">
                    <Diamond className="size-[18px] text-white" strokeWidth={2.25} />
                  </span>
                  <span className="text-[11px] font-bold tracking-[0.08em] text-white/70">LINKDROP</span>
                </div>
                {/* 잔액 */}
                <div className="relative mt-5">
                  <div className="text-[11px] font-medium tracking-wide text-white/60">보유 DROPY</div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-[30px] font-bold leading-none tabular-nums text-white">
                      {dropyBalance.toLocaleString()}
                    </span>
                    <span className="text-[13px] font-semibold text-white/70">dropy</span>
                  </div>
                </div>
              </div>
              {/* 적립·사용 내역 — 재사용 아코디언 */}
              <HistoryAccordion
                icon={TrendingUp}
                title="적립·사용 내역"
                subtitle={`적립 · 사용 ${dropyTxns.length}건`}
                count={dropyTxns.length}
              >
                <div className="divide-y divide-[#F1F5F9]">
                  {dropyTxns.map((t) => (
                    <DropyTxnRow key={t.id} txn={t} />
                  ))}
                </div>
              </HistoryAccordion>
            </div>
          )}
        </SectionCard>

        {/* 구독한 매장 (아바타 row) */}
        <SectionCard
          icon={Heart}
          title="구독한 매장"
          action={
            subscribedMakers.length > 0 ? (
              <span className="text-[12px] font-semibold text-[#94A3B8]">{subscribedMakers.length}곳</span>
            ) : undefined
          }
        >
          {subscribedMakers.length > 0 ? (
            <div className="-my-3 divide-y divide-[#F1F5F9]">
              {subscribedMakers.map((m) => (
                <MakerRow key={m.id} maker={m} />
              ))}
            </div>
          ) : (
            <p className="py-1 text-[13px] text-[#94A3B8]">구독한 매장이 없어요</p>
          )}
        </SectionCard>

        {/* ④ 만든 카드 — 홈 내활동으로 이동 */}
        <button
          onClick={onViewMyCards}
          className="flex w-full items-center gap-3 rounded-2xl border border-[#EAEEF3] bg-white px-4 py-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors duration-150 hover:bg-[#F8FAFC] active:scale-[0.99]"
        >
          <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EEF3FE]">
            <LayoutGrid className="size-5 text-[#2563EB]" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold text-[#0F172A]">만든 카드</span>
              <span className="rounded-full bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-[#475569]">
                {myDrops.length}
              </span>
            </span>
            <span className="mt-0.5 block text-[11.5px] font-medium text-[#94A3B8]">홈 내 활동에서 성과를 관리하세요</span>
          </span>
          <ChevronRight className="size-5 flex-shrink-0 text-[#CBD5E1]" strokeWidth={2.25} />
        </button>

      </div>
    </div>
  );
}
