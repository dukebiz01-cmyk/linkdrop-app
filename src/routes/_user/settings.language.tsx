// /settings/language — 언어·테마 설정 (v0-43 language-theme-settings-page 이식).
//   _user 자식: 인증 가드는 부모 _user.tsx 담당. 로더 없음(순수 클라 UI) → 리다이렉트 루프 무관.
//   가 방침(E-3): 언어/테마/자동전환은 로컬 useState 로 화면만. 저장 백엔드·가짜 성공 토스트 없음.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Check, Monitor, Sun, Moon, Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type Language = "ko" | "en" | "ja" | "zh";
type Theme = "system" | "light" | "dark";

const LANGUAGES: { code: Language; label: string; sub: string; available: boolean }[] = [
  { code: "ko", label: "한국어", sub: "Korean", available: true },
  { code: "en", label: "English", sub: "영어", available: true },
  { code: "ja", label: "日本語", sub: "일본어", available: false },
  { code: "zh", label: "中文", sub: "중국어", available: false },
];

const THEMES: { id: Theme; label: string; desc: string; icon: typeof Monitor }[] = [
  { id: "system", label: "시스템", desc: "기기 설정 따라가기", icon: Monitor },
  { id: "light", label: "라이트", desc: "밝은 화면", icon: Sun },
  { id: "dark", label: "다크", desc: "눈에 편한 어두운 화면", icon: Moon },
];

export const Route = createFileRoute("/_user/settings/language")({
  head: () => ({ meta: [{ title: "언어·테마 — LinkDrop" }] }),
  component: LanguageThemeSettingsPage,
});

function SettingsHeader({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-[#F1F5F9] bg-white/95 px-2 backdrop-blur-xl">
      <Link
        to="/me"
        aria-label="뒤로"
        className="flex size-10 items-center justify-center rounded-full text-[#475569] transition-colors hover:bg-[#F1F5F9]"
      >
        <ArrowLeft className="size-5" strokeWidth={2} />
      </Link>
      <h1 className="flex-1 text-center text-[15px] font-bold tracking-[-0.01em] text-[#0F172A]">
        {title}
      </h1>
      <div className="w-10" />
    </header>
  );
}

function LanguageThemeSettingsPage() {
  // 화면만 — 로컬 상태(새로고침 시 리셋). 저장 연동 없음(§0: 가짜 저장/토스트 금지).
  const [language, setLanguage] = useState<Language>("ko");
  const [theme, setTheme] = useState<Theme>("system");
  const [autoSwitch, setAutoSwitch] = useState(false);
  const [darkStart, setDarkStart] = useState("22:00");
  const [darkEnd, setDarkEnd] = useState("06:00");

  return (
    <main className="min-h-screen bg-white tracking-ko pb-16">
      <SettingsHeader title="언어 · 테마" />

      <div className="mx-auto max-w-md px-4 pt-6">
        {/* 언어 */}
        <h2 className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
          언어
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {LANGUAGES.map((lang) => {
            const selected = language === lang.code;
            const disabled = !lang.available;
            return (
              <button
                key={lang.code}
                type="button"
                disabled={disabled}
                onClick={() => setLanguage(lang.code)}
                className={`relative flex flex-col items-start rounded-xl border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-[#0F172A] bg-[#F1F5F9]"
                    : disabled
                      ? "border-[#E8EDF3] bg-[#F8FAFC] opacity-50"
                      : "border-[#E8EDF3] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                }`}
              >
                {selected ? (
                  <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-[#0F172A]">
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </span>
                ) : null}
                {disabled ? (
                  <span className="absolute right-3 top-3 rounded-full bg-[#94A3B8] px-2 py-0.5 text-[10px] font-bold text-white">
                    준비 중
                  </span>
                ) : null}
                <span className="text-[15px] font-bold text-[#0F172A]">{lang.label}</span>
                <span className="mt-0.5 text-[12px] text-[#94A3B8]">{lang.sub}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-4 px-1 text-[12px] leading-relaxed text-[#94A3B8]">
          선택한 언어는 LinkDrop 전체 UI에 적용됩니다. 영상 자막은 영상 원본 언어를 따릅니다.
        </p>

        {/* 테마 */}
        <h2 className="mb-3 mt-8 px-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
          테마
        </h2>
        <div className="flex flex-col gap-3">
          {THEMES.map((t) => {
            const selected = theme === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                  selected
                    ? "border-[#0F172A] bg-[#F1F5F9]"
                    : "border-[#E8EDF3] bg-white hover:border-[#CBD5E1] hover:bg-[#F8FAFC]"
                }`}
              >
                <span
                  className={`flex size-9 items-center justify-center rounded-lg ${
                    selected ? "bg-[#0F172A] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
                  }`}
                >
                  <Icon className="size-[18px]" strokeWidth={2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-bold text-[#0F172A]">{t.label}</span>
                  <span className="mt-0.5 block text-[12px] text-[#94A3B8]">{t.desc}</span>
                </span>
                {selected ? (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0F172A]">
                    <Check className="size-3 text-white" strokeWidth={3} />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* 자동 전환 시간 — 로컬 UI만(실제 테마 적용 없음). */}
        <div className="mt-4 rounded-xl border border-[#E8EDF3] bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#94A3B8]">
                <Clock className="size-5" strokeWidth={2} />
              </span>
              <span>
                <span className="block text-[14px] font-medium text-[#0F172A]">자동 전환 시간</span>
                <span className="mt-0.5 block text-[12px] text-[#94A3B8]">
                  지정 시간에 다크 모드 활성화
                </span>
              </span>
            </span>
            <Switch checked={autoSwitch} onCheckedChange={setAutoSwitch} />
          </div>
          {autoSwitch ? (
            <div className="mt-4 flex items-center gap-3 border-t border-[#F1F5F9] pt-4">
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">다크 시작</label>
                <input
                  type="time"
                  value={darkStart}
                  onChange={(e) => setDarkStart(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#E8EDF3] bg-[#F8FAFC] px-3 text-sm text-[#0F172A]"
                />
              </div>
              <span className="mt-5 text-[#94A3B8]">~</span>
              <div className="flex-1">
                <label className="mb-1 block text-[11px] font-medium text-[#94A3B8]">다크 종료</label>
                <input
                  type="time"
                  value={darkEnd}
                  onChange={(e) => setDarkEnd(e.target.value)}
                  className="h-10 w-full rounded-lg border border-[#E8EDF3] bg-[#F8FAFC] px-3 text-sm text-[#0F172A]"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
