import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * ImageZoomModal — 이미지를 전체화면 무크롭(object-contain)으로 확대.
 *   Radix @/components/ui/dialog 박막. 긴 세로 이미지 대응(max-h-[90vh]).
 *   닫기 = 바깥탭/ESC + DialogContent built-in X(YouTubeEmbedModal 동일 방식). src 비면 null(방어).
 */
export function ImageZoomModal({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!src) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl border-0 bg-transparent p-0 shadow-none">
        <DialogTitle className="sr-only">이미지 확대</DialogTitle>
        <img
          src={src}
          alt={alt ?? ""}
          className="max-h-[90vh] w-full rounded-lg object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
