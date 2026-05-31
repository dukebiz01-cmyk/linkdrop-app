import { ExternalLink, ArrowRight, Youtube, Instagram } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CreatorAttributionProps {
  creator: {
    channelName: string;
    channelUrl: string;
    platform?: "youtube" | "instagram";
    avatarUrl?: string;
  };
  variant: "mini" | "card" | "full";
}

// ─────────────────────────────────────────────────────────────
// CreatorAttribution Component
// ─────────────────────────────────────────────────────────────

export function CreatorAttribution({ creator, variant }: CreatorAttributionProps) {
  const { channelName, channelUrl, platform = "youtube" } = creator;

  // ───────────────────────────────────────────────────────────
  // Variant: mini (inline 1 line)
  // ───────────────────────────────────────────────────────────
  if (variant === "mini") {
    return (
      <a
        href={channelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-[#A3A3A3] transition-colors hover:text-[#525252]"
        onClick={(e) => e.stopPropagation()}
      >
        <span>원본: {channelName}</span>
        <ExternalLink className="h-3 w-3" />
      </a>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Variant: card (standalone block)
  // ───────────────────────────────────────────────────────────
  if (variant === "card") {
    return (
      <div className="border-l-2 border-[#E5E5E5] py-1 pl-3">
        <div className="text-xs font-medium uppercase tracking-wide text-[#A3A3A3]">원본 영상</div>
        <div className="mt-0.5 text-sm font-medium text-[#0A0A0A]">{channelName}</div>
        <a
          href={channelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#0A0A0A] hover:text-[#171717]"
        >
          {platform === "youtube" ? "YouTube" : "Instagram"}에서 보기
          <ArrowRight className="h-3 w-3" />
        </a>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Variant: full (in InfoDropPage)
  // ───────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] p-4">
      <div className="flex items-start gap-3">
        {platform === "youtube" ? (
          <Youtube className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#525252]" />
        ) : (
          <Instagram className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#525252]" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-[#A3A3A3]">
            원본 영상
          </div>
          <div className="mt-1 truncate text-base font-medium text-[#0A0A0A]">{channelName}</div>
          <div className="mt-2 text-sm leading-relaxed text-[#525252]">
            이 카드는 위 채널의 영상에서 시작됐어요
          </div>
        </div>
      </div>
      <a
        href={channelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#E5E5E5] bg-white text-sm font-medium text-[#0A0A0A] transition-all duration-150 hover:border-[#D4D4D4] hover:bg-[#FAFAFA]"
      >
        {platform === "youtube" ? (
          <Youtube className="h-4 w-4 text-[#525252]" />
        ) : (
          <Instagram className="h-4 w-4 text-[#525252]" />
        )}
        {platform === "youtube" ? "YouTube" : "Instagram"}에서 원본 보기
        <ExternalLink className="h-3.5 w-3.5 text-[#A3A3A3]" />
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Demo Variants
// ─────────────────────────────────────────────────────────────

export function CreatorAttributionMiniDemo() {
  return (
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <p className="text-xs text-[#A3A3A3]">Short name:</p>
        <CreatorAttribution
          variant="mini"
          creator={{
            channelName: "카페탐방러",
            channelUrl: "https://youtube.com/@cafetour",
            platform: "youtube",
          }}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-[#A3A3A3]">Medium name:</p>
        <CreatorAttribution
          variant="mini"
          creator={{
            channelName: "먹방 브이로그 채널",
            channelUrl: "https://youtube.com/@mukbang",
            platform: "youtube",
          }}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-[#A3A3A3]">Instagram:</p>
        <CreatorAttribution
          variant="mini"
          creator={{
            channelName: "서울카페투어",
            channelUrl: "https://instagram.com/seoulcafe",
            platform: "instagram",
          }}
        />
      </div>
    </div>
  );
}

export function CreatorAttributionCardDemo() {
  return (
    <div className="space-y-4 p-4">
      <CreatorAttribution
        variant="card"
        creator={{
          channelName: "카페탐방러",
          channelUrl: "https://youtube.com/@cafetour",
          platform: "youtube",
        }}
      />
      <CreatorAttribution
        variant="card"
        creator={{
          channelName: "서울카페투어",
          channelUrl: "https://instagram.com/seoulcafe",
          platform: "instagram",
        }}
      />
    </div>
  );
}

export function CreatorAttributionFullDemo() {
  return (
    <div className="space-y-4 p-4">
      <CreatorAttribution
        variant="full"
        creator={{
          channelName: "카페탐방러",
          channelUrl: "https://youtube.com/@cafetour",
          platform: "youtube",
        }}
      />
      <CreatorAttribution
        variant="full"
        creator={{
          channelName: "서울카페투어",
          channelUrl: "https://instagram.com/seoulcafe",
          platform: "instagram",
        }}
      />
    </div>
  );
}
