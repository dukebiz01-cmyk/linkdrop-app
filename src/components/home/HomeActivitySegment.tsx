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
 * 토글 2탭(기본 활성 = 내 공유). 2열 그리드(ShareCardTile 재사용). 빈상태 = EmptyState(탭별 문구).
 * 카드 열기 = useNavigate 내장(기존 onOpenDrop 동작 보존). 재공유 = reshareDrop(데이터·핸들러 0변경).
 */
export function HomeActivitySegment({
  sentDrops,
  followedDrops,
  serverNow,
}: {
  sentDrops: DropFeedItem[];
  followedDrops: DropFeedItem[];
  /** 1-C-2(L6) — 홈 loader 1회 공급 서버 기준시각(타일 타이머 offset 보정). */
  serverNow?: string;
}) {
  const [tab, setTab] = useState<"sent" | "subscribed">("sent");
  const navigate = useNavigate();

  const openDrop = (shareUuid: string) =>
    void navigate({ to: "/d/$shareUuid", params: { shareUuid } });

  const drops = tab === "sent" ? sentDrops : followedDrops;
  const empty =
    tab === "sent"
      ? { title: "아직 공유한 카드가 없어요", subtitle: "마음에 드는 카드를 친구에게 공유해보세요." }
      : { title: "구독한 메이커가 없어요", subtitle: "탐색에서 마음에 드는 메이커를 찾아보세요." };

  const TABS = [
    { key: "sent", label: "내 공유" },
    { key: "subscribed", label: "구독" },
  ] as const;

  return (
    <section>
      {/* 헤더 — 섹션헤더 + 우측 흰칩 토글(내 공유 | 구독). */}
      <div className="flex items-center justify-between">
        <SectionHeader icon={Layers} title="내 활동" />
        <SegmentToggle options={TABS} value={tab} onChange={setTab} />
      </div>

      {drops.length > 0 ? (
        // 2열 그리드 — ShareCardTile 재사용. 공유=재공유, 클릭=/d 이동.
        <div className="grid grid-cols-2 gap-3">
          {drops.map((drop) => (
            <ShareCardTile
              key={drop.shareUuid}
              drop={drop}
              // Phase 0 — 홈 뱃지 주입(탐색과 동일 소스 drop.intent). 3종 락.
              purpose={drop.intent}
              // 1-C-2 — 마감 타이머(피드 expiresAt + loader serverNow).
              expiresAt={drop.expiresAt}
              serverNow={serverNow}
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
          ))}
        </div>
      ) : (
        <EmptyState title={empty.title} subtitle={empty.subtitle} />
      )}
    </section>
  );
}
