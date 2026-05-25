import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CreateDropWizard } from "@/components/create-drop-wizard";
import type { DropPurpose } from "@/lib/types";

/**
 * v3 5단계 드롭 만들기 wizard.
 * WHY: 기존 /create(BlockEditor·Supabase 분리 INSERT)는 유지하고, 신규 UX는 별도 라우트로 검증한다.
 * WHY: Home 에서 url+purpose 를 search param 으로 넘기면 Step 1·2 를 "확인" 모드로 — 같은 질문 반복 X.
 */

type CreateWizardSearch = {
  url?: string;
  purpose?: string;
  intent_suggested?: string;
  confidence?: string;
  source_id?: string;
  platform?: string;
};

// Home(purpose-suggestion.ts)은 영문 Purpose, wizard 는 한국어 DropPurpose 사용 → 매핑.
const PURPOSE_EN_TO_KO: Record<string, DropPurpose> = {
  info: "정보",
  coupon: "쿠폰",
  reservation: "예약",
  purchase: "구매",
  lead: "상담",
};

function toDropPurpose(raw: string | undefined): DropPurpose | undefined {
  if (!raw) return undefined;
  return PURPOSE_EN_TO_KO[raw] ?? (Object.values(PURPOSE_EN_TO_KO).includes(raw as DropPurpose)
    ? (raw as DropPurpose)
    : undefined);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function toConfidence(
  v: string | undefined,
): "high" | "medium" | "low" | undefined {
  return v === "high" || v === "medium" || v === "low" ? v : undefined;
}

export const Route = createFileRoute("/_user/create-wizard")({
  head: () => ({ meta: [{ title: "드롭 만들기" }] }),
  validateSearch: (search: Record<string, unknown>): CreateWizardSearch => ({
    url: str(search.url),
    purpose: str(search.purpose),
    intent_suggested: str(search.intent_suggested),
    confidence: str(search.confidence),
    source_id: str(search.source_id),
    platform: str(search.platform),
  }),
  component: CreateWizardPage,
});

function CreateWizardPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const isFastCreateMode = false; // chunk3: always 5-step

  return (
    <CreateDropWizard
      fastCreateMode={isFastCreateMode}
      initialUrl={search.url}
      initialPurpose={toDropPurpose(search.purpose)}
      initialSuggestedPurpose={toDropPurpose(search.intent_suggested)}
      initialSuggestionConfidence={toConfidence(search.confidence)}
      initialPlatform={search.platform}
      initialSourceId={search.source_id}
      onClose={() => navigate({ to: "/home" })}
      onComplete={async (data) => {
        // wizard 의 첫 카카오톡 공유/링크 복사 클릭 시 호출.
        // POST /api/drops 로 실제 저장하고 share_uuid + 공유 URL 을 반환한다.
        const res = await fetch("/api/drops", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            media_url: data.video.url,
            purpose: data.purpose,
            curator_message: data.makerMessage || null,
          }),
        });
        const json = (await res.json()) as {
          drop?: { share_uuid?: string };
          shareable_url?: string;
          message?: string;
        };
        if (!res.ok || !json.drop?.share_uuid) {
          throw new Error(json.message ?? "DROP_CREATE_FAILED");
        }
        const shareUuid = json.drop.share_uuid;
        // shareable_url 은 prod 도메인 기준 — 로컬·preview 환경에선 현재 origin 으로 다시 만든다.
        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://app.drop.how";
        return { shareUuid, shareUrl: `${origin}/d/${shareUuid}` };
      }}
    />
  );
}
