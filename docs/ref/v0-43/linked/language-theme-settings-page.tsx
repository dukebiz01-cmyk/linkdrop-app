"use client";

import { useState } from "react";
import {
  ChevronLeft,
  Check,
  Monitor,
  Sun,
  Moon,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

// ============================================================
// Types
// ============================================================
type Language = "ko" | "en" | "ja" | "zh";
type Theme = "system" | "light" | "dark";

interface LanguageOption {
  code: Language;
  label: string;
  sublabel: string;
  available: boolean;
}

// ============================================================
// Data
// ============================================================
const LANGUAGES: LanguageOption[] = [
  { code: "ko", label: "한국어", sublabel: "Korean", available: true },
  { code: "en", label: "English", sublabel: "영어", available: true },
  { code: "ja", label: "日本語", sublabel: "일본어", available: false },
  { code: "zh", label: "中文", sublabel: "중국어", available: false },
];

// ============================================================
// Language Settings Page
// ============================================================
interface LanguageSettingsPageProps {
  initialLanguage?: Language;
  onBack?: () => void;
  onLanguageChange?: (lang: Language) => void;
}

export function LanguageSettingsPage({
  initialLanguage = "ko",
  onBack,
  onLanguageChange,
}: LanguageSettingsPageProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(initialLanguage);
  const [showToast, setShowToast] = useState(false);

  const handleLanguageSelect = (lang: Language) => {
    const option = LANGUAGES.find(l => l.code === lang);
    if (!option?.available) return;
    
    setSelectedLanguage(lang);
    onLanguageChange?.(lang);
    
    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-[#0A0A0A]">언어</h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-8">
        {/* Language Grid */}
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLanguage === lang.code;
            const isDisabled = !lang.available;

            return (
              <button
                key={lang.code}
                onClick={() => handleLanguageSelect(lang.code)}
                disabled={isDisabled}
                className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#0A0A0A] bg-[#F5F5F5]"
                    : isDisabled
                    ? "border-[#E5E5E5] bg-[#FAFAFA] opacity-50"
                    : "border-[#E5E5E5] bg-white hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
                }`}
              >
                {/* Check icon for selected */}
                {isSelected && (
                  <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0A0A]">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}

                {/* Coming soon chip */}
                {isDisabled && (
                  <span className="absolute right-3 top-3 rounded-full bg-[#A3A3A3] px-2 py-0.5 text-[10px] font-medium text-white">
                    준비 중
                  </span>
                )}

                <span className={`text-base font-semibold ${isSelected ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>
                  {lang.label}
                </span>
                <span className="mt-0.5 text-sm text-[#A3A3A3]">{lang.sublabel}</span>
              </button>
            );
          })}
        </div>

        {/* Info text */}
        <p className="mt-6 text-center text-sm leading-relaxed text-[#A3A3A3]">
          선택한 언어는 LinkDrop 전체 UI에 적용됩니다.<br />
          영상 자막은 영상 원본 언어를 따릅니다.
        </p>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 shadow-floating">
            <Check className="h-4 w-4 text-[#22C55E]" />
            <span className="text-sm font-medium text-white">언어가 변경됐어요</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Theme Settings Page
// ============================================================
interface ThemeSettingsPageProps {
  initialTheme?: Theme;
  onBack?: () => void;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeSettingsPage({
  initialTheme = "system",
  onBack,
  onThemeChange,
}: ThemeSettingsPageProps) {
  const [selectedTheme, setSelectedTheme] = useState<Theme>(initialTheme);
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [darkStartTime, setDarkStartTime] = useState("22:00");
  const [darkEndTime, setDarkEndTime] = useState("06:00");
  const [showToast, setShowToast] = useState(false);

  const handleThemeSelect = (theme: Theme) => {
    setSelectedTheme(theme);
    onThemeChange?.(theme);
    
    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Mini preview component
  const ThemePreview = ({ theme }: { theme: Theme }) => {
    const isDark = theme === "dark";
    const isSystem = theme === "system";
    
    // System shows half-and-half
    if (isSystem) {
      return (
        <div className="relative h-24 overflow-hidden rounded-lg border border-[#E5E5E5]">
          {/* Left half - Light */}
          <div className="absolute inset-y-0 left-0 w-1/2 bg-white p-2">
            <div className="h-2 w-8 rounded bg-[#E5E5E5]" />
            <div className="mt-1.5 h-6 rounded bg-[#F5F5F5]" />
            <div className="mt-1 h-2 w-12 rounded bg-[#0A0A0A]" />
          </div>
          {/* Right half - Dark */}
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[#0A0A0A] p-2">
            <div className="h-2 w-8 rounded bg-[#525252]" />
            <div className="mt-1.5 h-6 rounded bg-[#171717]" />
            <div className="mt-1 h-2 w-12 rounded bg-[#0A0A0A]" />
          </div>
          {/* Divider */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-[#A3A3A3]" />
        </div>
      );
    }

    return (
      <div
        className={`h-24 rounded-lg border p-2 ${
          isDark
            ? "border-[#525252] bg-[#0A0A0A]"
            : "border-[#E5E5E5] bg-white"
        }`}
      >
        {/* Mock header */}
        <div className={`h-2 w-10 rounded ${isDark ? "bg-[#525252]" : "bg-[#E5E5E5]"}`} />
        {/* Mock card */}
        <div className={`mt-1.5 h-8 rounded ${isDark ? "bg-[#171717]" : "bg-[#F5F5F5]"}`} />
        {/* Mock button */}
        <div className="mt-1 h-2 w-14 rounded bg-[#0A0A0A]" />
        {/* Mock text */}
        <div className={`mt-1 h-1.5 w-16 rounded ${isDark ? "bg-[#525252]" : "bg-[#D4D4D4]"}`} />
      </div>
    );
  };

  const themes: { id: Theme; label: string; description: string; icon: typeof Monitor }[] = [
    { id: "system", label: "시스템", description: "기기 설정 따라가기", icon: Monitor },
    { id: "light", label: "라이트", description: "밝은 화면", icon: Sun },
    { id: "dark", label: "다크", description: "눈에 편한 어두운 화면", icon: Moon },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[#F5F5F5] bg-white/95 px-4 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold text-[#0A0A0A]">테마</h1>
        <div className="w-10" />
      </header>

      {/* Content */}
      <div className="flex-1 px-4 pt-6 pb-8">
        {/* Theme Cards */}
        <div className="space-y-3">
          {themes.map((theme) => {
            const isSelected = selectedTheme === theme.id;
            const Icon = theme.icon;

            return (
              <button
                key={theme.id}
                onClick={() => handleThemeSelect(theme.id)}
                className={`relative w-full overflow-hidden rounded-xl border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-[#0A0A0A] bg-[#F5F5F5]"
                    : "border-[#E5E5E5] bg-white hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
                }`}
              >
                {/* Header row */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        isSelected ? "bg-[#0A0A0A] text-white" : "bg-[#F5F5F5] text-[#A3A3A3]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className={`font-semibold ${isSelected ? "text-[#0A0A0A]" : "text-[#0A0A0A]"}`}>
                      {theme.label}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0A0A0A]">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Preview */}
                <ThemePreview theme={theme.id} />

                {/* Description */}
                <p className="mt-3 text-sm text-[#A3A3A3]">{theme.description}</p>
              </button>
            );
          })}
        </div>

        {/* Auto switch option */}
        <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F5F5F5] text-[#A3A3A3]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-[#0A0A0A]">자동 전환 시간</p>
                <p className="text-sm text-[#A3A3A3]">지정 시간에 다크 모드 활성화</p>
              </div>
            </div>
            <Switch
              checked={autoSwitch}
              onCheckedChange={setAutoSwitch}
            />
          </div>

          {/* Time pickers (shown when auto switch is on) */}
          {autoSwitch && (
            <div className="mt-4 flex items-center gap-3 border-t border-[#F5F5F5] pt-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#A3A3A3]">다크 시작</label>
                <input
                  type="time"
                  value={darkStartTime}
                  onChange={(e) => setDarkStartTime(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 text-sm text-[#0A0A0A]"
                />
              </div>
              <span className="mt-5 text-[#A3A3A3]">~</span>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-[#A3A3A3]">다크 종료</label>
                <input
                  type="time"
                  value={darkEndTime}
                  onChange={(e) => setDarkEndTime(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] px-3 text-sm text-[#0A0A0A]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Info text */}
        <p className="mt-6 text-center text-sm text-[#A3A3A3]">
          변경된 테마는 즉시 적용됩니다.
        </p>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 rounded-full bg-[#0A0A0A] px-4 py-2.5 shadow-floating">
            <Check className="h-4 w-4 text-[#22C55E]" />
            <span className="text-sm font-medium text-white">테마가 변경됐어요</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Demo Exports
// ============================================================
export function LanguageSettingsPageDemo() {
  return <LanguageSettingsPage onBack={() => console.log("Back")} />;
}

export function ThemeSettingsPageDemo() {
  return <ThemeSettingsPage onBack={() => console.log("Back")} />;
}
