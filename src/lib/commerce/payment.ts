// [CREATE] 커머스 A-1 — 결제 provider 계약.
//
// ⚠️ 순수 로직. Supabase/DB/UI 0. PG 실연동(Toss/PortOne)은 이 인터페이스 뒤로 교체.
//   주입점 = paymentProvider. 호출자는 항상 인터페이스만 보고, 구현은 갈아끼운다.

/** 결제 요청 — 주문 단위. amount 는 원(KRW) 정수. */
export interface PaymentRequest {
  orderId: string;
  amount: number;
  orderName: string;
  buyer: { name?: string; phone?: string };
}

/** 결제 결과 — 승인/실패 + PG 식별자. */
export interface PaymentResult {
  ok: boolean;
  paymentKey: string;
  status: "paid" | "failed";
}

/** 결제 provider — 모든 PG 구현의 공통 계약. */
export interface PaymentProvider {
  requestPayment(req: PaymentRequest): Promise<PaymentResult>;
}

/**
 * Mock 결제 provider — 개발/계약 검증용.
 *
 * ⚠️ 즉시-동기 반환 금지. 실 PG 는 '결제대기 → (비동기) 승인' 흐름이라,
 *    교체 시 호출부가 안 깨지도록 여기서도 await(짧은 지연) 후 승인을 흉내 낸다.
 *    paymentKey = mock_${crypto.randomUUID()}.
 *    멱등(중복 승인 방지)은 호출자가 paymentKey/orderId UNIQUE 로 처리한다(여기 책임 아님).
 */
export class MockProvider implements PaymentProvider {
  async requestPayment(req: PaymentRequest): Promise<PaymentResult> {
    // '결제대기' 단계 — 실 PG 의 비동기 승인 콜백을 흉내 내는 짧은 대기.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    // '승인' 단계 — 항상 성공으로 응답(실패 시뮬레이션은 실 provider 책임).
    void req;
    return {
      ok: true,
      paymentKey: `mock_${crypto.randomUUID()}`,
      status: "paid",
    };
  }
}

/** 주입점 — 나중 Toss/PortOne provider 로 이 한 줄만 교체. */
export const paymentProvider: PaymentProvider = new MockProvider();
