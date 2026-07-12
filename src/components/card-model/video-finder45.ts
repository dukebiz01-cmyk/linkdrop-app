// video-finder45 — FIX-44 영상 서치 도우미 v1 순수 모듈(B안: 클라 검색+선택, 링고는 발화만).
//   YouTube 한정 락(Instagram·타 플랫폼 검색 시도 금지). 순수 함수만 — 서버 호출·상태 0.
//   후보는 기존 videoResults/videoCandidate/[이 영상으로 확정] 장착 체인을 그대로 탄다
//   (신규 장착 경로 금지 — 이 모듈은 입력 번역만).
import type { DiscoverCandidate } from "@/components/explore/DiscoverSection";

// 41창 확정 문구 원문 — 자구 수정 금지.
export const FINDER_EMPTY_MSG =
  "말씀하신 걸로는 영상을 못 찾았어요. 영상 주소를 직접 붙여넣어 주시면 그걸로 만들게요.";
export const FINDER_FAIL_MSG = "영상 검색이 지금 안 돼요. 주소를 직접 붙여넣어 주세요";

/** YouTube URL → videoId 파싱(watch?v= / youtu.be / shorts / embed / live).
 *  URL 아니거나 YouTube 아니면 null — 타 플랫폼 처리 시도 없음(한정 락). */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^(www\.|m\.)/, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0] ?? "";
      return /^[A-Za-z0-9_-]{5,}$/.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v") ?? "";
        return /^[A-Za-z0-9_-]{5,}$/.test(id) ? id : null;
      }
      const m = /^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{5,})/.exec(u.pathname);
      return m ? m[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

/** youtube-search Edge 응답 후보 — API 실값 그대로(재작성 0). */
export type YoutubeSearchItem = {
  video_id?: string;
  title?: string | null;
  channel_title?: string | null;
  thumbnail_url?: string | null;
  published_at?: string | null;
};

/** Edge 후보 → 기존 DiscoverCandidate(장착 체인 입력형) 번역. video_id 없는 행은 제외.
 *  값은 실값 이관만 — 제목·채널명 창작·요약 금지. */
export function mapYoutubeSearchCandidates(items: YoutubeSearchItem[]): DiscoverCandidate[] {
  const out: DiscoverCandidate[] = [];
  for (const c of items) {
    if (typeof c.video_id !== "string" || !c.video_id) continue;
    const url = `https://www.youtube.com/watch?v=${c.video_id}`;
    out.push({
      provider: "youtube",
      source_url: url,
      source_id: c.video_id,
      canonical_url: url,
      title: c.title ?? null,
      thumbnail_url: c.thumbnail_url ?? null,
      author_name: c.channel_title ?? null,
      duration_sec: null,
      raw_meta: c.published_at ? { published_at: c.published_at } : {},
      published_at: c.published_at ?? null,
    });
  }
  return out;
}
