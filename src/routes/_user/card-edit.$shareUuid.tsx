import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WIZARD_SECONDARY_BUTTON_CLASS } from "@/components/create-wizard-button-styles";

// 리뉴얼 에디터 v1 (라이트) — curator_message 만 수정.
//   curator_note 는 /d 비공개라 v1 제외(update_drop 에 p_curator_note: null 고정).
//   구조류(목적·쿠폰·예약·블록) 일절 안 건드림.
//   ★ loader 없음 — 부모 _user beforeLoad 가 auth 단독 처리(세션/userId throw 금지 →
//      리다이렉트 루프 방지). 데이터 로드는 마운트 useEffect + getSupabase().rpc.
//   get_drop_for_edit(부작용 없는 owner-scoped 로더) / update_drop(라이트 텍스트 저장) 사용.

type DropForEdit = {
  info_drop_id: string;
  share_uuid: string;
  curator_message: string | null;
  curator_note: string | null;
};

export const Route = createFileRoute("/_user/card-edit/$shareUuid")({
  head: () => ({ meta: [{ title: "메시지 수정 — LinkDrop" }] }),
  component: CardEditPage,
});

function CardEditPage() {
  const { shareUuid } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  // 마운트 — get_drop_for_edit(부작용 없음). 세션 쿠키로 auth.uid()=나 잡힘.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const { data, error } = await getSupabase().rpc("get_drop_for_edit", {
          p_share_uuid: shareUuid,
        });
        if (cancelled) return;
        if (error || !data) {
          setLoadError(true);
          return;
        }
        const row = data as unknown as DropForEdit;
        setMessage(row.curator_message ?? "");
      } catch (e) {
        console.error("[card-edit] get_drop_for_edit failed:", e);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareUuid]);

  function goBack() {
    // 뒤로가기 — 직접 진입 등 히스토리 없을 때는 /me 로.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.history.back();
    } else {
      void navigate({ to: "/me" });
    }
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await getSupabase().rpc("update_drop", {
        p_share_uuid: shareUuid,
        p_curator_message: message,
        p_curator_note: null,
      });
      if (error) {
        console.error("[card-edit] update_drop failed:", error);
        toast.error("저장하지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      toast.success("저장됐어요");
      void navigate({ to: "/me" });
    } catch (e) {
      console.error("[card-edit] update_drop unexpected:", e);
      toast.error("처리 중 문제가 생겼어요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] tracking-ko">
      <header className="border-b border-[#F1F5F9] bg-white px-5 py-4">
        <h1 className="text-lg font-bold text-[#0A0A0A]">메시지 수정</h1>
      </header>

      <div className="px-5 pt-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[#64748B]">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            불러오는 중…
          </div>
        ) : loadError ? (
          <section className="rounded-2xl bg-white p-5 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#FEF2F2]">
              <AlertTriangle className="size-6 text-[#EF4444]" strokeWidth={2} />
            </span>
            <p className="mt-3 text-sm font-semibold text-[#0A0A0A]">
              카드를 불러올 수 없어요
            </p>
            <p className="mt-1 text-xs font-medium text-[#64748B]">
              없는 카드이거나 내 카드가 아닐 수 있어요.
            </p>
            <button
              type="button"
              onClick={goBack}
              className={`${WIZARD_SECONDARY_BUTTON_CLASS} mt-4 min-h-[44px] w-full text-sm font-bold`}
            >
              뒤로가기
            </button>
          </section>
        ) : (
          <section className="space-y-4 rounded-2xl bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
            <div className="space-y-2">
              <Label htmlFor="curator-message" className="text-sm font-semibold text-[#0A0A0A]">
                친구에게 보낼 메시지
              </Label>
              <Textarea
                id="curator-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="여기 진짜 좋더라. 너 좋아할 것 같아서 보내!"
                className="resize-none"
              />
              <p className="text-xs font-medium text-[#94A3B8]">
                받는 사람에게 보이는 문구예요
              </p>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[#0A0A0A] px-4 text-sm font-bold text-white transition-colors hover:bg-[#171717] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            <button
              type="button"
              onClick={goBack}
              className={`${WIZARD_SECONDARY_BUTTON_CLASS} min-h-[44px] w-full text-sm font-bold`}
            >
              취소
            </button>
          </section>
        )}
      </div>

      <Toaster richColors position="top-center" />
    </main>
  );
}
