import { useEffect } from "react";
import { ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface YouTubeEmbedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  originalUrl: string;
  title?: string;
}

export function YouTubeEmbedModal({
  open,
  onOpenChange,
  videoId,
  originalUrl,
  title = "영상 재생",
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

  const embedSrc = `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&autoplay=1`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl border-0 bg-black p-0 sm:rounded-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">
          YouTube 영상을 LinkDrop 안에서 재생합니다.
        </DialogDescription>
        <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
          <iframe
            src={embedSrc}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <div className="flex items-center justify-between gap-3 bg-black px-4 py-3">
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
      </DialogContent>
    </Dialog>
  );
}
