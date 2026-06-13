import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthClient } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import { PartnerResultsPage, type PartnerResults } from "@/components/partner/PartnerResultsPage";

// #17: _partner.tsx 가 인증 + is_active_partner_owner 단독 담당. 자식 loader 는
// graceful — session/userId throw 금지 (ERR_TOO_MANY_REDIRECTS 재발 방지).

type RangeDays = 7 | 30 | 90;

type LoaderData = {
  partnerId: string | null;
  partnerName: string | null;
};

type Search = { range?: RangeDays };

function clampRange(raw: unknown): RangeDays {
  const n = typeof raw === "string" ? Number(raw) : (raw as number);
  if (n === 7 || n === 30 || n === 90) return n;
  return 30;
}

export const Route = createFileRoute("/_partner/partner/results")({
  head: () => ({ meta: [{ title: "매출관리 — LinkDrop" }] }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    range: clampRange(search.range),
  }),
  loader: async (): Promise<LoaderData> => {
    const empty: LoaderData = { partnerId: null, partnerName: null };
    const supabase = await getAuthClient();
    if (!supabase) return empty;
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id ?? null;
    if (!uid) return empty;

    const { data: partner } = await supabase
      .from("partners")
      .select("id, display_name")
      .eq("owner_user_id", uid)
      .maybeSingle();

    return {
      partnerId: partner?.id ?? null,
      partnerName: partner?.display_name ?? null,
    };
  },
  component: PartnerResultsRoute,
});

function PartnerResultsRoute() {
  const { partnerId, partnerName } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [range, setRange] = useState<RangeDays>(search.range ?? 30);
  const [results, setResults] = useState<PartnerResults | null>(null);

  // 기간 변경 시 search param 동기화 (새로고침 유지)
  useEffect(() => {
    if (search.range === range) return;
    void navigate({ search: { range }, replace: true });
  }, [range, search.range, navigate]);

  // partnerId/range 변경 시 results RPC 호출 (인증 hydrate 패턴)
  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;
    (async () => {
      const supabase = getSupabase();
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session?.user.id) return;
      const { data, error } = await supabase.rpc("get_partner_results", {
        p_partner_id: partnerId,
        p_range_days: range,
      });
      if (cancelled) return;
      if (error) {
        console.error("[partner.results] rpc failed:", error);
        setResults(null);
        return;
      }
      setResults(data as PartnerResults);
    })();
    return () => {
      cancelled = true;
    };
  }, [partnerId, range]);

  return (
    <PartnerResultsPage
      partnerName={partnerName ?? ""}
      partnerId={partnerId}
      range={range}
      results={results}
      onRangeChange={setRange}
    />
  );
}
