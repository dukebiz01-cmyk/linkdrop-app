import { reservationItemFullLabel } from "@/components/create/step3/reservation-helpers";
import {
  PURPOSE_FLOW_CONFIG,
  type AiPreviewData,
  type ReservationSummary,
  type Step3FieldState,
  type VideoInfo,
} from "@/components/create/types";
import type { DropPurpose } from "@/lib/types";
import type { VideoMetadata } from "@/lib/video-metadata";
import type { WizardSharePreviewData } from "@/components/wizard-share-preview";

export function videoInfoFromMetadata(meta: VideoMetadata, fallbackUrl: string): VideoInfo {
  const platform =
    meta.platform === "instagram"
      ? "instagram"
      : meta.platform === "youtube"
        ? "youtube"
        : "youtube";
  return {
    url: meta.sourceUrl || fallbackUrl,
    thumbnailUrl: meta.thumbnailUrl ?? "",
    title: meta.title,
    channelName: meta.authorName ?? "",
    duration: "",
    platform,
  };
}

export function createEmptyStep3Fields(): Step3FieldState {
  return {
    summaryTone: "짧게",
    shareMessage: "",
    couponName: "",
    discountText: "",
    useCondition: "",
    expiryDate: "",
    dateMode: "날짜 직접 선택",
    guestCount: "2명",
    petAllowed: false,
    bookingLink: "",
    reservationDest: "",
    reservationVertical: "stay",
    scheduleMode: "checkin_checkout",
    // 기본값 "빈자리/취소자리" — 예약 유형 미선택으로 게이트가 막히지 않게 한다.
    // stay 템플릿의 가장 일반적인 시작점. RESERVATION_TYPE_OPTIONS[0] 와 일치(변경 시 동기화).
    reservationType: "빈자리/취소자리",
    // 기본값 "전체" — 사이트/객실 미선택으로 게이트가 막히지 않게 한다.
    facilityTarget: "전체",
    facilityCustom: "",
    placeName: "",
    placeAddress: "",
    placePhone: "",
    placeMapUrl: "",
    placeSource: "",
    reservationDates: [],
    checkInTime: "",
    checkOutTime: "",
    baseGuests: "",
    maxGuests: "",
    facilityDetail: "",
    cautionNote: "",
    couponCondition: "",
    operatorNote: "",
    eventDetail: "",
    productKeyword: "",
    priceCompareEnabled: true,
    productCount: "3개",
    purchaseLink: "",
    collectContact: true,
    consultItem: "",
    ctaCopy: "",
    privacyNotice: "문의 시 개인정보 수집·이용에 동의합니다.",
    shareMessageUserAction: null,
    infoHeadline: "",
    infoHeadlineUserAction: null,
    infoKeyPoints: [],
    infoChecklist: [],
    infoQuote: "",
  };
}

export function aiPreviewFromPurpose(p: DropPurpose): AiPreviewData {
  const flow = PURPOSE_FLOW_CONFIG[p];
  return {
    title: flow.title,
    summary: flow.description,
    keyPoints: flow.points,
    suggestedShareText: `${flow.title} — ${flow.description}`,
  };
}

export function platformLabel(platform: VideoInfo["platform"]): string {
  return platform === "youtube" ? "YouTube" : "Instagram";
}

export function buildWizardShareData(
  videoInfo: VideoInfo,
  purpose: DropPurpose,
  aiTitle: string,
  makerMessage?: string,
  reservation?: ReservationSummary,
): WizardSharePreviewData {
  return {
    video: {
      thumbnailUrl: videoInfo.thumbnailUrl,
      title: videoInfo.title,
      channelName: videoInfo.channelName,
      duration: videoInfo.duration,
      platformLabel: platformLabel(videoInfo.platform),
    },
    purpose,
    aiTitle,
    makerMessage,
    reservation: reservation
      ? {
          placeName: reservation.placeName,
          destLabel: reservation.destLabel,
          hasReserveButton: reservation.hasReserveButton,
          // 날짜별 status·remainingCount·event·memo 를 항목 단위로 그대로 전달.
          dates: reservation.dates.map((item) => ({
            main: reservationItemFullLabel(item),
            event: item.eventTitle,
            memo: item.memo,
          })),
        }
      : undefined,
  };
}
