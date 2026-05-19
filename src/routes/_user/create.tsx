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
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ActionButton } from "@/components/ActionButton";
import { ErrorMessage } from "@/components/ErrorMessage";
import { AdDisclosure } from "@/components/AdDisclosure";
import { SourceAttribution } from "@/components/SourceAttribution";
import { SortableBlock } from "@/components/create/BlockEditor";
import { PartnerPickerModal, type PartnerOption } from "@/components/create/PartnerPickerModal";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { shareToKakao } from "@/lib/kakao";
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
  name: string;
  requires_partner: boolean;
  is_active: boolean;
  default_required_blocks?: BlockKind[] | null;
  allowed_blocks?: BlockKind[] | null;
  requires_disclosure?: boolean | null;
}

const INTENT_FALLBACK: IntentType[] = [
  { id: "info", key: "info", name: "정보 공유", requires_partner: false, is_active: true },
  {
    id: "discussion",
    key: "discussion",
    name: "친구와 의논",
    requires_partner: false,
    is_active: true,
  },
  { id: "coupon", key: "coupon", name: "쿠폰", requires_partner: true, is_active: true },
  {
    id: "reservation",
    key: "reservation",
    name: "예약 유도",
    requires_partner: true,
    is_active: true,
  },
  {
    id: "commerce",
    key: "commerce",
    name: "구매 유도",
    requires_partner: true,
    is_active: true,
  },
  { id: "ticket", key: "ticket", name: "티켓 판매", requires_partner: true, is_active: true },
  { id: "lead", key: "lead", name: "상담 신청", requires_partner: true, is_active: true },
  {
    id: "campaign",
    key: "campaign",
    name: "공식 안내",
    requires_partner: false,
    is_active: true,
  },
  { id: "custom", key: "custom", name: "직접 설정", requires_partner: false, is_active: true },
];

const INTENT_META: Record<string, { icon: LucideIcon; stripVar: string }> = {
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
        <Step2 selectedIntentId={selectedIntent?.id ?? null} onSelect={handleIntentPicked} />
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
  return <p className="text-xs font-semibold tracking-tight text-text-subtle">Step {n} / 5</p>;
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

  const canProceed = manual ? manualTitle.trim().length > 0 : Boolean(oembed);

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
            <p className="mt-2 text-xs font-medium text-text-muted">지원: YouTube · Instagram</p>

            {loading && (
              <p className="mt-6 text-sm font-medium text-text-muted">영상 정보를 가져오는 중…</p>
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
                    <img src={oembed.thumbnailUrl} alt="" className="h-full w-full object-cover" />
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
              <span className="text-sm font-semibold text-text-strong">영상 제목</span>
              <input
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="mt-2 block h-14 w-full rounded-lg border border-border bg-bg px-4 text-base font-medium text-text-strong placeholder:text-text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                placeholder="예: 성수동 카페 투어"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-text-strong">썸네일 URL (선택)</span>
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
  onSelect: (intent: IntentType) => void;
}) {
  const { data: intents } = useQuery({
    queryKey: ["intent_types"],
    staleTime: 60 * 60 * 1000,
    queryFn: async (): Promise<IntentType[]> => {
      if (!isSupabaseConfigured) return INTENT_FALLBACK;
      try {
        const { data, error } = await getSupabase()
          .from("intent_types")
          .select(
            "id, key, name, requires_partner, is_active, default_required_blocks, allowed_blocks, requires_disclosure",
          )
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
              onClick={() => onSelect(intent)}
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
                {intent.name}
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

/* ---------- Step 3: Block editor ---------- */
function Step3({
  oembed,
  contentSourceId,
  intent,
  partner,
}: {
  oembed: OEmbedResult | null;
  contentSourceId: string | null;
  intent: IntentType;
  partner: PartnerOption | null;
}) {
  const requiresDisclosure = intent.requires_disclosure ?? REQUIRES_DISCLOSURE[intent.key] ?? false;
  const required: BlockKind[] = intent.default_required_blocks ??
    FALLBACK_REQUIRED_BY_INTENT[intent.key] ?? ["video", "text"];
  const allowed: BlockKind[] =
    intent.allowed_blocks ?? FALLBACK_ALLOWED_BY_INTENT[intent.key] ?? BLOCK_KINDS.slice();

  const navigate = useNavigate();
  const [blocks, setBlocks] = useState<BlockDraft[]>(() =>
    required.map((kind) => ({
      id: newId(),
      kind,
      isLocked: true,
      data: emptyData(kind),
    })),
  );
  const [infoDropId, setInfoDropId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedShareUuid, setPublishedShareUuid] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  // info_drops INSERT (best-effort) on mount
  useEffect(() => {
    if (infoDropId || !isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = getSupabase();
        const { data: sess } = await sb.auth.getSession();
        const uid = sess.session?.user.id;
        if (!uid) return;
        const { data, error } = await sb
          .from("info_drops")
          .insert({
            owner_user_id: uid,
            intent_id: intent.id,
            source_id: contentSourceId,
            status: "draft",
          })
          .select("id")
          .single();
        if (cancelled) return;
        if (error) {
          console.error("[create] info_drops insert failed:", error);
          setSchemaError("초안 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
          return;
        }
        if (data) setInfoDropId(data.id as string);
      } catch (err) {
        if (cancelled) return;
        console.error("[create] info_drops insert threw:", err);
        setSchemaError("초안 저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contentSourceId, intent.id, partner?.id, requiresDisclosure, infoDropId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setBlocks((prev) => {
      const oldIndex = prev.findIndex((b) => b.id === active.id);
      const newIndex = prev.findIndex((b) => b.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      // 잠긴 블록 자리 이동 금지
      if (prev[oldIndex].isLocked) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function addBlock(kind: BlockKind) {
    setBlocks((prev) => [...prev, { id: newId(), kind, isLocked: false, data: emptyData(kind) }]);
    setPickerOpen(false);
  }

  function updateBlock(id: string, data: Record<string, unknown>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, data } : b)));
  }

  function deleteBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id || b.isLocked));
  }

  async function handlePublish() {
    setSaveError(null);
    if (!isSupabaseConfigured) {
      setSaveError("저장은 백엔드 연결 후에 작동해요. (로컬 미리보기)");
      return;
    }
    if (!infoDropId) {
      setSaveError(schemaError ?? "저장은 백엔드 연결 후에 작동해요. (로컬 미리보기)");
      return;
    }
    setPublishing(true);
    try {
      const sb = getSupabase();
      const rows = blocks.map((b, i) => ({
        info_drop_id: infoDropId,
        block_kind: b.kind,
        position: i,
        is_locked: b.isLocked,
        block_data: b.data,
      }));
      const { error: blockErr } = await sb.from("component_blocks").insert(rows);
      if (blockErr) throw blockErr;

      const { error: updErr } = await sb
        .from("info_drops")
        .update({ status: "published" })
        .eq("id", infoDropId);
      if (updErr) throw updErr;

      const { data: sess } = await sb.auth.getSession();
      const uid = sess.session?.user.id;
      if (!uid) throw new Error("not signed in");

      const { data: shareRow, error: shareErr } = await sb
        .from("share_events")
        .insert({ info_drop_id: infoDropId, sender_user_id: uid })
        .select("share_uuid")
        .single();
      if (shareErr || !shareRow) throw shareErr ?? new Error("share insert failed");

      setPublishedShareUuid(shareRow.share_uuid as string);
    } catch {
      setSaveError("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPublishing(false);
    }
  }

  const shareUrl = publishedShareUuid ? `https://app.drop.how/d/${publishedShareUuid}` : null;

  async function handleKakaoShare() {
    if (!shareUrl) return;
    setShareError(null);
    setShareFeedback(null);
    const result = await shareToKakao({
      title: oembed?.title ?? "LinkDrop",
      description: partner ? `${intent.name} · ${partner.name}` : intent.name,
      imageUrl: oembed?.thumbnailUrl ?? "",
      linkUrl: shareUrl,
      buttons: [{ title: "보러 가기", link: shareUrl }],
    });
    if (result.fallback === "clipboard") {
      setShareFeedback("카카오 SDK 호출에 실패해서 링크를 복사했어요.");
    } else if (!result.ok) {
      setShareError("카카오 공유에 실패했어요. 링크를 직접 복사해 주세요.");
    }
  }

  async function handleCopyLink() {
    if (!shareUrl) return;
    setShareError(null);
    setShareFeedback(null);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("링크를 복사했어요.");
    } catch {
      setShareError("링크 복사에 실패했어요.");
    }
  }

  const addable = allowed.filter((k) => k !== "video" && k !== "text" && k !== "similar");

  if (publishedShareUuid && shareUrl) {
    return (
      <main className="flex-1 px-6 pb-12 pt-2">
        <StepBadge n={4} />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tighter text-text-strong">
          드롭이 만들어졌어요! 🎉
        </h1>
        <p className="mt-3 text-sm font-medium text-text-muted">친구에게 공유해 보세요.</p>

        <div className="mt-8 space-y-3">
          <ActionButton type="button" onClick={handleKakaoShare} className="w-full">
            카카오톡으로 보내기
          </ActionButton>
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex h-12 w-full items-center justify-center rounded-lg border border-border bg-bg text-sm font-semibold text-text-strong transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            링크 복사하기
          </button>
        </div>

        {shareFeedback && (
          <p className="mt-4 text-sm font-medium text-text-strong">{shareFeedback}</p>
        )}
        <ErrorMessage message={shareError} className="mt-4" />

        <button
          type="button"
          onClick={() => navigate({ to: "/home" })}
          className="mt-10 inline-flex h-11 w-full items-center justify-center text-sm font-medium text-text-muted transition-colors hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          홈으로 가기
        </button>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 px-6 pb-32 pt-2">
        <StepBadge n={3} />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tighter text-text-strong">
          카드를 다듬어 주세요
        </h1>
        <p className="mt-2 text-sm font-medium text-text-muted">
          {intent.name}
          {partner ? ` · ${partner.name}` : ""}
        </p>

        {requiresDisclosure && <AdDisclosure className="mt-6" />}

        <div className="mt-6 overflow-hidden rounded-2xl border border-border">
          {oembed && (
            <SourceAttribution
              provider={oembed.provider}
              authorName={oembed.authorName}
              sourceMode={partner ? "partner_official" : "user_submitted"}
              position="top"
              className="border-b border-border"
            />
          )}

          <div className="space-y-3 p-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={blocks.map((b) => b.id)}
                strategy={verticalListSortingStrategy}
              >
                {blocks.map((b) => (
                  <SortableBlock
                    key={b.id}
                    block={b}
                    oembed={oembed}
                    onChange={(d) => updateBlock(b.id, d)}
                    onDelete={() => deleteBlock(b.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-semibold text-text-muted transition-colors hover:border-text-muted hover:text-text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <Plus className="size-4" strokeWidth={2} />
              블록 추가
            </button>

            {pickerOpen && (
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3">
                {addable.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => addBlock(kind)}
                    className="inline-flex h-11 items-center justify-start rounded-lg border border-border px-3 text-sm font-semibold text-text-strong transition-colors hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {KIND_LABEL[kind]}
                  </button>
                ))}
                {addable.length === 0 && (
                  <p className="col-span-2 text-xs font-medium text-text-muted">
                    추가 가능한 블록이 없어요
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <ErrorMessage message={saveError} className="mt-6" />
      </main>

      <div className="sticky bottom-0 border-t border-border bg-bg px-6 py-4">
        <ActionButton
          type="button"
          onClick={handlePublish}
          disabled={publishing}
          className="w-full"
        >
          {publishing ? "저장 중..." : "공유 링크 만들기"}
        </ActionButton>
      </div>
    </>
  );
}
