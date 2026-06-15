import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ChevronDown, ChevronUp } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { DiscoverSection } from "@/components/explore/DiscoverSection";

// 만들기 입력 — '영상 검색해서 가져오기' 경로 (STEP1-fix: 정적 content_sources 리스트 → 검색 엔진 복구).
//   DiscoverSection(검색→/api/discover→후보→claim) 재사용 + onImport 로 위저드 prefill 합류.
//   후보 [가져오기] → DiscoverSection 등록(upsert claim, 멱등) → /create-wizard?url=source_url
//   (+partner_id/purpose) navigate → remount-key 경로로 url+메타 자동 prefill. YouTube 단일
//   (provider 확장은 추후 — content_sources.provider 컬럼 ready).

/** purposeEn = 현재 선택 목적(영문). 가져오기 진입 시 목적 보존용. */
export function MyContentPicker({ purposeEn }: { purposeEn?: string }) {
  const navigate = useNavigate();
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // partner_id — /api/discover 키워드 보강 + 위저드 매장 자동연결용. 손님은 null.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user.id ?? null;
        if (!uid) return;
        const { data: partner } = await supabase
          .from("partners")
          .select("id")
          .eq("owner_user_id", uid)
          .eq("verification_status", "approved")
          .limit(1)
          .maybeSingle();
        if (!cancelled) setPartnerId((partner as { id: string } | null)?.id ?? null);
      } catch (e) {
        console.error("[MyContentPicker] partner load failed:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 후보 가져오기 → ?url= prefill 경로 합류(claim 은 DiscoverSection 이 수행).
  function handleImport(c: { source_url: string }) {
    navigate({
      to: "/create-wizard",
      search: {
        url: c.source_url,
        ...(partnerId ? { partner_id: partnerId } : {}),
        ...(purposeEn ? { purpose: purposeEn } : {}),
      } as never,
    });
  }

  return (
    <section className="px-6 pt-4">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex min-h-[44px] w-full items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm font-bold tracking-ko text-text-strong transition-colors hover:border-text-muted"
        aria-expanded={expanded}
      >
        <span className="inline-flex items-center gap-2">
          <Search className="size-4" strokeWidth={2} />
          영상 검색해서 가져오기
        </span>
        {expanded ? (
          <ChevronUp className="size-4 text-text-muted" strokeWidth={2} />
        ) : (
          <ChevronDown className="size-4 text-text-muted" strokeWidth={2} />
        )}
      </button>

      {expanded ? (
        <div className="mt-2">
          <DiscoverSection
            partnerId={partnerId}
            isBusiness={Boolean(partnerId)}
            onRegistered={() => {}}
            onImport={handleImport}
          />
        </div>
      ) : null}
    </section>
  );
}
