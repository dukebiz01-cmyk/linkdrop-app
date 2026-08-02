// UI-5-T7-F7-2b — 사용자 설정 영속(설정 3페이지 공유 헬퍼).
//   저장소 = profiles.settings jsonb(NOT NULL DEFAULT '{}') 단일 컬럼 · eq("id", uid) = profile.tsx :166 관례.
//   saveSettings = 최신 서버값 재조회 후 최상위 shallow merge(페이지는 자기 키만 patch — 타 페이지 키 보존).
//   실패 = boolean 반환(무언 실패 금지 — 표시 책임은 호출 화면). 가짜 성공 표시 없음.
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";

export type UserSettings = Record<string, unknown>;

async function currentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await getSupabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/** 현재 유저 settings 1회 조회. 미로그인·실패 = null(화면은 기본값 유지). */
export async function loadSettings(): Promise<UserSettings | null> {
  const uid = await currentUserId();
  if (!uid) return null;
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("settings")
    .eq("id", uid)
    .maybeSingle();
  if (error) return null;
  return ((data?.settings as UserSettings | null) ?? {}) as UserSettings;
}

/** 최상위 shallow merge 저장. 성공 여부 반환(호출 화면이 실패 표시 담당). */
export async function saveSettings(patch: UserSettings): Promise<boolean> {
  const uid = await currentUserId();
  if (!uid) return false;
  const supabase = getSupabase();
  const { data, error: readError } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", uid)
    .maybeSingle();
  if (readError) return false;
  const merged = { ...(((data?.settings as UserSettings | null) ?? {}) as UserSettings), ...patch };
  const { error } = await supabase.from("profiles").update({ settings: merged }).eq("id", uid);
  return !error;
}
