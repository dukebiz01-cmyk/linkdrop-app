"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar,
  Ticket,
  Users,
  MapPin,
  Clock,
  Phone,
  Globe,
  Instagram,
  Camera,
  Upload,
  X,
  Check,
  Building2,
  Store,
  Coffee,
  Tent,
  ShoppingBag,
  Scissors,
  MoreHorizontal,
  ExternalLink,
  Star,
  AlertCircle,
  FileText,
  BadgeCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

// =============================================================
// A. 매장 없는 사용자 — 등록 권유
// =============================================================

interface StoreEmptyStateProps {
  onStartRegistration?: () => void;
  onHasBusiness?: () => void;
  onNoBusiness?: () => void;
}

function StoreEmptyState({
  onStartRegistration,
  onHasBusiness,
  onNoBusiness,
}: StoreEmptyStateProps) {
  return (
    <div className="flex flex-col px-5 pb-8">
      {/* Empty illustration */}
      <div className="mt-8 flex flex-col items-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#F5F5F5]">
          <Store className="h-12 w-12 text-[#525252]" />
        </div>
        
        <h2 className="mt-6 text-center text-[22px] font-bold text-[#0A0A0A]">
          매장을 LinkDrop에 등록하세요
        </h2>
        <p className="mt-3 text-center text-[15px] leading-relaxed text-[#525252]">
          친구들이 추천한 손님을 단골로 만들어보세요.<br />
          예약·쿠폰·상담을 한 곳에서 관리할 수 있어요.
        </p>
      </div>

      {/* Value cards */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center rounded-xl border border-[#E5E5E5] bg-white p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F5]">
            <Calendar className="h-5 w-5 text-[#525252]" />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#0A0A0A]">자체 예약 시스템</p>
          <p className="mt-1 text-[11px] text-[#A3A3A3]">수수료 없이 직접 예약</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-[#E5E5E5] bg-white p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFFBEB]">
            <Ticket className="h-5 w-5 text-[#D97706]" />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#0A0A0A]">쿠폰 자동 발급</p>
          <p className="mt-1 text-[11px] text-[#A3A3A3]">친구 추천 시 자동</p>
        </div>
        <div className="flex flex-col items-center rounded-xl border border-[#E5E5E5] bg-white p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0FDF4]">
            <Users className="h-5 w-5 text-[#22C55E]" />
          </div>
          <p className="mt-3 text-[13px] font-semibold text-[#0A0A0A]">단골 관리</p>
          <p className="mt-1 text-[11px] text-[#A3A3A3]">재방문 자동 추적</p>
        </div>
      </div>

      {/* Case study */}
      <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
          <span className="text-[13px] font-semibold text-[#0A0A0A]">괴산 모래재캠핑장 사장님 후기</span>
        </div>
        <p className="mt-2 text-[15px] font-medium text-[#0A0A0A]">
          &ldquo;한 달 새 단골 23명 확보&rdquo;
        </p>
        <p className="mt-1 text-[13px] italic text-[#525252]">
          &ldquo;친구 추천으로 온 손님이 진짜 단골이 되더라고요. 예약도 한 번에 관리되니 편해요.&rdquo;
        </p>
      </div>

      {/* CTA */}
      <button
        onClick={onStartRegistration}
        className="mt-8 flex h-14 w-full items-center justify-center rounded-xl bg-[#0A0A0A] text-base font-semibold text-white transition-all duration-200 hover:bg-[#171717] active:scale-[0.99]"
      >
        매장 등록 시작하기
      </button>

      {/* Secondary options */}
      <div className="mt-4 flex justify-center gap-4">
        <button
          onClick={onHasBusiness}
          className="text-sm font-medium text-[#0A0A0A] transition-colors hover:text-[#525252]"
        >
          이미 사업자등록증이 있어요
        </button>
        <span className="text-[#D4D4D4]">|</span>
        <button
          onClick={onNoBusiness}
          className="text-sm font-medium text-[#A3A3A3] transition-colors hover:text-[#525252]"
        >
          사업자등록 없이 시작하기
        </button>
      </div>
    </div>
  );
}

// =============================================================
// B. 매장 등록 Wizard (5단계)
// =============================================================

type StoreCategory = "restaurant" | "camping" | "shopping" | "service" | "other";

interface StoreFormData {
  // Step 1
  name: string;
  category: StoreCategory | null;
  address: string;
  phone: string;
  // Step 2
  mainPhoto: string | null;
  additionalPhotos: string[];
  // Step 3
  hours: { [key: string]: { open: string; close: string; closed: boolean } };
  regularHoliday: string;
  priceRange: number;
  // Step 4
  reservationLink: string;
  websiteLink: string;
  instagramLink: string;
  // Step 5
  hasBusinessLicense: boolean;
  businessNumber: string;
  licensePhoto: string | null;
  associationName: string;
}

const CATEGORY_OPTIONS: { id: StoreCategory; label: string; icon: React.ReactNode }[] = [
  { id: "restaurant", label: "음식점/카페", icon: <Coffee className="h-5 w-5" /> },
  { id: "camping", label: "캠핑장/펜션", icon: <Tent className="h-5 w-5" /> },
  { id: "shopping", label: "쇼핑", icon: <ShoppingBag className="h-5 w-5" /> },
  { id: "service", label: "서비스", icon: <Scissors className="h-5 w-5" /> },
  { id: "other", label: "기타", icon: <Building2 className="h-5 w-5" /> },
];

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

interface StoreRegistrationWizardProps {
  onBack?: () => void;
  onComplete?: () => void;
}

function StoreRegistrationWizard({
  onBack,
  onComplete,
}: StoreRegistrationWizardProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<StoreFormData>({
    name: "",
    category: null,
    address: "",
    phone: "",
    mainPhoto: null,
    additionalPhotos: [],
    hours: DAYS.reduce((acc, day) => ({
      ...acc,
      [day]: { open: "09:00", close: "22:00", closed: false },
    }), {}),
    regularHoliday: "",
    priceRange: 2,
    reservationLink: "",
    websiteLink: "",
    instagramLink: "",
    hasBusinessLicense: false,
    businessNumber: "",
    licensePhoto: null,
    associationName: "",
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.name && formData.category && formData.address;
      case 2:
        return formData.mainPhoto;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      onComplete?.();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onBack?.();
    }
  };

  const stepTitles = [
    "매장 기본 정보",
    "매장 사진",
    "영업 정보",
    "외부 링크 연결",
    "인증",
  ];

  return (
    <div className="relative min-h-screen bg-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-[#E5E5E5] bg-white">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            onClick={handleBack}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#F5F5F5]"
          >
            <ChevronLeft className="h-5 w-5 text-[#525252]" />
          </button>
          <span className="text-[15px] font-semibold text-[#0A0A0A]">
            {step}/{totalSteps} {stepTitles[step - 1]}
          </span>
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[#F5F5F5]"
          >
            <X className="h-5 w-5 text-[#525252]" />
          </button>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-[#E5E5E5]">
          <div
            className="h-full bg-[#0A0A0A] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <main className="px-5 pt-6">
        {/* Step 1: 기본 정보 */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                매장 이름 <span className="text-[#EF4444]">*</span>
              </label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: 노을재 캠핑장"
                className="h-12 rounded-xl border-[#E5E5E5]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                매장 종류 <span className="text-[#EF4444]">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFormData({ ...formData, category: cat.id })}
                    className={`flex h-14 items-center gap-3 rounded-xl border-2 px-4 transition-all ${
                      formData.category === cat.id
                        ? "border-[#0A0A0A] bg-[#FAFAFA]"
                        : "border-[#E5E5E5] bg-white hover:border-[#D4D4D4]"
                    }`}
                  >
                    <span className={formData.category === cat.id ? "text-[#0A0A0A]" : "text-[#A3A3A3]"}>
                      {cat.icon}
                    </span>
                    <span className={`text-sm font-medium ${
                      formData.category === cat.id ? "text-[#0A0A0A]" : "text-[#525252]"
                    }`}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                주소 <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="주소 검색"
                  className="h-12 rounded-xl border-[#E5E5E5] pl-12"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">연락처</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="031-123-4567"
                  className="h-12 rounded-xl border-[#E5E5E5] pl-12"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: 매장 사진 */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                대표 사진 <span className="text-[#EF4444]">*</span>
              </label>
              <p className="mb-3 text-xs text-[#A3A3A3]">
                매장을 가장 잘 보여주는 사진 1장을 선택해주세요
              </p>
              
              {formData.mainPhoto ? (
                <div className="relative aspect-[16/9] overflow-hidden rounded-xl">
                  <img
                    src={formData.mainPhoto}
                    alt="대표 사진"
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => setFormData({ ...formData, mainPhoto: null })}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setFormData({ ...formData, mainPhoto: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800" })}
                  className="flex aspect-[16/9] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#FAFAFA] transition-colors hover:border-[#0A0A0A] hover:bg-[#F5F5F5]"
                >
                  <Camera className="h-8 w-8 text-[#A3A3A3]" />
                  <span className="mt-2 text-sm font-medium text-[#525252]">사진 업로드</span>
                  <span className="mt-1 text-xs text-[#A3A3A3]">또는 드래그 앤 드롭</span>
                </button>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                추가 사진 (선택)
              </label>
              <p className="mb-3 text-xs text-[#A3A3A3]">
                최대 10장까지 추가할 수 있어요
              </p>
              
              <div className="grid grid-cols-3 gap-2">
                {formData.additionalPhotos.map((photo, idx) => (
                  <div key={idx} className="relative aspect-square overflow-hidden rounded-lg">
                    <img src={photo} alt="" className="h-full w-full object-cover" />
                    <button
                      onClick={() => setFormData({
                        ...formData,
                        additionalPhotos: formData.additionalPhotos.filter((_, i) => i !== idx),
                      })}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {formData.additionalPhotos.length < 10 && (
                  <button
                    onClick={() => setFormData({
                      ...formData,
                      additionalPhotos: [...formData.additionalPhotos, `https://images.unsplash.com/photo-${Date.now()}?w=400`],
                    })}
                    className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-[#D4D4D4] bg-[#FAFAFA] transition-colors hover:border-[#0A0A0A]"
                  >
                    <Plus className="h-6 w-6 text-[#A3A3A3]" />
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-[#FAFAFA] p-4">
              <p className="text-xs text-[#A3A3A3]">
                이미지는 자동으로 최적화되어 업로드됩니다. 고화질 원본은 보관되지 않아요.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: 영업 정보 */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="mb-3 block text-sm font-medium text-[#0A0A0A]">영업 시간</label>
              <div className="space-y-2">
                {DAYS.map((day) => (
                  <div key={day} className="flex items-center gap-3 rounded-xl bg-[#FAFAFA] px-4 py-3">
                    <span className="w-6 text-sm font-medium text-[#0A0A0A]">{day}</span>
                    {formData.hours[day]?.closed ? (
                      <span className="flex-1 text-sm text-[#A3A3A3]">휴무</span>
                    ) : (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="time"
                          value={formData.hours[day]?.open || "09:00"}
                          onChange={(e) => setFormData({
                            ...formData,
                            hours: {
                              ...formData.hours,
                              [day]: { ...formData.hours[day], open: e.target.value },
                            },
                          })}
                          className="h-8 rounded-lg border border-[#E5E5E5] px-2 text-sm"
                        />
                        <span className="text-[#A3A3A3]">-</span>
                        <input
                          type="time"
                          value={formData.hours[day]?.close || "22:00"}
                          onChange={(e) => setFormData({
                            ...formData,
                            hours: {
                              ...formData.hours,
                              [day]: { ...formData.hours[day], close: e.target.value },
                            },
                          })}
                          className="h-8 rounded-lg border border-[#E5E5E5] px-2 text-sm"
                        />
                      </div>
                    )}
                    <Switch
                      checked={!formData.hours[day]?.closed}
                      onCheckedChange={(checked) => setFormData({
                        ...formData,
                        hours: {
                          ...formData.hours,
                          [day]: { ...formData.hours[day], closed: !checked },
                        },
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">정기 휴무</label>
              <Input
                value={formData.regularHoliday}
                onChange={(e) => setFormData({ ...formData, regularHoliday: e.target.value })}
                placeholder="예: 매주 월요일, 매월 첫째 주 화요일"
                className="h-12 rounded-xl border-[#E5E5E5]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">가격대</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((level) => (
                  <button
                    key={level}
                    onClick={() => setFormData({ ...formData, priceRange: level })}
                    className={`flex h-10 flex-1 items-center justify-center rounded-lg text-sm font-medium transition-all ${
                      formData.priceRange === level
                        ? "bg-[#0A0A0A] text-white"
                        : "bg-[#F5F5F5] text-[#A3A3A3] hover:bg-[#E5E5E5]"
                    }`}
                  >
                    {"₩".repeat(level)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: 외부 링크 */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="rounded-xl bg-[#FFFBEB] p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D97706]" />
                <p className="text-sm text-[#92400E]">
                  이 링크로 손님이 실제 예약합니다. 정확한 URL을 입력해주세요.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">예약 링크</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
                <Input
                  type="url"
                  value={formData.reservationLink}
                  onChange={(e) => setFormData({ ...formData, reservationLink: e.target.value })}
                  placeholder="https://campfit.co.kr/..."
                  className="h-12 rounded-xl border-[#E5E5E5] pl-12"
                />
              </div>
              <p className="mt-1 text-xs text-[#A3A3A3]">캠핏, 야놀자, 네이버 예약 등</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">홈페이지 (선택)</label>
              <div className="relative">
                <Globe className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
                <Input
                  type="url"
                  value={formData.websiteLink}
                  onChange={(e) => setFormData({ ...formData, websiteLink: e.target.value })}
                  placeholder="https://..."
                  className="h-12 rounded-xl border-[#E5E5E5] pl-12"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">인스타그램 (선택)</label>
              <div className="relative">
                <Instagram className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A3A3A3]" />
                <Input
                  value={formData.instagramLink}
                  onChange={(e) => setFormData({ ...formData, instagramLink: e.target.value })}
                  placeholder="@username"
                  className="h-12 rounded-xl border-[#E5E5E5] pl-12"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 5: 인증 */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-[#E5E5E5] p-4">
              <label className="flex cursor-pointer items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#525252]" />
                  <div>
                    <p className="text-sm font-medium text-[#0A0A0A]">사업자등록증 인증</p>
                    <p className="text-xs text-[#A3A3A3]">인증 시 신뢰 라벨이 표시됩니다</p>
                  </div>
                </div>
                <Switch
                  checked={formData.hasBusinessLicense}
                  onCheckedChange={(checked) => setFormData({ ...formData, hasBusinessLicense: checked })}
                />
              </label>
            </div>

            {formData.hasBusinessLicense && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                    사업자등록번호
                  </label>
                  <Input
                    value={formData.businessNumber}
                    onChange={(e) => setFormData({ ...formData, businessNumber: e.target.value })}
                    placeholder="000-00-00000"
                    className="h-12 rounded-xl border-[#E5E5E5]"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                    사업자등록증 사진
                  </label>
                  {formData.licensePhoto ? (
                    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[#E5E5E5]">
                      <img
                        src={formData.licensePhoto}
                        alt="사업자등록증"
                        className="h-full w-full object-cover"
                      />
                      <button
                        onClick={() => setFormData({ ...formData, licensePhoto: null })}
                        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setFormData({ ...formData, licensePhoto: "https://via.placeholder.com/400x300" })}
                      className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#FAFAFA]"
                    >
                      <Upload className="h-8 w-8 text-[#A3A3A3]" />
                      <span className="mt-2 text-sm text-[#525252]">사업자등록증 업로드</span>
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="relative flex items-center py-2">
              <div className="flex-1 border-t border-[#E5E5E5]" />
              <span className="px-4 text-xs text-[#A3A3A3]">또는</span>
              <div className="flex-1 border-t border-[#E5E5E5]" />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[#0A0A0A]">
                협회 인증 (있을 경우)
              </label>
              <Input
                value={formData.associationName}
                onChange={(e) => setFormData({ ...formData, associationName: e.target.value })}
                placeholder="예: 괴산캠핑장협회"
                className="h-12 rounded-xl border-[#E5E5E5]"
              />
            </div>

            <div className="rounded-xl bg-[#FAFAFA] p-4">
              <p className="text-sm text-[#525252]">
                인증 없이도 매장 등록이 가능합니다. 단, 인증 라벨이 표시되지 않습니다.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#E5E5E5] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={`flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-all duration-200 ${
            canProceed()
              ? "bg-[#0A0A0A] text-white hover:bg-[#171717]"
              : "bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed"
          }`}
        >
          {step === totalSteps ? "매장 등록 완료" : "다음"}
        </button>
      </div>
    </div>
  );
}

// =============================================================
// Registration Complete
// =============================================================

interface RegistrationCompleteProps {
  storeName: string;
  needsReview: boolean;
  onViewChannel?: () => void;
  onGoToDashboard?: () => void;
}

function RegistrationComplete({
  storeName,
  needsReview,
  onViewChannel,
  onGoToDashboard,
}: RegistrationCompleteProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F0FDF4]">
        <Check className="h-10 w-10 text-[#22C55E]" />
      </div>

      <h2 className="mt-6 text-center text-2xl font-bold text-[#0A0A0A]">
        매장이 등록됐어요!
      </h2>

      <p className="mt-3 text-center text-[15px] text-[#525252]">
        {storeName}
      </p>

      {needsReview ? (
        <div className="mt-4 flex items-center gap-2 rounded-full bg-[#FFFBEB] px-4 py-2">
          <Clock className="h-4 w-4 text-[#D97706]" />
          <span className="text-sm font-medium text-[#92400E]">심사 대기 중</span>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-full bg-[#F0FDF4] px-4 py-2">
          <Check className="h-4 w-4 text-[#16A34A]" />
          <span className="text-sm font-medium text-[#16A34A]">바로 사용 가능</span>
        </div>
      )}

      <div className="mt-8 w-full space-y-3">
        <button
          onClick={onViewChannel}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#0A0A0A] text-base font-semibold text-white transition-all hover:bg-[#171717]"
        >
          매장 채널 페이지 보기
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          onClick={onGoToDashboard}
          className="flex h-12 w-full items-center justify-center rounded-xl border border-[#E5E5E5] bg-white text-sm font-semibold text-[#525252] transition-all hover:bg-[#FAFAFA]"
        >
          대시보드로 가기
        </button>
      </div>
    </div>
  );
}

// =============================================================
// C. 매장 보유 사용자 — 매장 목록
// =============================================================

interface StoreItem {
  id: string;
  name: string;
  imageUrl: string;
  status: "active" | "pending" | "suspended";
  verificationLevel: "business" | "association" | "none";
  associationName?: string;
  todayVisits: number;
  todayCoupons: number;
}

interface StoreListProps {
  stores: StoreItem[];
  onStoreClick?: (storeId: string) => void;
  onAddStore?: () => void;
  onEditStore?: (storeId: string) => void;
  onSuspendStore?: (storeId: string) => void;
  onDeleteStore?: (storeId: string) => void;
}

function StoreList({
  stores,
  onStoreClick,
  onAddStore,
  onEditStore,
  onSuspendStore,
  onDeleteStore,
}: StoreListProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const getStatusLabel = (status: StoreItem["status"]) => {
    switch (status) {
      case "active":
        return { text: "활성", color: "bg-[#F0FDF4] text-[#16A34A]" };
      case "pending":
        return { text: "심사 대기", color: "bg-[#FFFBEB] text-[#92400E]" };
      case "suspended":
        return { text: "정지", color: "bg-[#FEE2E2] text-[#B91C1C]" };
    }
  };

  const getVerificationLabel = (level: StoreItem["verificationLevel"], assocName?: string) => {
    switch (level) {
      case "business":
        return { text: "사업자 인증", icon: <BadgeCheck className="h-3.5 w-3.5" />, color: "text-[#0A0A0A]" };
      case "association":
        return { text: assocName || "협회 인증", icon: <BadgeCheck className="h-3.5 w-3.5" />, color: "text-[#16A34A]" };
      case "none":
        return null;
    }
  };

  return (
    <div className="px-5 pb-24">
      {/* Store cards */}
      <div className="mt-4 space-y-3">
        {stores.map((store) => {
          const status = getStatusLabel(store.status);
          const verification = getVerificationLabel(store.verificationLevel, store.associationName);

          return (
            <div
              key={store.id}
              className="relative overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white transition-shadow hover:shadow-elevated"
            >
              <button
                onClick={() => onStoreClick?.(store.id)}
                className="flex w-full items-start gap-4 p-4 text-left"
              >
                {/* Image */}
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#F5F5F5]">
                  <img
                    src={store.imageUrl}
                    alt={store.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-[#0A0A0A]">
                      {store.name}
                    </h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.text}
                    </span>
                  </div>

                  {verification && (
                    <div className={`mt-1 flex items-center gap-1 ${verification.color}`}>
                      {verification.icon}
                      <span className="text-xs font-medium">{verification.text}</span>
                    </div>
                  )}

                  <p className="mt-2 text-sm text-[#A3A3A3]">
                    오늘 {store.todayVisits} 방문 · 쿠폰 {store.todayCoupons}
                  </p>
                </div>

                <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-[#D4D4D4]" />
              </button>

              {/* Menu button */}
              <button
                onClick={() => setMenuOpen(menuOpen === store.id ? null : store.id)}
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5]"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {/* Dropdown menu */}
              {menuOpen === store.id && (
                <div className="absolute right-3 top-12 z-10 w-32 rounded-xl border border-[#E5E5E5] bg-white py-1 shadow-floating">
                  <button
                    onClick={() => { onEditStore?.(store.id); setMenuOpen(null); }}
                    className="flex w-full items-center px-4 py-2 text-sm text-[#525252] hover:bg-[#FAFAFA]"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => { onSuspendStore?.(store.id); setMenuOpen(null); }}
                    className="flex w-full items-center px-4 py-2 text-sm text-[#525252] hover:bg-[#FAFAFA]"
                  >
                    정지
                  </button>
                  <button
                    onClick={() => { onDeleteStore?.(store.id); setMenuOpen(null); }}
                    className="flex w-full items-center px-4 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2]"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add store button */}
      <button
        onClick={onAddStore}
        className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#D4D4D4] bg-[#FAFAFA] text-sm font-semibold text-[#A3A3A3] transition-all hover:border-[#0A0A0A] hover:bg-[#F5F5F5] hover:text-[#525252]"
      >
        <Plus className="h-5 w-5" />
        새 매장 등록
      </button>
    </div>
  );
}

// =============================================================
// Main Page Component
// =============================================================

export interface StoreManagementPageProps {
  hasStores: boolean;
  stores?: StoreItem[];
  onBack?: () => void;
}

export function StoreManagementPage({
  hasStores,
  stores = [],
  onBack,
}: StoreManagementPageProps) {
  const [view, setView] = useState<"list" | "empty" | "wizard" | "complete">(
    hasStores ? "list" : "empty"
  );

  return (
    <div className="relative min-h-screen bg-white">
      {/* Header (not shown during wizard) */}
      {view !== "wizard" && view !== "complete" && (
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-xl">
          <button
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#F5F5F5]"
          >
            <ChevronLeft className="h-5 w-5 text-[#A3A3A3]" />
          </button>
          <span className="text-sm font-semibold text-[#0A0A0A]">내 매장</span>
          <div className="w-9" />
        </header>
      )}

      {view === "empty" && (
        <StoreEmptyState
          onStartRegistration={() => setView("wizard")}
          onHasBusiness={() => setView("wizard")}
          onNoBusiness={() => setView("wizard")}
        />
      )}

      {view === "wizard" && (
        <StoreRegistrationWizard
          onBack={() => setView(hasStores ? "list" : "empty")}
          onComplete={() => setView("complete")}
        />
      )}

      {view === "complete" && (
        <RegistrationComplete
          storeName="노을재 캠핑장"
          needsReview={true}
          onViewChannel={() => {}}
          onGoToDashboard={() => setView("list")}
        />
      )}

      {view === "list" && (
        <StoreList
          stores={stores}
          onStoreClick={(id) => console.log("Navigate to dashboard:", id)}
          onAddStore={() => setView("wizard")}
        />
      )}
    </div>
  );
}

// =============================================================
// Demo
// =============================================================

export function StoreManagementPageEmptyDemo() {
  return <StoreManagementPage hasStores={false} />;
}

export function StoreManagementPageListDemo() {
  const mockStores: StoreItem[] = [
    {
      id: "1",
      name: "노을재 캠핑장",
      imageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400",
      status: "active",
      verificationLevel: "association",
      associationName: "괴산캠핑장협회",
      todayVisits: 23,
      todayCoupons: 7,
    },
    {
      id: "2",
      name: "모래재 펜션",
      imageUrl: "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=400",
      status: "pending",
      verificationLevel: "business",
      todayVisits: 0,
      todayCoupons: 0,
    },
  ];

  return <StoreManagementPage hasStores={true} stores={mockStores} />;
}
