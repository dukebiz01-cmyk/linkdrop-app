import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { ShareCardTile } from "@/components/home/ShareCardTile";
import { SectionHeader, SegmentToggle, EmptyState } from "@/components/home/v4-bits";
import type { DropFeedItem } from "@/components/home-page";
import { reshareDrop } from "@/lib/reshare-drop";

/**
 * HomeActivitySegment — 유저홈 활동 세그먼트(내 공유 | 구독). V4: SectionHeader + iOS 흰칩 SegmentToggle.
 *
 * STEP 3 — 토글 2탭 유지(기본 = 내 공유). v0 룩 = 가로 스와이프 행(ShareCardTile 재사용).
 *   빈상태 = EmptyState(탭별 문구). 카드 열기 = useNavigate 내장. 재공유 = reshareDrop(데이터·핸들러 0변경).
 */

// STEP 3 v0 포트 — 가로 스와이프 행(카드가 세로로 길어지지 않게 옆으로 흐름).
//   hide-scrollbar 유틸이 styles.css에 없어 인라인 arbitrary variant로 스크롤바 숨김(styles.css 무접촉).
function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="-mx-4 flex touch-pan-x snap-x snap-proximity gap-3 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
}: {
  sentDrops: DropFeedItem[];
  followedDrops: DropFeedItem[];
  /** v0 3토글 — "내가만든"(get_my_drops published → 어댑터). 내 카드엔 파생필드(드로피/타이머 등) 없음 = 정상 미렌더. */
  myCreatedDrops: DropFeedItem[];
  /** 1-C-2(L6) — 홈 loader 1회 공급 서버 기준시각(타일 타이머 offset 보정). */
  serverNow?: string;
}) {
  const [tab, setTab] = useState<ActivityTab>("sent");
  const navigate = useNavigate();

  const openDrop = (shareUuid: string) =>
    void navigate({ to: "/d/$shareUuid", params: { shareUuid } });

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
      <div className="mb-4">
        <SegmentToggle options={TABS} value={tab} onChange={setTab} />
      </div>

      {drops.length > 0 ? (
        // 가로 스와이프 행(v0). ShareCardTile 재사용. 공유=재공유, 클릭=/d 이동.
        <HScrollRow>
          {drops.map((drop) => (
            <SwipeItem key={drop.shareUuid}>
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
                onClick={() => openDrop(drop.shareUuid)}
                onShare={() =>
                  void reshareDrop({
                    shareUuid: drop.shareUuid,
                    title: drop.title,
                    imageUrl: drop.videoThumbnailUrl,
                    purpose: drop.intent,
                  })
                }
              />
            </SwipeItem>
          ))}
        </HScrollRow>
      ) : (
        <EmptyState title={EMPTY[tab].title} subtitle={EMPTY[tab].subtitle} />
      )}
    </section>
  );
}
