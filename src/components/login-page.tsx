import { useState, useEffect } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  User,
  MessageCircle,
  ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";

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
    return <p className="mb-12 mt-2 text-sm font-medium text-[#0A0A0A]">{text}</p>;
  }

  return (
    <div className="relative mb-12 mt-2 flex h-7 items-center justify-center">
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
        className="absolute rounded-full bg-[#2563EB]"
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
        className="absolute h-2 w-2 rounded-full bg-[#2563EB]"
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
    signin: { title: "로그인", description: "이메일로 로그인해 주세요" },
    signup: { title: "회원가입", description: "정보 드롭을 받고, 보낼 수 있어요" },
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
    <div className="flex min-h-screen flex-col bg-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        {/* A. Logo + Thesis */}
        <div className="pt-12 text-center">
          <h1 className="mb-4 text-3xl font-bold tracking-tight text-[#0A0A0A]">LinkDrop</h1>
          <ThesisAnimation />
        </div>

        {/* B. Title Section */}
        <div className="mb-8">
          {mode === "forgot" && (
            <button
              type="button"
              onClick={() => handleModeChange("signin")}
              className="mb-4 flex items-center gap-1 text-sm text-[#525252] hover:text-[#0A0A0A]"
            >
              <ArrowLeft className="h-4 w-4" />
              로그인으로 돌아가기
            </button>
          )}
          <h2 className="mb-2 text-2xl font-bold text-[#0A0A0A]">{titles[mode].title}</h2>
          <p className="text-sm leading-relaxed text-[#525252]">{titles[mode].description}</p>
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
                <User className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A3A3A3]" />
                <input
                  id="name"
                  type="text"
                  placeholder="홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 w-full rounded-lg border border-[#E5E5E5] bg-white pl-11 pr-4 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] transition-all duration-150 hover:border-[#D4D4D4] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
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
              <Mail className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A3A3A3]" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-lg border border-[#E5E5E5] bg-white pl-11 pr-4 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] transition-all duration-150 hover:border-[#D4D4D4] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
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
                <Lock className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A3A3A3]" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-lg border border-[#E5E5E5] bg-white pl-11 pr-12 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] transition-all duration-150 hover:border-[#D4D4D4] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[#A3A3A3] hover:bg-[#F5F5F5] hover:text-[#525252]"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
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
                <Lock className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#A3A3A3]" />
                <input
                  id="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="h-12 w-full rounded-lg border border-[#E5E5E5] bg-white pl-11 pr-12 text-base text-[#0A0A0A] placeholder:text-[#A3A3A3] transition-all duration-150 hover:border-[#D4D4D4] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2"
                  autoComplete="new-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[#A3A3A3] hover:bg-[#F5F5F5] hover:text-[#525252]"
                  tabIndex={-1}
                >
                  {showPasswordConfirm ? (
                    <EyeOff className="h-[18px] w-[18px]" />
                  ) : (
                    <Eye className="h-[18px] w-[18px]" />
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
            <div className="flex items-center justify-between pt-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[#525252]">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-[#E5E5E5] text-[#2563EB] focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-1"
                  disabled={loading}
                />
                로그인 상태 유지
              </label>
              <button
                type="button"
                onClick={() => handleModeChange("forgot")}
                className={
                  failedAttempts >= 3
                    ? "text-sm font-semibold text-[#2563EB] underline underline-offset-2 transition-colors hover:text-[#1D4ED8]"
                    : "text-sm text-[#525252] underline-offset-2 transition-colors hover:text-[#0A0A0A] hover:underline"
                }
              >
                비밀번호를 잊으셨나요?
              </button>
            </div>
          )}

          {/* Primary Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#2563EB] text-base font-medium text-white shadow-[0_4px_14px_0_rgba(37,99,235,0.25)] transition-all duration-150 ease-out hover:bg-[#1D4ED8] hover:shadow-[0_6px_20px_0_rgba(37,99,235,0.35)] focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:ring-offset-2 active:bg-[#1E40AF] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                <div className="w-full border-t border-[#F5F5F5]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs tracking-wide text-[#A3A3A3]">또는</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onOAuthSignIn("kakao")}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#E5E5E5] bg-white text-sm font-medium text-[#0A0A0A] transition-all duration-150 hover:border-[#D4D4D4] hover:bg-[#FAFAFA] active:bg-[#F5F5F5] disabled:opacity-50"
              >
                <MessageCircle className="h-5 w-5 text-[#525252]" />
                카카오로 계속하기
              </button>
              <button
                type="button"
                onClick={() => onOAuthSignIn("google")}
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-[#E5E5E5] bg-white text-sm font-medium text-[#0A0A0A] transition-all duration-150 hover:border-[#D4D4D4] hover:bg-[#FAFAFA] active:bg-[#F5F5F5] disabled:opacity-50"
              >
                <span className="flex h-5 w-5 items-center justify-center font-bold text-[#525252]">
                  G
                </span>
                Google로 계속하기
              </button>
            </div>
          </>
        )}

        {/* E. Mode Switch (signin/signup only) */}
        {mode !== "forgot" && (
          <div className="mt-8 text-center text-sm text-[#525252]">
            {mode === "signin" ? (
              <>
                회원이 아니신가요?{" "}
                <button
                  type="button"
                  onClick={() => handleModeChange("signup")}
                  className="font-medium text-[#2563EB] underline-offset-2 transition-colors hover:text-[#1D4ED8] hover:underline"
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
                  className="font-medium text-[#2563EB] underline-offset-2 transition-colors hover:text-[#1D4ED8] hover:underline"
                >
                  로그인
                </button>
              </>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* F. Footer */}
        <footer className="pb-8 pt-6 text-center">
          <p className="text-xs leading-relaxed text-[#A3A3A3]">
            {mode === "signin" ? "로그인" : "가입"} 시 LinkDrop의{" "}
            <a href="#" className="text-[#525252] underline hover:text-[#0A0A0A]">
              이용약관
            </a>
            과{" "}
            <a href="#" className="text-[#525252] underline hover:text-[#0A0A0A]">
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
    <div className="flex min-h-screen flex-col bg-white">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        {/* Logo */}
        <div className="flex flex-col items-center pt-12">
          <div className="h-9 w-32 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="mb-12 mt-4 h-5 w-56 animate-pulse rounded bg-[#E5E5E5]" />
        </div>

        {/* Title */}
        <div className="mb-8">
          <div className="mb-2 h-8 w-24 animate-pulse rounded bg-[#E5E5E5]" />
          <div className="h-5 w-40 animate-pulse rounded bg-[#E5E5E5]" />
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 h-4 w-12 animate-pulse rounded bg-[#E5E5E5]" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-[#E5E5E5]" />
          </div>
          <div>
            <div className="mb-1.5 h-4 w-16 animate-pulse rounded bg-[#E5E5E5]" />
            <div className="h-12 w-full animate-pulse rounded-lg bg-[#E5E5E5]" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="h-4 w-28 animate-pulse rounded bg-[#E5E5E5]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[#E5E5E5]" />
          </div>
          <div className="pt-4">
            <div className="h-12 w-full animate-pulse rounded-lg bg-[#E5E5E5]" />
          </div>
        </div>

        {/* Divider */}
        <div className="my-6 h-px w-full animate-pulse bg-[#E5E5E5]" />

        {/* OAuth buttons */}
        <div className="space-y-3">
          <div className="h-12 w-full animate-pulse rounded-lg bg-[#E5E5E5]" />
          <div className="h-12 w-full animate-pulse rounded-lg bg-[#E5E5E5]" />
        </div>

        {/* Mode switch */}
        <div className="mt-8 flex justify-center">
          <div className="h-4 w-40 animate-pulse rounded bg-[#E5E5E5]" />
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
