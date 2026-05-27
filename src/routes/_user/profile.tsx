import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ErrorMessage, friendlyErrors } from "@/components/ErrorMessage";

const DISPLAY_NAME_MAX = 30;

type ProfileData = {
  userId: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export const Route = createFileRoute("/_user/profile")({
  head: () => ({ meta: [{ title: "프로필" }] }),
  loader: async (): Promise<ProfileData> => {
    const supabase = await getAuthClient();
    if (!supabase) return { userId: null, email: null, displayName: "", avatarUrl: null };
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id ?? null;
    const email = sessionData.session?.user.email ?? null;
    if (!userId) return { userId: null, email, displayName: "", avatarUrl: null };

    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    return {
      userId,
      email,
      displayName: data?.display_name ?? "",
      avatarUrl: data?.avatar_url ?? null,
    };
  },
  component: ProfilePage,
});

function getInitial(displayName: string, email: string | null): string {
  const source = displayName.trim() || email?.split("@")[0] || "?";
  return source.charAt(0).toUpperCase();
}

function ProfilePage() {
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const [name, setName] = useState(initial.displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const dirty = trimmed !== initial.displayName.trim();
  const canSave = dirty && !saving && initial.userId !== null;

  async function handleSave() {
    if (!initial.userId) {
      setError(friendlyErrors.unauthorized);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        setError(friendlyErrors.unknown);
        return;
      }
      const nextDisplayName = trimmed.length > 0 ? trimmed : null;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ display_name: nextDisplayName })
        .eq("id", initial.userId);
      if (updateError) {
        setError(friendlyErrors.unknown);
        return;
      }
      navigate({ to: "/home" });
    } catch {
      setError(friendlyErrors.network);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg tracking-ko">
      <header className="flex items-center gap-3 px-6 py-4">
        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-text-strong hover:border hover:border-border"
          aria-label="뒤로"
        >
          ←
        </button>
        <h1 className="text-xl font-extrabold text-text-strong">프로필</h1>
      </header>

      <section className="space-y-8 px-6 py-8">
        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-24 w-24">
            {initial.avatarUrl ? (
              <AvatarImage src={initial.avatarUrl} alt="프로필 사진" />
            ) : null}
            <AvatarFallback className="bg-bg text-2xl font-bold text-text-strong">
              {getInitial(name, initial.email)}
            </AvatarFallback>
          </Avatar>
          {initial.email ? (
            <p className="text-sm font-medium text-text-muted">{initial.email}</p>
          ) : null}
        </div>

        <div className="space-y-3">
          <label
            htmlFor="display-name"
            className="block text-sm font-semibold text-text-strong"
          >
            이름
          </label>
          <Input
            id="display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={DISPLAY_NAME_MAX}
            placeholder="친구들에게 보여질 이름"
            className="h-12 rounded-lg border-border bg-bg text-base text-text-strong"
          />
          <p className="text-xs font-medium text-text-subtle">
            카드와 카톡 공유에 함께 표시돼요. 비워두면 ‘사용자’로 보여요.
          </p>
        </div>

        <ErrorMessage message={error} />

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-action px-6 py-3 text-base font-bold text-white disabled:opacity-50"
        >
          {saving ? "저장 중…" : "저장"}
        </button>
      </section>
    </main>
  );
}
