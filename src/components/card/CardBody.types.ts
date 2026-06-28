import type { ReactNode } from "react";
import type { DropPurpose } from "@/lib/types";
import type { CouponPreviewCoupon } from "@/components/receiver/CouponPreview";

/**
 * 단일 카드 본체 props 계약 (CardBodyProps).
 *
 * 스튜디오 미리보기(mode="preview")와 손님 /d(mode="live")가 **같은 CardBody**를 렌더하기 위한
 * presentational 계약. CardBody 는 데이터 출처(state/RPC)를 모르고 props 만 받는다(react-email 패턴).
 * container(studio-build / info-drop-page)가 각자 어댑터로 데이터를 이 형태로 변환해 주입한다.
 *
 * ★ 이 단계는 "타입 선언만" — 어디서도 import/사용하지 않는다(렌더·기존 코드 무변경, 위험 0).
 *
 * 단일 출처:
 *  - VideoSlot = YouTubeLiteEmbed 시그니처. 영상 데이터 계약의 정본(여기로 이동, studio-build 가 import).
 *  - CouponPreviewCoupon = CouponPreview 가 받는 coupon 형태(CouponPreview.tsx 에서 import).
 *  - DropPurpose = @/lib/types.
 */

/** 영상 슬롯 데이터 형태 — YouTubeLiteEmbed 시그니처. (스튜디오 selectedVideo / 손님 어댑터 공통.) */
export type VideoSlot = {
  videoId: string;
  thumbnailUrl: string;
  title: string;
  isShorts: boolean;
  durationLabel?: string;
  sourceLabel?: string;
};

export type CardBodyProps = {
  /** preview=버튼 시각만(제작층) / live=실기능 슬롯 주입(출고층). Plate readOnly 패턴. */
  mode: "preview" | "live";
  /** 카드 배경색 — navy 등(양쪽 동일, 메이커가 고른 값). */
  cardColor: string;
  /** 영상 슬롯 — YouTubeLiteEmbed 시그니처. 없으면 null(미선택/placeholder). */
  video: VideoSlot | null;
  /** 제목 — 매장명(스튜디오) / 영상 헤드라인(손님). 의미 결정은 container 몫. */
  title: string;
  /** 부제 — 메이커 한마디(스튜디오) / 영상 제목·부제(손님). */
  tagline: string;
  /** 셀링포인트 불릿 — pickedPoints(스튜디오) / keyPoints(손님). */
  sellingPoints: string[];
  /** 쿠폰 — CouponPreview 계약. 없으면 null. */
  coupon: CouponPreviewCoupon | null;
  /** 매장 정보 — studio store / 손님 local 공통 매핑(name/phone/address/reservationUrl). */
  store?: {
    name: string;
    phone?: string;
    address?: string;
    reservationUrl?: string | null;
  } | null;
  /** 목적 — 정보/쿠폰/예약/구매/상담(drop_purpose 공통 enum). variant 분기 신호. */
  purpose: DropPurpose;

  // ── 실기능 슬롯 — live 에서만 container 가 주입(연락 실동작) ──
  //   reservationSlot·ctaSlot 은 3d 에서 제거(§6② 미사용 live전용 안티패턴). 블록 슬롯이 정본.
  /** 연락 row 실버튼(전화/문자/길찾기, 손님). */
  contactSlot?: ReactNode;

  // ── §2-1 하단 블록 슬롯 — container 가 균일 스택으로 주입(쿠폰·예약·연락). ──
  //   전부 optional. 주어지면 CardBody 가 균일 ButtonBlock 스택으로 그림(reservation/contact 는
  //   "예약 날짜 선택"/"정보 보기" ButtonBlock 으로 래핑). 미주입이면 기존 coupon/슬롯 경로 유지.
  /** 쿠폰 블록 — 그대로 렌더(이미 카드형). 없으면 기존 coupon prop 경로. */
  couponBlock?: ReactNode | null;
  /** 예약 블록 — "예약 날짜 선택" ButtonBlock 펼침 콘텐츠로 주입. */
  reservationBlock?: ReactNode | null;
  /** 연락 블록 — "정보 보기" ButtonBlock 펼침 콘텐츠로 주입. */
  contactBlock?: ReactNode | null;
};
