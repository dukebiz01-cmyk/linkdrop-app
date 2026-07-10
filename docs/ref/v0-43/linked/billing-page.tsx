"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Sparkles,
  Check,
  X,
  CreditCard,
  MoreVertical,
  Plus,
  FileText,
  AlertTriangle,
  Building2,
  Zap,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface Plan {
  id: string;
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  isCurrent?: boolean;
  isRecommended?: boolean;
  description?: string;
}

interface PaymentMethod {
  id: string;
  type: "card" | "bank";
  brand: string;
  last4: string;
  isDefault: boolean;
}

interface PaymentHistory {
  id: string;
  date: string;
  description: string;
  amount: number;
  receiptUrl?: string;
}

interface UsageItem {
  label: string;
  used: number;
  limit: number;
}

export interface BillingPageProps {
  currentPlan: "free" | "starter" | "pro" | "business";
  nextBillingDate?: string;
  nextBillingAmount?: number;
  usage: UsageItem[];
  paymentMethods: PaymentMethod[];
  paymentHistory: PaymentHistory[];
  billingInfo?: {
    address?: string;
    businessNumber?: string;
    taxInvoice?: boolean;
  };
  onBack?: () => void;
  onChangePlan?: (planId: string) => void;
  onAddPaymentMethod?: () => void;
  onEditPaymentMethod?: (id: string) => void;
  onViewReceipt?: (id: string) => void;
  onEditBillingInfo?: () => void;
  onCancelSubscription?: (reason: string, type: "pause" | "cancel") => void;
  onBuyDiagnostic?: () => void;
}

// ============================================================
// Plans Configuration - 4 Tiers + 1 One-time
// ============================================================

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceLabel: "0원/월",
    description: "시작하기 좋은 무료 플랜",
    features: [
      "Drop 월 3개",
      "프리미엄 AI 진단 1회",
      "기본 성과 보기",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 49000,
    priceLabel: "49,000원/월",
    description: "소규모 매장 운영에 딱",
    features: [
      "Drop 월 30개",
      "AI 진단 월 5회",
      "QR 코드 3개",
      "기본 성과 리포트",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 99000,
    priceLabel: "99,000원/월",
    description: "성과 분석이 필요한 매장",
    isRecommended: true,
    features: [
      "Drop 월 100개",
      "AI 진단 월 100회",
      "정밀 진단 월 10회",
      "A/B 비교",
      "공유자별 성과",
      "네이버 예약 클릭 리포트",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: 199000,
    priceLabel: "199,000원/월",
    description: "다점포 / 프랜차이즈 운영",
    features: [
      "Drop 월 300개",
      "AI 진단 월 300회",
      "정밀 진단 월 50회",
      "월간 혜택 계획",
      "직원/지점 관리",
      "공동 프로모션",
    ],
  },
];

// ============================================================
// Main Component
// ============================================================

export function BillingPage({
  currentPlan,
  nextBillingDate,
  nextBillingAmount,
  usage,
  paymentMethods,
  paymentHistory,
  billingInfo,
  onBack,
  onChangePlan,
  onAddPaymentMethod,
  onEditPaymentMethod,
  onViewReceipt,
  onEditBillingInfo,
  onCancelSubscription,
  onBuyDiagnostic,
}: BillingPageProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelType, setCancelType] = useState<"pause" | "cancel">("pause");

  const currentPlanData = PLANS.find((p) => p.id === currentPlan);
  const isPaid = currentPlan !== "free";

  const handleCancel = () => {
    onCancelSubscription?.(cancelReason, cancelType);
    setShowCancelModal(false);
  };

  return (
    <div className="relative min-h-screen bg-[#FAFAFA] pb-8">
      {/* ─────────────────────────────────────────────────────────────
          Header
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors hover:bg-[#F5F5F5]"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="h-5 w-5 text-[#525252]" />
        </button>
        <span className="text-sm font-semibold text-[#0A0A0A]">
          결제 및 멤버십
        </span>
        <div className="w-9" />
      </header>

      <main className="mx-auto max-w-lg px-5 pt-5">
        {/* ─────────────────────────────────────────────────────────────
            Current Plan Card
        ───────────────────────────────────────────────────────────── */}
        {isPaid ? (
          <div
            className="overflow-hidden rounded-2xl p-6"
            style={{
              background: "linear-gradient(135deg, #0A0A0A 0%, #171717 100%)",
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-flex rounded-full border border-white/30 bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white">
                  {currentPlanData?.name} 회원
                </span>
                <h2 className="mt-3 text-3xl font-bold text-white">
                  {currentPlanData?.name}
                </h2>
                <p className="mt-1 text-sm text-white/80">
                  {currentPlanData?.description}
                </p>
                {nextBillingDate && nextBillingAmount && (
                  <p className="mt-3 text-sm text-white/90">
                    다음 결제: {nextBillingDate} · ₩{nextBillingAmount.toLocaleString()}
                  </p>
                )}
              </div>
              <Sparkles className="h-8 w-8 text-white/60" />
            </div>
            <button
              onClick={() => onChangePlan?.(currentPlan)}
              className="mt-5 text-sm font-medium text-white transition-opacity hover:opacity-80"
            >
              플랜 변경하기 →
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <h2 className="text-xl font-bold text-[#0A0A0A]">
              Pro로 업그레이드하세요
            </h2>
            <p className="mt-2 text-sm text-[#525252]">
              더 많은 Drop과 성과 분석 기능을 사용하세요
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-[#22C55E]">
              <Sparkles className="h-4 w-4" />
              추천 플랜
            </div>
            <button
              onClick={() => onChangePlan?.("pro")}
              className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-[#0A0A0A] text-sm font-semibold text-white transition-colors hover:bg-[#171717]"
            >
              Pro 시작하기
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            One-time Purchase Card
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-2xl border border-[#E5E5E5] bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED]">
                <Zap className="h-5 w-5 text-[#EA580C]" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0A0A0A]">프리미엄 AI 진단</p>
                <p className="text-xs text-[#525252]">"이 할인 손해일까요?" 분석</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-[#0A0A0A]">2,900원</p>
              <p className="text-xs text-[#A3A3A3]">1회</p>
            </div>
          </div>
          <button
            onClick={onBuyDiagnostic}
            className="mt-4 flex h-9 w-full items-center justify-center rounded-xl border border-[#E5E5E5] text-sm font-medium text-[#0A0A0A] transition-colors hover:bg-[#FAFAFA]"
          >
            구매하기
          </button>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Usage Card
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">이번 달 사용량</h3>
          <div className="mt-4 space-y-4">
            {usage.map((item) => {
              const percentage = (item.used / item.limit) * 100;
              const isNearLimit = percentage >= 80;
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#525252]">{item.label}</span>
                    <span className={`tabular-nums ${isNearLimit ? "text-[#EA580C]" : "text-[#525252]"}`}>
                      {item.used} / {item.limit}
                    </span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#F5F5F5]">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isNearLimit ? "bg-[#EA580C]" : "bg-[#0A0A0A]"
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Plan Comparison
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">플랜 비교</h3>
          <div className="mt-4 space-y-3">
            {PLANS.map((plan) => {
              const isCurrent = plan.id === currentPlan;
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border-2 bg-white p-5 transition-all ${
                    isCurrent
                      ? "border-[#0A0A0A]"
                      : plan.isRecommended
                        ? "border-[#BFDBFE] shadow-sm"
                        : "border-[#E5E5E5]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-[#0A0A0A]">
                        {plan.name}
                      </h4>
                      {isCurrent && (
                        <span className="rounded-full bg-[#0A0A0A] px-2 py-0.5 text-[10px] font-medium text-white">
                          현재
                        </span>
                      )}
                      {plan.isRecommended && !isCurrent && (
                        <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-medium text-[#0A0A0A]">
                          추천
                        </span>
                      )}
                    </div>
                    <span className="text-lg font-bold text-[#0A0A0A]">
                      {plan.priceLabel}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[#525252]">{plan.description}</p>

                  <div className="mt-4 border-t border-[#F5F5F5] pt-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 shrink-0 text-[#22C55E]" />
                          <span className="text-[#525252]">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => !isCurrent && onChangePlan?.(plan.id)}
                    disabled={isCurrent}
                    className={`mt-4 flex h-9 w-full items-center justify-center rounded-xl text-sm font-medium transition-all ${
                      isCurrent
                        ? "cursor-default bg-[#F5F5F5] text-[#A3A3A3]"
                        : "bg-[#0A0A0A] text-white hover:bg-[#171717]"
                    }`}
                  >
                    {isCurrent
                      ? "현재 플랜"
                      : plan.price > (currentPlanData?.price || 0)
                        ? "업그레이드"
                        : "다운그레이드"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Payment Methods
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-[#0A0A0A]">결제 수단</h3>
          <div className="mt-3 space-y-2">
            {paymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F5]">
                    <CreditCard className="h-5 w-5 text-[#525252]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#0A0A0A]">
                      {method.brand} •••• {method.last4}
                    </p>
                    {method.isDefault && (
                      <span className="text-xs text-[#0A0A0A]">기본 결제 수단</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onEditPaymentMethod?.(method.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-[#F5F5F5]"
                >
                  <MoreVertical className="h-4 w-4 text-[#A3A3A3]" />
                </button>
              </div>
            ))}

            <button
              onClick={onAddPaymentMethod}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5E5E5] bg-white text-sm font-medium text-[#A3A3A3] transition-colors hover:border-[#0A0A0A] hover:text-[#525252]"
            >
              <Plus className="h-4 w-4" />
              결제 수단 추가
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Payment History
        ───────────────────────────────────────────────────────────── */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0A0A0A]">결제 내역</h3>
            <button className="text-xs font-medium text-[#0A0A0A]">
              전체 보기
            </button>
          </div>
          <div className="mt-3 overflow-hidden rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            {paymentHistory.slice(0, 3).map((item, idx) => (
              <div
                key={item.id}
                className={`flex items-center justify-between p-4 transition-colors hover:bg-[#FAFAFA] ${
                  idx < Math.min(paymentHistory.length, 3) - 1 ? "border-b border-[#F5F5F5]" : ""
                }`}
              >
                <div>
                  <p className="text-xs text-[#A3A3A3]">{item.date}</p>
                  <p className="mt-0.5 text-sm font-medium text-[#525252]">
                    {item.description}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold tabular-nums text-[#0A0A0A]">
                    ₩{item.amount.toLocaleString()}
                  </span>
                  {item.receiptUrl && (
                    <button
                      onClick={() => onViewReceipt?.(item.id)}
                      className="flex h-8 items-center gap-1 rounded-lg bg-[#F5F5F5] px-2.5 text-xs font-medium text-[#525252] transition-colors hover:bg-[#E5E5E5]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      영수증
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            Billing Info
        ───────────────────────────────────────────────────────────── */}
        {billingInfo && (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#0A0A0A]">청구 정보</h3>
              <button
                onClick={onEditBillingInfo}
                className="text-xs font-medium text-[#0A0A0A]"
              >
                수정
              </button>
            </div>
            <div className="mt-3 rounded-xl bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              {billingInfo.address && (
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#A3A3A3]" />
                  <p className="text-sm text-[#525252]">{billingInfo.address}</p>
                </div>
              )}
              {billingInfo.businessNumber && (
                <div className="mt-3 flex items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-[#A3A3A3]" />
                  <p className="text-sm text-[#525252]">
                    사업자등록번호: {billingInfo.businessNumber}
                  </p>
                </div>
              )}
              {billingInfo.taxInvoice !== undefined && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-[#525252]">세금계산서 발행</span>
                  <span
                    className={`text-sm font-medium ${
                      billingInfo.taxInvoice ? "text-[#22C55E]" : "text-[#A3A3A3]"
                    }`}
                  >
                    {billingInfo.taxInvoice ? "발행" : "미발행"}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            Cancel Subscription
        ───────────────────────────────────────────────────────────── */}
        {isPaid && (
          <div className="mt-8 border-t border-[#F5F5F5] pt-6">
            <button
              onClick={() => setShowCancelModal(true)}
              className="text-sm font-medium text-[#EF4444] transition-opacity hover:opacity-70"
            >
              멤버십 해지하기
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-[#A3A3A3]">
          결제 관련 문의: help@drop.how
        </p>
      </main>

      {/* ─────────────────────────────────────────────────────────────
          Cancel Subscription Modal
      ───────────────────────────────────────────────────────────── */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FEE2E2]">
                <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
              </div>
              <h3 className="text-lg font-bold text-[#0A0A0A]">멤버십 해지</h3>
            </div>

            <p className="mt-4 text-sm text-[#525252]">
              해지하시면 다음 기능을 더 이상 사용할 수 없어요:
            </p>

            <ul className="mt-3 space-y-2">
              {currentPlanData?.features.map((f, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm text-[#EF4444]">
                  <X className="h-4 w-4" />
                  {f}
                </li>
              ))}
            </ul>

            {nextBillingDate && (
              <div className="mt-5 rounded-lg bg-[#FFFBEB] p-3">
                <p className="text-xs text-[#D97706]">
                  {nextBillingDate}까지는 현재 플랜을 계속 사용할 수 있어요.
                </p>
              </div>
            )}

            {/* Cancel reason */}
            <div className="mt-4">
              <label className="text-xs font-medium text-[#525252]">
                해지 사유 (선택)
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E5E5E5] bg-white px-3 text-sm text-[#525252] focus:border-[#0A0A0A] focus:outline-none"
              >
                <option value="">선택해주세요</option>
                <option value="expensive">가격이 비싸요</option>
                <option value="not-using">잘 안 쓰게 돼요</option>
                <option value="missing-feature">원하는 기능이 없어요</option>
                <option value="other">기타</option>
              </select>
            </div>

            {/* Cancel type */}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setCancelType("pause")}
                className={`flex-1 rounded-xl border-2 p-3 text-center transition-all ${
                  cancelType === "pause"
                    ? "border-[#0A0A0A] bg-[#F5F5F5]"
                    : "border-[#E5E5E5]"
                }`}
              >
                <p className="text-sm font-medium text-[#0A0A0A]">잠시 멈춤</p>
                <p className="mt-1 text-xs text-[#525252]">3개월 후 다시 시작</p>
              </button>
              <button
                onClick={() => setCancelType("cancel")}
                className={`flex-1 rounded-xl border-2 p-3 text-center transition-all ${
                  cancelType === "cancel"
                    ? "border-[#EF4444] bg-[#FEF2F2]"
                    : "border-[#E5E5E5]"
                }`}
              >
                <p className="text-sm font-medium text-[#0A0A0A]">완전 해지</p>
                <p className="mt-1 text-xs text-[#525252]">데이터 삭제</p>
              </button>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 h-11 rounded-xl border border-[#E5E5E5] text-sm font-medium text-[#525252] transition-colors hover:bg-[#FAFAFA]"
              >
                취소
              </button>
              <button
                onClick={handleCancel}
                className="flex-1 h-11 rounded-xl bg-[#EF4444] text-sm font-medium text-white transition-colors hover:bg-[#DC2626]"
              >
                해지하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BillingPage;
