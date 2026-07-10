"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ChevronLeft,
  Search,
  Clock,
  AlertCircle,
  QrCode,
  X,
  Ticket,
  Gift,
} from "lucide-react";

// ============================================================
// My Coupons Page (내 쿠폰함)
// WHY: 사용자 wallet = 진짜 retention 도구
// WHY: 만료 임박 알림 = 사용 유도 + 매장 매출
// URL: /me/coupons
// ============================================================

type CouponStatus = "available" | "used" | "expired";

export interface CouponItem {
  id: string;
  storeName: string;
  storeImageUrl?: string;
  title: string;
  benefit: string;
  scope: string;
  expiryDate: string;
  daysRemaining: number;
  status: CouponStatus;
  usedAt?: string;
  code?: string;
}

export interface MyCouponsPageProps {
  coupons: CouponItem[];
  onBack?: () => void;
  onSearch?: () => void;
  onUseCoupon?: (couponId: string) => void;
  onViewExpiring?: () => void;
  onViewFriendDrops?: () => void;
}

// Helpers
function getDaysRemainingColor(days: number): string {
  if (days <= 1) return "text-[#0A0A0A]";
  if (days <= 3) return "text-[#525252]";
  return "text-[#A3A3A3]";
}

function getDaysRemainingText(days: number): string {
  if (days <= 0) return "오늘 만료";
  if (days === 1) return "내일 만료";
  return `${days}일 남음`;
}

export function MyCouponsPage({
  coupons,
  onBack,
  onSearch,
  onUseCoupon,
  onViewExpiring,
  onViewFriendDrops,
}: MyCouponsPageProps) {
  const [activeTab, setActiveTab] = useState<CouponStatus>("available");
  const [selectedCoupon, setSelectedCoupon] = useState<CouponItem | null>(null);
  const [showUseModal, setShowUseModal] = useState(false);
  const [countdown, setCountdown] = useState(600); // 10 minutes in seconds

  // Count coupons by status
  const availableCount = coupons.filter((c) => c.status === "available").length;
  const usedCount = coupons.filter((c) => c.status === "used").length;
  const expiredCount = coupons.filter((c) => c.status === "expired").length;

  // Filter coupons by active tab
  const filteredCoupons = coupons.filter((c) => c.status === activeTab);

  // Expiring soon coupons (within 3 days)
  const expiringSoon = coupons.filter(
    (c) => c.status === "available" && c.daysRemaining <= 3
  );

  // Countdown timer for use modal
  useEffect(() => {
    if (!showUseModal) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showUseModal]);

  const formatCountdown = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUseCoupon = (coupon: CouponItem) => {
    setSelectedCoupon(coupon);
    setCountdown(600);
    setShowUseModal(true);
  };

  const handleConfirmUse = () => {
    if (selectedCoupon) {
      onUseCoupon?.(selectedCoupon.id);
    }
    setShowUseModal(false);
    setSelectedCoupon(null);
  };

  const tabs = [
    { id: "available" as CouponStatus, label: "사용 가능", count: availableCount },
    { id: "used" as CouponStatus, label: "사용함", count: usedCount },
    { id: "expired" as CouponStatus, label: "만료", count: expiredCount },
  ];

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] pb-8">
      {/* 1. 헤더 */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#E5E5E5] bg-white/95 px-4 backdrop-blur-sm">
        <button
          onClick={() => onBack?.()}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#F5F5F5]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5 text-[#525252]" />
        </button>
        <h2 className="text-[17px] font-semibold text-[#0A0A0A]">내 쿠폰함</h2>
        <button
          onClick={() => onSearch?.()}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#F5F5F5]"
          aria-label="검색"
        >
          <Search className="h-5 w-5 text-[#525252]" />
        </button>
      </header>

      <main className="px-4">
        {/* 2. 탭 */}
        <div className="mt-4 flex rounded-xl bg-[#F5F5F5] p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex-1 rounded-lg py-2.5 text-center text-[13px] font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#0A0A0A] shadow-sm"
                  : "text-[#525252] hover:text-[#0A0A0A]"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold ${
                  activeTab === tab.id
                    ? "bg-[#0A0A0A] text-white"
                    : "bg-[#E5E5E5] text-[#525252]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* 3. 만료 임박 알림 */}
        {activeTab === "available" && expiringSoon.length > 0 && (
          <button
            onClick={onViewExpiring}
            className="mt-4 flex w-full items-center gap-3 rounded-xl border border-[#E5E5E5] bg-white px-4 py-3.5 text-left shadow-sm transition-all hover:border-[#D4D4D4] hover:shadow-md"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F5]">
              <AlertCircle className="h-[18px] w-[18px] text-[#525252]" />
            </div>
            <span className="flex-1 text-[14px] font-medium text-[#0A0A0A]">
              {expiringSoon.length === 1
                ? `${expiringSoon[0].daysRemaining}일 후 만료될 쿠폰 1개`
                : `3일 내 만료될 쿠폰 ${expiringSoon.length}개`}
            </span>
            <span className="text-[13px] font-medium text-[#A3A3A3]">확인 →</span>
          </button>
        )}

        {/* 4. 쿠폰 카드 리스트 */}
        {filteredCoupons.length > 0 ? (
          <div className="mt-4 space-y-3">
            {filteredCoupons.map((coupon) => (
              <CouponCard
                key={coupon.id}
                coupon={coupon}
                onUse={() => handleUseCoupon(coupon)}
              />
            ))}
          </div>
        ) : (
          /* 6. 빈 상태 */
          <div className="mt-20 flex flex-col items-center px-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#F5F5F5]">
              <Ticket className="h-9 w-9 text-[#A3A3A3]" />
            </div>
            <h3 className="mt-5 text-[17px] font-semibold text-[#0A0A0A]">
              {activeTab === "available"
                ? "받은 쿠폰이 없어요"
                : activeTab === "used"
                ? "사용한 쿠폰이 없어요"
                : "만료된 쿠폰이 없어요"}
            </h3>
            <p className="mt-2 text-[14px] leading-relaxed text-[#525252]">
              {activeTab === "available"
                ? "친구가 보내면 여기에 표시돼요"
                : activeTab === "used"
                ? "쿠폰을 사용하면 여기에 표시돼요"
                : "만료된 쿠폰이 여기에 표시돼요"}
            </p>
            {activeTab === "available" && (
              <button
                onClick={onViewFriendDrops}
                className="mt-5 rounded-full bg-[#0A0A0A] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#171717]"
              >
                친구의 Drop 보기
              </button>
            )}
          </div>
        )}
      </main>

      {/* 5. 사용 인증 모달 */}
      {showUseModal && selectedCoupon && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center">
          <div className="relative w-full max-w-sm rounded-t-3xl bg-white px-5 pb-8 pt-6 shadow-floating sm:mx-4 sm:rounded-2xl">
            {/* Close button */}
            <button
              onClick={() => setShowUseModal(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F5F5F5] text-[#525252] transition-colors hover:bg-[#E5E5E5]"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Store info */}
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <Avatar className="h-9 w-9 ring-2 ring-[#F5F5F5]">
                <AvatarImage src={selectedCoupon.storeImageUrl} alt={selectedCoupon.storeName} />
                <AvatarFallback className="bg-[#F5F5F5] text-xs font-medium text-[#525252]">
                  {selectedCoupon.storeName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-[14px] font-medium text-[#525252]">
                {selectedCoupon.storeName}
              </span>
            </div>

            {/* Coupon benefit */}
            <h3 className="mt-3 text-center text-[20px] font-bold text-[#0A0A0A]">
              {selectedCoupon.benefit}
            </h3>

            {/* Auth code */}
            <div className="mx-auto mt-5 max-w-[260px] rounded-2xl bg-[#F5F5F5] px-5 py-4">
              <p className="text-center text-[12px] text-[#A3A3A3]">사용 인증 코드</p>
              <p className="mt-1.5 text-center font-mono text-[36px] font-bold leading-none tracking-[0.15em] text-[#0A0A0A]">
                {selectedCoupon.code || "823 471"}
              </p>
            </div>

            <p className="mt-3 text-center text-[13px] text-[#525252]">
              매장 직원에게 보여주세요
            </p>

            {/* QR Code placeholder */}
            <div className="mx-auto mt-4 flex h-[180px] w-[180px] items-center justify-center rounded-2xl border border-[#E5E5E5] bg-white">
              <div className="relative">
                {/* Simulated QR code pattern */}
                <div className="grid h-[160px] w-[160px] grid-cols-9 gap-[2px] p-2">
                  {Array.from({ length: 81 }).map((_, i) => (
                    <div
                      key={i}
                      className={`aspect-square rounded-[1px] ${
                        Math.random() > 0.4 ? "bg-[#0A0A0A]" : "bg-[#F5F5F5]"
                      }`}
                    />
                  ))}
                </div>
                {/* QR icon overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="rounded-lg bg-white p-1.5 shadow-sm">
                    <QrCode className="h-5 w-5 text-[#0A0A0A]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Countdown timer */}
            <div className="mt-4 text-center">
              <p className="text-[11px] text-[#A3A3A3]">유효 시간</p>
              <p
                className={`mt-0.5 font-mono text-[22px] font-bold ${
                  countdown <= 60 ? "text-[#EF4444]" : "text-[#0A0A0A]"
                }`}
              >
                {formatCountdown(countdown)}
              </p>
            </div>

            {/* Actions */}
            <button
              onClick={handleConfirmUse}
              className="mt-5 h-[52px] w-full rounded-xl bg-[#0A0A0A] text-[15px] font-semibold text-white transition-all hover:bg-[#171717] active:scale-[0.99]"
            >
              사용 완료
            </button>
            <button
              onClick={() => setShowUseModal(false)}
              className="mt-2 w-full py-2 text-[14px] font-medium text-[#A3A3A3] transition-colors hover:text-[#525252]"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Coupon Card Component
// ============================================================

interface CouponCardProps {
  coupon: CouponItem;
  onUse: () => void;
}

function CouponCard({ coupon, onUse }: CouponCardProps) {
  const isExpiringSoon = coupon.status === "available" && coupon.daysRemaining <= 3;
  const isExpired = coupon.status === "expired";
  const isUsed = coupon.status === "used";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white p-4 transition-all ${
        isExpiringSoon ? "border-[#D4D4D4] shadow-sm" : "shadow-sm"
      } ${isExpired || isUsed ? "opacity-50" : "hover:shadow-md hover:border-[#D4D4D4]"}`}
    >
      {/* Expired overlay */}
      {isExpired && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
          <div className="rotate-[-12deg] rounded-lg border-2 border-[#A3A3A3] bg-white px-4 py-1.5">
            <span className="text-[15px] font-bold text-[#A3A3A3]">만료됨</span>
          </div>
        </div>
      )}

      {/* Used overlay */}
      {isUsed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
          <div className="rotate-[-12deg] rounded-lg border-2 border-[#525252] bg-white px-4 py-1.5">
            <span className="text-[15px] font-bold text-[#525252]">사용완료</span>
          </div>
        </div>
      )}

      {/* Used overlay */}
      {isUsed && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="rotate-[-15deg] rounded-lg border-4 border-[#10B981] bg-white/90 px-4 py-2">
            <span className="text-xl font-bold text-[#10B981]">사용 완료</span>
          </div>
        </div>
      )}

      {/* Top: Store info */}
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9 ring-2 ring-[#F5F5F5]">
          <AvatarImage src={coupon.storeImageUrl} alt={coupon.storeName} />
          <AvatarFallback className="bg-[#F5F5F5] text-[13px] font-medium text-[#525252]">
            {coupon.storeName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <span className="text-[13px] font-medium text-[#525252]">{coupon.storeName}</span>
      </div>

      {/* Middle: Coupon info */}
      <div className="mt-3">
        <p className="text-[15px] font-semibold text-[#0A0A0A]">{coupon.title}</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[17px] font-bold text-[#0A0A0A]">{coupon.benefit}</span>
          <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-medium text-[#525252]">
            {coupon.scope}
          </span>
        </div>
      </div>

      {/* Bottom: Expiry + Action */}
      <div className="mt-4 flex items-center justify-between border-t border-[#F5F5F5] pt-3">
        <div className="flex items-center gap-1.5">
          <Clock className={`h-3.5 w-3.5 ${isExpiringSoon ? "text-[#525252]" : "text-[#A3A3A3]"}`} />
          <span className={`text-[13px] ${isExpiringSoon ? "text-[#525252] font-medium" : "text-[#A3A3A3]"}`}>
            {coupon.expiryDate}까지
          </span>
          {coupon.status === "available" && (
            <span className={`ml-0.5 text-[13px] font-medium ${getDaysRemainingColor(coupon.daysRemaining)}`}>
              ({getDaysRemainingText(coupon.daysRemaining)})
            </span>
          )}
        </div>

        {coupon.status === "available" && (
            <button
              onClick={onUse}
              className="rounded-full bg-[#0A0A0A] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:bg-[#171717] active:scale-[0.98]"
            >
              사용하기
            </button>
        )}

        {coupon.status === "used" && coupon.usedAt && (
          <span className="text-[12px] text-[#A3A3A3]">{coupon.usedAt} 사용</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Demo Component
// ============================================================

const DEMO_COUPONS: CouponItem[] = [
  {
    id: "1",
    storeName: "노을재 캠핑장",
    storeImageUrl: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=100&h=100&fit=crop",
    title: "주말 캠핑 할인",
    benefit: "최대 20% 할인",
    scope: "캠핑장 전체",
    expiryDate: "5/31",
    daysRemaining: 2,
    status: "available",
    code: "823 471",
  },
  {
    id: "2",
    storeName: "네일숍 봄날",
    storeImageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=100&h=100&fit=crop",
    title: "첫 방문 고객 할인",
    benefit: "10,000원 할인",
    scope: "젤 네일",
    expiryDate: "6/15",
    daysRemaining: 17,
    status: "available",
    code: "456 789",
  },
  {
    id: "3",
    storeName: "성수 브런치 카페",
    storeImageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop",
    title: "음료 무료 증정",
    benefit: "아메리카노 무료",
    scope: "브런치 세트 주문 시",
    expiryDate: "5/25",
    daysRemaining: 0,
    status: "available",
    code: "112 233",
  },
  {
    id: "4",
    storeName: "헬스장 피트니스",
    storeImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop",
    title: "PT 1회 체험",
    benefit: "무료 체험",
    scope: "첫 방문",
    expiryDate: "5/10",
    daysRemaining: -1,
    status: "used",
    usedAt: "5/8",
    code: "999 000",
  },
  {
    id: "5",
    storeName: "레스토랑 델리노",
    storeImageUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=100&fit=crop",
    title: "디너 코스 할인",
    benefit: "30% 할인",
    scope: "2인 이상",
    expiryDate: "5/1",
    daysRemaining: -20,
    status: "expired",
    code: "555 666",
  },
  {
    id: "6",
    storeName: "서점 책방",
    storeImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    title: "베스트셀러 할인",
    benefit: "15% 할인",
    scope: "전 품목",
    expiryDate: "4/20",
    daysRemaining: -30,
    status: "expired",
    code: "777 888",
  },
];

export function MyCouponsPageDemo() {
  return <MyCouponsPage coupons={DEMO_COUPONS} />;
}
