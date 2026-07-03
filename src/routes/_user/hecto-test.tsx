// /hecto-test — 헥토 표준결제창 SDK 연동 테스트베드 (v1.5, 실결제 검증용).
//   POST /api/hecto/order 로 결제창 호출 파라미터(암호화 금액 + 무결성 해시)를 받고,
//   결제창 SDK(SETTLE_PG)를 서버가 알려준 sdkUrl 에서 로드해 SETTLE_PG.pay() 로 팝업을 띄운다.
//   ⚠️ 주문 확정은 이 화면(리턴)이 아니라 서버-서버 노티(/api/hecto/noti) 기준.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";

export const Route = createFileRoute("/_user/hecto-test")({
  // CASH-c2 — 운영 가드: 파트너 오너만 접근(테스트베드). 비대상=홈. (_partner.tsx is_active_partner_owner 패턴 재사용)
  beforeLoad: async () => {
    const supabase = await getAuthClient();
    if (!supabase) return; // 로컬 미설정 시 통과(앱 렌더 보장 — 기존 관례)
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // 세션 없음 = 부모 _user 가 /login 처리
    const { data: isOwner } = await supabase.rpc("is_active_partner_owner", {
      _user_id: data.session.user.id,
    });
    if (!isOwner) throw redirect({ to: "/home" });
  },
  component: HectoTestPage,
});

/** POST /api/hecto/order 응답 형태 (server: CardOrder 미러). */
interface OrderResponse {
  env: string;
  mchtId: string;
  method: string;
  mchtTrdNo: string;
  trdDt: string;
  trdTm: string;
  trdAmt: string;
  pktHash: string;
  notiUrl: string;
  nextUrl: string;
  cancUrl: string;
  orderName: string;
  sdkUrl: string;
  /** CASH-c2 — 충전 주문이면 mchtParam(uid=…), 결제창 pay() 에 실어 노티로 회수. */
  mchtParam?: string;
}

/** POST /api/hecto/cancel-tx 응답 형태 (취소 결과). */
interface CancelTxResult {
  httpStatus?: number;
  cancelMchtTrdNo?: string;
  outStatCd?: string;
  outRsltCd?: string;
  outRsltMsg?: string;
  cnclAmt?: string;
  blcAmt?: string;
}

/** 결제창 SDK 전역 객체(SETTLE_PG)의 최소 타입. */
type SettlePg = { pay: (params: Record<string, unknown>, callback?: (r: unknown) => void) => void };
function getSettlePg(): SettlePg | undefined {
  return (globalThis as unknown as { SETTLE_PG?: SettlePg }).SETTLE_PG;
}

const SDK_READY_TIMEOUT_MS = 10_000;

/**
 * sdkUrl 의 SDK 스크립트를 멱등 로드하고 SETTLE_PG 준비를 기다린다.
 *   - 이미 window.SETTLE_PG 존재 → 즉시 resolve.
 *   - script 미주입 → 주입, 이미 있으면(HMR/재시도) 재주입 금지.
 *   - load 이벤트가 이미 지나갔거나 async 지연돼도 폴링 안전망으로 감지(무한 매달림 방지).
 *   - onerror / 타임아웃 → reject(호출부가 실패 문구+재시도 노출).
 */
function ensureSdkLoaded(sdkUrl: string): Promise<SettlePg> {
  return new Promise((resolve, reject) => {
    const existing = getSettlePg();
    if (existing) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finishOk = (): boolean => {
      const pg = getSettlePg();
      if (!settled && pg) {
        settled = true;
        cleanup();
        resolve(pg);
        return true;
      }
      return false;
    };
    const finishErr = (msg: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    // 이미 주입된 script 재사용(멱등) — 없으면 새로 생성.
    const already = document.querySelector<HTMLScriptElement>('script[data-hecto-sdk="1"]');
    const script = already ?? document.createElement("script");
    if (!already) {
      script.src = sdkUrl;
      script.async = true;
      script.dataset.hectoSdk = "1";
    }
    const onLoad = () => finishOk();
    const onError = () => finishErr("SDK 스크립트 로드 실패");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    // 폴링 + 타임아웃 안전망 — 놓친 load / 이미 완료된 script / 지연 로드 모두 커버.
    const startedAt = Date.now();
    const poll = window.setInterval(() => {
      if (finishOk()) return;
      if (Date.now() - startedAt > SDK_READY_TIMEOUT_MS) {
        finishErr("SDK 준비 시간 초과 — 새로고침 후 다시 시도하세요.");
      }
    }, 120);

    function cleanup() {
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
      window.clearInterval(poll);
    }

    if (!already) document.head.appendChild(script);
    else finishOk(); // 이미 붙어 있고 전역도 준비됐을 수 있음 — 즉시 1회 확인.
  });
}

type Phase = "idle" | "ordering" | "sdk-loading" | "sdk-ready" | "paying" | "error";

/** phase → 사용자 노출 상태줄 문구. */
const PHASE_LABEL: Record<Phase, string> = {
  idle: "대기 중",
  ordering: "주문 생성 중…",
  "sdk-loading": "SDK 로딩 중…",
  "sdk-ready": "준비 완료",
  paying: "결제창 호출 — 팝업을 확인하세요.",
  error: "로드 실패",
};

function HectoTestPage() {
  // ① 마운트 시 SDK 선로딩 — 초기 phase=sdk-loading 로 페이지 열자마자 "SDK 로딩 중…" 노출 → 준비 완료.
  const [phase, setPhase] = useState<Phase>("sdk-loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const preloadStartedRef = useRef(false);

  // v1.6 — 취소 테스트 상태. orgTrdNo(원거래번호)는 결제 노티/next 로그의 trdNo 를 수동 입력.
  const [cancelOrgTrdNo, setCancelOrgTrdNo] = useState("");
  const [cancelAmount, setCancelAmount] = useState("1000");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelTxResult | null>(null);
  const [cancelError, setCancelError] = useState("");

  // CASH-c2 — 캐시 잔액 + 충전/사용 상태.
  const [balance, setBalance] = useState<{ paid: number; bonus: number } | null>(null);
  const [chargeAmount, setChargeAmount] = useState("1000");
  const [useSku, setUseSku] = useState("boost");
  const [useAmount, setUseAmount] = useState("100");
  const [useBusy, setUseBusy] = useState(false);
  const [useResult, setUseResult] = useState("");
  const [useError, setUseError] = useState("");
  // c2.1 — 충전 진행 상태(폴링) + 잔액 조회 실패(버튼 잠금과 분리, 표시만).
  const [chargeStatus, setChargeStatus] = useState("");
  const [balanceError, setBalanceError] = useState("");

  // c2.1 — 진행 중 잠금 = 주문 생성·SDK 로드 단계만. "paying"(결제창 팝업 호출됨)은 제외 →
  //   팝업이 별창에서 뜬 뒤 버튼 재활성(결제창 닫힘 후 영구 잠금 해소). idle/ready/error 도 클릭 가능.
  const busy = phase === "ordering" || phase === "sdk-loading";

  // ① eager 선로딩 — 페이지 열리면 sdkUrl 확보 후 즉시 SDK 로드(클릭 전에 준비 완료 목표).
  useEffect(() => {
    if (preloadStartedRef.current) return; // StrictMode 이중 마운트 가드
    preloadStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        console.log("[hecto-test] sdk", "sdk-loading"); // ③ 로드 시작
        // sdkUrl 확보용 order — createCardOrder 는 순수 계산(DB/외부호출 0)이라 프리페치 안전.
        const res = await fetch("/api/hecto/order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amountKrw: 1000, orderName: "링크드랍 테스트결제" }),
        });
        if (!res.ok) throw new Error(`SDK 설정 조회 실패 (HTTP ${res.status})`);
        const order = (await res.json()) as OrderResponse;
        await ensureSdkLoaded(order.sdkUrl); // ② 기존 10s 타임아웃 안전망 사용
        if (cancelled) return;
        setPhase("sdk-ready");
        console.log("[hecto-test] sdk", "sdk-ready"); // ③ 성공
      } catch (e) {
        if (cancelled) return;
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
        console.log("[hecto-test] sdk", "error"); // ③ 실패
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CASH-c2/c2.1 — 내 캐시 잔액(본인 SELECT 정책). 값 반환(폴링용) + 실패는 표시만(③ 버튼 잠금 X).
  const refreshBalance = useCallback(async (): Promise<{ paid: number; bonus: number } | null> => {
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
      return b;
    } catch (e) {
      console.warn("[hecto-test] balance fetch failed", e);
      setBalanceError("조회 실패·재시도");
      return null;
    }
  }, []);
  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  // CASH-c2 — 주문 생성→SDK→pay 공통 흐름(일반 테스트결제·캐시충전 공유, orderBody 만 다름).
  const runOrderPay = useCallback(
    async (orderBody: Record<string, unknown>) => {
      if (busy) return;
      setErrorMsg("");
      setPhase("ordering");
      try {
        const res = await fetch("/api/hecto/order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(orderBody),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(err.message ?? `주문 생성 실패 (HTTP ${res.status})`);
        }
        const order = (await res.json()) as OrderResponse;

        setPhase("sdk-loading");
        const pg = await ensureSdkLoaded(order.sdkUrl);

        setPhase("sdk-ready");
        pg.pay({
          env: order.env,
          mchtId: order.mchtId,
          method: "card",
          trdDt: order.trdDt,
          trdTm: order.trdTm,
          mchtTrdNo: order.mchtTrdNo,
          trdAmt: order.trdAmt,
          pktHash: order.pktHash,
          // SDK 필수: 상점명(국문/영문) + 상품명(주문명 매핑). mchtEName = 서버 필수(1007 방지).
          mchtName: "링크드롭",
          mchtEName: "LinkDrop",
          pmtPrdtNm: order.orderName,
          notiUrl: order.notiUrl,
          nextUrl: order.nextUrl,
          cancUrl: order.cancUrl,
          // CASH-c2 — 충전 주문이면 mchtParam(uid=)을 결제창에 실어 노티로 회수.
          ...(order.mchtParam ? { mchtParam: order.mchtParam } : {}),
          ui: { type: "popup", width: 430, height: 660 },
        });
        setPhase("paying");
      } catch (e) {
        // ③ 실패 시 반드시 잠금 해제 + 재시도 노출.
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [busy],
  );

  const onPay = useCallback(() => {
    // ④ 향후 진단용 — 클릭 시점 상태 1줄.
    console.log("[hecto-test] pay click", { phase, busy, hasSdk: Boolean(getSettlePg()) });
    void runOrderPay({ amountKrw: 1000, orderName: "링크드랍 테스트결제" });
  }, [runOrderPay, phase, busy]);

  // CASH-c2/c2.1 — 캐시 충전: 세션 uid → mchtParam(uid=) 결제창 호출 후, 팝업 닫힘 대비 잔액 폴링.
  const onCharge = useCallback(async () => {
    console.log("[hecto-test] charge click", { phase, busy }); // ④ 클릭 로그
    if (busy) return;
    const amountKrw = Number(chargeAmount);
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) {
      setChargeStatus("충전 금액이 올바르지 않아요.");
      return;
    }
    const supabase = getSupabase();
    if (!supabase) {
      setChargeStatus("로그인이 필요해요.");
      return;
    }
    setChargeStatus("");
    try {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) {
        setChargeStatus("로그인이 필요해요.");
        return;
      }
      // 충전 전 잔액 기준(폴링 델타 판정).
      const beforeBal = await refreshBalance();
      const before = beforeBal ? beforeBal.paid + beforeBal.bonus : 0;
      // 결제창 호출 — runOrderPay 내부 try/catch 로 phase 는 항상 비-busy(paying/error)로 정착.
      await runOrderPay({ amountKrw, orderName: "캐시 충전", purpose: "cash_charge", userId: uid });
      // ② 팝업 닫힘 대비 — 노티 반영 폴링(3회·3초). 반영되면 완료, 아니면 대기 안내.
      setChargeStatus("결제창 종료 — 캐시 반영 확인 중…");
      for (let i = 0; i < 3; i += 1) {
        await new Promise((r) => setTimeout(r, 3000));
        const b = await refreshBalance();
        if (b && b.paid + b.bonus >= before + amountKrw) {
          setChargeStatus(`충전 완료 +${amountKrw.toLocaleString("ko-KR")}캐시`);
          return;
        }
      }
      setChargeStatus("반영 대기 — 새로고침으로 확인하세요. (노티 지연 가능)");
    } catch (e) {
      setChargeStatus(`오류: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [busy, phase, chargeAmount, runOrderPay, refreshBalance]);

  // v1.6 — 서버→헥토 APICancel.do 취소 호출. 별개 라우트 /api/hecto/cancel-tx.
  const onCancel = useCallback(async () => {
    const orgTrdNo = cancelOrgTrdNo.trim();
    const amountKrw = Number(cancelAmount);
    if (!orgTrdNo) {
      setCancelError("원거래번호(orgTrdNo)를 입력하세요. (결제 노티/next 로그의 trdNo)");
      return;
    }
    if (!Number.isFinite(amountKrw) || amountKrw <= 0) {
      setCancelError("취소 금액이 올바르지 않아요.");
      return;
    }
    setCancelBusy(true);
    setCancelError("");
    setCancelResult(null);
    try {
      const res = await fetch("/api/hecto/cancel-tx", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgTrdNo, amountKrw }),
      });
      const json = (await res.json()) as CancelTxResult & { message?: string };
      if (!res.ok && json.message) throw new Error(json.message);
      setCancelResult(json);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : String(e));
    } finally {
      setCancelBusy(false);
    }
  }, [cancelOrgTrdNo, cancelAmount]);

  // CASH-c2 — 캐시 사용(차감) 테스트. 서버 라우트가 세션 인증 → use_cash(auth.uid()) 호출.
  const onUse = useCallback(async () => {
    console.log("[hecto-test] use click", { useBusy, useSku, useAmount }); // ④ 클릭 로그
    const amount = Number(useAmount);
    if (!useSku) {
      setUseError("SKU를 선택하세요.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setUseError("사용 금액이 올바르지 않아요.");
      return;
    }
    setUseBusy(true);
    setUseError("");
    setUseResult("");
    try {
      const res = await fetch("/api/cash/use", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku: useSku, amount }),
      });
      const json = (await res.json()) as { error?: string; message?: string; result?: unknown };
      if (!res.ok) throw new Error(json.message ?? json.error ?? `사용 실패 (HTTP ${res.status})`);
      setUseResult(JSON.stringify(json.result ?? json));
      await refreshBalance();
    } catch (e) {
      setUseError(e instanceof Error ? e.message : String(e));
    } finally {
      setUseBusy(false);
    }
  }, [useSku, useAmount, refreshBalance]);

  const statusText = phase === "error" && errorMsg ? `로드 실패 — ${errorMsg}` : PHASE_LABEL[phase];

  return (
    // v1.6.1 — 페이지 전체 명시 대비 고정(테마 상속 차단): 배경 #FFFFFF, 기본 텍스트 #0F172A.
    <div className="min-h-screen w-full bg-[#FFFFFF] text-[#0F172A]">
      <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold tracking-ko text-[#0F172A]">헥토 결제창 테스트</h1>
          <p className="text-sm tracking-ko text-[#64748B]">
            표준결제창 SDK(SETTLE_PG) 연동 확인용 테스트베드입니다.
          </p>
        </div>

        <button
          type="button"
          onClick={onPay}
          disabled={busy}
          className="min-h-[44px] min-w-[44px] rounded-lg bg-[#171717] px-6 font-semibold tracking-ko text-[#FFFFFF] shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "처리 중…" : "테스트 결제 1,000원"}
        </button>

        {/* ② 상태줄 — 배경 #F8FAFC + 모노스페이스 대비 고정. 실패 시 재시도 버튼. */}
        <div className="flex items-center gap-3">
          <p className="flex-1 rounded-lg bg-[#F8FAFC] px-3 py-2 font-mono text-sm text-[#0F172A]">
            상태:{" "}
            <span className={phase === "error" ? "text-[#DC2626]" : "text-[#0F172A]"}>
              {statusText}
            </span>
          </p>
          {phase === "error" && (
            <button
              type="button"
              onClick={onPay}
              className="min-h-[44px] rounded-lg bg-[#171717] px-4 text-sm font-semibold tracking-ko text-[#FFFFFF] hover:-translate-y-0.5"
            >
              재시도
            </button>
          )}
        </div>

        <p className="rounded-lg bg-[#F8FAFC] p-4 text-xs tracking-ko text-[#64748B]">
          ⚠️ 주문 확정은 <span className="font-semibold text-[#0F172A]">노티(서버-서버 통보) 기준</span>
          입니다. 결제창의 완료/취소 리턴은 참고용이며 위·변조 가능합니다.
        </p>

        {/* CASH-c2 — 내 캐시 잔액(본인 SELECT 정책) + 충전 */}
        <div className="flex flex-col gap-3 rounded-lg border border-[#D7DEE7] p-4">
          <h2 className="text-base font-bold tracking-ko text-[#0F172A]">내 캐시</h2>
          <p className="font-mono text-sm text-[#0F172A]">
            {balance
              ? `${(balance.paid + balance.bonus).toLocaleString("ko-KR")}원 (유료 ${balance.paid.toLocaleString("ko-KR")} · 보너스 ${balance.bonus.toLocaleString("ko-KR")})`
              : "조회 중…"}
          </p>
          {/* ③ 잔액 조회 실패는 표시만(버튼 잠금과 분리). 탭하면 재조회. */}
          {balanceError && (
            <button
              type="button"
              onClick={() => void refreshBalance()}
              className="w-fit text-xs tracking-ko text-[#DC2626] underline underline-offset-2"
            >
              {balanceError}
            </button>
          )}
          <label className="flex flex-col gap-1 text-xs tracking-ko text-[#64748B]">
            충전 금액 (원)
            <input
              type="number"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              min={1}
              className="min-h-[44px] rounded-lg border border-[#D7DEE7] bg-[#FFFFFF] px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
            />
          </label>
          <button
            type="button"
            onClick={onCharge}
            disabled={busy}
            className="min-h-[44px] rounded-lg bg-[#171717] px-6 font-semibold tracking-ko text-[#FFFFFF] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "처리 중…" : "충전하기"}
          </button>
          {/* ② 충전 진행/폴링 상태 — 결제창 종료 후 반영 확인·안내. */}
          {chargeStatus && (
            <p className="rounded-lg bg-[#F8FAFC] px-3 py-2 font-mono text-xs text-[#0F172A]">
              {chargeStatus}
            </p>
          )}
          <p className="rounded-lg bg-[#F8FAFC] p-3 text-[11px] leading-relaxed tracking-ko text-[#64748B]">
            본 캐시는 링크드롭 콘텐츠 이용 전용이며 현금 환급되지 않습니다. 결제 취소 시에만 해당 금액이
            차감·취소됩니다.
          </p>
        </div>

        {/* CASH-c2 — 캐시 사용(차감) 테스트. 실 부스트 효과 적용은 c2.5. */}
        <div className="flex flex-col gap-3 rounded-lg border border-[#D7DEE7] p-4">
          <h2 className="text-base font-bold tracking-ko text-[#0F172A]">캐시 사용 (테스트)</h2>
          <label className="flex flex-col gap-1 text-xs tracking-ko text-[#64748B]">
            SKU
            <select
              value={useSku}
              onChange={(e) => setUseSku(e.target.value)}
              className="min-h-[44px] rounded-lg border border-[#D7DEE7] bg-[#FFFFFF] px-3 text-sm text-[#0F172A]"
            >
              <option value="boost">boost</option>
              <option value="ai_pack">ai_pack</option>
              <option value="studio_premium">studio_premium</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs tracking-ko text-[#64748B]">
            사용 금액 (원)
            <input
              type="number"
              value={useAmount}
              onChange={(e) => setUseAmount(e.target.value)}
              min={1}
              className="min-h-[44px] rounded-lg border border-[#D7DEE7] bg-[#FFFFFF] px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
            />
          </label>
          <button
            type="button"
            onClick={onUse}
            disabled={useBusy}
            className="min-h-[44px] rounded-lg bg-[#171717] px-6 font-semibold tracking-ko text-[#FFFFFF] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {useBusy ? "사용 중…" : "사용"}
          </button>
          {useError && <p className="text-sm tracking-ko text-[#DC2626]">오류: {useError}</p>}
          {useResult && (
            <p className="rounded-lg bg-[#F8FAFC] p-3 font-mono text-xs text-[#0F172A]">{useResult}</p>
          )}
        </div>

        {/* v1.6 — 취소 테스트 (서버→헥토 APICancel.do). 결제창 리턴 수신 /api/hecto/cancel 과 별개. */}
        <div className="flex flex-col gap-3 rounded-lg border border-[#D7DEE7] p-4">
          <h2 className="text-base font-bold tracking-ko text-[#0F172A]">취소 테스트</h2>
          <label className="flex flex-col gap-1 text-xs tracking-ko text-[#64748B]">
            원거래번호 (orgTrdNo)
            <input
              type="text"
              value={cancelOrgTrdNo}
              onChange={(e) => setCancelOrgTrdNo(e.target.value)}
              placeholder="결제 노티/next 로그의 trdNo (STFP_…)"
              className="min-h-[44px] rounded-lg border border-[#D7DEE7] bg-[#FFFFFF] px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs tracking-ko text-[#64748B]">
            취소 금액 (원)
            <input
              type="number"
              value={cancelAmount}
              onChange={(e) => setCancelAmount(e.target.value)}
              min={1}
              className="min-h-[44px] rounded-lg border border-[#D7DEE7] bg-[#FFFFFF] px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8]"
            />
          </label>
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelBusy}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-[#171717] px-6 font-semibold tracking-ko text-[#FFFFFF] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cancelBusy ? "취소 요청 중…" : "승인 취소"}
          </button>
          {cancelError && <p className="text-sm tracking-ko text-[#DC2626]">오류: {cancelError}</p>}
          {cancelResult && (
            <div className="flex flex-col gap-1 rounded-lg bg-[#F8FAFC] p-3 font-mono text-xs text-[#0F172A]">
              <div>
                결과(outStatCd):{" "}
                <span className="font-semibold text-[#0F172A]">{cancelResult.outStatCd || "-"}</span>{" "}
                {cancelResult.outStatCd === "0021"
                  ? "(성공)"
                  : cancelResult.outStatCd === "0031"
                    ? "(실패)"
                    : ""}
              </div>
              <div>거절코드(outRsltCd): {cancelResult.outRsltCd || "-"}</div>
              <div>메시지: {cancelResult.outRsltMsg || "-"}</div>
              <div>
                취소금액(cnclAmt): {cancelResult.cnclAmt || "-"} / 잔액(blcAmt):{" "}
                {cancelResult.blcAmt || "-"}
              </div>
              <div>취소주문번호(mchtTrdNo): {cancelResult.cancelMchtTrdNo || "-"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
