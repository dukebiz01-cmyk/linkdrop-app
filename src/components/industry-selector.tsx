import { useState, type ReactElement } from "react";
import { Check, ChevronRight } from "lucide-react";

// ============================================================
// Types
// ============================================================

export type Industry =
  | "camping"
  | "restaurant"
  | "cafe"
  | "salon"
  | "realestate"
  | "medical"
  | "other";

export type MedicalSpecialty =
  | "dental"
  | "plastic_derma"
  | "checkup"
  | "oriental"
  | "eye"
  | "veterinary"
  | "other_medical";

export interface IndustrySelectorProps {
  industry?: Industry;
  specialty?: MedicalSpecialty;
  onChange: (industry: Industry, specialty?: MedicalSpecialty) => void;
}

// ============================================================
// Industry Config
// ============================================================

const INDUSTRIES = [
  { id: "camping" as Industry, label: "캠핑 / 펜션", icon: "tent" },
  { id: "restaurant" as Industry, label: "맛집", icon: "utensils" },
  { id: "cafe" as Industry, label: "카페", icon: "coffee" },
  { id: "salon" as Industry, label: "미용실", icon: "scissors" },
  { id: "realestate" as Industry, label: "부동산", icon: "home" },
  { id: "medical" as Industry, label: "병원 / 의료", icon: "stethoscope", hasSpecialty: true },
  { id: "other" as Industry, label: "기타", icon: "package" },
] as const;

const MEDICAL_SPECIALTIES = [
  { id: "dental" as MedicalSpecialty, label: "치과" },
  { id: "plastic_derma" as MedicalSpecialty, label: "성형 / 피부" },
  { id: "checkup" as MedicalSpecialty, label: "검진센터" },
  { id: "oriental" as MedicalSpecialty, label: "한의원" },
  { id: "eye" as MedicalSpecialty, label: "안과" },
  { id: "veterinary" as MedicalSpecialty, label: "동물병원" },
  { id: "other_medical" as MedicalSpecialty, label: "기타 의료기관" },
] as const;

// ============================================================
// Main Component
// ============================================================

export function IndustrySelector({
  industry,
  specialty,
  onChange,
}: IndustrySelectorProps) {
  const [showSpecialty, setShowSpecialty] = useState(industry === "medical");

  const handleIndustrySelect = (id: Industry) => {
    if (id === "medical") {
      setShowSpecialty(true);
    } else {
      setShowSpecialty(false);
      onChange(id, undefined);
    }
  };

  const handleSpecialtySelect = (id: MedicalSpecialty) => {
    onChange("medical", id);
  };

  const selectedIndustry = INDUSTRIES.find(i => i.id === industry);

  return (
    <div className="space-y-4">
      {/* Industry Selection */}
      {!showSpecialty && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 animate-fade-in">
          {INDUSTRIES.map((item) => {
            const isSelected = industry === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleIndustrySelect(item.id)}
                className={`group relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
                  isSelected
                    ? "border-[#0A0A0A] bg-[#FAFAFA]"
                    : "border-transparent bg-[#FAFAFA] hover:bg-[#F5F5F5]"
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                  isSelected ? "bg-[#0A0A0A]" : "bg-white"
                }`}>
                  <IndustryIcon
                    icon={item.icon}
                    className={`h-5 w-5 ${isSelected ? "text-white" : "text-[#525252]"}`}
                  />
                </div>
                <span className={`text-sm font-medium ${isSelected ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>
                  {item.label}
                </span>
                {"hasSpecialty" in item && item.hasSpecialty && (
                  <ChevronRight className="absolute right-2 top-2 h-4 w-4 text-[#A3A3A3]" />
                )}
                {isSelected && (
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0A0A]">
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Medical Specialty Selection */}
      {showSpecialty && (
        <div className="animate-slide-up">
          <button
            onClick={() => setShowSpecialty(false)}
            className="mb-4 flex items-center gap-2 text-sm font-medium text-[#0A0A0A] hover:underline"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
            업종 다시 선택
          </button>

          <div className="mb-3 rounded-lg bg-[#FAFAFA] p-3">
            <p className="text-sm font-medium text-[#0A0A0A]">병원 / 의료 선택됨</p>
            <p className="mt-1 text-xs text-[#525252]">진료과를 선택해 주세요</p>
          </div>

          <div className="grid grid-cols-2 gap-2 animate-fade-in">
            {MEDICAL_SPECIALTIES.map((item) => {
              const isSelected = specialty === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSpecialtySelect(item.id)}
                  className={`relative flex items-center gap-3 rounded-xl border-2 p-3 transition-all duration-200 ${
                    isSelected
                      ? "border-[#0A0A0A] bg-[#FAFAFA]"
                      : "border-transparent bg-[#FAFAFA] hover:bg-[#F5F5F5]"
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                    isSelected
                      ? "border-[#0A0A0A] bg-[#0A0A0A]"
                      : "border-[#E5E5E5]"
                  }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </div>
                  <span className={`text-sm font-medium ${isSelected ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Medical Warning */}
          {specialty && (
            <div className="mt-4 rounded-lg border border-[#FEF3C7] bg-[#FFFBEB] p-3 animate-fade-in">
              <p className="text-xs font-medium text-[#D97706]">의료 광고 안내</p>
              <p className="mt-1 text-xs text-[#525252] leading-relaxed">
                의료 광고는 광고심의필 번호가 필요할 수 있습니다.
                면책 문구가 자동으로 부착됩니다.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Industry Icon Component
// ============================================================

function IndustryIcon({ icon, className }: { icon: string; className?: string }) {
  const iconMap: Record<string, ReactElement> = {
    tent: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 21 12 3l8.5 18H3.5Z" />
        <path d="M12 21V11" />
      </svg>
    ),
    utensils: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    ),
    coffee: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
        <line x1="6" x2="6" y1="2" y2="4" />
        <line x1="10" x2="10" y1="2" y2="4" />
        <line x1="14" x2="14" y1="2" y2="4" />
      </svg>
    ),
    scissors: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3" />
        <path d="M8.12 8.12 12 12" />
        <path d="M20 4 8.12 15.88" />
        <circle cx="6" cy="18" r="3" />
        <path d="M14.8 14.8 20 20" />
      </svg>
    ),
    home: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    stethoscope: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
        <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
        <circle cx="20" cy="10" r="2" />
      </svg>
    ),
    package: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7.5 4.27 9 5.15" />
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="m3.3 7 8.7 5 8.7-5" />
        <path d="M12 22V12" />
      </svg>
    ),
  };

  return iconMap[icon] || null;
}

export default IndustrySelector;
