import { createFileRoute } from "@tanstack/react-router";
import { InfoDropPage } from "@/components/info-drop-page";

export const Route = createFileRoute("/d/test")({
  head: () => ({ meta: [{ title: "LinkDrop Drop · 미리보기" }] }),
  component: DropTestPage,
});

function DropTestPage() {
  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=450&fit=crop"
      videoDurationSec={154}
      videoSourceLabel="YouTube"
      maker={{ name: "Duke", droppedAgo: "2시간 전" }}
      makerMessage="여기 진짜 분위기 좋더라. 너 좋아할 것 같아서 보내"
      title="서울숲 근처 숨은 브런치 카페 발견"
      description="서울숲역 3번 출구에서 도보 5분, 창가 자리에서 숲 뷰가 보이는 조용한 카페입니다. 시그니처 라떼가 맛있어요."
      intent="coupon"
      local={{
        name: "포레스트 커피",
        category: "카페 · 브런치",
        thumbnailUrl:
          "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=200&h=200&fit=crop",
        distance: "0.8km",
        address: "서울 성동구",
        statusLabel: "영업중",
        hoursLabel: "22:00까지",
        rating: 4.8,
        reviewCount: 127,
        responseNote: "카톡 응답 빠름",
        priceRange: "평균 8,000원",
      }}
      creator={{
        channelName: "카페투어 브이로그",
        channelUrl: "https://youtube.com/@cafetour",
      }}
      onPrimaryAction={() => console.log("[d/test] primary action: coupon")}
      onWatchOriginal={() =>
        window.open("https://youtu.be/dQw4w9WgXcQ", "_blank", "noopener,noreferrer")
      }
      onShare={() => console.log("[d/test] share")}
      onBack={() => window.history.back()}
      onSave={() => console.log("[d/test] save (Phase 2 wiring)")}
      onForward={() => console.log("[d/test] forward to friend")}
    />
  );
}
