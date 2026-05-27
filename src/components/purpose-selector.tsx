import { Info, Calendar, ShoppingCart, Check } from "lucide-react";

// ============================================================
// Types
// ============================================================

export type Purpose = "info" | "reservation_benefit" | "purchase";

export interface PurposeSelectorProps {
  purpose?: Purpose;
  onChange: (purpose: Purpose) => void;
  showSubActionHints?: boolean;
}

// ============================================================
// Purpose Config
// ============================================================

const PURPOSES = [
  {
    id: "info" as Purpose,
    label: "정보",
    description: "영상 / 매장 정보를 보기 좋게 정리",
    icon: Info,
    bgColor: "bg-[#EFF6FF]",
    iconColor: "text-[#2563EB]",
    borderColor: "border-[#BFDBFE]",
    buttons: ["자세히 보기", "상담 신청"],
  },
  {
    id: "reservation_benefit" as Purpose,
    label: "예약 / 혜택",
    description: "예약 받고, 쿠폰이나 할인 혜택 제공",
    subDescription: "쿠폰, 할인, 사은품 포함",
    icon: Calendar,
    bgColor: "bg-[#ECFDF5]",
    iconColor: "text-[#059669]",
    borderColor: "border-[#A7F3D0]",
    buttons: ["네이버 예약하기", "혜택 받기", "전화 문의"],
  },
  {
    id: "purchase" as Purpose,
    label: "구매",
    description: "상품이나 서비스 판매",
    icon: ShoppingCart,
    bgColor: "bg-[#FFF7ED]",
    iconColor: "text-[#EA580C]",
    borderColor: "border-[#FED7AA]",
    buttons: ["구매하기", "가격 비교", "상담 후 구매"],
  },
] as const;

// ============================================================
// Main Component
// ============================================================

export function PurposeSelector({
  purpose,
  onChange,
  showSubActionHints = true,
}: PurposeSelectorProps) {
  return (
    <div className="space-y-3">
      {PURPOSES.map((item) => {
        const Icon = item.icon;
        const isSelected = purpose === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`group w-full rounded-xl border-2 p-4 text-left transition-all duration-200 ${
              isSelected
                ? `${item.borderColor} ${item.bgColor}`
                : "border-transparent bg-[#FAFAFA] hover:bg-[#F5F5F5]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.bgColor} transition-transform duration-200 ${isSelected ? "scale-105" : "group-hover:scale-105"}`}>
                <Icon className={`h-6 w-6 ${item.iconColor}`} strokeWidth={1.75} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-base font-bold text-[#0A0A0A]">{item.label}</p>
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                    isSelected
                      ? "border-[#2563EB] bg-[#2563EB]"
                      : "border-[#E5E5E5] group-hover:border-[#A3A3A3]"
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                </div>
                <p className="mt-0.5 text-sm text-[#525252]">{item.description}</p>
                {"subDescription" in item && item.subDescription && (
                  <p className="text-xs text-[#A3A3A3]">{item.subDescription}</p>
                )}
              </div>
            </div>

            {/* Action buttons preview */}
            {showSubActionHints && isSelected && (
              <div className="mt-3 ml-15 flex flex-wrap items-center gap-1.5 animate-fade-in" style={{ marginLeft: '60px' }}>
                {item.buttons.map((btn, idx) => (
                  <span
                    key={btn}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                      idx === 0
                        ? "bg-[#2563EB] text-white"
                        : "bg-white text-[#525252] shadow-sm"
                    }`}
                  >
                    {btn}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default PurposeSelector;
