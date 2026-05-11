import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Megaphone,
  MessageCircle,
  Phone,
  Plus,
  Settings,
  ShoppingBag,
  Theater,
  Ticket,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ActionButton } from "@/components/ActionButton";
import { ErrorMessage } from "@/components/ErrorMessage";
import { AdDisclosure } from "@/components/AdDisclosure";
import { SourceAttribution } from "@/components/SourceAttribution";
import { SortableBlock } from "@/components/create/BlockEditor";
import {
  PartnerPickerModal,
  type PartnerOption,
} from "@/components/create/PartnerPickerModal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchOEmbed, parseVideoUrl, type OEmbedResult } from "@/lib/oembed";
import {
  BLOCK_KINDS,
  FALLBACK_ALLOWED_BY_INTENT,
  FALLBACK_REQUIRED_BY_INTENT,
  KIND_LABEL,
  REQUIRES_DISCLOSURE,
  emptyData,
  newId,
  type BlockDraft,
  type BlockKind,
} from "@/lib/create-flow/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_user/create")({
  head: () => ({ meta: [{ title: "만들기" }] }),
  component: CreatePage,
});

type StepNum = 1 | 2 | 3;

interface IntentType {
  id: string;
  key: string;
  name_ko: string;
  requires_partner: boolean;
  is_active: boolean;
  default_required_blocks?: BlockKind[] | null;
  allowed_blocks?: BlockKind[] | null;
  requires_disclosure?: boolean | null;
}

const INTENT_FALLBACK: IntentType[] = [
  { id: "info", key: "info", name_ko: "정보 공유", requires_partner: false, is_active: true },
  { id: "discussion", key: "discussion", name_ko: "친구와 의논", requires_partner: false, is_active: true },
  { id: "coupon", key: "coupon", name_ko: "쿠폰", requires_partner: true, is_active: true },
  { id: "reservation", key: "reservation", name_ko: "예약 유도", requires_partner: true, is_active: true },
  { id: "commerce", key: "commerce", name_ko: "구매 유도", requires_partner: true, is_active: true },
  { id: "ticket", key: "ticket", name_ko: "티켓 판매", requires_partner: true, is_active: true },
  { id: "lead", key: "lead", name_ko: "상담 신청", requires_partner: true, is_active: true },
  { id: "campaign", key: "campaign", name_ko: "공식 안내", requires_partner: false, is_active: true },
  { id: "custom", key: "custom", name_ko: "직접 설정", requires_partner: false, is_active: true },
];

const INTENT_META: Record<
  string,
  { icon: LucideIcon; stripVar: string }
> = {
  info: { icon: BookOpen, stripVar: "var(--color-intent-info-strip)" },
  discussion: { icon: MessageCircle, stripVar: "var(--color-intent-discussion-strip)" },
  coupon: { icon: Ticket, stripVar: "var(--color-intent-coupon-strip)" },
  reservation: { icon: Calendar, stripVar: "var(--color-intent-reservation-strip)" },
  commerce: { icon: ShoppingBag, stripVar: "var(--color-intent-commerce-strip)" },
  ticket: { icon: Theater, stripVar: "var(--color-intent-ticket-strip)" },
  lead: { icon: Phone, stripVar: "var(--color-intent-lead-strip)" },
  campaign: { icon: Megaphone, stripVar: "var(--color-intent-campaign-strip)" },
  custom: { icon: Settings, stripVar: "var(--color-intent-custom-strip)" },
};

function CreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<StepNum>(1);
  const [contentSourceId, setContentSourceId] = useState<string | null>(null);
  const [oembed, setOembed] = useState<OEmbedResult | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<IntentType | null>(null);
  const [partner, setPartner] = useState<PartnerOption | null>(null);
  const [partnerPickerOpen, setPartnerPickerOpen] = useState(false);

  function back() {
    if (step === 1) {
      navigate({ to: "/home" });
      return;
    }
    setStep((s) => (s - 1) as StepNum);
  }

  function handleIntentPicked(intent: IntentType) {
    setSelectedIntent(intent);
    if (intent.requires_partner) {
      setPartnerPickerOpen(true);
    } else {
      setStep(3);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-bg">
      <header className="flex h-14 items-center px-2">
        <button
          type="button"
          onClick={back}
          className="inline-flex h-11 min-w-11 items-center gap-1 rounded-lg px-3 text-sm font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          이전
        </button>
      </header>
      {step === 1 && (
        <Step1
          oembed={oembed}
          contentSourceId={contentSourceId}
          onResolved={(r, id) => {
            setOembed(r);
            setContentSourceId(id);
          }}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          selectedIntentId={selectedIntent?.id ?? null}
          onSelect={handleIntentPicked}
        />
      )}
      {step === 3 && selectedIntent && (
        <Step3
          oembed={oembed}
          contentSourceId={contentSourceId}
          intent={selectedIntent}
          partner={partner}
        />
      )}
      <PartnerPickerModal
        open={partnerPickerOpen}
        onClose={() => setPartnerPickerOpen(false)}
        onSelect={(p) => {
          setPartner(p);
          setPartnerPickerOpen(false);
          setStep(3);
        }}
      />
    </div>
  );
}

/* ---------- Step indicator ---------- */
function StepBadge({ n }: { n: number }) {
  return (
    <p className="text-xs font-semibold tracking-tight text-text-subtle">
      Step {n} / 5
    </p>
  );
}

/* ---------- Step 1: URL ---------- */
function Step1({
  oembed,
  contentSourceId,
  onResolved,
  onNext,
}: {
  oembed: OEmbedResult | null;
  contentSourceId: string | null;
  onResolved: (r: OEmbedResult, id: string | null) => void;
  onNext: () => void;
}) {
  const [url, setUrl] = useState("");
  const [manual, setManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualThumb, setManualThumb] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [igNotice, setIgNotice] = useState(false);

  const parsed = useMemo(() => parseVideoUrl(url), [url]);

  // Auto-fetch when URL is recognized
  useEffect(() => {
    if (!parsed || manual) return;
    if (parsed.provider === "instagram") {
      setIgNotice(true);
      return;
    }
    setIgNotice(false);
    setLoading(true);
    setError(null);
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchOEmbed(parsed);
        if (cancelled) return;
        let id: string | null = null;
        if (isSupabaseConfigured) {
          try {
            const { data, error: dbErr } = await getSupabase()
              .from("content_sources")
              .upsert(
                {
                  provider: result.provider,
                  canonical_url: result.canonicalUrl,
                  source_id: result.sourceId,
                  title: result.title,
                  thumbnail_url: result.thumbnailUrl,
                  embed_html: result.embedHtml,
                  source_mode: "user_submitted",
                  rights_status: "unclaimed",
                },
                { onConflict: "provider,source_id" },
              )
              .select("id")
              .single();
            if (!dbErr && data) id = data.id as string;
          } catch {
            // 테이블이 아직 없거나 권한 문제 — 로컬 진행 허용
          }
        }
        onResolved(result, id);
      } catch {
        if (!cancelled) {
          setError("영상을 찾을 수 없어요. URL을 다시 확인해주세요.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed, manual, onResolved]);

  const canProceed = manual
    ? manualTitle.trim().length > 0
    : Boolean(oembed);

  function handleManualNext() {
    if (!manualTitle.trim()) return;
    onResolved(
      {
        provider: "manual",
        canonicalUrl: url || "",
        sourceId: `manual-${Date.now()}`,
        title: manualTitle.trim(),
        authorName: null,
        thumbnailUrl: manualThumb.trim() || null,
        embedHtml: null,
      },
      contentSourceId,
    );
    onNext();
  }

  return (
    <>
      <main className="flex-1 px-6 pb-32 pt-2">
        <StepBadge n={1} />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tighter text-text-strong">
          영상 링크를 붙여넣어 주세요
        </h1>

        {!manual && (
          <>
            <input
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="youtu.be/..."
              className="mt-6 block h-14 w-full rounded-lg border border-border bg-bg px-4 text-base font-medium text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            />
            <p className="mt-2 text-xs font-medium text-text-muted">
              지원: YouTube · Instagram
            </p>

            {loading && (
              <p className="mt-6 text-sm font-medium text-text-muted">
                영상 정보를 가져오는 중…
              </p>
            )}

            {igNotice && (
              <p className="mt-6 text-sm font-medium text-text-muted">
                Instagram은 곧 지원 예정이에요.
              </p>
            )}

            <ErrorMessage message={error} className="mt-6" />

            {oembed && oembed.provider !== "manual" && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-border">
                {oembed.thumbnailUrl && (
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-surface">
                    <img
                      src={oembed.thumbnailUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <p className="text-base font-bold tracking-tight text-text-strong">
                    {oembed.title}
                  </p>
                  <p className="mt-1 text-sm font-medium text-text-muted">
                    {oembed.authorName ? `${oembed.authorName} · ` : ""}
                    {oembed.provider === "youtube" ? "YouTube" : "Instagram"}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setManual(true);
                setError(null);
              }}
              className="mt-6 inline-flex h-11 items-center text-sm font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              수동 입력
            </button>
          </>
        )}

        {manual && (
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-semibold text-text-strong">
                영상 제목
              </span>
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="mt-2 block h-14 w-full rounded-lg border border-border bg-bg px-4 text-base font-medium text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                placeholder="예: 성수동 카페 투어"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-strong">
                썸네일 URL (선택)
              </span>
              <input
                value={manualThumb}
                onChange={(e) => setManualThumb(e.target.value)}
                className="mt-2 block h-14 w-full rounded-lg border border-border bg-bg px-4 text-base font-medium text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                placeholder="https://..."
              />
            </label>
            <button
              type="button"
              onClick={() => setManual(false)}
              className="inline-flex h-11 items-center text-sm font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              URL로 돌아가기
            </button>
          </div>
        )}
      </main>

      <div className="sticky bottom-0 border-t border-border bg-bg px-6 py-4">
        <ActionButton
          type="button"
          disabled={!canProceed}
          onClick={manual ? handleManualNext : onNext}
          className="w-full"
        >
          다음
        </ActionButton>
      </div>
    </>
  );
}

/* ---------- Step 2: Intent picker ---------- */
function Step2({
  selectedIntentId,
  onSelect,
}: {
  selectedIntentId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: intents } = useQuery({
    queryKey: ["intent_types"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<IntentType[]> => {
      if (!isSupabaseConfigured) return INTENT_FALLBACK;
      try {
        const { data, error } = await getSupabase()
          .from("intent_types")
          .select("id, key, name_ko, requires_partner, is_active")
          .eq("is_active", true)
          .order("key");
        if (error || !data || data.length === 0) return INTENT_FALLBACK;
        return data as IntentType[];
      } catch {
        return INTENT_FALLBACK;
      }
    },
  });

  const list = intents ?? INTENT_FALLBACK;

  return (
    <main className="flex-1 px-6 pb-12 pt-2">
      <StepBadge n={2} />
      <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-tighter text-text-strong">
        이 링크를 어떤 목적으로
        <br />
        보낼까요?
      </h1>

      <div className="mt-8 grid grid-cols-3 gap-3">
        {list.map((intent) => {
          const meta = INTENT_META[intent.key] ?? INTENT_META.custom;
          const Icon = meta.icon;
          const isSelected = selectedIntentId === intent.id;
          return (
            <button
              key={intent.id}
              type="button"
              onClick={() => onSelect(intent.id)}
              style={{ ["--strip-color" as string]: meta.stripVar }}
              className={cn(
                "group relative h-[112px] overflow-hidden rounded-2xl border border-border p-4",
                "flex flex-col items-start justify-between gap-2 text-left",
                "transition-all duration-150 ease-out",
                "hover:border-text-muted active:scale-[0.98]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                isSelected && "border-text-strong",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 w-1 transition-opacity duration-150 ease-out",
                  isSelected
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                )}
                style={{ background: meta.stripVar }}
              />
              <Icon className="size-6 text-text-muted" strokeWidth={2} />
              <span className="text-sm font-bold tracking-tight text-text-strong">
                {intent.name_ko}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-xs font-medium leading-relaxed text-text-muted">
        선택한 목적별로 카드 블록·CTA·전환 기준·보상 룰이 달라집니다.
      </p>
    </main>
  );
}

/* ---------- Step 3 placeholder ---------- */
function StepPlaceholder() {
  return (
    <main className="flex-1 px-6 pt-2">
      <StepBadge n={3} />
      <h1 className="mt-3 text-2xl font-extrabold tracking-tighter text-text-strong">
        Step 3 준비 중
      </h1>
      <p className="mt-2 text-sm font-medium text-text-muted">
        Module 1B에서 블록 에디터를 이어 만듭니다.
      </p>
    </main>
  );
}