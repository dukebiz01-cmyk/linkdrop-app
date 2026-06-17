// [CREATE] 커머스 A-1 — 주문/결제/배송 상태 전이 머신.
//
// ⚠️ 순수 함수, 부수효과 0. 전이 규칙의 단일 진실원천. DB/Supabase/UI 0.
//   백엔드(B)가 상태를 바꾸기 전에 canTransition* 로 검증한다.

import type { OrderStatus, PaymentStatus, ShipmentStatus } from "./types";

// 허용 전이표 — from → 갈 수 있는 to 들. 표에 없는 from/to 쌍은 전부 불허(false).

/** order: created→paid→preparing→shipped→in_transit→delivered→settled, created/paid→canceled. */
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ["paid", "canceled"],
  paid: ["preparing", "canceled"],
  preparing: ["shipped"],
  shipped: ["in_transit"],
  in_transit: ["delivered"],
  delivered: ["settled"],
  settled: [],
  canceled: [],
};

/** payment: pending→paid, paid→refunded, pending→failed. */
const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ["paid", "failed"],
  paid: ["refunded"],
  failed: [],
  refunded: [],
};

/** shipment: preparing→shipped→in_transit→delivered. */
const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  preparing: ["shipped"],
  shipped: ["in_transit"],
  in_transit: ["delivered"],
  delivered: [],
};

/** 주문 상태 전이 허용 여부. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** 결제 상태 전이 허용 여부. */
export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** 배송 상태 전이 허용 여부. */
export function canTransitionShipment(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from].includes(to);
}
