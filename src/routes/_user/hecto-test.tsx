// /hecto-test — 헥토 표준결제창 SDK 연동 테스트베드 (v1.5, 실결제 검증용).
//   POST /api/hecto/order 로 결제창 호출 파라미터(암호화 금액 + 무결성 해시)를 받고,
//   결제창 SDK(SETTLE_PG)를 서버가 알려준 sdkUrl 에서 로드해 SETTLE_PG.pay() 로 팝업을 띄운다.
//   ⚠️ 주문 확정은 이 화면(리턴)이 아니라 서버-서버 노티(/api/hecto/noti) 기준.
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/_user/hecto-test")({ component: HectoTestPage });

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

  // 진행 중 잠금 — 주문/로드/호출 단계에서만 버튼 비활성. error/idle/ready 는 다시 누를 수 있어야 함.
  const busy = phase === "ordering" || phase === "sdk-loading" || phase === "paying";

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

  const onPay = useCallback(async () => {
    // ④ 향후 진단용 — 클릭 시점 상태 1줄.
    console.log("[hecto-test] pay click", { phase, busy, hasSdk: Boolean(getSettlePg()) });
    if (busy) return;

    setErrorMsg("");
    setPhase("ordering");
    try {
      const res = await fetch("/api/hecto/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountKrw: 1000, orderName: "링크드랍 테스트결제" }),
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
        ui: { type: "popup", width: 430, height: 660 },
      });
      setPhase("paying");
    } catch (e) {
      // ③ 실패 시 반드시 잠금 해제 + 재시도 노출.
      setErrorMsg(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [phase, busy]);

  const statusText = phase === "error" && errorMsg ? `로드 실패 — ${errorMsg}` : PHASE_LABEL[phase];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-ko text-strong">헥토 결제창 테스트</h1>
        <p className="text-sm tracking-ko text-muted">
          표준결제창 SDK(SETTLE_PG) 연동 확인용 테스트베드입니다.
        </p>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={busy}
        className="min-h-[44px] min-w-[44px] rounded-lg bg-accent px-6 font-semibold tracking-ko text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "처리 중…" : "테스트 결제 1,000원"}
      </button>

      {/* ② 상태줄 — 사용자가 왜 눌리는지/안 눌리는지 보이게. 실패 시 재시도 버튼. */}
      <div className="flex items-center gap-3">
        <p className="text-sm tracking-ko text-muted">
          상태: <span className={phase === "error" ? "text-red-600" : "text-strong"}>{statusText}</span>
        </p>
        {phase === "error" && (
          <button
            type="button"
            onClick={onPay}
            className="min-h-[44px] rounded-lg border border-border px-4 text-sm font-semibold tracking-ko text-strong hover:-translate-y-0.5"
          >
            재시도
          </button>
        )}
      </div>

      <p className="rounded-lg bg-surface p-4 text-xs tracking-ko text-muted">
        ⚠️ 주문 확정은 <span className="font-semibold text-strong">노티(서버-서버 통보) 기준</span>
        입니다. 결제창의 완료/취소 리턴은 참고용이며 위·변조 가능합니다.
      </p>
    </div>
  );
}
