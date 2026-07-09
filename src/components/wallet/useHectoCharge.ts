// CASH-c4 — 헥토 단건결제(캐시 충전) 공용 훅.
//   hecto-test.tsx 의 SDK 멱등 로드 + 주문생성→pay + 충전 후 잔액 폴링 흐름을 추출(동작 무변경).
//   결제창은 서버가 알려준 sdkUrl 에서 SETTLE_PG 를 로드해 pay() 로 팝업 호출한다.
//   ⚠️ 충전 확정은 이 훅(리턴)이 아니라 서버-서버 노티(/api/hecto/noti) 기준. 여기선 잔액 폴링으로 반영만 감지.
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/** POST /api/hecto/order 응답(server CardOrder 미러). */
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
  /** 충전 주문이면 mchtParam(uid=…), 결제창 pay() 에 실어 노티로 회수. */
  mchtParam?: string;
}

/** 결제창 SDK 전역 객체(SETTLE_PG)의 최소 타입. */
type SettlePg = { pay: (params: Record<string, unknown>, callback?: (r: unknown) => void) => void };
function getSettlePg(): SettlePg | undefined {
  return (globalThis as unknown as { SETTLE_PG?: SettlePg }).SETTLE_PG;
}

const SDK_READY_TIMEOUT_MS = 10_000;

/**
 * sdkUrl 의 SDK 스크립트를 멱등 로드하고 SETTLE_PG 준비를 기다린다.
 *   이미 로드됨 → 즉시 resolve. script 미주입 → 주입(중복 주입 금지). load 이벤트 유실/지연은 폴링 안전망으로 감지.
 *   onerror / 타임아웃 → reject(호출부가 실패 문구+재시도 노출).
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
    else finishOk();
  });
}

export type ChargePhase = "idle" | "ordering" | "sdk-loading" | "sdk-ready" | "paying" | "error";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// CC-CASH-c2.2 — 충전 반영 자동 폴링: 2초 간격 최대 15회(~30초). 충전 전 잔액 대비 증가 감지 즉시 중단.
const CHARGE_POLL_INTERVAL_MS = 2000;
const CHARGE_POLL_MAX_TRIES = 15;
// 완료/갱신 상태줄 자연 소멸까지(수 초).
const STATUS_AUTODISMISS_MS = 4000;

/**
 * 캐시 충전 훅. 마운트 시 SDK 선로딩, charge() 호출 시 주문→pay→잔액 폴링.
 * @param opts.refreshBalance 현재 총 잔액(유상+무상)을 반환하는 조회 함수. 폴링 델타 판정에 사용.
 */
export function useHectoCharge(opts: { refreshBalance: () => Promise<number | null> }) {
  const { refreshBalance } = opts;
  // 마운트 즉시 SDK 선로딩 → 초기 phase=sdk-loading("준비 중" 노출). 준비되면 sdk-ready.
  const [phase, setPhase] = useState<ChargePhase>("sdk-loading");
  const [sdkError, setSdkError] = useState("");
  const [chargeStatus, setChargeStatus] = useState("");
  // CC-CASH-c2.2 — 폴링 30초 초과·미반영 시에만 수동 새로고침 노출.
  const [showManualRefresh, setShowManualRefresh] = useState(false);
  const preloadStartedRef = useRef(false);
  // 완료/갱신 상태줄 자동 소멸 타이머.
  const statusTimerRef = useRef<number | null>(null);

  // 진행 중 잠금 = 주문 생성·SDK 로드 단계만. "paying"(팝업 호출됨)은 제외 → 팝업 닫힘 후 버튼 재활성.
  const busy = phase === "ordering" || phase === "sdk-loading";

  // eager 선로딩 — 페이지 열리면 sdkUrl 확보 후 즉시 SDK 로드(클릭 전 준비 완료 목표).
  useEffect(() => {
    if (preloadStartedRef.current) return; // StrictMode 이중 마운트 가드
    preloadStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/hecto/order", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amountKrw: 1000, orderName: "cash 충전 준비" }),
        });
        if (!res.ok) throw new Error(`SDK 설정 조회 실패 (HTTP ${res.status})`);
        const order = (await res.json()) as OrderResponse;
        await ensureSdkLoaded(order.sdkUrl);
        if (cancelled) return;
        setPhase("sdk-ready");
      } catch (e) {
        if (cancelled) return;
        setSdkError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // CC-CASH-c2.2 — 완료/갱신 상태줄을 수 초 후 자연 소멸. 새 트리거마다 이전 타이머 리셋.
  const scheduleStatusClear = useCallback(() => {
    if (statusTimerRef.current != null) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setChargeStatus(""), STATUS_AUTODISMISS_MS);
  }, []);

  // 언마운트 시 상태줄 타이머 정리.
  useEffect(() => {
    return () => {
      if (statusTimerRef.current != null) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  // 주문 생성→SDK→pay 공통 흐름. orderBody 만 다름(일반결제/충전 공유 형태 유지).
  const runOrderPay = useCallback(
    async (orderBody: Record<string, unknown>) => {
      if (busy) return;
      setSdkError("");
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
          // CC-HECTO-mobile — 서버가 정한 수단(card/mobile) 그대로 사용(하드코딩 제거). 카드=기존 동작 동일.
          method: order.method,
          trdDt: order.trdDt,
          trdTm: order.trdTm,
          mchtTrdNo: order.mchtTrdNo,
          trdAmt: order.trdAmt,
          pktHash: order.pktHash,
          mchtName: "링크드롭",
          mchtEName: "LinkDrop",
          pmtPrdtNm: order.orderName,
          notiUrl: order.notiUrl,
          nextUrl: order.nextUrl,
          cancUrl: order.cancUrl,
          ...(order.mchtParam ? { mchtParam: order.mchtParam } : {}),
          ui: { type: "popup", width: 430, height: 660 },
        });
        setPhase("paying");
      } catch (e) {
        // 실패 시 반드시 잠금 해제 + 재시도 노출.
        setSdkError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [busy],
  );

  /**
   * 캐시 충전 실행. 세션 uid → mchtParam(uid=) 결제창 호출 후, 팝업 닫힘 대비 잔액 자동 폴링(2초×최대15=~30초).
   * 증가 감지 시 자동 갱신 + "충전 완료 +N cash"(수 초 후 소멸), 30초 미반영 시에만 수동 새로고침 노출.
   */
  const charge = useCallback(
    async ({
      amountKrw,
      orderName,
      payMethod = "card",
    }: {
      amountKrw: number;
      orderName: string;
      /** CC-HECTO-mobile — 결제수단. 미지정=card(기존 동작 그대로). */
      payMethod?: "card" | "mobile";
    }) => {
      if (busy) return;
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
      setShowManualRefresh(false);
      if (statusTimerRef.current != null) window.clearTimeout(statusTimerRef.current);
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id;
        if (!uid) {
          setChargeStatus("로그인이 필요해요.");
          return;
        }
        const beforeBal = await refreshBalance();
        const before = beforeBal ?? 0;
        await runOrderPay({ amountKrw, orderName, purpose: "cash_charge", userId: uid, payMethod });
        // CC-CASH-c2.2 — 팝업 닫힘 후 자동 폴링(2초×최대15=~30초). 충전 전 잔액 대비 증가 감지 즉시 중단·자동 갱신.
        //   순수 잔액 조회(결제 파이프 무관). 30초 미반영 시에만 수동 새로고침 폴백(showManualRefresh).
        setChargeStatus("결제 확인 중…");
        let reflected = false;
        for (let i = 0; i < CHARGE_POLL_MAX_TRIES; i += 1) {
          await sleep(CHARGE_POLL_INTERVAL_MS);
          const after = await refreshBalance();
          if (after != null && after >= before + amountKrw) {
            const delta = after - before;
            // 증가 감지 즉시 완료 — 잔액은 refreshBalance 가 이미 갱신. 상태줄은 수 초 후 자연 소멸.
            setChargeStatus(`충전 완료 · +${delta.toLocaleString("ko-KR")} cash`);
            scheduleStatusClear();
            reflected = true;
            break;
          }
        }
        if (!reflected) {
          // 30초 초과 미반영 → 자동 안내 대신 수동 새로고침 노출(노티 지연 가능).
          setChargeStatus("반영이 지연되고 있어요. 새로고침으로 확인하세요.");
          setShowManualRefresh(true);
        }
      } catch (e) {
        setChargeStatus(`오류: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [busy, runOrderPay, refreshBalance, scheduleStatusClear],
  );

  // CC-CASH-c2.2 — 수동 새로고침(폴백 버튼). 즉시 잔액 재조회 + 폴백 상태 정리.
  //   이용내역 갱신은 호출부(CashSection)가 loadLedger 로 함께 수행.
  const manualRefresh = useCallback(async () => {
    setShowManualRefresh(false);
    const after = await refreshBalance();
    if (after != null) {
      setChargeStatus("잔액을 갱신했어요.");
      scheduleStatusClear();
    }
  }, [refreshBalance, scheduleStatusClear]);

  return { phase, busy, chargeStatus, sdkError, charge, showManualRefresh, manualRefresh };
}
