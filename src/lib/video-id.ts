// 유튜브 썸네일 URL 에서 videoId 추출 (me.tsx 에서 공용화 이동 — 홈 '내가만든' 재생과 공용).
// thumbnail 패턴: https://i.ytimg.com/vi/{id}/... · https://img.youtube.com/vi/{id}/...
// source_url 기반 추출은 @/lib/video-metadata 의 parseVideoUrl 사용(여기서 재수출하지 않음).
export function extractYouTubeVideoIdFromThumb(thumb: string | null | undefined): string | null {
  if (!thumb) return null;
  const m = thumb.match(/(?:i\.ytimg\.com|img\.youtube\.com)\/vi\/([A-Za-z0-9_-]+)/);
  return m?.[1] ?? null;
}
