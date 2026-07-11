// InstallAppButton — me 본문용 PWA 설치 버튼 (T7 PWA v1 · 43창 정직 렌더 조건).
//   'installable' 만 버튼 / 'kakao' 는 안내 1줄+[주소 복사] / 'installed'·'unsupported' 는
//   null(가짜 버튼 금지). 거절 시 그대로 — 재촉 문구 0(헌장 원칙 7). 이모지·pulse 금지.
import { useEffect, useState } from "react";
import { MonitorDown } from "lucide-react";
import {
  getInstallState,
  subscribeInstallState,
  triggerInstall,
  type InstallState,
} from "@/lib/pwa-install";

export function InstallAppButton() {
  // SSR/hydration 안전 — 초기 unsupported(null 렌더), 마운트 후 1회 판정 + 이벤트 갱신.
  const [state, setState] = useState<InstallState>("unsupported");
  useEffect(() => {
    setState(getInstallState());
    return subscribeInstallState(() => setState(getInstallState()));
  }, []);

  if (state === "installable") {
    return (
      <button
        type="button"
        onClick={() =>
          void triggerInstall().then(() => setState(getInstallState()))
        }
        className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[#EAEEF3] bg-white text-[#2563EB] transition-colors hover:border-[#E2E8F0] hover:bg-[#F8FAFC] active:scale-[0.99]"
      >
        <MonitorDown className="size-[17px]" strokeWidth={2.25} />
        <span className="text-[15px] font-bold tracking-ko">앱으로 설치</span>
      </button>
    );
  }

  if (state === "kakao") {
    return (
      <div className="rounded-xl border border-[#EAEEF3] bg-white p-4">
        <p className="text-[14px] font-medium leading-relaxed tracking-ko text-[#334155] [word-break:keep-all]">
          카카오톡 안에서는 설치가 안 돼요. 오른쪽 아래 ⋯ 메뉴에서 &lsquo;다른 브라우저로
          열기&rsquo;를 눌러 주세요.
        </p>
        <button
          type="button"
          onClick={() => {
            // 실패는 조용히 무시(명세 4절) — 클립보드 미지원 인앱 대비.
            void navigator.clipboard?.writeText(window.location.origin).catch(() => {});
          }}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#EAEEF3] bg-[#F8FAFC] text-[14px] font-bold tracking-ko text-[#2563EB] active:scale-[0.99]"
        >
          주소 복사
        </button>
      </div>
    );
  }

  // installed / unsupported — 아무것도 렌더하지 않음(가짜 버튼 금지).
  return null;
}
