import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Layers, BarChart3, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { ShareCardTile } from "@/components/home/ShareCardTile";
import { SectionHeader, EmptyState } from "@/components/home/v4-bits";
import type { DropFeedItem } from "@/components/home-page";
import { reshareDrop } from "@/lib/reshare-drop";
import { parseVideoUrl } from "@/lib/video-metadata";
import { extractYouTubeVideoIdFromThumb } from "@/lib/video-id";
import { YouTubeEmbedModal } from "@/components/receiver/YouTubeEmbedModal";

/**
 * HomeActivitySegment — 유저홈 활동 세그먼트(내 공유 | 구독). V4: SectionHeader + iOS 흰칩 SegmentToggle.
 *
 * STEP 3 — 토글 2탭 유지(기본 = 내 공유). v0 룩 = 가로 스와이프 행(ShareCardTile 재사용).
 *   빈상태 = EmptyState(탭별 문구). 카드 열기 = useNavigate 내장. 재공유 = reshareDrop(데이터·핸들러 0변경).
 */

// STEP 3 v0 포트 — 가로 스와이프 행(카드가 세로로 길어지지 않게 옆으로 흐름).
//   hide-scrollbar 유틸이 styles.css에 없어 인라인 arbitrary variant로 스크롤바 숨김(styles.css 무접촉).
//   좌우 여백 정렬 — 풀블리드(-mx-4/보정 px-4) 제거 → 컨테이너 px-4 inset 상속(카드가 상단/중단
//   콘텐츠와 같은 좌우 여백 안에 담김). 가로 스크롤은 overflow-x-auto 로 유지.
function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      // 세로 스크롤 통과 — touch-pan-x 제거(touch-action 미지정=기본 auto). 세로 제스처는 페이지
      //   스크롤로 넘어가고, 가로는 overflow-x-auto 가 그대로 처리. overscroll-x-contain(가로 끝 페이지 튐 방지)만 유지.
      className="flex snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

function SwipeItem({ children }: { children: React.ReactNode }) {
  return <div className="w-[46%] shrink-0 snap-start sm:w-[42%]">{children}</div>;
}
type ActivityTab = "sent" | "subscribed" | "made";

export function HomeActivitySegment({
  sentDrops,
  followedDrops,
  myCreatedDrops,
  serverNow,
  isBusiness,
  initialTab,
}: {
  sentDrops: DropFeedItem[];
  followedDrops: DropFeedItem[];
  /** v0 3토글 — "내가만든"(get_my_drops 전체 status → 어댑터, B' 전환). 내 카드엔 파생필드(드로피/타이머 등) 없음 = 정상 미렌더. */
  myCreatedDrops: DropFeedItem[];
  /** 1-C-2(L6) — 홈 loader 1회 공급 서버 기준시각(타일 타이머 offset 보정). */
  serverNow?: string;
  /** 내가만든 3기능 — "성과보기" 노출 게이트(me.tsx isBusiness 게이트 동일). 미주입 = 미노출. */
  isBusiness?: boolean;
  /** B' 전환 — ?activity 딥링크 초기 탭(me NavCard 진입). 미지정 = "sent". */
  initialTab?: ActivityTab;
}) {
  const [tab, setTab] = useState<ActivityTab>(initialTab ?? "sent");
  // 딥링크 재진입(다른 화면에서 ?activity 변경) 동기화 — v0 정본 패턴.
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);
  const navigate = useNavigate();

  // 내가만든 3기능 — 인앱 임베드 재생(단일 모달 인스턴스, me.tsx embedState 이식).
  const [embedState, setEmbedState] = useState<{
    open: boolean;
    videoId: string;
    originalUrl: string;
    title: string;
  } | null>(null);

  const openDrop = (shareUuid: string) =>
    void navigate({ to: "/d/$shareUuid", params: { shareUuid } });

  // 내가만든 3기능 — me.tsx openEmbedFromDrop 로직 동일 이식(소스: DropFeedItem 필드).
  //   videoSourceUrl(parseVideoUrl) 우선 → 썸네일 정규식 폴백 → 둘 다 실패 = toast 후 미표시(빈 모달 금지).
  function openEmbedFromDrop(drop: DropFeedItem) {
    const url = drop.videoSourceUrl ?? "";
    const fromUrl = url ? parseVideoUrl(url) : null;
    const videoId = fromUrl?.videoId ?? extractYouTubeVideoIdFromThumb(drop.videoThumbnailUrl);
    if (!videoId) {
      toast.info("이 영상은 인앱 재생을 지원하지 않아요.");
      return;
    }
    setEmbedState({
      open: true,
      videoId,
      originalUrl: url || `https://www.youtube.com/watch?v=${videoId}`,
      title: drop.title.trim() || "영상 재생",
    });
  }

  // v0(home-v5) 3토글 — 공유한 | 구독한 | 내가만든. 세 탭 모두 동일 HScrollRow + ShareCardTile(일관).
  const drops = tab === "sent" ? sentDrops : tab === "subscribed" ? followedDrops : myCreatedDrops;
  const EMPTY: Record<ActivityTab, { title: string; subtitle: string }> = {
    sent: { title: "아직 공유한 카드가 없어요", subtitle: "마음에 드는 카드를 친구에게 공유해보세요." },
    subscribed: { title: "구독한 메이커가 없어요", subtitle: "탐색에서 마음에 드는 메이커를 찾아보세요." },
    made: { title: "아직 만든 카드가 없어요", subtitle: "첫 카드를 만들어 손님을 불러보세요." },
  };

  const TABS = [
    { key: "sent", label: "공유한" },
    { key: "subscribed", label: "구독한" },
    { key: "made", label: "내가만든" },
  ] as const;

  return (
    <section>
      {/* 헤더(v0) — 섹션헤더 위, 3토글 아래 풀폭(3탭 대응). */}
      <SectionHeader icon={Layers} title="내 활동" />
      {/* 3토글 — active=블랙(#0F172A)+흰텍스트, inactive=회색(기존). v4-bits SegmentToggle 인라인화(active 색만 변경). */}
      <div className="mb-4">
        <div className="inline-flex rounded-xl border border-[#EAEEF3] bg-[#F1F5F9] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`min-h-[34px] rounded-lg px-3.5 text-[12.5px] font-semibold transition-all ${
                tab === t.key
                  ? "bg-[#0F172A] text-white shadow-[0_1px_3px_rgba(15,23,42,0.1)]"
                  : "text-[#64748B] hover:text-[#475569]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {drops.length > 0 ? (
        // 가로 스와이프 행(v0). ShareCardTile 재사용. 공유=재공유, 클릭=/d 이동.
        <HScrollRow>
          {drops.map((drop) => (
            // key — draft(shareUuid="") 충돌 방지: dropId 우선(B' 전환, made 탭에만 존재).
            <SwipeItem key={`${tab}:${drop.dropId ?? drop.shareUuid}`}>
              <ShareCardTile
                drop={drop}
                // Phase 0 — 홈 뱃지 주입(탐색과 동일 소스 drop.intent). 3종 락.
                purpose={drop.intent}
                isMine={drop.isMine}
                // 1-C-2 — 마감 타이머(피드 expiresAt + loader serverNow). 내가만든엔 없음(undefined) = 미렌더.
                expiresAt={drop.expiresAt}
                serverNow={serverNow}
                // 1-C-3 — 파생 재고(배치값, L4). 내가만든엔 없음 = 미렌더.
                remainingStock={drop.remainingStock}
                // SM-3 — 확산 규모. 내가만든엔 없음 = 미렌더.
                shareCount={drop.shareCount}
                // BADGE-ⓑ — Droppy 예상 보상. 내가만든엔 없음 = 미렌더.
                dropyReward={drop.dropyReward}
                // 열람 — draft(shareUuid 없음)는 /d 불가 → me 미러(열람=인앱 재생).
                onClick={() =>
                  drop.shareUuid ? openDrop(drop.shareUuid) : openEmbedFromDrop(drop)
                }
                // 공유 — draft 는 me 에선 버튼 숨김. 공용 타일은 버튼 상시라 정직 안내로 게이트.
                onShare={() =>
                  drop.shareUuid
                    ? void reshareDrop({
                        shareUuid: drop.shareUuid,
                        title: drop.title,
                        imageUrl: drop.videoThumbnailUrl,
                        purpose: drop.intent,
                      })
                    : toast.info("아직 게시 전 카드예요. 게시하면 공유할 수 있어요.")
                }
              />
              {/* 내가만든 3기능 — made 탭에만 액션 행(성과보기/수정/재생). 열람(카드 탭→/d)·공유는 기존 그대로.
                  성과 = isBusiness && shareUuid(me.tsx:1070 게이트 동일) / 수정 = shareUuid / 재생 = 항상(실패 시 toast).
                  인라인 상시 버튼(Radix dropdown 금지) · Lucide 라인 아이콘 · 홈 톤(#0F172A 필드 / 아웃라인 #E8EDF3). */}
              {tab === "made" && drop.status && drop.status !== "published" ? (
                // B' 전환 — 상태 배지(무채색): archived=비공개(판매관리 토글 시맨틱), 그 외=임시저장.
                <div className="mt-2">
                  <span className="inline-flex items-center rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#64748B]">
                    {drop.status === "archived" ? "비공개" : "임시저장"}
                  </span>
                </div>
              ) : null}
              {tab === "made" ? (
                <div className="mt-2 flex items-center gap-1.5">
                  {isBusiness && drop.shareUuid ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/results/$shareUuid",
                          params: { shareUuid: drop.shareUuid },
                        })
                      }
                      className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[#0F172A] text-[11px] font-bold text-white transition-colors hover:bg-[#1E293B] active:scale-[0.98]"
                    >
                      <BarChart3 className="size-3.5" strokeWidth={2.25} />
                      성과
                    </button>
                  ) : null}
                  {drop.shareUuid ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate({
                          to: "/card-edit/$shareUuid",
                          params: { shareUuid: drop.shareUuid },
                        })
                      }
                      className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-[#E8EDF3] bg-white text-[11px] font-semibold text-[#475569] transition-colors hover:bg-[#F8FAFC] active:scale-95"
                    >
                      <Pencil className="size-3" strokeWidth={2.25} />
                      수정
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openEmbedFromDrop(drop)}
                    className="flex h-8 flex-1 items-center justify-center gap-1 rounded-lg border border-[#E8EDF3] bg-white text-[11px] font-semibold text-[#475569] transition-colors hover:bg-[#F8FAFC] active:scale-95"
                  >
                    <Play className="size-3" strokeWidth={2.25} />
                    재생
                  </button>
                </div>
              ) : null}
            </SwipeItem>
          ))}
        </HScrollRow>
      ) : (
        <EmptyState title={EMPTY[tab].title} subtitle={EMPTY[tab].subtitle} />
      )}
      {/* 내가만든 3기능 — 인앱 임베드 모달(단일 인스턴스, me.tsx:1162 props 5개 동일). */}
      {embedState ? (
        <YouTubeEmbedModal
          open={embedState.open}
          onOpenChange={(open) => {
            if (!open) setEmbedState(null);
          }}
          videoId={embedState.videoId}
          originalUrl={embedState.originalUrl}
          title={embedState.title}
        />
      ) : null}
      {/* 재생 불가 toast 표시용 — 홈 라우트에 Toaster 부재라 여기 마운트(me.tsx 라우트 패턴 준용). */}
      <Toaster richColors position="top-center" />
    </section>
  );
}
