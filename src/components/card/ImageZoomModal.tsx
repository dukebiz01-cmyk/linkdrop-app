import { X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * ImageZoomModal — 이미지를 전체화면 무크롭(object-contain)으로 확대.
 *   Radix @/components/ui/dialog 박막. 긴 세로 이미지 대응(max-h-[90vh]).
 *   닫기 = 바깥탭/ESC(Radix 기본) + 우상단 X(어두운 이미지 위 가시성 위해 dark-bg). src 비면 null(방어).
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
        <DialogClose asChild>
          <button
            type="button"
            aria-label="닫기"
            className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
