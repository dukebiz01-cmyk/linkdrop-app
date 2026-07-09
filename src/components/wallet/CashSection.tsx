// CASH-c4 — 내지갑 "cash" 섹션.
//   (a) 잔액 카드 "cash N"(영문 소문자 고정) + 유상/무상 소표기, 조회 실패 재시도.
//   (b) 충전 = 단건 결제(심사 요건): 상품형 3종 + 직접입력, 각 상품명·제공기간·금액 표시,
//       [필수] 구매조건 동의 체크(미체크 시 결제 비활성). 충전은 useHectoCharge(purpose:cash_charge) 재사용.
//   (c) 내역 = cash_ledger 본인 최근 20건(국문 라벨·부호·일시), charge 항목에 [결제 취소](cancel-tx).
//   (d) 국문 상시 고지(콘텐츠 전용·환급 없음).
//   스타일 = me.tsx V4 토큰(흰카드·#0F172A/#64748B/#2563EB·rounded-xl/lg) 그대로 — 위화감 0.
import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Plus,
  Minus,
  RotateCcw,
  Check,
  CreditCard,
  Smartphone,
} from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { useHectoCharge } from "./useHectoCharge";

type Balance = { paid: number; bonus: number };
type LedgerRow = {
  id: string;
  entry_type: string;
  paid_delta: number;
  bonus_delta: number;
  sku: string | null;
  ref_mcht_trd_no: string | null;
  created_at: string;
  memo: string | null;
};

// 심사 요건: 상품명·제공기간·금액이 한 화면에 보이는 상품형 3종(+직접입력).
const CHARGE_PRODUCTS = [
  { sku: "5000", name: "cash 5,000", amount: 5000 },
  { sku: "10000", name: "cash 10,000", amount: 10000 },
  { sku: "30000", name: "cash 30,000", amount: 30000 },
] as const;
const PROVIDE_PERIOD = "구매 즉시 지급 · 소진 시까지";

// 표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정
const AGREE_PURCHASE =
  "본 상품은 링크드롭 콘텐츠 이용에 사용되는 캐시(cash)이며, 결제 완료 즉시 지급됩니다. 구매조건에 동의하고 결제를 진행합니다.";
// 표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정
const AGREE_CASH_TERMS =
  "캐시는 링크드롭 콘텐츠 이용 전용이며 현금으로 환급되지 않습니다. 결제 취소 시에만 미사용 잔액 한도 내에서 차감·취소됩니다. 반복적 충전 취소는 서비스 이용이 제한될 수 있습니다.";
// 표준 초안 — 최종 문구는 법무(변호사) 검수 후 확정
const AGREE_PRIVACY =
  "결제 처리를 위해 결제대행사(헥토파이낸셜)에 결제·거래에 필요한 정보가 제공됩니다. 제공 정보는 결제 처리 목적으로만 이용됩니다.";

// 네이버 표준 계층 — 전체동의 + 필수 3항목([＞] 탭 시 전문 인라인 펼침).
const AGREE_TERMS = [
  { key: "purchase", label: "구매조건 확인 및 결제진행 동의", body: AGREE_PURCHASE },
  { key: "cash", label: "캐시 이용약관 (환급 불가)", body: AGREE_CASH_TERMS },
  { key: "privacy", label: "개인정보 수집·이용 동의", body: AGREE_PRIVACY },
] as const;

// cash_ledger.entry_type → 국문 라벨(미지 타입은 원문 노출).
const ENTRY_LABEL: Record<string, string> = {
  charge: "충전",
  use: "사용",
  charge_cancel: "결제취소",
  bonus: "보너스",
  expire: "만료",
};

function fmtWon(n: number): string {
  return n.toLocaleString("ko-KR");
}

// "YYYY.MM.DD HH:mm" — 인자 있는 new Date 사용(로케일 무관 고정 포맷).
function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function CashSection() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [balanceError, setBalanceError] = useState("");
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("5000");
  const [customAmount, setCustomAmount] = useState("");
  // CC-HECTO-mobile — 충전 결제수단(카드=기본 / 휴대폰결제). order body 로만 전달, 결제 로직 무변경.
  const [payMethod, setPayMethod] = useState<"card" | "mobile">("card");
  // 약관 동의 — 필수 3항목 개별 체크(전체동의는 파생). 전문 펼침은 항목별 독립 토글.
  const [agreedKeys, setAgreedKeys] = useState<Record<string, boolean>>({});
  const [expandedTerm, setExpandedTerm] = useState<Record<string, boolean>>({});
  const [cancelBusyTrdNo, setCancelBusyTrdNo] = useState<string | null>(null);
  const [cancelStatus, setCancelStatus] = useState("");
  // 이용내역 아코디언 — 기본 접힘(첫 진입 시 화면 늘어짐 방지). SSR 안전 로컬 토글.
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // 잔액 조회(본인 SELECT). 총 잔액 반환(충전 폴링 델타 판정) + 실패는 표시만(버튼 잠금과 분리).
  const refreshBalance = useCallback(async (): Promise<number | null> => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return null;
    try {
      const sb = supabase as unknown as SupabaseClient;
      const { data, error } = await sb
        .from("cash_wallets")
        .select("paid_balance, bonus_balance")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      const row = (data as { paid_balance?: number; bonus_balance?: number } | null) ?? null;
      const b = { paid: row?.paid_balance ?? 0, bonus: row?.bonus_balance ?? 0 };
      setBalance(b);
      setBalanceError("");
      return b.paid + b.bonus;
    } catch (e) {
      console.warn("[CashSection] balance fetch failed", e);
      setBalanceError("조회 실패 · 다시 시도");
      return null;
    }
  }, []);

  // 내역 조회(본인 SELECT 최근 20건).
  const loadLedger = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;
    const sb = supabase as unknown as SupabaseClient;
    const { data } = await sb
      .from("cash_ledger")
      .select("id, entry_type, paid_delta, bonus_delta, sku, ref_mcht_trd_no, created_at, memo")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(20);
    setLedger((data as LedgerRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    void refreshBalance();
    void loadLedger();
  }, [refreshBalance, loadLedger]);

  const { busy: chargeBusy, chargeStatus, charge, showManualRefresh, manualRefresh } =
    useHectoCharge({ refreshBalance });

  const selectedProduct = CHARGE_PRODUCTS.find((p) => p.sku === selectedSku);
  const amount = selectedSku === "custom" ? Number(customAmount) : (selectedProduct?.amount ?? 0);
  const amountValid = Number.isFinite(amount) && amount > 0;
  // 전체동의 = 필수 3항목 전부 체크 시 파생 on(부분 해제 시 자동 off).
  const allAgreed = AGREE_TERMS.every((t) => agreedKeys[t.key]);
  const canCharge = allAgreed && amountValid && !chargeBusy;

  const onCharge = useCallback(() => {
    if (!canCharge) return;
    const label =
      selectedSku === "custom"
        ? `cash ${amount.toLocaleString("ko-KR")}`
        : (selectedProduct?.name ?? "cash 충전");
    void (async () => {
      await charge({ amountKrw: amount, orderName: label, payMethod });
      await loadLedger();
    })();
  }, [canCharge, selectedSku, amount, selectedProduct, charge, loadLedger, payMethod]);

  // charge 원장의 [결제 취소] — cancel-tx {chargeTrdNo}(D2Ⓐ). 유상 결제분(paid_delta)만 취소.
  const onCancelCharge = useCallback(
    async (row: LedgerRow) => {
      if (cancelBusyTrdNo) return;
      const chargeTrdNo = row.ref_mcht_trd_no?.trim();
      if (!chargeTrdNo) {
        setCancelStatus("취소할 결제 정보를 찾을 수 없어요.");
        return;
      }
      const amountKrw = row.paid_delta;
      if (!(amountKrw > 0)) {
        setCancelStatus("취소 가능한 유상 결제 금액이 없어요.");
        return;
      }
      setCancelBusyTrdNo(chargeTrdNo);
      setCancelStatus("");
      try {
        const res = await fetch("/api/hecto/cancel-tx", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chargeTrdNo, amountKrw }),
        });
        const json = (await res.json()) as {
          error?: string;
          message?: string;
          finalized?: string;
          outStatCd?: string;
        };
        if (!res.ok)
          throw new Error(json.message ?? json.error ?? `취소 실패 (HTTP ${res.status})`);
        setCancelStatus(`결제취소 완료 (${json.finalized ?? json.outStatCd ?? "처리됨"})`);
        await refreshBalance();
        await loadLedger();
      } catch (e) {
        setCancelStatus(`취소 실패: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setCancelBusyTrdNo(null);
      }
    },
    [cancelBusyTrdNo, refreshBalance, loadLedger],
  );

  return (
    <div className="flex flex-col gap-4">
      {/* (a) 잔액 카드(v0) — 다크 그라데이션 + Coins + "내 캐시" + 큰 숫자 + 유상/무상. 데이터·조회 로직 그대로. */}
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
              {balance ? fmtWon(balance.paid + balance.bonus) : "—"}
            </span>
            <span className="text-[14px] font-semibold text-white/70">cash</span>
          </div>
          {balance ? (
            <span className="text-[11px] font-medium tabular-nums text-white/50">
              유상 {fmtWon(balance.paid)} · 무상 {fmtWon(balance.bonus)}
            </span>
          ) : null}
        </div>
        {/* 조회 실패는 표시만(버튼 잠금과 분리) — 탭하면 재조회. 로직 그대로. */}
        {balanceError ? (
          <button
            type="button"
            onClick={() => void refreshBalance()}
            className="relative mt-2 w-fit text-[11px] font-medium tracking-ko text-[#FCA5A5] underline underline-offset-2"
          >
            {balanceError}
          </button>
        ) : null}
      </div>

      {/* (b) 충전 = 단건 결제(v0 카드 룩). 정적 헤더(Plus)+프리셋 그리드+약관+결제. 로직·게이트 그대로.
          ※ 충전 콜랩스는 새 state 필요 → 미도입(항상 노출). 이용내역은 기존 ledgerOpen 재사용. */}
      <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
        <div className="flex items-center gap-2.5 px-4 py-3.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#EEF3FE]">
            <Plus className="size-[18px] text-[#2563EB]" strokeWidth={2.5} />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-bold text-[#0F172A]">캐시 충전</span>
            <span className="mt-0.5 block text-[11.5px] font-medium text-[#94A3B8]">
              금액을 골라 바로 충전하세요
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-3 border-t border-[#F1F5F9] p-4">
          {/* 프리셋 2열 그리드 — 라이브 CHARGE_PRODUCTS 값 유지, v0 활성 스타일(파란 border/bg/ring). */}
          <div className="grid grid-cols-2 gap-2">
            {CHARGE_PRODUCTS.map((p) => {
              const selected = selectedSku === p.sku;
              return (
                <button
                  key={p.sku}
                  type="button"
                  onClick={() => setSelectedSku(p.sku)}
                  aria-pressed={selected}
                  className={`flex flex-col items-center rounded-xl border py-3 text-center transition-all active:scale-[0.98] ${
                    selected
                      ? "border-[#2563EB] bg-[#EEF3FE] ring-1 ring-inset ring-[#2563EB]"
                      : "border-[#E8EDF3] bg-white hover:border-[#CBD5E1]"
                  }`}
                >
                  <span className="text-[17px] font-bold tabular-nums text-[#0F172A]">
                    {fmtWon(p.amount)}원
                  </span>
                  <span
                    className={`mt-1 text-[10.5px] font-semibold ${selected ? "text-[#2563EB]" : "text-[#94A3B8]"}`}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}

            {/* 직접입력 카드 */}
            <button
              type="button"
              onClick={() => setSelectedSku("custom")}
              aria-pressed={selectedSku === "custom"}
              className={`flex flex-col items-center rounded-xl border py-3 text-center transition-all active:scale-[0.98] ${
                selectedSku === "custom"
                  ? "border-[#2563EB] bg-[#EEF3FE] ring-1 ring-inset ring-[#2563EB]"
                  : "border-[#E8EDF3] bg-white hover:border-[#CBD5E1]"
              }`}
            >
              <span className="text-[17px] font-bold text-[#0F172A]">
                {selectedSku === "custom" && amountValid ? `${fmtWon(amount)}원` : "직접입력"}
              </span>
              <span
                className={`mt-1 text-[10.5px] font-semibold ${selectedSku === "custom" ? "text-[#2563EB]" : "text-[#94A3B8]"}`}
              >
                {PROVIDE_PERIOD}
              </span>
            </button>
          </div>

          {/* 직접입력 금액 필드 — 그리드 아래 전폭. */}
          {selectedSku === "custom" ? (
            <label className="flex flex-col gap-1 text-xs font-semibold tracking-ko text-[#64748B]">
              충전 금액 (원)
              <input
                type="number"
                inputMode="numeric"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                min={1}
                placeholder="예: 20000"
                className="min-h-[44px] rounded-lg border border-[#E8EDF3] bg-white px-3 text-sm font-medium tracking-ko text-[#0F172A] placeholder:text-[#94A3B8]"
              />
            </label>
          ) : null}

          {/* CC-HECTO-mobile — 결제 수단 선택 [카드 | 휴대폰결제]. payMethod state → order body 로만 전달.
              v0 프리셋 카드와 동일 룩(파란 활성). 결제 파이프·약관 게이트 무변경. */}
          <div className="flex flex-col gap-1.5">
            <span className="px-0.5 text-[11.5px] font-semibold tracking-ko text-[#64748B]">
              결제 수단
            </span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "card", label: "카드", Icon: CreditCard },
                  { key: "mobile", label: "휴대폰결제", Icon: Smartphone },
                ] as const
              ).map((m) => {
                const active = payMethod === m.key;
                const MIcon = m.Icon;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPayMethod(m.key)}
                    aria-pressed={active}
                    className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border text-[13px] font-semibold tracking-ko transition-all active:scale-[0.98] ${
                      active
                        ? "border-[#2563EB] bg-[#EEF3FE] text-[#2563EB] ring-1 ring-inset ring-[#2563EB]"
                        : "border-[#E8EDF3] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <MIcon className="size-4" strokeWidth={2.25} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 약관 동의(v0 룩) — 전체동의 + 필수 3. 게이트(allAgreed) 그대로. [＞] 전문 인라인 펼침 보존(PG 심사 요건). */}
          <div className="rounded-xl bg-[#F8FAFC] p-3">
            {/* 전체 동의 — 하위 3개 일괄 토글(기존 setAgreedKeys 로직 유지). */}
            <button
              type="button"
              onClick={() =>
                setAgreedKeys(Object.fromEntries(AGREE_TERMS.map((t) => [t.key, !allAgreed])))
              }
              className="flex w-full items-center gap-2.5 text-left"
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-md transition-colors ${
                  allAgreed ? "bg-[#2563EB]" : "border-2 border-[#CBD5E1] bg-white"
                }`}
              >
                {allAgreed ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
              </span>
              <span className="text-[13px] font-bold text-[#0F172A]">전체 동의</span>
            </button>

            <div className="mt-2.5 flex flex-col gap-2 border-t border-[#EAEEF3] pt-2.5">
              {AGREE_TERMS.map((t) => {
                const checked = !!agreedKeys[t.key];
                const open = !!expandedTerm[t.key];
                return (
                  <div key={t.key}>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setAgreedKeys((p) => ({ ...p, [t.key]: !p[t.key] }))}
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      >
                        <span
                          className={`flex size-4 shrink-0 items-center justify-center rounded transition-colors ${checked ? "text-[#2563EB]" : "text-[#CBD5E1]"}`}
                        >
                          <Check className="size-4" strokeWidth={3} />
                        </span>
                        <span className="truncate text-[12px] font-medium text-[#475569]">
                          <span className="font-bold text-[#DC2626]">[필수]</span> {t.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedTerm((p) => ({ ...p, [t.key]: !p[t.key] }))}
                        aria-expanded={open}
                        aria-label={`${t.label} 전문 보기`}
                        className="flex size-7 shrink-0 items-center justify-center text-[#94A3B8]"
                      >
                        <ChevronRight
                          className={`size-4 transition-transform ${open ? "rotate-90" : ""}`}
                          strokeWidth={2}
                        />
                      </button>
                    </div>
                    {open ? (
                      <p className="mt-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-medium leading-relaxed tracking-ko text-[#64748B]">
                        {t.body}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 결제 버튼 — onCharge/canCharge/chargeBusy 그대로, v0 스타일. */}
          <button
            type="button"
            onClick={onCharge}
            disabled={!canCharge}
            className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-3.5 text-[14.5px] font-bold transition-all ${
              canCharge
                ? "bg-[#2563EB] text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] active:scale-[0.99]"
                : "cursor-not-allowed bg-[#E2E8F0] text-[#94A3B8]"
            }`}
          >
            {chargeBusy
              ? "처리 중…"
              : amountValid
                ? `${fmtWon(amount)}원 결제하고 충전`
                : "충전 금액을 선택하세요"}
          </button>
          {chargeStatus ? (
            <p className="rounded-lg bg-[#F1F5F9] px-3 py-2 text-xs font-medium tracking-ko text-[#0F172A]">
              {chargeStatus}
            </p>
          ) : null}
          {/* CC-CASH-c2.2 — 30초 미반영 폴백 새로고침. 탭 시 즉시 잔액 재조회 + 내역 갱신. */}
          {showManualRefresh ? (
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  await manualRefresh();
                  await loadLedger();
                })();
              }}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#E8EDF3] bg-white text-[13px] font-bold tracking-ko text-[#2563EB] transition-colors hover:bg-[#F8FAFC] active:scale-[0.99]"
            >
              <RotateCcw className="size-4" strokeWidth={2.25} />
              새로고침
            </button>
          ) : null}

          {/* (d) 국문 상시 고지 — v0: 충전 블록 내 배치. */}
          <p className="px-0.5 text-[11px] leading-relaxed tracking-ko text-[#94A3B8]">
            본 캐시는 링크드롭 콘텐츠 이용 전용이며 현금 환급되지 않습니다. 결제 취소 시에만 해당 금액이
            차감·취소됩니다.
          </p>
        </div>
      </div>

      {/* (c) 이용 내역 — v0 HistoryAccordion 룩(기존 ledgerOpen 재사용). [결제취소] cancel-tx 로직 그대로. */}
      <div className="overflow-hidden rounded-2xl border border-[#EAEEF3] bg-white">
        <button
          type="button"
          onClick={() => setLedgerOpen((v) => !v)}
          aria-expanded={ledgerOpen}
          className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-[#F8FAFC]"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#F1F5F9]">
            <RotateCcw className="size-[17px] text-[#475569]" strokeWidth={2.25} />
          </span>
          <span className="flex-1">
            <span className="block text-[14px] font-bold text-[#0F172A]">이용 내역</span>
            <span className="mt-0.5 block text-[11.5px] font-medium text-[#94A3B8]">
              충전 · 사용 · 결제취소 {ledger.length}건
            </span>
          </span>
          <ChevronDown
            className="size-5 flex-shrink-0 text-[#94A3B8] transition-transform duration-300"
            strokeWidth={2.25}
            style={{ transform: ledgerOpen ? "rotate(180deg)" : "none" }}
          />
        </button>

        <div
          className="grid transition-all duration-300 ease-out"
          style={{ gridTemplateRows: ledgerOpen ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="border-t border-[#F1F5F9] px-4 pb-3">
              {cancelStatus ? (
                <p className="mt-3 rounded-lg bg-[#F1F5F9] px-3 py-2 text-xs font-medium tracking-ko text-[#0F172A]">
                  {cancelStatus}
                </p>
              ) : null}
              {ledger.length === 0 ? (
                <p className="py-3 text-[13px] text-[#94A3B8]">내역이 없어요</p>
              ) : (
                <div className="divide-y divide-[#F1F5F9]">
                  {ledger.map((row) => {
                    const label = ENTRY_LABEL[row.entry_type] ?? row.entry_type;
                    const delta = row.paid_delta + row.bonus_delta;
                    const positive = delta > 0;
                    // v0 CashTxnRow 색 — 충전=초록 / 결제취소=앰버 / 그 외=슬레이트.
                    const meta =
                      row.entry_type === "charge"
                        ? { Icon: Plus, tint: "#059669", bg: "#ECFDF5" }
                        : row.entry_type === "charge_cancel"
                          ? { Icon: RotateCcw, tint: "#B45309", bg: "#FEF3C7" }
                          : { Icon: Minus, tint: "#475569", bg: "#F1F5F9" };
                    const RowIcon = meta.Icon;
                    const canCancel =
                      row.entry_type === "charge" && !!row.ref_mcht_trd_no && row.paid_delta > 0;
                    const busyThis = cancelBusyTrdNo === row.ref_mcht_trd_no;
                    return (
                      <div key={row.id} className="flex items-center gap-3 py-3">
                        <span
                          className="flex size-8 flex-shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: meta.bg }}
                        >
                          <RowIcon className="size-4" style={{ color: meta.tint }} strokeWidth={2.5} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-semibold text-[#0F172A]">{label}</div>
                          <div className="mt-0.5 text-[11px] tabular-nums text-[#94A3B8]">
                            {fmtDateTime(row.created_at)}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <span
                            className={`text-[14px] font-bold tabular-nums ${
                              positive ? "text-[#059669]" : "text-[#0F172A]"
                            }`}
                          >
                            {positive ? "+" : ""}
                            {fmtWon(delta)}
                          </span>
                          {canCancel ? (
                            <button
                              type="button"
                              onClick={() => void onCancelCharge(row)}
                              disabled={busyThis || cancelBusyTrdNo !== null}
                              className="min-h-[32px] rounded-lg border border-[#E8EDF3] px-2.5 text-xs font-semibold tracking-ko text-[#64748B] transition-colors hover:border-[#94A3B8] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {busyThis ? "취소 중…" : "결제 취소"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
