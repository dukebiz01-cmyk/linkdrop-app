// pwa-install — beforeinstallprompt 캡처 싱글턴 + 환경 판정 (T7 PWA v1).
//   절대 규칙: 서비스워커 미포함(§0 락 — 등록 코드도 없음). SSR(Workers) 가드 — window 부재
//   시 전부 no-op. __root.tsx 가 모듈을 1회 로드해 리스너가 앱 수명 동안 상주한다.

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // 브라우저 기본 미니 인포바 억제 — me 버튼에서만 발화.
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

export type InstallState = "installable" | "installed" | "kakao" | "unsupported";

/** 환경 판정 — installed > kakao > installable > unsupported(iOS Safari 포함). */
export function getInstallState(): InstallState {
  if (typeof window === "undefined") return "unsupported";
  if (installed || window.matchMedia?.("(display-mode: standalone)")?.matches) return "installed";
  if (/KAKAOTALK/i.test(window.navigator.userAgent)) return "kakao";
  if (deferredPrompt) return "installable";
  return "unsupported";
}

/** 보관된 프롬프트 발화 — userChoice 결과 반환. 프롬프트 부재/소진 = unavailable. */
export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const p = deferredPrompt;
  if (!p) return "unavailable";
  try {
    await p.prompt();
  } catch {
    // 이미 소진된 이벤트(재발화 불가) — 비우고 조용히 종료(재촉 없음).
    deferredPrompt = null;
    notify();
    return "unavailable";
  }
  const choice = await p.userChoice;
  if (choice.outcome === "accepted") {
    deferredPrompt = null;
    notify();
  }
  return choice.outcome;
}

/** 상태 변화 구독(beforeinstallprompt/appinstalled) — 해제 함수 반환. */
export function subscribeInstallState(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
