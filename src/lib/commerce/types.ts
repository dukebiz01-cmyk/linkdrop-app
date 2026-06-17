// [CREATE] 커머스 A-1 — 계약 코어 / 데이터 계약 타입.
//
// ⚠️ 테이블 아님 — 순수 타입 계약만. DB/Supabase/RPC/React 0.
//   백엔드(B)가 이 형태로 영속화하고, 화면(A-2)이 이 형태로 읽는다. 단일 진실원천.
//   잠금 용어: Creator/Maker/Friend/Local/LinkDrop.
//     - makerUserId = 드롭을 만든 Maker(판매 연결 주체)
//     - partnerId   = 정산 대상 Local(사업자)
//     - buyerUserId = 구매한 Friend

/** 결제 상태 — PG 승인 라이프사이클. */
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

/** 주문 상태 — 결제→준비→배송→정산 전 구간. */
export type OrderStatus =
  | "created"
  | "paid"
  | "preparing"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "settled"
  | "canceled";

/** 배송 상태 — 운송장 기준 물류 라이프사이클. */
export type ShipmentStatus = "preparing" | "shipped" | "in_transit" | "delivered";

/** 배송 권역 — 도서산간 할증 분기 키. */
export type RegionType = "normal" | "jeju" | "remote";

/** 결제 수단(주입 provider) — 현재 mock, 추후 toss/portone 교체. */
export type PaymentProviderKind = "mock" | "toss" | "portone";

/** 주문 1건. 금액은 원(KRW) 정수 기준. */
export interface Order {
  id: string;
  buyerUserId: string;
  partnerId: string;
  makerUserId: string;
  /** 이 주문이 발생한 공유 엣지(share_events) — 보상/귀속 추적용. */
  shareEventId: string;
  /** 상품 금액 합(배송비 제외). */
  productAmount: number;
  shippingFee: number;
  /** productAmount + shippingFee. */
  totalAmount: number;
  regionType: RegionType;
  paymentProvider: PaymentProviderKind;
  /** PG 결제 식별자(승인 후 채워짐). 미결제면 null. */
  paymentKey: string | null;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
  /** 결제 승인 시각. 미결제면 null. */
  paidAt: string | null;
}

/** 주문 항목 1건. */
export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  /** 배송비 산정 기준 무게(kg). */
  weightKg: number;
}

/** 배송 1건(운송장). */
export interface Shipment {
  id: string;
  orderId: string;
  /** 택배사 — 기본 '우체국택배'. */
  carrier: string;
  /** 운송장 번호. 발송 전이면 null. */
  invoiceNo: string | null;
  status: ShipmentStatus;
  /** 배송 추적 연동 — 기본 'goodsflow'. */
  trackingProvider: string;
  /** goodsflow 연동 참조키. 미연동이면 null. */
  goodsflowRef: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
}

/** Shipment 기본값 — carrier/trackingProvider 기본 적재 시 사용. */
export const SHIPMENT_DEFAULT_CARRIER = "우체국택배";
export const SHIPMENT_DEFAULT_TRACKING_PROVIDER = "goodsflow";
