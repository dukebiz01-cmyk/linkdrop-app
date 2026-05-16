import { createFileRoute } from "@tanstack/react-router";
import { InfoDropPage } from "@/components/info-drop-page";

export const Route = createFileRoute("/d/$shareUuid")({
  head: () => ({ meta: [{ title: "LinkDrop Drop" }] }),
  loader: async ({ params }) => {
    // TODO Phase 2: replace dummy with real RPC call
    //   const supabase = getSupabase();
    //   if (!supabase) throw new Error("Supabase not configured");
    //   const { data, error } = await supabase.rpc("public_drop_get", {
    //     p_share_uuid: params.shareUuid,
    //   });
    //   if (error || !data) throw new Error("Drop not found");
    //   return data;
    return { shareUuid: params.shareUuid };
  },
  component: DropPage,
});

function DropPage() {
  const { shareUuid } = Route.useLoaderData();

  return (
    <InfoDropPage
      videoThumbnailUrl="https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&h=450&fit=crop"
      videoDurationSec={154}
      videoSourceLabel="YouTube"
      maker={{ name: "Duke", droppedAgo: "2시간 전" }}
      makerMessage="여기 진짜 분위기 좋더라. 너 좋아할 것 같아서 보내"
      title="여기 분위기 진짜 좋더라, 작업하기 딱이야"
      description="창가 자리에서 노을 보면서 커피 마시면 시간 가는 줄 몰라. 디저트도 맛있고 와이파이 빵빵해서 노트북 작업하기 좋아."
      intent="coupon"
      local={{
        name: "노을재 카페",
        category: "카페",
        distance: "0.8km",
        address: "서울 강남구",
        statusLabel: "영업중",
        hoursLabel: "22:00까지",
        rating: 4.8,
        reviewCount: 127,
      }}
      creator={{
        channelName: "카페탐방러",
        channelUrl: "https://youtube.com/@cafehunter",
      }}
      onPrimaryAction={() => console.log("[d/$shareUuid] primary action", shareUuid)}
      onWatchOriginal={() =>
        window.open("https://youtu.be/dQw4w9WgXcQ", "_blank", "noopener,noreferrer")
      }
      onShare={() => console.log("[d/$shareUuid] share", shareUuid)}
      onBack={() => window.history.back()}
      onSave={() => console.log("[d/$shareUuid] save (Phase 2 wiring)")}
      onForward={() => console.log("[d/$shareUuid] forward to friend")}
    />
  );
}
