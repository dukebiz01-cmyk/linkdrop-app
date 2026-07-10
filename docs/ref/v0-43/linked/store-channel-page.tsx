"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MapPin,
  Clock,
  Phone,
  Globe,
  Star,
  ChevronLeft,
  ChevronRight,
  Share2,
  X,
  ExternalLink,
  Play,
  Ticket,
  Calendar,
  Navigation,
} from "lucide-react";

// ============================================================
// Store Channel Page (/c/[slug])
// WHY: 매장의 "공식 홈페이지" = 진짜 운영 도구
// WHY: 모든 가치 (Drop + 쿠폰 + 예약 + 리뷰) 통합 진입점
// WHY: 무로그인 = 발견 + 진짜 매장 검색 유입
// ============================================================

export interface StoreInfo {
  slug: string;
  name: string;
  heroImageUrl: string;
  category: string;
  isVerified: boolean;
  rating: number;
  reviewCount: number;
  address: string;
  hours: string;
  phone: string;
  website?: string;
  tags: string[];
  description?: string;
}

export interface GalleryImage {
  id: string;
  url: string;
  alt: string;
}

export interface StoreCoupon {
  id: string;
  title: string;
  subtitle: string;
  expiryDate: string;
  remainingCount?: number;
}

export interface StoreDropper {
  id: string;
  name: string;
  avatarUrl?: string;
  videoThumbnailUrl: string;
  videoTitle: string;
  droppedAgo: string;
  views: number;
  regulars: number;
}

export interface StoreReview {
  id: string;
  authorName: string;
  authorAvatarUrl?: string;
  rating: number;
  text: string;
  date: string;
}

export interface StoreChannelPageProps {
  store: StoreInfo;
  gallery: GalleryImage[];
  coupons: StoreCoupon[];
  droppers: StoreDropper[];
  reviews: StoreReview[];
  hasReservation?: boolean;
  onBack?: () => void;
  onShare?: () => void;
  onClaimCoupon?: (couponId: string) => void;
  onReservation?: () => void;
  onCall?: () => void;
  onDirections?: () => void;
  onViewDrop?: (dropperId: string) => void;
}

export function StoreChannelPage({
  store,
  gallery,
  coupons,
  droppers,
  reviews,
  hasReservation = true,
  onBack,
  onShare,
  onClaimCoupon,
  onReservation,
  onCall,
  onDirections,
  onViewDrop,
}: StoreChannelPageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  const nextImage = () => {
    setLightboxIndex((prev) => (prev + 1) % gallery.length);
  };

  const prevImage = () => {
    setLightboxIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  };

  return (
    <div className="relative min-h-screen bg-white pb-32">
      {/* 1. Hero Header */}
      <div className="relative">
        <div className="h-[240px] w-full overflow-hidden bg-[#F5F5F5]">
          <img
            src={store.heroImageUrl}
            alt={store.name}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Overlay buttons */}
        <button
          onClick={onBack}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-colors hover:bg-black/50"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5 text-white" />
        </button>
        <button
          onClick={onShare}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm transition-colors hover:bg-black/50"
          aria-label="공유"
        >
          <Share2 className="h-5 w-5 text-white" />
        </button>
      </div>

      <main className="px-5">
        {/* Store name and meta */}
        <div className="pt-5">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold text-[#0A0A0A]">{store.name}</h1>
            {store.isVerified && (
              <span className="rounded-full bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-medium text-[#16A34A]">
                협회 인증 ✓
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[#525252]">{store.category}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
            <span className="text-sm font-semibold text-[#0A0A0A]">{store.rating}</span>
            <span className="text-sm text-[#525252]">(리뷰 {store.reviewCount}개)</span>
          </div>
        </div>

        {/* 2. Info Card */}
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-elevated">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#A3A3A3]" />
              <span className="text-[15px] text-[#525252]">{store.address}</span>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#A3A3A3]" />
              <span className="text-[15px] text-[#525252]">{store.hours}</span>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#A3A3A3]" />
              <span className="text-[15px] text-[#525252]">{store.phone}</span>
            </div>
            {store.website && (
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 shrink-0 text-[#A3A3A3]" />
                <a
                  href={store.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[15px] text-[#0A0A0A] hover:underline"
                >
                  홈페이지 방문
                </a>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mt-4 flex flex-wrap gap-2">
            {store.tags.map((tag, index) => (
              <span
                key={index}
                className="rounded-full bg-[#F5F5F5] px-3 py-1 text-xs font-medium text-[#525252]"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* 3. Photo Gallery */}
        {gallery.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-[#0A0A0A]">사진</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {gallery.slice(0, 6).map((img, index) => (
                <button
                  key={img.id}
                  onClick={() => openLightbox(index)}
                  className="relative aspect-square overflow-hidden rounded-lg bg-[#F5F5F5]"
                >
                  <img
                    src={img.url}
                    alt={img.alt}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                  />
                  {index === 5 && gallery.length > 6 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <span className="text-lg font-semibold text-white">
                        +{gallery.length - 6}
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Coupons Section */}
        {coupons.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#0A0A0A]">이 매장의 쿠폰</h2>
            <div className="mt-3 space-y-3">
              {coupons.slice(0, 3).map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#0A0A0A]">{coupon.title}</p>
                    <p className="mt-0.5 text-sm text-[#525252]">{coupon.subtitle}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-[#A3A3A3]">
                        {coupon.expiryDate}까지
                      </span>
                      {coupon.remainingCount && (
                        <span className="rounded bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-medium text-[#B91C1C]">
                          {coupon.remainingCount}개 남음
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onClaimCoupon?.(coupon.id)}
                    className="ml-3 flex h-10 items-center gap-1.5 rounded-lg bg-[#0A0A0A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#171717]"
                  >
                    <Ticket className="h-4 w-4" />
                    받기
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Reservation Calendar (if applicable) */}
        {hasReservation && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#0A0A0A]">예약</h2>
            <div className="mt-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#F5F5F5]">
                  <Calendar className="h-6 w-6 text-[#0A0A0A]" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#0A0A0A]">예약 가능일 확인</p>
                  <p className="text-sm text-[#525252]">
                    실시간 예약 현황을 확인하세요
                  </p>
                </div>
                <button
                  onClick={onReservation}
                  className="flex items-center gap-1 text-sm font-medium text-[#0A0A0A]"
                >
                  보기
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 6. Droppers Section */}
        {droppers.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-[#0A0A0A]">
              이 매장을 다녀간 사람들
            </h2>
            <div className="mt-3 space-y-3">
              {droppers.map((dropper) => (
                <button
                  key={dropper.id}
                  onClick={() => onViewDrop?.(dropper.id)}
                  className="flex w-full items-start gap-3 rounded-xl border border-[#E5E5E5] bg-white p-4 text-left transition-colors hover:bg-[#FAFAFA]"
                >
                  {/* Thumbnail */}
                  <div className="relative h-20 w-28 flex-shrink-0 overflow-hidden rounded-lg bg-[#F5F5F5]">
                    <img
                      src={dropper.videoThumbnailUrl}
                      alt={dropper.videoTitle}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90">
                        <Play className="ml-0.5 h-4 w-4 fill-[#0A0A0A] text-[#0A0A0A]" />
                      </div>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="line-clamp-2 text-sm font-medium text-[#0A0A0A]">
                      {dropper.videoTitle}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={dropper.avatarUrl} alt={dropper.name} />
                        <AvatarFallback className="bg-[#E5E5E5] text-[10px] font-medium text-[#A3A3A3]">
                          {dropper.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-[#525252]">
                        {dropper.name} · {dropper.droppedAgo}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#A3A3A3]">
                      조회 {dropper.views} · 단골 {dropper.regulars}
                    </p>
                  </div>

                  <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-[#D4D4D4]" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 7. Reviews Section */}
        {reviews.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0A0A0A]">리뷰</h2>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                <span className="text-sm font-semibold text-[#0A0A0A]">{store.rating}</span>
                <span className="text-sm text-[#A3A3A3]">({store.reviewCount})</span>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {reviews.slice(0, 5).map((review) => (
                <div
                  key={review.id}
                  className="rounded-xl border border-[#F5F5F5] bg-[#FAFAFA] p-4"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={review.authorAvatarUrl} alt={review.authorName} />
                      <AvatarFallback className="bg-[#E5E5E5] text-xs font-medium text-[#A3A3A3]">
                        {review.authorName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0A0A0A]">{review.authorName}</p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < review.rating
                                ? "fill-[#F59E0B] text-[#F59E0B]"
                                : "fill-[#E5E5E5] text-[#E5E5E5]"
                            }`}
                          />
                        ))}
                        <span className="ml-1 text-xs text-[#A3A3A3]">{review.date}</span>
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#525252]">
                    {review.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. Map Section */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-[#0A0A0A]">위치</h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-[#E5E5E5]">
            {/* Map placeholder - would integrate Kakao Map */}
            <div className="flex h-[200px] items-center justify-center bg-[#F5F5F5]">
              <div className="text-center">
                <MapPin className="mx-auto h-8 w-8 text-[#A3A3A3]" />
                <p className="mt-2 text-sm text-[#525252]">{store.address}</p>
              </div>
            </div>
            <button
              onClick={onDirections}
              className="flex w-full items-center justify-center gap-2 border-t border-[#E5E5E5] py-3 text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
            >
              <Navigation className="h-4 w-4" />
              길찾기
            </button>
          </div>
        </div>

        {/* 10. Footer */}
        <div className="mt-10 border-t border-[#F5F5F5] pt-6">
          <p className="text-xs text-[#A3A3A3]">
            사업자 정보 · 이용약관 · 개인정보처리방침
          </p>
          <p className="mt-2 text-xs text-[#D4D4D4]">
            LinkDrop · drop.how
          </p>
        </div>
      </main>

      {/* 9. Sticky Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#F5F5F5] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2">
          {hasReservation ? (
            <button
              onClick={onReservation}
              className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] text-base font-semibold text-white shadow-subtle transition-all duration-200 hover:bg-[#171717] active:scale-[0.99]"
            >
              <Calendar className="h-5 w-5" />
              지금 예약하기
            </button>
          ) : (
            <button
              onClick={onCall}
              className="flex h-12 flex-[2] items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] text-base font-semibold text-white shadow-subtle transition-all duration-200 hover:bg-[#171717] active:scale-[0.99]"
            >
              <Phone className="h-5 w-5" />
              전화하기
            </button>
          )}
          <button
            onClick={onCall}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white text-sm font-medium text-[#525252] transition-all hover:bg-[#FAFAFA]"
          >
            <Phone className="h-4 w-4" />
            전화
          </button>
          <button
            onClick={onDirections}
            className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white text-sm font-medium text-[#525252] transition-all hover:bg-[#FAFAFA]"
          >
            <Navigation className="h-4 w-4" />
            길찾기
          </button>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
          <button
            onClick={closeLightbox}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="닫기"
          >
            <X className="h-6 w-6" />
          </button>

          <button
            onClick={prevImage}
            className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="이전"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <img
            src={gallery[lightboxIndex].url}
            alt={gallery[lightboxIndex].alt}
            className="max-h-[90vh] max-w-[90vw] object-contain"
          />

          <button
            onClick={nextImage}
            className="absolute right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="다음"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
            {lightboxIndex + 1} / {gallery.length}
          </div>
        </div>
      )}
    </div>
  );
}

// Demo component
export function StoreChannelPageDemo() {
  return (
    <StoreChannelPage
      store={{
        slug: "moraejae-camping",
        name: "모래재 캠핑장",
        heroImageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&h=500&fit=crop",
        category: "캠핑장",
        isVerified: true,
        rating: 4.8,
        reviewCount: 127,
        address: "경기도 가평군 청평면 호반로 1234",
        hours: "체크인 15:00 / 체크아웃 11:00",
        phone: "031-123-4567",
        website: "https://moraejae.kr",
        tags: ["가족캠핑", "감성캠핑", "반려동물동반", "노을명소"],
      }}
      gallery={[
        { id: "1", url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=400&fit=crop", alt: "캠핑장 전경" },
        { id: "2", url: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&h=400&fit=crop", alt: "텐트 사이트" },
        { id: "3", url: "https://images.unsplash.com/photo-1517824806704-9040b037703b?w=400&h=400&fit=crop", alt: "노을 뷰" },
        { id: "4", url: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?w=400&h=400&fit=crop", alt: "캠프파이어" },
        { id: "5", url: "https://images.unsplash.com/photo-1537905569824-f89f14cceb68?w=400&h=400&fit=crop", alt: "아침 풍경" },
        { id: "6", url: "https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=400&h=400&fit=crop", alt: "밤하늘" },
        { id: "7", url: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?w=400&h=400&fit=crop", alt: "추가 사진" },
      ]}
      coupons={[
        { id: "c1", title: "첫 방문 20% 할인", subtitle: "모든 사이트 적용", expiryDate: "5/31", remainingCount: 45 },
        { id: "c2", title: "주중 특가 30% 할인", subtitle: "월~목 예약 시", expiryDate: "6/30" },
      ]}
      droppers={[
        {
          id: "d1",
          name: "캠핑하는 직장인",
          avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
          videoThumbnailUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&h=300&fit=crop",
          videoTitle: "가평 숨은 노을 명소 캠핑장 추천! 모래재 캠핑장 리뷰",
          droppedAgo: "3일 전",
          views: 1842,
          regulars: 23,
        },
        {
          id: "d2",
          name: "가족캠핑러",
          avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
          videoThumbnailUrl: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=400&h=300&fit=crop",
          videoTitle: "아이와 함께하는 캠핑, 모래재 캠핑장 솔직 후기",
          droppedAgo: "1주 전",
          views: 956,
          regulars: 12,
        },
      ]}
      reviews={[
        {
          id: "r1",
          authorName: "김철수",
          rating: 5,
          text: "정말 좋은 캠핑장이에요. 노을이 정말 예쁘고, 시설도 깨끗합니다. 가족과 함께 다녀왔는데 아이들도 너무 좋아했어요.",
          date: "2024.05.10",
        },
        {
          id: "r2",
          authorName: "박영희",
          rating: 4,
          text: "위치가 좋고 전망이 훌륭합니다. 화장실이 조금 멀어서 아쉬웠지만 전체적으로 만족스러웠어요.",
          date: "2024.05.08",
        },
        {
          id: "r3",
          authorName: "이민준",
          rating: 5,
          text: "반려견과 함께 갔는데 산책하기 너무 좋았어요. 다음에 또 방문할 예정입니다!",
          date: "2024.05.05",
        },
      ]}
      hasReservation={true}
    />
  );
}
