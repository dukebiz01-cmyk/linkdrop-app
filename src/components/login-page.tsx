import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  User,
  ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// v3 Home 톤 — UI only (인증 로직 무관)
const LOGIN_INPUT_ICON =
  "pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-[#94A3B8]";
const LOGIN_INPUT_CLASS =
  "h-14 w-full rounded-2xl border border-[#E2E8F0] bg-white pl-11 text-[15px] text-[#0F172A] placeholder:text-[#94A3B8] transition-colors duration-150 hover:border-[#CBD5E1] focus:border-[#0A0A0A] focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20 disabled:opacity-50";
const LOGIN_PRIMARY_BUTTON_CLASS =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#0A0A0A] text-base font-bold tracking-ko text-white transition-colors duration-150 hover:bg-[#171717] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const LOGIN_SECONDARY_BUTTON_CLASS =
  "flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-[#E2E8F0] bg-white text-sm font-semibold tracking-ko text-[#0F172A] transition-colors duration-150 hover:border-[#CBD5E1] hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-50";
const LOGIN_CARD_CLASS = "rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]";

// ─────────────────────────────────────────────────────────────
// Signature Animation Component — Brand Identity Moment
// "링크는 목적을 만나 행동이 됩니다" plays as 4-phase sequence:
// Phase 1 (0-0.3s): Gray dot grows horizontally into a line
// Phase 2 (0.3-0.5s): Line collapses back to a centered blue dot
// Phase 3 (0.5-0.7s): Text appears character-by-character
// Phase 4 (0.7-1.0s): Text color transitions from gray to black
// ─────────────────────────────────────────────────────────────

function ThesisAnimation() {
  const [hasPlayed, setHasPlayed] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const text = "링크는 목적을 만나 행동이 됩니다";
  const chars = text.split("");

  // 40ms per char stagger — total reveal ~720ms for 18 chars
  const charRevealDuration = 0.04;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    // Animation settles around 1.78s, hold static after
    const timer = setTimeout(() => setHasPlayed(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  if (prefersReducedMotion || hasPlayed) {
    return (
      <p className="mt-3 text-sm font-medium tracking-ko text-[#64748B]">{text}</p>
    );
  }

  return (
    <div className="relative mt-3 flex h-7 items-center justify-center">
      {/* Phase 1: Gray dot grows to line (0-0.3s) */}
      <motion.div
        className="absolute rounded-full bg-[#A3A3A3]"
        style={{ height: 2 }}
        initial={{ width: 6, opacity: 1 }}
        animate={{
          width: [6, 140, 140],
          opacity: [1, 1, 0],
          borderRadius: [999, 1, 1],
        }}
        transition={{
          duration: 0.3,
          times: [0, 0.9, 1],
          ease: "easeOut",
        }}
      />

      {/* Phase 2: Line collapses to blue dot (0.3-0.5s) */}
      <motion.div
        className="absolute rounded-full bg-[#0A0A0A]"
        style={{
          height: 2,
          boxShadow: "0 0 12px rgba(37,99,235,0.7)",
        }}
        initial={{ width: 0, opacity: 0 }}
        animate={{
          width: [0, 140, 8],
          opacity: [0, 1, 1],
          borderRadius: [1, 1, 999],
        }}
        transition={{
          delay: 0.3,
          duration: 0.2,
          times: [0, 0.1, 1],
          ease: "easeInOut",
        }}
      />

      {/* Blue dot pulse before text */}
      <motion.div
        className="absolute h-2 w-2 rounded-full bg-[#0A0A0A]"
        style={{ boxShadow: "0 0 12px rgba(37,99,235,0.7)" }}
        initial={{ opacity: 0, scale: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0, 1.2, 1.2, 0.5],
        }}
        transition={{
          delay: 0.5,
          duration: 0.2,
          times: [0, 0.3, 0.7, 1],
          ease: "easeOut",
        }}
      />

      {/* Phase 3-4: Text appears char-by-char with 40ms stagger, color settles after */}
      <motion.div
        className="flex"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.05 }}
      >
        {chars.map((char, i) => (
          <motion.span
            key={i}
            className="text-sm"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              color: ["#A3A3A3", "#525252", "#0A0A0A"],
              fontWeight: [400, 500, 600],
            }}
            transition={{
              delay: 0.7 + i * charRevealDuration,
              opacity: { duration: 0.05 },
              color: {
                delay: 0.7 + i * charRevealDuration + 0.2,
                duration: 0.4,
                times: [0, 0.5, 1],
                ease: "easeOut",
              },
              fontWeight: {
                delay: 0.7 + i * charRevealDuration + 0.2,
                duration: 0.4,
                times: [0, 0.5, 1],
              },
            }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AuthMode = "signin" | "signup" | "forgot";

export interface LoginPageProps {
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  onSignIn?: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  onSignUp?: (email: string, password: string, name: string) => Promise<void>;
  onForgotPassword?: (email: string) => Promise<void>;
  onOAuthSignIn?: (provider: "kakao" | "google") => Promise<void>;
  loading?: boolean;
  error?: string | null;
  failedAttempts?: number;
}

// ─────────────────────────────────────────────────────────────
// LoginPage Component
// ─────────────────────────────────────────────────────────────

export function LoginPage({
  mode = "signin",
  onModeChange,
  onSignIn,
  onSignUp,
  onForgotPassword,
  onOAuthSignIn,
  loading = false,
  error = null,
  failedAttempts = 0,
}: LoginPageProps) {
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "signin") {
      await onSignIn?.(email, password, rememberMe);
    } else if (mode === "signup") {
      await onSignUp?.(email, password, name);
    } else if (mode === "forgot") {
      await onForgotPassword?.(email);
    }
  };

  const handleModeChange = (newMode: AuthMode) => {
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
    onModeChange?.(newMode);
  };

  // Title/description based on mode
  const titles = {
    signin: { title: "로그인", description: "카드를 만들고 관리하려면 로그인해 주세요." },
    signup: { title: "회원가입", description: "정보 카드를 받고, 보낼 수 있어요" },
    forgot: { title: "비밀번호 재설정", description: "가입하신 이메일로 재설정 링크를 보내드려요" },
  };

  const buttonLabels = {
    signin: "로그인",
    signup: "계정 만들기",
    forgot: "재설정 이메일 보내기",
  };

  const loadingLabels = {
    signin: "로그인 중...",
    signup: "계정 만드는 중...",
    forgot: "보내는 중...",
  };

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(circle at top right, #FAFAFA 0%, transparent 55%), #FFFFFF",
      }}
    >
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5">
        {/* A. Logo + Thesis */}
        <div className="pt-10 text-center">
          <h1
            className="inline-flex items-center gap-1.5 text-xl font-bold tracking-ko text-[#0A0A0A]"
            style={{ letterSpacing: "-0.02em" }}
          >
            LinkDrop
            <span className="inline-block size-1.5 rounded-full bg-[#0A0A0A]" aria-hidden />
          </h1>
          <ThesisAnimation />
        </div>

        {/* B–E. Login card */}
        <div className={LOGIN_CARD_CLASS}>
          <div className="mb-6">
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => handleModeChange("signin")}
                className="mb-4 flex min-h-[44px] items-center gap-1 text-sm font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
              >
                <ArrowLeft className="size-4" strokeWidth={2} />
                로그인으로 돌아가기
              </button>
            )}
            <h2 className="text-2xl font-bold tracking-ko text-[#0F172A]">{titles[mode].title}</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed tracking-ko text-[#64748B]">
              {titles[mode].description}
            </p>
          </div>

          {/* C. Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name (signup only) */}
          {mode === "signup" && (
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-[#0A0A0A]">
                이름
              </label>
              <div className="relative">
                <User className={LOGIN_INPUT_ICON} strokeWidth={2} />
                <input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={cn(LOGIN_INPUT_CLASS, "pr-4")}
                  autoComplete="name"
                  disabled={loading}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#0A0A0A]">
              이메일
            </label>
            <div className="relative">
              <Mail className={LOGIN_INPUT_ICON} strokeWidth={2} />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(LOGIN_INPUT_CLASS, "pr-4")}
                autoComplete="email"
                disabled={loading}
              />
            </div>
          </div>

          {/* Password (signin/signup only) */}
          {mode !== "forgot" && (
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#0A0A0A]">
                비밀번호
              </label>
              <div className="relative">
                <Lock className={LOGIN_INPUT_ICON} strokeWidth={2} />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(LOGIN_INPUT_CLASS, "pr-12")}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#64748B]"
                  tabIndex={-1}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPassword ? (
                    <EyeOff className="size-[18px]" strokeWidth={2} />
                  ) : (
                    <Eye className="size-[18px]" strokeWidth={2} />
                  )}
                </button>
              </div>
              {mode === "signup" && <p className="mt-1.5 text-xs text-[#A3A3A3]">최소 8자 이상</p>}
            </div>
          )}

          {/* Password Confirm (signup only) */}
          {mode === "signup" && (
            <div>
              <label
                htmlFor="passwordConfirm"
                className="mb-1.5 block text-sm font-medium text-[#0A0A0A]"
              >
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className={LOGIN_INPUT_ICON} strokeWidth={2} />
                <input
                  id="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className={cn(LOGIN_INPUT_CLASS, "pr-12")}
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-3 top-1/2 flex min-h-[44px] min-w-[44px] -translate-y-1/2 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:bg-[#F1F5F9] hover:text-[#64748B]"
                  tabIndex={-1}
                  aria-label={showPasswordConfirm ? "비밀번호 숨기기" : "비밀번호 보기"}
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="size-[18px]" strokeWidth={2} />
                  ) : (
                    <Eye className="size-[18px]" strokeWidth={2} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#991B1B]" />
              <span className="text-sm text-[#991B1B]">{error}</span>
            </div>
          )}

          {/* Remember Me + Forgot (signin only) */}
          {mode === "signin" && (
            <div className="flex items-center justify-between gap-3 pt-1">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm font-medium text-[#64748B]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="size-4 rounded border-[#E2E8F0] text-[#0A0A0A] focus:ring-2 focus:ring-[#0A0A0A]/30"
                  disabled={loading}
                />
                로그인 상태 유지
              </label>
              <button
                type="button"
                onClick={() => handleModeChange("forgot")}
                className={cn(
                  "shrink-0 text-sm font-medium leading-none underline-offset-2 transition-colors hover:underline",
                  failedAttempts >= 3
                    ? "font-semibold text-[#0A0A0A] hover:text-[#171717]"
                    : "text-[#64748B] hover:text-[#0F172A]",
                )}
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}

          {/* Primary Button */}
          <div className="pt-2">
            <button type="submit" disabled={loading} className={LOGIN_PRIMARY_BUTTON_CLASS}>
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  {loadingLabels[mode]}
                </>
              ) : (
                buttonLabels[mode]
              )}
            </button>
          </div>
        </form>

        {/* D. Divider + OAuth (signin only) */}
        {mode === "signin" && onOAuthSignIn && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E2E8F0]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-medium tracking-ko text-[#94A3B8]">
                  또는
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onOAuthSignIn("kakao")}
                disabled={loading}
                className={cn(
                  LOGIN_SECONDARY_BUTTON_CLASS,
                  "border-transparent bg-[#FEE500] font-bold text-[#191919] hover:border-transparent hover:bg-[#FDD835]",
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <path
                    fill="#191919"
                    d="M12 3C6.48 3 2 6.48 2 10.8c0 2.76 1.86 5.19 4.66 6.57-.15.51-.96 3.3-.99 3.52 0 0-.02.16.09.22.11.06.24.01.24.01.31-.04 3.59-2.35 4.16-2.75.6.08 1.21.13 1.84.13 5.52 0 10-3.48 10-7.8S17.52 3 12 3z"
                  />
                </svg>
                <span>카카오로 계속하기</span>
              </button>
              <button
                type="button"
                onClick={() => onOAuthSignIn("google")}
                disabled={loading}
                className={cn(
                  LOGIN_SECONDARY_BUTTON_CLASS,
                  "border-[#dadce0] bg-white text-[#3c4043] hover:border-[#dadce0] hover:bg-[#f8f9fa]",
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Google로 계속하기</span>
              </button>
            </div>
          </>
        )}

        {/* E. Mode Switch (signin/signup only) */}
        {mode !== "forgot" && (
          <div className="mt-6 text-center text-sm font-medium text-[#64748B]">
            {mode === "signin" ? (
              <>
                회원이 아니신가요?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("signup")}
                  className="font-medium text-[#0A0A0A] underline-offset-2 transition-colors hover:text-[#171717] hover:underline"
                >
                  회원가입
                </button>
              </>
            ) : (
              <>
                이미 회원이신가요?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("signin")}
                  className="font-medium text-[#0A0A0A] underline-offset-2 transition-colors hover:text-[#171717] hover:underline"
                >
                  로그인
                </button>
              </>
            )}
          </div>
        )}
        </div>

        {/* Spacer */}
        <div className="min-h-8 flex-1" />

        {/* F. Footer */}
        <footer className="pb-8 pt-4 text-center">
          {/* FIX-52 커밋3 — 세션 전 이탈 경로. BottomNav 은 _user(로그인) 셸 전용이라 /login 엔
              구조상 미렌더(의도). 탭바 전체 노출 대신 홈(공개 랜딩)으로 돌아가는 링크 1개만. */}
          <a
            href="/"
            className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-medium tracking-ko text-[#64748B] transition-colors hover:text-[#0F172A]"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            홈으로
          </a>
          <p className="text-xs font-medium leading-relaxed tracking-ko text-[#94A3B8]">
            {mode === "signin" ? "로그인" : "가입"} 시 LinkDrop의{" "}
            <a href="/tos" className="text-[#525252] underline hover:text-[#0A0A0A]">
              이용약관
            </a>
            과{" "}
            <a href="/privacy" className="text-[#525252] underline hover:text-[#0A0A0A]">
              개인정보처리방침
            </a>
            에 동의하게 됩니다.
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Skeleton Variant
// ─────────────────────────────────────────────────────────────

export function LoginPageSkeleton() {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(circle at top right, #FAFAFA 0%, transparent 55%), #FFFFFF",
      }}
    >
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col px-5">
        <div className="flex flex-col items-center pt-10">
          <div className="h-6 w-28 animate-pulse rounded-lg bg-[#E2E8F0]" />
          <div className="mt-3 h-4 w-56 animate-pulse rounded-lg bg-[#E2E8F0]" />
        </div>

        <div className={`mt-6 ${LOGIN_CARD_CLASS}`}>
          <div className="mb-6 space-y-2">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-[#E2E8F0]" />
            <div className="h-4 w-64 max-w-full animate-pulse rounded-lg bg-[#E2E8F0]" />
          </div>

          <div className="space-y-4">
            <div className="h-14 w-full animate-pulse rounded-2xl bg-[#E2E8F0]" />
            <div className="h-14 w-full animate-pulse rounded-2xl bg-[#E2E8F0]" />
            <div className="flex items-center justify-between pt-1">
              <div className="h-4 w-28 animate-pulse rounded bg-[#E2E8F0]" />
              <div className="h-4 w-32 animate-pulse rounded bg-[#E2E8F0]" />
            </div>
            <div className="h-14 w-full animate-pulse rounded-2xl bg-[#E2E8F0]" />
          </div>

          <div className="my-6 h-px w-full bg-[#E2E8F0]" />

          <div className="space-y-3">
            <div className="h-14 w-full animate-pulse rounded-2xl bg-[#E2E8F0]" />
            <div className="h-14 w-full animate-pulse rounded-2xl bg-[#E2E8F0]" />
          </div>

          <div className="mt-6 flex justify-center">
            <div className="h-4 w-40 animate-pulse rounded bg-[#E2E8F0]" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Demo Export
// ─────────────────────────────────────────────────────────────

export default function LoginPageDemo() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (email: string, password: string, rememberMe: boolean) => {
    setError(null);
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (password.length < 6) {
      setError("로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.");
      setLoading(false);
      return;
    }
    setLoading(false);
    alert("로그인 성공!");
  };

  const handleSignUp = async (email: string, password: string, name: string) => {
    setError(null);
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (password.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 해요.");
      setLoading(false);
      return;
    }
    setLoading(false);
    alert(`회원가입 성공: ${name}`);
  };

  const handleForgotPassword = async (email: string) => {
    setError(null);
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setLoading(false);
    alert("재설정 이메일을 보냈어요!");
  };

  const handleOAuthSignIn = async (provider: "kakao" | "google") => {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setLoading(false);
    alert(`${provider} 로그인 성공!`);
  };

  return (
    <LoginPage
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
      onOAuthSignIn={handleOAuthSignIn}
      loading={loading}
      error={error}
    />
  );
}
