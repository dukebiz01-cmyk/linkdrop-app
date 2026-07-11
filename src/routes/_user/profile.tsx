import { useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Camera, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { resizeToSquareJpegBlob } from "@/lib/image-upload";

/**
 * 프로필 편집 — v0-45 profile-edit-page 전면 교체(구 V3 토큰 화면 대체).
 *
 * 실배선: 이름(display_name)·사용자명(username)·한줄소개(bio) → profiles.update(변경분만),
 *   아바타 → avatars 버킷 업로드(getPublicUrl → avatar_url 즉시 저장, 저장 버튼과 독립).
 * 정직 게이트: 전화·생일·위치 = disabled + "준비 중" 칩(백엔드 컬럼 부재).
 *   이메일 = auth 세션 read-only. 소셜 연결 = 카카오 identities 실표시 /
 *   구글·애플 = "준비 중"(linkIdentity 배선 부재). 계정 삭제 = /settings/privacy 안내가 준거.
 * 이탈확인 모달 = 커스텀 fixed 오버레이(홈 이벤트 화면 패턴 — Radix/포털 아님, #418 비저촉).
 */

const DISPLAY_NAME_MAX = 30;
const BIO_MAX = 160;
// DB CHECK 와 동일 — 소문자·숫자·언더스코어 3~20자.
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

type ProfileData = {
  userId: string | null;
  email: string | null;
  displayName: string;
  username: string;
  bio: string;
  avatarUrl: string | null;
  /** auth 세션 identities 의 provider 목록 — 소셜 연결 표시용. */
  providers: string[];
};

export const Route = createFileRoute("/_user/profile")({
  head: () => ({ meta: [{ title: "프로필 편집" }] }),
  loader: async (): Promise<ProfileData> => {
    const empty: ProfileData = {
      userId: null,
      email: null,
      displayName: "",
      username: "",
      bio: "",
      avatarUrl: null,
      providers: [],
    };
    const supabase = await getAuthClient();
    if (!supabase) return empty;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return empty;

    const { data } = await supabase
      .from("profiles")
      .select("display_name, username, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    return {
      userId: user.id,
      email: user.email ?? null,
      displayName: data?.display_name ?? "",
      username: data?.username ?? "",
      bio: data?.bio ?? "",
      avatarUrl: data?.avatar_url ?? null,
      providers: user.identities?.map((i) => i.provider) ?? [],
    };
  },
  component: ProfileEditPage,
});

function getInitial(displayName: string, email: string | null): string {
  const source = displayName.trim() || email?.split("@")[0] || "?";
  return source.charAt(0).toUpperCase();
}

const INPUT_CLS =
  "h-12 w-full rounded-xl border border-[#E8EDF3] bg-white px-3.5 text-[14px] font-medium text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#2563EB] disabled:bg-[#F8FAFC] disabled:text-[#94A3B8]";

function ReadyChip() {
  return (
    <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10.5px] font-bold text-[#64748B]">
      준비 중
    </span>
  );
}

function FieldLabel({
  htmlFor,
  label,
  chip,
}: {
  htmlFor: string;
  label: string;
  chip?: boolean;
}) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold text-[#0F172A]">
        {label}
      </label>
      {chip ? <ReadyChip /> : null}
    </div>
  );
}

function ProfileEditPage() {
  const initial = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  const [name, setName] = useState(initial.displayName);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const kakaoLinked = initial.providers.includes("kakao");

  const nameTrim = name.trim();
  const usernameNorm = username.trim();
  const usernameValid = usernameNorm === "" || USERNAME_RE.test(usernameNorm);
  const dirty =
    nameTrim !== initial.displayName.trim() ||
    usernameNorm !== initial.username ||
    bio.trim() !== initial.bio.trim();
  const canSave =
    dirty && !saving && initial.userId !== null && nameTrim.length > 0 && usernameValid;

  // 뒤로가기 — card-edit 패턴: 히스토리 있으면 back(원위치), 직접 진입 폴백 = /me.
  function leave() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: "/me" });
    }
  }
  function handleBack() {
    if (dirty) setExitConfirm(true);
    else leave();
  }

  async function handleSave() {
    if (!initial.userId || !canSave) return;
    setSaving(true);
    setUsernameError(null);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        toast.error("연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      // 변경된 필드만 patch — 미변경 컬럼 무접촉.
      const patch: { display_name?: string; username?: string | null; bio?: string | null } = {};
      if (nameTrim !== initial.displayName.trim()) patch.display_name = nameTrim;
      if (usernameNorm !== initial.username) patch.username = usernameNorm || null;
      if (bio.trim() !== initial.bio.trim()) patch.bio = bio.trim() || null;

      const { error: updateError } = await supabase
        .from("profiles")
        .update(patch)
        .eq("id", initial.userId);
      if (updateError) {
        // 유니크 위반(username) → 인라인 안내. 그 외 → 토스트.
        if (updateError.code === "23505") {
          setUsernameError("이미 사용 중인 사용자명이에요");
        } else {
          toast.error("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
        }
        return;
      }
      toast.success("프로필을 저장했어요.");
      leave();
    } catch {
      toast.error("네트워크에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일 재선택 허용.
    if (!file || !initial.userId || avatarUploading) return;
    setAvatarUploading(true);
    try {
      const supabase = getSupabase();
      if (!supabase) {
        toast.error("연결에 문제가 있어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const blob = await resizeToSquareJpegBlob(file);
      // 경로 첫 segment = userId → avatars RLS INSERT 통과 조건(product-images 와 동일 패턴).
      const path = `${initial.userId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", initial.userId);
      if (updErr) throw updErr;
      setAvatarUrl(pub.publicUrl);
      toast.success("프로필 사진을 바꿨어요.");
    } catch (err) {
      console.error("[profile] avatar upload failed:", err);
      toast.error("사진 업로드에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white tracking-ko">
      {/* 헤더 — 뒤로가기 + 타이틀. dirty 상태 뒤로가기는 이탈확인 모달 경유. */}
      <header className="sticky top-0 z-20 flex items-center gap-1 border-b border-[#E8EDF3] bg-white/95 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#0F172A] transition-colors hover:bg-[#F1F5F9] active:scale-95"
        >
          <ArrowLeft className="size-5" strokeWidth={2} />
        </button>
        <h1 className="text-[16px] font-bold text-[#0F172A]">프로필 편집</h1>
      </header>

      <div className="space-y-6 px-4 pb-10 pt-6">
        {/* 아바타 — 카메라 버튼 = 파일 인풋 트리거. 업로드 중 오버레이 스피너. */}
        <div className="flex justify-center">
          <div className="relative">
            <span className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-[#F1F5F9] ring-1 ring-[#E8EDF3]">
              {avatarUrl ? (
                <img src={avatarUrl} alt="프로필 사진" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[28px] font-bold text-[#94A3B8]">
                  {getInitial(name, initial.email)}
                </span>
              )}
            </span>
            {avatarUploading ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0F172A]/45">
                <Loader2 className="size-6 animate-spin text-white" strokeWidth={2.5} />
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label="프로필 사진 바꾸기"
              className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white bg-[#2563EB] text-white shadow-[0_2px_8px_rgba(37,99,235,0.35)] transition-transform active:scale-95 disabled:opacity-60"
            >
              <Camera className="size-4" strokeWidth={2.25} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </div>

        {/* 필드 6종 — 이름·사용자명·한줄소개(실배선) / 이메일(read-only) / 전화·생일(준비 중). */}
        <section className="space-y-4">
          <div>
            <FieldLabel htmlFor="pf-name" label="이름" />
            <input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={DISPLAY_NAME_MAX}
              placeholder="친구들에게 보여질 이름"
              className={INPUT_CLS}
            />
            {nameTrim.length === 0 ? (
              <p className="mt-1.5 text-[12px] font-medium text-[#DC2626]">
                이름은 비워둘 수 없어요.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-[#94A3B8]">카드와 카톡 공유에 함께 표시돼요.</p>
            )}
          </div>

          <div>
            <FieldLabel htmlFor="pf-username" label="사용자명" />
            <input
              id="pf-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase());
                setUsernameError(null);
              }}
              maxLength={20}
              placeholder="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className={INPUT_CLS}
            />
            {usernameError ? (
              <p className="mt-1.5 text-[12px] font-medium text-[#DC2626]">{usernameError}</p>
            ) : !usernameValid ? (
              <p className="mt-1.5 text-[12px] font-medium text-[#DC2626]">
                영문 소문자·숫자·언더스코어 3~20자로 지어주세요.
              </p>
            ) : (
              <p className="mt-1.5 text-[12px] text-[#94A3B8]">비워두면 표시하지 않아요.</p>
            )}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="pf-bio" className="text-[13px] font-semibold text-[#0F172A]">
                한줄소개
              </label>
              <span className="text-[11px] font-medium tabular-nums text-[#94A3B8]">
                {bio.length}/{BIO_MAX}
              </span>
            </div>
            <textarea
              id="pf-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={2}
              placeholder="나를 한 줄로 소개해 보세요"
              className="w-full resize-none rounded-xl border border-[#E8EDF3] bg-white px-3.5 py-3 text-[14px] font-medium leading-relaxed text-[#0F172A] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#2563EB]"
            />
          </div>

          <div>
            <FieldLabel htmlFor="pf-email" label="이메일" />
            <input id="pf-email" value={initial.email ?? ""} disabled className={INPUT_CLS} />
            <p className="mt-1.5 text-[12px] text-[#94A3B8]">카카오 계정 이메일</p>
          </div>

          <div>
            <FieldLabel htmlFor="pf-phone" label="전화번호" chip />
            <input id="pf-phone" value="" disabled placeholder="준비 중이에요" className={INPUT_CLS} />
          </div>

          <div>
            <FieldLabel htmlFor="pf-birthday" label="생일" chip />
            <input
              id="pf-birthday"
              value=""
              disabled
              placeholder="준비 중이에요"
              className={INPUT_CLS}
            />
          </div>
        </section>

        {/* 소셜 연결 — 카카오 = identities 실표시. 구글·애플 = linkIdentity 배선 부재 → 준비 중. */}
        <section>
          <h2 className="mb-2.5 text-[13px] font-bold text-[#0F172A]">소셜 연결</h2>
          <div className="divide-y divide-[#F1F5F9] rounded-2xl border border-[#E8EDF3] bg-white">
            <div className="flex min-h-[52px] items-center justify-between px-3.5">
              <span className="text-[13.5px] font-semibold text-[#0F172A]">카카오</span>
              {kakaoLinked ? (
                <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-bold text-[#2563EB]">
                  연결됨
                </span>
              ) : (
                <span className="text-[12px] font-medium text-[#94A3B8]">미연결</span>
              )}
            </div>
            {(["구글", "애플"] as const).map((label) => (
              <div key={label} className="flex min-h-[52px] items-center justify-between px-3.5">
                <span className="text-[13.5px] font-semibold text-[#0F172A]">{label}</span>
                <button
                  type="button"
                  disabled
                  className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-bold text-[#94A3B8]"
                >
                  준비 중
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 위치 — 백엔드 컬럼 부재 → 준비 중 게이트. */}
        <div>
          <FieldLabel htmlFor="pf-location" label="위치" chip />
          <input
            id="pf-location"
            value=""
            disabled
            placeholder="준비 중이에요"
            className={INPUT_CLS}
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#2563EB] text-[15px] font-bold text-white transition-all active:scale-[0.99] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8]"
        >
          {saving ? "저장 중…" : "변경사항 저장"}
        </button>

        {/* Danger Zone — 삭제 백엔드 부재: 기존 정직 안내(/settings/privacy 메일 요청)가 준거. */}
        <section className="rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-1">
          <button
            type="button"
            onClick={() => void navigate({ to: "/settings/privacy" })}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3.5 text-left transition-colors hover:bg-[#FEE2E2]"
          >
            <span>
              <span className="block text-[13.5px] font-bold text-[#DC2626]">계정 삭제</span>
              <span className="mt-0.5 block text-[11.5px] font-medium text-[#F87171]">
                개인정보 안내에서 삭제를 요청할 수 있어요
              </span>
            </span>
            <ChevronRight className="size-4 flex-shrink-0 text-[#F87171]" strokeWidth={2} />
          </button>
        </section>
      </div>

      {/* 이탈확인 — 커스텀 fixed 오버레이(홈 이벤트 화면 패턴, Radix 아님). */}
      {exitConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/45 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="저장하지 않고 나가기 확인"
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-soft">
            <p className="text-[15px] font-bold text-[#0F172A]">저장하지 않고 나갈까요?</p>
            <p className="mt-1 text-[12.5px] font-medium text-[#64748B]">변경한 내용이 사라져요.</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setExitConfirm(false)}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-[#E8EDF3] bg-white text-[13.5px] font-semibold text-[#0F172A] transition-colors hover:bg-[#F1F5F9]"
              >
                계속 편집
              </button>
              <button
                type="button"
                onClick={leave}
                className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-[#DC2626] text-[13.5px] font-bold text-white transition-colors hover:bg-[#B91C1C]"
              >
                나가기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
