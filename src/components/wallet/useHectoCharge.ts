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
  const preloadStartedRef = useRef(false);

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
          method: "card",
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
   * 캐시 충전 실행. 세션 uid → mchtParam(uid=) 결제창 호출 후, 팝업 닫힘 대비 잔액 폴링(3회·3초).
   * 반영 감지 시 완료 문구, 미반영 시 대기 안내(노티 지연 가능).
   */
  const charge = useCallback(
    async ({ amountKrw, orderName }: { amountKrw: number; orderName: string }) => {
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
      try {
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id;
        if (!uid) {
          setChargeStatus("로그인이 필요해요.");
          return;
        }
        const beforeBal = await refreshBalance();
        const before = beforeBal ?? 0;
        await runOrderPay({ amountKrw, orderName, purpose: "cash_charge", userId: uid });
        // 팝업 닫힘 대비 — 노티 반영 폴링(3회·3초). 반영되면 완료, 아니면 대기 안내.
        setChargeStatus("결제창 종료 — cash 반영 확인 중…");
        for (let i = 0; i < 3; i += 1) {
          await sleep(3000);
          const after = await refreshBalance();
          if (after != null && after >= before + amountKrw) {
            setChargeStatus(`충전 완료 · cash ${amountKrw.toLocaleString("ko-KR")} 지급`);
            return;
          }
        }
        setChargeStatus("반영 대기 — 잠시 후 새로고침으로 확인하세요. (노티 지연 가능)");
      } catch (e) {
        setChargeStatus(`오류: ${e instanceof Error ? e.message : String(e)}`);
      }
    },
    [busy, runOrderPay, refreshBalance],
  );

  return { phase, busy, chargeStatus, sdkError, charge };
}
