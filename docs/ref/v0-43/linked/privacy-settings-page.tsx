"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Shield,
  Activity,
  MapPin,
  Smartphone,
  Download,
  FileText,
  UserX,
  Flag,
  Key,
  Lock,
  Pause,
  Trash2,
  AlertTriangle,
  Check,
  X,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";

// ============================================================
// Privacy & Security Settings Page
// WHY: 데이터 권리 표시 = GDPR + 한국 개인정보법
// WHY: 차단/신고 = 사용자 안전
// WHY: 위험 영역 분리 = 사용자 실수 방지
// ============================================================

export interface PrivacySettingsPageProps {
  user: {
    name: string;
    email: string;
    avatarUrl?: string;
    lastLogin: string;
    activeDevices: number;
    blockedUsers: number;
    pendingReports: number;
    totalDrops: number;
    couponUsage: number;
    receivedDrops: number;
    friendsCount: number;
  };
  twoFactorEnabled?: boolean;
  autoLockMinutes?: number;
  onBack?: () => void;
  onViewPrivacyPolicy?: () => void;
  onViewLoginHistory?: () => void;
  onManageDevices?: () => void;
  onDownloadData?: () => void;
  onViewDataUsage?: () => void;
  onManageBlocked?: () => void;
  onViewReports?: () => void;
  onChangePassword?: () => void;
  onToggle2FA?: (enabled: boolean) => void;
  onAutoLockChange?: (minutes: number) => void;
  onPauseAccount?: () => void;
  onDeleteAccount?: (reason: string, backupEmail: boolean) => void;
}

export function PrivacySettingsPage({
  user,
  twoFactorEnabled = false,
  autoLockMinutes = 5,
  onBack,
  onViewPrivacyPolicy,
  onViewLoginHistory,
  onManageDevices,
  onDownloadData,
  onViewDataUsage,
  onManageBlocked,
  onViewReports,
  onChangePassword,
  onToggle2FA,
  onAutoLockChange,
  onPauseAccount,
  onDeleteAccount,
}: PrivacySettingsPageProps) {
  const [is2FAEnabled, setIs2FAEnabled] = useState(twoFactorEnabled);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [deletePassword, setDeletePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [backupToEmail, setBackupToEmail] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const handleToggle2FA = (enabled: boolean) => {
    setIs2FAEnabled(enabled);
    onToggle2FA?.(enabled);
  };

  const handleStartDownload = () => {
    setIsDownloading(true);
    setDownloadProgress(0);
    // Simulate download progress
    const interval = setInterval(() => {
      setDownloadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 500);
    onDownloadData?.();
  };

  const handleDeleteAccount = () => {
    onDeleteAccount?.(deleteReason, backupToEmail);
    setShowDeleteModal(false);
  };

  const deleteReasons = [
    { value: "", label: "선택해주세요" },
    { value: "not-using", label: "더 이상 사용하지 않음" },
    { value: "privacy", label: "개인정보 우려" },
    { value: "bad-service", label: "서비스가 좋지 않음" },
    { value: "other", label: "기타" },
  ];

  return (
    <div className="relative min-h-screen bg-white pb-8">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-[#F5F5F5]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5 text-[#A3A3A3]" />
        </button>
        <span className="text-sm font-semibold tracking-tight text-[#0A0A0A]">
          개인정보
        </span>
        <div className="w-9" />
      </header>

      <main className="px-5 pt-6">
        {/* 1. Data Usage Info Card */}
        {/* WHY: 데이터 권리 표시 = GDPR + 한국 개인정보법 */}
        <div className="rounded-xl bg-[#FAFAFA] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F5F5F5]">
              <Shield className="h-5 w-5 text-[#0A0A0A]" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">
                LinkDrop은 당신의 데이터를 어떻게 사용하나요?
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[#A3A3A3]">
                LinkDrop은 서비스 제공을 위해 최소한의 데이터만 수집합니다. 
                수집된 데이터는 Drop 전달, 쿠폰 발급, 예약 연결에만 사용되며, 
                제3자에게 판매되지 않습니다.
              </p>
              <button
                onClick={onViewPrivacyPolicy}
                className="mt-3 text-sm font-medium text-[#0A0A0A] transition-colors hover:text-[#525252]"
              >
                자세히 보기 →
              </button>
            </div>
          </div>
        </div>

        {/* 2. Activity Section */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
            활동 내역
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#E5E5E5]">
            <button
              onClick={onViewLoginHistory}
              className="flex w-full items-center justify-between border-b border-[#F5F5F5] bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">활동 내역</p>
                  <p className="text-xs text-[#A3A3A3]">마지막 로그인: {user.lastLogin}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
            <button
              onClick={onViewLoginHistory}
              className="flex w-full items-center justify-between border-b border-[#F5F5F5] bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">로그인 기록</p>
                  <p className="text-xs text-[#A3A3A3]">최근 5개 기기 확인</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
            <button
              onClick={onManageDevices}
              className="flex w-full items-center justify-between bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">연결된 기기</p>
                  <p className="text-xs text-[#A3A3A3]">활성 기기 {user.activeDevices}개 (관리)</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
          </div>
        </section>

        {/* 3. Data Rights Section (GDPR) */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
            데이터 권리
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => setShowDownloadModal(true)}
              className="flex w-full items-center justify-between border-b border-[#F5F5F5] bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <Download className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">내 데이터 다운로드</p>
                  <p className="text-xs text-[#A3A3A3]">모든 데이터를 JSON으로 받기 · 24시간 이내</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
            <button
              onClick={onViewDataUsage}
              className="flex w-full items-center justify-between bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">데이터 사용 내역</p>
                  <p className="text-xs text-[#A3A3A3]">누구에게 어떤 데이터가 전달됐나</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
          </div>
        </section>

        {/* 4. Block & Report Section */}
        {/* WHY: 차단/신고 = 사용자 안전 */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
            차단 및 신고
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#E5E5E5]">
            <button
              onClick={onManageBlocked}
              className="flex w-full items-center justify-between border-b border-[#F5F5F5] bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <UserX className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">차단한 사용자</p>
                  <p className="text-xs text-[#A3A3A3]">{user.blockedUsers}명 차단 중</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
            <button
              onClick={onViewReports}
              className="flex w-full items-center justify-between bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <Flag className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">신고 내역</p>
                  <p className="text-xs text-[#A3A3A3]">{user.pendingReports}건 처리 중</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
          </div>
        </section>

        {/* 5. Security Section */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#A3A3A3]">
            보안
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#E5E5E5]">
            <button
              onClick={onChangePassword}
              className="flex w-full items-center justify-between border-b border-[#F5F5F5] bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <Key className="h-5 w-5 text-[#A3A3A3]" />
                <p className="text-sm font-medium text-[#0A0A0A]">비밀번호 변경</p>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
            <div className="flex items-center justify-between border-b border-[#F5F5F5] bg-white px-4 py-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">2단계 인증</p>
                  <p className="text-xs text-[#A3A3A3]">추가 보안 (SMS 또는 앱)</p>
                </div>
              </div>
              <Switch
                checked={is2FAEnabled}
                onCheckedChange={handleToggle2FA}
              />
            </div>
            <button
              onClick={() => onAutoLockChange?.(autoLockMinutes)}
              className="flex w-full items-center justify-between bg-white px-4 py-4 text-left transition-colors hover:bg-[#FAFAFA]"
            >
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-[#A3A3A3]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">자동 잠금</p>
                  <p className="text-xs text-[#A3A3A3]">{autoLockMinutes}분 후 자동 잠금 (앱 사용 시)</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
          </div>
        </section>

        {/* 6. Danger Zone */}
        {/* WHY: 위험 영역 분리 = 사용자 실수 방지 */}
        <section className="mt-8">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#EF4444]">
            위험 영역
          </h2>
          <div className="overflow-hidden rounded-xl border border-[#FECACA] bg-[#FEF2F2]">
            <button
              onClick={onPauseAccount}
              className="flex w-full items-center justify-between border-b border-[#FECACA] px-4 py-4 text-left transition-colors hover:bg-[#FEE2E2]"
            >
              <div className="flex items-center gap-3">
                <Pause className="h-5 w-5 text-[#EF4444]" />
                <div>
                  <p className="text-sm font-medium text-[#0A0A0A]">계정 일시 정지</p>
                  <p className="text-xs text-[#A3A3A3]">30일간 비활성 (다시 활성화 가능)</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-[#FEE2E2]"
            >
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-[#EF4444]" />
                <div>
                  <p className="text-sm font-medium text-[#EF4444]">계정 영구 삭제</p>
                  <p className="text-xs text-[#A3A3A3]">모든 데이터 영구 삭제 (복구 불가)</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-[#A3A3A3]" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-10 border-t border-[#F5F5F5] pt-6 pb-8">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-[#A3A3A3]">
            <button onClick={onViewPrivacyPolicy} className="hover:text-[#525252]">
              개인정보처리방침
            </button>
            <span className="text-[#E5E5E5]">|</span>
            <button className="hover:text-[#525252]">이용약관</button>
          </div>
          <p className="mt-3 text-center text-[11px] text-[#A3A3A3]">
            데이터 처리 책임자: privacy@drop.how
          </p>
        </footer>
      </main>

      {/* Download Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-floating">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#0A0A0A]">데이터 다운로드</h3>
              <button
                onClick={() => {
                  setShowDownloadModal(false);
                  setIsDownloading(false);
                  setDownloadProgress(0);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#F5F5F5]"
              >
                <X className="h-5 w-5 text-[#A3A3A3]" />
              </button>
            </div>

            {!isDownloading ? (
              <>
                <div className="mt-4 rounded-xl bg-[#FAFAFA] p-4">
                  <div className="flex items-start gap-3">
                    <Download className="h-5 w-5 shrink-0 text-[#0A0A0A]" />
                    <div>
                      <p className="text-sm font-medium text-[#0A0A0A]">
                        모든 데이터를 JSON 파일로 받을 수 있어요
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-[#A3A3A3]">
                        <li>• Drop 기록 및 내용</li>
                        <li>• 쿠폰 사용 내역</li>
                        <li>• 프로필 정보</li>
                        <li>• 활동 로그</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#FFFBEB] px-3 py-2">
                  <Mail className="h-4 w-4 shrink-0 text-[#D97706]" />
                  <p className="text-xs text-[#92400E]">
                    준비가 완료되면 {user.email}로 알려드릴게요
                  </p>
                </div>

                <p className="mt-4 text-center text-xs text-[#A3A3A3]">
                  작업 시간: 최대 24시간
                </p>

                <button
                  onClick={handleStartDownload}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-[#0A0A0A] text-sm font-semibold text-white transition-colors hover:bg-[#171717]"
                >
                  다운로드 요청하기
                </button>
              </>
            ) : (
              <>
                <div className="mt-6 text-center">
                  {downloadProgress < 100 ? (
                    <>
                      <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-[#E5E5E5] border-t-[#0A0A0A]" />
                      <p className="mt-4 text-sm font-medium text-[#0A0A0A]">
                        데이터 준비 중...
                      </p>
                      <div className="mx-auto mt-4 h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-[#E5E5E5]">
                        <div
                          className="h-full rounded-full bg-[#0A0A0A] transition-all duration-300"
                          style={{ width: `${Math.min(downloadProgress, 100)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[#A3A3A3]">
                        {Math.round(Math.min(downloadProgress, 100))}%
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F0FDF4]">
                        <Check className="h-8 w-8 text-[#22C55E]" />
                      </div>
                      <p className="mt-4 text-sm font-medium text-[#0A0A0A]">
                        요청이 접수됐어요!
                      </p>
                      <p className="mt-2 text-xs text-[#A3A3A3]">
                        준비가 완료되면 이메일로 알려드릴게요
                      </p>
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    setShowDownloadModal(false);
                    setIsDownloading(false);
                    setDownloadProgress(0);
                  }}
                  className="mt-6 flex h-12 w-full items-center justify-center rounded-xl border border-[#E5E5E5] bg-white text-sm font-semibold text-[#525252] transition-colors hover:bg-[#FAFAFA]"
                >
                  닫기
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {/* WHY: 삭제 시 복구 가능 7일 = 사용자 후회 방지 */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-floating">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FEE2E2]">
                <AlertTriangle className="h-6 w-6 text-[#EF4444]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#EF4444]">
                  정말 계정을 삭제할까요?
                </h3>
                <p className="mt-1 text-sm text-[#A3A3A3]">
                  이 작업은 되돌릴 수 없어요
                </p>
              </div>
            </div>

            {/* Data to be deleted */}
            <div className="mt-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
              <p className="text-sm font-medium text-[#0A0A0A]">영구 삭제될 데이터:</p>
              <ul className="mt-2 space-y-1.5 text-sm text-[#A3A3A3]">
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-[#EF4444]" />
                  Drop {user.totalDrops}개
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-[#EF4444]" />
                  쿠폰 사용 기록 {user.couponUsage}개
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-[#EF4444]" />
                  받은 Drop {user.receivedDrops}개
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-[#EF4444]" />
                  친구 {user.friendsCount}명과의 연결
                </li>
                <li className="flex items-center gap-2">
                  <X className="h-4 w-4 text-[#EF4444]" />
                  모든 활동 데이터
                </li>
              </ul>
            </div>

            <div className="mt-4 rounded-lg bg-[#FFFBEB] px-3 py-2">
              <p className="text-xs text-[#92400E]">
                삭제 후 7일간 복구 가능 (소셜 로그인 한정)
              </p>
            </div>

            {/* Password confirmation */}
            <div className="mt-6">
              <label className="mb-1.5 block text-sm font-medium text-[#525252]">
                비밀번호 확인
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="현재 비밀번호 입력"
                  className="h-12 w-full rounded-xl border border-[#E5E5E5] px-4 pr-12 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#A3A3A3]"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Reason select */}
            {/* WHY: 사유 수집 = 서비스 개선 (anonymous) */}
            <div className="mt-4">
              <label className="mb-1.5 block text-sm font-medium text-[#525252]">
                삭제 사유 (선택)
              </label>
              <select
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="h-12 w-full appearance-none rounded-xl border border-[#E5E5E5] bg-white px-4 text-sm text-[#0A0A0A] focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]"
              >
                {deleteReasons.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            {deleteReason === "other" && (
              <textarea
                placeholder="사유를 적어주세요 (선택)"
                className="mt-3 h-20 w-full resize-none rounded-xl border border-[#E5E5E5] p-3 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] focus:border-[#0A0A0A] focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]"
              />
            )}

            {/* Backup checkbox */}
            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <div
                onClick={() => setBackupToEmail(!backupToEmail)}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                  backupToEmail
                    ? "border-[#0A0A0A] bg-[#0A0A0A]"
                    : "border-[#D4D4D4] bg-white"
                }`}
              >
                {backupToEmail && <Check className="h-3.5 w-3.5 text-white" />}
              </div>
              <span className="text-sm text-[#525252]">
                이메일로 데이터 백업 받기
              </span>
            </label>

            {/* Action buttons */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleDeleteAccount}
                disabled={!deletePassword}
                className={`flex h-14 w-full items-center justify-center rounded-xl text-base font-semibold transition-all ${
                  deletePassword
                    ? "bg-[#EF4444] text-white hover:bg-[#DC2626]"
                    : "cursor-not-allowed bg-[#E5E5E5] text-[#A3A3A3]"
                }`}
              >
                영구 삭제
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                  setDeleteReason("");
                }}
                className="w-full py-3 text-sm font-medium text-[#525252] transition-colors hover:text-[#525252]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Demo
export function PrivacySettingsPageDemo() {
  return (
    <PrivacySettingsPage
      user={{
        name: "김지영",
        email: "jiyoung@example.com",
        lastLogin: "2시간 전",
        activeDevices: 3,
        blockedUsers: 3,
        pendingReports: 1,
        totalDrops: 23,
        couponUsage: 7,
        receivedDrops: 156,
        friendsCount: 12,
      }}
      twoFactorEnabled={false}
      autoLockMinutes={5}
    />
  );
}
