// CASH-c4 — 내지갑 "cash" 섹션.
//   (a) 잔액 카드 "cash N"(영문 소문자 고정) + 유상/무상 소표기, 조회 실패 재시도.
//   (b) 충전 = 단건 결제(심사 요건): 상품형 3종 + 직접입력, 각 상품명·제공기간·금액 표시,
//       [필수] 구매조건 동의 체크(미체크 시 결제 비활성). 충전은 useHectoCharge(purpose:cash_charge) 재사용.
//   (c) 내역 = cash_ledger 본인 최근 20건(국문 라벨·부호·일시), charge 항목에 [결제 취소](cancel-tx).
//   (d) 국문 상시 고지(콘텐츠 전용·환급 없음).
//   스타일 = me.tsx V4 토큰(흰카드·#0F172A/#64748B/#2563EB·rounded-xl/lg) 그대로 — 위화감 0.
import { useCallback, useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
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
  const [agreed, setAgreed] = useState(false);
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

  const { busy: chargeBusy, chargeStatus, charge } = useHectoCharge({ refreshBalance });

  const selectedProduct = CHARGE_PRODUCTS.find((p) => p.sku === selectedSku);
  const amount = selectedSku === "custom" ? Number(customAmount) : (selectedProduct?.amount ?? 0);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const canCharge = agreed && amountValid && !chargeBusy;

  const onCharge = useCallback(() => {
    if (!canCharge) return;
    const label =
      selectedSku === "custom"
        ? `cash ${amount.toLocaleString("ko-KR")}`
        : (selectedProduct?.name ?? "cash 충전");
    void (async () => {
      await charge({ amountKrw: amount, orderName: label });
      await loadLedger();
    })();
  }, [canCharge, selectedSku, amount, selectedProduct, charge, loadLedger]);

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
    <div className="mb-5 flex flex-col gap-4 border-b border-[#E8EDF3] pb-5">
      {/* (a) 잔액 카드 — "cash N"(영문 소문자 고정) + 유상/무상 */}
      <div className="rounded-xl bg-[#F1F5F9] p-4">
        <p className="text-xs font-semibold tracking-ko text-[#64748B]">내 캐시</p>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-bold text-[#64748B]">cash</span>
          <span className="text-3xl font-extrabold tabular-nums tracking-ko text-[#0F172A]">
            {balance ? fmtWon(balance.paid + balance.bonus) : "—"}
          </span>
        </div>
        {balance ? (
          <p className="mt-1 text-xs font-medium tracking-ko text-[#94A3B8]">
            유상 {fmtWon(balance.paid)} · 무상 {fmtWon(balance.bonus)}
          </p>
        ) : null}
        {/* 조회 실패는 표시만(버튼 잠금과 분리) — 탭하면 재조회. */}
        {balanceError ? (
          <button
            type="button"
            onClick={() => void refreshBalance()}
            className="mt-1 w-fit text-xs font-medium tracking-ko text-[#DC2626] underline underline-offset-2"
          >
            {balanceError}
          </button>
        ) : null}
      </div>

      {/* (b) 충전 = 단건 결제. 상품 3종 + 직접입력 카드 그리드 — 상품명·제공기간·금액(심사 요건). */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-bold tracking-ko text-[#0F172A]">캐시 충전</p>

        {/* 상품 카드 그리드(2열) — 3종 + 직접입력. 선택 시 테두리 강조(V4 accent). */}
        <div className="grid grid-cols-2 gap-2">
          {CHARGE_PRODUCTS.map((p) => {
            const selected = selectedSku === p.sku;
            return (
              <button
                key={p.sku}
                type="button"
                onClick={() => setSelectedSku(p.sku)}
                aria-pressed={selected}
                className={`flex flex-col rounded-xl border px-3 py-3 text-left transition-colors ${
                  selected
                    ? "border-[#2563EB] bg-[#EFF4FF]"
                    : "border-[#E8EDF3] bg-white hover:border-[#94A3B8]"
                }`}
              >
                <span className="text-sm font-bold tracking-ko text-[#0F172A]">{p.name}</span>
                <span className="mt-0.5 text-base font-extrabold tracking-ko text-[#0F172A]">
                  {fmtWon(p.amount)}원
                </span>
                <span className="mt-1 text-[11px] font-medium leading-tight tracking-ko text-[#94A3B8]">
                  {PROVIDE_PERIOD}
                </span>
              </button>
            );
          })}

          {/* 직접입력 카드 */}
          <button
            type="button"
            onClick={() => setSelectedSku("custom")}
            aria-pressed={selectedSku === "custom"}
            className={`flex flex-col rounded-xl border px-3 py-3 text-left transition-colors ${
              selectedSku === "custom"
                ? "border-[#2563EB] bg-[#EFF4FF]"
                : "border-[#E8EDF3] bg-white hover:border-[#94A3B8]"
            }`}
          >
            <span className="text-sm font-bold tracking-ko text-[#0F172A]">직접입력</span>
            <span className="mt-0.5 text-base font-extrabold tracking-ko text-[#94A3B8]">
              {selectedSku === "custom" && amountValid ? `${fmtWon(amount)}원` : "직접 설정"}
            </span>
            <span className="mt-1 text-[11px] font-medium leading-tight tracking-ko text-[#94A3B8]">
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

        {/* [필수] 약관 동의 + 결제 버튼 — 그리드 하단 고정 배치. 미체크 시 결제 비활성. */}
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-[#2563EB]"
          />
          <span className="text-xs font-medium leading-relaxed tracking-ko text-[#64748B]">
            <span className="font-bold text-[#DC2626]">[필수]</span> 구매조건 확인 및 결제진행 동의
          </span>
        </label>

        <button
          type="button"
          onClick={onCharge}
          disabled={!canCharge}
          className="flex min-h-[48px] w-full items-center justify-center rounded-2xl bg-[#2563EB] px-6 text-base font-bold tracking-ko text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
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
      </div>

      {/* (d) 국문 상시 고지 */}
      <p className="rounded-lg bg-[#F1F5F9] p-3 text-[11px] font-medium leading-relaxed tracking-ko text-[#64748B]">
        본 캐시는 링크드롭 콘텐츠 이용 전용이며 현금 환급되지 않습니다. 결제 취소 시에만 해당 금액이
        차감·취소됩니다.
      </p>

      {/* (c) 이용 내역 — 아코디언(기본 접힘). 헤더 토글 + 화살표 회전(SSR 안전 로컬 토글). */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setLedgerOpen((v) => !v)}
          aria-expanded={ledgerOpen}
          className="flex min-h-[44px] items-center justify-between px-1 text-left"
        >
          <span className="text-sm font-bold tracking-ko text-[#0F172A]">
            이용 내역 ({ledger.length}건)
          </span>
          <ChevronDown
            className={`size-4 text-[#64748B] transition-transform ${ledgerOpen ? "rotate-180" : ""}`}
            strokeWidth={2}
          />
        </button>

        {ledgerOpen ? (
          <>
            {cancelStatus ? (
              <p className="rounded-lg bg-[#F1F5F9] px-3 py-2 text-xs font-medium tracking-ko text-[#0F172A]">
                {cancelStatus}
              </p>
            ) : null}
            {ledger.length === 0 ? (
              <p className="rounded-xl bg-[#F1F5F9] px-4 py-6 text-center text-xs font-medium tracking-ko text-[#94A3B8]">
                아직 이용 내역이 없어요.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-[#E8EDF3] rounded-xl border border-[#E8EDF3]">
                {ledger.map((row) => {
                  const label = ENTRY_LABEL[row.entry_type] ?? row.entry_type;
                  const delta = row.paid_delta + row.bonus_delta;
                  const positive = delta > 0;
                  const canCancel =
                    row.entry_type === "charge" && !!row.ref_mcht_trd_no && row.paid_delta > 0;
                  const busyThis = cancelBusyTrdNo === row.ref_mcht_trd_no;
                  return (
                    <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-sm font-semibold tracking-ko text-[#0F172A]">
                          {label}
                        </span>
                        <span className="mt-0.5 text-xs font-medium tracking-ko text-[#94A3B8]">
                          {fmtDateTime(row.created_at)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={`text-sm font-bold tabular-nums tracking-ko ${
                            positive ? "text-[#2563EB]" : "text-[#0F172A]"
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
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
