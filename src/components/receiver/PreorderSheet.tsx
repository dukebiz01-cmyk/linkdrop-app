import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Phone, Minus, Plus, CheckCircle2, Truck, Coins } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { getSupabase } from "@/lib/supabase";

/**
 * ③b 선주문 시트 — /d commerce(농가 자체업로드 상품) "선주문하기" 펀널.
 *   ReserveFunnelSheet 1:1 미러: 바텀시트 + 4-state(form/submitting/done/error).
 *   결제는 스텁(농가 직접결제 안내 + 전화). create_preorder(③a) 로 주문 리드만 캡처.
 *   카톡 로그인 강제는 부모(d.$shareUuid)가 담당 — 시트는 userId 있을 때만 렌더된다.
 *
 * ⚠️ create_preorder RPC 는 ③a 에서 신설/타입 재생성 예정. 현재 types.ts 미반영이라
 *    rpc 호출을 로컬 캐스트로 우회(TEMP). 타입 재생성 후 캐스트 제거.
 */

type Step = "form" | "submitting" | "done" | "error";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dropId: string;
  shareUuid: string;
  productName: string;
  unitPriceKrw: number;
  harvestDate: string | null;
  stockLimit: number | null;
  partnerPhone: string | null;
  /** UI-5-T7-F6-4b — 배송형 여부(ship_method '직접 전달'만 false — 서버 게이트와 동일 규칙).
   *  미지정 = true(택배 전제 — 현행 등록 폼 축). */
  isDelivery?: boolean;
};

// "YYYY-MM-DD" → "M월 D일 수확·발송 예정". 형식 안 맞으면 원문.
function formatHarvest(iso: string): string {
  const parts = iso.split("-");
  const m = parts[1];
  const d = parts[2];
  return m && d ? `${Number(m)}월 ${Number(d)}일 수확·발송 예정` : iso;
}

export function PreorderSheet({
  open,
  onOpenChange,
  dropId,
  shareUuid,
  productName,
  unitPriceKrw,
  harvestDate,
  stockLimit,
  partnerPhone,
  isDelivery = true,
}: Props) {
  const [step, setStep] = useState<Step>("form");
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState("");
  // F6-4b — 배송 정보 4필드(배송형만 노출·검증 — 서버 게이트 v7.12 와 동일 규칙).
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddressDetail, setShippingAddressDetail] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("form");
      setQty(1);
      setMessage("");
      setReceiverName("");
      setReceiverPhone("");
      setShippingAddress("");
      setShippingAddressDetail("");
      setErrorMsg(null);
    }
  }, [open]);

  const maxQty = stockLimit && stockLimit > 0 ? stockLimit : null;
  const total = unitPriceKrw * qty;

  function dec() {
    setQty((q) => Math.max(1, q - 1));
  }
  function inc() {
    setQty((q) => (maxQty != null ? Math.min(maxQty, q + 1) : q + 1));
  }

  async function handleSubmit() {
    if (step !== "form") return;
    // F6-4b — 배송형 클라 선검증(무언 실패 금지 — 서버 v7.12 게이트의 거울).
    if (isDelivery && !(receiverName.trim() && receiverPhone.trim() && shippingAddress.trim())) {
      setErrorMsg("배송 정보(받는 분·연락처·주소)를 입력해 주세요.");
      return;
    }
    setErrorMsg(null);
    setStep("submitting");
    try {
      const supabase = getSupabase();
      // create_preorder 가 types.ts 미반영(③a). client.rpc 를 변수로 분리하면 this 분실
      //   ('rest' 에러) → supabase.rpc 를 메서드로 직접 호출하고, 캐스트는 인자(as never)·결과에만.
      const { error } = (await supabase.rpc(
        "create_preorder" as never,
        {
          p_drop_id: dropId,
          p_quantity: qty,
          p_share_uuid: shareUuid,
          p_customer_message: message.trim() || null,
          // F6-4b — 배송지 4인자(v7.12). 픽업형(직접 전달)은 NULL 그대로.
          p_receiver_name: isDelivery ? receiverName.trim() : null,
          p_receiver_phone: isDelivery ? receiverPhone.trim() : null,
          p_shipping_address: isDelivery ? shippingAddress.trim() : null,
          p_shipping_address_detail:
            isDelivery && shippingAddressDetail.trim() ? shippingAddressDetail.trim() : null,
        } as never,
      )) as { error: { message?: string } | null };
      if (error) {
        const m = error.message ?? "";
        setErrorMsg(
          m.includes("마감")
            ? "주문예약이 마감됐어요. (수량 한정)"
            : m.includes("로그인")
              ? "로그인이 필요해요. 다시 시도해 주세요."
              : m.includes("가격")
                ? "상품 가격 정보를 확인할 수 없어요."
                : "주문 접수에 실패했어요. 잠시 후 다시 시도해 주세요.",
        );
        setStep("error");
        return;
      }
      setStep("done");
    } catch (e) {
      console.error("[PreorderSheet] submit failed:", e);
      setErrorMsg("처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.");
      setStep("error");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-6 tracking-ko">
        {step === "form" ? (
          <div className="space-y-4">
            <header>
              <SheetTitle className="text-lg font-bold tracking-ko text-text-strong">주문예약</SheetTitle>
              {/* F6-4b — 배송형 톤 정합("전화 확정" → "입력 주소 배송"). 픽업형 기존 유지. */}
              <p className="mt-1 text-sm font-medium tracking-ko text-text-muted">
                {isDelivery
                  ? "결제는 농가와 전화로 확정해요. 상품은 입력하신 주소로 배송해 드려요."
                  : "결제는 농가와 직접 확정해요. 주문을 보내면 농가가 연락드려요."}
              </p>
            </header>

            <div className="space-y-3">
              {/* 상품 + 발송일 */}
              <div className="rounded-xl border border-border bg-surface px-4 py-3">
                <p className="text-sm font-bold tracking-ko text-text-strong">
                  {productName || "상품"}
                </p>
                {harvestDate ? (
                  <p className="mt-1 text-xs font-medium tracking-ko text-text-muted">
                    {formatHarvest(harvestDate)}
                  </p>
                ) : null}
              </div>

              {/* 수량 stepper */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold tracking-ko text-text-strong">수량</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={dec}
                    disabled={qty <= 1}
                    aria-label="수량 줄이기"
                    className="flex size-11 items-center justify-center rounded-lg border border-border text-text-strong transition-colors hover:border-text-muted disabled:opacity-40"
                  >
                    <Minus className="size-4" strokeWidth={2} />
                  </button>
                  <span className="min-w-[2ch] text-center text-base font-bold tabular-nums tracking-ko text-text-strong">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={inc}
                    disabled={maxQty != null && qty >= maxQty}
                    aria-label="수량 늘리기"
                    className="flex size-11 items-center justify-center rounded-lg border border-border text-text-strong transition-colors hover:border-text-muted disabled:opacity-40"
                  >
                    <Plus className="size-4" strokeWidth={2} />
                  </button>
                </div>
              </div>
              {maxQty != null ? (
                <p className="text-right text-xs font-medium tracking-ko text-text-subtle">
                  최대 {maxQty}개 (한정)
                </p>
              ) : null}

              {/* 합계 */}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-sm font-semibold tracking-ko text-text-strong">합계</span>
                <span className="text-lg font-extrabold tracking-ko text-text-strong">
                  {total.toLocaleString("ko-KR")}원
                </span>
              </div>

              {/* UI-5-T7-F6-4b — 배송 정보(배송형만 · 픽업형 미렌더). 30초 완결 원칙 — 4필드 추가
                  외 구조 무변. 주소 검색(다음 우편번호)은 현행 미사용 확인 → 수동 입력, 검색 도입 후속. */}
              {isDelivery ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-xs font-semibold tracking-ko text-text-strong">배송 정보</p>
                  <input
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="받는 분"
                    autoComplete="name"
                    className="block w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                  />
                  <input
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="연락처 (예: 010-1234-5678)"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="block w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                  />
                  <input
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="주소"
                    autoComplete="street-address"
                    className="block w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                  />
                  <input
                    value={shippingAddressDetail}
                    onChange={(e) => setShippingAddressDetail(e.target.value)}
                    placeholder="상세 주소 (동·호수 등, 선택)"
                    className="block w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                  />
                </div>
              ) : null}

              {/* 요청 메시지 (선택) */}
              <label className="block">
                <span className="text-xs font-semibold tracking-ko text-text-strong">
                  요청 메시지 (선택)
                </span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={2}
                  placeholder="예: 덜 익은 걸로 보내주세요"
                  className="mt-1 block w-full resize-none rounded-xl border border-border bg-bg px-4 py-3 text-sm font-medium tracking-ko text-text-strong placeholder:text-text-subtle"
                />
              </label>

              {/* 결제 안내(스텁) — 농가 직접결제 + 전화 + 포인트 준비중 */}
              <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
                <p className="flex items-start gap-2 text-sm font-medium leading-relaxed tracking-ko text-text-muted">
                  <Truck className="mt-0.5 size-4 shrink-0 text-text-subtle" strokeWidth={2} />
                  {isDelivery
                    ? "결제는 준비중이에요. 주문 후 농가와 전화로 결제를 확정하면, 입력하신 주소로 배송해 드려요."
                    : "결제는 준비중이에요. 주문 후 농가에 전화로 결제·배송을 확정해주세요."}
                </p>
                {partnerPhone ? (
                  <a
                    href={`tel:${partnerPhone}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-action px-4 text-sm font-semibold tracking-ko text-action-foreground"
                  >
                    <Phone className="size-4" strokeWidth={2} />
                    농가에 전화하기
                  </a>
                ) : null}
                <p className="flex items-center gap-1.5 text-xs font-medium tracking-ko text-text-subtle">
                  <Coins className="size-3.5" strokeWidth={2} />
                  획득 포인트 — 준비중
                </p>
              </div>
            </div>

            {errorMsg ? (
              <p className="text-sm font-medium tracking-ko text-intent-danger">{errorMsg}</p>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-action px-6 py-3 text-base font-bold tracking-ko text-action-foreground"
            >
              주문하기
            </button>
          </div>
        ) : step === "submitting" ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <span
              className="size-8 animate-spin rounded-full border-2 border-border border-t-action"
              aria-hidden
            />
            <p className="text-sm font-semibold tracking-ko text-text-strong">
              주문을 보내고 있어요…
            </p>
          </div>
        ) : step === "done" ? (
          <div className="space-y-5 pt-2">
            <div className="flex justify-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-surface">
                <CheckCircle2 className="size-7 text-text-strong" strokeWidth={2} />
              </span>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold tracking-ko text-text-strong">주문이 접수됐어요</h2>
              <p className="mt-2 text-sm font-medium tracking-ko text-text-muted">
                {isDelivery
                  ? "결제는 농가와 전화로 확정해 주세요. 상품은 입력하신 주소로 배송돼요."
                  : "결제·배송은 농가와 전화로 확정해 주세요."}
              </p>
            </div>
            {partnerPhone ? (
              <a
                href={`tel:${partnerPhone}`}
                className="flex w-full min-h-[48px] items-center justify-center gap-1.5 rounded-2xl border border-border bg-bg px-6 text-base font-semibold tracking-ko text-text-strong"
              >
                <Phone className="size-4" strokeWidth={2} />
                농가에 전화하기
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-action px-6 text-base font-bold tracking-ko text-action-foreground"
            >
              확인
            </button>
            {/* 주문 접수 후 손님 본인 주문상태 화면으로(읽기전용). */}
            <Link
              to="/me-orders"
              className="flex w-full min-h-[44px] items-center justify-center text-sm font-medium tracking-ko text-text-muted underline-offset-2 hover:text-text-strong hover:underline"
            >
              내 주문에서 상태 확인하기
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-6 text-center">
            <h2 className="text-lg font-bold tracking-ko text-text-strong">주문에 실패했어요</h2>
            <p className="text-sm font-medium tracking-ko text-text-muted">
              {errorMsg ?? "잠시 후 다시 시도해 주세요."}
            </p>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="flex w-full min-h-[48px] items-center justify-center rounded-2xl bg-action px-6 text-base font-bold tracking-ko text-action-foreground"
            >
              다시 시도
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
