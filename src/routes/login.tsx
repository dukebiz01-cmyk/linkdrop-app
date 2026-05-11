import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ActionButton } from "@/components/ActionButton";
import { ErrorMessage, friendlyErrors } from "@/components/ErrorMessage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "로그인" }],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured) {
      setError("Supabase 연결 정보가 아직 없어요. .env.local을 확인해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      window.location.href = "/home";
    } catch {
      setError(friendlyErrors.unauthorized);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center bg-bg px-6 py-12">
      <h1 className="text-2xl font-extrabold text-text-strong">로그인</h1>
      <p className="mt-2 text-sm font-medium text-text-muted">
        이메일과 비밀번호로 로그인해 주세요.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-text-strong">이메일</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-2 block w-full min-h-[44px] rounded-lg border border-border bg-bg px-4 py-3 text-base font-medium text-text-strong placeholder:text-text-subtle"
            placeholder="you@example.com"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-text-strong">비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-2 block w-full min-h-[44px] rounded-lg border border-border bg-bg px-4 py-3 text-base font-medium text-text-strong placeholder:text-text-subtle"
          />
        </label>
        <ErrorMessage message={error} />
        <ActionButton type="submit" disabled={loading} className="w-full">
          {loading ? "확인 중…" : "로그인"}
        </ActionButton>
      </form>
    </main>
  );
}