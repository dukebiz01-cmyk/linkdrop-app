import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface YouTubeEmbedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  originalUrl: string;
  title?: string;
  ctaItems?: Array<{ id: string; label: string; primary?: boolean }>;
  onCtaClick?: (id: string) => void;
  createDropUrl?: string;
}

export function YouTubeEmbedModal({
  open,
  onOpenChange,
  videoId,
  originalUrl,
  title = "영상 재생",
  ctaItems,
  onCtaClick,
  createDropUrl,
}: YouTubeEmbedModalProps) {
  useEffect(() => {
    if (open) {
      console.log("[analytics] video_embed_open", { videoId });
    }
  }, [open, videoId]);

  const handleClose = (next: boolean) => {
    if (!next) {
      console.log("[analytics] video_embed_close", { videoId });
    }
    onOpenChange(next);
  };

  const handleOriginalClick = () => {
    console.log("[analytics] video_original_click", { videoId });
  };

  const handleCtaClick = (id: string) => {
    console.log("[analytics] video_modal_cta_click", { videoId, ctaId: id });
    onCtaClick?.(id);
  };

  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&autoplay=1`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-lg border-0 bg-zinc-950 p-0 rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          YouTube 영상을 LinkDrop 안에서 재생합니다.
        </DialogDescription>
        <div className="w-full bg-black">
          <iframe
            src={embedSrc}
            title={title}
            className="w-full"
            style={{ height: "min(56.25vw, 60vh)" }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="flex items-center justify-between gap-3 bg-zinc-900 border-t border-zinc-800 px-4 py-3">
          <a
            href={originalUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleOriginalClick}
            className="inline-flex items-center gap-1 text-xs tracking-ko text-white/70 hover:text-white"
          >
            <ExternalLink className="size-3.5" strokeWidth={2} />
            YouTube에서 원본 보기
          </a>
        </div>
        {ctaItems?.length || createDropUrl ? (
          <div className="space-y-3 rounded-b-2xl bg-white px-4 py-4">
            {ctaItems && ctaItems.length > 0 && (
              <div className="flex gap-2">
                {ctaItems.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCtaClick(c.id)}
                    className={`flex-1 rounded-2xl py-3 text-sm font-semibold tracking-ko
                      ${
                        c.primary
                          ? "bg-[#2563EB] text-white"
                          : "border border-[#E5E5E5] text-text-strong"
                      }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
            {createDropUrl && (
              <a
                href={createDropUrl}
                className="block text-center text-xs tracking-ko text-[#A3A3A3] hover:text-[#2563EB]"
              >
                나도 이 영상 Drop 만들기 →
              </a>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
