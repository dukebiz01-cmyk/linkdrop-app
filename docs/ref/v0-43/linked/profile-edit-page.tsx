"use client";

import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  Camera,
  Check,
  X,
  Loader2,
  ChevronDown,
  MapPin,
} from "lucide-react";

// ============================================================
// Profile Edit Page (/me/edit)
// WHY: avatar + username = 메이커 정체성 (Drop 카드에 표시)
// WHY: 인증 chip = 사용자 신뢰
// WHY: 소셜 계정 연결 = 다중 로그인 방법 + 매장 권한 위임
// WHY: 변경 사항 추적 = 사용자 실수 방지
// ============================================================

export interface ProfileEditData {
  name: string;
  username: string;
  bio: string;
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
  birthday: string;
  avatarUrl?: string;
  location?: string;
  socialConnections: {
    kakao: boolean;
    google: boolean;
    apple: boolean;
  };
}

export interface ProfileEditPageProps {
  initialData: ProfileEditData;
  onBack?: () => void;
  onSave?: (data: ProfileEditData) => Promise<void>;
  onAvatarUpload?: (file: File) => Promise<string>;
  onAvatarDelete?: () => void;
  onVerifyEmail?: () => void;
  onVerifyPhone?: () => void;
  onConnectSocial?: (provider: "kakao" | "google" | "apple") => void;
  onDisconnectSocial?: (provider: "kakao" | "google" | "apple") => void;
  onDeleteAccount?: () => void;
  checkUsernameAvailable?: (username: string) => Promise<boolean>;
}

export function ProfileEditPage({
  initialData,
  onBack,
  onSave,
  onAvatarUpload,
  onAvatarDelete,
  onVerifyEmail,
  onVerifyPhone,
  onConnectSocial,
  onDisconnectSocial,
  onDeleteAccount,
  checkUsernameAvailable,
}: ProfileEditPageProps) {
  const [formData, setFormData] = useState<ProfileEditData>(initialData);
  const [originalData] = useState<ProfileEditData>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track changed fields
  const changedFields = new Set<string>();
  if (formData.name !== originalData.name) changedFields.add("name");
  if (formData.username !== originalData.username) changedFields.add("username");
  if (formData.bio !== originalData.bio) changedFields.add("bio");
  if (formData.email !== originalData.email) changedFields.add("email");
  if (formData.phone !== originalData.phone) changedFields.add("phone");
  if (formData.birthday !== originalData.birthday) changedFields.add("birthday");
  if (formData.avatarUrl !== originalData.avatarUrl) changedFields.add("avatar");
  if (formData.location !== originalData.location) changedFields.add("location");

  const hasChanges = changedFields.size > 0;
  const isFormValid = formData.name.trim().length > 0 && usernameStatus !== "taken";

  // Username availability check with debounce
  useEffect(() => {
    if (formData.username === originalData.username) {
      setUsernameStatus("idle");
      return;
    }
    if (!formData.username || formData.username.length < 3) {
      setUsernameStatus("idle");
      return;
    }

    setUsernameStatus("checking");
    const timer = setTimeout(async () => {
      if (checkUsernameAvailable) {
        const available = await checkUsernameAvailable(formData.username);
        setUsernameStatus(available ? "available" : "taken");
      } else {
        // Demo: randomly available
        setUsernameStatus(Math.random() > 0.3 ? "available" : "taken");
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.username, originalData.username, checkUsernameAvailable]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      if (onAvatarUpload) {
        const url = await onAvatarUpload(file);
        setFormData({ ...formData, avatarUrl: url });
      } else {
        // Demo: create object URL
        const url = URL.createObjectURL(file);
        setFormData({ ...formData, avatarUrl: url });
      }
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = () => {
    setFormData({ ...formData, avatarUrl: undefined });
    onAvatarDelete?.();
  };

  const handleSave = async () => {
    if (!isFormValid || !hasChanges) return;
    
    setIsSaving(true);
    try {
      await onSave?.(formData);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowExitModal(true);
    } else {
      onBack?.();
    }
  };

  const renderChangeDot = (field: string) => {
    if (changedFields.has(field)) {
      return <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-[#F59E0B]" />;
    }
    return null;
  };

  return (
    <div className="relative min-h-screen bg-white pb-32">
      {/* 1. Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-xl">
        <button
          onClick={handleBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#F5F5F5]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5 text-[#A3A3A3]" />
        </button>
        <span className="text-base font-semibold text-[#0A0A0A]">프로필 수정</span>
        <button
          onClick={handleSave}
          disabled={!hasChanges || !isFormValid || isSaving}
          className={`text-sm font-semibold transition-colors ${
            hasChanges && isFormValid
              ? "text-[#0A0A0A]"
              : "text-[#A3A3A3]"
          }`}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "저장"}
        </button>
      </header>

      <main className="px-5">
        {/* 2. Avatar Section */}
        <div className="flex flex-col items-center py-8">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={formData.avatarUrl} alt={formData.name} />
              <AvatarFallback className="bg-[#E5E5E5] text-2xl font-semibold text-[#A3A3A3]">
                {formData.name.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            
            {/* Upload overlay */}
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
            
            {/* Camera button */}
            <button
              onClick={handleAvatarClick}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-[#0A0A0A] text-white shadow-elevated transition-transform hover:scale-105"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleAvatarClick}
              className="text-sm font-medium text-[#A3A3A3] transition-colors hover:text-[#525252]"
            >
              사진 변경
            </button>
            {formData.avatarUrl && (
              <>
                <span className="text-[#E5E5E5]">|</span>
                <button
                  onClick={handleDeleteAvatar}
                  className="text-sm font-medium text-[#A3A3A3] transition-colors hover:text-[#EF4444]"
                >
                  사진 삭제
                </button>
              </>
            )}
          </div>
        </div>

        {/* 3. Form Fields */}
        <div className="space-y-5">
          {/* Name (Required) */}
          <div>
            <label className="mb-1.5 flex items-center text-sm font-medium text-[#525252]">
              이름 <span className="ml-0.5 text-[#EF4444]">*</span>
              {renderChangeDot("name")}
            </label>
            <div className="relative">
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.slice(0, 30) })}
                placeholder="이름을 입력하세요"
                className="h-12 rounded-[10px] border-[1.5px] border-[#E5E5E5] pr-12 text-[15px] focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#F5F5F5]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A3A3A3]">
                {formData.name.length}/30
              </span>
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="mb-1.5 flex items-center text-sm font-medium text-[#525252]">
              @username
              {renderChangeDot("username")}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-[#A3A3A3]">@</span>
              <Input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) })}
                placeholder="username"
                className="h-12 rounded-[10px] border-[1.5px] border-[#E5E5E5] pl-8 pr-10 text-[15px] focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#F5F5F5]"
              />
              {usernameStatus === "checking" && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[#A3A3A3]" />
              )}
              {usernameStatus === "available" && (
                <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#22C55E]" />
              )}
              {usernameStatus === "taken" && (
                <X className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#EF4444]" />
              )}
            </div>
            {usernameStatus === "available" && (
              <p className="mt-1 text-xs text-[#22C55E]">사용 가능한 username입니다</p>
            )}
            {usernameStatus === "taken" && (
              <p className="mt-1 text-xs text-[#EF4444]">이미 사용 중입니다</p>
            )}
          </div>

          {/* Bio */}
          <div>
            <label className="mb-1.5 flex items-center text-sm font-medium text-[#525252]">
              한 줄 소개
              {renderChangeDot("bio")}
            </label>
            <div className="relative">
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value.slice(0, 80) })}
                placeholder="당신을 소개하는 한 줄"
                rows={2}
                className="w-full resize-none rounded-[10px] border-[1.5px] border-[#E5E5E5] px-3 py-3 text-[15px] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#F5F5F5]"
              />
              <span className="absolute bottom-2 right-3 text-xs text-[#A3A3A3]">
                {formData.bio.length}/80
              </span>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 flex items-center text-sm font-medium text-[#525252]">
              이메일
              {renderChangeDot("email")}
            </label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value, emailVerified: e.target.value === originalData.email && originalData.emailVerified })}
                placeholder="email@example.com"
                className="h-12 flex-1 rounded-[10px] border-[1.5px] border-[#E5E5E5] text-[15px] focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#F5F5F5]"
              />
              {formData.emailVerified ? (
                <span className="flex h-12 items-center rounded-lg bg-[#F0FDF4] px-3 text-xs font-medium text-[#16A34A]">
                  인증됨
                </span>
              ) : (
                <button
                  onClick={onVerifyEmail}
                  className="h-12 rounded-lg bg-[#0A0A0A] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#171717]"
                >
                  인증하기
                </button>
              )}
            </div>
            {formData.email !== originalData.email && (
              <p className="mt-1 text-xs text-[#A3A3A3]">이메일 변경 시 새로 인증이 필요합니다</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 flex items-center text-sm font-medium text-[#525252]">
              연락처
              {renderChangeDot("phone")}
            </label>
            <div className="flex gap-2">
              <button className="flex h-12 w-20 items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-[#E5E5E5] bg-white text-sm text-[#525252]">
                +82
                <ChevronDown className="h-4 w-4" />
              </button>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value, phoneVerified: e.target.value === originalData.phone && originalData.phoneVerified })}
                placeholder="010-0000-0000"
                className="h-12 flex-1 rounded-[10px] border-[1.5px] border-[#E5E5E5] text-[15px] focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#F5F5F5]"
              />
              {formData.phoneVerified ? (
                <span className="flex h-12 items-center rounded-lg bg-[#F0FDF4] px-3 text-xs font-medium text-[#16A34A]">
                  인증됨
                </span>
              ) : (
                <button
                  onClick={onVerifyPhone}
                  className="h-12 shrink-0 rounded-lg bg-[#0A0A0A] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#171717]"
                >
                  인증
                </button>
              )}
            </div>
          </div>

          {/* Birthday */}
          <div>
            <label className="mb-1.5 flex items-center text-sm font-medium text-[#525252]">
              생년월일
              {renderChangeDot("birthday")}
            </label>
            <Input
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              className="h-12 rounded-[10px] border-[1.5px] border-[#E5E5E5] text-[15px] focus:border-[#0A0A0A] focus:ring-2 focus:ring-[#F5F5F5]"
            />
            <p className="mt-1 text-xs text-[#A3A3A3]">생일 쿠폰 받기에 사용돼요</p>
          </div>
        </div>

        {/* 4. Social Connections */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">소셜 계정 연결</h3>
          <p className="mt-1 text-xs text-[#A3A3A3]">다른 방법으로도 로그인할 수 있어요</p>
          
          <div className="mt-4 space-y-2">
            {/* Kakao */}
            <div className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE500]">
                  <svg className="h-5 w-5 text-[#3C1E1E]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3C6.477 3 2 6.477 2 11c0 2.836 1.82 5.32 4.53 6.738l-.923 3.42a.5.5 0 00.77.54l3.845-2.56c.586.076 1.18.115 1.778.115 5.523 0 10-3.477 10-8.253C22 6.477 17.523 3 12 3z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-[#525252]">카카오</span>
              </div>
              {formData.socialConnections.kakao ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#22C55E]">연결됨 ✓</span>
                  <button
                    onClick={() => onDisconnectSocial?.("kakao")}
                    className="text-xs text-[#A3A3A3] hover:text-[#EF4444]"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onConnectSocial?.("kakao")}
                  className="text-sm font-medium text-[#0A0A0A]"
                >
                  연결하기
                </button>
              )}
            </div>

            {/* Google */}
            <div className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-[#E5E5E5]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-[#525252]">Google</span>
              </div>
              {formData.socialConnections.google ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#22C55E]">연결됨 ✓</span>
                  <button
                    onClick={() => onDisconnectSocial?.("google")}
                    className="text-xs text-[#A3A3A3] hover:text-[#EF4444]"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onConnectSocial?.("google")}
                  className="text-sm font-medium text-[#0A0A0A]"
                >
                  연결하기
                </button>
              )}
            </div>

            {/* Apple */}
            <div className="flex items-center justify-between rounded-xl border border-[#E5E5E5] bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-[#525252]">Apple</span>
              </div>
              {formData.socialConnections.apple ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#22C55E]">연결됨 ✓</span>
                  <button
                    onClick={() => onDisconnectSocial?.("apple")}
                    className="text-xs text-[#A3A3A3] hover:text-[#EF4444]"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onConnectSocial?.("apple")}
                  className="text-sm font-medium text-[#0A0A0A]"
                >
                  연결하기
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 5. Location */}
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">기본 위치</h3>
          <p className="mt-1 text-xs text-[#A3A3A3]">이 지역의 Drop을 받을 수 있어요</p>
          
          <button className="mt-3 flex h-12 w-full items-center justify-between rounded-[10px] border-[1.5px] border-[#E5E5E5] bg-white px-4 text-left">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#A3A3A3]" />
              <span className="text-[15px] text-[#525252]">
                {formData.location || "위치 설정하기"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-[#A3A3A3]" />
          </button>
        </div>

        {/* 7. Danger Zone */}
        <div className="mt-12 border-t border-[#F5F5F5] pt-6">
          <button
            onClick={onDeleteAccount}
            className="text-sm font-medium text-[#EF4444] transition-colors hover:text-[#DC2626]"
          >
            계정 삭제 →
          </button>
        </div>
      </main>

      {/* 6. Bottom Save Button */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-[#F5F5F5] bg-white/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-md">
          <button
            onClick={handleSave}
            disabled={!hasChanges || !isFormValid || isSaving}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold transition-all ${
              hasChanges && isFormValid
                ? "bg-[#0A0A0A] text-white shadow-subtle hover:bg-[#171717] active:scale-[0.99]"
                : "bg-[#E5E5E5] text-[#A3A3A3] cursor-not-allowed"
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                저장 중...
              </>
            ) : (
              "��장"
            )}
          </button>
          {hasChanges && (
            <button
              onClick={() => setFormData(originalData)}
              className="mt-2 w-full text-center text-sm font-medium text-[#A3A3A3] transition-colors hover:text-[#525252]"
            >
              취소
            </button>
          )}
        </div>
      </div>

      {/* Exit Confirmation Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-floating">
            <h3 className="text-lg font-semibold text-[#0A0A0A]">
              변경 사항 저장하지 않고 나갈까요?
            </h3>
            <p className="mt-2 text-sm text-[#A3A3A3]">
              저장하지 않은 내용은 사라져요
            </p>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => setShowExitModal(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[#E5E5E5] bg-white text-sm font-semibold text-[#525252] transition-all hover:bg-[#FAFAFA]"
              >
                계속 수정
              </button>
              <button
                onClick={() => {
                  setShowExitModal(false);
                  onBack?.();
                }}
                className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#EF4444] text-sm font-semibold text-white transition-all hover:bg-[#DC2626]"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-32 left-1/2 z-50 -translate-x-1/2 animate-fade-in">
          <div className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 shadow-floating">
            <Check className="h-4 w-4 text-[#22C55E]" />
            <span className="text-sm font-medium text-white">프로필이 저장됐어요</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Demo Component
export function ProfileEditPageDemo() {
  return (
    <ProfileEditPage
      initialData={{
        name: "김민수",
        username: "minsu_kim",
        bio: "캠핑 좋아하는 직장인입니다",
        email: "minsu@example.com",
        emailVerified: true,
        phone: "010-1234-5678",
        phoneVerified: true,
        birthday: "1990-05-15",
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop",
        location: "서울 · 강남구",
        socialConnections: {
          kakao: true,
          google: false,
          apple: false,
        },
      }}
    />
  );
}
