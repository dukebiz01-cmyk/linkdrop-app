import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoginPage } from "@/components/login-page";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { startKakaoLogin } from "@/lib/oauth-kakao";

type AuthMode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "로그인" }] }),
  // BUG-4 — 복귀 주소(redirect). _user 게이트가 ?redirect=%2Fhome 형식으로 보내는 파라미터명
  //   그대로 소비. 오픈 리다이렉트 방지: 같은-오리진 경로("/..." 시작·"//" 차단)만 통과.
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const r = search.redirect;
    return typeof r === "string" && r.startsWith("/") && !r.startsWith("//") ? { redirect: r } : {};
  },
  component: LoginRoute,
});

function LoginRoute() {
  const navigate = useNavigate();
  const { redirect: redirectParam } = Route.useSearch();
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
      // BUG-4 — 복귀 주소(redirectParam, 같은-오리진 경로) 소비. 없으면 현행 /home.
      //   쿼리 보존 위해 하드 내비게이션(예: /me?claimed=…, /create-wizard?url=…).
      if (redirectParam) {
        window.location.assign(redirectParam);
      } else {
        navigate({ to: "/home" });
      }
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
      // BUG-4 — 복귀 주소(redirectParam)를 OAuth next 로 전달(startKakaoLogin 이 같은-오리진
      //   가드 재적용). redirect 없으면 undefined → auth.callback 기본 /home 복귀(현행).
      const result = await startKakaoLogin(redirectParam);
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
