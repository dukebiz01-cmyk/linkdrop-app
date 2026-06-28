import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ShareCardTile } from "@/components/home/ShareCardTile";
import type { DropFeedItem } from "@/components/home-page";
import { reshareDrop } from "@/lib/reshare-drop";

/**
 * HomeActivitySegment — 유저홈 활동 세그먼트(내 공유 | 구독).
 *
 * 토글 2탭(기본 활성 = 내 공유). 평면 리스트(영상/카드 구분 없음).
 * 색은 신규 0 — RoleHome 형제 섹션 색 문자열 그대로 재사용
 *   (#0A0A0A, #737373, #E5E5E5, bg-white). 이모지 0, Lucide만, 60대 친화(탭영역 44px).
 *
 * 카드 열기 = useNavigate 내장(기존 onOpenDrop 동작 보존). 재공유는 내 공유 탭만(reshareDrop).
 */
export function HomeActivitySegment({
  sentDrops,
  followedDrops,
}: {
  sentDrops: DropFeedItem[];
  followedDrops: DropFeedItem[];
}) {
  const [tab, setTab] = useState<"sent" | "subscribed">("sent");
  const navigate = useNavigate();

  const openDrop = (shareUuid: string) =>
    void navigate({ to: "/d/$shareUuid", params: { shareUuid } });

  const drops = tab === "sent" ? sentDrops : followedDrops;
  const emptyText =
    tab === "sent"
      ? "아직 공유한 카드가 없어요. 마음에 드는 카드를 친구에게 공유해보세요."
      : "구독한 메이커가 없어요. 탐색에서 마음에 드는 메이커를 찾아보세요.";

  const TABS = [
    { id: "sent", label: "내 공유" },
    { id: "subscribed", label: "구독" },
  ] as const;

  return (
    <section>
      {/* 세그먼트 토글 — 탐색 탭과 동일 언어: 각진 사각, 활성 = 블루 bg + 흰 텍스트, 비활성 = 연회색 bg + 그레이. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[44px] rounded-lg px-4 text-sm font-bold tracking-ko transition-colors ${
                active ? "bg-[#2563EB] text-white" : "bg-[#F5F5F5] text-[#525252] hover:bg-[#E5E5E5]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {drops.length > 0 ? (
        // 2열 그리드 — 탐색과 동일 언어. ShareCardTile(아크릴) 재사용. 공유=재공유, 클릭=/d 이동.
        <div className="grid grid-cols-2 gap-2">
          {drops.map((drop) => (
            <ShareCardTile
              key={drop.shareUuid}
              drop={drop}
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
        <p className="rounded-2xl border border-[#E5E5E5] bg-white p-5 text-sm font-medium leading-relaxed tracking-ko text-[#737373]">
          {emptyText}
        </p>
      )}
    </section>
  );
}
