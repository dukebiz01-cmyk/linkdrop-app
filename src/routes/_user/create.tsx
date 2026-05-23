import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { CreateDropWizard } from "@/components/create-drop-wizard";
import {
  clearCreateDraft,
  homePurposeToWizardPurpose,
  parseHomePurposeSlug,
  parseWizardSuggestionConfidence,
  readCreateDraft,
} from "@/lib/purpose-suggestion";

type CreateSearch = {
  url?: string;
  purpose?: string;
  intent_suggested?: string;
  confidence?: string;
  platform?: string;
  source_id?: string;
};

export const Route = createFileRoute("/_user/create")({
  head: () => ({ meta: [{ title: "만들기" }] }),
  validateSearch: (search: Record<string, unknown>): CreateSearch => ({
    url: typeof search.url === "string" ? search.url : undefined,
    purpose: typeof search.purpose === "string" ? search.purpose : undefined,
    intent_suggested:
      typeof search.intent_suggested === "string" ? search.intent_suggested : undefined,
    confidence: typeof search.confidence === "string" ? search.confidence : undefined,
    platform: typeof search.platform === "string" ? search.platform : undefined,
    source_id: typeof search.source_id === "string" ? search.source_id : undefined,
  }),
  component: CreatePage,
});

function CreatePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const draft = useMemo(() => readCreateDraft(), []);

  useEffect(() => {
    if (draft) clearCreateDraft();
  }, [draft]);

  const url = draft?.url ?? search.url ?? "";
  const purposeSlug = draft?.purpose ?? parseHomePurposeSlug(search.purpose);
  const suggestedSlug =
    draft?.suggestedPurpose ?? parseHomePurposeSlug(search.intent_suggested);
  const confidence =
    draft?.confidence ?? parseWizardSuggestionConfidence(search.confidence);

  const initialPurpose = purposeSlug ? homePurposeToWizardPurpose(purposeSlug) : undefined;
  const initialSuggestedPurpose = suggestedSlug
    ? homePurposeToWizardPurpose(suggestedSlug)
    : undefined;
  // WHY: /create-wizard 와 동일하게 5단계 흐름으로 통일 — fastCreateMode 미전달.
  //      Home(url+purpose) 경유도 Step 3 목적별 세부 카드를 거친다.
  return (
    <CreateDropWizard
      initialUrl={url || undefined}
      initialPurpose={initialPurpose}
      initialSuggestedPurpose={initialSuggestedPurpose}
      initialSuggestionConfidence={confidence ?? undefined}
      initialMetadata={draft?.metadata ?? null}
      onClose={() => navigate({ to: "/home" })}
      onComplete={(data) => {
        // TODO: Step 5 완료 후 createDropV2 RPC 연결
        console.log("[create] wizard complete (mock)", data);
      }}
    />
  );
}
