import { cn } from "@/lib/utils";

export function ErrorMessage({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn("text-sm font-medium text-intent-danger", className)}
    >
      {message}
    </p>
  );
}

export const friendlyErrors = {
  network: "잠깐, 네트워크가 불안정한 것 같아요. 다시 시도해 주세요.",
  unauthorized: "로그인이 필요해요. 다시 로그인해 주세요.",
  notFound: "찾으시는 항목이 없어요.",
  serverError: "서버에 잠깐 문제가 생겼어요. 곧 복구됩니다.",
  validation: "입력 내용을 한 번 더 확인해 주세요.",
  unknown: "알 수 없는 문제가 발생했어요. 다시 시도해 주세요.",
} as const;