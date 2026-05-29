import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoginPage } from "@/components/login-page";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { startKakaoLogin } from "@/lib/oauth-kakao";

type AuthMode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "로그인" }] }),
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  function handleModeChange(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setLoading(false);
    setFailedAttempts(0);
  }

  async function handleSignIn(email: string, password: string, _rememberMe: boolean) {
    setError(null);
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    if (!isSupabaseConfigured) {
      setError("Supabase 연결 정보가 아직 없어요. .env.local을 확인해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      setFailedAttempts(0);
      navigate({ to: "/home" });
    } catch (err) {
      console.error("[login] signInWithPassword failed:", err);
      const newCount = failedAttempts + 1;
      setFailedAttempts(newCount);
      if (newCount >= 3) {
        setError(
          "로그인이 필요해요. 다시 로그인해 주세요. 비밀번호가 기억나지 않으시면 비밀번호 찾기를 이용해 주세요.",
        );
      } else {
        setError("이메일 또는 비밀번호를 확인해 주세요.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(_email: string, _password: string, _name: string) {
    setError("회원가입은 곧 지원될 예정입니다.");
  }

  async function handleForgotPassword(_email: string) {
    setError("비밀번호 재설정 이메일이 곧 지원될 예정입니다.");
  }

  async function handleOAuthSignIn(provider: "kakao" | "google") {
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase 연결 정보가 아직 없어요. .env.local을 확인해 주세요.");
      return;
    }
    if (typeof window === "undefined") return;
    if (provider === "kakao") {
      // /login 진입 흐름은 next 미지정 → auth.callback 이 기본 /home 복귀 (회귀 0).
      const result = await startKakaoLogin();
      if (!result.ok) {
        if (result.reason !== "no_config") {
          setError("카카오 로그인 중 문제가 발생했어요. 다시 시도해 주세요.");
        }
      }
      return;
    }
    // google (또는 향후 추가) — 기존 직접 호출 유지 (회귀 0).
    const { error: oauthError } = await getSupabase().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      console.error("[login] signInWithOAuth failed:", oauthError);
      setError("Google 로그인 중 문제가 발생했어요. 다시 시도해 주세요.");
    }
  }

  return (
    <LoginPage
      mode={mode}
      onModeChange={handleModeChange}
      loading={loading}
      error={error}
      failedAttempts={failedAttempts}
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
      onOAuthSignIn={handleOAuthSignIn}
    />
  );
}
