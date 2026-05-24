import type { ReactElement } from "react";
import { InfoDropPage, type InfoDropPageProps, type DropViewVariant } from "@/components/info-drop-page";
import type { PriceOfferRow } from "@/components/ai-price-comparison-card";
import type { ReservationDateItem } from "@/components/create-drop-wizard";
import type { DropPurpose } from "@/lib/types";
import {
  MOCK_DROP_AI_BY_VARIANT,
  MOCK_DROP_VIEW_BY_VARIANT,
  MOCK_PRICE_OFFERS,
  MOCK_VIDEO_INFO,
} from "@/lib/mock-data";

export type { DropViewVariant };
export type DropVariant = DropViewVariant;

export const PUBLIC_DROP_VARIANTS = ["info", "coupon", "reservation", "purchase", "lead"] as const;

const DROP_PURPOSES: DropPurpose[] = ["정보", "쿠폰", "예약", "구매", "상담"];

const PURPOSE_TO_VARIANT: Record<DropPurpose, DropViewVariant> = {
  정보: "info",
  쿠폰: "coupon",
  예약: "reservation",
  구매: "purchase",
  상담: "lead",
};

const SLUG_TO_VARIANT: Record<string, DropViewVariant> = {
  info: "info",
  coupon: "coupon",
  reservation: "reservation",
  purchase: "purchase",
  lead: "lead",
  drop: "info",
};

export function normalizeVariant(value: unknown): DropVariant {
  if (
    value === "info" ||
    value === "coupon" ||
    value === "reservation" ||
    value === "purchase" ||
    value === "lead"
  ) {
    return value;
  }
  if (typeof value === "string") {
    const slug = value.split(",")[0]?.trim().toLowerCase();
    if (slug && SLUG_TO_VARIANT[slug]) return SLUG_TO_VARIANT[slug];
  }
  return "info";
}

/** /d/test · /d/preview-* — DB/RPC/Supabase 없이 mock만 */
export function isPublicDropMockPath(shareCode: string): boolean {
  return shareCode === "test" || shareCode.startsWith("preview-");
}

/**
 * 공유 URL(?r=)의 base64url(JSON) → 메이커 예약 가능 날짜.
 * WHY: DB 영속화 없이 Create Wizard 입력값을 /d 수신자 화면까지 전달.
 *      인코더는 create-drop-wizard.tsx 의 encodeReservationDates.
 */
export function decodeReservationDates(
  encoded: string | undefined | null,
): ReservationDateItem[] {
  if (!encoded) return [];
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) return [];
    // 최소 형태 검증 — id·mode·dates 누락/손상 항목은 버린다.
    return parsed.filter(
      (it): it is ReservationDateItem =>
        it != null &&
        typeof (it as ReservationDateItem).id === "string" &&
        ((it as ReservationDateItem).mode === "single" ||
          (it as ReservationDateItem).mode === "range" ||
          (it as ReservationDateItem).mode === "multiple") &&
        Array.isArray((it as ReservationDateItem).dates),
    );
  } catch {
    return [];
  }
}

export function parsePreviewVariant(shareCode: string): DropViewVariant | null {
  if (!shareCode.startsWith("preview-")) return null;
  try {
    const tail = decodeURIComponent(shareCode.slice("preview-".length));
    for (const slug of PUBLIC_DROP_VARIANTS) {
      if (tail === slug || tail.startsWith(`${slug}-`)) return slug;
    }
    for (const purpose of DROP_PURPOSES) {
      const prefix = `${purpose}-`;
      if (tail.startsWith(prefix) || tail === purpose) {
        return PURPOSE_TO_VARIANT[purpose];
      }
    }
    return "info";
  } catch {
    return "info";
  }
}

/** test: query variant 우선 · preview-*: slug 우선 */
export function resolvePublicDropVariant(
  shareCode: string,
  variantFromLoader?: DropViewVariant,
): DropViewVariant {
  try {
    if (shareCode === "test") {
      return normalizeVariant(variantFromLoader);
    }
    // preview-* 는 슬러그가 우선이다. validateSearch 가 ?variant= 부재 시
    // variant 를 "info" 로 정규화해 넘기므로, loader variant 를 먼저 보면
    // preview-reservation-* 도 항상 "info" 로 떨어진다. 슬러그를 먼저 본다.
    const fromPreview = parsePreviewVariant(shareCode);
    if (fromPreview) return fromPreview;
    if (variantFromLoader) return normalizeVariant(variantFromLoader);
    return "info";
  } catch {
    return "info";
  }
}

export function buildPublicDropShareUrl(shareCode: string, origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "https://app.drop.how");
  return `${base}/d/${shareCode}`;
}

function narrowIntent(variant: DropViewVariant): InfoDropPageProps["intent"] {
  if (variant === "purchase") return "commerce";
  if (variant === "lead") return "lead";
  if (variant === "coupon") return "coupon";
  if (variant === "reservation") return "reservation";
  return "info";
}

function buildFallbackMockProps(
  shareCode: string,
  variant: DropViewVariant = "info",
): InfoDropPageProps {
  const video = MOCK_VIDEO_INFO.cafeTour;
  return {
    videoThumbnailUrl: video.thumbnailUrl,
    videoDurationSec: 185,
    videoSourceLabel: "YouTube",
    maker: { name: "익명", droppedAgo: "방금 전" },
    makerMessage: "LinkDrop으로 공유된 영상입니다.",
    title: "공유된 영상",
    description: "영상 내용을 확인해 보세요.",
    aiSummary: "영상 핵심 내용을 요약했어요.",
    keyPoints: ["방문 팁", "위치 안내"],
    intent: narrowIntent(variant),
    variant,
    productName: variant === "purchase" ? "공유 상품" : undefined,
    brandGuess: variant === "purchase" ? "Helinox" : undefined,
    priceOffers:
      variant === "purchase" ? MOCK_PRICE_OFFERS.map((o) => ({ ...o })) : undefined,
    local: {
      name: "포레스트 커피",
      category: "카페 · 브런치",
      thumbnailUrl: video.thumbnailUrl,
      distance: "0.8km",
      address: "서울 성동구",
      statusLabel: "영업중",
      hoursLabel: "22:00까지",
    },
    creator: {
      channelName: video.channelName,
      channelUrl: video.channelUrl,
    },
    shareUrl: buildPublicDropShareUrl(shareCode),
  };
}

/** PublicDropShareView · InfoDropPage에 넘길 mock props (throw 없음) */
export function buildMockInfoDropProps(
  variantInput: unknown,
  shareCode: string,
  origin?: string,
): InfoDropPageProps {
  try {
    const variant = normalizeVariant(variantInput);
    const mock = MOCK_DROP_VIEW_BY_VARIANT[variant] ?? MOCK_DROP_VIEW_BY_VARIANT.info;
    const ai = MOCK_DROP_AI_BY_VARIANT[variant] ?? MOCK_DROP_AI_BY_VARIANT.info;
    const video = MOCK_VIDEO_INFO.cafeTour;
    const shareUrl = buildPublicDropShareUrl(shareCode, origin);
    const priceOffers: PriceOfferRow[] =
      variant === "purchase" ? MOCK_PRICE_OFFERS.map((o) => ({ ...o })) : [];

    return {
      videoThumbnailUrl: video.thumbnailUrl ?? "",
      videoDurationSec: 185,
      videoSourceLabel: "YouTube",
      maker: { name: "Duke", droppedAgo: "방금 전" },
      makerMessage: mock.makerMessage ?? "",
      title: mock.title ?? "공유된 영상",
      description: mock.description ?? ai.summary,
      aiSummary: ai.summary,
      keyPoints: [...(ai.keyPoints ?? [])],
      intent: narrowIntent(variant),
      variant,
      productName: mock.productName ?? (variant === "purchase" ? mock.title : undefined),
      brandGuess: mock.brandGuess,
      priceOffers: variant === "purchase" ? priceOffers : undefined,
      local: {
        name: mock.partnerName ?? "매장",
        category: variant === "reservation" ? "캠핑 · 글램핑" : "카페 · 브런치",
        thumbnailUrl: video.thumbnailUrl,
        distance: variant === "reservation" ? "가평" : "0.8km",
        address: variant === "reservation" ? "경기 가평군" : "서울 성동구",
        statusLabel: variant === "reservation" ? "예약 가능" : "영업중",
        hoursLabel: variant === "reservation" ? "체크인 15:00" : "22:00까지",
        rating: 4.8,
        reviewCount: 127,
        responseNote: "카톡 응답 빠름",
        priceRange: variant === "reservation" ? "1박 120,000원" : "평균 8,000원",
      },
      creator: {
        channelName: video.channelName ?? "채널",
        channelUrl: video.channelUrl ?? "#",
      },
      shareUrl,
    };
  } catch (err) {
    console.error("[buildMockInfoDropProps]", err);
    return buildFallbackMockProps(shareCode, normalizeVariant(variantInput));
  }
}

async function safeCopyLink(shareUrl: string) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
    }
  } catch (err) {
    console.error("[PublicDropShareView] copy", err);
  }
}

async function safeKakaoShare(props: InfoDropPageProps, shareCode: string) {
  try {
    const { shareToKakao } = await import("@/lib/kakao");
    await shareToKakao({
      title: props.title,
      description: props.makerMessage ?? props.description,
      imageUrl: props.videoThumbnailUrl,
      linkUrl: props.shareUrl ?? buildPublicDropShareUrl(shareCode),
      buttons: [
        {
          title: "보러 가기",
          link: props.shareUrl ?? buildPublicDropShareUrl(shareCode),
        },
      ],
    });
  } catch (err) {
    console.error("[PublicDropShareView] kakao", err);
    await safeCopyLink(props.shareUrl ?? buildPublicDropShareUrl(shareCode));
  }
}

/** errorComponent·fallback용 — PublicDropShareView 재호출 없이 InfoDropPage만 */
export function renderMockInfoDropPage(
  shareCode: string,
  variantInput?: DropViewVariant,
  reservationDates?: ReservationDateItem[],
  reservationUrl?: string | null,
  isReshare?: boolean,
): ReactElement {
  const variant = resolvePublicDropVariant(shareCode, variantInput);
  const props = buildMockInfoDropProps(variant, shareCode);
  // ?u= 검증 — http(s) 만 통과. javascript:/data: 등은 null 처리.
  // InfoDropPage 가 이 값으로 CTA 활성/비활성 + 안내 문구를 결정한다.
  const safeReservationUrl = (() => {
    if (!reservationUrl) return null;
    try {
      const u = new URL(reservationUrl);
      return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
    } catch {
      return null;
    }
  })();
  return (
    <InfoDropPage
      {...props}
      variant={variant}
      reservationDates={reservationDates}
      reservationUrl={safeReservationUrl}
      isReshare={isReshare}
      onWatchOriginal={() => {
        if (typeof window !== "undefined") {
          window.open("https://youtu.be/dQw4w9WgXcQ", "_blank", "noopener,noreferrer");
        }
      }}
      onCopyLink={() => safeCopyLink(props.shareUrl ?? buildPublicDropShareUrl(shareCode))}
      onKakaoShare={() => safeKakaoShare(props, shareCode)}
      onPrimaryAction={() => {
        if (!safeReservationUrl || typeof window === "undefined") return;
        window.open(safeReservationUrl, "_blank", "noopener,noreferrer");
      }}
    />
  );
}

/**
 * /d/test · /d/preview-* mock 공개 Drop.
 * SSR 비활성 라우트에서 클라이언트 렌더 — error-page HTML 삽입 방지.
 */
export function PublicDropShareView({
  shareCode,
  variant: variantFromLoader,
}: {
  shareCode: string;
  variant?: DropViewVariant;
}) {
  const code = shareCode || "test";
  const variant = resolvePublicDropVariant(code, variantFromLoader);

  if (!isPublicDropMockPath(code)) {
    console.warn("[PublicDropShareView] non-mock path, using mock fallback", code);
  }

  return renderMockInfoDropPage(code, variant);
}
